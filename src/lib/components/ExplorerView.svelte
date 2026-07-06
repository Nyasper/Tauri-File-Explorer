<script lang="ts">
  import { explorerState } from '../state/explorer.state.svelte';
  import type { Tab } from '../types/explorer.types';
  import * as api from '../explorer.api';
  import EntryList from './EntryList.svelte';
  import EntryGrid from './EntryGrid.svelte';
  import { formatBytes } from '$lib/utils/formater';
  import { fade } from 'svelte/transition';

  // Selected items state per pane
  let primarySelected = $state(new Set<string>());
  let secondarySelected = $state(new Set<string>());

  // Clipboard for copy-paste operations
  let clipboardPaths = $state<string[]>([]);
  let isCutOperation = $state(false);

  // Search input values per pane
  let primarySearchVal = $state('');
  let secondarySearchVal = $state('');

  // Svelte 5 Derived views of active tab details
  const activeTab = $derived(explorerState.activeTab);
  const splitActive = $derived(!!activeTab?.splitView);

  // Svelte 5 Derived total sizes of paths
  const currentPathTotalSize = $derived(activeTab ? activeTab.files.reduce((acc, f) => acc + (f.size || 0), 0) : 0);

  // For Splitted View
  const secondaryTotalSize = $derived((activeTab && activeTab.splitView) ? activeTab.splitView.files.reduce((acc, f) => acc + (f.size || 0), 0) : 0);


  // Helper to get selection set based on side
  function getSelectionSet(side: 'primary' | 'secondary'): Set<string> {
    return side === 'secondary' ? secondarySelected : primarySelected;
  }

  function getPaneDetails(side: 'primary' | 'secondary'): { pane: Tab; selected: Set<string>; searchVal: string } {
    if (side === 'secondary' && activeTab.splitView) {
      return { pane: activeTab.splitView, selected: secondarySelected, searchVal: secondarySearchVal };
    }
    return { pane: activeTab, selected: primarySelected, searchVal: primarySearchVal };
  }

  // Handle focus changes when user clicks inside a pane
  function focusPane(side: 'primary' | 'secondary') {
    explorerState.focusPane(side);
  }

  // Handle file selection toggling
  function toggleSelection(side: 'primary' | 'secondary', path: string, isMulti: boolean) {
    const selected = getSelectionSet(side);
    if (isMulti) {
      if (selected.has(path)) {
        selected.delete(path);
      } else {
        selected.add(path);
      }
    } else {
      selected.clear();
      selected.add(path);
    }
    // Trigger reactivity
    if (side === 'secondary') {
      secondarySelected = new Set(selected);
    } else {
      primarySelected = new Set(selected);
    }
  }

  // Double click navigation handler
  async function handleNavigate(side: 'primary' | 'secondary', path: string) {
    const selected = getSelectionSet(side);
    selected.clear();
    if (side === 'secondary') {
      secondarySelected = new Set();
    } else {
      primarySelected = new Set();
    }
    await explorerState.navigate(activeTab.id, side, path);
  }

  // Open file with system handler
  async function handleOpenFile(path: string) {
    try {
      await api.openFile(path);
    } catch (err) {
      alert(`Could not open file: ${err}`);
    }
  }

  // Navigation History controls
  async function goBack(side: 'primary' | 'secondary') {
    await explorerState.goBack(activeTab.id, side);
  }

  async function goForward(side: 'primary' | 'secondary') {
    await explorerState.goForward(activeTab.id, side);
  }

  async function goUp(side: 'primary' | 'secondary') {
    const { pane } = getPaneDetails(side);
    const path = pane.currentPath;
    
    // Calculate parent folder path
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    
    if (parts.length === 0) return; // Already at root
    
    // Reconstruct parent path
    let parentPath = '';
    if (path.includes(':')) {
      // Windows drive support
      const drive = path.split(':')[0] + ':';
      parentPath = drive + '\\' + parts.slice(1, -1).join('\\');
      if (parts.length === 2) {
        parentPath = drive + '\\';
      }
    } else {
      // Unix/Linux/macOS path
      parentPath = '/' + parts.slice(0, -1).join('/');
      if (parentPath === '') parentPath = '/';
    }
    
    await handleNavigate(side, parentPath);
  }

  async function handleRefresh(side: 'primary' | 'secondary') {
    await explorerState.refresh(activeTab.id, side);
  }

  // File Operations: Create Folder
  async function createFolder(side: 'primary' | 'secondary') {
    const { pane } = getPaneDetails(side);
    const folderName = prompt('Enter new folder name:');
    if (!folderName || !folderName.trim()) return;

    const separator = pane.currentPath.endsWith('/') || pane.currentPath.endsWith('\\') ? '' : '/';
    const targetPath = `${pane.currentPath}${separator}${folderName.trim()}`;

    try {
      await api.createFile(targetPath, true);
      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      alert(`Error creating folder: ${err}`);
    }
  }

  // File Operations: Create File
  async function createNewFile(side: 'primary' | 'secondary') {
    const { pane } = getPaneDetails(side);
    const fileName = prompt('Enter new file name:');
    if (!fileName || !fileName.trim()) return;

    const separator = pane.currentPath.endsWith('/') || pane.currentPath.endsWith('\\') ? '' : '/';
    const targetPath = `${pane.currentPath}${separator}${fileName.trim()}`;

    try {
      await api.createFile(targetPath, false);
      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      alert(`Error creating file: ${err}`);
    }
  }

  // File Operations: Rename
  async function renameSelected(side: 'primary' | 'secondary') {
    const { pane, selected } = getPaneDetails(side);
    if (selected.size !== 1) return;

    const oldPath = Array.from(selected)[0];
    const oldName = oldPath.substring(Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')) + 1);

    const newName = prompt('Enter new name:', oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    const parentDir = oldPath.substring(0, oldPath.length - oldName.length);
    const newPath = `${parentDir}${newName.trim()}`;

    try {
      await api.renameFile(oldPath, newPath);
      selected.clear();
      if (side === 'secondary') {
        secondarySelected = new Set();
      } else {
        primarySelected = new Set();
      }
      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      alert(`Error renaming file: ${err}`);
    }
  }

  // File Operations: Delete
  async function deleteSelected(side: 'primary' | 'secondary') {
    const { selected } = getPaneDetails(side);
    if (selected.size === 0) return;

    const confirmMsg = `Are you sure you want to delete the ${selected.size} selected item(s)?`;
    if (!confirm(confirmMsg)) return;

    try {
      for (const path of selected) {
        await api.deleteFile(path);
      }
      selected.clear();
      if (side === 'secondary') {
        secondarySelected = new Set();
      } else {
        primarySelected = new Set();
      }
      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      alert(`Error deleting items: ${err}`);
    }
  }

  // Clipboard operations: Copy
  function copySelected(side: 'primary' | 'secondary') {
    const { selected } = getPaneDetails(side);
    if (selected.size === 0) return;
    
    clipboardPaths = Array.from(selected);
    isCutOperation = false;
  }

  // Clipboard operations: Cut
  function cutSelected(side: 'primary' | 'secondary') {
    const { selected } = getPaneDetails(side);
    if (selected.size === 0) return;

    clipboardPaths = Array.from(selected);
    isCutOperation = true;
  }

  // Clipboard operations: Paste
  async function pasteClipboard(side: 'primary' | 'secondary') {
    if (clipboardPaths.length === 0) return;
    const { pane } = getPaneDetails(side);

    try {
      for (const src of clipboardPaths) {
        const leafName = src.substring(Math.max(src.lastIndexOf('/'), src.lastIndexOf('\\')) + 1);
        const separator = pane.currentPath.endsWith('/') || pane.currentPath.endsWith('\\') ? '' : '/';
        const dest = `${pane.currentPath}${separator}${leafName}`;

        if (isCutOperation) {
          await api.moveFile(src, dest);
        } else {
          await api.copyFile(src, dest);
        }
      }

      if (isCutOperation) {
        // Clear clipboard after cut & paste completes
        clipboardPaths = [];
        isCutOperation = false;
      }

      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      alert(`Error pasting: ${err}`);
    }
  }

  // Toggle layout mode
  function toggleViewMode(side: 'primary' | 'secondary') {
    const { pane } = getPaneDetails(side);
    pane.viewState.viewMode = pane.viewState.viewMode === 'list' ? 'grid' : 'list';
  }



  // Toggle Splitted View
  function handleToggleSplit() {
    explorerState.toggleSplitView(activeTab.id);
  }

  // Navigation text input submission
  async function handlePathSubmit(side: 'primary' | 'secondary', e: Event) {
    e.preventDefault();
    const { pane } = getPaneDetails(side);
    await handleNavigate(side, pane.currentPath);
  }

  // Search input typing
  function handleSearchInput(side: 'primary' | 'secondary', value: string) {
    if (side === 'secondary') {
      secondarySearchVal = value;
    } else {
      primarySearchVal = value;
    }
    explorerState.searchInPane(activeTab.id, side, value);
  }

  // Set keyboard key handlers for delete, copy, cut, paste actions
  function handleKeyDown(e: KeyboardEvent, side: 'primary' | 'secondary') {
    if (e.target instanceof HTMLInputElement) return; // Ignore inside input fields

    if (e.key === 'Delete') {
      deleteSelected(side);
    } else if (e.ctrlKey && e.key === 'c') {
      copySelected(side);
    } else if (e.ctrlKey && e.key === 'x') {
      cutSelected(side);
    } else if (e.ctrlKey && e.key === 'v') {
      pasteClipboard(side);
    } else if (e.key === 'F5') {
      handleRefresh(side);
    }
  }
</script>

{#if !activeTab}
  <div class="no-tab">No tab is active. Click "+" to create one.</div>
{:else}
  <div class="explorer-view-wrapper">
    <!-- Render primary and secondary split screens side-by-side -->
    <div class="split-panes-container">
      
      <!-- Primary Pane -->
      <div 
        class="pane-pane primary-pane" 
        class:focused={explorerState.activePaneSide === 'primary' && splitActive}
        onclickcapture={() => focusPane('primary')}
        onkeydown={(e) => handleKeyDown(e, 'primary')}
        tabindex="0"
        role="application"
        aria-label="Primary explorer pane"
      >
        <!-- Nav Controls Header -->
        <div class="pane-header">
          <div class="navigation-controls">
            <button 
              onclick={() => goBack('primary')} 
              disabled={activeTab.historyIndex <= 0}
              title="Back"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button 
              onclick={() => goForward('primary')} 
              disabled={activeTab.historyIndex >= activeTab.history.length - 1}
              title="Forward"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button onclick={() => goUp('primary')} title="Parent Directory">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            </button>
            <button onclick={() => handleRefresh('primary')} title="Refresh (F5)">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
          </div>

          <!-- Path Input bar -->
          <form class="path-form" onsubmit={(e) => handlePathSubmit('primary', e)}>
            <input 
              type="text" 
              class="path-input" 
              bind:value={activeTab.currentPath} 
              placeholder="Path..."
            />
          </form>

          <!-- Search bar -->
          <div class="search-wrapper">
            <input 
              type="text" 
              class="search-input" 
              placeholder="Search..." 
              value={primarySearchVal}
              oninput={(e) => handleSearchInput('primary', (e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        <!-- Action tools toolbar -->
        <div class="action-bar">
          <div class="actions-group">
            <button onclick={() => createFolder('primary')} title="New Folder">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              <span>Folder</span>
            </button>
            <button onclick={() => createNewFile('primary')} title="New File">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              <span>File</span>
            </button>
            <div class="divider"></div>
            <button onclick={() => copySelected('primary')} disabled={primarySelected.size === 0} title="Copy (Ctrl+C)">Copy</button>
            <button onclick={() => cutSelected('primary')} disabled={primarySelected.size === 0} title="Cut (Ctrl+X)">Cut</button>
            <button onclick={() => pasteClipboard('primary')} disabled={clipboardPaths.length === 0} title="Paste (Ctrl+V)">Paste</button>
            <button onclick={() => renameSelected('primary')} disabled={primarySelected.size !== 1} title="Rename">Rename</button>
            <button class="delete-btn" onclick={() => deleteSelected('primary')} disabled={primarySelected.size === 0} title="Delete (Del)">Delete</button>
          </div>

          <div class="actions-group">
            <button onclick={() => toggleViewMode('primary')} title="Toggle List/Grid">
              {#if activeTab.viewState.viewMode === 'list'}
                <!-- Grid mode icon -->
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              {:else}
                <!-- List mode icon -->
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              {/if}
            </button>
            <button onclick={handleToggleSplit} class="split-btn" class:active={splitActive} title="Toggle split screen">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="3" x2="12" y2="21"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </button>
          </div>
        </div>

        <!-- Directory content container -->
        <div class="pane-content-container">
          {#key activeTab.currentPath + activeTab.viewState.viewMode}
            <div class="transition-wrapper" in:fade={{ duration: 150 }}>
              {#if activeTab.viewState.viewMode === 'list'}
                <EntryList 
                  files={activeTab.files}
                  selectedPaths={primarySelected}
                  onNavigate={(p) => handleNavigate('primary', p)}
                  onOpenFile={handleOpenFile}
                  onToggleSelect={(p, m) => toggleSelection('primary', p, m)}
                  paneSide="primary"
                />
              {:else}
                <EntryGrid 
                  files={activeTab.files}
                  selectedPaths={primarySelected}
                  onNavigate={(p) => handleNavigate('primary', p)}
                  onOpenFile={handleOpenFile}
                  onToggleSelect={(p, m) => toggleSelection('primary', p, m)}
                />
              {/if}
            </div>
          {/key}
        </div>

        <!-- Status footer -->
        <div class="pane-footer">
          <div class="footer-left">
            <span>{activeTab.files.length} items</span>
            {#if primarySelected.size > 0}
              <span class="selection-count">| {primarySelected.size} items selected</span>
            {/if}
          </div>
          <span class="footer-right">{formatBytes(currentPathTotalSize)}</span>
        </div>
      </div>

      <!-- Secondary Split Pane -->
      {#if activeTab.splitView}
        <div class="split-divider" transition:fade={{ duration: 150 }}></div>
        <div 
          class="pane-pane secondary-pane" 
          class:focused={explorerState.activePaneSide === 'secondary'}
          onclickcapture={() => focusPane('secondary')}
          onkeydown={(e) => handleKeyDown(e, 'secondary')}
          tabindex="0"
          role="application"
          aria-label="Secondary explorer pane"
          transition:fade={{ duration: 150 }}
        >
          <!-- Nav Controls Header -->
          <div class="pane-header">
            <div class="navigation-controls">
              <button 
                onclick={() => goBack('secondary')} 
                disabled={activeTab.splitView.historyIndex <= 0}
                title="Back"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button 
                onclick={() => goForward('secondary')} 
                disabled={activeTab.splitView.historyIndex >= activeTab.splitView.history.length - 1}
                title="Forward"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button onclick={() => goUp('secondary')} title="Parent Directory">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              </button>
              <button onclick={() => handleRefresh('secondary')} title="Refresh (F5)">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              </button>
            </div>

            <!-- Path Input bar -->
            <form class="path-form" onsubmit={(e) => handlePathSubmit('secondary', e)}>
              <input 
                type="text" 
                class="path-input" 
                bind:value={activeTab.splitView.currentPath} 
                placeholder="Path..."
              />
            </form>

            <!-- Search bar -->
            <div class="search-wrapper">
              <input 
                type="text" 
                class="search-input" 
                placeholder="Search..." 
                value={secondarySearchVal}
                oninput={(e) => handleSearchInput('secondary', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          <!-- Action tools toolbar -->
          <div class="action-bar">
            <div class="actions-group">
              <button onclick={() => createFolder('secondary')} title="New Folder">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                <span>Folder</span>
              </button>
              <button onclick={() => createNewFile('secondary')} title="New File">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <span>File</span>
              </button>
              <div class="divider"></div>
              <button onclick={() => copySelected('secondary')} disabled={secondarySelected.size === 0} title="Copy (Ctrl+C)">Copy</button>
              <button onclick={() => cutSelected('secondary')} disabled={secondarySelected.size === 0} title="Cut (Ctrl+X)">Cut</button>
              <button onclick={() => pasteClipboard('secondary')} disabled={clipboardPaths.length === 0} title="Paste (Ctrl+V)">Paste</button>
              <button onclick={() => renameSelected('secondary')} disabled={secondarySelected.size !== 1} title="Rename">Rename</button>
              <button class="delete-btn" onclick={() => deleteSelected('secondary')} disabled={secondarySelected.size === 0} title="Delete (Del)">Delete</button>
            </div>

            <div class="actions-group">
              <button onclick={() => toggleViewMode('secondary')} title="Toggle List/Grid">
                {#if activeTab.splitView.viewState.viewMode === 'list'}
                  <!-- Grid mode icon -->
                  <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                {:else}
                  <!-- List mode icon -->
                  <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                {/if}
              </button>
              <button onclick={handleToggleSplit} class="split-btn active" title="Close split screen">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="3" x2="12" y2="21"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
              </button>
            </div>
          </div>

          <!-- Directory content container -->
          <div class="pane-content-container">
            {#key activeTab.splitView.currentPath + activeTab.splitView.viewState.viewMode}
              <div class="transition-wrapper" in:fade={{ duration: 150 }}>
                {#if activeTab.splitView.viewState.viewMode === 'list'}
                  <EntryList 
                    files={activeTab.splitView.files}
                    selectedPaths={secondarySelected}
                    onNavigate={(p) => handleNavigate('secondary', p)}
                    onOpenFile={handleOpenFile}
                    onToggleSelect={(p, m) => toggleSelection('secondary', p, m)}
                    paneSide="secondary"
                  />
                {:else}
                  <EntryGrid 
                    files={activeTab.splitView.files}
                    selectedPaths={secondarySelected}
                    onNavigate={(p) => handleNavigate('secondary', p)}
                    onOpenFile={handleOpenFile}
                    onToggleSelect={(p, m) => toggleSelection('secondary', p, m)}
                  />
                {/if}
              </div>
            {/key}
          </div>

          <!-- Status footer -->
          <div class="pane-footer">
            <div class="footer-left">
              <span>{activeTab.splitView.files.length} items</span>
              {#if secondarySelected.size > 0}
                <span class="selection-count">| {secondarySelected.size} items selected</span>
              {/if}
            </div>
            <span class="footer-right">{formatBytes(secondaryTotalSize)}</span>
          </div>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  .explorer-view-wrapper {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    overflow: hidden;
    background-color: var(--bg-primary);
  }

  .split-panes-container {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .pane-pane {
    flex: 1 1 0%;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    outline: none;
    background-color: var(--bg-primary);
    transition: box-shadow var(--transition-normal);
  }

  /* Focused panel highlight */
  .pane-pane.focused {
    box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), 0.15);
  }

  .split-divider {
    width: 1px;
    background-color: var(--border-color);
    flex-shrink: 0;
  }

  .pane-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .navigation-controls {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .navigation-controls button {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
  }

  .navigation-controls button:hover:not(:disabled) {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .path-form {
    flex-grow: 1;
    display: flex;
  }

  .path-input {
    width: 100%;
    height: 28px;
    font-size: 0.85rem;
    padding: 0 10px;
    background-color: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
  }

  :root[data-theme="light"] .path-input {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .path-input:focus {
    background-color: var(--bg-tertiary);
  }

  .search-wrapper {
    width: 150px;
  }

  .search-input {
    width: 100%;
    height: 28px;
    font-size: 0.85rem;
    padding: 0 10px;
    background-color: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
  }

  :root[data-theme="light"] .search-input {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .search-input:focus {
    background-color: var(--bg-tertiary);
  }

  .action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .actions-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .action-bar button {
    height: 26px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
    background-color: transparent;
    border: 1px solid transparent;
    gap: 6px;
  }

  .action-bar button:hover:not(:disabled) {
    background-color: var(--bg-hover);
    border-color: var(--border-color);
    color: var(--text-primary);
  }

  .action-bar button.active {
    background-color: var(--bg-active);
    color: var(--accent);
    border-color: rgba(var(--accent-rgb), 0.25);
  }

  .action-bar .delete-btn:hover:not(:disabled) {
    background-color: var(--danger);
    border-color: var(--danger);
    color: white;
  }

  .action-bar .divider {
    width: 1px;
    height: 16px;
    background-color: var(--border-color);
    margin: 0 4px;
  }

  .pane-content-container {
    flex-grow: 1;
    overflow: hidden;
    position: relative;
  }

  .transition-wrapper {
    width: 100%;
    height: 100%;
  }

  .pane-footer {
    height: 24px;
    background-color: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 12px;
    font-size: 0.75rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .footer-right {
    font-family: monospace;
    font-weight: 500;
  }

  .selection-count {
    color: var(--accent);
    font-weight: 500;
  }

  .no-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-style: italic;
    background-color: var(--bg-primary);
  }

  /* Make focused panel navigation headers slightly distinct */
  .pane-pane.focused .pane-header {
    background-color: rgba(var(--accent-rgb), 0.04);
  }
</style>

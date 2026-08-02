<script lang="ts">
  import { explorerState } from '../state/explorer.state.svelte';
  import type { Tab } from '../types/explorer.types';
  import * as explorerApi from '../explorer.api';
  import EntryList from './EntryList.svelte';
  import EntryGrid from './EntryGrid.svelte';
  import { formatBytes } from '$lib/utils/formater';
  import { getParentPath } from '$lib/utils/path.helper';
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { SvelteSet } from 'svelte/reactivity';
  import Sidebar from './Sidebar.svelte';
  import { configService } from '../services/config.service.svelte';
  import { dialogService } from '../services/dialog.service.svelte';
  import { recentsService } from '../services/recents.service.svelte';



  $effect(() => {
    const escKeyToDeselect = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Ignore if user is currently typing in an input field
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        // Ignore if help or config modal is open (let the keybinding service close them first)
        if (explorerState.isHelpModalOpen || explorerState.isConfigModalOpen) {
          return;
        }

        // Ignore while a global dialog is open (the dialog handles Escape itself)
        if (dialogService.isOpen) {
          return;
        }

        // Deselect only the active pane's selected items (Premium dual-pane design)
        if (explorerState.activePaneSide === 'secondary') {
          if (secondarySelected.size > 0) {
            e.preventDefault();
            secondarySelected.clear();
          }
        } else {
          if (primarySelected.size > 0) {
            e.preventDefault();
            primarySelected.clear();
          }
        }
      }
    };

    window.addEventListener('keydown', escKeyToDeselect);
    return () => {
      window.removeEventListener('keydown', escKeyToDeselect);
    };
  });

  // Clipboard for copy-paste operations
  const clipboardPaths = $derived(explorerState.clipboardPaths);
  const isCutOperation = $derived(explorerState.isCutOperation);

  // Search input values per pane
  let primarySearchVal = $state('');
  let secondarySearchVal = $state('');

  // Svelte 5 Derived views of active tab details
  const activeTab = $derived(explorerState.activeTab);
  const splitActive = $derived(!!activeTab?.splitView);

  // Selected items state per pane derived from active tab
  const primarySelected = $derived(activeTab.selectedPaths);
  const secondarySelected = $derived(activeTab.splitView ? activeTab.splitView.selectedPaths : new SvelteSet<string>());

  // Svelte 5 Derived total sizes of paths
  const currentPathTotalSize = $derived(activeTab ? activeTab.files.reduce((acc, f) => acc + (f.size || 0), 0) : 0);

  // For Splitted View
  const secondaryTotalSize = $derived((activeTab && activeTab.splitView) ? activeTab.splitView.files.reduce((acc, f) => acc + (f.size || 0), 0) : 0);

  // Local buffers for the path inputs so that typing into them doesn't
  // mutate pane.currentPath live (which would break the breadcrumb and
  // other deriveds while the user is still editing). We commit the value
  // only when the form is submitted.
  let primaryPathVal = $state(untrack(() => activeTab?.currentPath ?? ''));
  let secondaryPathVal = $state(untrack(() => activeTab.splitView?.currentPath ?? ''));

  // Keep the local buffers in sync when navigation happens through other
  // means (history buttons, sidebar clicks, goUp, goBack, ...).
  $effect(() => {
    const t = activeTab;
    if (t) primaryPathVal = t.currentPath;
  });
  $effect(() => {
    const sv = activeTab?.splitView;
    if (sv) secondaryPathVal = sv.currentPath;
  });


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



  // Double click navigation handler
  async function handleNavigate(side: 'primary' | 'secondary', path: string) {
    const selected = getSelectionSet(side);
    selected.clear();
    await explorerState.navigate(activeTab.id, side, path);
  }

  // Open file with system handler
  async function handleOpenFile(path: string) {
    try {
      await explorerApi.openFile(path);
      // Track the opened file in the recents list (no-op if disabled)
      recentsService.add(path, false);
    } catch (err) {
      await dialogService.alert(`Could not open file: ${err}`);
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
    const parentPath = getParentPath(pane.currentPath);
    if (!parentPath) return; // Already at root
    await handleNavigate(side, parentPath);
  }

  async function handleRefresh(side: 'primary' | 'secondary') {
    await explorerState.refresh(activeTab.id, side);
  }

  // File Operations: Create Folder
  async function createFolder(side: 'primary' | 'secondary') {
    const { pane } = getPaneDetails(side);
    const folderName = await dialogService.prompt('Enter new folder name:', '', 'New Folder');
    if (!folderName || !folderName.trim()) return;

    const separator = pane.currentPath.endsWith('/') || pane.currentPath.endsWith('\\') ? '' : '/';
    const targetPath = `${pane.currentPath}${separator}${folderName.trim()}`;

    try {
      await explorerApi.createFile(targetPath, true);
      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      await dialogService.alert(`Error creating folder: ${err}`);
    }
  }

  // File Operations: Create File
  async function createNewFile(side: 'primary' | 'secondary') {
    const { pane } = getPaneDetails(side);
    const fileName = await dialogService.prompt('Enter new file name:', '', 'New File');
    if (!fileName || !fileName.trim()) return;

    const separator = pane.currentPath.endsWith('/') || pane.currentPath.endsWith('\\') ? '' : '/';
    const targetPath = `${pane.currentPath}${separator}${fileName.trim()}`;

    try {
      await explorerApi.createFile(targetPath, false);
      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      await dialogService.alert(`Error creating file: ${err}`);
    }
  }

  // File Operations: Rename
  async function renameSelected(side: 'primary' | 'secondary') {
    const { pane, selected } = getPaneDetails(side);
    if (selected.size !== 1) return;

    const oldPath = Array.from(selected)[0];
    const oldName = oldPath.substring(Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')) + 1);

    const newName = await dialogService.prompt('Enter new name:', oldName, 'Rename');
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    const parentDir = oldPath.substring(0, oldPath.length - oldName.length);
    const newPath = `${parentDir}${newName.trim()}`;

    try {
      await explorerApi.renameFile(oldPath, newPath);
      selected.clear();
      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      await dialogService.alert(`Error renaming file: ${err}`);
    }
  }

  // File Operations: Delete
  async function deleteSelected(side: 'primary' | 'secondary') {
    const { selected } = getPaneDetails(side);
    if (selected.size === 0) return;

    if (configService.config.confirmDelete) {
      const confirmMsg = `Are you sure you want to delete the ${selected.size} selected item(s)?`;
      const confirmed = await dialogService.confirm(confirmMsg, {
        title: 'Delete Items',
        confirmLabel: 'Delete',
        danger: true
      });
      if (!confirmed) return;
    }

    try {
      for (const path of selected) {
        await explorerApi.deleteFile(path);
      }
      selected.clear();
      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      await dialogService.alert(`Error deleting items: ${err}`);
    }
  }

  // Clipboard operations: Copy
  function copySelected(side: 'primary' | 'secondary') {
    const { selected } = getPaneDetails(side);
    if (selected.size === 0) return;
    
    explorerState.clipboardPaths = Array.from(selected);
    explorerState.isCutOperation = false;
  }

  // Clipboard operations: Cut
  function cutSelected(side: 'primary' | 'secondary') {
    const { selected } = getPaneDetails(side);
    if (selected.size === 0) return;

    explorerState.clipboardPaths = Array.from(selected);
    explorerState.isCutOperation = true;
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
          await explorerApi.moveFile(src, dest);
        } else {
          await explorerApi.copyFile(src, dest);
        }
      }

      if (explorerState.isCutOperation) {
        // Clear clipboard after cut & paste completes
        explorerState.clipboardPaths = [];
        explorerState.isCutOperation = false;
      }

      await explorerState.refresh(activeTab.id, side);
    } catch (err) {
      await dialogService.alert(`Error pasting: ${err}`);
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
    // Use the local buffered input value (which reflects what the user
    // actually typed) and let handleNavigate commit it to pane.currentPath
    // via explorerState.navigate. If navigation fails the buffer stays as
    // the user typed it (they can edit again); the pane.currentPath is not
    // left in a half-typed state because navigate handles errors itself.
    const inputValue =
      side === 'secondary' ? secondaryPathVal : primaryPathVal;
    await handleNavigate(side, inputValue);
    // If the destination was invalid, pane.currentPath remains unchanged;
    // resync the local buffer so the input doesn't show a stale value.
    if (side === 'secondary') {
      secondaryPathVal = pane.currentPath;
    } else {
      primaryPathVal = pane.currentPath;
    }
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
      e.preventDefault();
      e.stopPropagation();
      deleteSelected(side);
    } else if (e.key === 'F2') {
      e.preventDefault();
      e.stopPropagation();
      renameSelected(side);
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      e.stopPropagation();
      copySelected(side);
    } else if (e.ctrlKey && e.key === 'x') {
      e.preventDefault();
      e.stopPropagation();
      cutSelected(side);
    } else if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      e.stopPropagation();
      pasteClipboard(side);
    } else if (e.key === 'F5') {
      e.preventDefault();
      e.stopPropagation();
      handleRefresh(side);
    }
  }

  const primaryActions = {
    rename: () => renameSelected('primary'),
    delete: () => deleteSelected('primary'),
    copy: () => copySelected('primary'),
    cut: () => cutSelected('primary'),
    paste: () => pasteClipboard('primary'),
    createFolder: () => createFolder('primary'),
    createFile: () => createNewFile('primary'),
    refresh: () => handleRefresh('primary'),
  };

  const secondaryActions = {
    rename: () => renameSelected('secondary'),
    delete: () => deleteSelected('secondary'),
    copy: () => copySelected('secondary'),
    cut: () => cutSelected('secondary'),
    paste: () => pasteClipboard('secondary'),
    createFolder: () => createFolder('secondary'),
    createFile: () => createNewFile('secondary'),
    refresh: () => handleRefresh('secondary'),
  };
</script>

{#if !activeTab}
  <div class="no-tab">No tab is active. Click "+" to create one.</div>
{:else}
  <div class="explorer-view-wrapper">
    <div class="explorer-main-layout">
      {#if configService.config.showSidebar}
        <Sidebar />
      {/if}
      <!-- Render primary and secondary split screens side-by-side -->
      <div class="split-panes-container">
      
      <!-- Primary Pane -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
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
              bind:value={primaryPathVal} 
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
            <button class="btn-primary" onclick={() => createFolder('primary')} title="New Folder">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              <span>Folder</span>
            </button>
            <button class="btn-primary" onclick={() => createNewFile('primary')} title="New File">
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
              {#if activeTab.viewState.viewMode === 'list'}
                <EntryList 
                  files={activeTab.files}
                  onNavigate={(p) => handleNavigate('primary', p)}
                  onOpenFile={handleOpenFile}
                  paneSide="primary"
                  actions={primaryActions}
                  canPaste={clipboardPaths.length > 0}
                  isLoading={activeTab.isLoading}
                />
              {:else}
                <EntryGrid 
                  files={activeTab.files}
                  onNavigate={(p) => handleNavigate('primary', p)}
                  onOpenFile={handleOpenFile}
                  paneSide="primary"
                  actions={primaryActions}
                  canPaste={clipboardPaths.length > 0}
                  isLoading={activeTab.isLoading}
                />
              {/if}

          <!-- Status footer -->
          <div class="pane-footer">
            <div class="footer-left">
              <span>{activeTab.files.length} items</span>
              {#if activeTab.isLoading}
                <span class="loading-indicator">Loading…</span>
              {/if}
              {#if primarySelected.size > 0}
                <span class="selection-count">| {primarySelected.size} items selected</span>
              {/if}
            </div>
            <span class="footer-right">{formatBytes(currentPathTotalSize)}</span>
          </div>
        </div>
      </div>

      <!-- Secondary Split Pane -->
      {#if activeTab.splitView}
        <div class="split-divider" transition:fade={{ duration: 150 }}></div>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
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
                bind:value={secondaryPathVal} 
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
              <button class="btn-primary" onclick={() => createFolder('secondary')} title="New Folder">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                <span>Folder</span>
              </button>
              <button class="btn-primary" onclick={() => createNewFile('secondary')} title="New File">
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
                {#if activeTab.splitView.viewState.viewMode === 'list'}
                  <EntryList 
                    files={activeTab.splitView.files}
                    onNavigate={(p) => handleNavigate('secondary', p)}
                    onOpenFile={handleOpenFile}
                    paneSide="secondary"
                    actions={secondaryActions}
                    canPaste={clipboardPaths.length > 0}
                    isLoading={activeTab.splitView.isLoading}
                  />
                {:else}
                  <EntryGrid 
                    files={activeTab.splitView.files}
                    onNavigate={(p) => handleNavigate('secondary', p)}
                    onOpenFile={handleOpenFile}
                    paneSide="secondary"
                    actions={secondaryActions}
                    canPaste={clipboardPaths.length > 0}
                    isLoading={activeTab.splitView.isLoading}
                  />
                {/if}

            <!-- Status footer -->
            <div class="pane-footer">
              <div class="footer-left">
                <span>{activeTab.splitView.files.length} items</span>
                {#if activeTab.splitView.isLoading}
                  <span class="loading-indicator">Loading…</span>
                {/if}
                {#if secondarySelected.size > 0}
                  <span class="selection-count">| {secondarySelected.size} items selected</span>
                {/if}
              </div>
              <span class="footer-right">{formatBytes(secondaryTotalSize)}</span>
            </div>
          </div>
        </div>
      {/if}

      </div>
    </div>
  </div>
{/if}

<style>
  .explorer-view-wrapper {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    overflow: hidden;
    background-color: var(--bg-primary);
  }

  .explorer-main-layout {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .split-panes-container {
    display: flex;
    flex-direction: row;
    flex-grow: 1;
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
    background-color: var(--bg-secondary);
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
    flex-wrap: wrap;
    row-gap: 4px;
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

  .action-bar button.btn-primary {
    background-color: var(--accent);
    color: white;
    box-shadow: 0 2px 4px rgba(var(--accent-rgb), 0.2);
  }

  .action-bar button.btn-primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
    border-color: transparent;
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
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    margin: 10px;
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
  }


  .pane-footer {
    height: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 16px 8px 16px;
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

  .loading-indicator {
    color: var(--accent);
    font-weight: 500;
    animation: loading-pulse 1.2s ease-in-out infinite;
  }

  @keyframes loading-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
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

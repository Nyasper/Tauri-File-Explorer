<script lang="ts">
  import { sidebarState } from '../state/sidebar.state.svelte';
  import { explorerState } from '../state/explorer.state.svelte';
  import SidebarItem from './SidebarItem.svelte';
  import * as explorerApi from '../explorer.api';
  import { normalizePath } from '../utils/path.helper';
  import { dialogService } from '../services/dialog.service.svelte';
  import { configService } from '../services/config.service.svelte';
  import { recentsService, type RecentEntry } from '../services/recents.service.svelte';

  // Watch active directory path or sidebar initialization to auto-expand
  $effect(() => {
    if (sidebarState.isInitialized && explorerState.activePanePath) {
      sidebarState.expandToPath(explorerState.activePanePath);
    }
  });

  // Open Recycle Bin inside the app
  async function handleOpenRecycleBin() {
    try {
      const recyclePath = await explorerApi.getRecycleBinPath();
      await explorerState.navigate(
        explorerState.activeTab.id,
        explorerState.activePaneSide,
        recyclePath
      );
    } catch (err) {
      await dialogService.alert(`Could not open Recycle Bin: ${err}`);
    }
  }

  let isRecycleBinBusy = $state(false);

  async function handleEmptyRecycleBin(e: MouseEvent) {
    e.stopPropagation();
    const confirmed = await dialogService.confirm('Empty the Recycle Bin?', {
      title: 'Empty Recycle Bin',
      confirmLabel: 'Empty',
      danger: true
    });
    if (!confirmed) return;
    if (isRecycleBinBusy) return;
    isRecycleBinBusy = true;
    try {
      await explorerApi.emptyRecycleBin();
      // Refresh current pane if it shows the recycle bin
      if (explorerState.activePanePath) {
        const recyclePath = await explorerApi.getRecycleBinPath();
        // Normalize both sides so backslashes/forward slashes don't break
        // the prefix comparison on Windows (Rust paths use backslashes).
        const normalizedActive = normalizePath(explorerState.activePanePath);
        const normalizedRecycle = normalizePath(recyclePath);
        if (normalizedActive.startsWith(normalizedRecycle)) {
          await explorerState.refresh(explorerState.activeTab.id, explorerState.activePaneSide);
        }
      }
    } catch (err) {
      await dialogService.alert(`Could not empty Recycle Bin: ${err}`);
    } finally {
      isRecycleBinBusy = false;
    }
  }

  // Open a recent entry: folders navigate, files open with the system handler
  async function handleOpenRecent(recent: RecentEntry) {
    if (recent.isDir) {
      await explorerState.navigate(
        explorerState.activeTab.id,
        explorerState.activePaneSide,
        recent.path
      );
    } else {
      try {
        await explorerApi.openFile(recent.path);
      } catch (err) {
        await dialogService.alert(`Could not open file: ${err}`);
      }
    }
  }

  // Keyboard rename shortcut listener (F2) when focused in sidebar
  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;

    if (e.key === 'F2') {
      const activePath = explorerState.activePanePath;
      if (activePath) {
        e.preventDefault();
        e.stopPropagation();
        handleRenameActivePath(activePath);
      }
    }
  }

  async function handleRenameActivePath(activePath: string) {
    const oldName = activePath.substring(Math.max(activePath.lastIndexOf('/'), activePath.lastIndexOf('\\')) + 1);
    // Ignore root levels
    if (!oldName) return;

    const newName = await dialogService.prompt('Enter new name:', oldName, 'Rename');
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    const parentDir = sidebarState.getParentPath(activePath);
    const separator = parentDir.endsWith('/') || parentDir.endsWith('\\') ? '' : '/';
    const newPath = `${parentDir}${separator}${newName.trim()}`;

    try {
      await explorerApi.renameFile(activePath, newPath);

      // Navigate active pane if it was renamed
      const tab = explorerState.activeTab;
      const activePane = explorerState.activePaneSide === 'secondary' && tab.splitView ? tab.splitView : tab;
      if (normalizePath(activePane.currentPath) === normalizePath(activePath)) {
        activePane.currentPath = newPath;
        activePane.history[activePane.historyIndex] = newPath;
      }

      await sidebarState.refreshPath(activePath);
      await explorerState.refresh(explorerState.activeTab.id, explorerState.activePaneSide);
    } catch (err) {
      await dialogService.alert(`Error renaming folder: ${err}`);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<aside 
  class="sidebar-wrapper" 
  onkeydown={handleKeyDown} 
  tabindex="0"
  role="navigation"
  aria-label="Sidebar folder navigator"
>
  <div class="sidebar-scrollable-content">
    
    <!-- Quick Access Section -->
    <div class="sidebar-section">
      <div class="sidebar-header">
        <span class="header-title">Quick Access</span>
      </div>
      <div class="sidebar-content">
        {#if !sidebarState.isInitialized}
          <div class="loading-message">
            <div class="spinner"></div>
            <span>Loading places...</span>
          </div>
        {:else if sidebarState.roots.length === 0}
          <div class="empty-message">No places found</div>
        {:else}
          <div class="roots-container">
            {#each sidebarState.roots as root (root.path)}
              <SidebarItem node={root} depth={0} />
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Recents Section -->
    {#if configService.config.rememberRecents}
      <div class="sidebar-section">
        <div class="sidebar-header">
          <span class="header-title">Recents</span>
        </div>
        <div class="sidebar-content">
          {#if recentsService.recents.length === 0}
            <div class="empty-message">No recent items</div>
          {:else}
            <div class="roots-container">
              {#each recentsService.recents as recent (recent.path)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="sidebar-item recent-item"
                  onclick={() => handleOpenRecent(recent)}
                  title={recent.path}
                >
                  <div class="item-left">
                    <span class="folder-icon">
                      {#if recent.isDir}
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      {:else}
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                      {/if}
                    </span>
                    <span class="folder-name">{recent.name}</span>
                  </div>
                  <button
                    class="remove-btn"
                    onclick={(e) => { e.stopPropagation(); recentsService.remove(recent.path); }}
                    aria-label="Remove from recents"
                    title="Remove from recents"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Drives Section -->
    <div class="sidebar-section">
      <div class="sidebar-header">
        <span class="header-title">Drives</span>
      </div>
      <div class="sidebar-content">
        {#if !sidebarState.isInitialized}
          <div class="loading-message">
            <div class="spinner"></div>
            <span>Loading drives...</span>
          </div>
        {:else if sidebarState.drives.length === 0}
          <div class="empty-message">No drives found</div>
        {:else}
          <div class="roots-container">
            {#each sidebarState.drives as drive (drive.path)}
              <SidebarItem node={drive} depth={0} />
            {/each}
          </div>
        {/if}
      </div>
    </div>

  </div>

  <!-- Fixed Recycle Bin Section at the bottom -->
  <div class="sidebar-footer">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="sidebar-item recycle-bin-item" 
      onclick={handleOpenRecycleBin}
      title="Open Recycle Bin"
    >
      <div class="item-left">
        <span class="folder-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </span>
        <span class="folder-name">Recycle Bin</span>
      </div>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <button 
        class="empty-btn"
        onclick={handleEmptyRecycleBin}
        disabled={isRecycleBinBusy}
        title="Empty Recycle Bin"
      >
        {#if isRecycleBinBusy}
          <div class="spinner-small"></div>
        {:else}
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        {/if}
      </button>
    </div>
  </div>
</aside>

<style>
  .sidebar-wrapper {
    width: 240px;
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
    backdrop-filter: blur(10px);
    outline: none;
  }

  /* Scrollable section container */
  .sidebar-scrollable-content {
    flex-grow: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 10px 0;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
  }

  .sidebar-scrollable-content::-webkit-scrollbar {
    width: 5px;
  }

  .sidebar-scrollable-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-scrollable-content::-webkit-scrollbar-thumb {
    background-color: var(--border-color);
    border-radius: var(--radius-lg);
  }

  .sidebar-header {
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    flex-shrink: 0;
  }

  .header-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .sidebar-content {
    display: flex;
    flex-direction: column;
  }

  .roots-container {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  /* Fixed Footer */
  .sidebar-footer {
    padding: 8px 0;
    border-top: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    flex-shrink: 0;
  }

  /* Sidebar item replication for Recycle Bin */
  .sidebar-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    margin: 2px 8px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-secondary);
    transition: background-color var(--transition-fast), color var(--transition-fast);
    user-select: none;
  }

  .sidebar-item:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .empty-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    padding: 0;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .empty-btn:hover {
    background-color: var(--bg-hover);
    color: var(--danger);
  }

  /* Recents section items */
  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    padding: 0;
    color: var(--text-muted);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--transition-fast), background-color var(--transition-fast), color var(--transition-fast);
  }

  .recent-item:hover .remove-btn {
    opacity: 1;
  }

  .remove-btn:hover {
    background-color: var(--bg-hover);
    color: var(--danger);
  }

  .spinner-small {
    width: 10px;
    height: 10px;
    border: 2px solid var(--border-color);
    border-top-color: var(--text-muted);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .folder-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .folder-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loading-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 80px;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .empty-message {
    text-align: center;
    padding: 12px;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-style: italic;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

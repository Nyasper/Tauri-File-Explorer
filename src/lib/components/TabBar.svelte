<script lang="ts">
  import { explorerState } from '../state/explorer.state.svelte';
  import HelpModal from './HelpModal.svelte';
  import ConfigModal from './ConfigModal.svelte';
  import { fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { configService } from '../services/config.service.svelte';
  import { contextMenu, type ContextMenuItem } from '$lib/services/context-menu.service.svelte';
  import { iconNewTab, iconDuplicate, iconClose } from './shared/icons';

  // Helper to extract leaf folder name from path for tab title
  function getTabTitle(path: string): string {
    if (!path || path === '/' || path === '\\') return 'Root';
    
    // Normalize path separators
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    
    if (parts.length === 0) return path;
    return parts[parts.length - 1];
  }

  function handleTabClick(id: string) {
    explorerState.activeTabId = id;
  }

  function handleCloseTab(e: MouseEvent, id: string) {
    e.stopPropagation();
    explorerState.closeTab(id);
  }

  // Middle-click handler: close the tab (matches browser/file-manager UX).
  // The last remaining tab cannot be closed (same constraint as the close
  // button and Ctrl+W).
  function handleTabAuxClick(e: MouseEvent, tabId: string) {
    if (e.button !== 1) return; // Only middle-click
    if (explorerState.tabs.length <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    explorerState.closeTab(tabId);
  }

  function handleTabContextMenu(e: MouseEvent, tabId: string) {
    const items: ContextMenuItem[] = [
      {
        label: 'New Tab',
        shortcut: 'Ctrl+T',
        icon: iconNewTab,
        action: () => explorerState.addTab(explorerState.activeTab?.currentPath || '/')
      },
      {
        label: 'Duplicate Tab',
        icon: iconDuplicate,
        action: () => explorerState.duplicateTab(tabId)
      },
      { isSeparator: true },
      {
        label: 'Close Tab',
        shortcut: 'Ctrl+W',
        icon: iconClose,
        disabled: explorerState.tabs.length <= 1,
        action: () => explorerState.closeTab(tabId)
      }
    ];
    contextMenu.show(e, 'tab', items);
  }

  function handleTabBarContextMenu(e: MouseEvent) {
    if (e.target !== e.currentTarget) return;
    const items: ContextMenuItem[] = [
      {
        label: 'New Tab',
        shortcut: 'Ctrl+T',
        icon: iconNewTab,
        action: () => explorerState.addTab(explorerState.activeTab?.currentPath || '/')
      }
    ];
    contextMenu.show(e, 'tab', items);
  }

  function handleConfig(e: MouseEvent) {
    e.preventDefault();
    explorerState.isConfigModalOpen = true;
  }
</script>

<div class="tab-bar">
  <div class="tabs-container" oncontextmenu={handleTabBarContextMenu} role="tablist" aria-label="Tabs" tabindex="-1">
    {#each explorerState.tabs as tab (tab.id)}
      <div 
        class="tab-item" 
        class:active={explorerState.activeTabId === tab.id}
        transition:fade={{ duration: 150 }}
        animate:flip={{ duration: 150 }}
        onclick={() => handleTabClick(tab.id)}
        onauxclick={(e) => handleTabAuxClick(e, tab.id)}
        oncontextmenu={(e) => handleTabContextMenu(e, tab.id)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTabClick(tab.id); }}
        tabindex="0"
        role="tab"
        aria-selected={explorerState.activeTabId === tab.id}
        title="Right click for tab options"
      >
        <!-- Folder Icon inside tab -->
        <svg class="tab-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>

        <span class="tab-title">{getTabTitle(tab.currentPath)}</span>

        {#if explorerState.tabs.length > 1}
          <button 
            class="tab-close-btn" 
            onclick={(e) => handleCloseTab(e, tab.id)}
            aria-label="Close Tab"
            title="Close Tab"
          >
            <!-- Close Cross Icon -->
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>
    {/each}

    <!-- Add New Tab Button -->
    <button 
      class="add-tab-btn" 
      onclick={() => explorerState.addTab()} 
      title="Open New Tab"
      aria-label="New Tab"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>

  <div class="tab-bar-actions">
    <!-- Help Button -->
    <HelpModal bind:isModalOpen={explorerState.isHelpModalOpen} />
    <!-- Settings Modal -->
    <ConfigModal bind:isModalOpen={explorerState.isConfigModalOpen} />

    <!-- Welcome Screen Button -->
    <button
      class="tab-action-btn welcome-btn"
      class:active={explorerState.isWelcomeOpen}
      title="Welcome Screen (Ctrl+N)"
      aria-label="Welcome Screen"
      onclick={() => explorerState.isWelcomeOpen = !explorerState.isWelcomeOpen}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </button>

    <!-- Toggle Sidebar Button -->
    <button 
      class="tab-action-btn sidebar-toggle-btn" 
      class:active={configService.config.showSidebar}
      title="Toggle Sidebar (Ctrl+B)"
      aria-label="Toggle Sidebar"
      onclick={() => configService.config.showSidebar = !configService.config.showSidebar}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
    </button>

    <button 
      class="tab-action-btn help-btn" 
      title="Help"
      aria-label="Help"
      onclick={() => explorerState.isHelpModalOpen = true}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    </button>

    <!-- Settings Button -->
    <button 
      class="tab-action-btn settings-btn" 
      title="Settings"
      aria-label="Settings"
      onclick={handleConfig}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  </div>
</div>

<style>
  .tab-bar {
    height: var(--tabbar-height);
    flex-shrink: 0;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 0 0.75rem;
    overflow: hidden;
  }

  .tabs-container {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none; /* Hide scrollbar for Firefox */
    flex-grow: 1;
    margin-right: 12px;
  }

  .tabs-container::-webkit-scrollbar {
    display: none; /* Hide scrollbar for Chrome/Safari */
  }

  .tab-item {
    height: 36px;
    min-width: 120px;
    max-width: 200px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color);
    border-bottom: none;
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
    color: var(--text-secondary);
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background-color var(--transition-fast), color var(--transition-fast);
    position: relative;
    overflow: hidden;
  }

  .tab-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
  }

  :root[data-theme="light"] .tab-item {
    background-color: rgba(0, 0, 0, 0.02);
  }
  :root[data-theme="light"] .tab-item:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  .tab-item.active {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    border-top-color: var(--accent);
    border-bottom: 1px solid var(--bg-primary);
    margin-bottom: -1px;
    z-index: 2;
  }

  .tab-icon {
    flex-shrink: 0;
    color: var(--accent);
  }

  .tab-title {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab-close-btn {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    padding: 0;
    flex-shrink: 0;
  }

  .tab-close-btn:hover {
    background-color: var(--danger);
    color: white;
  }

  .add-tab-btn {
    height: 28px;
    width: 28px;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    background-color: transparent;
    margin-bottom: 4px;
    margin-left: 4px;
  }

  .add-tab-btn:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
  }

  :root[data-theme="light"] .add-tab-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .tab-bar-actions {
    display: flex;
    align-items: center;
    height: 100%;
    margin-bottom: 4px;
    flex-shrink: 0;
  }

  .tab-action-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-md);
    background-color: transparent;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color var(--transition-fast), color var(--transition-fast), transform var(--transition-fast);
  }

  .tab-action-btn:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
  }

  :root[data-theme="light"] .tab-action-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .settings-btn:hover {
    transform: rotate(30deg);
  }

  .sidebar-toggle-btn.active {
    color: var(--accent);
    background-color: rgba(var(--accent-rgb), 0.1);
  }

  .welcome-btn.active {
    color: var(--accent);
    background-color: rgba(var(--accent-rgb), 0.1);
  }
</style>

<script lang="ts">
  import type { SidebarNode } from '../types/sidebar.types';
  import SidebarItem from './SidebarItem.svelte';
  import { sidebarState } from '../state/sidebar.state.svelte';
  import { explorerState } from '../state/explorer.state.svelte';
  import { normalizePath } from '../utils/path.helper';
  import * as explorerApi from '../explorer.api';
  import { contextMenu, type ContextMenuItem } from '$lib/services/context-menu.service.svelte';
  import { configService } from '$lib/services/config.service.svelte';
  import { dialogService } from '$lib/services/dialog.service.svelte';
  import { iconRename, iconCopy, iconCut, iconPaste, iconDelete, iconFolderPlus, iconFilePlus, iconPin, iconOpenInNewTab, iconSplitView } from './shared/icons';

  // Svelte 5 props
  let { node, depth = 0 } = $props<{ node: SidebarNode; depth?: number }>();

  // Derived properties
  const activePanePath = $derived(explorerState.activePanePath);
  const isActive = $derived(normalizePath(node.path) === normalizePath(activePanePath));

  // Item click: if already active, toggle; otherwise navigate and let $effect auto-expand
  async function handleClick() {
    if (isActive) {
      await sidebarState.toggleNode(node);
    } else {
      await explorerState.navigate(
        explorerState.activeTab.id,
        explorerState.activePaneSide,
        node.path
      );
    }
  }

  // Prevent parent click triggering on chevron trigger
  function handleArrowClick(e: MouseEvent) {
    e.stopPropagation();
    sidebarState.toggleNode(node);
  }

  // Context Menu File Operations on sidebar nodes
  async function handleCreateFolder() {
    const folderName = await dialogService.prompt('Enter new folder name:', '', 'New Folder');
    if (!folderName || !folderName.trim()) return;
    const separator = node.path.endsWith('/') || node.path.endsWith('\\') ? '' : '/';
    const targetPath = `${node.path}${separator}${folderName.trim()}`;
    try {
      await explorerApi.createFile(targetPath, true);
      await sidebarState.refreshPath(node.path);
      await explorerState.refresh(explorerState.activeTab.id, explorerState.activePaneSide);
    } catch (err) {
      await dialogService.alert(`Error creating folder: ${err}`);
    }
  }

  async function handleCreateFile() {
    const fileName = await dialogService.prompt('Enter new file name:', '', 'New File');
    if (!fileName || !fileName.trim()) return;
    const separator = node.path.endsWith('/') || node.path.endsWith('\\') ? '' : '/';
    const targetPath = `${node.path}${separator}${fileName.trim()}`;
    try {
      await explorerApi.createFile(targetPath, false);
      await sidebarState.refreshPath(node.path);
      await explorerState.refresh(explorerState.activeTab.id, explorerState.activePaneSide);
    } catch (err) {
      await dialogService.alert(`Error creating file: ${err}`);
    }
  }

  function handleCopy() {
    explorerState.clipboardPaths = [node.path];
    explorerState.isCutOperation = false;
  }

  function handleCut() {
    explorerState.clipboardPaths = [node.path];
    explorerState.isCutOperation = true;
  }

  async function handlePaste() {
    if (explorerState.clipboardPaths.length === 0) return;
    try {
      for (const src of explorerState.clipboardPaths) {
        const leafName = src.substring(Math.max(src.lastIndexOf('/'), src.lastIndexOf('\\')) + 1);
        const separator = node.path.endsWith('/') || node.path.endsWith('\\') ? '' : '/';
        const dest = `${node.path}${separator}${leafName}`;
        if (explorerState.isCutOperation) {
          await explorerApi.moveFile(src, dest);
        } else {
          await explorerApi.copyFile(src, dest);
        }
      }
      if (explorerState.isCutOperation) {
        explorerState.clipboardPaths = [];
        explorerState.isCutOperation = false;
      }
      await sidebarState.refreshPath(node.path);
      await explorerState.refresh(explorerState.activeTab.id, explorerState.activePaneSide);
    } catch (err) {
      await dialogService.alert(`Error pasting: ${err}`);
    }
  }

  async function handleRename() {
    const oldPath = node.path;
    const oldName = node.name;
    const newName = await dialogService.prompt('Enter new name:', oldName, 'Rename');
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const parentDir = sidebarState.getParentPath(oldPath);
    const separator = parentDir.endsWith('/') || parentDir.endsWith('\\') ? '' : '/';
    const newPath = `${parentDir}${separator}${newName.trim()}`;
    try {
      await explorerApi.renameFile(oldPath, newPath);
      
      const tab = explorerState.activeTab;
      const activePane = explorerState.activePaneSide === 'secondary' && tab.splitView ? tab.splitView : tab;
      if (normalizePath(activePane.currentPath) === normalizePath(oldPath)) {
        activePane.currentPath = newPath;
        activePane.history[activePane.historyIndex] = newPath;
      }
      
      await sidebarState.refreshPath(oldPath);
      await explorerState.refresh(explorerState.activeTab.id, explorerState.activePaneSide);
    } catch (err) {
      await dialogService.alert(`Error renaming folder: ${err}`);
    }
  }

  async function handleDelete() {
    if (configService.config.confirmDelete) {
      const confirmed = await dialogService.confirm(`Are you sure you want to delete "${node.name}"?`, {
        title: 'Delete Folder',
        confirmLabel: 'Delete',
        danger: true
      });
      if (!confirmed) return;
    }
    try {
      await explorerApi.deleteFile(node.path);
      
      const tab = explorerState.activeTab;
      const activePane = explorerState.activePaneSide === 'secondary' && tab.splitView ? tab.splitView : tab;
      if (normalizePath(activePane.currentPath) === normalizePath(node.path)) {
        const parent = sidebarState.getParentPath(node.path) || '/';
        await explorerState.navigate(tab.id, explorerState.activePaneSide, parent);
      }
      
      await sidebarState.refreshPath(node.path);
      await explorerState.refresh(explorerState.activeTab.id, explorerState.activePaneSide);
    } catch (err) {
      await dialogService.alert(`Error deleting folder: ${err}`);
    }
  }

  // Middle-click handler: open this folder in a new tab (matches browser/file-manager UX)
  function handleAuxClick(e: MouseEvent) {
    if (e.button !== 1) return; // Only middle-click
    e.preventDefault();
    e.stopPropagation();
    explorerState.addTab(node.path);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const pinLabel = node.userAdded ? 'Unpin Folder' : 'Pin Folder';

    const items: ContextMenuItem[] = [
      {
        label: 'Open in a new Tab',
        icon: iconOpenInNewTab,
        action: () => explorerState.addTab(node.path)
      },
      {
        label: 'Open in Split View',
        icon: iconSplitView,
        action: () => explorerState.openInSplitView(explorerState.activeTabId, node.path)
      },
      { isSeparator: true },
      {
        label: 'New Folder',
        icon: iconFolderPlus,
        action: handleCreateFolder
      },
      {
        label: 'New File',
        icon: iconFilePlus,
        action: handleCreateFile
      },
      { isSeparator: true },
      {
        label: pinLabel,
        icon: iconPin,
        action: () =>
          node.userAdded
            ? sidebarState.unpinFolder(node.path)
            : sidebarState.togglePinned(node.path, node.name)
      },
      { isSeparator: true },
      {
        label: 'Copy',
        shortcut: 'Ctrl+C',
        icon: iconCopy,
        action: handleCopy
      },
      {
        label: 'Cut',
        shortcut: 'Ctrl+X',
        icon: iconCut,
        action: handleCut
      },
      {
        label: 'Paste',
        shortcut: 'Ctrl+V',
        icon: iconPaste,
        disabled: explorerState.clipboardPaths.length === 0,
        action: handlePaste
      },
      { isSeparator: true },
      {
        label: 'Rename',
        shortcut: 'F2',
        icon: iconRename,
        action: handleRename
      },
      {
        label: 'Delete',
        shortcut: 'Del',
        icon: iconDelete,
        action: handleDelete
      },
    ];

    contextMenu.show(e, 'folder', items);
  }

  // Fill for deeper hierarchy nodes only; top-level icons always use none
  const fillVal = $derived(isActive && node.hasSubfolders ? "currentColor" : "none");
  const iconFill = $derived(depth === 0 ? "none" : fillVal);
</script>

<div class="sidebar-item-container">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="sidebar-item" 
    class:active={isActive}
    onclick={handleClick}
    onauxclick={handleAuxClick}
    oncontextmenu={handleContextMenu}
  >
    <div class="item-left">
      <span class="folder-icon">
        {#if depth === 0}
          {#if node.name.toLowerCase() === 'home'}
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          {:else if node.name.toLowerCase() === 'desktop'}
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          {:else if node.name.toLowerCase() === 'documents'}
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          {:else if node.name.toLowerCase() === 'downloads'}
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          {:else if node.name.toLowerCase() === 'images'}
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          {:else if node.name.toLowerCase() === 'videos'}
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
          {:else if node.name.toLowerCase() === 'music'}
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          {:else if node.name.startsWith('Local Disk') || node.name.startsWith('Disk (')}
            <!-- Disk drive icon -->
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={iconFill} stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          {/if}
        {:else}
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={fillVal} stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        {/if}
      </span>
      <span class="folder-name">{node.name}</span>
    </div>

    <!-- Chevron arrow on the right -->
    {#if node.hasSubfolders}
      <button class="arrow-btn" onclick={handleArrowClick} aria-label="Toggle children">
        {#if node.isLoading}
          <div class="spinner"></div>
        {:else}
          <svg 
            viewBox="0 0 24 24" 
            width="12" 
            height="12" 
            stroke="currentColor" 
            stroke-width="3" 
            fill="none"
            class="arrow-svg"
            class:expanded={node.isExpanded}
          >
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        {/if}
      </button>
    {/if}
  </div>

  <!-- Children guidelines tree rendering -->
  {#if node.isExpanded && node.children}
    <div class="children-container">
      {#each node.children as child (child.path)}
        <SidebarItem node={child} depth={depth + 1} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .sidebar-item-container {
    display: flex;
    flex-direction: column;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px 6px 16px;
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

  .sidebar-item.active {
    background-color: var(--bg-active);
    color: var(--accent);
    font-weight: 550;
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

  .sidebar-item.active .folder-icon {
    color: var(--accent);
  }

  .folder-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast), color var(--transition-fast);
    flex-shrink: 0;
  }

  .arrow-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .arrow-svg {
    transition: transform var(--transition-normal);
  }

  .arrow-svg.expanded {
    transform: rotate(90deg);
  }

  /* Indented vertical guides */
  .children-container {
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--border-color);
    margin-left: 25px; /* Aligns guides straight down from parent icon center */
    padding-left: 2px;
    overflow: hidden;
    min-width: 0;
  }

  .spinner {
    width: 10px;
    height: 10px;
    border: 2px solid var(--border-color);
    border-top-color: var(--text-muted);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

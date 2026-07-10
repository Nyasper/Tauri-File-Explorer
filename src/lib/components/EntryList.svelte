<script lang="ts">
  import type { FileEntry } from '../types/explorer.types';
  import { explorerState } from '../state/explorer.state.svelte';
  import { contextMenu, type ContextMenuItem } from '$lib/services/context-menu.service.svelte';

  // Svelte 5 Props using runes
  let { 
    files = [], 
    onNavigate, 
    onOpenFile, 
    paneSide,
    actions,
    canPaste
  }: {
    files: FileEntry[];
    onNavigate: (path: string) => void;
    onOpenFile: (path: string) => void;
    paneSide: 'primary' | 'secondary';
    actions: {
      rename: () => void;
      delete: () => void;
      copy: () => void;
      cut: () => void;
      paste: () => void;
      createFolder: () => void;
      createFile: () => void;
      refresh: () => void;
    };
    canPaste: boolean;
  } = $props();

  // SVG Icons for context menu
  const iconOpen = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
  const iconRename = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>`;
  const iconCopy = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const iconCut = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`;
  const iconPaste = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`;
  const iconDelete = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
  const iconFolderPlus = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></svg>`;
  const iconFilePlus = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></svg>`;
  const iconRefresh = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>`;

  // Handle right click on an entry row
  function handleEntryContextMenu(e: MouseEvent, entry: FileEntry) {
    e.preventDefault();
    e.stopPropagation();

    // Select row if it's not selected already
    if (!selectedPaths.has(entry.path)) {
      explorerState.toggleSelection(explorerState.activeTabId, paneSide, entry.path, false);
    }

    const selectedCount = selectedPaths.size;
    const isSingle = selectedCount === 1;

    const items: ContextMenuItem[] = [
      {
        label: entry.is_dir ? 'Open Folder' : 'Open File',
        icon: iconOpen,
        shortcut: 'Enter',
        disabled: !isSingle,
        action: () => handleDoubleClick(entry)
      },
      {
        label: 'Rename',
        icon: iconRename,
        shortcut: 'F2',
        disabled: !isSingle,
        action: () => actions.rename()
      },
      { isSeparator: true },
      {
        label: 'Copy',
        icon: iconCopy,
        shortcut: 'Ctrl+C',
        action: () => actions.copy()
      },
      {
        label: 'Cut',
        icon: iconCut,
        shortcut: 'Ctrl+X',
        action: () => actions.cut()
      },
      { isSeparator: true },
      {
        label: `Delete ${selectedCount > 1 ? `(${selectedCount} items)` : ''}`,
        icon: iconDelete,
        shortcut: 'Del',
        action: () => actions.delete()
      }
    ];

    contextMenu.show(e, entry.is_dir ? 'folder' : 'file', items);
  }

  // Handle right click on empty area background
  function handleBackgroundContextMenu(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const isBackground = target.classList.contains('table-container') || 
                         target.tagName === 'TABLE' || 
                         target.tagName === 'TBODY' ||
                         target.classList.contains('empty-row') ||
                         (target.tagName === 'TR' && target.parentElement?.tagName === 'TBODY' && files.length === 0);

    if (!isBackground) return;

    e.preventDefault();
    e.stopPropagation();

    explorerState.clearSelection(explorerState.activeTabId, paneSide);

    const items: ContextMenuItem[] = [
      {
        label: 'New Folder',
        icon: iconFolderPlus,
        action: () => actions.createFolder()
      },
      {
        label: 'New File',
        icon: iconFilePlus,
        action: () => actions.createFile()
      },
      {
        label: 'Paste',
        icon: iconPaste,
        shortcut: 'Ctrl+V',
        disabled: !canPaste,
        action: () => actions.paste()
      },
      { isSeparator: true },
      {
        label: 'Refresh',
        icon: iconRefresh,
        shortcut: 'F5',
        action: () => actions.refresh()
      }
    ];

    contextMenu.show(e, 'empty', items);
  }

  function formatSize(bytes: number, isDir: boolean, isSizeLoading?: boolean): string {
    if (isDir) {
      if (isSizeLoading) return 'Calculating...';
      return bytes > 0 ? formatBytes(bytes) : '-';
    }
    return formatBytes(bytes);
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(timestamp: number): string {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Double click handler
  function handleDoubleClick(entry: FileEntry) {
    if (entry.is_dir) {
      onNavigate(entry.path);
    } else {
      onOpenFile(entry.path);
    }
  }

  // Row selection handler
  function handleRowClick(e: MouseEvent, entry: FileEntry) {
    e.stopPropagation();
    // Check if Ctrl or Shift is held down for multi-selection
    const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
    explorerState.toggleSelection(explorerState.activeTabId, paneSide, entry.path, isMulti);
  }

  // Background selection clearing handler
  function handleBackgroundClick(e: MouseEvent) {
    if (e.button !== 0) return; // Only left click clears selection
    explorerState.clearSelection(explorerState.activeTabId, paneSide);
  }

  // Sort click handler
  function handleSort(column: 'name' | 'size' | 'modified') {
    explorerState.sortPane(explorerState.activeTabId, paneSide, column);
  }

  // Get current sort details for visual arrows
  const activeTab = $derived(explorerState.activeTab);
  const paneState = $derived(paneSide === 'secondary' && activeTab.splitView ? activeTab.splitView : activeTab);
  const sortBy = $derived(paneState.viewState.sortBy);
  const sortOrder = $derived(paneState.viewState.sortOrder);
  const selectedPaths = $derived(paneState.selectedPaths);
</script>

<div class="table-container" onclick={handleBackgroundClick} oncontextmenu={handleBackgroundContextMenu}>
  <table class="entries-table">
    <thead>
      <tr onclick={(e) => e.stopPropagation()}>
        <th onclick={() => handleSort('name')} class="col-name clickable">
          <div class="header-cell">
            <span>Name</span>
            {#if sortBy === 'name'}
              <span class="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </div>
        </th>
        <th onclick={() => handleSort('size')} class="col-size clickable">
          <div class="header-cell">
            <span>Size</span>
            {#if sortBy === 'size'}
              <span class="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </div>
        </th>
        <th onclick={() => handleSort('modified')} class="col-modified clickable">
          <div class="header-cell">
            <span>Date Modified</span>
            {#if sortBy === 'modified'}
              <span class="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </div>
        </th>
        <th class="col-permissions">Permissions</th>
      </tr>
    </thead>
    <tbody>
      {#if files.length === 0}
        <tr>
          <td colspan="4" class="empty-row">This folder is empty.</td>
        </tr>
      {:else}
        {#each files as entry (entry.path)}
          <tr 
            class="entry-row"
            class:selected={selectedPaths.has(entry.path)}
            onclick={(e) => handleRowClick(e, entry)}
            ondblclick={() => handleDoubleClick(entry)}
            oncontextmenu={(e) => handleEntryContextMenu(e, entry)}
            tabindex="0"
          >
            <!-- Name & Icon -->
            <td class="col-name">
              <div class="name-cell">
                {#if entry.is_dir}
                  <!-- Folder Icon -->
                  <svg class="file-icon folder" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/>
                  </svg>
                {:else}
                  <!-- File Icon (generic) -->
                  <svg class="file-icon file" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                {/if}
                <span class="entry-name" title={entry.name}>{entry.name}</span>
              </div>
            </td>

            <!-- Size -->
            <td class="col-size">
              <span class:pulse-loading={entry.is_size_loading} class="size-text">
                {formatSize(entry.size, entry.is_dir, entry.is_size_loading)}
              </span>
            </td>

            <!-- Modified -->
            <td class="col-modified">
              <span>{formatDate(entry.modified)}</span>
            </td>

            <!-- Permissions -->
            <td class="col-permissions">
              <span class="permissions-badge">{entry.permissions || 'rw-'}</span>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<style>
  .table-container {
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: var(--bg-primary);
  }

  .entries-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    text-align: left;
    font-size: 0.9rem;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: var(--bg-secondary);
  }

  th {
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: var(--text-secondary);
    font-family: var(--font-display);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border-color);
  }

  .clickable {
    cursor: pointer;
  }

  .clickable:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
  }

  .header-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sort-arrow {
    color: var(--accent);
    font-weight: bold;
  }

  th, td {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-name {
    width: 50%;
  }

  .col-size {
    width: 15%;
  }

  .col-modified {
    width: 20%;
  }

  .col-permissions {
    width: 15%;
  }

  .entry-row {
    outline: none;
    transition: background-color var(--transition-fast);
  }

  .entry-row:hover td {
    background-color: var(--bg-hover);
  }

  .entry-row.selected td {
    background-color: var(--bg-active);
    border-top: 1px solid var(--accent);
    border-bottom: 1px solid var(--accent);
  }

  .entry-row.selected td:first-child {
    border-left: 1px solid var(--accent);
    border-top-left-radius: var(--radius-md);
    border-bottom-left-radius: var(--radius-md);
  }

  .entry-row.selected td:last-child {
    border-right: 1px solid var(--accent);
    border-top-right-radius: var(--radius-md);
    border-bottom-right-radius: var(--radius-md);
  }

  .entry-row.selected .file-icon.file {
    color: var(--accent);
  }

  td {
    padding: 0.65rem 1rem;
    color: var(--text-primary);
    vertical-align: middle;
    border-bottom: 1px solid var(--border-color);
    border-top: 1px solid transparent;
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
  }

  .name-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .file-icon {
    flex-shrink: 0;
  }

  .file-icon.folder {
    color: var(--accent);
  }

  .file-icon.file {
    color: var(--text-secondary);
  }

  .entry-name {
    font-weight: 500;
  }

  .size-text {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .permissions-badge {
    font-family: monospace;
    font-size: 0.8rem;
    background-color: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
  }

  :root[data-theme="light"] .permissions-badge {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .empty-row {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

<script lang="ts">
  import { convertFileSrc } from '@tauri-apps/api/core';
  import type { FileEntry } from '../types/explorer.types';
  import { explorerState } from '../state/explorer.state.svelte';
  import { contextMenu, type ContextMenuItem } from '$lib/services/context-menu.service.svelte';
  import { configService } from '$lib/services/config.service.svelte';
  import { formatBytes, formatDisplayName } from '$lib/utils/formater';
  import { iconOpen, iconRename, iconCopy, iconCut, iconPaste, iconDelete, iconFolderPlus, iconFilePlus, iconRefresh } from './shared/icons';

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

  // Derived reactive views of active tab & active pane, hoisted above the
  // handlers that close over them for readability.
  const activeTab = $derived(explorerState.activeTab);
  const paneState = $derived(paneSide === 'secondary' && activeTab.splitView ? activeTab.splitView : activeTab);
  const sortBy = $derived(paneState.viewState.sortBy);
  const sortOrder = $derived(paneState.viewState.sortOrder);
  const selectedPaths = $derived(paneState.selectedPaths);

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
        action: () => openEntry(entry)
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

  function formatSize(bytes: number, isDir: boolean): string {
    if (isDir) {
      return bytes > 0 ? formatBytes(bytes) : '-';
    }
    return formatBytes(bytes);
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

  function isImageFile(entry: FileEntry): boolean {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'];
    return imageExtensions.includes((entry.extension || '').toLowerCase());
  }

  // Open an entry: navigate into folders, open files with the system handler
  function openEntry(entry: FileEntry) {
    if (entry.is_dir) {
      onNavigate(entry.path);
    } else {
      onOpenFile(entry.path);
    }
  }

  // Double click handler (no-op in single-click mode: the click already opened it)
  function handleDoubleClick(entry: FileEntry) {
    if (configService.config.openMode === 'singleClick') return;
    openEntry(entry);
  }

  // Row selection handler
  function handleRowClick(e: MouseEvent, entry: FileEntry) {
    e.stopPropagation();
    // Check if Ctrl or Shift is held down for multi-selection
    const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;

    // Single-click mode: plain click opens the entry; modified clicks keep selecting
    if (configService.config.openMode === 'singleClick' && !isMulti) {
      openEntry(entry);
      return;
    }

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
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
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
                  <div class="file-icon-cell">
                    <!-- File Icon (generic, fallback behind thumbnail) -->
                    <svg class="file-icon file" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                    {#if isImageFile(entry)}
                      <img class="file-thumb" src={convertFileSrc(entry.path)} alt="" onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    {/if}
                  </div>
                {/if}
                <span class="entry-name" title={entry.name}>{formatDisplayName(entry.name, entry.is_dir, configService.config.showExtensions)}</span>
              </div>
            </td>

            <!-- Size -->
            <td class="col-size">
              <span class="size-text">
                {formatSize(entry.size, entry.is_dir)}
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

  .file-icon-cell {
    position: relative;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .file-thumb {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 2px;
    z-index: 1;
    background: var(--bg-primary);
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

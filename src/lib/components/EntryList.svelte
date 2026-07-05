<script lang="ts">
  import type { FileEntry } from '../state/types';
  import { explorerState } from '../state/explorer.state.svelte';

  // Svelte 5 Props using runes
  let { 
    files = [], 
    selectedPaths, 
    onNavigate, 
    onOpenFile, 
    onToggleSelect,
    paneSide
  }: {
    files: FileEntry[];
    selectedPaths: Set<string>;
    onNavigate: (path: string) => void;
    onOpenFile: (path: string) => void;
    onToggleSelect: (path: string, isMulti: boolean) => void;
    paneSide: 'primary' | 'secondary';
  } = $props();

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
    // Check if Ctrl or Shift is held down for multi-selection
    const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
    onToggleSelect(entry.path, isMulti);
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
</script>

<div class="table-container">
  <table class="entries-table">
    <thead>
      <tr>
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
    border-collapse: collapse;
    text-align: left;
    font-size: 0.9rem;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  th {
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: var(--text-secondary);
    font-family: var(--font-display);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
    border-bottom: 1px solid var(--border-color);
    outline: none;
    transition: background-color var(--transition-fast);
  }

  .entry-row:hover {
    background-color: var(--bg-hover);
  }

  .entry-row.selected {
    background-color: var(--bg-active);
    border-bottom-color: rgba(var(--accent-rgb), 0.3);
  }

  td {
    padding: 0.65rem 1rem;
    color: var(--text-primary);
    vertical-align: middle;
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
    color: #eab308; /* yellow folder standard color */
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

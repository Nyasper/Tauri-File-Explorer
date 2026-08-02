<script lang="ts">
  import { convertFileSrc } from '@tauri-apps/api/core';
  import type { FileEntry } from '../types/explorer.types';
  import { configService } from '$lib/services/config.service.svelte';
  import { formatBytes, formatDisplayName } from '$lib/utils/formater';

  /**
   * A single row of the list view. Extracted from EntryList so the
   * virtualized rendering mounts/unmounts cheap row units and so each
   * component stays small. Rows are stateless: selection lives in the
   * pane state and is passed down as the `selected` prop.
   */

  let {
    entry,
    selected,
    onclick,
    ondblclick,
    oncontextmenu,
    onauxclick
  }: {
    entry: FileEntry;
    selected: boolean;
    onclick: (e: MouseEvent) => void;
    ondblclick: (e: MouseEvent) => void;
    oncontextmenu: (e: MouseEvent) => void;
    onauxclick: (e: MouseEvent) => void;
  } = $props();

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
</script>

<tr
  class="entry-row"
  class:selected={selected}
  class:hidden-entry={entry.is_hidden}
  {onclick}
  {ondblclick}
  {oncontextmenu}
  {onauxclick}
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

<style>
  .entry-row {
    outline: none;
    transition: background-color var(--transition-fast);
  }

  /*
   * Rows must measure EXACTLY var(--list-row-height): the virtual scroll
   * math assumes constant row height. box-sizing: border-box makes the
   * declared height include padding and borders.
   */
  .entry-row td {
    height: var(--list-row-height);
    padding: 0.65rem 1rem;
    color: var(--text-primary);
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-bottom: 1px solid var(--border-color);
    border-top: 1px solid transparent;
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
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

  .entry-row.hidden-entry {
    opacity: 0.7;
  }

  .entry-row.hidden-entry .entry-name {
    color: var(--text-muted);
    font-style: italic;
  }

  .entry-row.hidden-entry .file-icon {
    opacity: 0.55;
  }

  .entry-row.hidden-entry.selected {
    opacity: 1;
  }
</style>

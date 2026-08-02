<script lang="ts">
  import type { FileEntry } from '../types/explorer.types';
  import { explorerState } from '../state/explorer.state.svelte';
  import { sidebarState } from '../state/sidebar.state.svelte';
  import { pinnedFoldersService } from '$lib/services/pinned-folders.service.svelte';
  import { contextMenu, type ContextMenuItem } from '$lib/services/context-menu.service.svelte';
  import { configService } from '$lib/services/config.service.svelte';
  import { iconOpen, iconRename, iconCopy, iconCut, iconPaste, iconDelete, iconFolderPlus, iconFilePlus, iconRefresh, iconPin, iconOpenInNewTab, iconSplitView } from './shared/icons';
  import VirtualScroll from './shared/VirtualScroll.svelte';
  import EntryListRow from './EntryListRow.svelte';
  import { LIST_ROW_HEIGHT } from '$lib/utils/virtualization';

  // Svelte 5 Props using runes
  let {
    files = [],
    onNavigate,
    onOpenFile,
    paneSide,
    actions,
    canPaste,
    isLoading = false
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
    isLoading?: boolean;
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
      ...(entry.is_dir
        ? [
            {
              label: 'Open Folder in a new Tab',
              icon: iconOpenInNewTab,
              disabled: !isSingle,
              action: () => explorerState.addTab(entry.path)
            },
            {
              label: 'Open Folder in Split View',
              icon: iconSplitView,
              disabled: !isSingle,
              action: () => explorerState.openInSplitView(explorerState.activeTabId, entry.path)
            }
          ]
        : []),
      { isSeparator: true },
      ...(entry.is_dir
        ? [{
            label: pinnedFoldersService.isPinned(entry.path) ? 'Unpin Folder' : 'Pin Folder',
            icon: iconPin,
            action: () => { sidebarState.togglePinned(entry.path, entry.name); }
          }]
        : []),
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
        label: 'Rename',
        icon: iconRename,
        shortcut: 'F2',
        disabled: !isSingle,
        action: () => actions.rename()
      },
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
                         target.closest('.spacer-row') !== null ||
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

  // Middle-click handler: open folder in a new tab (matches browser/file-manager UX)
  function handleEntryAuxClick(e: MouseEvent, entry: FileEntry) {
    if (e.button !== 1) return; // Only middle-click
    if (!entry.is_dir) return;  // Only folders
    e.preventDefault();
    e.stopPropagation();
    explorerState.addTab(entry.path);
  }

  // Sort click handler
  function handleSort(column: 'name' | 'size' | 'modified') {
    explorerState.sortPane(explorerState.activeTabId, paneSide, column);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<VirtualScroll
  class="table-container"
  items={files}
  itemHeight={LIST_ROW_HEIGHT}
  resetKey={paneState.currentPath + '|' + paneState.viewState.searchQuery}
  onclick={handleBackgroundClick}
  oncontextmenu={handleBackgroundContextMenu}
>
  {#snippet children({ visibleItems, topPad, bottomPad })}
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
            <td colspan="4" class="empty-row">
              {isLoading ? 'Loading…' : 'This folder is empty.'}
            </td>
          </tr>
        {:else}
          <!-- Spacer rows simulate the height of non-rendered entries so the
               scrollbar reflects the full list length (virtualization) -->
          {#if topPad > 0}
            <tr class="spacer-row" aria-hidden="true" style="height: {topPad}px;"><td colspan="4"></td></tr>
          {/if}
          {#each visibleItems as entry (entry.path)}
            <EntryListRow
              {entry}
              selected={selectedPaths.has(entry.path)}
              onclick={(e) => handleRowClick(e, entry)}
              ondblclick={() => handleDoubleClick(entry)}
              oncontextmenu={(e) => handleEntryContextMenu(e, entry)}
              onauxclick={(e) => handleEntryAuxClick(e, entry)}
            />
          {/each}
          {#if bottomPad > 0}
            <tr class="spacer-row" aria-hidden="true" style="height: {bottomPad}px;"><td colspan="4"></td></tr>
          {/if}
        {/if}
      </tbody>
    </table>
  {/snippet}
</VirtualScroll>

<style>
  /*
   * Applied to VirtualScroll's root element, which lives in the child
   * component's scope — hence the global selector.
   */
  :global(.table-container) {
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: var(--bg-primary);
  }

  .entries-table {
    width: 100%;
    /*
     * Fixed layout: column widths come from the header row only, so they
     * stay stable no matter which slice of rows the virtual scroll renders.
     */
    table-layout: fixed;
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  /* Virtualization spacer rows: invisible, they only occupy vertical space */
  .spacer-row,
  .spacer-row td {
    padding: 0;
    border: none;
  }

  .empty-row {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

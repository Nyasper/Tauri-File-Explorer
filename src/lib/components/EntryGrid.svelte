<script lang="ts">
  import type { FileEntry } from '../types/explorer.types';
  import { explorerState } from '../state/explorer.state.svelte';
  import { sidebarState } from '../state/sidebar.state.svelte';
  import { pinnedFoldersService } from '$lib/services/pinned-folders.service.svelte';
  import { contextMenu, type ContextMenuItem } from '$lib/services/context-menu.service.svelte';
  import { configService } from '$lib/services/config.service.svelte';
  import { iconOpen, iconRename, iconCopy, iconCut, iconPaste, iconDelete, iconFolderPlus, iconFilePlus, iconRefresh, iconPin, iconOpenInNewTab, iconSplitView } from './shared/icons';
  import VirtualScroll from './shared/VirtualScroll.svelte';
  import EntryGridItem from './EntryGridItem.svelte';
  import {
    chunkItems,
    GRID_ITEM_HEIGHT,
    GRID_GAP,
    GRID_MIN_ITEM_WIDTH,
    GRID_CONTAINER_PADDING
  } from '$lib/utils/virtualization';

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

  // Resolve selection from global state
  const activeTab = $derived(explorerState.activeTab);
  const paneState = $derived(paneSide === 'secondary' && activeTab.splitView ? activeTab.splitView : activeTab);
  const selectedPaths = $derived(paneState.selectedPaths);

  /*
   * Row-based virtualization: the grid is a fixed-height flow of rows, each
   * holding `columns` items. Columns derive from the measured container
   * width, replicating the previous `repeat(auto-fill, minmax(100px, 1fr))`
   * behavior while keeping the exact row geometry the virtual scroll needs.
   */
  let gridWidth = $state(0);
  const columns = $derived(
    Math.max(
      1,
      Math.floor(
        (gridWidth - GRID_CONTAINER_PADDING * 2 + GRID_GAP) /
          (GRID_MIN_ITEM_WIDTH + GRID_GAP)
      )
    )
  );
  const rows = $derived(chunkItems(files, columns));
  const GRID_ROW_HEIGHT = GRID_ITEM_HEIGHT + GRID_GAP;

  // Handle right click on an entry grid item
  function handleEntryContextMenu(e: MouseEvent, entry: FileEntry) {
    e.preventDefault();
    e.stopPropagation();

    // Select item if it's not selected already
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
    const isBackground = target.classList.contains('grid-container') ||
                         target.classList.contains('grid-row') ||
                         target.classList.contains('grid-spacer') ||
                         target.classList.contains('empty-state');

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

  // Single click handler
  function handleClick(e: MouseEvent, entry: FileEntry) {
    e.stopPropagation();
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

  // Keyboard handler: Enter/Space toggles selection (matches previous behavior)
  function handleItemKeyDown(e: KeyboardEvent, entry: FileEntry) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
      explorerState.toggleSelection(explorerState.activeTabId, paneSide, entry.path, isMulti);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if files.length === 0}
  <div class="grid-container" onclick={handleBackgroundClick} oncontextmenu={handleBackgroundContextMenu}>
    <div class="empty-state">{isLoading ? 'Loading…' : 'This folder is empty.'}</div>
  </div>
{:else}
  <VirtualScroll
    class="grid-container"
    items={rows}
    itemHeight={GRID_ROW_HEIGHT}
    resetKey={paneState.currentPath + '|' + paneState.viewState.searchQuery}
    bind:viewportWidth={gridWidth}
    onclick={handleBackgroundClick}
    oncontextmenu={handleBackgroundContextMenu}
  >
    {#snippet children({ visibleItems, topPad, bottomPad })}
      <!-- Spacer blocks simulate the height of non-rendered rows so the
           scrollbar reflects the full list length (virtualization) -->
      {#if topPad > 0}
        <div class="grid-spacer" style="height: {topPad}px;"></div>
      {/if}
      {#each visibleItems as row (row)}
        <div
          class="grid-row"
          style="height: {GRID_ROW_HEIGHT}px; grid-template-columns: repeat({columns}, minmax(0, 1fr));"
        >
          {#each row as entry (entry.path)}
            <EntryGridItem
              {entry}
              selected={selectedPaths.has(entry.path)}
              onclick={(e) => handleClick(e, entry)}
              ondblclick={() => handleDoubleClick(entry)}
              oncontextmenu={(e) => handleEntryContextMenu(e, entry)}
              onauxclick={(e) => handleEntryAuxClick(e, entry)}
              onkeydown={(e) => handleItemKeyDown(e, entry)}
            />
          {/each}
        </div>
      {/each}
      {#if bottomPad > 0}
        <div class="grid-spacer" style="height: {bottomPad}px;"></div>
      {/if}
    {/snippet}
  </VirtualScroll>
{/if}

<style>
  /*
   * Applied both to a local element (empty state) and to VirtualScroll's
   * root element, which lives in the child component's scope — hence the
   * global selector so it matches in both cases.
   */
  :global(.grid-container) {
    width: 100%;
    height: 100%;
    overflow: auto;
    padding: 1rem;
    background-color: var(--bg-primary);
  }

  /*
   * Each virtualized row is a fixed-height grid of `columns` cells. The row
   * height (item + gap) is set inline from the same constants that drive the
   * virtual scroll math; the leftover gap at the bottom of each row acts as
   * the inter-row spacing.
   */
  .grid-row {
    display: grid;
    gap: var(--grid-gap);
    align-content: start;
  }

  /* Virtualization spacer blocks: invisible, they only occupy vertical space */
  .grid-spacer {
    pointer-events: auto;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

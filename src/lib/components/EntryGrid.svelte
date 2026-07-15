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
    const isBackground = target.classList.contains('grid-container') || 
                         target.classList.contains('entries-grid') || 
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

  // Resolve selection from global state
  const activeTab = $derived(explorerState.activeTab);
  const paneState = $derived(paneSide === 'secondary' && activeTab.splitView ? activeTab.splitView : activeTab);
  const selectedPaths = $derived(paneState.selectedPaths);

  // Helper to determine item extension category
  function getFileCategory(entry: FileEntry): 'folder' | 'image' | 'video' | 'audio' | 'code' | 'archive' | 'document' | 'file' {
    if (entry.is_dir) return 'folder';
    
    const ext = (entry.extension || '').toLowerCase();
    
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'];
    if (imageExtensions.includes(ext)) return 'image';

    const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv'];
    if (videoExtensions.includes(ext)) return 'video';

    const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
    if (audioExtensions.includes(ext)) return 'audio';

    const codeExtensions = ['rs', 'ts', 'js', 'json', 'py', 'html', 'css', 'svelte', 'go', 'cpp', 'h', 'c', 'sh', 'bat', 'yaml', 'toml', 'md'];
    if (codeExtensions.includes(ext)) return 'code';

    const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
    if (archiveExtensions.includes(ext)) return 'archive';

    const docExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'];
    if (docExtensions.includes(ext)) return 'document';

    return 'file';
  }

  // Double click handler
  function handleDoubleClick(entry: FileEntry) {
    if (entry.is_dir) {
      onNavigate(entry.path);
    } else {
      onOpenFile(entry.path);
    }
  }

  // Single click handler
  function handleClick(e: MouseEvent, entry: FileEntry) {
    e.stopPropagation();
    const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
    explorerState.toggleSelection(explorerState.activeTabId, paneSide, entry.path, isMulti);
  }

  // Background selection clearing handler
  function handleBackgroundClick(e: MouseEvent) {
    if (e.button !== 0) return; // Only left click clears selection
    explorerState.clearSelection(explorerState.activeTabId, paneSide);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="grid-container" onclick={handleBackgroundClick} oncontextmenu={handleBackgroundContextMenu}>
  {#if files.length === 0}
    <div class="empty-state">This folder is empty.</div>
  {:else}
    <div class="entries-grid">
      {#each files as entry (entry.path)}
        {@const category = getFileCategory(entry)}
        <div 
          class="grid-item"
          class:selected={selectedPaths.has(entry.path)}
          onclick={(e) => handleClick(e, entry)}
          ondblclick={() => handleDoubleClick(entry)}
          oncontextmenu={(e) => handleEntryContextMenu(e, entry)}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const isMulti = e.ctrlKey || e.metaKey || e.shiftKey; explorerState.toggleSelection(explorerState.activeTabId, paneSide, entry.path, isMulti); } }}
          tabindex="0"
          role="button"
          aria-pressed={selectedPaths.has(entry.path)}
          title={`${entry.name}\nType: ${entry.is_dir ? 'Directory' : (entry.extension || 'File').toUpperCase()}`}
        >
          <!-- Grid Icon container with category-specific colors -->
          <div class="icon-wrapper {category}">
            {#if category === 'folder'}
              <!-- Folder SVG -->
              <svg viewBox="0 0 24 24" class="grid-icon">
                <path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/>
              </svg>
            {:else}
              <!-- Document Base SVG -->
              <svg viewBox="0 0 24 24" class="grid-icon">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                {#if category === 'code'}
                  <!-- Code Brackets Overlay -->
                  <path d="M8 12l3-3m0 6l-3-3m8 0l-3-3m0 6l3-3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                {:else}
                  <polygon points="14 2 14 8 20 8" fill="rgba(0,0,0,0.15)"/>
                {/if}
              </svg>
            {/if}

            {#if category !== 'folder' && category !== 'code'}
              <!-- Smaller overlay icon/letter for recognition -->
              <span class="ext-badge">{entry.extension || 'file'}</span>
            {/if}
          </div>

          <span class="item-name">{entry.name}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .grid-container {
    width: 100%;
    height: 100%;
    overflow: auto;
    padding: 1rem;
    background-color: var(--bg-primary);
  }

  .entries-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 8px;
    border-radius: var(--radius-md);
    background-color: rgba(255, 255, 255, 0.01);
    border: 1px solid transparent;
    cursor: pointer;
    transition: background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
    outline: none;
  }

  .grid-item:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-color);
  }

  .grid-item:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--border-focus);
  }

  .grid-item.selected {
    background-color: var(--bg-active);
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    transform: scale(0.98);
  }

  .grid-item.selected .icon-wrapper {
    color: var(--accent) !important;
  }

  .icon-wrapper {
    position: relative;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15));
  }

  .grid-icon {
    width: 100%;
    height: 100%;
    fill: currentColor;
    transition: transform var(--transition-fast);
  }

  .grid-item:hover .grid-icon {
    transform: scale(1.08);
  }

  /* File Type Palette definitions */
  .folder { color: var(--accent); }
  .image { color: #10b981; }
  .video { color: #8b5cf6; }
  .audio { color: #ec4899; }
  .code { color: #f97316; }
  .archive { color: #d946ef; }
  .document { color: #3b82f6; }
  .file { color: #64748b; }

  .ext-badge {
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    background-color: rgba(0, 0, 0, 0.65);
    color: white;
    padding: 0.5px 4px;
    border-radius: 3px;
    max-width: 80%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }

  .item-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    text-align: center;
    word-break: break-all;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.25;
    margin-top: 4px;
    width: 100%;
    height: 2.5em; /* Always allocate 2 lines height to prevent layout shifts */
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

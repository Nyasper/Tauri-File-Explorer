import type { Tab, FileEntry, ViewState } from './types';
import * as api from '../explorer.api';

interface CacheEntry {
  entries: FileEntry[];
  timestamp: number;
}

export class ExplorerState {
  // Runes for reactive states
  tabs = $state<Tab[]>([]);
  activeTabId = $state<string>('');
  activePaneSide = $state<'primary' | 'secondary'>('primary'); // Tracks active pane in split-view
  
  // Cache map for visited paths
  private cache = new Map<string, CacheEntry>();
  
  // Default path helper based on OS
  private defaultPath = '';

  constructor() {
    // Determine default path based on browser environment vs native Tauri
    this.defaultPath = '/';
    // Initialize default tab
    this.addTab(this.defaultPath);
  }

  get activeTab(): Tab {
    return this.tabs.find(t => t.id === this.activeTabId) || this.tabs[0];
  }

  // Helper to get active pane (primary tab or secondary split-pane)
  getActivePane(tab: Tab): { pane: Tab; isSecondary: boolean } {
    if (tab.splitView && this.activePaneSide === 'secondary') {
      return { pane: tab.splitView, isSecondary: true };
    }
    return { pane: tab, isSecondary: false };
  }

  // Add a new tab
  addTab(path: string = '/') {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      currentPath: path,
      history: [path],
      historyIndex: 0,
      viewState: {
        viewMode: 'list',
        searchQuery: '',
        sortBy: 'name',
        sortOrder: 'asc'
      },
      files: [],
      splitView: null
    };
    this.tabs.push(newTab);
    this.activeTabId = newTab.id;
    this.activePaneSide = 'primary';
    
    // Load files for new tab
    this.loadDirectoryForTab(newTab.id, 'primary', path);
  }

  // Duplicate an existing tab
  duplicateTab(tabId: string) {
    const original = this.tabs.find(t => t.id === tabId);
    if (!original) return;

    // Helper to deeply copy view state
    const cloneViewState = (vs: ViewState): ViewState => ({ ...vs });

    // Helper to deeply copy a tab pane
    const clonePane = (pane: Tab): Tab => ({
      id: crypto.randomUUID(),
      currentPath: pane.currentPath,
      history: [...pane.history],
      historyIndex: pane.historyIndex,
      viewState: cloneViewState(pane.viewState),
      files: [...pane.files],
      splitView: null
    });

    const duplicate: Tab = {
      id: crypto.randomUUID(),
      currentPath: original.currentPath,
      history: [...original.history],
      historyIndex: original.historyIndex,
      viewState: cloneViewState(original.viewState),
      files: [...original.files],
      splitView: original.splitView ? clonePane(original.splitView) : null
    };

    const index = this.tabs.findIndex(t => t.id === tabId);
    this.tabs.splice(index + 1, 0, duplicate);
    this.activeTabId = duplicate.id;
  }

  // Close tab
  closeTab(tabId: string) {
    if (this.tabs.length <= 1) return; // Keep at least one
    const index = this.tabs.findIndex(t => t.id === tabId);
    this.tabs = this.tabs.filter(t => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[Math.max(0, index - 1)].id;
    }
  }

  // Toggle Split View for current tab
  toggleSplitView(tabId: string) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.splitView) {
      // Close split
      tab.splitView = null;
      this.activePaneSide = 'primary';
    } else {
      // Open split with the current path
      tab.splitView = {
        id: crypto.randomUUID(),
        currentPath: tab.currentPath,
        history: [tab.currentPath],
        historyIndex: 0,
        viewState: {
          viewMode: tab.viewState.viewMode,
          searchQuery: '',
          sortBy: tab.viewState.sortBy,
          sortOrder: tab.viewState.sortOrder
        },
        files: [...tab.files],
        splitView: null
      };
      this.activePaneSide = 'secondary';
      // Load directory details for split view
      this.loadDirectoryForTab(tabId, 'secondary', tab.currentPath);
    }
  }

  // Set the focused pane side
  focusPane(side: 'primary' | 'secondary') {
    this.activePaneSide = side;
  }

  // Navigate to a new path
  async navigate(tabId: string, side: 'primary' | 'secondary', path: string) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const pane = (side === 'secondary' && tab.splitView) ? tab.splitView : tab;

    // Truncate history forward if we were in the middle of history
    pane.history = pane.history.slice(0, pane.historyIndex + 1);
    pane.history.push(path);
    pane.historyIndex = pane.history.length - 1;
    pane.currentPath = path;

    await this.loadDirectoryForTab(tabId, side, path);
  }

  // Navigate back
  async goBack(tabId: string, side: 'primary' | 'secondary') {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const pane = (side === 'secondary' && tab.splitView) ? tab.splitView : tab;
    if (pane.historyIndex > 0) {
      pane.historyIndex--;
      pane.currentPath = pane.history[pane.historyIndex];
      await this.loadDirectoryForTab(tabId, side, pane.currentPath);
    }
  }

  // Navigate forward
  async goForward(tabId: string, side: 'primary' | 'secondary') {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const pane = (side === 'secondary' && tab.splitView) ? tab.splitView : tab;
    if (pane.historyIndex < pane.history.length - 1) {
      pane.historyIndex++;
      pane.currentPath = pane.history[pane.historyIndex];
      await this.loadDirectoryForTab(tabId, side, pane.currentPath);
    }
  }

  // Refresh current directory
  async refresh(tabId: string, side: 'primary' | 'secondary') {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    const pane = (side === 'secondary' && tab.splitView) ? tab.splitView : tab;
    
    // Clear cache for this path to force fresh disk read
    this.cache.delete(pane.currentPath);
    await this.loadDirectoryForTab(tabId, side, pane.currentPath);
  }

  // Core Directory Loading containing the Path Caching System (Stale-While-Revalidate)
  async loadDirectoryForTab(tabId: string, side: 'primary' | 'secondary', path: string) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const pane = (side === 'secondary' && tab.splitView) ? tab.splitView : tab;
    if (!path.trim()) return;

    // 1. Check in-memory Cache
    const cached = this.cache.get(path);
    if (cached) {
      // Instantly populate files from cache for fluid immediate rendering
      pane.files = cached.entries;
      
      // If cached less than 10 seconds ago, don't trigger background reload
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < 10000) {
        return;
      }
    }

    // 2. Fetch from Tauri API (async revalidation)
    try {
      const freshEntries = await api.listDir(path);
      
      // Update Cache
      this.cache.set(path, {
        entries: freshEntries,
        timestamp: Date.now()
      });

      // Update pane state (only if pane path didn't change while loading)
      if (pane.currentPath === path) {
        pane.files = freshEntries;
      }
    } catch (err) {
      console.error(`Failed to load directory: ${path}`, err);
      // Keep cached files if load fails, or clear if cache didn't exist
      if (!cached && pane.currentPath === path) {
        pane.files = [];
      }
    }
  }

  // Fast search using Tauri index search
  async searchInPane(tabId: string, side: 'primary' | 'secondary', query: string) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const pane = (side === 'secondary' && tab.splitView) ? tab.splitView : tab;
    pane.viewState.searchQuery = query;

    if (!query.trim()) {
      // Revert to loading standard directory entries
      await this.loadDirectoryForTab(tabId, side, pane.currentPath);
      return;
    }

    try {
      const results = await api.searchIndex(query, pane.currentPath);
      if (pane.currentPath === pane.currentPath && pane.viewState.searchQuery === query) {
        pane.files = results;
      }
    } catch (err) {
      console.error("Indexed search failed", err);
    }
  }

  // Update sorting criteria
  sortPane(tabId: string, side: 'primary' | 'secondary', sortBy: 'name' | 'size' | 'modified') {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const pane = (side === 'secondary' && tab.splitView) ? tab.splitView : tab;
    
    if (pane.viewState.sortBy === sortBy) {
      // Toggle order
      pane.viewState.sortOrder = pane.viewState.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      pane.viewState.sortBy = sortBy;
      pane.viewState.sortOrder = 'asc';
    }
    
    // Sort the list locally
    this.applyLocalSort(pane);
  }

  // Sort files locally based on ViewState
  applyLocalSort(pane: Tab) {
    const { sortBy, sortOrder } = pane.viewState;
    
    pane.files = [...pane.files].sort((a, b) => {
      // Always directories first
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;

      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
      } else if (sortBy === 'size') {
        comparison = a.size - b.size;
      } else if (sortBy === 'modified') {
        comparison = a.modified - b.modified;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  // Trigger size calculations for folders
  async calculateFolderSizesForPane(tabId: string, side: 'primary' | 'secondary') {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    const pane = (side === 'secondary' && tab.splitView) ? tab.splitView : tab;

    // Find directories that don't have sizes computed
    const dirsToCalculate = pane.files.filter(f => f.is_dir && !f.is_size_loading && f.size === 0);
    
    for (const dir of dirsToCalculate) {
      dir.is_size_loading = true;
      try {
        await api.calculateFolderSize(dir.path);
      } catch (err) {
        console.error(`Failed size trigger for ${dir.path}`, err);
        dir.is_size_loading = false;
      }
    }
  }

  // Update size for a folder when Tauri calculation completes
  updateFolderSize(path: string, size: number) {
    // Find all matching folders across all tabs and split panes
    for (const tab of this.tabs) {
      this.updateFolderSizeInPane(tab, path, size);
      if (tab.splitView) {
        this.updateFolderSizeInPane(tab.splitView, path, size);
      }
    }
    
    // Update cache entries as well
    for (const [cachePath, cacheVal] of this.cache.entries()) {
      let cacheUpdated = false;
      const updatedEntries = cacheVal.entries.map(entry => {
        if (entry.path === path) {
          cacheUpdated = true;
          return { ...entry, size, is_size_loading: false };
        }
        return entry;
      });
      if (cacheUpdated) {
        this.cache.set(cachePath, {
          entries: updatedEntries,
          timestamp: cacheVal.timestamp
        });
      }
    }
  }

  private updateFolderSizeInPane(pane: Tab, path: string, size: number) {
    const idx = pane.files.findIndex(f => f.path === path);
    if (idx !== -1) {
      pane.files[idx].size = size;
      pane.files[idx].is_size_loading = false;
      // Trigger reactive state refresh
      pane.files = [...pane.files];
    }
  }
}

// Global shared state instance
export const explorerState = new ExplorerState();

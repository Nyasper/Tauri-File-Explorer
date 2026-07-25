import type { Tab, ViewState, CacheEntry, FileEntry } from "../types/explorer.types";
import { SvelteSet } from "svelte/reactivity";
import { untrack } from "svelte";
import { LazyStore } from "@tauri-apps/plugin-store";
import * as explorerApi from "../explorer.api";
import { browser } from "$app/environment";
import { configService } from "$lib/services/config.service.svelte";
import { recentsService } from "$lib/services/recents.service.svelte";

// Shape of the persisted session used by the "last-session" startup mode
interface PersistedPane {
  currentPath: string;
  viewMode: "list" | "grid";
}
interface PersistedTab extends PersistedPane {
  splitView: PersistedPane | null;
}
interface PersistedSession {
  tabs: PersistedTab[];
  activeTabIndex: number;
}

export class ExplorerState {
  // Runes for reactive states
  tabs: Tab[] = $state([]);
  activeTabId = $state("");
  clipboardPaths = $state<string[]>([]);
  isCutOperation = $state(false);
  activePaneSide: "primary" | "secondary" = $state("primary"); // Tracks active pane in split-view
  isHelpModalOpen = $state(false);
  isConfigModalOpen = $state(false);
  #activeTab: Tab = $derived(
    this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0],
  );

  // Cache map for visited paths
  private cache = new Map<string, CacheEntry>();

  // Default path helper based on OS
  private defaultPath = "";

  // Session persistence ("last-session" startup mode)
  private sessionStore: LazyStore | null = null;
  // Gates session saving until the config is loaded and the startup restore
  // attempt finished, so the stored session is never overwritten before
  // being read back.
  private sessionReady = $state(false);

  // Resolve the initial path from the onStartup mode. "custom" uses the
  // configured defaultPath; "last-session" is handled separately by
  // tryRestoreSession and falls back to "/" here.
  private async resolveStartupPath(): Promise<string> {
    switch (configService.config.onStartup) {
      case "home":
        try {
          return await explorerApi.getHomeDir();
        } catch (err) {
          console.error(
            "Failed to resolve home directory, falling back to root:",
            err,
          );
          return "/";
        }
      case "custom": {
        const custom = configService.config.defaultPath;
        return custom === "root" || !custom.trim() ? "/" : custom;
      }
      case "last-session": // handled by tryRestoreSession; fallback when it fails
      case "root":
      default:
        return "/";
    }
  }

  constructor() {
    if (!browser) return;
    this.sessionStore = new LazyStore("session.json");
    // Initialize default tab at root; the configured startup path is applied
    // once the async config load finishes (see effect below).
    this.addTab(this.defaultPath || "/");

    // Watch for config initialization. We only want to re-apply defaults
    // once, when configInitialized flips from false to true, so that any tabs
    // created *before* the async config load finished get the loaded values
    // instead of the hardcoded defaults. Subsequent config edits are applied
    // by ConfigModal mutations directly to configService.config.
    $effect.root(() => {
      let applied = false;
      $effect(() => {
        if (!configService.configInitialized || applied) return;
        applied = true;

        void (async () => {
          // "last-session" mode restores the persisted tabs instead of
          // resolving a startup path.
          if (configService.config.onStartup === "last-session") {
            const restored = await this.tryRestoreSession();
            if (restored) {
              this.sessionReady = true;
              return;
            }
          }

          const startupPath = await this.resolveStartupPath();
          this.defaultPath = startupPath;

          const sortBy = this.mapConfigSortBy();

          // Apply loaded defaults to every tab that hasn't been navigated yet
          // (historyIndex === 0 means the user never moved off the initial path).
          for (const tab of this.tabs) {
            if (tab.historyIndex !== 0) continue;

            tab.viewState.viewMode = configService.config.defaultViewMode;
            tab.viewState.sortBy = sortBy;
            tab.viewState.sortOrder = configService.config.sort.order;

            const initial = tab.history[0];
            // Apply startup path if the tab hasn't navigated away from it
            if (
              (initial === "/" || initial === "root") &&
              startupPath !== initial
            ) {
              tab.currentPath = startupPath;
              tab.history = [startupPath];
              this.loadDirectoryForTab(tab.id, "primary", startupPath);
            }
          }

          this.sessionReady = true;
        })();
      });

      // Re-filter the visible entries of every pane whenever the
      // showHiddenFiles toggle changes. Only the toggle is tracked;
      // the refilter itself reads pane state without subscribing to it
      // (navigations already apply the filter on load).
      let skipInitialRun = true;
      $effect(() => {
        configService.config.showHiddenFiles;
        if (skipInitialRun) {
          skipInitialRun = false;
          return;
        }
        untrack(() => {
          for (const tab of this.tabs) {
            this.refilterPane(tab.id, tab, "primary");
            if (tab.splitView) {
              this.refilterPane(tab.id, tab.splitView, "secondary");
            }
          }
        });
      });

      // Apply sort config changes in real time to every open pane.
      let skipSortInitialRun = true;
      $effect(() => {
        configService.config.sort.by;
        configService.config.sort.order;
        if (skipSortInitialRun) {
          skipSortInitialRun = false;
          return;
        }
        untrack(() => {
          const sortBy = this.mapConfigSortBy();
          for (const tab of this.tabs) {
            for (const pane of [tab, tab.splitView]) {
              if (!pane) continue;
              pane.viewState.sortBy = sortBy;
              pane.viewState.sortOrder = configService.config.sort.order;
              this.applyLocalSort(pane);
            }
          }
        });
      });

      // Persist the session (debounced) so "last-session" mode can restore
      // it on the next launch. Gated by sessionReady to never overwrite the
      // stored session before the startup restore attempt has read it.
      $effect(() => {
        const snapshot: PersistedTab[] = this.tabs.map((t) => ({
          currentPath: t.currentPath,
          viewMode: t.viewState.viewMode,
          splitView: t.splitView
            ? {
                currentPath: t.splitView.currentPath,
                viewMode: t.splitView.viewState.viewMode,
              }
            : null,
        }));
        const activeTabIndex = this.tabs.findIndex(
          (t) => t.id === this.activeTabId,
        );
        if (!this.sessionReady) return;

        const timer = setTimeout(() => {
          void this.persistSession({ tabs: snapshot, activeTabIndex });
        }, 500);
        return () => clearTimeout(timer);
      });
    });
  }

  // Restore the persisted session tabs for "last-session" mode.
  // Returns false when there is no usable stored session.
  private async tryRestoreSession(): Promise<boolean> {
    if (!this.sessionStore) return false;
    try {
      const session = await this.sessionStore.get<PersistedSession>("session");
      if (
        !session ||
        !Array.isArray(session.tabs) ||
        session.tabs.length === 0
      ) {
        return false;
      }

      const sortBy = this.mapConfigSortBy();
      const sortOrder = configService.config.sort.order;

      const buildPane = (p: PersistedPane): Tab => ({
        id: crypto.randomUUID(),
        currentPath: p.currentPath,
        history: [p.currentPath],
        historyIndex: 0,
        viewState: {
          viewMode: p.viewMode === "grid" ? "grid" : "list",
          searchQuery: "",
          sortBy,
          sortOrder,
        },
        files: [],
        selectedPaths: new SvelteSet<string>(),
        splitView: null,
      });

      this.tabs = session.tabs.map((t) => {
        const tab = buildPane(t);
        tab.splitView = t.splitView ? buildPane(t.splitView) : null;
        return tab;
      });

      const index = Math.min(
        Math.max(session.activeTabIndex ?? 0, 0),
        this.tabs.length - 1,
      );
      this.activeTabId = this.tabs[index].id;
      this.activePaneSide = "primary";

      // Load directory contents for every restored pane
      for (const tab of this.tabs) {
        void this.loadDirectoryForTab(tab.id, "primary", tab.currentPath);
        if (tab.splitView) {
          void this.loadDirectoryForTab(
            tab.id,
            "secondary",
            tab.splitView.currentPath,
          );
        }
      }
      return true;
    } catch (err) {
      console.error("Failed to restore session:", err);
      return false;
    }
  }

  private async persistSession(session: PersistedSession) {
    if (!this.sessionStore) return;
    try {
      await this.sessionStore.set("session", session);
      await this.sessionStore.save();
    } catch (err) {
      console.error("Failed to persist session:", err);
    }
  }

  // Map the config sort criteria to the pane ViewState one
  // ("date" is called "modified" in the pane state).
  private mapConfigSortBy(): ViewState["sortBy"] {
    const configSortBy = configService.config.sort.by;
    if (configSortBy === "size") return "size";
    if (configSortBy === "date") return "modified";
    if (configSortBy === "type") return "type";
    return "name";
  }

  // Filter out hidden entries when the user disabled them in settings.
  // Raw (unfiltered) entries stay in the cache so toggling the setting
  // back on doesn't require a refetch.
  private filterHiddenEntries(entries: FileEntry[]): FileEntry[] {
    if (configService.config.showHiddenFiles) return entries;
    return entries.filter((entry) => !entry.is_hidden);
  }

  // Re-apply the hidden-files filter to a pane that is already loaded
  private refilterPane(tabId: string, pane: Tab, side: "primary" | "secondary") {
    if (pane.viewState.searchQuery.trim()) {
      // Search results are filtered when assigned; re-run for correctness
      void this.searchInPane(tabId, side, pane.viewState.searchQuery);
      return;
    }
    const cached = this.cache.get(pane.currentPath);
    if (cached) {
      pane.files = this.filterHiddenEntries(cached.entries);
    } else {
      void this.loadDirectoryForTab(tabId, side, pane.currentPath);
    }
  }

  get activeTab(): Tab {
    return this.#activeTab;
  }

  get activePanePath(): string {
    const tab = this.activeTab;
    if (!tab) return "";
    if (tab.splitView && this.activePaneSide === "secondary") {
      return tab.splitView.currentPath;
    }
    return tab.currentPath;
  }

  // Add a new tab
  addTab(path: string = "/") {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      currentPath: path,
      history: [path],
      historyIndex: 0,
      viewState: {
        viewMode: configService.config.defaultViewMode,
        searchQuery: "",
        sortBy: this.mapConfigSortBy(),
        sortOrder: configService.config.sort.order,
      },
      files: [],
      selectedPaths: new SvelteSet<string>(),
      splitView: null,
    };
    this.tabs.push(newTab);
    this.activeTabId = newTab.id;
    this.activePaneSide = "primary";

    // Load files for new tab
    this.loadDirectoryForTab(newTab.id, "primary", path);
  }

  // Duplicate an existing tab
  duplicateTab(tabId: string) {
    const original = this.tabs.find((t) => t.id === tabId);
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
      selectedPaths: new SvelteSet<string>(pane.selectedPaths),
      splitView: null,
    });

    const duplicate: Tab = {
      id: crypto.randomUUID(),
      currentPath: original.currentPath,
      history: [...original.history],
      historyIndex: original.historyIndex,
      viewState: cloneViewState(original.viewState),
      files: [...original.files],
      selectedPaths: new SvelteSet<string>(original.selectedPaths),
      splitView: original.splitView ? clonePane(original.splitView) : null,
    };

    const index = this.tabs.findIndex((t) => t.id === tabId);
    this.tabs.splice(index + 1, 0, duplicate);
    this.activeTabId = duplicate.id;
  }

  // Close tab
  closeTab(tabId: string) {
    if (this.tabs.length <= 1) return; // Keep at least one
    const index = this.tabs.findIndex((t) => t.id === tabId);
    this.tabs = this.tabs.filter((t) => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[Math.max(0, index - 1)].id;
    }
  }

  // Toggle Split View for current tab
  toggleSplitView(tabId: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.splitView) {
      // Close split
      tab.splitView = null;
      this.activePaneSide = "primary";
    } else {
      // Open split with the current path
      tab.splitView = {
        id: crypto.randomUUID(),
        currentPath: tab.currentPath,
        history: [tab.currentPath],
        historyIndex: 0,
        viewState: {
          viewMode: tab.viewState.viewMode,
          searchQuery: "",
          sortBy: tab.viewState.sortBy,
          sortOrder: tab.viewState.sortOrder,
        },
        files: [...tab.files],
        selectedPaths: new SvelteSet<string>(),
        splitView: null,
      };
      this.activePaneSide = "secondary";
      // Load directory details for split view
      this.loadDirectoryForTab(tabId, "secondary", tab.currentPath);
    }
  }

  // Set the focused pane side
  focusPane(side: "primary" | "secondary") {
    this.activePaneSide = side;
  }

  // Toggle selection for a path in a given tab/pane
  toggleSelection(tabId: string, side: "primary" | "secondary", path: string, isMulti: boolean) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;

    if (isMulti) {
      if (pane.selectedPaths.has(path)) {
        pane.selectedPaths.delete(path);
      } else {
        pane.selectedPaths.add(path);
      }
    } else {
      pane.selectedPaths.clear();
      pane.selectedPaths.add(path);
    }
  }

  // Clear selection for a given tab/pane
  clearSelection(tabId: string, side: "primary" | "secondary") {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;
    pane.selectedPaths.clear();
  }

  // Navigate to a new path
  async navigate(tabId: string, side: "primary" | "secondary", path: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;

    // Clear selection on navigation
    pane.selectedPaths.clear();

    // Truncate history forward if we were in the middle of history
    pane.history = pane.history.slice(0, pane.historyIndex + 1);
    pane.history.push(path);
    pane.historyIndex = pane.history.length - 1;
    pane.currentPath = path;

    // Track the visited folder in the recents list (no-op if disabled)
    recentsService.add(path, true);

    await this.loadDirectoryForTab(tabId, side, path);
  }

  // Navigate back
  async goBack(tabId: string, side: "primary" | "secondary") {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;
    if (pane.historyIndex > 0) {
      pane.historyIndex--;
      pane.currentPath = pane.history[pane.historyIndex];
      pane.selectedPaths.clear(); // Clear selection
      await this.loadDirectoryForTab(tabId, side, pane.currentPath);
    }
  }

  // Navigate forward
  async goForward(tabId: string, side: "primary" | "secondary") {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;
    if (pane.historyIndex < pane.history.length - 1) {
      pane.historyIndex++;
      pane.currentPath = pane.history[pane.historyIndex];
      pane.selectedPaths.clear(); // Clear selection
      await this.loadDirectoryForTab(tabId, side, pane.currentPath);
    }
  }

  // Refresh current directory
  async refresh(tabId: string, side: "primary" | "secondary") {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;

    pane.selectedPaths.clear(); // Clear selection

    // Clear cache for this path to force fresh disk read
    this.cache.delete(pane.currentPath);
    await this.loadDirectoryForTab(tabId, side, pane.currentPath);
  }

  // Core Directory Loading containing the Path Caching System (Stale-While-Revalidate)
  async loadDirectoryForTab(
    tabId: string,
    side: "primary" | "secondary",
    path: string,
  ) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;
    if (!path.trim()) return;

    // 1. Check in-memory Cache
    const cached = this.cache.get(path);
    if (cached) {
      // Instantly populate files from cache for fluid immediate rendering
      pane.files = this.filterHiddenEntries(cached.entries);

      // If cached less than 10 seconds ago, don't trigger background reload
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < 10000) {
        return;
      }
    }

    // 2. Fetch from Tauri API (async revalidation)
    try {
      const freshEntries = await explorerApi.listDir(path);

      // Update Cache (raw entries; filtering happens on assignment)
      this.cache.set(path, {
        entries: freshEntries,
        timestamp: Date.now(),
      });

      // Update pane state (only if pane path didn't change while loading)
      if (pane.currentPath === path) {
        pane.files = this.filterHiddenEntries(freshEntries);
      }

      // Update the sidebar tree dynamically to reflect changes in background
      import("./sidebar.state.svelte").then(({ sidebarState }) => {
        sidebarState.refreshPath(path);
      }).catch(err => {
        console.error("Failed to dynamically import sidebarState:", err);
      });
    } catch (err) {
      console.error(`Failed to load directory: ${path}`, err);
      // Keep cached files if load fails, or clear if cache didn't exist
      if (!cached && pane.currentPath === path) {
        pane.files = [];
      }
    }
  }

  // Fast search using Tauri index search
  async searchInPane(
    tabId: string,
    side: "primary" | "secondary",
    query: string,
  ) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;
    pane.viewState.searchQuery = query;

    if (!query.trim()) {
      // Revert to loading standard directory entries
      await this.loadDirectoryForTab(tabId, side, pane.currentPath);
      return;
    }

    const requestedPath = pane.currentPath;
    try {
      const results = await explorerApi.searchIndex(query, requestedPath);
      // Discard results if the pane navigated away or the query changed while searching
      if (
        pane.currentPath === requestedPath &&
        pane.viewState.searchQuery === query
      ) {
        pane.files = this.filterHiddenEntries(results);
      }
    } catch (err) {
      console.error("Indexed search failed", err);
    }
  }

  // Update sorting criteria
  sortPane(
    tabId: string,
    side: "primary" | "secondary",
    sortBy: "name" | "size" | "modified" | "type",
  ) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const pane = side === "secondary" && tab.splitView ? tab.splitView : tab;

    if (pane.viewState.sortBy === sortBy) {
      // Toggle order
      pane.viewState.sortOrder =
        pane.viewState.sortOrder === "asc" ? "desc" : "asc";
    } else {
      pane.viewState.sortBy = sortBy;
      pane.viewState.sortOrder = "asc";
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
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        });
      } else if (sortBy === "size") {
        comparison = a.size - b.size;
      } else if (sortBy === "modified") {
        comparison = a.modified - b.modified;
      } else if (sortBy === "type") {
        comparison = (a.extension || "").localeCompare(
          b.extension || "",
          undefined,
          { sensitivity: "base" },
        );
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }
}

// Global shared state singleton instance
export const explorerState = new ExplorerState();

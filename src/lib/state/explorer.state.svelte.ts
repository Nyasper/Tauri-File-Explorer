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
  isWelcomeOpen = $state(false);
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

  // Resolve the initial path(s) from the onStartup mode. "custom" maps the
  // configured defaultPaths list; "last-session" is handled separately by
  // tryRestoreSession and "welcome" keeps tabs at the root path.
  private async resolveStartupPaths(): Promise<string[]> {
    switch (configService.config.onStartup) {
      case "home":
        try {
          return [await explorerApi.getHomeDir()];
        } catch (err) {
          console.error(
            "Failed to resolve home directory, falling back to root:",
            err,
          );
          return ["/"];
        }
      case "custom": {
        const paths = configService.config.defaultPaths;
        if (!paths || paths.length === 0) return ["/"];
        return paths.map((p) =>
          p === "root" || !p.trim() ? "/" : p.trim(),
        );
      }
      case "last-session":
      case "welcome":
      case "root":
      default:
        return ["/"];
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

          // "welcome" mode shows the welcome screen overlay on launch;
          // the initial tabs stay at the root path (the default fallback
          // of resolveStartupPaths) until the user picks a destination.
          if (configService.config.onStartup === "welcome") {
            this.isWelcomeOpen = true;
          }

          const startupPaths = await this.resolveStartupPaths();
          this.defaultPath = startupPaths[0];

          const sortBy = this.mapConfigSortBy();

          // Apply defaults to the initial tab and set its path to the
          // first startup entry (historyIndex is always 0 at this point).
          const initialTab = this.tabs[0];
          initialTab.viewState.viewMode =
            configService.config.defaultViewMode;
          initialTab.viewState.sortBy = sortBy;
          initialTab.viewState.sortOrder =
            configService.config.sort.order;
          initialTab.currentPath = startupPaths[0];
          initialTab.history = [startupPaths[0]];
          this.loadDirectoryForTab(
            initialTab.id,
            "primary",
            startupPaths[0],
          );

          // Open additional tabs for every remaining startup path
          for (let i = 1; i < startupPaths.length; i++) {
            this.addTab(startupPaths[i]);
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
        isLoading: false,
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
      isLoading: false,
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
      isLoading: false,
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
      isLoading: false,
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
        isLoading: false,
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

  // Open a path in the secondary pane of the given tab. If split view is
  // not active, it is enabled first; otherwise the existing secondary
  // pane is navigated to the path. Focus is moved to the secondary pane.
  async openInSplitView(tabId: string, path: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (!tab.splitView) {
      this.toggleSplitView(tabId);
    }

    this.activePaneSide = "secondary";
    await this.navigate(tabId, "secondary", path);
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

  // Monotonic load tokens per pane: every new load bumps the token, so
  // chunks/completions from a superseded stream (navigation away, refresh,
  // search) are discarded instead of clobbering the pane's current state.
  private loadTokens = new Map<string, number>();

  private nextLoadToken(paneId: string): number {
    const token = (this.loadTokens.get(paneId) ?? 0) + 1;
    this.loadTokens.set(paneId, token);
    return token;
  }

  private isCurrentLoad(paneId: string, token: number): boolean {
    return this.loadTokens.get(paneId) === token;
  }

  // Base ordering for cached entries: directories first, then
  // case-insensitive name (mirrors the historical Rust-side listing order,
  // so cache hits render identically to before streaming existed).
  private sortEntriesBase(entries: FileEntry[]): FileEntry[] {
    return entries.sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
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

    // Navigating away from a path with an in-flight stream cancels the
    // backend read, so leaving a huge folder stops its disk I/O instead
    // of letting it run to completion in the background.
    if (pane.isLoading && pane.currentPath !== path) {
      void explorerApi.cancelDirStream(pane.currentPath);
    }

    // 1. Check in-memory Cache
    const cached = this.cache.get(path);
    if (cached) {
      // Instantly populate files from cache for fluid immediate rendering
      pane.files = this.filterHiddenEntries(cached.entries);
      pane.isLoading = false;

      // If cached less than 10 seconds ago, don't trigger background reload
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < 10000) {
        return;
      }
    }

    // 2. Fetch from Tauri API (async revalidation), streamed in chunks so
    // the first rows paint immediately in huge folders.
    const token = this.nextLoadToken(pane.id);
    const isCurrent = () =>
      this.isCurrentLoad(pane.id, token) && pane.currentPath === path;

    pane.isLoading = true;

    // Cold loads (no cache) paint progressively as chunks arrive; warm
    // revalidations keep the cached list on screen and swap at the end.
    const paintProgressively = !cached;
    const accumulated: FileEntry[] = [];
    if (paintProgressively) {
      pane.files = [];
    }

    try {
      await explorerApi.listDirStream(path, (chunk) => {
        accumulated.push(...chunk);
        if (paintProgressively && isCurrent()) {
          pane.files = this.filterHiddenEntries([...accumulated]);
        }
      });

      // Update Cache (raw entries in base order; filtering happens on
      // assignment). Streamed chunks arrive unsorted, so the base order
      // is applied once here before caching.
      this.sortEntriesBase(accumulated);
      this.cache.set(path, {
        entries: accumulated,
        timestamp: Date.now(),
      });

      // Final assignment with the pane's active sort applied (streamed
      // chunks arrive in raw disk order)
      if (isCurrent()) {
        pane.files = this.filterHiddenEntries(accumulated);
        this.applyLocalSort(pane);
        pane.isLoading = false;
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
      if (this.isCurrentLoad(pane.id, token)) {
        pane.isLoading = false;
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

    // Invalidate any in-flight directory stream so late chunks don't
    // overwrite the incoming search results, and cancel the backend read.
    this.nextLoadToken(pane.id);
    if (pane.isLoading) {
      void explorerApi.cancelDirStream(pane.currentPath);
    }
    pane.isLoading = false;

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

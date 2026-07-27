import { browser } from "$app/environment";
import { LazyStore } from "@tauri-apps/plugin-store";
import { normalizePath } from "../utils/path.helper";

export interface PinnedEntry {
  name: string;
  path: string;
}

const STORE_KEY = "entries";

/**
 * Tracks user-pinned folders shown in the sidebar's "Pinned" section and
 * in the welcome screen. Persisted in its own Tauri store. Deduplicated
 * by normalized path so the same folder cannot be pinned twice (e.g.
 * "C:\Foo" and "C:/Foo" count as the same entry).
 */
export class PinnedFoldersService {
  #store: LazyStore | null = null;
  entries: PinnedEntry[] = $state([]);

  constructor() {
    if (browser) {
      this.#store = new LazyStore("pinned.json");
      void this.init();
    }
  }

  private async init() {
    if (!this.#store) return;
    try {
      const stored = await this.#store.get<PinnedEntry[]>(STORE_KEY);
      if (Array.isArray(stored)) {
        this.entries = stored;
      }
    } catch (err) {
      console.error("Failed to load pinned folders from Tauri Store:", err);
    }
  }

  private async persist() {
    if (!this.#store) return;
    try {
      await this.#store.set(STORE_KEY, this.entries);
      await this.#store.save();
    } catch (err) {
      console.error("Failed to persist pinned folders:", err);
    }
  }

  /** True if the given path is currently pinned (compared by normalized path). */
  isPinned(path: string): boolean {
    const norm = normalizePath(path);
    return this.entries.some((e) => normalizePath(e.path) === norm);
  }

  /**
   * Toggle a folder's pinned state. Returns the new state: `true` if the
   * folder is pinned after the call, `false` if it was unpinned.
   */
  toggle(path: string, name: string): boolean {
    if (this.isPinned(path)) {
      this.unpin(path);
      return false;
    }
    this.pin(path, name);
    return true;
  }

  pin(path: string, name: string) {
    if (this.isPinned(path)) return;
    this.entries = [...this.entries, { name, path }];
    void this.persist();
  }

  unpin(path: string) {
    const norm = normalizePath(path);
    const next = this.entries.filter((e) => normalizePath(e.path) !== norm);
    if (next.length === this.entries.length) return;
    this.entries = next;
    void this.persist();
  }
}

export const pinnedFoldersService = new PinnedFoldersService();

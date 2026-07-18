import { browser } from "$app/environment";
import { LazyStore } from "@tauri-apps/plugin-store";
import { configService } from "./config.service.svelte";

export interface RecentEntry {
  path: string;
  name: string;
  isDir: boolean;
}

const MAX_RECENTS = 50;
const STORE_KEY = "recents";

/**
 * Tracks recently visited places (both folders navigated to and files
 * opened), most-recent-first, deduplicated and capped at MAX_RECENTS.
 * Persisted in its own Tauri store. Disabling the rememberRecents
 * setting wipes the stored list.
 */
export class RecentsService {
  #store: LazyStore | null = null;
  recents: RecentEntry[] = $state([]);

  constructor() {
    if (browser) {
      this.#store = new LazyStore("recents.json");
      void this.init();

      $effect.root(() => {
        $effect(() => {
          // Wipe stored recents as soon as the feature gets disabled
          if (!configService.config.rememberRecents) {
            this.clear();
          }
        });
      });
    }
  }

  private async init() {
    if (!this.#store) return;
    try {
      const stored = await this.#store.get<RecentEntry[]>(STORE_KEY);
      if (Array.isArray(stored)) {
        this.recents = stored.slice(0, MAX_RECENTS);
      }
    } catch (err) {
      console.error("Failed to load recents from Tauri Store:", err);
    }
  }

  private async persist() {
    if (!this.#store) return;
    try {
      await this.#store.set(STORE_KEY, this.recents);
      await this.#store.save();
    } catch (err) {
      console.error("Failed to persist recents:", err);
    }
  }

  /** Record a visited place. No-op while the setting is disabled. */
  add(path: string, isDir: boolean) {
    if (!configService.config.rememberRecents) return;
    const name =
      path.substring(
        Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
      ) || path;
    this.recents = [
      { path, name, isDir },
      ...this.recents.filter((r) => r.path !== path),
    ].slice(0, MAX_RECENTS);
    void this.persist();
  }

  remove(path: string) {
    this.recents = this.recents.filter((r) => r.path !== path);
    void this.persist();
  }

  clear() {
    if (this.recents.length === 0) return;
    this.recents = [];
    void this.persist();
  }
}

export const recentsService = new RecentsService();

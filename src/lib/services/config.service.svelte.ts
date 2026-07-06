import { browser } from "$app/env";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { ApplicationConfig } from "../types/application.config.types";

export class ConfigService {
  #store: LazyStore | null = null;
  #defaultConfig: ApplicationConfig = $state({
    defaultTheme: "system",
    defaultPath: "root",
    onStartup: "last-session",
    defaultViewMode: "list",
    sort: {
      by: "name",
      order: "asc",
    },
    rememberHistory: true,
    rememberRecents: true,
    showHiddenFiles: true,
    showExtensions: true,
    confirmDelete: true,
    openMode: "doubleClick",
    showSidebar: true,
    iconSize: "medium",
    language: "en",
    defaultAccentColor: "#3b82f6",
  });

  #configInitialized = $state(false);
  config: ApplicationConfig = $state(this.#defaultConfig);

  constructor() {
    if (browser) {
      this.#store = new LazyStore("config.json");
      this.initConfig();

      $effect.root(() => {
        $effect(() => {
          if (this.configInitialized) {
            // Deeply track all properties of config
            JSON.stringify(this.config);

            // Only save to the store if initialization is complete to avoid overwriting with defaults on startup
            this.updateConfig(this.config);
            console.debug("config updated ", this.config);
          }
        });
      });
    }
  }

  private async initConfig() {
    if (!this.#store) return;

    try {
      const keys = await this.#store.keys();

      if (keys.length === 0) {
        await this.updateStoreWithDefaultConfig();
        console.debug("empty store, populating defaults...");
      } else {
        await this.loadConfigFromStore(keys);
        console.debug("loading config from store...");
      }
    } catch (err) {
      console.error("Failed to load configuration from Tauri Store:", err);
    } finally {
      this.#configInitialized = true;
    }
  }

  private async updateConfig(config: ApplicationConfig) {
    if (!this.#store) return;

    try {
      for (const [key, value] of Object.entries(config)) {
        await this.#store.set(key, value);
      }
      await this.#store.save();
    } catch (err) {
      console.error("Failed to update Config from state", err);
    }
  }

  private async updateStoreWithDefaultConfig() {
    if (!this.#store) return;
    try {
      for (const [key, value] of Object.entries(this.#defaultConfig)) {
        await this.#store.set(key, value);
      }
      await this.#store.save();
    } catch (err) {
      console.error("Failed to save configuration to Tauri Store:", err);
    }
  }

  private async loadConfigFromStore(configKeys: string[]) {
    if (!this.#store) return;
    try {
      for (const key of configKeys) {
        const value = await this.#store.get(key);
        if (value !== undefined && key in this.#defaultConfig) {
          (this.config as any)[key] = value;
        }
      }
    } catch (err) {
      console.error("Failed to load configuration from Tauri Store:", err);
    }
  }

  private initFallback() {
    try {
      const saved = localStorage.getItem("app_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this.#defaultConfig, parsed);
      }
    } catch (err) {
      console.error("Failed to load configuration from localStorage:", err);
    } finally {
      this.#configInitialized = true;
    }
  }

  get configInitialized() {
    return this.#configInitialized;
  }
}

export const configService = new ConfigService();

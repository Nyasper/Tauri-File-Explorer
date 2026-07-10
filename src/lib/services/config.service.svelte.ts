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
    language: "en",
    defaultAccentColor: "#3b82f6",
  });

  #configInitialized = $state(false);
  config: ApplicationConfig = $state(this.#defaultConfig);

  constructor() {
    if (browser) {
      this.#store = new LazyStore("config.json");
      this.initConfig();

      // Listen for system theme changes
      const systemMedia = window.matchMedia("(prefers-color-scheme: dark)");
      systemMedia.addEventListener("change", (e) => {
        if (this.config.defaultTheme === "system") {
          this.applyTheme(e.matches ? "dark" : "light");
        }
      });

      $effect.root(() => {
        $effect(() => {
          if (this.configInitialized) {
            // Read all properties of config and update store if changed
            JSON.stringify(this.config);
            this.updateConfig(this.config);
            console.debug("config updated ", this.config);
          }
        });

        // Reactively apply theme
        $effect(() => {
          const configTheme = this.config.defaultTheme;
          if (configTheme === "system") {
            this.applyTheme(systemMedia.matches ? "dark" : "light");
          } else {
            this.applyTheme(configTheme);
          }
        });

        // Reactively apply accent color
        $effect(() => {
          const accentColor = this.config.defaultAccentColor;
          document.documentElement.style.setProperty("--accent", accentColor);

          const rgb = this.hexToRgb(accentColor);
          if (rgb) {
            document.documentElement.style.setProperty(
              "--accent-rgb",
              `${rgb.r}, ${rgb.g}, ${rgb.b}`,
            );
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

  private applyTheme(theme: "dark" | "light") {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }

  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  get configInitialized() {
    return this.#configInitialized;
  }
}

export const configService = new ConfigService();

import { browser } from "$app/environment";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { ApplicationConfig } from "../types/application.config.types";

export class ConfigService {
  #store: LazyStore | null = null;
  #defaultConfig: ApplicationConfig = $state({
    defaultTheme: "system",
    defaultPath: "root",
    onStartup: "root",
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

      const systemMedia = window.matchMedia("(prefers-color-scheme: dark)");

      $effect.root(() => {
        // System theme changes: register/unregister via this effect's
        // cleanup so the listener is never leaked even if the singleton
        // is destroyed.
        $effect(() => {
          const onThemeChange = (e: MediaQueryListEvent) => {
            if (this.config.defaultTheme === "system") {
              this.applyTheme(e.matches ? "dark" : "light");
            }
          };
          systemMedia.addEventListener("change", onThemeChange);
          return () => {
            systemMedia.removeEventListener("change", onThemeChange);
          };
        });

        $effect(() => {
          if (this.configInitialized) {
            // Track all config fields for auto-save, then persist.
            const _ = {
              defaultTheme: this.config.defaultTheme,
              defaultPath: this.config.defaultPath,
              onStartup: this.config.onStartup,
              defaultViewMode: this.config.defaultViewMode,
              sortBy: this.config.sort.by,
              sortOrder: this.config.sort.order,
              rememberHistory: this.config.rememberHistory,
              rememberRecents: this.config.rememberRecents,
              showHiddenFiles: this.config.showHiddenFiles,
              showExtensions: this.config.showExtensions,
              confirmDelete: this.config.confirmDelete,
              openMode: this.config.openMode,
              showSidebar: this.config.showSidebar,
              language: this.config.language,
              defaultAccentColor: this.config.defaultAccentColor,
            };
            void _;
            this.updateConfig(this.config);
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
      } else {
        await this.loadConfigFromStore(keys);
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
      const defaultKeys = Object.keys(this.#defaultConfig) as (keyof ApplicationConfig)[];
      for (const key of configKeys) {
        if (!defaultKeys.includes(key as keyof ApplicationConfig)) continue;
        const value = await this.#store.get(key);
        if (value !== undefined) {
          (this.config as Record<keyof ApplicationConfig, unknown>)[
            key as keyof ApplicationConfig
          ] = value as never;
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

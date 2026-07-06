import { browser } from "$app/env";

export class ThemeService {
  theme: "dark" | "light" = $state("dark");

  constructor() {
    if (browser) {
      const savedTheme = localStorage.getItem("theme") as
        | "dark"
        | "light"
        | null;
      if (savedTheme) {
        this.setTheme(savedTheme);
      } else {
        const systemPrefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        this.setTheme(systemPrefersDark ? "dark" : "light");
      }
      console.debug("Theme initialized", this.theme);
    }
  }

  setTheme(newTheme: "dark" | "light") {
    this.theme = newTheme;
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  }

  toggleTheme() {
    this.setTheme(this.theme === "dark" ? "light" : "dark");
  }
}

export const themeService = new ThemeService();

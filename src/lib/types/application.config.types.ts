export type StartupMode = "root" | "home" | "last-session" | "custom";
export type ViewMode = "list" | "grid";
export type SortOrder = "asc" | "desc";
export type SortBy = "name" | "size" | "type" | "date";
export type Theme = "system" | "light" | "dark";
export type OpenMode = "singleClick" | "doubleClick";
export type AccentColor =
  | "#eab308"
  | "#10b981"
  | "#8b5cf6"
  | "#ec4899"
  | "#f97316"
  | "#d946ef"
  | "#3b82f6"
  | "#64748b";

export interface ApplicationConfig {
  defaultTheme: Theme;
  defaultPath: string;
  onStartup: StartupMode;
  defaultViewMode: ViewMode;
  sort: {
    by: SortBy;
    order: SortOrder;
  };
  rememberHistory: boolean;
  rememberRecents: boolean;
  showHiddenFiles: boolean;
  showExtensions: boolean;
  confirmDelete: boolean;
  openMode: OpenMode;
  showSidebar: boolean;
  defaultAccentColor: AccentColor;
}

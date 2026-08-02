import { type SvelteSet } from "svelte/reactivity";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number; // Bytes, or folder size once calculated
  modified: number; // Unix timestamp in milliseconds
  readonly: boolean;
  permissions?: string;
  extension?: string;
  is_hidden: boolean;
}

export interface ViewState {
  viewMode: "list" | "grid";
  searchQuery: string;
  sortBy: "name" | "size" | "modified" | "type";
  sortOrder: "asc" | "desc";
}

export interface Tab {
  id: string;
  currentPath: string;
  history: string[];
  historyIndex: number;
  viewState: ViewState;
  files: FileEntry[]; // Loaded file entries specific to this tab
  selectedPaths: SvelteSet<string>; // Selection state specific to this tab/pane
  splitView: Tab | null; // Support side-by-side active paths within the same tab
  isLoading: boolean; // True while directory entries are being streamed in
}

export interface CacheEntry {
  entries: FileEntry[];
  timestamp: number;
}

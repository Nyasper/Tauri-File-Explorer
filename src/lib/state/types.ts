export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_file: boolean;
  size: number; // Bytes, or folder size once calculated
  is_size_loading?: boolean;
  modified: number; // Unix timestamp in milliseconds
  readonly: boolean;
  permissions?: string;
  extension?: string;
}

export interface ViewState {
  viewMode: 'list' | 'grid';
  searchQuery: string;
  sortBy: 'name' | 'size' | 'modified';
  sortOrder: 'asc' | 'desc';
}

export interface Tab {
  id: string;
  currentPath: string;
  history: string[];
  historyIndex: number;
  viewState: ViewState;
  files: FileEntry[]; // Loaded file entries specific to this tab
  splitView: Tab | null; // Support side-by-side active paths within the same tab
}

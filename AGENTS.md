# AGENTS.md

Operating instructions and project specification for AI agents working in this repository.

---

## 1. Core Stack & Architecture

- **Frontend**: SvelteKit 2 + Svelte 5 (Runes-based SPA with Static Adapter) + TypeScript.
- **Package Manager**: Bun (used for dependency management and running scripts).
- **Styling**: Vanilla CSS (highly polished, responsive layouts, supporting light/dark modes). No Tailwind CSS.
- **Backend**: Tauri v2 + Rust (handles OS interaction, performance-critical file system operations, heavy search indexing, and background file/directory size computations).
- **Communication**: Tauri IPC (Commands, Channels, and Events). All invocations of Tauri Rust commands must be routed through the type-safe wrappers in [explorer.api.ts](file:///g:/Desktop/tauri-svelte-file-explorer/src/lib/explorer.api.ts). Direct use of Tauri's `invoke` in frontend components is strictly prohibited.
- **Target OS**: Windows, macOS, Linux (cross-platform desktop application).
- **Language**: English only for UI, logs, comments, and documentation.

---

## 2. Key Features Spec

### A. Navigation & Views

- **Directory Navigation**: Back/forward navigation, custom path entry, and click-to-navigate.
- **Navigation History**: Tracking of navigated paths per tab to facilitate browser-like back and forward states.
- **List & Grid Views**: Support for switching between list view (detailed columns: name, size, modified date, permissions) and grid view (large visual icons and names) at any time.
- **Type-based Icons**: Files must show specific icons corresponding to their MIME type or extension, and folders must show folder icons.

### B. File Operations

- **Listing**: Efficient reading and sorting of files and directories (directories first, then alphabetically).
- **Modification**: Creating, renaming, and deleting files and folders.
- **Transfer**: Copying and moving files and folders.
- **System Opener**: Open files using the system's default handler (via `tauri_plugin_opener` or custom Rust implementation).
- **Drag & Drop**: Dragging items within the file list to copy/move them between folders/views.

### C. Advanced UI Layouts

- **Tabs**: Support for multiple tabs. Opening a new tab defaults to the current active path.
- **Duplicate Tabs**: Ability to duplicate the active tab's path and history into a new tab.
- **Splitted View**: Ability to divide a single view panel into side-by-side active paths (split-view panes) inside the same tab or window.

### D. Performance & Optimizations

- **Background Size Calculation**: Calculating directory sizes recursively in the background (using Rust threads/tasks) so the UI remains fluid.
- **Directory Caching**: A path-based caching mechanism to avoid redundant disk reads.
- **Fast Indexed Search**: Quick search implementation using indices generated or managed by the Rust backend.

---

## 3. Frontend Architecture (Svelte 5 & TypeScript)

### A. Reactive State Management (Classes + Runes)

Global and local component states must be written using **Svelte 5 Runes** inside independent `.svelte.ts` files, encapsulated in Classes. This maintains an SPA-level single source of truth that is easily importable.

#### Example TypeScript Definitions (`src/lib/state/types.ts`)

```typescript
export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number; // Bytes
  modified: number; // Timestamp (Unix millis)
  readonly: boolean;
  permissions?: string; // Unix-style or Windows representation
  extension?: string;
}

export interface ViewState {
  viewMode: "list" | "grid";
  searchQuery: string;
  sortBy: "name" | "size" | "modified";
  sortOrder: "asc" | "desc";
}

export interface Tab {
  id: string;
  currentPath: string;
  history: string[];
  historyIndex: number;
  viewState: ViewState;
  splitView: Tab | null; // For Splitted View
}
```

#### Example State Manager (`src/lib/state/explorer.state.svelte.ts`)

```typescript
import { Tab, FileEntry } from "./types";

export class ExplorerState {
  // Runes for reactive states
  tabs = $state<Tab[]>([]);
  activeTabId = $state<string>("");

  constructor() {
    // Initialize with a default tab
    this.addTab();
  }

  get activeTab() {
    return this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0];
  }

  addTab(path: string = "/") {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      currentPath: path,
      history: [path],
      historyIndex: 0,
      viewState: {
        viewMode: "list",
        searchQuery: "",
        sortBy: "name",
        sortOrder: "asc",
      },
      splitView: null,
    };
    this.tabs.push(newTab);
    this.activeTabId = newTab.id;
  }

  duplicateTab(tabId: string) {
    const original = this.tabs.find((t) => t.id === tabId);
    if (!original) return;

    const duplicate: Tab = {
      id: crypto.randomUUID(),
      currentPath: original.currentPath,
      history: [...original.history],
      historyIndex: original.historyIndex,
      viewState: { ...original.viewState },
      splitView: original.splitView
        ? { ...original.splitView, id: crypto.randomUUID() }
        : null,
    };

    const index = this.tabs.findIndex((t) => t.id === tabId);
    this.tabs.splice(index + 1, 0, duplicate);
  }

  closeTab(tabId: string) {
    if (this.tabs.length <= 1) return; // Keep at least one
    const index = this.tabs.findIndex((t) => t.id === tabId);
    this.tabs = this.tabs.filter((t) => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[Math.max(0, index - 1)].id;
    }
  }

  // Back/Forward Navigation
  navigate(tabId: string, path: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Truncate history forward if we were in the middle of history
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(path);
    tab.historyIndex = tab.history.length - 1;
    tab.currentPath = path;
  }

  goBack(tabId: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (tab && tab.historyIndex > 0) {
      tab.historyIndex--;
      tab.currentPath = tab.history[tab.historyIndex];
    }
  }

  goForward(tabId: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (tab && tab.historyIndex < tab.history.length - 1) {
      tab.historyIndex++;
      tab.currentPath = tab.history[tab.historyIndex];
    }
  }
}

// Global shared state instance
export const explorerState = new ExplorerState();
```

### B. Svelte 5 Reusable Components

Components should be clean, modular, and written using Svelte 5 runes and snippets.

- **`ExplorerView`**: The primary component displaying directories. It must be generic and reusable, allowing customization of item layouts (e.g. List and Grid sub-components).
- Component structure example:
  - `src/lib/components/ExplorerView.svelte`
  - `src/lib/components/EntryList.svelte`
  - `src/lib/components/EntryGrid.svelte`
  - `src/lib/components/TabBar.svelte`

---

## 4. Backend Architecture (Tauri v2 + Rust)

Tauri must handle file system operations, heavy CPU operations, and multi-threaded calculations.

### Commands to implement:

- `list_dir(path: String) -> Result<Vec<FileEntry>, String>`
- `list_dir_stream(path: String, on_chunk: Channel<Vec<FileEntry>>) -> Result<usize, String>`
- `cancel_dir_stream(path: String) -> Result<(), String>`
- `create_file(path: String, is_dir: bool) -> Result<(), String>`
- `rename_file(old_path: String, new_path: String) -> Result<(), String>`
- `delete_file(path: String) -> Result<(), String>`
- `copy_file(src: String, dest: String) -> Result<(), String>`
- `move_file(src: String, dest: String) -> Result<(), String>`
- `search_index(query: String, root_path: String) -> Result<Vec<FileEntry>, String>`
- `get_home_dir() -> Result<String, String>`
- `get_system_paths() -> Result<Vec<SystemPathEntry>, String>`
- `list_sidebar_folders(path: String) -> Result<Vec<SidebarFolder>, String>`
- `get_system_drives() -> Result<Vec<DriveEntry>, String>`
- `get_recycle_bin_path() -> Result<String, String>`
- `empty_recycle_bin() -> Result<(), String>`

---

## 5. Path Caching System

To avoid lag when navigating between frequently visited folders, implement a path-based caching system on the frontend (or Rust backend with metadata matching).

### Caching Flow:

1. Maintain a reactive cache Map/Dictionary of visited paths: `path -> { lastModified: number, entries: FileEntry[] }`.
2. When navigating to `/home/Documents`:
   - Query directory metadata (fast check of `modified` date of the directory itself).
   - If path is in cache AND the directory's `modified` timestamp matches the cached `lastModified` timestamp:
     - Return the cached entries immediately.
     - (Optionally) Fetch in the background to confirm no sub-entry changes, updating the UI if necessary.
   - If not in cache or modified timestamp differs:
     - Fetch the complete list from the Tauri backend and update the cache.

---

## 6. Development Workflow Rules

1. **Verify Lint & Type Checks**: Always run `bun run check` before concluding work.
2. **Modular Code**: Do not create massive multi-thousand line files. Keep Svelte files under 300 lines by extracting logic to helpers or smaller components.
3. **Vanilla CSS Design System**:
   - Establish consistent CSS variables in `src/app.css` (or `src/routes/+layout.svelte`) for color palettes, spacing, border-radii, and animations.
   - Design with a modern, glassmorphic dark/light aesthetics. Use premium animations for transition effects.
4. **Desktop App Styling**:
   - Disable default browser selection (`user-select: none`) where appropriate.
   - Adapt context menus and inputs to look like a desktop application.
5. **Tauri IPC Calls**:
   - All backend calls MUST be invoked via the wrappers in [explorer.api.ts](file:///g:/Desktop/tauri-svelte-file-explorer/src/lib/explorer.api.ts). Direct calls to Tauri's `invoke` from components are disallowed.
6. **File Naming Conventions**:
   - Svelte Component files: `PascalCase.svelte` (e.g., `TabBar.svelte`).
   - Svelte 5 Reactive Services/State: `kebab-case.role.svelte.ts` (e.g., `keybinding.service.svelte.ts`).
   - Pure TypeScript helpers/APIs (no Svelte runes): `kebab-case.ts` (e.g., `explorer.api.ts`).
7. **CHANGELOG on new features**: every time a new user-facing feature is added to the application
   (a new section, a new action, a new modal, a new sidebar entry, a new keyboard shortcut, etc.),
   update `CHANGELOG.md` automatically — do not wait for the user to ask. Add the entry under
   `## [Unreleased]` (or the current in-progress version) in the appropriate `### Added`,
   `### Changed`, `### Fixed`, or `### Removed` subsection. Use the same tone and bullet style as
   the existing entries. Internal-only refactors, lint cleanups, and CI/build changes do **not**
   require a CHANGELOG entry; the rule applies to anything the end user can perceive.

---

## 7. Commit Workflow

- **Default branch:** work on the `feature` branch. Do not commit directly to `main` unless explicitly told to.
- **When to commit:** after each significant, self-contained change (e.g. a new feature, a refactor, a bug fix, a meaningful style/UX pass). Do not commit partial work, debug code, or unrelated edits bundled together.
- **Commit message style:** short, descriptive, written in English. The project already uses Conventional Commits (e.g. `ci: ...`, `docs: ...`, `chore(bundle): ...`), so prefer a `<type>(<scope>): <summary>` line when it fits, with `type` ∈ `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `perf`, `test`. Keep the summary under ~72 characters and in the imperative mood (e.g. `feat(grid): dim hidden entries to distinguish them`).
- **What NOT to do:**
  - Do **not** push to the remote automatically. Only push when the user explicitly asks for it (e.g. "push", "push it", "subir").
  - Do **not** use interactive flags (`-i`), force-push, amend an existing commit, skip hooks, or update git config unless explicitly asked.
  - Do **not** commit secrets, generated assets, or files covered by `.gitignore` (e.g. `node_modules/`, `src-tauri/target/`, `.svelte-kit/`).
- **Before committing:** review `git status` and `git diff` to make sure only the intended files are staged, and `git log --oneline -10` to match the existing commit style.

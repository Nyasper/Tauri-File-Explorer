# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - Unreleased

### Added
- **Welcome screen**: quick-navigation hub shown on launch with:
  - Quick Access and Drives cards from the sidebar for one-click navigation
  - Recents list (folders navigate, files open with the system handler)
  - Quick actions for Settings (`Ctrl+O`) and Help (`F1`) with visible shortcut hints
  - "Show this screen on startup" checkbox to opt out (falls back to Last Session)
- "Welcome" option in Settings → General → "On Startup"
- Welcome screen can be reopened at any time via the new TabBar home button or `Ctrl+N`; `Esc` closes it
- Collapsible sidebar sections (Quick Access, Drives, Recents) with collapse state persisted across launches
- "Clear all recents" button in the Recents section header (with confirmation dialog)
- Hidden files and folders are now visually dimmed in list and grid views to distinguish them

### Changed
- Default startup mode for new installations is now "welcome" (existing configs keep their current setting)
- Recents section moved below Drives in the sidebar

## [1.0.0] - 2026-07-25

### Added
- Multi-tab browsing with full back/forward history per tab
- Split-pane view (two independent panes in the same tab)
- Indexed recursive search with background indexing
- Stale-while-revalidate directory caching for instant navigation
- Session restoration on launch (configurable via "On Startup")
- Quick Access sidebar (Home, Desktop, Documents, Downloads, Pictures, Videos, Music)
- Drives section in the sidebar (Windows) / root (Unix)
- Recents section with add/remove and toggle in settings
- Recycle Bin integration (open and empty, cross-platform)
- System clipboard (copy / cut / paste) across panes
- Cross-platform file deletion via `trash` crate (Recycle Bin / Trash)
- Recursive copy and move with bounded concurrency (32 ops)
- Symlink-safe directory walking (skips symlinks during search)
- Hidden-file detection (Unix dot-prefix and Windows `FILE_ATTRIBUTE_HIDDEN`)
- Light / dark / system theme with smooth transition
- 8 accent color presets
- Single-click and double-click open modes (configurable)
- Show / hide file extensions
- Show / hide hidden files (also `Ctrl+H`)
- Confirm before delete
- Sticky table headers, image thumbnails, and type-based icons
- Indexed search, list/grid view toggle, sort by name/size/date/type
- Settings modal with General / Appearance / Behavior sections
- Help modal with full keyboard shortcut reference
- Cross-platform keyboard shortcuts (Mac uses `Cmd`, others `Ctrl`)
- Mac back/forward mouse buttons support
- Promise-based in-app dialog service (alert / confirm / prompt)
- Tauri-side search index with stale-while-revalidate fallback
- Cross-platform in-memory `Mutex<HashMap>` search index (5000 entries cap)
- Tauri-side 500-result cap on searches to bound memory
- CI release workflow that builds for Windows, macOS, and Linux on every `v*` tag

### Changed
- Bumped to Tauri v2, Svelte 5 (runes), SvelteKit 2
- Replaced boilerplate Tauri template with a polished, custom UI
- Default window size grew to 1200x800 (min 800x500) so split view fits comfortably
- Default tab keybindings are routed through a centralized keybinding service
- Replaced native `alert / confirm / prompt` with an in-app dialog system
- Settings persist via `tauri-plugin-store` keyed per-field
- Session persist via `tauri-plugin-store` debounced 500 ms

### Fixed
- Path normalization on Windows handles both backslash and forward slash
- Drive-root parent path returns empty (no false "parent of C:\")
- Sidebar tree expansion is generation-token guarded against stale runs
- Stale tab keybinding listeners removed via effect cleanup
- Rust clipboard deinitialized via the existing trash crate to avoid platform-specific API surface

### Security
- Strict CSP scoped to `'self'`, asset protocol, and ipc
- Asset protocol enabled with `**` scope (required for image thumbnails)
- All filesystem operations go through Tauri commands; no direct `invoke` from components

[1.1.0]: https://github.com/herre/tauri-svelte-file-explorer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/herre/tauri-svelte-file-explorer/releases/tag/v1.0.0

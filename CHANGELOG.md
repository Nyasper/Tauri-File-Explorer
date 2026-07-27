# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-27

### Added
- Welcome screen: quick-navigation hub shown on launch with:
  - Quick Access and Drives cards from the sidebar for one-click navigation
  - Recents list (folders navigate, files open with the system handler)
  - Quick actions for Settings (`Ctrl+O`) and Help (`F1`) with visible shortcut hints
  - "Show this screen on startup" checkbox to opt out (falls back to Last Session)
- "Welcome" option in Settings → General → "On Startup"
- Welcome screen can be reopened at any time via the new TabBar home button or `Ctrl+N`; `Esc` closes it
- Collapsible sidebar sections (Quick Access, Drives, Recents) with collapse state persisted across launches
- "Clear all recents" button in the Recents section header (with confirmation dialog)
- Hidden files and folders are now visually dimmed in list and grid views to distinguish them
- Configurable section order for sidebar and welcome screen via Settings → Appearance
  with ↑/↓ buttons (Quick Access, Pinned, Drives, Recents)
- **Pinned folders**: right-click any folder in the list or grid view to "Pin Folder"; pinned folders appear
  in a new collapsible "Pinned" section in the sidebar (between Quick Access and Drives) and in the
  welcome screen, persisted across launches. Toggle the state from the same menu ("Unpin Folder") or
  remove directly from the sidebar's context menu. Pinned entries support the same expand/collapse
  tree behavior as system Quick Access roots
- "Open in a new Tab" and "Open in Split View" options in the right-click context menu for folders
  in the list/grid views and in the sidebar. "Open in a new Tab" opens the folder as a new tab;
  "Open in Split View" navigates the secondary pane to the folder (enabling split view first if
  not already active). Both options are shown only for folders and only with a single selection
- Middle-click (mouse button 1) on a folder in the list/grid views or in the sidebar opens it
  in a new tab; middle-click on a tab in the TabBar closes that tab. Matches common browser
  and file-manager behavior. Files and the last remaining tab are unaffected by middle-click
  (same constraint as `Ctrl+W`)
- **Windows NSIS installer** (`Tauri File Explorer_1.1.0_x64-setup.exe`) as an alternative to the
  portable `.zip`, with a traditional install wizard (per-user install, no admin required).
  Unsigned NSIS installers may still trigger a SmartScreen prompt on first run ("More info" →
  "Run anyway"), but are not flagged as trojans by Windows Defender the way the unsigned MSI was

### Changed
- Default startup mode for new installations is now "welcome" (existing configs keep their current setting)
- Settings modal reorganized into 2 tabs: Appearance (7 items) and Behavior (8 items).
- Context menu ordering unified across sidebar, list view and grid view with consistent separator groups:
  open actions → Pin/Unpin → Copy/Cut/Paste → Rename → Delete
  On Startup and Default Startup Paths moved from General to Behavior
- **"Default Startup Path" is now "Default Startup Paths"**: supports multiple paths in Custom startup mode.
  Each path opens in its own tab, shown as a dynamic list with add/remove buttons, visible only when
  "Custom" is selected in the On Startup switcher
- Recents section moved below Drives in the sidebar

### Fixed
- Action-bar buttons (including the split view toggle) now wrap to a new line when the
  available width is too narrow. Previously the right-side group (view mode + split toggle)
  was clipped when split view was active in a narrow window, making it impossible to
  deactivate split view without resizing the window
- Middle-click on a folder now correctly opens it in a new tab. The WebView's auto-scroll
  mode was being triggered on `mousedown` for button 1, swallowing the `auxclick` event;
  the global `mousedown` handler now prevents default for the middle button (matching the
  existing handling for back/forward mouse buttons)

## [1.0.0] - 2026-07-25

### Added
- `.rpm` bundle target for Red Hat, Fedora, openSUSE, and other RPM-based Linux distros
- Windows **portable `.zip`** distribution: extract and run, no installer, no SmartScreen warnings on unsigned binaries
- `.deb` (Debian / Ubuntu), `.AppImage` (universal Linux), `.dmg` + `.app` (macOS)

### Removed
- `.msi` (WiX) Windows installer: replaced by portable `.zip` for easy local testing without signing
- `.exe` (NSIS) Windows installer: dropped in favor of portable distribution

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

[1.1.0]: https://github.com/Nyasper/Tauri-File-Explorer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Nyasper/Tauri-File-Explorer/releases/tag/v1.0.0

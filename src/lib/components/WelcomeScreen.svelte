<script lang="ts">
  import { fade } from 'svelte/transition';
  import { explorerState } from '../state/explorer.state.svelte';
  import { sidebarState } from '../state/sidebar.state.svelte';
  import { configService } from '../services/config.service.svelte';
  import { recentsService, type RecentEntry } from '../services/recents.service.svelte';
  import { dialogService } from '../services/dialog.service.svelte';
  import * as explorerApi from '../explorer.api';

  const isMac = navigator.userAgent.toLowerCase().includes('mac');
  const settingsShortcut = isMac ? 'Cmd+O' : 'Ctrl+O';

  const MAX_RECENTS_SHOWN = 8;
  let recentItems = $derived(recentsService.recents.slice(0, MAX_RECENTS_SHOWN));
  let showOnStartup = $derived(configService.config.onStartup === 'welcome');

  function close() {
    explorerState.isWelcomeOpen = false;
  }

  // Navigate the active pane to a folder and dismiss the welcome screen
  async function openFolder(path: string) {
    explorerState.isWelcomeOpen = false;
    await explorerState.navigate(explorerState.activeTab.id, explorerState.activePaneSide, path);
  }

  // Recents: folders navigate, files open with the system handler
  async function openRecent(recent: RecentEntry) {
    explorerState.isWelcomeOpen = false;
    if (recent.isDir) {
      await explorerState.navigate(explorerState.activeTab.id, explorerState.activePaneSide, recent.path);
      return;
    }
    try {
      await explorerApi.openFile(recent.path);
    } catch (err) {
      await dialogService.alert(`Could not open file: ${err}`);
    }
  }

  // Clear all recents with confirmation (same behavior as the sidebar)
  async function handleClearRecents() {
    const confirmed = await dialogService.confirm('Remove all recent items?', {
      title: 'Clear Recents',
      confirmLabel: 'Clear',
      danger: true
    });
    if (confirmed) recentsService.clear();
  }

  // Opt in/out of the welcome screen at startup. Disabling falls back to
  // restoring the last session so the app still opens somewhere useful.
  function handleStartupToggle(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    configService.config.onStartup = checked ? 'welcome' : 'last-session';
  }
</script>

<div class="welcome-overlay" transition:fade={{ duration: 180 }} role="dialog" aria-label="Welcome screen">
  <div class="welcome-panel animate-scale-in">
    <button class="welcome-close" onclick={close} aria-label="Close welcome screen" title="Close (Esc)">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <header class="welcome-header">
      <div class="welcome-logo">
        <svg viewBox="0 0 24 24" width="30" height="30" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <h1 class="welcome-title">Welcome</h1>
      <p class="welcome-subtitle">Jump back into your places, recents and app actions</p>
    </header>

    <div class="welcome-content">
      <section class="welcome-section">
        <h2 class="section-title">Quick Access</h2>
        <div class="cards-grid">
          <button class="place-card" onclick={() => openFolder('/')} title="/">
            <svg class="card-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <span class="card-label">Root</span>
          </button>
          {#each sidebarState.roots as node (node.path)}
            <button class="place-card" onclick={() => openFolder(node.path)} title={node.path}>
              <svg class="card-icon folder" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span class="card-label">{node.name}</span>
            </button>
          {/each}
        </div>
      </section>

      {#if sidebarState.drives.length > 0}
        <section class="welcome-section">
          <h2 class="section-title">Drives</h2>
          <div class="cards-grid">
            {#each sidebarState.drives as drive (drive.path)}
              <button class="place-card" onclick={() => openFolder(drive.path)} title={drive.path}>
                <svg class="card-icon drive" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="12" x2="2" y2="12"></line>
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                  <line x1="6" y1="16" x2="6.01" y2="16"></line>
                  <line x1="10" y1="16" x2="10.01" y2="16"></line>
                </svg>
                <span class="card-label">{drive.name}</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <section class="welcome-section">
        <div class="section-header">
          <h2 class="section-title">Recents</h2>
          {#if configService.config.rememberRecents && recentItems.length > 0}
            <button class="clear-recents-btn" onclick={handleClearRecents} title="Clear all recents" aria-label="Clear all recents">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          {/if}
        </div>
        {#if !configService.config.rememberRecents}
          <p class="empty-hint">Recents are disabled. You can enable them back in Settings.</p>
        {:else if recentItems.length === 0}
          <p class="empty-hint">No recent items yet. Folders and files you open will show up here.</p>
        {:else}
          <div class="recents-list">
            {#each recentItems as recent (recent.path)}
              <button class="recent-row" onclick={() => openRecent(recent)} title={recent.path}>
                {#if recent.isDir}
                  <svg class="recent-icon folder" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                {:else}
                  <svg class="recent-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                {/if}
                <span class="recent-name">{recent.name}</span>
                <span class="recent-path">{recent.path}</span>
              </button>
            {/each}
          </div>
        {/if}
      </section>
    </div>

    <footer class="welcome-footer">
      <label class="startup-toggle">
        <input type="checkbox" checked={showOnStartup} onchange={handleStartupToggle} />
        <span class="checkbox-box">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span>Show this screen on startup</span>
      </label>

      <div class="footer-actions">
        <button class="footer-action-btn" onclick={() => explorerState.isConfigModalOpen = true}>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.65 1.65 0 0 0 .33 1.82 1.65 1.65 0 0 0 1 1.51H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span class="footer-action-label">Settings</span>
          <kbd class="shortcut">{settingsShortcut}</kbd>
        </button>
        <button class="footer-action-btn" onclick={() => explorerState.isHelpModalOpen = true}>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span class="footer-action-label">Help</span>
          <kbd class="shortcut">F1</kbd>
        </button>
      </div>
    </footer>
  </div>
</div>

<style>
  .welcome-overlay {
    position: fixed;
    inset: 0;
    z-index: 900; /* Below modals (1000) and the context menu */
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(ellipse 60% 45% at 50% 0%, rgba(var(--accent-rgb), 0.08), transparent),
      var(--bg-primary);
  }

  .welcome-panel {
    position: relative;
    width: min(680px, calc(100vw - 48px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    padding: 2rem 2rem 1.25rem;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-glass);
    backdrop-filter: var(--glass-blur);
  }

  .welcome-close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-md);
    color: var(--text-muted);
  }
  .welcome-close:hover {
    background-color: var(--danger);
    color: white;
  }

  .welcome-header { text-align: center; margin-bottom: 1.5rem; }
  .welcome-logo {
    width: 56px;
    height: 56px;
    margin: 0 auto 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    background-color: rgba(var(--accent-rgb), 0.12);
    border: 1px solid rgba(var(--accent-rgb), 0.25);
    border-radius: var(--radius-lg);
  }
  .welcome-title {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .welcome-subtitle { color: var(--text-secondary); font-size: 0.9rem; margin: 4px 0 0; }

  .welcome-content { overflow-y: auto; display: flex; flex-direction: column; gap: 1.25rem; padding-right: 4px; }
  .section-title {
    font-family: var(--font-display);
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .section-header .section-title { margin: 0; }

  .clear-recents-btn {
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .clear-recents-btn:hover {
    background-color: var(--bg-hover);
    color: var(--danger);
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  }
  .place-card {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 10px 12px;
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 0.88rem;
    font-weight: 500;
  }
  .place-card:hover {
    border-color: rgba(var(--accent-rgb), 0.45);
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }
  .card-icon { flex-shrink: 0; color: var(--text-muted); }
  .card-icon.folder { color: var(--accent); }
  .card-icon.drive { color: var(--warning); }
  .place-card:hover .card-icon { color: var(--accent); }
  .card-label {
    min-width: 0;
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .recents-list { display: flex; flex-direction: column; gap: 2px; }
  .recent-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    padding: 7px 10px;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 0.86rem;
    text-align: left;
  }
  .recent-row:hover { background-color: var(--bg-hover); color: var(--text-primary); }
  .recent-icon { flex-shrink: 0; color: var(--text-muted); }
  .recent-icon.folder { color: var(--accent); }
  .recent-name {
    flex-shrink: 0;
    width: 180px;
    font-weight: 500;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .recent-path {
    flex: 1;
    min-width: 0;
    color: var(--text-muted);
    font-size: 0.78rem;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .empty-hint { color: var(--text-muted); font-size: 0.85rem; margin: 0; }

  .welcome-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .startup-toggle {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 0.84rem;
    cursor: pointer;
  }
  .startup-toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  .checkbox-box {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-hover);
    border-radius: var(--radius-sm);
    color: white;
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
  }
  .checkbox-box svg {
    opacity: 0;
    transform: scale(0.5);
    transition: opacity var(--transition-fast), transform var(--transition-fast);
  }
  .startup-toggle:hover .checkbox-box { border-color: var(--accent); }
  .startup-toggle input:checked + .checkbox-box {
    background-color: var(--accent);
    border-color: var(--accent);
  }
  .startup-toggle input:checked + .checkbox-box svg {
    opacity: 1;
    transform: scale(1);
  }
  .startup-toggle input:focus-visible + .checkbox-box {
    box-shadow: 0 0 0 3px var(--border-focus);
  }

  .footer-actions { display: flex; gap: 8px; }
  .footer-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 16px;
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
  }
  .footer-action-btn:hover {
    border-color: rgba(var(--accent-rgb), 0.45);
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }
  .footer-action-btn svg { color: var(--text-muted); }
  .footer-action-btn:hover svg { color: var(--accent); }
  .footer-action-label { font-size: 0.8rem; font-weight: 500; }
  .footer-action-btn .shortcut { margin: 0; }

  .shortcut {
    font-family: var(--font-body);
    font-size: 0.68rem;
    color: var(--text-muted);
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
  }
  :global(:root[data-theme="light"]) .shortcut { background-color: rgba(0, 0, 0, 0.04); }
</style>

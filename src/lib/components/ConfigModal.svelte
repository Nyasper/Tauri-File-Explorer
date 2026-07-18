<script lang="ts">
  import Modal from './shared/Modal.svelte';
  import { configService } from '$lib/services/config.service.svelte';
  import type { Theme, ViewMode, StartupMode, OpenMode, Lang, AccentColor } from '$lib/types/application.config.types';
  import { fade, crossfade } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';

  let { isModalOpen = $bindable(false) } = $props();

  const accentColors: AccentColor[] = [
    "#3b82f6", // Blue (Default)
    "#10b981", // Emerald
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#f97316", // Orange
    "#d946ef", // Fuchsia
    "#eab308", // Yellow
    "#64748b"  // Slate
  ];

  // Helper to change active tab/view within the settings modal if desired (optional tabbed interface inside the settings modal)
  let activeSection: 'general' | 'appearance' | 'behavior' = $state('general');

  const [send, receive] = crossfade({
    duration: 220,
    fallback(node, params) {
      const style = getComputedStyle(node);
      const transform = style.transform === 'none' ? '' : style.transform;
      return {
        duration: 220,
        easing: cubicInOut,
        css: (t) => `
          transform: ${transform} scale(${t});
          opacity: ${t};
        `
      };
    }
  });
</script>

<Modal title="Settings" {icon} bind:isOpen={isModalOpen} >
  <div class="settings-container">
    <!-- Sidebar / Nav for Settings sections -->
    <div class="settings-nav">
      <button 
        class="nav-tab" 
        class:active={activeSection === 'general'} 
        onclick={() => activeSection = 'general'}
      >
        General
      </button>
      <button 
        class="nav-tab" 
        class:active={activeSection === 'appearance'} 
        onclick={() => activeSection = 'appearance'}
      >
        Appearance
      </button>
      <button 
        class="nav-tab" 
        class:active={activeSection === 'behavior'} 
        onclick={() => activeSection = 'behavior'}
      >
        Behavior
      </button>
    </div>

    <!-- Settings Content Panel -->
    <div class="settings-body">
      {#if activeSection === 'general'}
        <div class="settings-section" transition:fade={{ duration: 150 }}>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Default Startup Path</span>
              <span class="setting-desc">Directory to open on launch when "Custom" startup mode is selected.</span>
            </div>
            <input 
              type="text" 
              class="setting-input" 
              placeholder="e.g. C:/Users/Documents" 
              bind:value={configService.config.defaultPath} 
            />
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">On Startup</span>
              <span class="setting-desc">Choose what to display when launching the app.</span>
            </div>
            <div class="option-switcher">
              {#each [
                { value: 'root', label: 'Root' },
                { value: 'home', label: 'Home' },
                { value: 'custom', label: 'Custom' }
              ] as opt}
                <button 
                  class="switcher-btn" 
                  class:active={configService.config.onStartup === opt.value} 
                  onclick={() => configService.config.onStartup = opt.value as StartupMode}
                >
                  {#if configService.config.onStartup === opt.value}
                    <div 
                      class="active-indicator" 
                      in:receive={{ key: 'onStartup' }}
                      out:send={{ key: 'onStartup' }}
                    ></div>
                  {/if}
                  <span class="btn-label">{opt.label}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Language</span>
              <span class="setting-desc">Select UI language.</span>
            </div>
            <div class="option-switcher">
              {#each [
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' }
              ] as opt}
                <button 
                  class="switcher-btn" 
                  class:active={configService.config.language === opt.value} 
                  onclick={() => configService.config.language = opt.value as Lang}
                >
                  {#if configService.config.language === opt.value}
                    <div 
                      class="active-indicator" 
                      in:receive={{ key: 'language' }}
                      out:send={{ key: 'language' }}
                    ></div>
                  {/if}
                  <span class="btn-label">{opt.label}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      {#if activeSection === 'appearance'}
        <div class="settings-section" transition:fade={{ duration: 150 }}>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Application Theme</span>
              <span class="setting-desc">Select the visual appearance mode.</span>
            </div>
            <div class="option-switcher">
              {#each [
                { value: 'system', label: 'System' },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' }
              ] as opt}
                <button 
                  class="switcher-btn" 
                  class:active={configService.config.defaultTheme === opt.value} 
                  onclick={() => configService.config.defaultTheme = opt.value as Theme}
                >
                  {#if configService.config.defaultTheme === opt.value}
                    <div 
                      class="active-indicator" 
                      in:receive={{ key: 'defaultTheme' }}
                      out:send={{ key: 'defaultTheme' }}
                    ></div>
                  {/if}
                  <span class="btn-label">{opt.label}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Accent Color</span>
              <span class="setting-desc">Choose the primary highlight color.</span>
            </div>
            <div class="color-palette">
              {#each accentColors as color}
                <button 
                  class="color-dot" 
                  style="background-color: {color}"
                  class:active={configService.config.defaultAccentColor === color}
                  onclick={() => configService.config.defaultAccentColor = color}
                  title={color}
                  aria-label="Select accent color {color}"
                >
                  {#if configService.config.defaultAccentColor === color}
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Default View Mode</span>
              <span class="setting-desc">Preferred view layout for directories.</span>
            </div>
            <div class="option-switcher">
              {#each [
                { value: 'list', label: 'List' },
                { value: 'grid', label: 'Grid' }
              ] as opt}
                <button 
                  class="switcher-btn" 
                  class:active={configService.config.defaultViewMode === opt.value} 
                  onclick={() => configService.config.defaultViewMode = opt.value as ViewMode}
                >
                  {#if configService.config.defaultViewMode === opt.value}
                    <div 
                      class="active-indicator" 
                      in:receive={{ key: 'defaultViewMode' }}
                      out:send={{ key: 'defaultViewMode' }}
                    ></div>
                  {/if}
                  <span class="btn-label">{opt.label}</span>
                </button>
              {/each}
            </div>
          </div>



          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Show Sidebar</span>
              <span class="setting-desc">Toggle the navigation panel visibility.</span>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={configService.config.showSidebar} />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Show File Extensions</span>
              <span class="setting-desc">Display extensions (.txt, .pdf) in names.</span>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={configService.config.showExtensions} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      {/if}

      {#if activeSection === 'behavior'}
        <div class="settings-section" transition:fade={{ duration: 150 }}>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Open Folder/File Mode</span>
              <span class="setting-desc">How to open elements in the explorer.</span>
            </div>
            <div class="option-switcher">
              {#each [
                { value: 'singleClick', label: 'Single Click' },
                { value: 'doubleClick', label: 'Double Click' }
              ] as opt}
                <button 
                  class="switcher-btn" 
                  class:active={configService.config.openMode === opt.value} 
                  onclick={() => configService.config.openMode = opt.value as OpenMode}
                >
                  {#if configService.config.openMode === opt.value}
                    <div 
                      class="active-indicator" 
                      in:receive={{ key: 'openMode' }}
                      out:send={{ key: 'openMode' }}
                    ></div>
                  {/if}
                  <span class="btn-label">{opt.label}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Show Hidden Files</span>
              <span class="setting-desc">Display files prefixed with a dot or hidden attribute.</span>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={configService.config.showHiddenFiles} />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Confirm Deletion</span>
              <span class="setting-desc">Ask for confirmation before deleting items.</span>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={configService.config.confirmDelete} />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Remember History</span>
              <span class="setting-desc">Keep track of back/forward navigation history.</span>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={configService.config.rememberHistory} />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Remember Recent Folders</span>
              <span class="setting-desc">Show recently visited paths in side bar.</span>
            </div>
            <label class="switch">
              <input type="checkbox" bind:checked={configService.config.rememberRecents} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      {/if}
    </div>
  </div>
</Modal>

{#snippet icon()}
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="title-icon">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
{/snippet}

<style>
  .title-icon {
    color: var(--accent);
  }

  .settings-container {
    display: flex;
    gap: 20px;
    height: 100%;
  }

  .settings-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 140px;
    border-right: 1px solid var(--border-color);
    padding-right: 12px;
    flex-shrink: 0;
  }

  .nav-tab {
    padding: 8px 12px;
    justify-content: flex-start;
    font-size: 0.9rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .nav-tab:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
  }

  .nav-tab.active {
    color: var(--accent);
    background-color: var(--bg-active);
    border-left: 3px solid var(--accent);
    font-weight: 600;
  }

  .settings-body {
    flex-grow: 1;
    overflow-y: auto;
    padding-right: 4px;
    height: 100%;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }

  .settings-section {
    grid-area: 1 / 1 / 2 / 2;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .setting-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-grow: 1;
    max-width: 60%;
  }

  .setting-label {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .setting-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.3;
  }

  .setting-input {
    width: 180px;
    font-size: 0.85rem;
    padding: 6px 10px;
  }

  /* Option Switcher (Button Segment Control) */
  .option-switcher {
    display: flex;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 3px;
    gap: 2px;
  }

  :root[data-theme="light"] .option-switcher {
    background: rgba(0, 0, 0, 0.03);
  }

  .switcher-btn {
    position: relative;
    padding: 5px 10px;
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: calc(var(--radius-md) - 3px);
    color: var(--text-secondary);
    transition: color var(--transition-fast);
    background: transparent;
    white-space: nowrap;
    z-index: 1;
  }

  .switcher-btn:not(.active):hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.02);
  }

  :root[data-theme="light"] .switcher-btn:not(.active):hover {
    background: rgba(0, 0, 0, 0.02);
  }

  .switcher-btn.active {
    color: white;
  }

  .active-indicator {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--accent);
    box-shadow: var(--shadow-sm);
    z-index: 1;
    border-radius: inherit;
  }

  .btn-label {
    position: relative;
    z-index: 2;
    pointer-events: none;
  }

  /* Toggle Switch */
  .switch {
    position: relative;
    display: inline-block;
    width: 42px;
    height: 22px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.08);
    transition: var(--transition-fast);
    border-radius: var(--radius-full);
    border: 1px solid var(--border-color);
  }

  :root[data-theme="light"] .slider {
    background-color: rgba(0, 0, 0, 0.06);
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: var(--text-secondary);
    transition: var(--transition-fast);
    border-radius: var(--radius-full);
  }

  input:checked + .slider {
    background-color: var(--accent);
    border-color: transparent;
  }

  input:checked + .slider:before {
    transform: translateX(20px);
    background-color: white;
  }

  /* Color Palette Picker */
  .color-palette {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-width: 180px;
    justify-content: flex-end;
  }

  .color-dot {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .color-dot:hover {
    transform: scale(1.1);
  }

  .color-dot.active {
    border-color: var(--text-primary);
    transform: scale(1.05);
  }
</style>

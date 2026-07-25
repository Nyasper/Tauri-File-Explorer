<script lang="ts">
  import Modal from './shared/Modal.svelte';
  import { globalShortcutsList } from '$lib/services/keybinding.service.svelte';
  let { isModalOpen = $bindable(false) } = $props();
</script>


<Modal title="Help & Shortcuts" {icon} bind:isOpen={isModalOpen}>
  <section class="section">
    <h3>Keyboard Shortcuts</h3>
    <div class="shortcuts-grid">
      {#each globalShortcutsList as shortcut, i (shortcut.key)}
        {#if i === 0 || shortcut.category !== globalShortcutsList[i - 1].category}
          {#if i > 0}
            <div class="category-separator"></div>
          {/if}
          <h4 class="category-title">{shortcut.category}</h4>
        {/if}
        <div class="shortcut-item">
          <span class="shortcut-desc">{shortcut.action}</span>
          <span>
            {#each shortcut.key.split(' + ') as part, index}
              {#if index > 0}
                {' + '}
              {/if}
              <kbd>{part}</kbd>
            {/each}
          </span>
        </div>
      {/each}
    </div>
  </section>

  <section class="section">
    <h3>About Native File Explorer</h3>
    <p>
      A high-performance cross-platform desktop file explorer built with Svelte 5 and Tauri v2.
      It features multi-tab navigation, directory caching, split-pane views, and asynchronous file operations.
    </p>
  </section>
</Modal>

{#snippet icon()}
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="title-icon">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
{/snippet}

<style>
  .title-icon {
    color: var(--accent);
  }

  .section {
    margin-bottom: 24px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section h3 {
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    margin-top: 0;
    margin-bottom: 12px;
    letter-spacing: 0.02em;
  }

  .section p {
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }

  .shortcuts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  .category-separator {
    grid-column: 1 / -1;
    height: 1px;
    background: var(--border-color);
    margin: 12px 0 6px 0;
    opacity: 0.35;
  }

  .category-title {
    grid-column: 1 / -1;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    margin: 6px 0 2px 0;
    font-weight: 600;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
  }

  .shortcut-desc {
    color: var(--text-secondary);
  }

  kbd {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    font-family: monospace;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
  }
</style>
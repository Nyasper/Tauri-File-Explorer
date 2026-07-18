<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';

  interface Props {
    isOpen?: boolean;
    title: string;
    icon?: Snippet;
    /** 'default' keeps the large settings/help layout; 'compact' is a small dialog box. */
    size?: 'default' | 'compact';
    children?: Snippet;
  }

  let {
    isOpen = $bindable(false),
    title,
    icon,
    size = 'default',
    children
  }: Props = $props();

  function closeModal() {
    isOpen = false;
  }

  // Handle closing when clicking outside modal content
  function handleClickOutside(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }

</script>

{#if isOpen}
  <div class="modal-overlay" onclick={handleClickOutside} transition:fade={{ duration: 220 }}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" class:compact={size === 'compact'} onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title">
          {#if icon}
            {@render icon()}
          {/if}
          <h2>{title}</h2>
        </div>
        <button class="close-btn" onclick={closeModal} aria-label="Close modal">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-content">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: var(--glass-blur);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn var(--transition-fast) ease-out;
  }

  .modal-container {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: 85vw;
    max-width: 800px;
    height: 75vh;
    max-height: 650px;
    min-height: 450px;
    box-shadow: var(--shadow-glass);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: scaleUp var(--transition-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Compact variant for small dialogs (alert / confirm / prompt) */
  .modal-container.compact {
    width: 90vw;
    min-width: 340px;
    max-width: 440px;
    height: auto;
    min-height: 0;
    max-height: 80vh;
  }

  .modal-container.compact .modal-content {
    padding: 16px 20px 20px 20px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    background: rgba(255, 255, 255, 0.02);
    flex-shrink: 0;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-primary);
  }

  .modal-title :global(h2) {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-content {
    padding: 20px;
    flex-grow: 1;
    overflow-y: auto;
    color: var(--text-secondary);
    font-family: var(--font-body);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleUp {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>

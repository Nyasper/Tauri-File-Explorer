<script lang="ts">
  import { contextMenu } from '$lib/services/context-menu.service.svelte';
  import { fade } from 'svelte/transition';
  import { tick } from 'svelte';

  let menuEl = $state<HTMLDivElement | null>(null);
  let adjustedX = $state(0);
  let adjustedY = $state(0);

  // Re-calculate menu boundaries to avoid screen overflow
  $effect(() => {
    if (contextMenu.isOpen && menuEl) {
      // Wait for DOM layout to get accurate element bounds
      tick().then(() => {
        if (!menuEl) return;
        const rect = menuEl.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        // If it overflows right, shift left
        adjustedX = contextMenu.position.x + rect.width > winWidth
          ? winWidth - rect.width - 8
          : contextMenu.position.x;

        // If it overflows bottom, shift up
        adjustedY = contextMenu.position.y + rect.height > winHeight
          ? winHeight - rect.height - 8
          : contextMenu.position.y;

        // Prevent negative values (off-screen top/left)
        if (adjustedX < 8) adjustedX = 8;
        if (adjustedY < 8) adjustedY = 8;
      });
    }
  });
</script>

{#if contextMenu.isOpen}
  <!-- Global click interceptor overlay -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="context-menu-overlay" onclick={contextMenu.close}>
    <div
      bind:this={menuEl}
      class="context-menu"
      style="left: {adjustedX}px; top: {adjustedY}px;"
      transition:fade={{ duration: 100 }}
      role="menu"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      {#each contextMenu.items as item}
        {#if item.isSeparator}
          <div class="menu-separator"></div>
        {:else}
          <button
            class="menu-item"
            class:disabled={item.disabled}
            onclick={() => {
              if (!item.disabled) {
                item.action();
                contextMenu.close();
              }
            }}
            disabled={item.disabled}
            role="menuitem"
          >
            <div class="menu-item-content">
              {#if item.icon}
                <span class="menu-icon">{@html item.icon}</span>
              {/if}
              <span class="menu-label">{item.label}</span>
            </div>
            {#if item.shortcut}
              <span class="menu-shortcut">{item.shortcut}</span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .context-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99999;
    background: transparent;
    pointer-events: auto;
  }

  .context-menu {
    position: absolute;
    min-width: 190px;
    background: rgba(28, 28, 30, 0.85);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.2);
    user-select: none;
    outline: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .menu-item {
    width: 100%;
    background: none;
    border: none;
    color: #e2e2e7;
    padding: 7px 10px;
    text-align: left;
    font-size: 13px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.12s ease, color 0.12s ease;
    font-family: inherit;
    outline: none;
  }

  .menu-item:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .menu-item:active:not(.disabled) {
    background: rgba(255, 255, 255, 0.12);
  }

  .menu-item.disabled {
    color: #636366;
    cursor: not-allowed;
  }

  .menu-item-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .menu-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    opacity: 0.85;
    color: inherit;
  }

  .menu-item:hover:not(.disabled) .menu-icon {
    opacity: 1;
  }

  .menu-label {
    font-weight: 500;
  }

  .menu-shortcut {
    font-size: 11px;
    color: #8e8e93;
    font-family: monospace, sans-serif;
  }

  .menu-separator {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 4px 6px;
  }
</style>

<script lang="ts">
  import '../app.css';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import { contextMenu } from '$lib/services/context-menu.service.svelte';

  $inspect("context Menu", contextMenu.items.map(i=> i.label).join(', '));
  let { children } = $props();

  // Disable default browser context menu globally for a native desktop feel
  $effect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  });
  
</script>

<div class="app-container animate-fade-in">
  {@render children()}
  <ContextMenu />
</div>

<style>
  .app-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }
</style>

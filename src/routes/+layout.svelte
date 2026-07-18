<script lang="ts">
  import '../app.css';
  import ContextMenu from '$lib/components/ContextMenu.svelte';

  let { children } = $props();

  // Disable default browser context menu globally
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

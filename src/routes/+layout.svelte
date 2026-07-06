<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<div class="app-container animate-fade-in">

  {@render children()}
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

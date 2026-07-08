<script lang="ts">
  import { slide } from 'svelte/transition';

  // Svelte 5 Props using runes
  let {
    data,
    title = 'State Debugger',
    position = 'top-left'
  }: {
    data: any;
    title?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  } = $props();
  let serialized = $derived(data);
  let isCollapsed = $state(false);

  // Safe stringification to handle functions, circular references, and clean up SVG icons
  // const serialized = $derived.by(() => {
  //   if (typeof data === 'string') return data;
  //   try {
  //     const seen = new WeakSet();
  //     return JSON.stringify(data, (key, value) => {
  //       if (typeof value === 'function') {
  //         return '[Function]';
  //       }
  //       if (typeof value === 'object' && value !== null) {
  //         if (seen.has(value)) {
  //           return '[Circular]';
  //         }
  //         seen.add(value);
  //       }
  //       // Simplify SVG strings in debug view to keep it readable
  //       if (key === 'icon' && typeof value === 'string' && value.includes('<svg')) {
  //         return '[SVG Icon]';
  //       }
  //       return value;
  //     }, 2);
  //   } catch (err) {
  //     return `[Serialization Error: ${(err as Error).message}]`;
  //   }
  // });
</script>

<div class="debug-panel {position}" aria-label="Debugger Panel">
  <div class="debug-header">
    <span class="debug-title">{title}</span>
    <button 
      class="collapse-btn" 
      onclick={() => isCollapsed = !isCollapsed}
      aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
    >
      {isCollapsed ? '[+]' : '[-]'}
    </button>
  </div>
  
  {#if !isCollapsed}
    <div class="debug-content" transition:slide={{ duration: 150 }}>
      <pre class="debug-pre"><code>{serialized}</code></pre>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    position: fixed;
    z-index: 999999; /* Higher than normal menus but below tooltips if needed */
    background: rgba(15, 15, 20, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    width: 280px;
    max-height: 350px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
    font-family: 'Courier New', Courier, monospace;
    transition: all 0.2s ease;
  }

  /* Positions */
  .top-left {
    top: 12px;
    left: 12px;
  }

  .top-right {
    top: 12px;
    right: 12px;
  }

  .bottom-left {
    bottom: 12px;
    left: 12px;
  }

  .bottom-right {
    bottom: 12px;
    right: 12px;
  }

  .debug-header {
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .debug-title {
    font-size: 11px;
    font-weight: bold;
    color: #8e8e93;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .collapse-btn {
    background: none;
    border: none;
    color: #30d158;
    font-size: 11px;
    cursor: pointer;
    padding: 2px 4px;
    font-family: inherit;
  }

  .collapse-btn:hover {
    color: #ff9f0a;
  }

  .debug-content {
    overflow: auto;
    flex-grow: 1;
    padding: 8px;
  }

  .debug-pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .debug-pre code {
    color: #30d158; /* iOS system green color */
    font-size: 11px;
    line-height: 1.4;
  }
</style>

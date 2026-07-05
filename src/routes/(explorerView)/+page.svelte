<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { explorerState } from '$lib/state/explorer.svelte';

  import TabBar from '$lib/components/TabBar.svelte';
  import ExplorerView from '$lib/components/ExplorerView.svelte';

  let unlistenFolderSize: (() => void) | undefined;

  onMount(async () => {
    // Set up Tauri listener for asynchronous background size computations
    try {
      unlistenFolderSize = await listen<{ path: string; size: number }>(
        'folder-size-calculated', 
        (event) => {
          const { path, size } = event.payload;
          explorerState.updateFolderSize(path, size);
        }
      );
    } catch (err) {
      console.warn('Tauri event listener failed to bind. Running in browser fallback.', err);
    }
  });

  onDestroy(() => {
    if (unlistenFolderSize) {
      unlistenFolderSize();
    }
  });
</script>

<!-- Tabs Navigation Area -->
<TabBar />

<!-- Main Explorer Pane Area -->
<ExplorerView />

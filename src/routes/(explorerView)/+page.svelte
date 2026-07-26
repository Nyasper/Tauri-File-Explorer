<script lang="ts">
  import TabBar from '$lib/components/TabBar.svelte';
  import ExplorerView from '$lib/components/ExplorerView.svelte';
  import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
  import DialogHost from '$lib/components/shared/DialogHost.svelte';
  import { explorerState } from '$lib/state/explorer.state.svelte';
</script>

<!-- Tabs Navigation Area -->
<TabBar />

<!-- Main Explorer Pane Area -->
<ExplorerView />

<!-- Welcome screen overlay (startup mode "welcome" / Ctrl+N) -->
{#if explorerState.isWelcomeOpen}
  <WelcomeScreen />
{/if}

<!-- Global alert / confirm / prompt dialogs -->
<DialogHost />

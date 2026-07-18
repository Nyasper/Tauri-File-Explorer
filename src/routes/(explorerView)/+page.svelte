<script lang="ts">
  import TabBar from '$lib/components/TabBar.svelte';
  import ExplorerView from '$lib/components/ExplorerView.svelte';
  import DialogHost from '$lib/components/shared/DialogHost.svelte';
</script>

<!-- Tabs Navigation Area -->
<TabBar />

<!-- Main Explorer Pane Area -->
<ExplorerView />

<!-- Global alert / confirm / prompt dialogs -->
<DialogHost />

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { useKeybindingService } from '$lib/services/keybinding.service.svelte';

    // Enable keyboard shortcuts in the explorer view only
    useKeybindingService();

    let { children }: { children: Snippet } = $props();
</script>

{@render children()}
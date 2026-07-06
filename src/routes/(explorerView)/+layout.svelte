<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { LayoutData } from './$types';
    import { useKeybindingService } from '$lib/services/keybinding.service.svelte';

    // Enable keyboard shortcuts in the explorer view only
    useKeybindingService();

    let { children }: { children: Snippet; data: LayoutData } = $props();
</script>

{@render children()}
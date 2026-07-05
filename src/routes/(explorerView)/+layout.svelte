<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { LayoutData } from './$types';
    import { useKeybindingService } from '$lib/services/keybinding.service.svelte';
    import { ThemeService } from '$lib/services/theme.service.svelte';

    useKeybindingService();
    const themeService = new ThemeService();

    let { children }: { children: Snippet; data: LayoutData } = $props();
</script>

{@render children()}
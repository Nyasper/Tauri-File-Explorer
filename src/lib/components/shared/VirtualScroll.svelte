<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  /**
   * Generic virtualized scroll container (Svelte 5 / runes).
   *
   * Renders only the visible slice of `items` plus an overscan buffer, no
   * matter how large the full list is. Based on the reference in
   * examples/Virtual List/VirtualList.svelte, adapted to dynamic flex-sized
   * containers through Svelte dimension bindings instead of a fixed height.
   *
   * The parent owns the markup through the `children` snippet, which receives
   * the visible slice plus the pixel paddings that simulate the full scroll
   * height. The container applies no styles of its own: the parent must pass
   * a `class` with `overflow-y: auto` (and any desired sizing).
   */

  interface VirtualSlice<T> {
    visibleItems: T[];
    startIndex: number;
    endIndex: number;
    topPad: number;
    bottomPad: number;
    totalHeight: number;
  }

  let {
    items,
    itemHeight,
    buffer = 6,
    resetKey = undefined,
    viewportWidth = $bindable(0),
    viewportHeight = $bindable(0),
    class: className = '',
    children,
    ...restProps
  }: {
    items: T[];
    /** Exact rendered height of each item in px (must be constant). */
    itemHeight: number;
    /** Extra items rendered above/below the viewport to avoid blank flashes. */
    buffer?: number;
    /** Scroll resets to top when this value changes identity. Defaults to `items`. */
    resetKey?: unknown;
    viewportWidth?: number;
    viewportHeight?: number;
    class?: string;
    children: Snippet<[VirtualSlice<T>]>;
    [key: string]: unknown;
  } = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);

  // How many rows fit in the viewport
  const visibleCount = $derived(Math.ceil(viewportHeight / itemHeight));

  // Start/end indices of the range to render
  const startIndex = $derived(
    Math.max(0, Math.floor(scrollTop / itemHeight) - buffer)
  );
  const endIndex = $derived(
    Math.min(items.length, startIndex + visibleCount + buffer * 2)
  );

  // Slice of items actually rendered
  const visibleItems = $derived(items.slice(startIndex, endIndex));

  // Fake total height so the scrollbar behaves as if every item existed
  const totalHeight = $derived(items.length * itemHeight);

  // Spacer heights that keep rendered rows at their real scroll position
  const topPad = $derived(startIndex * itemHeight);
  const bottomPad = $derived(Math.max(0, (items.length - endIndex) * itemHeight));

  // Reset scroll to top when the reset key changes identity (navigation,
  // refresh, new search results...). Reads `items` when no key is provided,
  // so identity changes of the array itself trigger the reset by default.
  let prevResetKey: unknown;
  let resetInitialized = false;
  $effect(() => {
    const key = resetKey === undefined ? items : resetKey;
    if (!resetInitialized) {
      resetInitialized = true;
      prevResetKey = key;
      return;
    }
    if (key !== prevResetKey) {
      prevResetKey = key;
      scrollTop = 0;
      if (containerEl) containerEl.scrollTop = 0;
    }
  });

  // rAF-throttled scroll handler: fast scrolling fires events more often than
  // frames render, so updates are coalesced into one per frame.
  let rafId = 0;
  let pendingScrollTop = 0;

  function handleScroll(e: Event) {
    pendingScrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      scrollTop = pendingScrollTop;
      rafId = 0;
    });
  }

  $effect(() => {
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  });
</script>

<div
  bind:this={containerEl}
  bind:clientWidth={viewportWidth}
  bind:clientHeight={viewportHeight}
  class={className}
  onscroll={handleScroll}
  {...restProps}
>
  {@render children({ visibleItems, startIndex, endIndex, topPad, bottomPad, totalHeight })}
</div>

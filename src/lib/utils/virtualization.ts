/**
 * Shared constants and helpers for the virtualized entry views.
 *
 * The pixel constants below MUST stay in sync with the CSS variables
 * defined in `src/app.css` (--list-row-height, --grid-item-height,
 * --grid-gap). The virtual scroll math assumes every rendered row has
 * exactly these heights; any drift breaks scrollbar positioning.
 */

/** Exact rendered height of a row in the list view (px). See --list-row-height. */
export const LIST_ROW_HEIGHT = 40;

/** Exact rendered height of an item in the grid view (px). See --grid-item-height. */
export const GRID_ITEM_HEIGHT = 128;

/** Gap between grid items/rows (px). See --grid-gap. */
export const GRID_GAP = 12;

/** Minimum width of a grid item; drives the columns-per-row computation. */
export const GRID_MIN_ITEM_WIDTH = 100;

/** Horizontal padding of the grid scroll container (px per side). */
export const GRID_CONTAINER_PADDING = 16;

/** Splits a flat array into row-sized chunks for the virtualized grid view. */
export function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length > 0 ? [items] : [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

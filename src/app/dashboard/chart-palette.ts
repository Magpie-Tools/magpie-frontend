import {CHART_SERIES_COLOR} from './dashboard-charts';

/**
 * Categorical colours for identity (which judge, which series), stepped for the dark
 * Console surface. The order is fixed: it keeps neighbouring slots apart for colour-blind
 * readers (worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.3, all ≥ 3:1 on the panel).
 * Re-validate the whole list before changing a value or the order.
 */
export const CATEGORICAL_COLORS = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
] as const;

/** Neutral for anything past the last categorical slot. */
export const OTHER_COLOR = 'var(--reputation-unknown, #8e959e)';

/**
 * Assigns colours by name order so an entity keeps its colour while counts change.
 * A single entity is one series, so it takes the theme's series colour instead.
 */
export function categoricalColors(keys: readonly string[]): Map<string, string> {
  const sorted = [...new Set(keys)].sort((a, b) => a.localeCompare(b));
  if (sorted.length === 1) return new Map([[sorted[0], CHART_SERIES_COLOR]]);
  return new Map(sorted.map((key, index) => [key, CATEGORICAL_COLORS[index] ?? OTHER_COLOR]));
}

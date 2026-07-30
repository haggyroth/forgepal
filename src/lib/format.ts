/** Small display formatters shared across components. */

/**
 * Render a duration in hours the way a player reads it.
 *
 * Upstream records expedition durations as fractional hours (0.5, 0.75, 2).
 */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (Number.isInteger(hours)) return `${hours}h`
  return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`
}

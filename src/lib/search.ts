/**
 * Item browsing: search, filter, and rank.
 *
 * The dataset is ~1,320 entries, small enough to scan on every keystroke and
 * far too many to render at once. Filtering happens here; the caller decides
 * how many results to draw.
 */

import type { Item, ItemCategory, ItemId, Structure } from '@/types/game'

export type Entry = Item | Structure

export interface SearchFilters {
  query: string
  /** Empty means "no category filter", not "match nothing". */
  categories: ReadonlySet<ItemCategory>
  /** Hide entries with no recipe — usually what you want when planning a build. */
  craftableOnly: boolean
  /** Station id to restrict to, or null for any station. */
  stationId: ItemId | null
  /**
   * Hide entries gated above this level. Null disables the filter entirely.
   * Entries with no `techLevel` are never hidden — they aren't gated at all.
   */
  maxTechLevel: number | null
}

export const emptyFilters: SearchFilters = {
  query: '',
  categories: new Set(),
  craftableOnly: true,
  stationId: null,
  maxTechLevel: null,
}

/**
 * Score a name against a query. Higher is better; 0 means no match.
 *
 * Ranking matters more than it looks here: typing "sphere" should surface
 * "Mega Sphere" ahead of "Sphere Workbench Blueprint", and an exact "ore"
 * must not be buried under "Ore Excavator" and friends.
 */
export function scoreMatch(name: string, query: string): number {
  if (!query) return 1

  const n = name.toLowerCase()
  const q = query.toLowerCase()

  if (n === q) return 1000
  if (n.startsWith(q)) return 500 - n.length
  // Word-boundary hit, e.g. "sphere" in "Mega Sphere".
  if (new RegExp(`\\b${escapeRegExp(q)}`).test(n)) return 300 - n.length
  if (n.includes(q)) return 100 - n.length

  // Subsequence fallback so "megsph" still finds "Mega Sphere".
  let cursor = 0
  for (const char of q) {
    cursor = n.indexOf(char, cursor)
    if (cursor === -1) return 0
    cursor += 1
  }
  return 10
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface SearchResult {
  /** Ranked matches, capped at `limit`. */
  results: Entry[]
  /** How many matched in total, before the cap. */
  total: number
}

export function searchEntries(
  entries: readonly Entry[],
  filters: SearchFilters,
  limit = 60,
): SearchResult {
  const query = filters.query.trim()
  const scored: { entry: Entry; score: number }[] = []

  for (const entry of entries) {
    if (filters.craftableOnly && !entry.recipe) continue
    if (filters.categories.size > 0 && !filters.categories.has(entry.category)) continue
    if (filters.stationId && entry.recipe?.stationId !== filters.stationId) continue
    // An ungated entry (null techLevel) is always available, so it survives the
    // level filter rather than being treated as level 0 or excluded.
    if (
      filters.maxTechLevel !== null &&
      entry.techLevel !== null &&
      entry.techLevel > filters.maxTechLevel
    ) {
      continue
    }

    const score = scoreMatch(entry.name, query)
    if (score > 0) scored.push({ entry, score })
  }

  scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))

  return {
    results: scored.slice(0, limit).map((s) => s.entry),
    total: scored.length,
  }
}

/** Categories present in the data, ordered for display with the useful ones first. */
const CATEGORY_ORDER: ItemCategory[] = [
  'structure',
  'sphere',
  'weapon',
  'armor',
  'accessory',
  'ammo',
  'material',
  'ingredient',
  'consumable',
  'medicine',
  'technology',
  'key_item',
  'other',
]

export function orderedCategories(entries: readonly Entry[]): ItemCategory[] {
  const present = new Set(entries.map((e) => e.category))
  return CATEGORY_ORDER.filter((c) => present.has(c))
}

const CATEGORY_LABELS: Partial<Record<ItemCategory, string>> = {
  key_item: 'Key Item',
}

export function categoryLabel(category: ItemCategory): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1)
}

/**
 * Curated corrections applied on top of imported data.
 *
 * Upstream data is scraped, and scraping loses information. This file is the
 * one place where we knowingly disagree with upstream. Every entry must say
 * *why* — an override with no rationale is indistinguishable from a bug.
 *
 * Keep this file small. If it starts growing, that is a signal the source
 * adapter is wrong, not that we need more patches.
 */

import type { Recipe, SourceKind } from '../../src/types/game.ts'
import { toId } from '../../src/lib/id.ts'

/**
 * Materials the calculator must never expand, because players obtain them from
 * the world rather than a workbench.
 *
 * Heuristics alone get this wrong: Ore lists "Dropped by Digtoise" and would be
 * classified as a drop, when in practice it is mined. An explicit list beats a
 * clever rule here — there are only a few dozen base resources in the game.
 */
export const GATHERED_MATERIALS: readonly string[] = [
  'Wood',
  'Stone',
  'Ore',
  'Coal',
  'Sulfur',
  'Quartz',
  'Fiber',
  'Paldium Fragment',
  'Red Berries',
  'Wheat',
  'Lettuce',
  'Tomato',
  'Berry Seeds',
  'Wheat Seeds',
  'Lettuce Seeds',
  'Tomato Seeds',
  'Mushroom',
  'Sulfuric Acid Bottle',
]

/** Force a specific classification, overriding whatever the heuristics decide. */
export const SOURCE_KIND_OVERRIDES: Record<string, SourceKind> = {
  /*
   * Upstream gives Paldium Fragment a "recipe" that is really the Crusher's
   * full input menu flattened into one AND-list: Stone x5 AND Ore x2 AND one
   * of every Sphere. That is wrong twice over — the Crusher accepts any ONE of
   * those, and treating Spheres as inputs creates a recipe cycle
   * (Mega Sphere -> Paldium Fragment -> Mega Sphere).
   *
   * Every cycle in the upstream graph traces back to this single entry.
   *
   * We classify it as gathered, which is also how players actually get it
   * (mining the blue nodes), and preserve the real Crusher conversions as
   * alternatives below.
   */
  'Paldium Fragment': 'gathered',

  /*
   * Pal Souls convert in both directions at the Crusher (2 Small -> 1 Medium,
   * and 1 Medium -> 2 Small), and upstream flattens each pair into one
   * AND-list. Small Pal Soul is the base unit players actually farm from Pals,
   * so we treat it as a drop and keep only the upgrade direction below.
   */
  'Small Pal Soul': 'drop',
}

/** Build a Crusher recipe in the soul-upgrade direction. */
function soulUpgrade(fromName: string, quantity: number): Recipe {
  return {
    stationId: toId('Crusher'),
    stationName: 'Crusher',
    alternativeStationNames: ['Refrigerated Crusher'],
    inputs: [{ itemId: toId(fromName), name: fromName, quantity }],
    yield: 1,
  }
}

/** Recipes we replace outright. Keyed by item name. */
export const RECIPE_OVERRIDES: Record<string, Recipe | null> = {
  // See the rationale in SOURCE_KIND_OVERRIDES: no primary recipe, so the
  // calculator stops here instead of expanding a fabricated AND-list.
  'Paldium Fragment': null,

  // Souls: keep only the upgrade direction so the graph stays acyclic. The
  // downgrade conversions are preserved as alternatives below.
  'Small Pal Soul': null,
  'Medium Pal Soul': soulUpgrade('Small Pal Soul', 2),
  'Large Pal Soul': soulUpgrade('Medium Pal Soul', 2),
  'Giant Pal Soul': soulUpgrade('Large Pal Soul', 2),
}

/** Extra recipes to attach as alternatives, recorded but not yet used in expansion. */
export const ALTERNATIVE_RECIPES: Record<string, Recipe[]> = {
  'Paldium Fragment': [
    crusher([{ name: 'Stone', quantity: 5 }], 1),
    crusher([{ name: 'Ore', quantity: 2 }], 1),
  ],
  // Downgrade conversions, split back out of the flattened upstream lists.
  'Small Pal Soul': [crusher([{ name: 'Medium Pal Soul', quantity: 1 }], 2)],
  'Medium Pal Soul': [crusher([{ name: 'Large Pal Soul', quantity: 1 }], 2)],
  'Large Pal Soul': [crusher([{ name: 'Giant Pal Soul', quantity: 1 }], 2)],
}

function crusher(materials: { name: string; quantity: number }[], batchYield: number): Recipe {
  return {
    stationId: toId('Crusher'),
    stationName: 'Crusher',
    alternativeStationNames: ['Refrigerated Crusher'],
    inputs: materials.map((m) => ({ itemId: toId(m.name), name: m.name, quantity: m.quantity })),
    yield: batchYield,
  }
}

/**
 * Batch yields the importer could not read from upstream `notes`.
 *
 * Most batch recipes are parsed automatically from the "Crafts xN per batch"
 * note (see `parseBatchYield` in normalize.ts), so this table should stay
 * nearly empty. Add an entry only when a yield is known to be wrong or missing
 * upstream — and cite where the number came from.
 */
export const RECIPE_YIELDS: Record<string, number> = {}

/** Names in GATHERED_MATERIALS, pre-resolved to ids for fast lookup. */
export const GATHERED_IDS = new Set(GATHERED_MATERIALS.map(toId))

/**
 * Translate the upstream shape into ForgePal's normalized schema.
 *
 * Everything source-specific stops here. Downstream code only ever sees the
 * types in `src/types/game.ts`.
 */

import type {
  DropSource,
  GameData,
  Item,
  ItemCategory,
  Recipe,
  RecipeInput,
  SourceKind,
  Station,
  Structure,
  WorkSuitability,
} from '../../src/types/game.ts'
import { toId } from '../../src/lib/id.ts'
import type { RawDataset, RawItem, RawRecipe, RawStructure } from './sources/palworld-kb.ts'
import {
  ALTERNATIVE_RECIPES,
  GATHERED_IDS,
  RECIPE_OVERRIDES,
  RECIPE_YIELDS,
  SOURCE_KIND_OVERRIDES,
} from './overrides.ts'

const KNOWN_CATEGORIES = new Set<ItemCategory>([
  'material',
  'ingredient',
  'consumable',
  'medicine',
  'weapon',
  'armor',
  'accessory',
  'ammo',
  'sphere',
  'structure',
  'key_item',
  'technology',
  'other',
])

const KNOWN_WORK: ReadonlySet<string> = new Set<WorkSuitability>([
  'Kindling',
  'Watering',
  'Planting',
  'Generating Electricity',
  'Handiwork',
  'Gathering',
  'Lumbering',
  'Mining',
  'Medicine Production',
  'Cooling',
  'Transporting',
  'Farming',
])

function toCategory(raw: string): ItemCategory {
  const c = raw.toLowerCase() as ItemCategory
  return KNOWN_CATEGORIES.has(c) ? c : 'other'
}

function toWorkSuitability(raw: string | null): WorkSuitability | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return KNOWN_WORK.has(trimmed) ? (trimmed as WorkSuitability) : null
}

/**
 * Parse an upstream drop line into structured data.
 *
 * Upstream format, with both quantity and chance optional:
 *   "Dropped by Digtoise x2–3 (100%)"
 *   "Dropped by Melpaca (100%)"
 *
 * Note the en-dash: upstream uses U+2013, not a hyphen. Returns null for lines
 * that are not drops (merchant sales, chest finds, gathering notes) so the
 * caller can file them under `otherSources` instead.
 */
export function parseDropLine(line: string): DropSource | null {
  const match = /^Dropped by (.+?)(?:\s+x(\d+)(?:[–\-—](\d+))?)?\s*\((\d+(?:\.\d+)?)%\)\s*$/.exec(
    line,
  )
  if (!match) return null

  const [, source, minRaw, maxRaw, chanceRaw] = match
  const min = minRaw ? Number(minRaw) : 1
  const max = maxRaw ? Number(maxRaw) : min

  return {
    source: source.trim(),
    quantity: [min, max],
    chance: Number(chanceRaw) / 100,
  }
}

/**
 * Phrases that indicate a material is harvested from the world rather than dropped.
 *
 * These are matched against free-text prose, so they must be specific enough not
 * to collide with unrelated vocabulary. 'farm' was previously in this list and
 * matched "Ranch: Flambelle (Farming)" — where "Farming" is a Pal *work
 * suitability*, not a gathering verb — which misfiled two Pal drops as gathered.
 */
const GATHERING_HINTS = [
  'chopping',
  'mining',
  'gathering',
  'ground pickup',
  'pickup',
  'node',
  'harvest',
]

function looksGathered(obtainedFrom: readonly string[]): boolean {
  return obtainedFrom.some((line) => {
    const l = line.toLowerCase()
    return GATHERING_HINTS.some((hint) => l.includes(hint))
  })
}

/**
 * Decide how the calculator should treat this entry.
 *
 * Order is by strength of evidence, strongest first:
 *   1. an explicit override
 *   2. the curated gathered list — beats drops on purpose, since Ore and Coal
 *      both have drop tables but are mined in practice
 *   3. a real recipe
 *   4. structured drop data — dozens of parsed Pal sources is hard evidence
 *   5. prose hints — the weakest signal, and last for that reason
 *
 * Steps 4 and 5 used to be the other way round, which let one stray phrase
 * outvote 45 parsed drop entries. Anything we cannot place becomes
 * `unobtainable` so it surfaces in the UI as a known gap rather than silently
 * costing zero.
 */
export function classify(
  name: string,
  recipe: Recipe | null,
  obtainedFrom: readonly string[],
  drops: readonly DropSource[],
): SourceKind {
  const override = SOURCE_KIND_OVERRIDES[name]
  if (override) return override

  if (GATHERED_IDS.has(toId(name))) return 'gathered'
  if (recipe) return 'craftable'
  if (drops.length > 0) return 'drop'
  if (looksGathered(obtainedFrom)) return 'gathered'
  return 'unobtainable'
}

/**
 * Pull the batch size out of an upstream note.
 *
 * Upstream has no yield field, but records it in prose: "Crafts x10 per batch".
 * Ammo and baits are the common cases — costing Arrow as 1-per-craft would
 * overstate its materials tenfold.
 */
export function parseBatchYield(notes: string | undefined): number | null {
  if (!notes) return null
  const match = /Crafts x(\d+) per batch/.exec(notes)
  return match ? Number(match[1]) : null
}

/**
 * Pull higher-tier stations out of an upstream note.
 *
 * "Also craftable at: Improved Furnace, Electric Furnace" — useful because
 * `recipe.station` upstream is only ever the lowest-tier option.
 */
export function parseAlternativeStations(notes: string | undefined): string[] {
  if (!notes) return []
  const match = /Also craftable at:\s*([^;]+)/.exec(notes)
  if (!match) return []
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function toRecipe(raw: RawRecipe | null, itemName: string, notes: string | undefined): Recipe | null {
  if (!raw) return null

  const inputs: RecipeInput[] = Object.entries(raw.materials).map(([name, quantity]) => ({
    itemId: toId(name),
    name,
    quantity,
  }))

  if (inputs.length === 0) return null

  return {
    stationId: raw.station ? toId(raw.station) : null,
    stationName: raw.station,
    alternativeStationNames: parseAlternativeStations(notes),
    inputs,
    yield: RECIPE_YIELDS[itemName] ?? parseBatchYield(notes) ?? 1,
  }
}

function normalizeItem(raw: RawItem): Item {
  const obtainedFrom = raw.obtained_from ?? []
  const drops: DropSource[] = []
  const otherSources: string[] = []

  for (const line of obtainedFrom) {
    const drop = parseDropLine(line)
    if (drop) drops.push(drop)
    else otherSources.push(line)
  }

  const recipe =
    raw.name in RECIPE_OVERRIDES
      ? RECIPE_OVERRIDES[raw.name]
      : toRecipe(raw.recipe, raw.name, raw.notes)

  return {
    id: toId(raw.name),
    name: raw.name,
    category: toCategory(raw.category),
    sourceKind: classify(raw.name, recipe, obtainedFrom, drops),
    techLevel: raw.tech_level ?? null,
    recipe,
    alternativeRecipes: ALTERNATIVE_RECIPES[raw.name] ?? [],
    drops,
    otherSources,
  }
}

function normalizeStructure(raw: RawStructure): Structure {
  const inputs: RecipeInput[] = Object.entries(raw.materials).map(([name, quantity]) => ({
    itemId: toId(name),
    name,
    quantity,
  }))

  // Structures are built directly from the build menu, so they have no crafting
  // station of their own — the materials are placed, not crafted at a bench.
  const recipe: Recipe | null =
    inputs.length > 0
      ? {
          stationId: null,
          stationName: null,
          alternativeStationNames: [],
          inputs,
          yield: 1,
        }
      : null

  return {
    id: toId(raw.name),
    name: raw.name,
    category: 'structure',
    sourceKind: recipe ? 'craftable' : 'unobtainable',
    techLevel: raw.tech_level ?? null,
    recipe,
    alternativeRecipes: [],
    drops: [],
    otherSources: [],
    workSuitability: toWorkSuitability(raw.workers),
    requiresPower: raw.power,
    description: raw.function,
    ancientTech: raw.ancient_tech,
  }
}

export function normalize(dataset: RawDataset): GameData {
  const items = dataset.items.items.map(normalizeItem)
  const structures = dataset.building.structures.map(normalizeStructure)

  // A station's work suitability lives on the structure of the same name, not
  // on the station record — join them so the UI can show "needs a Kindling Pal"
  // straight off the recipe.
  const structuresByName = new Map(structures.map((s) => [s.name, s]))

  const stations: Station[] = dataset.items.stations.map((raw) => ({
    id: toId(raw.name),
    name: raw.name,
    crafts: raw.crafts,
    techLevel: raw.tech_level ?? null,
    workSuitability: structuresByName.get(raw.name)?.workSuitability ?? null,
  }))

  const sources = [
    ...(dataset.items.sources ?? []),
    ...(dataset.building.sources ?? []),
  ].map((s) => `${s.url} — ${s.what} (fetched ${s.fetched})`)

  return {
    meta: {
      gameVersion: dataset.items.game_version,
      updated: dataset.items.updated,
      importedAt: new Date().toISOString(),
      sources: [...new Set(sources)],
      gaps: [...(dataset.items.gaps ?? []), ...(dataset.building.gaps ?? [])],
    },
    items,
    structures,
    stations,
  }
}

/**
 * Farming route.
 *
 * Inverts the requisition: instead of "what do I need", answer "where do I go".
 * Materials are grouped by the map region where the Pals that drop them live,
 * so a shopping list becomes an itinerary.
 *
 * This only works because the build list exists — it is the one thing here that
 * a reference site can't reproduce, since it starts from *your* list rather than
 * from an item page.
 */

import type { CalculationResult, GameIndex, MaterialTotal } from './calculator'
import type { DropSource, GameData, ItemId, PalHabitat } from '@/types/game'

/**
 * How many drop sources per material feed the route.
 *
 * Some materials have 40+ sources spread across 30 regions. Routing through all
 * of them would make every region a stop and the route meaningless, so only the
 * best few count — the ones actually worth hunting.
 */
const SOURCES_PER_MATERIAL = 5

export interface RoutePal {
  name: string
  quantity: [number, number]
  chance: number | null
  dayNight: 'night' | 'both' | null
}

export interface RouteMaterial {
  itemId: ItemId
  name: string
  required: number
  /** Pals in this region that drop it, best odds first. */
  pals: RoutePal[]
}

export interface RouteStop {
  region: string
  materials: RouteMaterial[]
  /** Distinct Pals to hunt here, across all materials. */
  palCount: number
  /** True when every Pal worth hunting here only spawns at night. */
  nightOnly: boolean
}

export interface FarmingRoute {
  /** Regions covering the most of the list first. */
  stops: RouteStop[]
  /** Dropped materials whose sources have no wild spawn — bosses, NPCs, humans. */
  unroutable: { itemId: ItemId; name: string; required: number; sources: string[] }[]
  /** Gathered materials: no route needed, they're mined or picked up anywhere. */
  gathered: { itemId: ItemId; name: string; required: number }[]
}

export type HabitatIndex = Map<string, PalHabitat>

export function buildHabitatIndex(data: GameData): HabitatIndex {
  return new Map(data.habitats.map((habitat) => [habitat.name, habitat]))
}

/** Best odds first; an unknown rate sorts last rather than counting as zero. */
function byChance(a: DropSource, b: DropSource): number {
  return (b.chance ?? -1) - (a.chance ?? -1) || b.quantity[1] - a.quantity[1]
}

export function buildRoute(
  result: CalculationResult,
  index: GameIndex,
  habitats: HabitatIndex,
): FarmingRoute {
  const stops = new Map<string, Map<ItemId, RouteMaterial>>()
  const unroutable: FarmingRoute['unroutable'] = []
  const gathered: FarmingRoute['gathered'] = []

  // Anything with no crafts to run has to be *obtained*, and that includes a
  // build-list target that isn't craftable — asking for a Bounty Token directly
  // still means going and getting it. Those land in `targets`, not `raw`, so
  // routing only `raw` would silently omit them.
  const toObtain = [...result.raw, ...result.targets.filter((t) => t.crafts === 0)]

  for (const total of toObtain) {
    if (total.sourceKind === 'gathered') {
      gathered.push({ itemId: total.itemId, name: total.name, required: total.required })
      continue
    }
    if (total.sourceKind !== 'drop') continue

    const entry = index.byId.get(total.itemId)
    const best = [...(entry?.drops ?? [])].sort(byChance).slice(0, SOURCES_PER_MATERIAL)
    let placed = false

    for (const drop of best) {
      const habitat = habitats.get(drop.source)
      // Many drop sources are humans and NPCs rather than Pals, and legendaries
      // have no wild spawn at all. Both legitimately have no habitat.
      if (!habitat) continue

      for (const region of habitat.regions) {
        const materials = stops.get(region) ?? new Map<ItemId, RouteMaterial>()
        stops.set(region, materials)

        const material = materials.get(total.itemId) ?? {
          itemId: total.itemId,
          name: total.name,
          required: total.required,
          pals: [],
        }
        material.pals.push({
          name: drop.source,
          quantity: drop.quantity,
          chance: drop.chance,
          dayNight: habitat.dayNight,
        })
        materials.set(total.itemId, material)
        placed = true
      }
    }

    if (!placed) {
      unroutable.push({
        itemId: total.itemId,
        name: total.name,
        required: total.required,
        sources: best.map((d) => d.source),
      })
    }
  }

  const built: RouteStop[] = [...stops].map(([region, materials]) => {
    const list = [...materials.values()]
    for (const material of list) {
      material.pals.sort((a, b) => (b.chance ?? -1) - (a.chance ?? -1))
    }
    const pals = new Set(list.flatMap((m) => m.pals.map((p) => p.name)))
    return {
      region,
      materials: list.sort((a, b) => b.required - a.required || a.name.localeCompare(b.name)),
      palCount: pals.size,
      nightOnly: list.length > 0 && list.every((m) => m.pals.every((p) => p.dayNight === 'night')),
    }
  })

  return {
    // Most of the list covered first — that's the trip worth making.
    stops: built.sort(
      (a, b) => b.materials.length - a.materials.length || a.region.localeCompare(b.region),
    ),
    unroutable: unroutable.sort((a, b) => b.required - a.required),
    gathered: gathered.sort((a, b) => b.required - a.required),
  }
}

/** True when there is anything worth showing. */
export function hasRoute(route: FarmingRoute): boolean {
  return route.stops.length > 0 || route.unroutable.length > 0 || route.gathered.length > 0
}

/** Total distinct dropped materials the route accounts for. */
export function routedMaterialCount(route: FarmingRoute): number {
  return new Set(route.stops.flatMap((s) => s.materials.map((m) => m.itemId))).size
}

export type { MaterialTotal }

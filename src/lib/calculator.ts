/**
 * The recipe expansion engine.
 *
 * Given a build list ("20 Mega Spheres, 3 Electric Furnaces"), work out every
 * material needed all the way down to things you gather or farm from Pals.
 */

import type { GameData, Item, ItemId, SourceKind, Station, Structure } from '@/types/game'

export type Entry = Item | Structure

/** Lookup tables built once from the dataset and reused across calculations. */
export interface GameIndex {
  byId: Map<ItemId, Entry>
  stationsById: Map<ItemId, Station>
}

export function buildIndex(data: GameData): GameIndex {
  const byId = new Map<ItemId, Entry>()
  // Items first, then structures — a structure wins a name collision, since a
  // build-menu entry is what the player means when both exist.
  for (const item of data.items) byId.set(item.id, item)
  for (const structure of data.structures) byId.set(structure.id, structure)

  return {
    byId,
    stationsById: new Map(data.stations.map((s) => [s.id, s])),
  }
}

export interface BuildListEntry {
  itemId: ItemId
  quantity: number
}

export interface MaterialTotal {
  itemId: ItemId
  name: string
  sourceKind: SourceKind
  /** Units actually needed. */
  required: number
  /** Craft operations to run. 0 for anything not crafted. */
  crafts: number
  /** Units produced by those crafts; exceeds `required` when a batch overshoots. */
  produced: number
  /** `produced - required`. Non-zero only for batch recipes. */
  surplus: number
  stationName: string | null
  /** Whether this appears in the user's build list (vs. being an intermediate). */
  isTarget: boolean
}

export interface CalculationResult {
  /** Everything in the build list, at the requested quantities. */
  targets: MaterialTotal[]
  /** Craftable sub-components produced along the way. */
  intermediates: MaterialTotal[]
  /** The shopping list: gathered, dropped, and unknown-source leaves. */
  raw: MaterialTotal[]
  /** Recipe inputs that reference an item missing from the dataset. */
  unresolved: { itemId: ItemId; name: string; required: number }[]
  /**
   * Cycles encountered during expansion. The dataset is validated acyclic at
   * import time, so this should always be empty — it exists so a bad data drop
   * degrades into a warning instead of a hung tab.
   */
  cycles: ItemId[][]
}

/**
 * Order the reachable subgraph so every entry is visited before the materials
 * it depends on.
 *
 * This matters for correctness, not just speed. Demand has to be fully
 * accumulated before a recipe is costed: if 40 Ingots are needed across three
 * different recipes, the Ore cost must be computed once from 40, not three
 * times from partial subtotals. With batch recipes and their rounding, doing it
 * per-branch would overcount.
 */
function topologicalOrder(
  roots: ItemId[],
  index: GameIndex,
): { order: ItemId[]; cycles: ItemId[][] } {
  const order: ItemId[] = []
  const cycles: ItemId[][] = []

  const WHITE = 0
  const GREY = 1
  const BLACK = 2
  const colour = new Map<ItemId, number>()

  for (const root of roots) {
    if ((colour.get(root) ?? WHITE) !== WHITE) continue

    const path: ItemId[] = [root]
    const stack: { id: ItemId; index: number }[] = [{ id: root, index: 0 }]
    colour.set(root, GREY)

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const inputs = index.byId.get(frame.id)?.recipe?.inputs ?? []

      if (frame.index >= inputs.length) {
        colour.set(frame.id, BLACK)
        order.push(frame.id)
        path.pop()
        stack.pop()
        continue
      }

      const nextId = inputs[frame.index++].itemId
      if (!index.byId.has(nextId)) continue

      const state = colour.get(nextId) ?? WHITE
      if (state === GREY) {
        cycles.push([...path.slice(path.indexOf(nextId)), nextId])
      } else if (state === WHITE) {
        colour.set(nextId, GREY)
        path.push(nextId)
        stack.push({ id: nextId, index: 0 })
      }
    }
  }

  // Post-order lists dependencies first; reverse it to get dependents first.
  return { order: order.reverse(), cycles }
}

/**
 * Expand a build list into total material requirements.
 *
 * Quantities are floored at 0 and non-finite values are ignored, so malformed
 * UI state can't produce NaN totals.
 */
export function calculate(buildList: BuildListEntry[], index: GameIndex): CalculationResult {
  const demand = new Map<ItemId, number>()
  const targetIds = new Set<ItemId>()
  const unresolved = new Map<ItemId, { name: string; required: number }>()

  for (const entry of buildList) {
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) continue
    demand.set(entry.itemId, (demand.get(entry.itemId) ?? 0) + entry.quantity)
    targetIds.add(entry.itemId)
  }

  const { order, cycles } = topologicalOrder([...demand.keys()], index)
  const totals = new Map<ItemId, MaterialTotal>()

  for (const id of order) {
    const entry = index.byId.get(id)
    const required = demand.get(id) ?? 0
    if (!entry || required <= 0) continue

    const recipe = entry.recipe
    const batchSize = recipe && recipe.yield > 0 ? recipe.yield : 1
    const crafts = recipe ? Math.ceil(required / batchSize) : 0
    const produced = recipe ? crafts * batchSize : 0

    totals.set(id, {
      itemId: id,
      name: entry.name,
      sourceKind: entry.sourceKind,
      required,
      crafts,
      produced,
      surplus: recipe ? produced - required : 0,
      stationName: recipe?.stationName ?? null,
      isTarget: targetIds.has(id),
    })

    if (!recipe) continue

    // Cost the crafts we actually run, not the units requested — a batch recipe
    // consumes a whole batch's materials even for a partial order.
    for (const input of recipe.inputs) {
      const needed = input.quantity * crafts
      if (index.byId.has(input.itemId)) {
        demand.set(input.itemId, (demand.get(input.itemId) ?? 0) + needed)
      } else {
        const existing = unresolved.get(input.itemId)
        if (existing) existing.required += needed
        else unresolved.set(input.itemId, { name: input.name, required: needed })
      }
    }
  }

  const all = [...totals.values()]
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

  return {
    targets: all.filter((t) => t.isTarget).sort(byName),
    intermediates: all.filter((t) => !t.isTarget && t.crafts > 0).sort(byName),
    raw: all.filter((t) => !t.isTarget && t.crafts === 0).sort(byName),
    unresolved: [...unresolved].map(([itemId, v]) => ({ itemId, ...v })).sort(byName),
    cycles,
  }
}

/** A node in the per-item breakdown tree shown in the UI. */
export interface RecipeNode {
  itemId: ItemId
  name: string
  sourceKind: SourceKind
  /** Units required for this branch alone. */
  quantity: number
  stationName: string | null
  children: RecipeNode[]
  /** True when expansion stopped here to avoid re-walking a repeated subtree. */
  truncated: boolean
}

/**
 * Build a display tree for a single item.
 *
 * Branch quantities here are per-branch and unbatched, so they will not always
 * sum to the figures in `calculate` — that function batches and de-duplicates
 * across the whole build list. The tree explains structure; the totals are
 * what you take shopping.
 */
export function buildTree(
  itemId: ItemId,
  quantity: number,
  index: GameIndex,
  ancestors: ReadonlySet<ItemId> = new Set(),
): RecipeNode | null {
  const entry = index.byId.get(itemId)
  if (!entry) return null

  const recipe = entry.recipe
  const repeated = ancestors.has(itemId)

  const node: RecipeNode = {
    itemId,
    name: entry.name,
    sourceKind: entry.sourceKind,
    quantity,
    stationName: recipe?.stationName ?? null,
    children: [],
    truncated: repeated,
  }

  if (!recipe || repeated) return node

  const nextAncestors = new Set(ancestors).add(itemId)
  const batchSize = recipe.yield > 0 ? recipe.yield : 1
  const crafts = Math.ceil(quantity / batchSize)

  for (const input of recipe.inputs) {
    const child = buildTree(input.itemId, input.quantity * crafts, index, nextAncestors)
    if (child) {
      node.children.push(child)
    } else {
      node.children.push({
        itemId: input.itemId,
        name: input.name,
        sourceKind: 'unobtainable',
        quantity: input.quantity * crafts,
        stationName: null,
        children: [],
        truncated: false,
      })
    }
  }

  return node
}

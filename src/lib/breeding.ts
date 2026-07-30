/**
 * The breeding engine.
 *
 * Two parents produce a child deterministically: a fixed special combo if one
 * exists, otherwise the rank formula. On top of that sits a solver that answers
 * the question no existing tool does — "I own these Pals, I want that one,
 * what's the shortest chain?" — rather than the A+B lookup every calculator
 * already offers.
 *
 * Imports are relative, not aliased: `scripts/import/` shares this module and
 * compiles under tsconfig.node.json, which has no `@/` mapping. Same rule as
 * `id.ts`.
 */

import type { BreedingData, BreedingPal, PalId } from '../types/breeding.ts'

/** Order-insensitive key for a parent pair — A+B and B+A are the same cross. */
export function comboKey(a: PalId, b: PalId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Resolve a target rank to the nearest pooled Pal.
 *
 * Shared with the importer, which uses it to measure how often the tie-break
 * decides an outcome. One implementation so the measurement and the solver
 * cannot disagree.
 *
 * `pooled` must be sorted ascending by rank.
 */
export function nearestInPool(
  pooled: readonly { id: PalId; rank: number }[],
  target: number,
  tieBreak: 'higher' | 'lower',
): { id: PalId; tied: boolean } {
  // Binary search for the insertion point, then inspect the neighbours.
  // Scanning all 183 entries per lookup would be 16M comparisons across the
  // full pair table; this keeps precomputing it cheap.
  let low = 0
  let high = pooled.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (pooled[mid].rank < target) low = mid + 1
    else high = mid
  }

  let best = pooled[low]
  let bestDistance = Math.abs(best.rank - target)
  let tied = false

  for (const index of [low - 1, low + 1]) {
    const candidate = pooled[index]
    if (!candidate) continue
    const distance = Math.abs(candidate.rank - target)

    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
      tied = false
    } else if (distance === bestDistance && candidate.id !== best.id) {
      tied = true
      const preferCandidate =
        tieBreak === 'higher' ? candidate.rank > best.rank : candidate.rank < best.rank
      if (preferCandidate) best = candidate
    }
  }

  return { id: best.id, tied }
}

export interface BreedIndex {
  byId: Map<PalId, BreedingPal>
  /** Pooled Pals only, sorted ascending by rank. */
  pooled: { id: PalId; rank: number }[]
  /** comboKey -> child, for the 164 fixed crosses. */
  specials: Map<string, PalId>
  tieBreak: 'higher' | 'lower'
}

export function buildBreedIndex(data: BreedingData): BreedIndex {
  return {
    byId: new Map(data.pals.map((p) => [p.id, p])),
    pooled: data.pals
      .filter((p) => p.inPool)
      .map((p) => ({ id: p.id, rank: p.rank }))
      .sort((a, b) => a.rank - b.rank),
    specials: new Map(data.specialCombos.map((c) => [comboKey(c.parentA, c.parentB), c.child])),
    tieBreak: data.tieBreak.rule,
  }
}

export interface BreedResult {
  child: PalId
  /** From a fixed combo, which is an exact table lookup with no ambiguity. */
  special: boolean
  /**
   * The target landed exactly between two pooled ranks, so the outcome depended
   * on the tie-break rule that upstream contradicts itself about. Roughly a
   * third of generic pairs — common enough that callers must surface it.
   */
  tieBroken: boolean
}

/** Null when either parent is unknown. Gender is irrelevant to the species. */
export function breed(index: BreedIndex, a: PalId, b: PalId): BreedResult | null {
  const parentA = index.byId.get(a)
  const parentB = index.byId.get(b)
  if (!parentA || !parentB) return null

  const special = index.specials.get(comboKey(a, b))
  if (special) return { child: special, special: true, tieBroken: false }

  if (index.pooled.length === 0) return null

  const target = Math.floor((parentA.rank + parentB.rank + 1) / 2)
  const { id, tied } = nearestInPool(index.pooled, target, index.tieBreak)
  return { child: id, special: false, tieBroken: tied }
}

/** Every parent pair that produces `child`. Order-insensitive, deduplicated. */
export function parentsFor(
  index: BreedIndex,
  child: PalId,
): { parentA: PalId; parentB: PalId; special: boolean; tieBroken: boolean }[] {
  const ids = [...index.byId.keys()]
  const found: { parentA: PalId; parentB: PalId; special: boolean; tieBroken: boolean }[] = []

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i; j < ids.length; j += 1) {
      const result = breed(index, ids[i], ids[j])
      if (result?.child === child) {
        found.push({
          parentA: ids[i],
          parentB: ids[j],
          special: result.special,
          tieBroken: result.tieBroken,
        })
      }
    }
  }

  // Exact combos first, then certain generic pairs, then tie-broken ones — the
  // order you would actually want to try them in.
  return found.sort(
    (x, y) => Number(y.special) - Number(x.special) || Number(x.tieBroken) - Number(y.tieBroken),
  )
}

export interface BreedStep {
  parentA: PalId
  parentB: PalId
  child: PalId
  special: boolean
  tieBroken: boolean
  /** 1 means breedable directly from Pals you already own. */
  generation: number
}

export interface BreedPlan {
  target: PalId
  /** Ordered so every step's parents exist by the time it runs. */
  steps: BreedStep[]
  /** The target was already in the roster; `steps` is empty. */
  alreadyOwned: boolean
  /** How many steps hinge on the contested tie-break rule. */
  tieBrokenSteps: number
  /** Distinct species reachable from the roster, for explaining a failure. */
  reachableCount: number
}

interface Reached {
  generation: number
  from?: { a: PalId; b: PalId; special: boolean; tieBroken: boolean }
}

/**
 * Shortest breeding chain from a roster to a target.
 *
 * Breadth-first over reachable species, recording the first pair that produces
 * each. Because a species is reached at its earliest possible generation, and a
 * step only becomes available once both its parents are, the result is the
 * fewest breeding *generations* — and every step is guaranteed to have its
 * parents on hand by the time it runs.
 *
 * Returns null when the target cannot be reached at all.
 */
export function solve(index: BreedIndex, owned: readonly PalId[], target: PalId): BreedPlan | null {
  const known = owned.filter((id) => index.byId.has(id))
  if (!index.byId.has(target)) return null

  const reached = new Map<PalId, Reached>(known.map((id) => [id, { generation: 0 }]))

  if (reached.has(target)) {
    return {
      target,
      steps: [],
      alreadyOwned: true,
      tieBrokenSteps: 0,
      reachableCount: reached.size,
    }
  }
  if (known.length === 0) return null

  let frontier = [...new Set(known)]
  let generation = 0

  while (frontier.length > 0 && !reached.has(target)) {
    generation += 1
    const discovered: PalId[] = []
    const available = [...reached.keys()]

    // Every new species only becomes useful when paired with something already
    // reachable, so pairing the frontier against everything reached is enough —
    // pairs of two older species were tried in an earlier round.
    for (const a of frontier) {
      for (const b of available) {
        const result = breed(index, a, b)
        if (!result || reached.has(result.child)) continue

        reached.set(result.child, {
          generation,
          from: { a, b, special: result.special, tieBroken: result.tieBroken },
        })
        discovered.push(result.child)
      }
    }

    frontier = discovered
  }

  if (!reached.has(target)) {
    return null
  }

  const steps = collectSteps(reached, target)
  return {
    target,
    steps,
    alreadyOwned: false,
    tieBrokenSteps: steps.filter((s) => s.tieBroken).length,
    reachableCount: reached.size,
  }
}

/**
 * Walk the parent pointers back from the target.
 *
 * Sorting by generation is what makes the list runnable top to bottom: a step's
 * parents are always produced in an earlier generation than the step itself.
 */
function collectSteps(reached: Map<PalId, Reached>, target: PalId): BreedStep[] {
  const needed = new Map<PalId, BreedStep>()
  const queue: PalId[] = [target]

  while (queue.length > 0) {
    const id = queue.pop()!
    if (needed.has(id)) continue

    const entry = reached.get(id)
    if (!entry?.from) continue

    needed.set(id, {
      parentA: entry.from.a,
      parentB: entry.from.b,
      child: id,
      special: entry.from.special,
      tieBroken: entry.from.tieBroken,
      generation: entry.generation,
    })
    queue.push(entry.from.a, entry.from.b)
  }

  return [...needed.values()].sort((a, b) => a.generation - b.generation)
}

/** Every species reachable from a roster, for "what can I make?" browsing. */
export function reachableFrom(index: BreedIndex, owned: readonly PalId[]): Set<PalId> {
  const reached = new Set(owned.filter((id) => index.byId.has(id)))
  let frontier = [...reached]

  while (frontier.length > 0) {
    const discovered: PalId[] = []
    const available = [...reached]

    for (const a of frontier) {
      for (const b of available) {
        const result = breed(index, a, b)
        if (!result || reached.has(result.child)) continue
        reached.add(result.child)
        discovered.push(result.child)
      }
    }

    frontier = discovered
  }

  return reached
}

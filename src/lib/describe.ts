/**
 * Human-readable descriptions of *how* something is made.
 *
 * Pulled out of the components so the wording is testable and stated once —
 * the distinction between "has no recipe" and "has a recipe but no crafting
 * station" is easy to get wrong, and getting it wrong tells the user something
 * false about the game.
 */

import type { GameIndex } from './calculator'
import type { Structure } from '@/types/game'
import type { Entry } from './search'

function isStructure(entry: Entry): entry is Structure {
  return entry.category === 'structure'
}

/**
 * Describe how an entry is produced.
 *
 * Structures are placed from the build menu and legitimately have no station,
 * so reporting "no recipe" for them — as an earlier version did — was simply
 * wrong: the Electric Furnace has a recipe, it just isn't made at a bench.
 */
export function describeProduction(entry: Entry | undefined, index: GameIndex): string {
  if (!entry) return ''

  if (isStructure(entry)) {
    const parts = ['Build menu']
    if (entry.workSuitability) parts.push(`worked by ${entry.workSuitability}`)
    if (entry.requiresPower) parts.push('needs power')
    return parts.join(' · ')
  }

  if (!entry.recipe) {
    if (entry.sourceKind === 'drop') return 'Dropped, not crafted'
    if (entry.sourceKind === 'merchant') return 'Bought from a merchant'
    if (entry.sourceKind === 'unobtainable') return 'No known source'
    return 'Gathered, not crafted'
  }

  const { stationName, stationId } = entry.recipe
  if (!stationName) return 'Hand-crafted'

  const work = stationId ? index.stationsById.get(stationId)?.workSuitability : null
  return work ? `${stationName} · ${work}` : stationName
}

/** Batch-yield note, e.g. "2 × 10 = 20, 5 spare". Empty when there's nothing to say. */
export function describeBatch(
  entry: Entry | undefined,
  total: { crafts: number; produced: number; surplus: number } | undefined,
): string {
  const batchSize = entry?.recipe?.yield ?? 1
  if (batchSize <= 1) return ''
  if (total && total.surplus > 0) {
    return `${total.crafts} × ${batchSize} = ${total.produced}, ${total.surplus} spare`
  }
  return `batches of ${batchSize}`
}

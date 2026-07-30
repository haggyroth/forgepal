/**
 * Translate upstream breeding data into ForgePal's schema.
 *
 * Kept separate from `normalize.ts` because it feeds a separate generated file:
 * Pals are not items, and the calculator should not carry breeding data it
 * never reads.
 */

import type {
  BreedingData,
  BreedingPal,
  PalId,
  SpecialCombo,
  TieBreakPolicy,
} from '../../src/types/breeding.ts'
import { toId } from '../../src/lib/id.ts'
import type { RawDataset } from './sources/palworld-kb.ts'
import { FORCE_IN_POOL, FORCE_OUT_OF_POOL, TIE_BREAK } from './breeding-overrides.ts'

/** Order-insensitive key for a parent pair — A+B and B+A are the same cross. */
export function comboKey(a: PalId, b: PalId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Which Pals the rank formula can produce.
 *
 * Default rule: everything except Pals that appear as a special-combo child.
 * Upstream describes exactly this exclusion — variants, legendaries, and the
 * crossover Pals are all reachable only through their fixed combo or a
 * same-species pairing.
 */
export function derivePool(
  names: readonly string[],
  specialCombos: readonly SpecialCombo[],
): Set<PalId> {
  const children = new Set(specialCombos.map((c) => c.child))
  const forcedIn = new Set(FORCE_IN_POOL.map(toId))
  const forcedOut = new Set(FORCE_OUT_OF_POOL.map(toId))

  const pool = new Set<PalId>()
  for (const name of names) {
    const id = toId(name)
    if (forcedOut.has(id)) continue
    if (forcedIn.has(id) || !children.has(id)) pool.add(id)
  }
  return pool
}

/**
 * Resolve a target rank to the nearest pooled Pal.
 *
 * Exported because the importer measures how often the tie-break decides the
 * outcome, and the solver must resolve identically — one implementation, not
 * two that can drift.
 *
 * `pooled` must be sorted ascending by rank.
 */
export function nearestInPool(
  pooled: readonly { id: PalId; rank: number }[],
  target: number,
  tieBreak: 'higher' | 'lower',
): { id: PalId; tied: boolean } {
  // Binary search for the insertion point, then inspect the neighbours. Scanning
  // all 183 entries per lookup would be 16M comparisons across the full pair
  // table; this keeps precomputing it cheap.
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

/**
 * Count how many generic parent pairs are decided by the tie-break rule.
 *
 * Recorded as provenance rather than left as a claim: the rule is contested
 * upstream, and the share turns out to be about a third, which is the
 * difference between a footnote and something the UI has to say out loud.
 */
function measureTieBreak(
  pals: readonly BreedingPal[],
  specialCombos: readonly SpecialCombo[],
): TieBreakPolicy {
  const pooled = pals
    .filter((p) => p.inPool)
    .map((p) => ({ id: p.id, rank: p.rank }))
    .sort((a, b) => a.rank - b.rank)

  const specials = new Set(specialCombos.map((c) => comboKey(c.parentA, c.parentB)))
  let affectedPairs = 0
  let totalPairs = 0

  for (let i = 0; i < pals.length; i += 1) {
    for (let j = i; j < pals.length; j += 1) {
      if (specials.has(comboKey(pals[i].id, pals[j].id))) continue
      totalPairs += 1
      const target = Math.floor((pals[i].rank + pals[j].rank + 1) / 2)
      if (nearestInPool(pooled, target, TIE_BREAK).tied) affectedPairs += 1
    }
  }

  return { rule: TIE_BREAK, affectedPairs, totalPairs }
}

export function normalizeBreeding(dataset: RawDataset): BreedingData {
  const raw = dataset.breeding

  const specialCombos: SpecialCombo[] = raw.special_combos
    .filter((c) => c.parent_a && c.parent_b && c.child)
    .map((c) => ({
      parentA: toId(c.parent_a),
      parentB: toId(c.parent_b),
      child: toId(c.child),
    }))
    .sort((a, b) => comboKey(a.parentA, a.parentB).localeCompare(comboKey(b.parentA, b.parentB)))

  const names = Object.keys(raw.combi_ranks)
  const pool = derivePool(names, specialCombos)

  const pals: BreedingPal[] = names
    .map((name) => ({
      id: toId(name),
      name,
      rank: raw.combi_ranks[name],
      inPool: pool.has(toId(name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const sources = (raw.sources ?? []).map((s) => `${s.url} — ${s.what} (fetched ${s.fetched})`)

  return {
    meta: {
      gameVersion: raw.game_version,
      updated: raw.updated,
      importedAt: new Date().toISOString(),
      sources,
      gaps: raw.gaps ?? [],
    },
    pals,
    specialCombos,
    tieBreak: measureTieBreak(pals, specialCombos),
  }
}

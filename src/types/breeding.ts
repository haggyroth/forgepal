/**
 * Breeding data schema.
 *
 * Deliberately a separate file and a separate generated dataset from
 * `game.ts` / `game-data.json`: Pals are not items, nothing in the calculator
 * references them, and keeping them apart means the calculator's chunk doesn't
 * pay for breeding data it never reads.
 */

/** Stable id derived from a Pal's display name via `toId`. */
export type PalId = string

export interface BreedingPal {
  id: PalId
  name: string
  /** Hidden integer the breeding formula operates on. 10–3100 in 1.0. */
  rank: number
  /**
   * Whether the rank formula can produce this Pal.
   *
   * Elemental and regional variants, legendaries, and other special-combo-only
   * children are excluded. This is *derived*, not stated by upstream, and it is
   * load-bearing: excluding a Pal wrongly doesn't just make that Pal
   * unreachable, it changes which Pal is "nearest" for every target near its
   * rank — so one mistake corrupts unrelated pairs. See `breeding-overrides.ts`.
   */
  inPool: boolean
}

/** A fixed parent pair that overrides the formula entirely. Order-insensitive. */
export interface SpecialCombo {
  parentA: PalId
  parentB: PalId
  child: PalId
}

/**
 * How an equidistant target resolves.
 *
 * `higher` is upstream's position, verified in-game against one worked example
 * (Turtacle 2410 + Aegidron 30 → target 1220 → Nitemary 1230 over Quivern
 * 1210). Upstream's own `gaps` field notes that palworld.wiki.gg documents the
 * opposite. We follow the verified observation and flag results that depended
 * on it, because this is not a rare tiebreak — see `affectedPairs`.
 */
export interface TieBreakPolicy {
  rule: 'higher' | 'lower'
  /** Generic parent pairs whose result is decided by the rule. */
  affectedPairs: number
  /** Generic parent pairs in total, so the share is checkable rather than asserted. */
  totalPairs: number
}

export interface BreedingMeta {
  gameVersion: string
  updated: string
  importedAt: string
  sources: string[]
  gaps: string[]
}

export interface BreedingData {
  meta: BreedingMeta
  /** All 299 Pals, pooled or not. */
  pals: BreedingPal[]
  specialCombos: SpecialCombo[]
  tieBreak: TieBreakPolicy
}

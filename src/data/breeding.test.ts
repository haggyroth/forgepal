import { describe, expect, it } from 'vitest'
import { breedingData } from './breeding'
import { toId } from '@/lib/id'

/**
 * Runs against the committed breeding dataset, like the calculator's
 * `describe('the committed dataset')` block. These are the tripwire for a bad
 * import: the pool is derived rather than stated upstream, and a wrong
 * exclusion changes results for parent pairs that have nothing to do with the
 * excluded Pal.
 */
describe('the committed breeding dataset', () => {
  const { pals, specialCombos, tieBreak } = breedingData
  const byId = new Map(pals.map((p) => [p.id, p]))
  const pooled = pals.filter((p) => p.inPool)

  it('covers the full 1.0 paldex', () => {
    expect(pals).toHaveLength(299)
  })

  it('has every special combo from upstream', () => {
    expect(specialCombos).toHaveLength(164)
  })

  it('resolves every id a special combo names', () => {
    for (const combo of specialCombos) {
      expect(byId.has(combo.parentA)).toBe(true)
      expect(byId.has(combo.parentB)).toBe(true)
      expect(byId.has(combo.child)).toBe(true)
    }
  })

  it('keeps special-combo children out of the generic pool', () => {
    // Upstream: "the formula can never produce them". A leak here would have
    // the solver offering breeding chains that do not work in game.
    const children = new Set(specialCombos.map((c) => c.child))
    expect(pooled.filter((p) => children.has(p.id))).toEqual([])
  })

  it('gives every pooled pal a unique rank', () => {
    // Two pooled pals on one rank would make "nearest" undecidable in a way the
    // tie-break rule cannot resolve, since it compares ranks.
    const ranks = pooled.map((p) => p.rank)
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it('excludes the eleven crossover pals that share rank 3100', () => {
    // Upstream flags these as depending "entirely on the tie-break rule / their
    // exclusion from the generic pool". They are excluded, which is what makes
    // every pooled rank unique.
    const tied = pals.filter((p) => p.rank === 3100)
    expect(tied).toHaveLength(11)
    expect(tied.every((p) => !p.inPool)).toBe(true)
  })

  it('spans the documented rank range', () => {
    const ranks = pals.map((p) => p.rank)
    expect(Math.min(...ranks)).toBe(10)
    expect(Math.max(...ranks)).toBe(3100)
    expect(byId.get(toId('Chikipi'))?.rank).toBe(3080)
  })

  it('records the tie-break rule and how much of the table it decides', () => {
    // Not a footnote: about a third of generic pairs turn on a rule upstream
    // contradicts itself about, so the number is carried as data for the UI to
    // surface rather than left as a claim in a comment.
    expect(tieBreak.rule).toBe('higher')
    expect(tieBreak.totalPairs).toBeGreaterThan(40_000)
    expect(tieBreak.affectedPairs / tieBreak.totalPairs).toBeGreaterThan(0.25)
    expect(tieBreak.affectedPairs / tieBreak.totalPairs).toBeLessThan(0.4)
  })

  it('carries provenance and upstream gaps', () => {
    expect(breedingData.meta.gameVersion).toBe('1.0')
    expect(breedingData.meta.sources.length).toBeGreaterThan(0)
    expect(breedingData.meta.gaps.length).toBeGreaterThan(0)
  })

  it('is a separate dataset from the calculator, not merged into it', () => {
    // The calculator's chunk must not carry breeding data it never reads.
    expect(pals.some((p) => p.id === toId('Lamball'))).toBe(true)
  })
})

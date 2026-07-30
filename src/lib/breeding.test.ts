import { describe, expect, it } from 'vitest'
import {
  breed,
  buildBreedIndex,
  comboKey,
  nearestInPool,
  parentsFor,
  reachableFrom,
  solve,
} from './breeding.ts'
import { breedingData } from '@/data/breeding'
import type { BreedingData } from '@/types/breeding'

const pooled = (entries: [string, number][]) =>
  entries.map(([id, rank]) => ({ id, rank })).sort((a, b) => a.rank - b.rank)

describe('comboKey', () => {
  it('is order-insensitive, because A+B and B+A are the same cross', () => {
    expect(comboKey('a', 'b')).toBe(comboKey('b', 'a'))
  })

  it('distinguishes different pairs', () => {
    expect(comboKey('a', 'b')).not.toBe(comboKey('a', 'c'))
  })
})

describe('nearestInPool', () => {
  const pool = pooled([
    ['low', 100],
    ['mid', 500],
    ['high', 900],
  ])

  it('picks the nearest rank', () => {
    expect(nearestInPool(pool, 480, 'higher').id).toBe('mid')
    expect(nearestInPool(pool, 120, 'higher').id).toBe('low')
    expect(nearestInPool(pool, 10_000, 'higher').id).toBe('high')
  })

  it('does not flag a clear winner as tied', () => {
    expect(nearestInPool(pool, 480, 'higher').tied).toBe(false)
  })

  it('breaks an exact tie toward the higher rank', () => {
    // 300 is equidistant from 100 and 500.
    const result = nearestInPool(pool, 300, 'higher')
    expect(result.id).toBe('mid')
    expect(result.tied).toBe(true)
  })

  it('honours the opposite rule when asked', () => {
    // The rule is contested upstream, so it must be a setting rather than baked
    // into the comparison.
    expect(nearestInPool(pool, 300, 'lower').id).toBe('low')
  })

  it('handles a single-entry pool', () => {
    expect(nearestInPool(pooled([['only', 42]]), 999, 'higher').id).toBe('only')
  })

  it('is exact when the target lands on a rank', () => {
    const result = nearestInPool(pool, 500, 'higher')
    expect(result.id).toBe('mid')
    expect(result.tied).toBe(false)
  })
})

/**
 * A miniature world, sized so every outcome can be worked out by hand.
 *
 * Ranks are spaced to force ties on purpose — the tie-break decides about a
 * third of real pairs, so a fixture where it never fires would test the easy
 * case only.
 */
const fixture: BreedingData = {
  meta: { gameVersion: 'test', updated: '', importedAt: '', sources: [], gaps: [] },
  pals: [
    { id: 'ash', name: 'Ash', rank: 100, inPool: true },
    { id: 'bram', name: 'Bram', rank: 500, inPool: true },
    { id: 'cyan', name: 'Cyan', rank: 900, inPool: true },
    { id: 'dusk', name: 'Dusk', rank: 1300, inPool: true },
    // Reachable only through its fixed combo, so it must never fall out of the
    // formula.
    { id: 'lux', name: 'Lux', rank: 700, inPool: false },
  ],
  specialCombos: [
    { parentA: 'ash', parentB: 'cyan', child: 'lux' },
    { parentA: 'dusk', parentB: 'dusk', child: 'dusk' },
  ],
  tieBreak: { rule: 'higher', affectedPairs: 0, totalPairs: 0 },
}

const index = buildBreedIndex(fixture)

describe('breed', () => {
  it('applies the rank formula when no combo matches', () => {
    // floor((500 + 1300 + 1) / 2) = 900, which is Cyan exactly.
    expect(breed(index, 'bram', 'dusk')).toEqual({
      child: 'cyan',
      special: false,
      tieBroken: false,
    })
  })

  it('is order-insensitive', () => {
    expect(breed(index, 'ash', 'dusk')).toEqual(breed(index, 'dusk', 'ash'))
    expect(breed(index, 'ash', 'cyan')).toEqual(breed(index, 'cyan', 'ash'))
  })

  it('lets a special combo override the formula', () => {
    // The formula would give floor((100 + 900 + 1) / 2) = 500 -> Bram.
    expect(breed(index, 'ash', 'ash')?.child).toBe('ash')
    expect(breed(index, 'ash', 'cyan')).toEqual({
      child: 'lux',
      special: true,
      tieBroken: false,
    })
  })

  it('flags results that hinged on the tie-break', () => {
    // floor((100 + 1300 + 1) / 2) = 700, equidistant from Bram 500 and Cyan 900.
    expect(breed(index, 'ash', 'dusk')).toEqual({
      child: 'cyan',
      special: false,
      tieBroken: true,
    })
  })

  it('handles a self-pair through the formula', () => {
    expect(breed(index, 'bram', 'bram')?.child).toBe('bram')
  })

  it('handles a self-pair through a special combo', () => {
    expect(breed(index, 'dusk', 'dusk')).toEqual({
      child: 'dusk',
      special: true,
      tieBroken: false,
    })
  })

  it('returns null for an unknown parent rather than guessing', () => {
    expect(breed(index, 'ash', 'nope')).toBeNull()
    expect(breed(index, 'nope', 'nope')).toBeNull()
  })

  it('can use a non-pooled pal as a parent', () => {
    // Lux cannot be produced by the formula but is a perfectly ordinary parent:
    // floor((700 + 100 + 1) / 2) = 400, nearest is Bram 500.
    expect(breed(index, 'lux', 'ash')?.child).toBe('bram')
  })
})

describe('parentsFor', () => {
  it('finds the fixed combo and lists it first', () => {
    const parents = parentsFor(index, 'lux')
    expect(parents).toEqual([{ parentA: 'ash', parentB: 'cyan', special: true, tieBroken: false }])
  })

  it('lists certain pairs ahead of tie-broken ones', () => {
    const parents = parentsFor(index, 'cyan')
    const tieBroken = parents.map((p) => p.tieBroken)
    expect(parents.length).toBeGreaterThan(1)
    expect(tieBroken).toEqual([...tieBroken].sort((a, b) => Number(a) - Number(b)))
  })

  it('is empty for a pal nothing produces', () => {
    // Nothing in this fixture targets rank 100 except Ash itself, which the
    // formula does reach — so use a pal that is not in the world at all.
    expect(parentsFor(index, 'nope')).toEqual([])
  })
})

describe('solve', () => {
  it('reports an already-owned target without inventing steps', () => {
    const plan = solve(index, ['ash', 'dusk'], 'ash')
    expect(plan).toMatchObject({ alreadyOwned: true, steps: [], tieBrokenSteps: 0 })
  })

  it('orders steps so every parent exists before it is needed', () => {
    // Ash + Dusk -> Cyan (generation 1), then Ash + Cyan -> Lux (generation 2).
    const plan = solve(index, ['ash', 'dusk'], 'lux')
    expect(plan?.alreadyOwned).toBe(false)
    expect(plan?.steps.map((s) => s.child)).toEqual(['cyan', 'lux'])

    const available = new Set(['ash', 'dusk'])
    for (const step of plan!.steps) {
      expect(available.has(step.parentA)).toBe(true)
      expect(available.has(step.parentB)).toBe(true)
      available.add(step.child)
    }
  })

  it('counts the steps that depend on the contested tie-break', () => {
    const plan = solve(index, ['ash', 'dusk'], 'lux')
    // The Cyan step is a tie; the Lux step is an exact combo.
    expect(plan?.tieBrokenSteps).toBe(1)
    expect(plan?.steps.find((s) => s.child === 'lux')?.tieBroken).toBe(false)
  })

  it('takes the shortest route when a longer one also exists', () => {
    const plan = solve(index, ['ash', 'cyan', 'dusk'], 'lux')
    expect(plan?.steps).toHaveLength(1)
    expect(plan?.steps[0]).toMatchObject({ child: 'lux', generation: 1, special: true })
  })

  it('returns null when the target is unreachable', () => {
    // Ash alone only ever breeds back into Ash.
    expect(solve(index, ['ash'], 'dusk')).toBeNull()
  })

  it('returns null for an empty roster or an unknown target', () => {
    expect(solve(index, [], 'lux')).toBeNull()
    expect(solve(index, ['ash', 'dusk'], 'nope')).toBeNull()
  })

  it('ignores unknown pals in the roster instead of failing', () => {
    expect(solve(index, ['nope', 'ash', 'dusk'], 'lux')?.steps).toHaveLength(2)
  })

  it('reports how much was reachable, so a failure can be explained', () => {
    expect(solve(index, ['ash'], 'dusk')).toBeNull()
    expect(reachableFrom(index, ['ash'])).toEqual(new Set(['ash']))
    expect(reachableFrom(index, ['ash', 'dusk']).size).toBeGreaterThan(2)
  })
})

describe('the committed breeding dataset', () => {
  const real = buildBreedIndex(breedingData)

  it('reproduces the worked example verified in game', () => {
    // Turtacle 2410 + Aegidron 30 -> target 1220, an exact tie between
    // Quivern 1210 and Nitemary 1230. Observed result was Nitemary.
    expect(breed(real, 'turtacle', 'aegidron')).toEqual({
      child: 'nitemary',
      special: false,
      tieBroken: true,
    })
  })

  it('never produces a special-combo-only child from the formula', () => {
    // The invariant a pool error would break. A wrongly-pooled pal would not
    // just become over-reachable — it would displace the correct answer for
    // every target near its rank.
    const specialOnly = new Set(breedingData.pals.filter((p) => !p.inPool).map((p) => p.id))
    const ids = breedingData.pals.map((p) => p.id)

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i; j < ids.length; j += 1) {
        const result = breed(real, ids[i], ids[j])!
        if (result.special) continue
        expect(specialOnly.has(result.child)).toBe(false)
      }
    }
  })

  it('agrees with the tie-break share the importer recorded', () => {
    // The whole point of sharing `nearestInPool` with the importer. If these
    // ever diverge, the figure the UI cites is not the one the solver used.
    const specials = new Set(breedingData.specialCombos.map((c) => comboKey(c.parentA, c.parentB)))
    const ids = breedingData.pals.map((p) => p.id)
    let affected = 0
    let total = 0

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i; j < ids.length; j += 1) {
        if (specials.has(comboKey(ids[i], ids[j]))) continue
        total += 1
        if (breed(real, ids[i], ids[j])!.tieBroken) affected += 1
      }
    }

    expect({ affected, total }).toEqual({
      affected: breedingData.tieBreak.affectedPairs,
      total: breedingData.tieBreak.totalPairs,
    })
  })

  it('solves a real chain from a pair of starter pals', () => {
    const plan = solve(real, ['lamball', 'cattiva'], 'relaxaurus-lux')
    expect(plan).not.toBeNull()
    expect(plan!.steps.length).toBeGreaterThan(0)
    expect(plan!.steps.at(-1)?.child).toBe('relaxaurus-lux')

    const available = new Set(['lamball', 'cattiva'])
    for (const step of plan!.steps) {
      expect(available.has(step.parentA)).toBe(true)
      expect(available.has(step.parentB)).toBe(true)
      available.add(step.child)
    }
  })

  it('reaches most of the roster from two starter pals', () => {
    // Sanity bound on the pool: if this collapses, the pool derivation broke.
    const reachable = reachableFrom(real, ['lamball', 'cattiva'])
    expect(reachable.size).toBeGreaterThan(breedingData.pals.length / 2)
  })
})

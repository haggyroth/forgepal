import { describe, expect, it } from 'vitest'
import { comboKey, derivePool, nearestInPool } from './normalize-breeding.ts'
import type { SpecialCombo } from '../../src/types/breeding.ts'

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

describe('derivePool', () => {
  const combos: SpecialCombo[] = [
    { parentA: 'relaxaurus', parentB: 'sparkit', child: 'relaxaurus-lux' },
    // Self-pair rows mark species obtainable only by pairing two of their own.
    { parentA: 'jetragon', parentB: 'jetragon', child: 'jetragon' },
  ]

  it('excludes every special-combo child', () => {
    const pool = derivePool(['Relaxaurus', 'Sparkit', 'Relaxaurus Lux', 'Jetragon'], combos)
    expect([...pool].sort()).toEqual(['relaxaurus', 'sparkit'])
  })

  it('keeps pals that are only ever parents', () => {
    const pool = derivePool(['Relaxaurus', 'Sparkit'], combos)
    expect(pool.has('relaxaurus')).toBe(true)
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

  it('reproduces the worked example upstream verified in game', () => {
    // Turtacle 2410 + Aegidron 30 -> target 1220, an exact tie between
    // Quivern 1210 and Nitemary 1230. Observed result was Nitemary.
    const real = pooled([
      ['quivern', 1210],
      ['nitemary', 1230],
      ['far', 3000],
    ])
    const target = Math.floor((2410 + 30 + 1) / 2)

    expect(target).toBe(1220)
    const result = nearestInPool(real, target, 'higher')
    expect(result.id).toBe('nitemary')
    expect(result.tied).toBe(true)
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

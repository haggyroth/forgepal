// `comboKey` and `nearestInPool` moved to src/lib/breeding.ts, where the engine
// and this importer both consume them; their tests live alongside them.
import { describe, expect, it } from 'vitest'
import { derivePool } from './normalize-breeding.ts'
import type { SpecialCombo } from '../../src/types/breeding.ts'

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

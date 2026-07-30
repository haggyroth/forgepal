import { describe, expect, it } from 'vitest'
import {
  buildShareUrl,
  decodeState,
  encodeState,
  isEmptyState,
  type SharedState,
} from './shareState'
import { MAX_TECH_LEVEL } from './tech'

const known = (ids: string[]) => (id: string) => ids.includes(id)
const all = () => true

const state = (build: [string, number][], playerLevel: number | null = null): SharedState => ({
  build: build.map(([itemId, quantity]) => ({ itemId, quantity })),
  playerLevel,
})

describe('encodeState', () => {
  it('encodes items and quantities readably', () => {
    expect(encodeState(state([['mega-sphere', 20]]))).toBe('build=mega-sphere.20')
  })

  it('joins multiple entries', () => {
    expect(
      encodeState(
        state([
          ['mega-sphere', 20],
          ['ingot', 5],
        ]),
      ),
    ).toBe('build=mega-sphere.20_ingot.5')
  })

  it('does not percent-encode its own separators', () => {
    const encoded = encodeState(
      state([
        ['a-b', 1],
        ['c-d', 2],
      ]),
    )
    expect(encoded).not.toContain('%')
  })

  it('includes the player level when set', () => {
    expect(encodeState(state([['ingot', 1]], 34))).toContain('level=34')
  })

  it('omits the level when unset', () => {
    expect(encodeState(state([['ingot', 1]]))).not.toContain('level')
  })

  it('drops zero, negative, and non-finite quantities', () => {
    expect(
      encodeState(
        state([
          ['a', 0],
          ['b', -3],
          ['c', Number.NaN],
        ]),
      ),
    ).toBe('')
  })

  it('returns an empty string when there is nothing to share', () => {
    expect(encodeState(state([]))).toBe('')
  })

  it('floors fractional quantities', () => {
    expect(encodeState(state([['ingot', 2.9]]))).toBe('build=ingot.2')
  })
})

describe('decodeState', () => {
  it('round-trips a build list', () => {
    const original = state(
      [
        ['mega-sphere', 20],
        ['ingot', 5],
      ],
      34,
    )
    const decoded = decodeState(encodeState(original), all).state
    expect(decoded).toEqual(original)
  })

  it('round-trips ids containing hyphens', () => {
    const original = state([['disposable-implant-heart-of-the-immovable-king', 3]])
    expect(decodeState(encodeState(original), all).state.build).toEqual(original.build)
  })

  it('tolerates a leading question mark', () => {
    expect(decodeState('?build=ingot.5', all).state.build).toEqual([
      { itemId: 'ingot', quantity: 5 },
    ])
  })

  it('reports ids that are not in the dataset instead of keeping them', () => {
    const result = decodeState('build=ingot.5_ghost-item.2', known(['ingot']))
    expect(result.state.build).toEqual([{ itemId: 'ingot', quantity: 5 }])
    expect(result.unknownIds).toEqual(['ghost-item'])
  })

  it('ignores malformed chunks without throwing', () => {
    const result = decodeState('build=_.._ingot.5_nope_.7_x.', all)
    expect(result.state.build).toEqual([{ itemId: 'ingot', quantity: 5 }])
  })

  it('rejects ids outside the allowed character set', () => {
    // Defends against anything odd being smuggled through a shared link.
    expect(decodeState('build=<script>.5', all).state.build).toEqual([])
    expect(decodeState('build=Ingot.5', all).state.build).toEqual([])
  })

  it('drops non-positive and unparseable quantities', () => {
    expect(decodeState('build=a.0_b.-2_c.abc', all).state.build).toEqual([])
  })

  it('keeps only the first of a duplicated id', () => {
    expect(decodeState('build=ingot.5_ingot.9', all).state.build).toEqual([
      { itemId: 'ingot', quantity: 5 },
    ])
  })

  it('caps absurd quantities', () => {
    expect(decodeState('build=ingot.99999999', all).state.build[0].quantity).toBe(99_999)
  })

  it('caps the number of entries', () => {
    const huge = Array.from({ length: 500 }, (_, i) => `item-${i}.1`).join('_')
    expect(decodeState(`build=${huge}`, all).state.build.length).toBeLessThanOrEqual(200)
  })

  it('clamps and rejects bad levels', () => {
    expect(decodeState('level=999', all).state.playerLevel).toBe(MAX_TECH_LEVEL)
    expect(decodeState('level=0', all).state.playerLevel).toBeNull()
    expect(decodeState('level=abc', all).state.playerLevel).toBeNull()
    expect(decodeState('', all).state.playerLevel).toBeNull()
  })

  it('returns an empty state for empty or junk input', () => {
    expect(decodeState('', all).state.build).toEqual([])
    expect(decodeState('?foo=bar&baz', all).state.build).toEqual([])
  })
})

describe('buildShareUrl', () => {
  it('appends the query to the page location', () => {
    expect(buildShareUrl(state([['ingot', 5]]), 'https://example.com', '/forgepal/')).toBe(
      'https://example.com/forgepal/?build=ingot.5',
    )
  })

  it('omits the query entirely when there is nothing to share', () => {
    expect(buildShareUrl(state([]), 'https://example.com', '/forgepal/')).toBe(
      'https://example.com/forgepal/',
    )
  })
})

describe('isEmptyState', () => {
  it('is true only when nothing is set', () => {
    expect(isEmptyState(state([]))).toBe(true)
    expect(isEmptyState(state([], 20))).toBe(false)
    expect(isEmptyState(state([['ingot', 1]]))).toBe(false)
  })
})

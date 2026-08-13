import { describe, expect, it } from 'vitest'
import { applyBreeding, decodeBreeding, emptyBreedingState } from './breedingQuery'

const known = () => true

describe('decodeBreeding', () => {
  it('reads a pair and a target', () => {
    const state = decodeBreeding('?pair=chillet.arsox&target=jetragon', known)

    expect(state.pairA).toBe('chillet')
    expect(state.pairB).toBe('arsox')
    expect(state.target).toBe('jetragon')
  })

  it('returns the empty state for a query with neither', () => {
    expect(decodeBreeding('?tab=breeding', known)).toEqual(emptyBreedingState)
  })

  it('ignores the calculator params that share the query string', () => {
    const state = decodeBreeding('?build=ingot.5&level=25&tab=breeding&target=anubis', known)

    expect(state.target).toBe('anubis')
    expect(state.pairA).toBeNull()
  })

  it('drops ids the dataset no longer has', () => {
    // A link shared before a data refresh. Dropping beats showing a selection
    // the solver would silently ignore.
    const state = decodeBreeding(
      '?pair=chillet.ghost-pal&target=ghost-pal',
      (id) => id === 'chillet',
    )

    expect(state.pairA).toBe('chillet')
    expect(state.pairB).toBeNull()
    expect(state.target).toBeNull()
  })

  it('rejects anything that is not an id shape', () => {
    for (const query of [
      '?target=NotAnId',
      '?target=has spaces',
      '?target=<script>',
      '?target=a.b',
      '?pair=.',
    ]) {
      const state = decodeBreeding(query, known)
      expect(state.target).toBeNull()
      expect(state.pairA).toBeNull()
    }
  })

  it('survives a half-written pair', () => {
    expect(decodeBreeding('?pair=chillet', known).pairA).toBe('chillet')
    expect(decodeBreeding('?pair=chillet', known).pairB).toBeNull()
    expect(decodeBreeding('?pair=', known)).toEqual(emptyBreedingState)
  })
})

describe('applyBreeding', () => {
  it('writes both params', () => {
    const query = applyBreeding('', { pairA: 'chillet', pairB: 'arsox', target: 'anubis' })

    expect(query).toContain('pair=chillet.arsox')
    expect(query).toContain('target=anubis')
  })

  it('leaves every other param alone', () => {
    // The invariant that matters: the calculator's build and the tab live here
    // too, and a writer that rebuilt the query wholesale would erase them.
    const query = applyBreeding('?build=ingot.5&level=25&tab=breeding', {
      pairA: 'chillet',
      pairB: 'arsox',
      target: null,
    })

    expect(query).toContain('build=ingot.5')
    expect(query).toContain('level=25')
    expect(query).toContain('tab=breeding')
    expect(query).toContain('pair=chillet.arsox')
  })

  it('removes its params when cleared, touching nothing else', () => {
    const query = applyBreeding('?tab=breeding&pair=chillet.arsox&target=anubis', {
      pairA: null,
      pairB: null,
      target: null,
    })

    expect(query).toBe('tab=breeding')
  })

  it('writes no pair until both halves are chosen', () => {
    // A dangling `pair=chillet.` restores nothing while looking like it should.
    expect(applyBreeding('', { pairA: 'chillet', pairB: null, target: null })).toBe('')
    expect(applyBreeding('', { pairA: null, pairB: 'arsox', target: null })).toBe('')
  })

  it('keeps the separators readable rather than percent-encoded', () => {
    // formatQuery's whole purpose: a shared link should be legible by eye.
    const query = applyBreeding('', { pairA: 'chillet', pairB: 'arsox', target: null })
    expect(query).toBe('pair=chillet.arsox')
    expect(query).not.toContain('%2E')
  })

  it('round-trips through decodeBreeding', () => {
    const state = { pairA: 'chillet', pairB: 'arsox', target: 'anubis' }
    expect(decodeBreeding(applyBreeding('', state), known)).toEqual(state)
  })

  it('does not carry the roster, which is not part of the question', () => {
    // Deliberate: a link asks "what makes this?", and the recipient's own roster
    // answers it. See rosterState.ts.
    const query = applyBreeding('', { pairA: 'chillet', pairB: 'arsox', target: 'anubis' })
    expect(query).not.toContain('roster')
  })
})

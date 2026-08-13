// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRoster, saveRoster } from './rosterState'

const known = () => true
const KEY = 'forgepal:roster:v1'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('saveRoster / loadRoster', () => {
  it('round-trips a roster', () => {
    saveRoster(['chillet', 'arsox'])
    expect(loadRoster(known)).toEqual(['chillet', 'arsox'])
  })

  it('preserves insertion order', () => {
    // The solver does not care, but a list that reshuffles between visits looks
    // broken.
    saveRoster(['zoe', 'anubis', 'chillet'])
    expect(loadRoster(known)).toEqual(['zoe', 'anubis', 'chillet'])
  })

  it('returns an empty roster when nothing is stored', () => {
    expect(loadRoster(known)).toEqual([])
  })

  it('removes the key rather than storing an empty roster', () => {
    saveRoster(['chillet'])
    saveRoster([])
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('stays out of the URL', () => {
    // A breeding link carries the question, not your Pals — see rosterState.ts.
    saveRoster(['chillet', 'arsox'])
    expect(window.location.search).toBe('')
  })
})

describe('what loadRoster refuses to trust', () => {
  it('drops ids the dataset no longer has', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['chillet', 'ghost-pal', 'arsox']))
    expect(loadRoster((id) => id !== 'ghost-pal')).toEqual(['chillet', 'arsox'])
  })

  it('deduplicates, keeping the first position', () => {
    // Editable in devtools, and a repeated Pal would pair with itself twice in
    // the solver for no benefit.
    window.localStorage.setItem(KEY, JSON.stringify(['chillet', 'arsox', 'chillet']))
    expect(loadRoster(known)).toEqual(['chillet', 'arsox'])
  })

  it('drops non-string entries', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['chillet', 42, null, { id: 'arsox' }]))
    expect(loadRoster(known)).toEqual(['chillet'])
  })

  it('treats anything that is not an array as absent', () => {
    for (const junk of ['not json', '{}', 'null', '"chillet"', '42']) {
      window.localStorage.setItem(KEY, junk)
      expect(loadRoster(known)).toEqual([])
    }
  })

  it('never throws, whatever is in the key', () => {
    for (const junk of ['not json', '[', '[1,2,', '{"roster":["chillet"]}']) {
      window.localStorage.setItem(KEY, junk)
      expect(() => loadRoster(known)).not.toThrow()
    }
  })
})

describe('storage that is unavailable', () => {
  it('does not throw on save', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => saveRoster(['chillet'])).not.toThrow()
  })

  it('does not throw when clearing fails', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(() => saveRoster([])).not.toThrow()
  })

  it('falls back to an empty roster when reading fails', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(loadRoster(known)).toEqual([])
  })
})

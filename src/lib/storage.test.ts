// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPersisted, loadPersisted, savePersisted } from './storage'
import { emptyState, type SharedState } from './shareState'

const known = () => true
const KEY = 'forgepal:build:v1'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

function state(build: [string, number][], playerLevel: number | null = null): SharedState {
  return { build: build.map(([itemId, quantity]) => ({ itemId, quantity })), playerLevel }
}

describe('savePersisted / loadPersisted', () => {
  it('round-trips a build', () => {
    savePersisted(state([['ingot', 7]], 25))

    const loaded = loadPersisted(known)
    expect(loaded.build).toEqual([{ itemId: 'ingot', quantity: 7 }])
    expect(loaded.playerLevel).toBe(25)
  })

  it('stores the same encoding the shareable URL uses', () => {
    // One format for both, so a saved build can become a link with no
    // conversion step in between.
    savePersisted(state([['ingot', 7]], 25))
    expect(window.localStorage.getItem(KEY)).toBe('build=ingot.7&level=25')
  })

  it('removes the key rather than storing an empty build', () => {
    savePersisted(state([['ingot', 7]]))
    savePersisted(emptyState)

    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('returns the empty state when nothing is stored', () => {
    expect(loadPersisted(known)).toEqual(emptyState)
  })

  it('drops ids the dataset no longer has', () => {
    window.localStorage.setItem(KEY, 'build=ingot.4_ghost-widget.9')

    const loaded = loadPersisted((id) => id !== 'ghost-widget')
    expect(loaded.build).toEqual([{ itemId: 'ingot', quantity: 4 }])
  })
})

describe('storage that is unavailable', () => {
  /**
   * The reason every access in storage.ts is wrapped. localStorage throws in
   * Safari private browsing and when a user has disabled site data, and it
   * throws on write once the quota is full.
   *
   * Losing persistence is a mild annoyance. An unhandled throw here is a blank
   * page on startup, so these are the tests that matter most in this file.
   */
  it('does not throw when setItem fails', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    expect(() => savePersisted(state([['ingot', 7]]))).not.toThrow()
  })

  it('does not throw when removeItem fails', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(() => savePersisted(emptyState)).not.toThrow()
    expect(() => clearPersisted()).not.toThrow()
  })

  it('falls back to the empty state when getItem fails', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(loadPersisted(known)).toEqual(emptyState)
  })
})

describe('a corrupt stored payload', () => {
  /**
   * This value is user-editable via devtools, and it is the most plausible
   * real-world route to a render throw — which is why the tab panels have an
   * error boundary as well. Decoding must degrade, never explode.
   */
  it('never throws, whatever is in the key', () => {
    for (const junk of ['', 'not a query', 'build=', 'build=_.._x', 'build=ingot.notanumber']) {
      window.localStorage.setItem(KEY, junk)
      expect(() => loadPersisted(known)).not.toThrow()
    }
  })

  it('yields an empty build rather than a phantom row', () => {
    window.localStorage.setItem(KEY, 'build=_.._nope_.7_x.')
    expect(loadPersisted(known).build).toEqual([])
  })

  it('keeps the entries it can still read from a partly broken payload', () => {
    window.localStorage.setItem(KEY, 'build=ingot.4_.._ore.2')

    expect(loadPersisted(known).build).toEqual([
      { itemId: 'ingot', quantity: 4 },
      { itemId: 'ore', quantity: 2 },
    ])
  })
})

describe('clearPersisted', () => {
  it('removes a stored build', () => {
    savePersisted(state([['ingot', 7]]))
    clearPersisted()

    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(loadPersisted(known)).toEqual(emptyState)
  })

  it('is a no-op when there is nothing stored', () => {
    expect(() => clearPersisted()).not.toThrow()
  })
})

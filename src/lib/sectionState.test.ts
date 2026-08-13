// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSectionState, readSectionOpen, writeSectionOpen } from './sectionState'

const KEY = 'forgepal:sections:v1'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('readSectionOpen', () => {
  it('returns null when the user has never set a preference', () => {
    // Distinct from `false`: null means "no opinion, use the component default",
    // and collapsing everything by default would be a different product.
    expect(readSectionOpen('totals')).toBeNull()
  })

  it('round-trips both true and false', () => {
    writeSectionOpen('totals', false)
    expect(readSectionOpen('totals')).toBe(false)

    writeSectionOpen('totals', true)
    expect(readSectionOpen('totals')).toBe(true)
  })

  it('keeps sections independent', () => {
    writeSectionOpen('totals', false)
    writeSectionOpen('breakdown', true)

    expect(readSectionOpen('totals')).toBe(false)
    expect(readSectionOpen('breakdown')).toBe(true)
    expect(readSectionOpen('catalogue')).toBeNull()
  })
})

describe('writeSectionOpen', () => {
  it('reads before writing, so toggling one section keeps the others', () => {
    // The bug this guards: a blind write would drop every other section's
    // preference on each toggle, and the symptom — panels reverting when you
    // collapse an unrelated one — reads as a rendering problem, not a storage one.
    writeSectionOpen('a', false)
    writeSectionOpen('b', false)
    writeSectionOpen('c', true)

    expect(readSectionOpen('a')).toBe(false)
    expect(readSectionOpen('b')).toBe(false)
    expect(readSectionOpen('c')).toBe(true)
  })

  it('overwrites an existing preference in place', () => {
    writeSectionOpen('a', false)
    writeSectionOpen('a', true)

    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ a: true })
  })
})

describe('a corrupt or hand-edited payload', () => {
  it('treats anything that is not an object of booleans as absent', () => {
    for (const junk of ['not json', '[]', 'null', '"a string"', '42']) {
      window.localStorage.setItem(KEY, junk)
      expect(readSectionOpen('totals')).toBeNull()
    }
  })

  it('keeps the boolean entries and ignores the rest', () => {
    // The value is editable in devtools, so a mixed object is reachable. A
    // non-boolean must not become a truthy "open" by accident.
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ totals: false, breakdown: 'yes', catalogue: 1, route: true }),
    )

    expect(readSectionOpen('totals')).toBe(false)
    expect(readSectionOpen('route')).toBe(true)
    expect(readSectionOpen('breakdown')).toBeNull()
    expect(readSectionOpen('catalogue')).toBeNull()
  })

  it('does not lose the valid entries when writing over a broken payload', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ totals: false, junk: 'nope' }))
    writeSectionOpen('route', true)

    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ totals: false, route: true })
  })
})

describe('storage that is unavailable', () => {
  it('does not throw on read', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(() => readSectionOpen('totals')).not.toThrow()
    expect(readSectionOpen('totals')).toBeNull()
  })

  it('does not throw on write', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    expect(() => writeSectionOpen('totals', false)).not.toThrow()
  })

  it('does not throw on clear', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(() => clearSectionState()).not.toThrow()
  })
})

describe('clearSectionState', () => {
  it('forgets every preference', () => {
    writeSectionOpen('a', false)
    writeSectionOpen('b', true)
    clearSectionState()

    expect(readSectionOpen('a')).toBeNull()
    expect(readSectionOpen('b')).toBeNull()
  })
})

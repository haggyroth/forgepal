// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadInventory, saveInventory } from './inventoryState'

const known = () => true
const KEY = 'forgepal:inventory:v1'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('saveInventory / loadInventory', () => {
  it('round-trips stock', () => {
    saveInventory(new Map([['ore', 40]]))
    expect([...loadInventory(known)]).toEqual([['ore', 40]])
  })

  it('returns an empty map when nothing is stored', () => {
    expect(loadInventory(known).size).toBe(0)
  })

  it('removes the key rather than storing an empty inventory', () => {
    saveInventory(new Map([['ore', 40]]))
    saveInventory(new Map())

    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('stays out of the URL', () => {
    // Deliberate: a link hands someone a build, and baking your chest contents
    // into it would show them a requisition already reduced by materials they
    // do not own — quietly wrong rather than merely unhelpful.
    saveInventory(new Map([['ore', 40]]))
    expect(window.location.search).toBe('')
  })
})

describe('what loadInventory refuses to trust', () => {
  it('drops ids the dataset no longer has', () => {
    // Same rule as a shared link: an item removed upstream should disappear
    // rather than linger as a phantom row you cannot clear.
    window.localStorage.setItem(KEY, JSON.stringify({ ore: 40, 'ghost-widget': 5 }))

    expect([...loadInventory((id) => id !== 'ghost-widget')]).toEqual([['ore', 40]])
  })

  it('drops non-numeric and non-positive quantities', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ore: 40, stone: '60', wood: 0, fiber: -5, paldium: null }),
    )

    expect([...loadInventory(known)]).toEqual([['ore', 40]])
  })

  it('floors fractional quantities', () => {
    // You cannot hold 2.7 Ore. A fraction here means someone edited the value.
    window.localStorage.setItem(KEY, JSON.stringify({ ore: 2.7 }))
    expect(loadInventory(known).get('ore')).toBe(2)
  })

  it('treats anything that is not a flat object as absent', () => {
    for (const junk of ['not json', '[]', 'null', '"a string"', '42']) {
      window.localStorage.setItem(KEY, junk)
      expect(loadInventory(known).size).toBe(0)
    }
  })

  it('never throws, whatever is in the key', () => {
    for (const junk of ['not json', '{', '[1,2,3]', '{"ore":{"nested":1}}']) {
      window.localStorage.setItem(KEY, junk)
      expect(() => loadInventory(known)).not.toThrow()
    }
  })
})

describe('storage that is unavailable', () => {
  it('does not throw on save', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    expect(() => saveInventory(new Map([['ore', 40]]))).not.toThrow()
  })

  it('does not throw when clearing fails', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(() => saveInventory(new Map())).not.toThrow()
  })

  it('falls back to an empty map when reading fails', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(loadInventory(known).size).toBe(0)
  })
})

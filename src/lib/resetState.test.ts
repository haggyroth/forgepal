// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPersistedState } from './resetState'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('resetPersistedState', () => {
  it('removes every forgepal key', () => {
    window.localStorage.setItem('forgepal:build:v1', 'build=ingot.7')
    window.localStorage.setItem('forgepal:builds:v1', '{"corrupt":true}')
    window.localStorage.setItem('forgepal:inventory:v1', '{"ore":40}')
    window.localStorage.setItem('forgepal:sections:v1', '{"totals":false}')

    resetPersistedState()

    expect(window.localStorage.length).toBe(0)
  })

  it('clears all of them in one pass', () => {
    // The trap: removing while iterating by index shifts everything down one, so
    // a naive loop deletes roughly every other key and the reset silently leaves
    // the corrupt payload that prompted it.
    for (let i = 0; i < 10; i += 1) {
      window.localStorage.setItem(`forgepal:key-${i}`, String(i))
    }

    resetPersistedState()

    expect(window.localStorage.length).toBe(0)
  })

  it('leaves other keys on the origin alone', () => {
    // github.io is a shared origin — every Pages site under haggyroth.github.io
    // reads and writes the same localStorage. Someone else's key is not ours.
    window.localStorage.setItem('forgepal:builds:v1', '{}')
    window.localStorage.setItem('unrelated:key', 'kept')
    window.localStorage.setItem('another-app', 'also kept')

    resetPersistedState()

    expect(window.localStorage.getItem('forgepal:builds:v1')).toBeNull()
    expect(window.localStorage.getItem('unrelated:key')).toBe('kept')
    expect(window.localStorage.getItem('another-app')).toBe('also kept')
  })

  it('matches on the prefix, not a substring', () => {
    window.localStorage.setItem('not-forgepal:builds', 'kept')

    resetPersistedState()

    expect(window.localStorage.getItem('not-forgepal:builds')).toBe('kept')
  })

  it('covers a key added later without being told about it', () => {
    // The reason this is prefix-based. A future state module gets cleared for
    // free rather than being forgotten here and surviving the reset.
    window.localStorage.setItem('forgepal:something-not-invented-yet:v1', 'x')

    resetPersistedState()

    expect(window.localStorage.getItem('forgepal:something-not-invented-yet:v1')).toBeNull()
  })

  it('is a no-op on a clean slate', () => {
    expect(() => resetPersistedState()).not.toThrow()
    expect(window.localStorage.length).toBe(0)
  })

  it('does not throw when storage is unavailable', () => {
    // Safari private browsing, or site data disabled. The boundary calls this
    // and then reloads; throwing here would strand the user on the fallback.
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    window.localStorage.setItem('forgepal:builds:v1', '{}')

    expect(() => resetPersistedState()).not.toThrow()
  })
})

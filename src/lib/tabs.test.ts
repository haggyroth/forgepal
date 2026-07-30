import { describe, expect, it } from 'vitest'
import { applyTab, DEFAULT_TAB, decodeTab, TABS } from './tabs'

describe('decodeTab', () => {
  it('reads a known tab', () => {
    expect(decodeTab('?tab=breeding')).toBe('breeding')
  })

  it('accepts a query with or without the leading ?', () => {
    expect(decodeTab('tab=breeding')).toBe('breeding')
  })

  it('falls back to the default for anything unrecognised', () => {
    // A link from a future version naming a tab we don't have should open the
    // app, not a blank screen.
    expect(decodeTab('?tab=teleporter')).toBe(DEFAULT_TAB)
    expect(decodeTab('?tab=')).toBe(DEFAULT_TAB)
    expect(decodeTab('')).toBe(DEFAULT_TAB)
  })

  it('ignores the rest of the query', () => {
    expect(decodeTab('?build=ingot.5&tab=breeding&level=20')).toBe('breeding')
  })
})

describe('applyTab', () => {
  it('omits the default, so links shared before tabs existed still mean the same thing', () => {
    expect(applyTab('?build=ingot.5', DEFAULT_TAB)).toBe('build=ingot.5')
    expect(applyTab('', DEFAULT_TAB)).toBe('')
  })

  it('drops a tab param when switching back to the default', () => {
    expect(applyTab('?tab=breeding&build=ingot.5', DEFAULT_TAB)).toBe('build=ingot.5')
  })

  it('preserves the build params it does not own', () => {
    expect(applyTab('?build=ingot.5&level=20', 'breeding')).toBe(
      'build=ingot.5&level=20&tab=breeding',
    )
  })

  it('does not escape the separators build ids rely on', () => {
    // The '.' and '_' must survive; percent-encoding them makes shared links
    // unreadable, which is the point of the readable wire format.
    expect(applyTab('?build=mega-sphere.20_ingot.5', 'breeding')).toContain(
      'build=mega-sphere.20_ingot.5',
    )
  })

  it('round-trips every tab', () => {
    for (const tab of TABS) {
      expect(decodeTab(`?${applyTab('', tab.id)}`)).toBe(tab.id)
    }
  })
})

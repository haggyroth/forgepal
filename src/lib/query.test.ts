import { describe, expect, it } from 'vitest'
import { formatQuery, parseQuery } from './query'

/**
 * The two functions every URL writer goes through.
 *
 * `applyState` and `applyTab` are covered in their own suites, including the
 * invariant that each touches only its own params. What is tested here is the
 * layer underneath: that a query survives the round trip, and that formatting
 * leaves our separators alone.
 */
describe('parseQuery', () => {
  it('accepts a search string with or without the leading ?', () => {
    expect(parseQuery('?build=ingot.5').get('build')).toBe('ingot.5')
    expect(parseQuery('build=ingot.5').get('build')).toBe('ingot.5')
  })

  it('reads an empty search as no params rather than throwing', () => {
    expect([...parseQuery('').keys()]).toEqual([])
    expect([...parseQuery('?').keys()]).toEqual([])
  })

  it('keeps every param, not just the first', () => {
    const params = parseQuery('?build=ingot.5&level=10&tab=breeding')
    expect(params.get('build')).toBe('ingot.5')
    expect(params.get('level')).toBe('10')
    expect(params.get('tab')).toBe('breeding')
  })

  it('only strips a leading ?, not one inside a value', () => {
    expect(parseQuery('?q=a?b').get('q')).toBe('a?b')
  })
})

describe('formatQuery', () => {
  it('leaves the separators our ids rely on unescaped', () => {
    // The whole reason this function exists. URLSearchParams percent-encodes
    // '.' and '_' in some engines, and a build param is nothing but ids joined
    // by them — escaping turns a readable shared link into noise.
    const params = new URLSearchParams()
    params.set('build', 'mega-sphere.20_ingot.5')

    expect(formatQuery(params)).toBe('build=mega-sphere.20_ingot.5')
  })

  it('still escapes characters that actually need it', () => {
    // Not a blanket unescape: only '.' and '_' are known-safe here.
    const params = new URLSearchParams()
    params.set('name', 'a b&c=d')

    const formatted = formatQuery(params)
    expect(formatted).toContain('+')
    expect(formatted).toContain('%26')
    expect(formatted).toContain('%3D')
  })

  it('round-trips through parseQuery', () => {
    const original = '?build=mega-sphere.20_ingot.5&level=34&tab=breeding'
    expect(formatQuery(parseQuery(original))).toBe(original.slice(1))
  })

  it('returns an empty string for no params, so the caller can drop the ?', () => {
    expect(formatQuery(new URLSearchParams())).toBe('')
  })
})

// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useRoster } from './useRoster'

const known = () => true
const KEY = 'forgepal:roster:v1'

beforeEach(() => window.localStorage.clear())

describe('useRoster', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useRoster(known))
    expect(result.current.roster).toEqual([])
  })

  it('adds in order', () => {
    const { result } = renderHook(() => useRoster(known))

    act(() => result.current.add('chillet'))
    act(() => result.current.add('arsox'))

    expect(result.current.roster).toEqual(['chillet', 'arsox'])
  })

  it('ignores a duplicate rather than growing the list', () => {
    const { result } = renderHook(() => useRoster(known))

    act(() => result.current.add('chillet'))
    act(() => result.current.add('chillet'))

    expect(result.current.roster).toEqual(['chillet'])
  })

  it('removes one without disturbing the rest', () => {
    const { result } = renderHook(() => useRoster(known))

    act(() => result.current.add('chillet'))
    act(() => result.current.add('arsox'))
    act(() => result.current.add('anubis'))
    act(() => result.current.remove('arsox'))

    expect(result.current.roster).toEqual(['chillet', 'anubis'])
  })

  it('ignores a remove for something not in the roster', () => {
    const { result } = renderHook(() => useRoster(known))
    act(() => result.current.add('chillet'))
    act(() => result.current.remove('arsox'))

    expect(result.current.roster).toEqual(['chillet'])
  })

  it('clears everything', () => {
    const { result } = renderHook(() => useRoster(known))
    act(() => result.current.add('chillet'))
    act(() => result.current.clear())

    expect(result.current.roster).toEqual([])
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe('persistence', () => {
  it('saves on every change, with no explicit save step', () => {
    const { result } = renderHook(() => useRoster(known))
    act(() => result.current.add('chillet'))

    expect(window.localStorage.getItem(KEY)).toContain('chillet')
  })

  it('restores on the next mount', () => {
    const first = renderHook(() => useRoster(known))
    act(() => first.result.current.add('chillet'))
    act(() => first.result.current.add('arsox'))
    first.unmount()

    const { result } = renderHook(() => useRoster(known))
    expect(result.current.roster).toEqual(['chillet', 'arsox'])
  })

  it('drops ids the dataset no longer has on load', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['chillet', 'ghost-pal']))

    const { result } = renderHook(() => useRoster((id) => id !== 'ghost-pal'))
    expect(result.current.roster).toEqual(['chillet'])
  })

  it('mounts fine on a corrupt payload', () => {
    window.localStorage.setItem(KEY, 'not json')

    const { result } = renderHook(() => useRoster(known))
    expect(result.current.roster).toEqual([])
  })
})

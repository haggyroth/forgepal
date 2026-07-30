// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBuildList } from './useBuildList'

describe('useBuildList', () => {
  it('starts empty by default', () => {
    const { result } = renderHook(() => useBuildList())
    expect(result.current.entries).toEqual([])
  })

  it('restores an initial build synchronously', () => {
    // Restoring in an effect instead would flash an empty list on every load
    // for anyone with a saved or shared build.
    const { result } = renderHook(() => useBuildList([{ itemId: 'ingot', quantity: 5 }]))
    expect(result.current.entries).toEqual([{ itemId: 'ingot', quantity: 5 }])
  })

  it('adds items and accumulates repeats', () => {
    const { result } = renderHook(() => useBuildList())

    act(() => result.current.add('ingot'))
    act(() => result.current.add('ingot', 4))
    expect(result.current.entries).toEqual([{ itemId: 'ingot', quantity: 5 }])
  })

  it('preserves insertion order as quantities change', () => {
    // A Map, not an object: reordering under the cursor while stepping a
    // quantity would be maddening.
    const { result } = renderHook(() => useBuildList())

    act(() => result.current.add('zebra'))
    act(() => result.current.add('apple'))
    act(() => result.current.setQuantity('zebra', 99))

    expect(result.current.entries.map((e) => e.itemId)).toEqual(['zebra', 'apple'])
  })

  it('keeps a row at zero rather than removing it', () => {
    // Typing over a quantity passes through 0; dropping the row mid-edit would
    // steal focus.
    const { result } = renderHook(() => useBuildList([{ itemId: 'ingot', quantity: 5 }]))

    act(() => result.current.setQuantity('ingot', 0))
    expect(result.current.entries).toEqual([{ itemId: 'ingot', quantity: 0 }])
  })

  it('clamps negatives to zero', () => {
    const { result } = renderHook(() => useBuildList())
    act(() => result.current.setQuantity('ingot', -10))
    expect(result.current.quantities.get('ingot')).toBe(0)
  })

  it('clamps absurd quantities and floors fractions', () => {
    const { result } = renderHook(() => useBuildList())

    act(() => result.current.setQuantity('a', 10 ** 9))
    act(() => result.current.setQuantity('b', 2.9))
    expect(result.current.quantities.get('a')).toBe(99_999)
    expect(result.current.quantities.get('b')).toBe(2)
  })

  it('coerces non-finite input to zero instead of NaN', () => {
    const { result } = renderHook(() => useBuildList())
    act(() => result.current.setQuantity('ingot', Number.NaN))
    expect(result.current.quantities.get('ingot')).toBe(0)
  })

  it('removes a single item', () => {
    const { result } = renderHook(() =>
      useBuildList([
        { itemId: 'a', quantity: 1 },
        { itemId: 'b', quantity: 2 },
      ]),
    )

    act(() => result.current.remove('a'))
    expect(result.current.entries).toEqual([{ itemId: 'b', quantity: 2 }])
  })

  it('clears everything', () => {
    const { result } = renderHook(() => useBuildList([{ itemId: 'a', quantity: 1 }]))
    act(() => result.current.clear())
    expect(result.current.entries).toEqual([])
  })

  it('keeps action identities stable across renders', () => {
    // App passes these straight into memoised children; new identities every
    // render would defeat that.
    const { result, rerender } = renderHook(() => useBuildList())
    const first = result.current.add
    rerender()
    expect(result.current.add).toBe(first)
  })
})

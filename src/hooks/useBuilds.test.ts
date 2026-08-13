// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useBuilds } from './useBuilds'

const known = () => true
const KEY = 'forgepal:builds:v1'
const LEGACY = 'forgepal:build:v1'

beforeEach(() => window.localStorage.clear())

function stored() {
  const raw = window.localStorage.getItem(KEY)
  return raw === null ? null : (JSON.parse(raw) as { builds: { name: string }[] })
}

describe('useBuilds', () => {
  it('starts with one empty build', () => {
    const { result } = renderHook(() => useBuilds(known))

    expect(result.current.builds).toHaveLength(1)
    expect(result.current.quantities.size).toBe(0)
    expect(result.current.activeId).toBe(result.current.builds[0].id)
  })

  it('adds, accumulates, sets, and removes', () => {
    const { result } = renderHook(() => useBuilds(known))

    act(() => result.current.add('ingot', 3))
    expect(result.current.quantities.get('ingot')).toBe(3)

    act(() => result.current.add('ingot', 2))
    expect(result.current.quantities.get('ingot')).toBe(5)

    act(() => result.current.setQuantity('ingot', 40))
    expect(result.current.quantities.get('ingot')).toBe(40)

    act(() => result.current.remove('ingot'))
    expect(result.current.quantities.has('ingot')).toBe(false)
  })

  it('clears the active build without deleting it', () => {
    const { result } = renderHook(() => useBuilds(known))

    act(() => result.current.add('ingot', 3))
    act(() => result.current.clear())

    expect(result.current.quantities.size).toBe(0)
    expect(result.current.builds).toHaveLength(1)
  })

  it('exposes entries in insertion order', () => {
    // The build list is an ordered Map on purpose — rows must not reshuffle
    // under the cursor as quantities change.
    const { result } = renderHook(() => useBuilds(known))

    act(() => result.current.add('ore', 1))
    act(() => result.current.add('ingot', 1))
    act(() => result.current.add('wood', 1))
    act(() => result.current.setQuantity('ore', 99))

    expect(result.current.entries.map((e) => e.itemId)).toEqual(['ore', 'ingot', 'wood'])
  })
})

describe('persistence', () => {
  it('saves on every edit, with no explicit save step', () => {
    // The single build already persisted without one. Requiring a save now would
    // be a regression: people would start losing work they currently never lose.
    const { result } = renderHook(() => useBuilds(known))
    act(() => result.current.add('ingot', 3))

    expect(window.localStorage.getItem(KEY)).toContain('ingot')
  })

  it('restores a saved collection on the next mount', () => {
    const first = renderHook(() => useBuilds(known))
    act(() => first.result.current.add('ingot', 7))
    act(() => first.result.current.rename('Ore run'))
    first.unmount()

    const { result } = renderHook(() => useBuilds(known))
    expect(result.current.name).toBe('Ore run')
    expect(result.current.quantities.get('ingot')).toBe(7)
  })

  it('migrates a build saved under the old single-build key', () => {
    window.localStorage.setItem(LEGACY, 'build=ingot.7&level=25')

    const { result } = renderHook(() => useBuilds(known))
    expect(result.current.quantities.get('ingot')).toBe(7)
    expect(result.current.playerLevel).toBe(25)
  })

  it('drops ids the dataset no longer has', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        activeId: 'a',
        builds: [{ id: 'a', name: 'A', quantities: { ore: 5, 'ghost-widget': 2 } }],
      }),
    )

    const { result } = renderHook(() => useBuilds((id) => id !== 'ghost-widget'))
    expect([...result.current.quantities.keys()]).toEqual(['ore'])
  })

  it('survives a corrupt payload rather than failing to mount', () => {
    // The most plausible route to a render throw, which is also why the tab
    // panels have an error boundary. Mounting must still succeed.
    for (const junk of ['not json', '[]', '{}', 'null', '{"builds":"nope"}']) {
      window.localStorage.setItem(KEY, junk)
      const { result, unmount } = renderHook(() => useBuilds(known))

      expect(result.current.builds.length).toBeGreaterThan(0)
      unmount()
    }
  })
})

describe('managing several builds', () => {
  it('creates a new build and makes it active', () => {
    const { result } = renderHook(() => useBuilds(known))
    act(() => result.current.add('ingot', 3))
    act(() => result.current.create())

    expect(result.current.builds).toHaveLength(2)
    expect(result.current.quantities.size).toBe(0)
  })

  it('duplicates the active build with its contents', () => {
    const { result } = renderHook(() => useBuilds(known))
    act(() => result.current.add('ingot', 3))
    act(() => result.current.duplicate())

    expect(result.current.builds).toHaveLength(2)
    expect(result.current.quantities.get('ingot')).toBe(3)
  })

  it('switches between builds without merging them', () => {
    const { result } = renderHook(() => useBuilds(known))
    const firstId = result.current.activeId

    act(() => result.current.add('ingot', 3))
    act(() => result.current.create())
    act(() => result.current.add('ore', 9))

    expect(result.current.quantities.has('ingot')).toBe(false)

    act(() => result.current.select(firstId))
    expect(result.current.quantities.get('ingot')).toBe(3)
    expect(result.current.quantities.has('ore')).toBe(false)
  })

  it('ignores a select for a build that does not exist', () => {
    const { result } = renderHook(() => useBuilds(known))
    const before = result.current.activeId

    act(() => result.current.select('nonexistent'))
    expect(result.current.activeId).toBe(before)
  })

  it('deletes the active build and leaves one behind', () => {
    const { result } = renderHook(() => useBuilds(known))
    act(() => result.current.create())
    expect(result.current.builds).toHaveLength(2)

    act(() => result.current.removeBuild())
    expect(result.current.builds).toHaveLength(1)
    expect(result.current.builds.some((b) => b.id === result.current.activeId)).toBe(true)
  })

  it('never leaves the collection without a build to be active', () => {
    // Deleting the last one has to leave something selectable, or the calculator
    // renders against an undefined build.
    const { result } = renderHook(() => useBuilds(known))
    act(() => result.current.removeBuild())

    expect(result.current.builds.length).toBeGreaterThan(0)
    expect(result.current.builds.some((b) => b.id === result.current.activeId)).toBe(true)
  })
})

describe('opening a shared link', () => {
  const shared = { build: [{ itemId: 'mega-sphere', quantity: 2 }], playerLevel: 30 }

  it('opens as its own build without clobbering a saved one', () => {
    window.localStorage.setItem(LEGACY, 'build=ingot.7')

    const { result } = renderHook(() => useBuilds(known, shared))

    expect(result.current.quantities.get('mega-sphere')).toBe(2)
    expect(result.current.quantities.has('ingot')).toBe(false)
    // Following someone's link must never cost you a list you had saved.
    expect(result.current.builds.map((b) => b.name)).toContain('My build')
  })

  it('is not persisted until something is edited', () => {
    // Writing it on load would add another copy every time the same link is
    // opened — one visit, one build, forever accumulating.
    const { result } = renderHook(() => useBuilds(known, shared))
    expect(stored()).toBeNull()

    act(() => result.current.add('mega-sphere', 1))
    expect(stored()).not.toBeNull()
  })

  it('applies the link tech level, which describes what it was planned against', () => {
    const { result } = renderHook(() => useBuilds(known, shared))
    expect(result.current.playerLevel).toBe(30)
  })

  it('keeps the saved tech level when the link carries none', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        activeId: 'a',
        playerLevel: 12,
        builds: [{ id: 'a', name: 'A', quantities: {} }],
      }),
    )

    const { result } = renderHook(() =>
      useBuilds(known, { build: [{ itemId: 'ore', quantity: 1 }], playerLevel: null }),
    )
    expect(result.current.playerLevel).toBe(12)
  })

  it('ignores an empty shared state entirely', () => {
    window.localStorage.setItem(LEGACY, 'build=ingot.7')

    const { result } = renderHook(() => useBuilds(known, { build: [], playerLevel: null }))
    expect(result.current.builds).toHaveLength(1)
    expect(result.current.quantities.get('ingot')).toBe(7)
  })

  it('does not collide names when a Shared build already exists', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        activeId: 'a',
        builds: [{ id: 'a', name: 'Shared build', quantities: {} }],
      }),
    )

    const { result } = renderHook(() => useBuilds(known, shared))
    const names = result.current.builds.map((b) => b.name)

    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('Shared build 2')
  })
})

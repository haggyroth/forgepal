// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadBuilds, saveBuilds } from './buildsState'
import { createBuild } from './builds'

const known = () => true
const KEY = 'forgepal:builds:v1'
const LEGACY = 'forgepal:build:v1'

beforeEach(() => window.localStorage.clear())

describe('loadBuilds', () => {
  it('starts with one empty build on a clean slate', () => {
    const c = loadBuilds(known)
    expect(c.builds).toHaveLength(1)
    expect(c.builds[0].quantities.size).toBe(0)
    expect(c.activeId).toBe(c.builds[0].id)
  })

  it('migrates a build saved under the old single-build key', () => {
    // Anyone using ForgePal before named builds shipped has one of these.
    // Starting them on an empty list would read as having lost it.
    window.localStorage.setItem(LEGACY, 'build=ingot.7_ore.3&level=25')
    const c = loadBuilds(known)

    expect(c.builds).toHaveLength(1)
    expect(c.builds[0].name).toBe('My build')
    expect(c.builds[0].quantities.get('ingot')).toBe(7)
    expect(c.playerLevel).toBe(25)
  })

  it('does not migrate when a collection already exists', () => {
    window.localStorage.setItem(LEGACY, 'build=ingot.7')
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ activeId: 'a', builds: [{ id: 'a', name: 'Kept', quantities: {} }] }),
    )
    expect(loadBuilds(known).builds.map((b) => b.name)).toEqual(['Kept'])
  })

  it('round-trips a saved collection', () => {
    const build = createBuild('Ore run', [{ itemId: 'ore', quantity: 40 }])
    saveBuilds({ builds: [build], activeId: build.id, playerLevel: 30 })

    const c = loadBuilds(known)
    expect(c.builds[0].name).toBe('Ore run')
    expect(c.builds[0].quantities.get('ore')).toBe(40)
    expect(c.playerLevel).toBe(30)
    expect(c.activeId).toBe(build.id)
  })

  it('drops items no longer in the dataset', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        activeId: 'a',
        builds: [{ id: 'a', name: 'A', quantities: { ore: 5, 'ghost-item': 2 } }],
      }),
    )
    const c = loadBuilds((id) => id !== 'ghost-item')
    expect([...c.builds[0].quantities.keys()]).toEqual(['ore'])
  })

  it('falls back to the first build when activeId points at nothing', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ activeId: 'gone', builds: [{ id: 'a', name: 'A', quantities: {} }] }),
    )
    expect(loadBuilds(known).activeId).toBe('a')
  })

  it('survives junk without throwing', () => {
    for (const junk of ['not json', '[]', '{}', 'null', '{"builds":"nope"}']) {
      window.localStorage.setItem(KEY, junk)
      expect(() => loadBuilds(known)).not.toThrow()
      expect(loadBuilds(known).builds.length).toBeGreaterThan(0)
    }
  })

  it('skips malformed build entries rather than failing the whole load', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        activeId: 'a',
        builds: [{ id: 'a', name: 'Good', quantities: {} }, { name: 'No id' }, null],
      }),
    )
    expect(loadBuilds(known).builds.map((b) => b.name)).toEqual(['Good'])
  })
})

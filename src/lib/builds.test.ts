import { describe, expect, it } from 'vitest'
import {
  addBuild,
  addToBuild,
  activeBuild,
  clampQuantity,
  createBuild,
  deleteBuild,
  MAX_BUILDS,
  nextBuildName,
  removeFromBuild,
  renameBuild,
  setInBuild,
  toEntries,
  type BuildCollection,
} from './builds'

const collectionOf = (...names: string[]): BuildCollection => {
  const builds = names.map((n) => createBuild(n))
  return { builds, activeId: builds[0].id, playerLevel: null }
}

describe('clampQuantity', () => {
  it('floors fractions and rejects negatives', () => {
    expect(clampQuantity(2.9)).toBe(2)
    expect(clampQuantity(-5)).toBe(0)
  })

  it('caps absurd values and coerces non-finite input', () => {
    expect(clampQuantity(10 ** 9)).toBe(99_999)
    expect(clampQuantity(Number.NaN)).toBe(0)
  })
})

describe('a single build', () => {
  it('accumulates repeat additions', () => {
    let q = addToBuild(new Map(), 'ingot')
    q = addToBuild(q, 'ingot', 4)
    expect(q.get('ingot')).toBe(5)
  })

  it('preserves insertion order as quantities change', () => {
    // A Map, not an object: reordering under the cursor while stepping a
    // quantity would be maddening.
    let q = addToBuild(new Map(), 'zebra')
    q = addToBuild(q, 'apple')
    q = setInBuild(q, 'zebra', 99)
    expect([...q.keys()]).toEqual(['zebra', 'apple'])
  })

  it('keeps a row at zero rather than removing it', () => {
    // Typing over a quantity passes through 0; dropping the row mid-edit would
    // steal focus.
    const q = setInBuild(new Map([['ingot', 5]]), 'ingot', 0)
    expect(q.get('ingot')).toBe(0)
  })

  it('removes a row explicitly', () => {
    const q = removeFromBuild(
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
      'a',
    )
    expect([...q.keys()]).toEqual(['b'])
  })

  it('converts to build-list entries', () => {
    expect(toEntries(new Map([['ingot', 3]]))).toEqual([{ itemId: 'ingot', quantity: 3 }])
  })
})

describe('the collection', () => {
  it('gives every build a distinct id', () => {
    const c = collectionOf('One', 'Two', 'Three')
    expect(new Set(c.builds.map((b) => b.id)).size).toBe(3)
  })

  it('resolves the active build, falling back to the first', () => {
    const c = collectionOf('One', 'Two')
    expect(activeBuild(c).name).toBe('One')
    expect(activeBuild({ ...c, activeId: 'gone' }).name).toBe('One')
  })

  it('names new builds by the lowest free number, not the count', () => {
    expect(nextBuildName(collectionOf('Build 1', 'Build 2').builds)).toBe('Build 3')
    // Two builds exist but "Build 2" is free, so that is what a new one gets.
    expect(nextBuildName(collectionOf('Build 1', 'Shared build').builds)).toBe('Build 2')
    expect(nextBuildName(collectionOf('Build 3').builds)).toBe('Build 1')
    expect(nextBuildName([])).toBe('Build 1')
  })

  it('activates a newly added build', () => {
    const c = collectionOf('One')
    const added = addBuild(c, createBuild('Two'))
    expect(activeBuild(added).name).toBe('Two')
  })

  it('refuses to grow past the cap', () => {
    let c = collectionOf('One')
    while (c.builds.length < MAX_BUILDS) c = addBuild(c, createBuild(nextBuildName(c.builds)))
    const full = addBuild(c, createBuild('Extra'))
    expect(full.builds).toHaveLength(MAX_BUILDS)
  })

  it('never leaves the collection empty', () => {
    // Deleting the last build must leave something to edit, not a dead UI.
    const c = collectionOf('Only')
    const after = deleteBuild(c, c.activeId)
    expect(after.builds).toHaveLength(1)
    expect(after.builds[0].quantities.size).toBe(0)
  })

  it('moves the active pointer when the active build is deleted', () => {
    const c = collectionOf('One', 'Two')
    const after = deleteBuild(c, c.activeId)
    expect(after.builds).toHaveLength(1)
    expect(activeBuild(after).name).toBe('Two')
  })

  it('leaves the active pointer alone when another build is deleted', () => {
    const c = collectionOf('One', 'Two')
    const after = deleteBuild(c, c.builds[1].id)
    expect(activeBuild(after).name).toBe('One')
  })

  it('keeps the tech level across add and delete', () => {
    // Tech level describes the save, not a build, so it must survive both.
    const c = { ...collectionOf('One', 'Two'), playerLevel: 34 }
    expect(addBuild(c, createBuild('Three')).playerLevel).toBe(34)
    expect(deleteBuild(c, c.activeId).playerLevel).toBe(34)
  })

  it('renames a build', () => {
    const c = collectionOf('One')
    expect(activeBuild(renameBuild(c, c.activeId, 'Ore run')).name).toBe('Ore run')
  })

  it('ignores a blank rename rather than leaving an unclickable row', () => {
    const c = collectionOf('One')
    expect(activeBuild(renameBuild(c, c.activeId, '   ')).name).toBe('One')
  })

  it('trims whitespace from a rename', () => {
    const c = collectionOf('One')
    expect(activeBuild(renameBuild(c, c.activeId, '  Ore run  ')).name).toBe('Ore run')
  })
})

import { describe, expect, it } from 'vitest'
import { categoryLabel, emptyFilters, scoreMatch, searchEntries, type Entry } from './search'
import { toId } from './id'
import type { ItemCategory, Recipe } from '@/types/game'
import { gameData } from '@/data'

function entry(name: string, category: ItemCategory, craftable = true): Entry {
  const recipe: Recipe | null = craftable
    ? {
        stationId: null,
        stationName: null,
        alternativeStationNames: [],
        inputs: [{ itemId: toId('Wood'), name: 'Wood', quantity: 1 }],
        yield: 1,
      }
    : null

  return {
    id: toId(name),
    name,
    category,
    sourceKind: craftable ? 'craftable' : 'gathered',
    techLevel: null,
    recipe,
    alternativeRecipes: [],
    drops: [],
    otherSources: [],
  }
}

const names = (result: { results: Entry[] }) => result.results.map((e) => e.name)

describe('scoreMatch', () => {
  it('ranks an exact match above a prefix match', () => {
    expect(scoreMatch('Ore', 'ore')).toBeGreaterThan(scoreMatch('Ore Excavator', 'ore'))
  })

  it('ranks a prefix match above a word-boundary match', () => {
    expect(scoreMatch('Sphere Workbench', 'sphere')).toBeGreaterThan(
      scoreMatch('Mega Sphere', 'sphere'),
    )
  })

  it('prefers shorter names among equally-typed matches', () => {
    expect(scoreMatch('Mega Sphere', 'sphere')).toBeGreaterThan(
      scoreMatch('Mega Sphere Blueprint', 'sphere'),
    )
  })

  it('matches a subsequence as a last resort', () => {
    expect(scoreMatch('Mega Sphere', 'megsph')).toBeGreaterThan(0)
  })

  it('returns 0 when nothing matches', () => {
    expect(scoreMatch('Mega Sphere', 'zzzz')).toBe(0)
  })

  it('treats an empty query as a match for everything', () => {
    expect(scoreMatch('Anything', '')).toBeGreaterThan(0)
  })

  it('is case insensitive', () => {
    expect(scoreMatch('Mega Sphere', 'MEGA')).toBe(scoreMatch('Mega Sphere', 'mega'))
  })

  it('does not treat query punctuation as a regex', () => {
    // A naive implementation builds a RegExp from the query and throws here.
    expect(() => scoreMatch('Pal Sphere', 'sphere)')).not.toThrow()
    expect(scoreMatch('Pal Sphere', '(')).toBe(0)
  })
})

describe('searchEntries', () => {
  const entries: Entry[] = [
    entry('Mega Sphere', 'sphere'),
    entry('Pal Sphere', 'sphere'),
    entry('Sphere Workbench', 'structure'),
    entry('Ore', 'material', false),
    entry('Ingot', 'material'),
  ]

  it('ranks results rather than returning them in source order', () => {
    expect(names(searchEntries(entries, { ...emptyFilters, query: 'sphere' }))[0]).toBe(
      'Sphere Workbench',
    )
  })

  it('excludes non-craftable entries when craftableOnly is set', () => {
    expect(names(searchEntries(entries, emptyFilters))).not.toContain('Ore')
  })

  it('includes non-craftable entries when craftableOnly is cleared', () => {
    const result = searchEntries(entries, { ...emptyFilters, craftableOnly: false })
    expect(names(result)).toContain('Ore')
  })

  it('filters by category', () => {
    const result = searchEntries(entries, {
      ...emptyFilters,
      categories: new Set<ItemCategory>(['structure']),
    })
    expect(names(result)).toEqual(['Sphere Workbench'])
  })

  it('treats an empty category set as no filter', () => {
    expect(searchEntries(entries, emptyFilters).total).toBe(4)
  })

  it('caps results at the limit but reports the true total', () => {
    const result = searchEntries(entries, emptyFilters, 2)
    expect(result.results).toHaveLength(2)
    expect(result.total).toBe(4)
  })

  it('ignores surrounding whitespace in the query', () => {
    expect(names(searchEntries(entries, { ...emptyFilters, query: '  ingot  ' }))).toEqual([
      'Ingot',
    ])
  })

  it('returns nothing when the query matches nothing', () => {
    const result = searchEntries(entries, { ...emptyFilters, query: 'zzzzzz' })
    expect(result.results).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

describe('categoryLabel', () => {
  it('title-cases plain categories', () => {
    expect(categoryLabel('sphere')).toBe('Sphere')
  })

  it('humanizes snake_case categories', () => {
    expect(categoryLabel('key_item')).toBe('Key Item')
  })
})

describe('searching the real dataset', () => {
  const entries: Entry[] = [...gameData.items, ...gameData.structures]

  it('puts Mega Sphere first for its exact name', () => {
    expect(names(searchEntries(entries, { ...emptyFilters, query: 'mega sphere' }))[0]).toBe(
      'Mega Sphere',
    )
  })

  it('finds structures such as the Electric Furnace', () => {
    expect(names(searchEntries(entries, { ...emptyFilters, query: 'electric furnace' }))).toContain(
      'Electric Furnace',
    )
  })

  it('never throws on any single-character query', () => {
    for (const char of 'abcdefghijklmnopqrstuvwxyz0123456789()[]*+?.\\^$|') {
      expect(() => searchEntries(entries, { ...emptyFilters, query: char })).not.toThrow()
    }
  })
})

describe('tech level and station filters', () => {
  const entries: Entry[] = [...gameData.items, ...gameData.structures]

  it('hides entries gated above the level', () => {
    const result = searchEntries(entries, { ...emptyFilters, maxTechLevel: 5 })
    expect(result.results.every((e) => e.techLevel === null || e.techLevel <= 5)).toBe(true)
  })

  it('keeps ungated entries regardless of the level filter', () => {
    // Ingot has no techLevel, so a level-1 filter must not hide it.
    const result = searchEntries(entries, {
      ...emptyFilters,
      query: 'ingot',
      maxTechLevel: 1,
    })
    expect(result.results.map((e) => e.name)).toContain('Ingot')
  })

  it('restricts to a single crafting station', () => {
    const stationId = toId('Primitive Furnace')
    const result = searchEntries(entries, { ...emptyFilters, stationId }, 500)
    expect(result.total).toBeGreaterThan(0)
    expect(result.results.every((e) => e.recipe?.stationId === stationId)).toBe(true)
  })

  it('combines the station and level filters', () => {
    const result = searchEntries(
      entries,
      { ...emptyFilters, stationId: toId('Primitive Workbench'), maxTechLevel: 5 },
      500,
    )
    expect(
      result.results.every(
        (e) =>
          e.recipe?.stationId === toId('Primitive Workbench') &&
          (e.techLevel === null || e.techLevel <= 5),
      ),
    ).toBe(true)
  })
})

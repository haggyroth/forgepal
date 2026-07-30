import { describe, expect, it } from 'vitest'
import { buildIndex, buildTree, calculate, type GameIndex } from './calculator'
import { toId } from './id'
import type { GameData, Item, Recipe, Structure } from '@/types/game'
import realData from '@/data/game-data.json'

function recipe(
  inputs: [string, number][],
  options: { station?: string; yield?: number } = {},
): Recipe {
  return {
    stationId: options.station ? toId(options.station) : null,
    stationName: options.station ?? null,
    alternativeStationNames: [],
    inputs: inputs.map(([name, quantity]) => ({ itemId: toId(name), name, quantity })),
    yield: options.yield ?? 1,
  }
}

function item(name: string, sourceKind: Item['sourceKind'], r: Recipe | null = null): Item {
  return {
    id: toId(name),
    name,
    category: 'material',
    sourceKind,
    techLevel: null,
    recipe: r,
    alternativeRecipes: [],
    drops: [],
    otherSources: [],
  }
}

/**
 * A small stand-in for the real dataset:
 *   Mega Sphere <- Paldium + Ingot + Wood + Stone
 *   Ingot       <- Ore x2
 *   Arrow       <- Wood x2 + Stone x2, crafted 10 at a time
 */
function fixture(): GameIndex {
  const data: GameData = {
    meta: {
      gameVersion: 'test',
      updated: '2026-01-01',
      importedAt: '2026-01-01T00:00:00Z',
      sources: [],
      gaps: [],
    },
    habitats: [],
    merchantListings: {},
    expeditionRewards: {},
    items: [
      item('Ore', 'gathered'),
      item('Wood', 'gathered'),
      item('Stone', 'gathered'),
      item('Paldium Fragment', 'gathered'),
      item('Ingot', 'craftable', recipe([['Ore', 2]], { station: 'Primitive Furnace' })),
      item(
        'Mega Sphere',
        'craftable',
        recipe(
          [
            ['Paldium Fragment', 1],
            ['Ingot', 1],
            ['Wood', 3],
            ['Stone', 3],
          ],
          { station: 'Sphere Workbench' },
        ),
      ),
      item(
        'Arrow',
        'craftable',
        recipe(
          [
            ['Wood', 2],
            ['Stone', 2],
          ],
          { station: 'Primitive Workbench', yield: 10 },
        ),
      ),
    ],
    structures: [],
    stations: [],
  }
  return buildIndex(data)
}

const find = <T extends { itemId: string }>(list: T[], name: string): T | undefined =>
  list.find((entry) => entry.itemId === toId(name))

describe('calculate', () => {
  const index = fixture()

  it('expands sub-recipes down to raw materials', () => {
    const result = calculate([{ itemId: toId('Mega Sphere'), quantity: 20 }], index)

    // 20 spheres -> 20 Ingots -> 40 Ore.
    expect(find(result.intermediates, 'Ingot')?.required).toBe(20)
    expect(find(result.raw, 'Ore')?.required).toBe(40)
    expect(find(result.raw, 'Wood')?.required).toBe(60)
    expect(find(result.raw, 'Stone')?.required).toBe(60)
    expect(find(result.raw, 'Paldium Fragment')?.required).toBe(20)
  })

  it('separates targets, intermediates, and raw materials', () => {
    const result = calculate([{ itemId: toId('Mega Sphere'), quantity: 1 }], index)

    expect(result.targets.map((t) => t.name)).toEqual(['Mega Sphere'])
    expect(result.intermediates.map((t) => t.name)).toEqual(['Ingot'])
    expect(result.raw.map((t) => t.name)).toEqual(['Ore', 'Paldium Fragment', 'Stone', 'Wood'])
  })

  it('stops at gathered materials rather than expanding them', () => {
    const result = calculate([{ itemId: toId('Mega Sphere'), quantity: 1 }], index)
    expect(find(result.raw, 'Ore')?.crafts).toBe(0)
    expect(find(result.raw, 'Ore')?.sourceKind).toBe('gathered')
  })

  it('rounds batch recipes up and reports the surplus', () => {
    // Arrows craft 10 at a time and cost Wood x2 per batch, so 15 arrows means
    // 2 batches: 20 arrows produced (5 spare) for 4 Wood and 4 Stone.
    const result = calculate([{ itemId: toId('Arrow'), quantity: 15 }], index)
    const arrow = find(result.targets, 'Arrow')

    expect(arrow?.crafts).toBe(2)
    expect(arrow?.produced).toBe(20)
    expect(arrow?.surplus).toBe(5)
    expect(find(result.raw, 'Wood')?.required).toBe(4)
    expect(find(result.raw, 'Stone')?.required).toBe(4)
  })

  it('aggregates shared materials across the whole build list before costing', () => {
    // Both entries need Ingots. Ore must be derived from the combined 30, not
    // from each branch separately.
    const result = calculate(
      [
        { itemId: toId('Mega Sphere'), quantity: 10 },
        { itemId: toId('Ingot'), quantity: 20 },
      ],
      index,
    )

    expect(find(result.targets, 'Ingot')?.required).toBe(30)
    expect(find(result.raw, 'Ore')?.required).toBe(60)
  })

  it('combines duplicate build-list entries for the same item', () => {
    const result = calculate(
      [
        { itemId: toId('Ingot'), quantity: 5 },
        { itemId: toId('Ingot'), quantity: 7 },
      ],
      index,
    )
    expect(result.targets).toHaveLength(1)
    expect(result.targets[0].required).toBe(12)
  })

  it('ignores zero, negative, and non-finite quantities', () => {
    const result = calculate(
      [
        { itemId: toId('Ingot'), quantity: 0 },
        { itemId: toId('Wood'), quantity: -5 },
        { itemId: toId('Stone'), quantity: Number.NaN },
      ],
      index,
    )
    expect(result.targets).toHaveLength(0)
    expect(result.raw).toHaveLength(0)
  })

  it('returns empty results for an empty build list', () => {
    const result = calculate([], index)
    expect(result.targets).toHaveLength(0)
    expect(result.raw).toHaveLength(0)
    expect(result.cycles).toHaveLength(0)
  })

  it('reports recipe inputs that are missing from the dataset', () => {
    const data: GameData = {
      meta: {
        gameVersion: 'test',
        updated: '',
        importedAt: '',
        sources: [],
        gaps: [],
      },
      habitats: [],
      merchantListings: {},
      expeditionRewards: {},
      items: [item('Widget', 'craftable', recipe([['Phantom Material', 3]]))],
      structures: [],
      stations: [],
    }
    const result = calculate([{ itemId: toId('Widget'), quantity: 2 }], buildIndex(data))

    expect(result.unresolved).toEqual([
      { itemId: toId('Phantom Material'), name: 'Phantom Material', required: 6 },
    ])
  })

  it('terminates on a cyclic graph instead of hanging', () => {
    const data: GameData = {
      meta: {
        gameVersion: 'test',
        updated: '',
        importedAt: '',
        sources: [],
        gaps: [],
      },
      habitats: [],
      merchantListings: {},
      expeditionRewards: {},
      items: [
        item('A', 'craftable', recipe([['B', 1]])),
        item('B', 'craftable', recipe([['A', 1]])),
      ],
      structures: [],
      stations: [],
    }
    const result = calculate([{ itemId: toId('A'), quantity: 1 }], buildIndex(data))

    expect(result.cycles.length).toBeGreaterThan(0)
    expect(result.targets).toHaveLength(1)
  })
})

describe('buildTree', () => {
  const index = fixture()

  it('nests sub-recipes under their parent', () => {
    const tree = buildTree(toId('Mega Sphere'), 2, index)

    expect(tree?.name).toBe('Mega Sphere')
    expect(tree?.stationName).toBe('Sphere Workbench')

    const ingot = tree?.children.find((c) => c.name === 'Ingot')
    expect(ingot?.quantity).toBe(2)
    expect(ingot?.children.find((c) => c.name === 'Ore')?.quantity).toBe(4)
  })

  it('marks gathered leaves as childless', () => {
    const tree = buildTree(toId('Mega Sphere'), 1, index)
    const wood = tree?.children.find((c) => c.name === 'Wood')

    expect(wood?.children).toHaveLength(0)
    expect(wood?.sourceKind).toBe('gathered')
  })

  it('returns null for an unknown item', () => {
    expect(buildTree('does-not-exist', 1, index)).toBeNull()
  })
})

/**
 * These run against the committed dataset. They are the tripwire for a bad
 * upstream import: if `npm run data:import` pulls in something broken, CI fails
 * here rather than the app silently quoting wrong material costs.
 */
describe('the committed dataset', () => {
  const data = realData as unknown as GameData
  const index = buildIndex(data)

  it('loads a non-trivial number of entries', () => {
    expect(data.items.length).toBeGreaterThan(1000)
    expect(data.structures.length).toBeGreaterThan(100)
    expect(data.stations.length).toBeGreaterThan(20)
  })

  it('is acyclic for every craftable entry', () => {
    const roots = [...data.items, ...data.structures]
      .filter((entry) => entry.recipe)
      .map((entry) => ({ itemId: entry.id, quantity: 1 }))

    expect(calculate(roots, index).cycles).toEqual([])
  })

  it('costs Mega Spheres in Ore, per the README example', () => {
    const result = calculate([{ itemId: toId('Mega Sphere'), quantity: 20 }], index)

    expect(find(result.intermediates, 'Ingot')?.required).toBe(20)
    expect(find(result.raw, 'Ore')?.required).toBe(40)
  })

  it('does not expand Paldium Fragment, which upstream reports cyclically', () => {
    const paldium = index.byId.get(toId('Paldium Fragment'))

    expect(paldium?.sourceKind).toBe('gathered')
    expect(paldium?.recipe).toBeNull()
    // The real Crusher conversions are preserved, just not used for expansion.
    expect(paldium?.alternativeRecipes.length).toBeGreaterThan(0)
  })

  it('reads batch yields from upstream notes', () => {
    expect(index.byId.get(toId('Arrow'))?.recipe?.yield).toBe(10)
  })

  it('resolves every recipe input to a known entry', () => {
    const roots = [...data.items, ...data.structures]
      .filter((entry) => entry.recipe)
      .map((entry) => ({ itemId: entry.id, quantity: 1 }))

    expect(calculate(roots, index).unresolved).toEqual([])
  })

  it('records drop sources for materials farmed from Pals', () => {
    const leather = index.byId.get(toId('Leather'))

    expect(leather?.sourceKind).toBe('drop')
    expect(leather?.drops.length).toBeGreaterThan(0)
    expect(leather?.drops[0]).toMatchObject({
      source: expect.any(String),
      chance: expect.any(Number),
    })
  })

  it('carries work suitability onto worked structures', () => {
    const campfire = index.byId.get(toId('Campfire')) as Structure | undefined
    expect(campfire?.workSuitability).toBe('Kindling')
  })
})

import { describe, expect, it } from 'vitest'
import { classify, parseAlternativeStations, parseBatchYield, parseDropLine } from './normalize.ts'
import type { DropSource, Recipe } from '../../src/types/game.ts'

const noRecipe = null
const someRecipe: Recipe = {
  stationId: null,
  stationName: null,
  alternativeStationNames: [],
  inputs: [{ itemId: 'wood', name: 'Wood', quantity: 1 }],
  yield: 1,
}

const drop = (source: string): DropSource => ({ source, quantity: [1, 1], chance: 1 })

describe('parseDropLine', () => {
  it('parses a source with a quantity range and chance', () => {
    expect(parseDropLine('Dropped by Digtoise x2–3 (100%)')).toEqual({
      source: 'Digtoise',
      quantity: [2, 3],
      chance: 1,
    })
  })

  it('defaults to a quantity of 1 when none is given', () => {
    expect(parseDropLine('Dropped by Melpaca (100%)')).toEqual({
      source: 'Melpaca',
      quantity: [1, 1],
      chance: 1,
    })
  })

  it('handles a fixed quantity with no range', () => {
    expect(parseDropLine('Dropped by Mau x100 (50%)')).toEqual({
      source: 'Mau',
      quantity: [100, 100],
      chance: 0.5,
    })
  })

  it('handles fractional chances', () => {
    expect(parseDropLine('Dropped by Lunaris x1 (2.5%)')?.chance).toBe(0.025)
  })

  it('accepts a plain hyphen as well as the en-dash upstream uses', () => {
    expect(parseDropLine('Dropped by Digtoise x2-3 (100%)')?.quantity).toEqual([2, 3])
  })

  it('parses an unknown rate as null rather than zero', () => {
    // Upstream writes "(?)" for rates it does not know. 108 lines use it, all
    // bounty tokens from named bosses; the old regex rejected them outright.
    expect(parseDropLine('Dropped by Dancer on the Steppe Chillet (?)')).toEqual({
      source: 'Dancer on the Steppe Chillet',
      quantity: [1, 1],
      chance: null,
    })
  })

  it('parses an unknown rate alongside a quantity', () => {
    expect(parseDropLine('Dropped by Boss x2-4 (?)')).toEqual({
      source: 'Boss',
      quantity: [2, 4],
      chance: null,
    })
  })

  it('treats a literal 0% as unknown, not as never', () => {
    // A 0% drop cannot inform a decision, and rendering "0%" would tell the
    // user it never drops. Record the relationship, not a false rate.
    expect(parseDropLine('Dropped by Beam Scatter Schematic 4 x1 (0%)')?.chance).toBeNull()
  })

  it('returns null for lines that are not drops', () => {
    expect(parseDropLine('Found in treasure chests')).toBeNull()
    expect(parseDropLine('Sold by Vagrant Trader (Gold) - location unknown')).toBeNull()
    expect(parseDropLine('Mining ore nodes (rust-brown rocks)')).toBeNull()
  })
})

describe('parseBatchYield', () => {
  it('reads the batch size out of a note', () => {
    expect(parseBatchYield('Crafts x10 per batch')).toBe(10)
  })

  it('finds it alongside other notes', () => {
    expect(parseBatchYield('Crafts x20 per batch; Also craftable at: Ancient Workbench')).toBe(20)
  })

  it('returns null when absent or undefined', () => {
    expect(parseBatchYield('Also craftable at: Improved Furnace')).toBeNull()
    expect(parseBatchYield(undefined)).toBeNull()
  })
})

describe('parseAlternativeStations', () => {
  it('splits a comma-separated station list', () => {
    expect(
      parseAlternativeStations('Also craftable at: Improved Furnace, Electric Furnace'),
    ).toEqual(['Improved Furnace', 'Electric Furnace'])
  })

  it('stops at a semicolon so other notes do not leak in', () => {
    expect(parseAlternativeStations('Also craftable at: Crusher; Crafts x2 per batch')).toEqual([
      'Crusher',
    ])
  })

  it('returns an empty array when absent or undefined', () => {
    expect(parseAlternativeStations('Crafts x10 per batch')).toEqual([])
    expect(parseAlternativeStations(undefined)).toEqual([])
  })
})

describe('classify', () => {
  it('honours an explicit override above everything else', () => {
    // Paldium Fragment is overridden to gathered despite upstream's recipe.
    expect(classify('Paldium Fragment', someRecipe, [], [drop('Lunaris')])).toBe('gathered')
  })

  it('puts curated gathered materials above their drop tables', () => {
    // Ore is dropped by Digtoise but is mined in practice.
    expect(classify('Ore', noRecipe, [], [drop('Digtoise')])).toBe('gathered')
  })

  it('classifies anything with a recipe as craftable', () => {
    expect(classify('Ingot', someRecipe, [], [])).toBe('craftable')
  })

  it('prefers structured drop data over prose hints', () => {
    // Regression: "Ranch: Flambelle (Farming)" once matched a 'farm' gathering
    // hint and outvoted 45 parsed drop sources, mislabelling a Pal drop.
    expect(
      classify('Flame Organ', noRecipe, ['Ranch: Flambelle (Farming)'], [drop('Foxparks')]),
    ).toBe('drop')
  })

  it('still falls back to prose hints when there are no drops', () => {
    expect(classify('Some Rock', noRecipe, ['Mining stone nodes'], [])).toBe('gathered')
  })

  it('marks entries with no recipe and no source as unobtainable', () => {
    expect(classify('Mystery Item', noRecipe, ['Found somewhere'], [])).toBe('unobtainable')
  })

  it('treats world loot and map spawns as gathered', () => {
    expect(classify('Mythical Wood', noRecipe, ['Found in treasure chests'], [])).toBe('gathered')
    expect(classify('Common Egg', noRecipe, ['Wild egg spawn on the map'], [])).toBe('gathered')
  })

  it('classifies vendor-only entries as merchant', () => {
    expect(classify('Token', noRecipe, ['Sold by Arena Merchant (Gold)'], [])).toBe('merchant')
  })

  it('prefers a world source over a vendor when both are listed', () => {
    // You can farm a chest; you have to find a merchant.
    expect(
      classify('Thing', noRecipe, ['Sold by Wandering Merchant', 'Found in treasure chests'], []),
    ).toBe('gathered')
  })
})

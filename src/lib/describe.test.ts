import { describe, expect, it } from 'vitest'
import { describeBatch, describeProduction } from './describe'
import { buildIndex } from './calculator'
import { toId } from './id'
import { gameData } from '@/data'
import type { GameData, Item, Structure } from '@/types/game'

const index = buildIndex(gameData as unknown as GameData)

const item = (name: string) => index.byId.get(toId(name))

describe('describeProduction', () => {
  it('reports the build menu and work suitability for a worked structure', () => {
    // Regression: structures have a recipe but no crafting station, and were
    // previously mislabelled "no recipe".
    expect(describeProduction(item('Campfire'), index)).toBe('Build menu · worked by Kindling')
  })

  it('reports the build menu alone for an unworked structure', () => {
    expect(describeProduction(item('Palbox'), index)).toBe('Build menu')
  })

  it('names the station for a crafted item', () => {
    expect(describeProduction(item('Mega Sphere'), index)).toContain('Sphere Workbench')
  })

  it('appends the station work suitability when known', () => {
    // Ingot is smelted at the Primitive Furnace, which Kindling Pals operate.
    expect(describeProduction(item('Ingot'), index)).toBe('Primitive Furnace · Kindling')
  })

  it('distinguishes dropped from gathered for uncraftable materials', () => {
    expect(describeProduction(item('Leather'), index)).toBe('Dropped, not crafted')
    expect(describeProduction(item('Ore'), index)).toBe('Gathered, not crafted')
  })

  it('returns an empty string for a missing entry', () => {
    expect(describeProduction(undefined, index)).toBe('')
  })

  it('never claims a structure has no recipe', () => {
    const structures = gameData.structures as Structure[]
    for (const structure of structures) {
      expect(describeProduction(structure, index)).not.toContain('not crafted')
    }
  })
})

describe('describeBatch', () => {
  const arrow = item('Arrow') as Item

  it('says nothing for ordinary one-per-craft recipes', () => {
    expect(describeBatch(item('Mega Sphere'), undefined)).toBe('')
  })

  it('describes the batch size when there is no surplus to report', () => {
    expect(describeBatch(arrow, undefined)).toBe('batches of 10')
  })

  it('spells out the batch maths when a craft overshoots', () => {
    expect(describeBatch(arrow, { crafts: 2, produced: 20, surplus: 5 })).toBe(
      '2 × 10 = 20, 5 spare',
    )
  })

  it('falls back to the batch size when the order divides evenly', () => {
    expect(describeBatch(arrow, { crafts: 2, produced: 20, surplus: 0 })).toBe('batches of 10')
  })
})

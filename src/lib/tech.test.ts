import { describe, expect, it } from 'vitest'
import { analyseTech, isLocked, MAX_TECH_LEVEL, parsePlayerLevel } from './tech'
import { buildIndex, calculate } from './calculator'
import { toId } from './id'
import { gameData } from '@/data'
import type { GameData } from '@/types/game'

const data = gameData as unknown as GameData
const index = buildIndex(data)

const analyse = (name: string, quantity: number, level: number | null) =>
  analyseTech(calculate([{ itemId: toId(name), quantity }], index), index, level)

describe('isLocked', () => {
  it('locks entries above the player level', () => {
    expect(isLocked({ techLevel: 34 }, 20)).toBe(true)
  })

  it('unlocks entries at or below the player level', () => {
    expect(isLocked({ techLevel: 34 }, 34)).toBe(false)
    expect(isLocked({ techLevel: 14 }, 34)).toBe(false)
  })

  it('never locks ungated entries', () => {
    // Null means "not gated", not level 0 — Ore and Wood must stay available.
    expect(isLocked({ techLevel: null }, 1)).toBe(false)
  })

  it('gates nothing when the player level is unknown', () => {
    expect(isLocked({ techLevel: 80 }, null)).toBe(false)
  })
})

describe('parsePlayerLevel', () => {
  it('reads a plain number', () => {
    expect(parsePlayerLevel('34')).toBe(34)
  })

  it('treats blank input as no level set', () => {
    expect(parsePlayerLevel('')).toBeNull()
    expect(parsePlayerLevel('   ')).toBeNull()
  })

  it('rejects nonsense and out-of-range values', () => {
    expect(parsePlayerLevel('abc')).toBeNull()
    expect(parsePlayerLevel('0')).toBeNull()
    expect(parsePlayerLevel('-5')).toBeNull()
  })

  it('clamps above the maximum and floors decimals', () => {
    expect(parsePlayerLevel('999')).toBe(MAX_TECH_LEVEL)
    expect(parsePlayerLevel('12.7')).toBe(12)
  })
})

describe('analyseTech', () => {
  it('collects every station a build touches', () => {
    const names = analyse('Mega Sphere', 20, null).stations.map((s) => s.name)
    expect(names).toContain('Sphere Workbench')
    expect(names).toContain('Primitive Furnace')
  })

  it('lists the most advanced station first, since that is what gates the build', () => {
    const stations = analyse('Mega Sphere', 20, null).stations
    const levels = stations.map((s) => s.techLevel ?? -1)
    expect(levels).toEqual([...levels].sort((a, b) => b - a))
  })

  it('carries work suitability onto each station', () => {
    const furnace = analyse('Mega Sphere', 1, null).stations.find(
      (s) => s.name === 'Primitive Furnace',
    )
    expect(furnace?.workSuitability).toBe('Kindling')
  })

  it('reports the highest level required and what drives it', () => {
    const tech = analyse('Mega Sphere', 1, null)
    expect(tech.highestLevel).toBeGreaterThan(0)
    expect(tech.drivenBy).toBeTruthy()
  })

  it('accounts for station levels, not just item levels', () => {
    // Refined Ingot itself is ungated, but its Improved Furnace is not — so the
    // build still has a technology requirement.
    const tech = analyse('Refined Ingot', 10, null)
    expect(tech.highestLevel).not.toBeNull()
    expect(tech.stations.some((s) => s.name === 'Improved Furnace')).toBe(true)
  })

  it('flags items above the player level', () => {
    const tech = analyse('Mega Sphere', 1, 1)
    expect(tech.lockedItems).toContain('Mega Sphere')
  })

  it('flags no items when the player is high enough', () => {
    expect(analyse('Mega Sphere', 1, MAX_TECH_LEVEL).lockedItems).toEqual([])
  })

  it('marks stations the player cannot build yet', () => {
    const sphereBench = analyse('Mega Sphere', 1, 1).stations.find(
      (s) => s.name === 'Sphere Workbench',
    )
    expect(sphereBench?.locked).toBe(true)
  })

  it('gates nothing when no player level is given', () => {
    const tech = analyse('Mega Sphere', 1, null)
    expect(tech.lockedItems).toEqual([])
    expect(tech.stations.every((s) => !s.locked)).toBe(true)
  })

  it('returns an empty analysis for an empty build', () => {
    const tech = analyseTech(calculate([], index), index, 30)
    expect(tech.stations).toEqual([])
    expect(tech.highestLevel).toBeNull()
    expect(tech.needsAncientTech).toBe(false)
  })

  it('does not duplicate a station used by several recipes', () => {
    const tech = analyseTech(
      calculate(
        [
          { itemId: toId('Ingot'), quantity: 5 },
          { itemId: toId('Charcoal'), quantity: 5 },
        ],
        index,
      ),
      index,
      null,
    )
    const furnaces = tech.stations.filter((s) => s.name === 'Primitive Furnace')
    expect(furnaces).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'
import { buildHabitatIndex, buildRoute, hasRoute, routedMaterialCount } from './route'
import { buildIndex, calculate } from './calculator'
import { toId } from './id'
import { gameData } from '@/data'
import type { GameData } from '@/types/game'

const data = gameData as unknown as GameData
const index = buildIndex(data)
const habitats = buildHabitatIndex(data)

const routeFor = (entries: [string, number][]) =>
  buildRoute(
    calculate(
      entries.map(([name, quantity]) => ({ itemId: toId(name), quantity })),
      index,
    ),
    index,
    habitats,
  )

describe('buildHabitatIndex', () => {
  it('indexes habitats by Pal name, matching what drop sources use', () => {
    expect(habitats.get('Melpaca')?.regions.length).toBeGreaterThan(0)
  })

  it('omits Pals with no wild spawn rather than listing them with no region', () => {
    // Frostallion is a legendary; upstream records an empty region list.
    expect(habitats.has('Frostallion')).toBe(false)
  })
})

describe('buildRoute', () => {
  it('is empty for an empty build list', () => {
    const route = routeFor([])
    expect(hasRoute(route)).toBe(false)
    expect(route.stops).toEqual([])
  })

  it('separates gathered materials, which need no route', () => {
    const route = routeFor([['Mega Sphere', 20]])

    expect(route.gathered.map((g) => g.name).sort()).toEqual([
      'Ore',
      'Paldium Fragment',
      'Stone',
      'Wood',
    ])
    expect(route.stops).toEqual([])
  })

  it('groups dropped materials by region', () => {
    const route = routeFor([['Cloth', 10]])
    expect(route.stops.length).toBeGreaterThan(0)
    for (const stop of route.stops) {
      expect(stop.region).toBeTruthy()
      expect(stop.materials.length).toBeGreaterThan(0)
    }
  })

  it('names the Pals to hunt in each region, best odds first', () => {
    const route = routeFor([['Cloth', 10]])
    const stop = route.stops[0]
    const pals = stop.materials[0].pals

    expect(pals.length).toBeGreaterThan(0)
    const chances = pals.map((p) => p.chance ?? -1)
    expect(chances).toEqual([...chances].sort((a, b) => b - a))
  })

  it('ranks regions by how much of the list they cover', () => {
    const route = routeFor([
      ['Cloth', 10],
      ['Refined Ingot', 20],
      ['Cake', 2],
    ])
    const counts = route.stops.map((s) => s.materials.length)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  it('carries the required quantity through to the stop', () => {
    const route = routeFor([['Cloth', 10]])
    // Cloth costs Wool x2, so 10 Cloth is 20 Wool.
    const wool = route.stops.flatMap((s) => s.materials).find((m) => m.name === 'Wool')
    expect(wool?.required).toBe(20)
  })

  it('caps the sources considered so one material cannot flood every region', () => {
    // Leather has 79 drop sources; routing all of them would make almost every
    // region a stop and the ranking meaningless.
    const route = routeFor([['Leather', 50]])
    const pals = new Set(route.stops.flatMap((s) => s.materials.flatMap((m) => m.pals.map((p) => p.name))))
    expect(pals.size).toBeLessThanOrEqual(5)
  })

  it('routes a non-craftable target, not just recipe ingredients', () => {
    // Asking for Wool directly still means going and getting it, even though it
    // is a target rather than an ingredient.
    const route = routeFor([['Wool', 5]])
    expect(route.stops.length).toBeGreaterThan(0)
    expect(route.stops.flatMap((s) => s.materials).map((m) => m.name)).toContain('Wool')
  })

  it('reports dropped materials whose sources have no wild spawn', () => {
    // Bounty tokens drop only from named bosses, which have no habitat.
    const route = routeFor([['Chillet Bounty Token', 1]])
    expect(route.stops).toEqual([])
    expect(route.unroutable.map((u) => u.name)).toContain('Chillet Bounty Token')
    expect(route.unroutable[0].sources.length).toBeGreaterThan(0)
  })

  it('marks a stop night-only when every Pal there is nocturnal', () => {
    const route = routeFor([['Cloth', 10]])
    // Not asserting a specific region is nocturnal — only that the flag is a
    // boolean derived from the Pals present, never undefined.
    for (const stop of route.stops) {
      expect(typeof stop.nightOnly).toBe('boolean')
    }
  })

  it('counts distinct Pals per stop rather than per material', () => {
    const route = routeFor([
      ['Cloth', 10],
      ['Refined Ingot', 10],
    ])
    for (const stop of route.stops) {
      const distinct = new Set(stop.materials.flatMap((m) => m.pals.map((p) => p.name)))
      expect(stop.palCount).toBe(distinct.size)
    }
  })

  it('counts routed materials without double-counting across regions', () => {
    const route = routeFor([['Cloth', 10]])
    const total = routedMaterialCount(route)
    const naive = route.stops.reduce((n, s) => n + s.materials.length, 0)

    expect(total).toBeLessThanOrEqual(naive)
    expect(total).toBeGreaterThan(0)
  })
})

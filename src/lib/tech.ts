/**
 * Technology gating.
 *
 * In Palworld a recipe unlocks at a player level, and `techLevel` is that
 * level. A null `techLevel` means the entry isn't gated at all — most raw
 * materials and many basic components — so null must never be treated as
 * level 0 or as "locked".
 *
 * Note that the dataset carries tech *levels* but not tech *points*: upstream
 * doesn't record point costs. We show what we actually know.
 */

import type { GameIndex, CalculationResult } from './calculator'
import type { Entry } from './search'
import type { ItemId, Station, Structure } from '@/types/game'

/** Highest technology level in the game, used to bound the level input. */
export const MAX_TECH_LEVEL = 80

/**
 * Whether an entry is beyond the player's current level.
 *
 * A null player level means "don't gate anything" — the user hasn't told us
 * their level, and guessing would flag half the catalogue for no reason.
 */
export function isLocked(entry: { techLevel: number | null }, playerLevel: number | null): boolean {
  if (playerLevel === null) return false
  if (entry.techLevel === null) return false
  return entry.techLevel > playerLevel
}

export interface StationRequirement {
  id: ItemId
  name: string
  techLevel: number | null
  workSuitability: string | null
  locked: boolean
}

export interface TechRequirements {
  /** Highest tech level anything in the build needs, or null if nothing is gated. */
  highestLevel: number | null
  /** What drives `highestLevel` — the name of the most advanced thing required. */
  drivenBy: string | null
  /** Every station the build touches, most advanced first. */
  stations: StationRequirement[]
  /** Names of queued or intermediate items above the player's level. */
  lockedItems: string[]
  /** Whether the build needs anything requiring Ancient Technology Points. */
  needsAncientTech: boolean
}

/**
 * Work out what a build requires to actually be buildable.
 *
 * Covers the stations too, not just the items: knowing a Refined Ingot needs an
 * Improved Furnace is only actionable alongside the fact that the furnace
 * itself unlocks at Technology 34.
 */
export function analyseTech(
  result: CalculationResult,
  index: GameIndex,
  playerLevel: number | null,
): TechRequirements {
  const stations = new Map<ItemId, StationRequirement>()
  const lockedItems: string[] = []
  let highestLevel: number | null = null
  let drivenBy: string | null = null
  let needsAncientTech = false

  const consider = (level: number | null, name: string) => {
    if (level === null) return
    if (highestLevel === null || level > highestLevel) {
      highestLevel = level
      drivenBy = name
    }
  }

  for (const total of [...result.targets, ...result.intermediates]) {
    const entry = index.byId.get(total.itemId)
    if (!entry) continue

    consider(entry.techLevel, entry.name)
    if (isLocked(entry, playerLevel)) lockedItems.push(entry.name)
    if (isStructure(entry) && entry.ancientTech) needsAncientTech = true

    const stationId = entry.recipe?.stationId
    if (!stationId || stations.has(stationId)) continue

    const station: Station | undefined = index.stationsById.get(stationId)
    const name = station?.name ?? entry.recipe?.stationName ?? stationId
    const techLevel = station?.techLevel ?? null

    consider(techLevel, name)
    stations.set(stationId, {
      id: stationId,
      name,
      techLevel,
      workSuitability: station?.workSuitability ?? null,
      locked: isLocked({ techLevel }, playerLevel),
    })
  }

  return {
    highestLevel,
    drivenBy,
    // Most advanced first: that's the one gating the build.
    stations: [...stations.values()].sort(
      (a, b) => (b.techLevel ?? -1) - (a.techLevel ?? -1) || a.name.localeCompare(b.name),
    ),
    lockedItems: [...new Set(lockedItems)].sort(),
    needsAncientTech,
  }
}

function isStructure(entry: Entry): entry is Structure {
  return entry.category === 'structure'
}

/** Parse the level input, returning null for blank or out-of-range values. */
export function parsePlayerLevel(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 1) return null
  return Math.min(Math.floor(value), MAX_TECH_LEVEL)
}

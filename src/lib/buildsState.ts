/**
 * Persistence for the named build collection.
 *
 * Guarded like the other storage modules: localStorage throws in Safari private
 * browsing, and losing saved builds must never take the page down with it.
 */

import { createBuild, clampQuantity, MAX_BUILDS, type Build, type BuildCollection } from './builds'
import { decodeState } from './shareState'
import type { ItemId } from '@/types/game'

const KEY = 'forgepal:builds:v1'

/** The single-build key this replaces. Read once, to migrate. */
const LEGACY_KEY = 'forgepal:build:v1'

/** See storage.ts — Node's own global shadows the DOM one under test. */
function storage(): Storage {
  return window.localStorage
}

interface StoredBuild {
  id?: unknown
  name?: unknown
  quantities?: unknown
  playerLevel?: unknown
}

/**
 * Load the collection, migrating a pre-existing single build if that's all
 * there is.
 *
 * Migration matters more than it looks: anyone using ForgePal before this
 * shipped has a build persisted under the old key, and silently starting them
 * on an empty list would read as having lost it.
 */
export function loadBuilds(isKnownId: (id: ItemId) => boolean): BuildCollection {
  const stored = readStored(isKnownId)
  if (stored) return stored

  const migrated = readLegacy(isKnownId)
  if (migrated)
    return {
      builds: [migrated.build],
      activeId: migrated.build.id,
      playerLevel: migrated.playerLevel,
    }

  const fresh = createBuild('Build 1')
  return { builds: [fresh], activeId: fresh.id, playerLevel: null }
}

function readStored(isKnownId: (id: ItemId) => boolean): BuildCollection | null {
  try {
    const raw = storage().getItem(KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const { builds, activeId, playerLevel } = parsed as {
      builds?: unknown
      activeId?: unknown
      playerLevel?: unknown
    }
    if (!Array.isArray(builds)) return null

    const restored = builds
      .slice(0, MAX_BUILDS)
      .map((b) => toBuild(b as StoredBuild, isKnownId))
      .filter((b): b is Build => b !== null)

    if (restored.length === 0) return null

    const active = typeof activeId === 'string' && restored.some((b) => b.id === activeId)
    return {
      builds: restored,
      activeId: active ? (activeId as string) : restored[0].id,
      playerLevel: typeof playerLevel === 'number' ? playerLevel : null,
    }
  } catch {
    return null
  }
}

function toBuild(raw: StoredBuild, isKnownId: (id: ItemId) => boolean): Build | null {
  // One malformed entry must not cost the user every other saved build, so this
  // guards the entry itself rather than relying on the outer try/catch.
  if (typeof raw !== 'object' || raw === null) return null
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null

  const quantities = new Map<ItemId, number>()
  if (typeof raw.quantities === 'object' && raw.quantities !== null) {
    for (const [id, qty] of Object.entries(raw.quantities as Record<string, unknown>)) {
      // Ids are validated against the dataset for the same reason shared links
      // are: an item dropped upstream should vanish, not linger as a phantom.
      if (typeof qty === 'number' && isKnownId(id)) quantities.set(id, clampQuantity(qty))
    }
  }

  return { id: raw.id, name: raw.name, quantities }
}

/** The old key holds one build in the shareable-URL encoding. */
function readLegacy(
  isKnownId: (id: ItemId) => boolean,
): { build: Build; playerLevel: number | null } | null {
  try {
    const raw = storage().getItem(LEGACY_KEY)
    if (!raw) return null

    const { state } = decodeState(raw, isKnownId)
    if (state.build.length === 0 && state.playerLevel === null) return null

    return { build: createBuild('My build', state.build), playerLevel: state.playerLevel }
  } catch {
    return null
  }
}

export function saveBuilds(collection: BuildCollection): void {
  try {
    storage().setItem(
      KEY,
      JSON.stringify({
        activeId: collection.activeId,
        playerLevel: collection.playerLevel,
        builds: collection.builds.map((b) => ({
          id: b.id,
          name: b.name,
          quantities: Object.fromEntries(b.quantities),
        })),
      }),
    )
  } catch {
    // Not saved; the session still works.
  }
}

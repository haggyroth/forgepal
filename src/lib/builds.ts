/**
 * A named collection of build lists.
 *
 * The quantity rules live here as pure functions rather than inside a hook, so
 * the collection layer can apply them to whichever build is active without a
 * second copy of the logic drifting out of step.
 */

import type { BuildListEntry } from './calculator'
import type { ItemId } from '@/types/game'

const MAX_QUANTITY = 99_999

/** Bound on how many builds are kept, so a corrupted store can't grow forever. */
export const MAX_BUILDS = 50

export interface Build {
  /** Stable key. Survives renaming, which is why the name isn't the identifier. */
  id: string
  name: string
  /** Insertion-ordered: the list must not reshuffle under the cursor. */
  quantities: Map<ItemId, number>
}

export interface BuildCollection {
  builds: Build[]
  activeId: string
  /**
   * Deliberately on the collection, not on each build. Tech level describes
   * *your save*, not a particular shopping list — switching builds should not
   * silently change what the catalogue considers locked.
   */
  playerLevel: number | null
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_QUANTITY, Math.floor(value)))
}

/* ------------------------------------------------------------ one build */

export function addToBuild(quantities: ReadonlyMap<ItemId, number>, itemId: ItemId, amount = 1) {
  const next = new Map(quantities)
  next.set(itemId, clampQuantity((next.get(itemId) ?? 0) + amount))
  return next
}

export function setInBuild(
  quantities: ReadonlyMap<ItemId, number>,
  itemId: ItemId,
  quantity: number,
) {
  const next = new Map(quantities)
  // 0 is a valid transient state while typing, so keep the row rather than
  // yanking it out from under the input.
  next.set(itemId, clampQuantity(quantity))
  return next
}

export function removeFromBuild(quantities: ReadonlyMap<ItemId, number>, itemId: ItemId) {
  const next = new Map(quantities)
  next.delete(itemId)
  return next
}

export function toEntries(quantities: ReadonlyMap<ItemId, number>): BuildListEntry[] {
  return [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }))
}

/* ------------------------------------------------------ the collection */

let counter = 0

/** Unique enough for localStorage; no collision risk within one browser. */
export function newBuildId(): string {
  counter += 1
  return `b${Date.now().toString(36)}${counter.toString(36)}`
}

export function createBuild(name: string, entries: readonly BuildListEntry[] = []): Build {
  return {
    id: newBuildId(),
    name,
    quantities: new Map(entries.map((e) => [e.itemId, clampQuantity(e.quantity)])),
  }
}

/** "Build 3" — the lowest number not already taken, so names don't collide. */
export function nextBuildName(builds: readonly Build[]): string {
  const taken = new Set(builds.map((b) => b.name))
  // From 1, not from builds.length + 1: with "Build 1" and "Shared build"
  // present, the next one should be "Build 2", not "Build 3".
  for (let n = 1; ; n += 1) {
    const name = `Build ${n}`
    if (!taken.has(name)) return name
  }
}

export function activeBuild(collection: BuildCollection): Build {
  return collection.builds.find((b) => b.id === collection.activeId) ?? collection.builds[0]
}

export function replaceBuild(
  collection: BuildCollection,
  id: string,
  update: (build: Build) => Build,
): BuildCollection {
  return {
    ...collection,
    builds: collection.builds.map((b) => (b.id === id ? update(b) : b)),
  }
}

export function addBuild(collection: BuildCollection, build: Build): BuildCollection {
  if (collection.builds.length >= MAX_BUILDS) return collection
  return { ...collection, builds: [...collection.builds, build], activeId: build.id }
}

/**
 * Delete a build.
 *
 * The collection is never empty: removing the last one leaves a fresh empty
 * build rather than a UI with nothing to edit.
 */
export function deleteBuild(collection: BuildCollection, id: string): BuildCollection {
  const remaining = collection.builds.filter((b) => b.id !== id)
  if (remaining.length === 0) {
    const fresh = createBuild('Build 1')
    return { ...collection, builds: [fresh], activeId: fresh.id }
  }
  const activeId = collection.activeId === id ? remaining[0].id : collection.activeId
  return { ...collection, builds: remaining, activeId }
}

export function renameBuild(
  collection: BuildCollection,
  id: string,
  name: string,
): BuildCollection {
  const trimmed = name.trim()
  // An empty name would leave an unclickable blank row in the switcher.
  return replaceBuild(collection, id, (b) => ({ ...b, name: trimmed || b.name }))
}

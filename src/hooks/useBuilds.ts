import { useCallback, useMemo, useState } from 'react'
import {
  activeBuild,
  addBuild,
  addToBuild,
  createBuild,
  deleteBuild,
  nextBuildName,
  removeFromBuild,
  renameBuild,
  replaceBuild,
  setInBuild,
  toEntries,
  type BuildCollection,
} from '@/lib/builds'
import { loadBuilds, saveBuilds } from '@/lib/buildsState'
import type { BuildListEntry } from '@/lib/calculator'
import type { ItemId } from '@/types/game'

/**
 * The named build collection, and the active build's contents.
 *
 * One state owner rather than a collection hook wrapping a per-build hook —
 * two sources of truth for "what's in the list right now" would drift the first
 * time a switch raced an edit.
 *
 * Edits auto-save. The single build already persisted without an explicit save
 * step, so requiring one now would be a regression: people would start losing
 * work they currently never lose.
 */
export function useBuilds(
  isKnownId: (id: ItemId) => boolean,
  shared?: { build: BuildListEntry[]; playerLevel: number | null },
) {
  const [collection, setCollection] = useState<BuildCollection>(() => {
    const loaded = loadBuilds(isKnownId)
    if (!shared || (shared.build.length === 0 && shared.playerLevel === null)) return loaded

    // A shared link opens as its own build rather than overwriting whatever was
    // active. Following someone's link should never cost you a saved list.
    //
    // Note this is not persisted until the user edits something. That is
    // deliberate: writing it on load would add another copy every time the same
    // link was opened. It becomes yours once you start working on it.
    const withShared =
      shared.build.length > 0
        ? addBuild(loaded, createBuild(nextSharedName(loaded), shared.build))
        : loaded

    // The link's tech level still applies — it describes the save the build was
    // planned against, and dropping it would silently change what reads as
    // locked.
    return shared.playerLevel === null
      ? withShared
      : { ...withShared, playerLevel: shared.playerLevel }
  })

  const update = useCallback((change: (previous: BuildCollection) => BuildCollection) => {
    setCollection((previous) => {
      const next = change(previous)
      saveBuilds(next)
      return next
    })
  }, [])

  const active = activeBuild(collection)
  const activeId = active.id

  const add = useCallback(
    (itemId: ItemId, amount = 1) =>
      update((c) =>
        replaceBuild(c, c.activeId, (b) => ({
          ...b,
          quantities: addToBuild(b.quantities, itemId, amount),
        })),
      ),
    [update],
  )

  const setQuantity = useCallback(
    (itemId: ItemId, quantity: number) =>
      update((c) =>
        replaceBuild(c, c.activeId, (b) => ({
          ...b,
          quantities: setInBuild(b.quantities, itemId, quantity),
        })),
      ),
    [update],
  )

  const remove = useCallback(
    (itemId: ItemId) =>
      update((c) =>
        replaceBuild(c, c.activeId, (b) => ({
          ...b,
          quantities: removeFromBuild(b.quantities, itemId),
        })),
      ),
    [update],
  )

  const clear = useCallback(
    () => update((c) => replaceBuild(c, c.activeId, (b) => ({ ...b, quantities: new Map() }))),
    [update],
  )

  const setPlayerLevel = useCallback(
    (playerLevel: number | null) => update((c) => ({ ...c, playerLevel })),
    [update],
  )

  const select = useCallback(
    (id: string) => update((c) => (c.builds.some((b) => b.id === id) ? { ...c, activeId: id } : c)),
    [update],
  )

  const create = useCallback(
    () => update((c) => addBuild(c, createBuild(nextBuildName(c.builds)))),
    [update],
  )

  const duplicate = useCallback(
    () =>
      update((c) => {
        const source = activeBuild(c)
        return addBuild(c, createBuild(nextBuildName(c.builds), toEntries(source.quantities)))
      }),
    [update],
  )

  const rename = useCallback(
    (name: string) => update((c) => renameBuild(c, c.activeId, name)),
    [update],
  )

  const removeBuild = useCallback(() => update((c) => deleteBuild(c, c.activeId)), [update])

  const entries = useMemo<BuildListEntry[]>(() => toEntries(active.quantities), [active.quantities])

  return {
    builds: collection.builds,
    activeId,
    name: active.name,
    quantities: active.quantities,
    playerLevel: collection.playerLevel,
    entries,
    add,
    setQuantity,
    remove,
    clear,
    setPlayerLevel,
    select,
    create,
    duplicate,
    rename,
    removeBuild,
  }
}

function nextSharedName(collection: BuildCollection): string {
  const taken = new Set(collection.builds.map((b) => b.name))
  if (!taken.has('Shared build')) return 'Shared build'
  for (let n = 2; ; n += 1) {
    const name = `Shared build ${n}`
    if (!taken.has(name)) return name
  }
}

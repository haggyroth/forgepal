/**
 * Persistence for what the player already has.
 *
 * Deliberately **not** part of the shareable URL, unlike the build list and
 * tech level. A link is meant to hand someone a build; baking your chest
 * contents into it would show them a requisition already reduced by materials
 * they do not own, which is worse than useless — it is quietly wrong.
 *
 * Guarded like the other storage modules: localStorage throws in Safari private
 * browsing, and losing an inventory must never take the page down with it.
 */

import type { ItemId } from '@/types/game'

const KEY = 'forgepal:inventory:v1'

/** See storage.ts — Node's own global shadows the DOM one under test. */
function storage(): Storage {
  return window.localStorage
}

/**
 * Ids are validated against the dataset on load for the same reason shared
 * links are: an item removed upstream should drop out rather than linger as a
 * phantom row.
 */
export function loadInventory(isKnownId: (id: ItemId) => boolean): Map<ItemId, number> {
  try {
    const raw = storage().getItem(KEY)
    if (!raw) return new Map()

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return new Map()

    return new Map(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([id, qty]) => typeof qty === 'number' && qty > 0 && isKnownId(id))
        .map(([id, qty]) => [id, Math.floor(qty as number)]),
    )
  } catch {
    return new Map()
  }
}

export function saveInventory(stock: ReadonlyMap<ItemId, number>): void {
  try {
    if (stock.size === 0) storage().removeItem(KEY)
    else storage().setItem(KEY, JSON.stringify(Object.fromEntries(stock)))
  } catch {
    // Not saved; the session still works.
  }
}

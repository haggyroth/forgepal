/**
 * Local persistence for the build list.
 *
 * Every access is guarded: localStorage throws in Safari private browsing and
 * when a user has disabled site data. Losing persistence is a mild annoyance;
 * an unhandled throw on startup would be a blank page.
 */

import { decodeState, encodeState, emptyState, type SharedState } from './shareState'
import type { ItemId } from '@/types/game'

const KEY = 'forgepal:build:v1'

/**
 * Reached through `window` rather than the bare global on purpose: Node ships
 * its own experimental `localStorage` global, which shadows the DOM one under
 * test and is unusable without a CLI flag. In a browser these are the same
 * object.
 */
function storage(): Storage {
  return window.localStorage
}

/**
 * Stored in the same format as the shareable URL, so there is one encoding to
 * reason about and a saved build can be turned into a link without conversion.
 */
export function savePersisted(state: SharedState): void {
  try {
    const encoded = encodeState(state)
    if (encoded) storage().setItem(KEY, encoded)
    else storage().removeItem(KEY)
  } catch {
    // Storage unavailable or full — the app works fine without it.
  }
}

export function loadPersisted(isKnownId: (id: ItemId) => boolean): SharedState {
  try {
    const raw = storage().getItem(KEY)
    if (!raw) return emptyState
    return decodeState(raw, isKnownId).state
  } catch {
    return emptyState
  }
}

export function clearPersisted(): void {
  try {
    storage().removeItem(KEY)
  } catch {
    // Nothing to do; see savePersisted.
  }
}

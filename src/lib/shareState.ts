/**
 * Shareable build-list state.
 *
 * Encoded into the query string so a build can be sent to someone else, and
 * into localStorage so a refresh doesn't wipe your work. Both use the same
 * shape, so there is one definition of "what a saved build is".
 *
 * The wire format is `build=mega-sphere.20_ingot.5&level=34`. Item ids are
 * `[a-z0-9-]` only, so `.` and `_` are free as separators and nothing needs
 * percent-encoding — the URL stays readable, which makes a shared link
 * debuggable by eye.
 *
 * Ids are used rather than array indices deliberately: indices would silently
 * point at different items the next time the dataset is regenerated, turning
 * every previously shared link into a wrong build list.
 */

import type { BuildListEntry } from './calculator'
import type { ItemId } from '@/types/game'
import { formatQuery, parseQuery } from './query'
import { MAX_TECH_LEVEL } from './tech'

const BUILD_PARAM = 'build'
const LEVEL_PARAM = 'level'
const ENTRY_SEPARATOR = '_'
const QUANTITY_SEPARATOR = '.'

/** Guards against a pathological URL being pasted in. */
const MAX_ENTRIES = 200
const MAX_QUANTITY = 99_999

export interface SharedState {
  build: BuildListEntry[]
  playerLevel: number | null
}

export const emptyState: SharedState = { build: [], playerLevel: null }

export interface DecodeResult {
  state: SharedState
  /** Ids that were present but aren't in the dataset — reported, not silently dropped. */
  unknownIds: string[]
}

/**
 * Encode state into a query string, without a leading `?`.
 *
 * Returns an empty string when there is nothing worth sharing, so the caller
 * can strip the query entirely rather than leaving `?build=` behind.
 */
export function encodeState(state: SharedState): string {
  return formatQuery(writeInto(new URLSearchParams(), state))
}

/**
 * Update the build params in an existing query string, leaving the rest alone.
 *
 * The address-bar sync used to rebuild the whole query from build state, which
 * was fine while the build list was the only thing in the URL. It isn't any
 * more — `?tab=` lives there too — and a wholesale rewrite would drop it on the
 * next quantity tweak.
 */
export function applyState(search: string, state: SharedState): string {
  return formatQuery(writeInto(parseQuery(search), state))
}

function writeInto(params: URLSearchParams, state: SharedState): URLSearchParams {
  const entries = state.build
    .filter((entry) => Number.isFinite(entry.quantity) && entry.quantity > 0)
    .map((entry) => `${entry.itemId}${QUANTITY_SEPARATOR}${Math.floor(entry.quantity)}`)

  if (entries.length > 0) params.set(BUILD_PARAM, entries.join(ENTRY_SEPARATOR))
  else params.delete(BUILD_PARAM)

  if (state.playerLevel !== null) params.set(LEVEL_PARAM, String(state.playerLevel))
  else params.delete(LEVEL_PARAM)

  return params
}

/**
 * Decode a query string.
 *
 * `isKnownId` lets the caller reject ids that aren't in the current dataset.
 * A link shared before a data update can reference an item that no longer
 * exists; dropping it beats rendering a build list with a phantom row.
 */
export function decodeState(
  search: string,
  isKnownId: (id: ItemId) => boolean = () => true,
): DecodeResult {
  const params = parseQuery(search)
  const build: BuildListEntry[] = []
  const unknownIds: string[] = []
  const seen = new Set<ItemId>()

  const raw = params.get(BUILD_PARAM) ?? ''
  for (const chunk of raw.split(ENTRY_SEPARATOR)) {
    if (!chunk || build.length >= MAX_ENTRIES) continue

    const splitAt = chunk.lastIndexOf(QUANTITY_SEPARATOR)
    if (splitAt <= 0) continue

    const itemId = chunk.slice(0, splitAt)
    const quantity = Number(chunk.slice(splitAt + 1))

    if (!/^[a-z0-9-]+$/.test(itemId)) continue
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (seen.has(itemId)) continue

    if (!isKnownId(itemId)) {
      unknownIds.push(itemId)
      continue
    }

    seen.add(itemId)
    build.push({ itemId, quantity: Math.min(Math.floor(quantity), MAX_QUANTITY) })
  }

  return { state: { build, playerLevel: parseLevel(params.get(LEVEL_PARAM)) }, unknownIds }
}

function parseLevel(raw: string | null): number | null {
  if (raw === null) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) return null
  return Math.min(Math.floor(value), MAX_TECH_LEVEL)
}

/** Absolute URL for sharing, built against the page's own location. */
export function buildShareUrl(state: SharedState, origin: string, pathname: string): string {
  const query = encodeState(state)
  return query ? `${origin}${pathname}?${query}` : `${origin}${pathname}`
}

export function isEmptyState(state: SharedState): boolean {
  return state.build.length === 0 && state.playerLevel === null
}

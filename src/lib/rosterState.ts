/**
 * Persistence for the Pals you own.
 *
 * Deliberately **not** part of the shareable URL, for the same reason the
 * calculator's inventory isn't. A breeding link should carry the *question* —
 * which Pal you are trying to reach — and let the recipient's own roster answer
 * it. Encoding the sender's Pals would either clobber the recipient's roster or
 * show them a chain built from parents they do not have, which is worse than no
 * answer: it looks like a plan.
 *
 * See `inventoryState.ts` for the calculator's half of this rule, and
 * `breedingQuery.ts` for what does go in the URL.
 *
 * Stored as an ordered array rather than a set, so the roster reads back in the
 * order it was built rather than reshuffling on every load.
 */

import type { PalId } from '@/types/breeding'

const KEY = 'forgepal:roster:v1'

/** See storage.ts — Node's own global shadows the DOM one under test. */
function storage(): Storage {
  return window.localStorage
}

/**
 * Ids are validated against the dataset on load, like shared build links: a Pal
 * renamed or removed upstream should drop out rather than linger as a row that
 * the solver silently ignores.
 */
export function loadRoster(isKnownId: (id: PalId) => boolean): PalId[] {
  try {
    const raw = storage().getItem(KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Deduplicated on load as well as on add: the stored value is editable in
    // devtools, and a repeated Pal would pair with itself twice in the solver
    // for no benefit.
    const roster: PalId[] = []
    for (const id of parsed) {
      if (typeof id !== 'string') continue
      if (!isKnownId(id)) continue
      if (roster.includes(id)) continue
      roster.push(id)
    }
    return roster
  } catch {
    return []
  }
}

export function saveRoster(roster: readonly PalId[]): void {
  try {
    if (roster.length === 0) storage().removeItem(KEY)
    else storage().setItem(KEY, JSON.stringify(roster))
  } catch {
    // Not saved; the session still works.
  }
}

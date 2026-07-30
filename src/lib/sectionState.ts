/**
 * Which panels the user has collapsed.
 *
 * Deliberately *not* part of the shareable URL. Collapse state is a personal
 * view preference, not part of a build — encoding it would pollute every shared
 * link and impose the sender's layout on the recipient. It lives in
 * localStorage under its own key, separate from the build itself.
 *
 * Every access is guarded for the same reason as `storage.ts`: localStorage
 * throws in Safari private browsing, and losing a layout preference must never
 * take the page down with it.
 */

const KEY = 'forgepal:sections:v1'

/** See the note in storage.ts — Node's own global shadows the DOM one in tests. */
function storage(): Storage {
  return window.localStorage
}

type SectionState = Record<string, boolean>

function readAll(): SectionState {
  try {
    const raw = storage().getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    // Anything other than a flat object of booleans is treated as absent rather
    // than trusted — this value is user-editable via devtools.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'boolean'),
    ) as SectionState
  } catch {
    return {}
  }
}

/** The stored preference for one section, or null when the user hasn't set one. */
export function readSectionOpen(id: string): boolean | null {
  const all = readAll()
  return id in all ? all[id] : null
}

/** Read–modify–write, so two sections toggling in turn don't clobber each other. */
export function writeSectionOpen(id: string, open: boolean): void {
  try {
    storage().setItem(KEY, JSON.stringify({ ...readAll(), [id]: open }))
  } catch {
    // Preference not saved; the session still works.
  }
}

export function clearSectionState(): void {
  try {
    storage().removeItem(KEY)
  } catch {
    // Nothing to do.
  }
}

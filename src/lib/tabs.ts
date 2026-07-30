/**
 * Which tool the app is showing.
 *
 * This goes in the URL, unlike collapse state. A tab is *which tool you are
 * pointing someone at*, so a shared link has to carry it; collapse state is a
 * view preference, and encoding it would impose the sender's layout on whoever
 * opens the link. See `sectionState.ts` for the other half of that rule.
 *
 * The default is omitted from the query, so every link shared before tabs
 * existed still means exactly what it meant then.
 */

import { formatQuery, parseQuery } from './query'

export const TABS = [
  { id: 'calculator', label: 'Calculator' },
  { id: 'breeding', label: 'Breeding' },
] as const

export type TabId = (typeof TABS)[number]['id']

export const DEFAULT_TAB: TabId = 'calculator'

const TAB_PARAM = 'tab'

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

/** Falls back to the default for anything unrecognised — a stale link still works. */
export function decodeTab(search: string): TabId {
  const raw = parseQuery(search).get(TAB_PARAM)
  return isTabId(raw) ? raw : DEFAULT_TAB
}

/** The query string with the tab applied, every other param preserved. */
export function applyTab(search: string, tab: TabId): string {
  const params = parseQuery(search)
  if (tab === DEFAULT_TAB) params.delete(TAB_PARAM)
  else params.set(TAB_PARAM, tab)
  return formatQuery(params)
}

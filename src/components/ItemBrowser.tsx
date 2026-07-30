import { useMemo, useState } from 'react'
import {
  categoryLabel,
  emptyFilters,
  orderedCategories,
  searchEntries,
  type Entry,
} from '@/lib/search'
import { isLocked } from '@/lib/tech'
import type { ItemCategory, ItemId, Station } from '@/types/game'
import { useCollapsedSection } from '@/hooks/useCollapsedSection'
import { SectionToggle } from './Section'
import { Panel, SourceBadge } from './ui'

const RESULT_LIMIT = 60

export function ItemBrowser({
  entries,
  stations,
  playerLevel,
  onAdd,
  inList,
}: {
  entries: readonly Entry[]
  stations: readonly Station[]
  /** Null when the user hasn't said what level they are; nothing is gated then. */
  playerLevel: number | null
  onAdd: (itemId: ItemId) => void
  inList: ReadonlySet<ItemId>
}) {
  const [open, toggle] = useCollapsedSection('catalogue', true)
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState<ReadonlySet<ItemCategory>>(new Set())
  const [craftableOnly, setCraftableOnly] = useState(true)
  const [hideLocked, setHideLocked] = useState(false)
  const [stationId, setStationId] = useState<ItemId | null>(null)

  const available = useMemo(() => orderedCategories(entries), [entries])

  // Hiding locked entries only means anything once we know the player's level.
  const maxTechLevel = hideLocked ? playerLevel : null

  const { results, total } = useMemo(
    () =>
      searchEntries(
        entries,
        { ...emptyFilters, query, categories, craftableOnly, stationId, maxTechLevel },
        RESULT_LIMIT,
      ),
    [entries, query, categories, craftableOnly, stationId, maxTechLevel],
  )

  const toggleCategory = (category: ItemCategory) => {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    // The height classes apply only while open. Keeping the tall sticky column
    // when collapsed would leave a screen-high empty panel behind the heading.
    <Panel
      className={`flex flex-col lg:sticky lg:top-8 ${
        open ? 'max-h-[32rem] lg:h-[calc(100vh-4rem)] lg:max-h-none' : ''
      }`}
    >
      <SectionToggle
        title="Catalogue"
        aside={`${total}`}
        open={open}
        onToggle={toggle}
        contentId="catalogue-content"
        className={open ? 'mb-4' : ''}
      />

      {/* Unmounted when collapsed, which also drops the rendered result
          list — the most expensive thing in this panel. */}
      {open ? (
        <div id="catalogue-content" className="flex min-h-0 flex-1 flex-col">
          <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search items and structures…"
          aria-label="Search items and structures"
          className="w-full rounded-sm border border-iron-700 bg-iron-950/60 px-3 py-2 font-mono text-sm text-iron-100 placeholder:text-iron-600 focus:border-ember-700"
        />

        <select
          value={stationId ?? ''}
          onChange={(event) => setStationId(event.target.value || null)}
          aria-label="Filter by crafting station"
          className="mt-2 w-full rounded-sm border border-iron-700 bg-iron-950/60 px-2 py-1.5 font-mono text-[0.72rem] text-iron-300 focus:border-ember-700"
        >
          <option value="">any station</option>
          {stations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name}
              {station.techLevel !== null ? ` — Tech ${station.techLevel}` : ''}
            </option>
          ))}
        </select>

        <div className="mt-3 flex flex-wrap gap-1">
          <FilterChip active={craftableOnly} onClick={() => setCraftableOnly((v) => !v)}>
            craftable
          </FilterChip>
          {playerLevel !== null ? (
            <FilterChip active={hideLocked} onClick={() => setHideLocked((v) => !v)}>
              unlocked only
            </FilterChip>
          ) : null}
          {available.map((category) => (
            <FilterChip
              key={category}
              active={categories.has(category)}
              onClick={() => toggleCategory(category)}
            >
              {categoryLabel(category).toLowerCase()}
            </FilterChip>
          ))}
        </div>

        <ul className="mt-4 min-h-0 flex-1 space-y-px overflow-y-auto pr-1">
          {results.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onAdd(entry.id)}
                // The visible text is only the item name; the button's job is to
                // add it, which a screen reader would otherwise never hear.
                aria-label={`Add ${entry.name} to build list`}
                className="group flex w-full items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 text-left transition-colors hover:border-iron-700 hover:bg-iron-850"
              >
                <span
                  className={`min-w-0 flex-1 truncate font-mono text-sm ${
                    isLocked(entry, playerLevel) ? 'text-iron-400' : 'text-iron-100'
                  }`}
                >
                  {entry.name}
                </span>
                {entry.techLevel !== null ? (
                  <span
                    className={`shrink-0 font-mono text-[0.65rem] ${
                      isLocked(entry, playerLevel) ? 'text-ember-500' : 'text-iron-600'
                    }`}
                    title={
                      isLocked(entry, playerLevel)
                        ? `Unlocks at Technology ${entry.techLevel}`
                        : undefined
                    }
                  >
                    {isLocked(entry, playerLevel) ? '🔒 ' : ''}T{entry.techLevel}
                  </span>
                ) : null}
                <SourceBadge kind={entry.sourceKind} />
                <span
                  aria-hidden
                  className={`shrink-0 font-mono text-sm transition-colors ${
                    inList.has(entry.id)
                      ? 'text-ember-500'
                      : 'text-iron-700 group-hover:text-ember-400'
                  }`}
                >
                  {inList.has(entry.id) ? '✓' : '+'}
                </span>
              </button>
            </li>
          ))}

          {results.length === 0 ? (
            <li className="px-2 py-6 text-center font-mono text-sm text-iron-600">
              Nothing matches those filters.
            </li>
          ) : null}

          {total > results.length ? (
            <li className="px-2 pt-3 text-center font-mono text-[0.7rem] text-iron-600">
              showing {results.length} of {total} — narrow your search
            </li>
          ) : null}
        </ul>
        </div>
      ) : (
        <div id="catalogue-content" />
      )}
    </Panel>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm border px-2 py-0.5 font-mono text-[0.68rem] lowercase transition-colors ${
        active
          ? 'border-ember-700 bg-ember-700/15 text-ember-400'
          : 'border-iron-800 text-iron-400 hover:border-iron-700 hover:text-iron-300'
      }`}
    >
      {children}
    </button>
  )
}

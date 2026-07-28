import { useMemo, useState } from 'react'
import {
  categoryLabel,
  emptyFilters,
  orderedCategories,
  searchEntries,
  type Entry,
} from '@/lib/search'
import type { ItemCategory, ItemId } from '@/types/game'
import { SectionHeading, SourceBadge } from './ui'

const RESULT_LIMIT = 60

export function ItemBrowser({
  entries,
  onAdd,
  inList,
}: {
  entries: readonly Entry[]
  onAdd: (itemId: ItemId) => void
  inList: ReadonlySet<ItemId>
}) {
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState<ReadonlySet<ItemCategory>>(new Set())
  const [craftableOnly, setCraftableOnly] = useState(true)

  const available = useMemo(() => orderedCategories(entries), [entries])

  const { results, total } = useMemo(
    () => searchEntries(entries, { ...emptyFilters, query, categories, craftableOnly }, RESULT_LIMIT),
    [entries, query, categories, craftableOnly],
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
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeading aside={`${total}`}>Catalogue</SectionHeading>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search items and structures…"
        aria-label="Search items and structures"
        className="w-full rounded-sm border border-iron-700 bg-iron-950/60 px-3 py-2 font-mono text-sm text-iron-100 placeholder:text-iron-600 focus:border-ember-700"
      />

      <div className="mt-3 flex flex-wrap gap-1">
        <FilterChip active={craftableOnly} onClick={() => setCraftableOnly((v) => !v)}>
          craftable
        </FilterChip>
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
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-iron-100">
                {entry.name}
              </span>
              {entry.techLevel ? (
                <span className="shrink-0 font-mono text-[0.65rem] text-iron-600">
                  T{entry.techLevel}
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

import { useState } from 'react'
import type { CalculationResult, GameIndex, MaterialTotal } from '@/lib/calculator'
import type { DropSource } from '@/types/game'
import { Panel, SectionHeading, SourceBadge } from './ui'

/** How many drop sources to show before collapsing the rest behind a count. */
const DROPS_SHOWN = 4

export function Totals({ result, index }: { result: CalculationResult; index: GameIndex }) {
  const hasAnything = result.targets.length > 0

  if (!hasAnything) {
    return (
      <Panel>
        <SectionHeading>Requisition</SectionHeading>
        <p className="py-6 text-center font-mono text-sm text-iron-600">
          Nothing queued yet.
        </p>
      </Panel>
    )
  }

  return (
    <div className="space-y-5">
      {/*
        The raw list is the deliverable — everything you actually have to go
        out and get — so it gets the ember glow and the top slot. Intermediates
        are reference material and sit below in a quieter panel.
      */}
      <Panel glow>
        <SectionHeading aside={`${result.raw.length} to gather`}>Requisition</SectionHeading>
        <ul className="space-y-px">
          {result.raw.map((entry) => (
            <RawRow key={entry.itemId} entry={entry} index={index} />
          ))}
        </ul>
      </Panel>

      {result.intermediates.length > 0 ? (
        <Panel>
          <SectionHeading aside={`${result.intermediates.length}`}>Craft along the way</SectionHeading>
          <ul className="space-y-px">
            {result.intermediates.map((entry) => (
              <li
                key={entry.itemId}
                className="flex items-baseline gap-3 px-2 py-1.5 odd:bg-iron-950/30"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-iron-300">
                  {entry.name}
                </span>
                {entry.stationName ? (
                  <span className="hidden shrink-0 font-mono text-[0.68rem] text-blueprint-400/70 sm:inline">
                    {entry.stationName}
                  </span>
                ) : null}
                <Quantity total={entry} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {result.unresolved.length > 0 ? (
        <Panel>
          <SectionHeading>Unknown materials</SectionHeading>
          <p className="mb-2 font-mono text-[0.7rem] text-iron-600">
            Referenced by a recipe but missing from the dataset.
          </p>
          <ul className="space-y-px">
            {result.unresolved.map((entry) => (
              <li key={entry.itemId} className="flex items-baseline gap-3 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-iron-400">
                  {entry.name}
                </span>
                <span className="font-mono text-sm tnum text-iron-300">{entry.required}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

function RawRow({ entry, index }: { entry: MaterialTotal; index: GameIndex }) {
  const [open, setOpen] = useState(false)
  const source = index.byId.get(entry.itemId)
  const drops = source?.drops ?? []
  const notes = source?.otherSources ?? []
  const expandable = drops.length > 0 || notes.length > 0

  return (
    <li className="odd:bg-iron-950/30">
      <div className="flex items-baseline gap-3 px-2 py-1.5">
        {expandable ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="min-w-0 flex-1 truncate text-left font-mono text-sm text-iron-100 transition-colors hover:text-ember-400"
          >
            <span aria-hidden className="mr-1.5 inline-block w-2 text-iron-600">
              {open ? '−' : '+'}
            </span>
            {entry.name}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate pl-[1.375rem] font-mono text-sm text-iron-100">
            {entry.name}
          </span>
        )}

        <SourceBadge kind={entry.sourceKind} />
        <span className="w-16 shrink-0 text-right font-mono text-base font-semibold tnum text-ember-400">
          {entry.required.toLocaleString()}
        </span>
      </div>

      {open ? (
        <div className="border-l border-iron-800 px-2 pb-3 pl-6 pt-1">
          {drops.length > 0 ? <DropTable drops={drops} /> : null}
          {notes.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {notes.slice(0, 3).map((note) => (
                <li key={note} className="font-mono text-[0.68rem] text-iron-600">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function DropTable({ drops }: { drops: readonly DropSource[] }) {
  // Best odds first — the point of this table is "who should I hunt".
  const sorted = [...drops].sort(
    (a, b) => b.chance - a.chance || b.quantity[1] - a.quantity[1],
  )
  const shown = sorted.slice(0, DROPS_SHOWN)

  return (
    <>
      <div className="mb-1 font-display text-[0.65rem] uppercase tracking-[0.15em] text-iron-600">
        Dropped by
      </div>
      <ul className="space-y-0.5">
        {shown.map((drop) => (
          <li key={drop.source} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[0.72rem] text-iron-300">
              {drop.source}
            </span>
            <span className="shrink-0 font-mono text-[0.72rem] tnum text-iron-400">
              ×{drop.quantity[0]}
              {drop.quantity[1] !== drop.quantity[0] ? `–${drop.quantity[1]}` : ''}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-[0.72rem] tnum text-verdigris-400">
              {Math.round(drop.chance * 100)}%
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > shown.length ? (
        <div className="mt-1 font-mono text-[0.65rem] text-iron-700">
          +{sorted.length - shown.length} more sources
        </div>
      ) : null}
    </>
  )
}

function Quantity({ total }: { total: MaterialTotal }) {
  return (
    <span className="w-16 shrink-0 text-right font-mono text-sm tnum text-iron-100">
      {total.required.toLocaleString()}
      {total.surplus > 0 ? (
        <span className="ml-1 text-[0.65rem] text-iron-600" title={`${total.surplus} spare`}>
          +{total.surplus}
        </span>
      ) : null}
    </span>
  )
}

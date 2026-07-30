import { useState, type ReactNode } from 'react'
import type { CalculationResult, GameIndex, MaterialTotal } from '@/lib/calculator'
import type { DropSource, ExpeditionReward, GameData, ItemId, MerchantListing } from '@/types/game'
import { formatHours } from '@/lib/format'
import { toId } from '@/lib/id'
import type { HabitatIndex } from '@/lib/route'
import { Section } from './Section'
import { SourceBadge } from './ui'

/** The three sourcing lookups the requisition needs, bundled to keep props flat. */
export interface Sourcing {
  habitats: HabitatIndex
  merchantListings: GameData['merchantListings']
  expeditionRewards: GameData['expeditionRewards']
}

/** How many drop sources to show before collapsing the rest behind a count. */
const DROPS_SHOWN = 4

export function Totals({
  result,
  index,
  sourcing,
  stock,
  onSetStock,
  onClearStock,
  exportBar,
}: {
  result: CalculationResult
  index: GameIndex
  sourcing: Sourcing
  /** What the player already has, keyed by item id. */
  stock: ReadonlyMap<ItemId, number>
  onSetStock: (itemId: ItemId, amount: number) => void
  onClearStock: () => void
  /** Export controls, rendered in the Requisition header where the list lives. */
  exportBar?: ReactNode
}) {
  const hasAnything = result.targets.length > 0

  if (!hasAnything) {
    return (
      <Section id="requisition" title="Requisition">
        <p className="py-6 text-center font-mono text-sm text-iron-600">Nothing queued yet.</p>
      </Section>
    )
  }

  return (
    <div className="space-y-5">
      {/*
        The raw list is the deliverable — everything you actually have to go
        out and get — so it gets the ember glow and the top slot. Intermediates
        are reference material and sit below in a quieter panel.
      */}
      <Section
        id="requisition"
        title="Requisition"
        aside={
          <span className="flex items-center gap-3">
            {stock.size > 0 ? (
              <button
                type="button"
                onClick={onClearStock}
                className="font-mono text-[0.7rem] text-iron-600 transition-colors hover:text-ember-400"
              >
                clear stock
              </button>
            ) : null}
            <span>{`${result.raw.filter((r) => r.required > 0).length} to gather`}</span>
          </span>
        }
        glow
      >
        {exportBar ? <div className="mb-4 -mt-1">{exportBar}</div> : null}
        <ul className="space-y-px">
          {result.raw.map((entry) => (
            <RawRow
              key={entry.itemId}
              entry={entry}
              index={index}
              sourcing={sourcing}
              stock={stock.get(entry.itemId) ?? 0}
              onSetStock={onSetStock}
            />
          ))}
        </ul>
      </Section>

      {result.intermediates.length > 0 ? (
        <Section
          id="intermediates"
          title="Craft along the way"
          aside={`${result.intermediates.length}`}
        >
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
                    {/* Which Pal to put on it — the reason you care which
                        station a sub-component needs in the first place. */}
                    {stationWork(entry.stationName, index) ? (
                      <span className="text-verdigris-400/70">
                        {' · '}
                        {stationWork(entry.stationName, index)}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                <StockInput
                  name={entry.name}
                  value={stock.get(entry.itemId) ?? 0}
                  onChange={(amount) => onSetStock(entry.itemId, amount)}
                />
                <Quantity total={entry} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {result.unresolved.length > 0 ? (
        <Section id="unresolved" title="Unknown materials">
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
        </Section>
      ) : null}
    </div>
  )
}

function stationWork(stationName: string, index: GameIndex): string | null {
  return index.stationsById.get(toId(stationName))?.workSuitability ?? null
}

function RawRow({
  entry,
  index,
  sourcing,
  stock,
  onSetStock,
}: {
  entry: MaterialTotal
  index: GameIndex
  sourcing: Sourcing
  stock: number
  onSetStock: (itemId: ItemId, amount: number) => void
}) {
  const [open, setOpen] = useState(false)
  const source = index.byId.get(entry.itemId)
  const drops = source?.drops ?? []
  const notes = source?.otherSources ?? []
  const listings = sourcing.merchantListings[entry.itemId] ?? []
  const expeditions = sourcing.expeditionRewards[entry.itemId] ?? []
  const habitats = sourcing.habitats
  const expandable =
    drops.length > 0 || notes.length > 0 || listings.length > 0 || expeditions.length > 0

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
        <StockInput
          name={entry.name}
          value={stock}
          onChange={(amount) => onSetStock(entry.itemId, amount)}
        />
        {/* Covered rows stay listed rather than vanishing — seeing "0, you have
            it" is the reassurance; disappearing would read as a bug. */}
        <span
          className={`w-16 shrink-0 text-right font-mono text-base font-semibold tnum ${
            entry.required === 0 ? 'text-verdigris-400' : 'text-ember-400'
          }`}
          title={
            entry.fromInventory > 0
              ? `${entry.gross.toLocaleString()} needed, ${entry.fromInventory.toLocaleString()} in stock`
              : undefined
          }
        >
          {entry.required === 0 ? '✓' : entry.required.toLocaleString()}
        </span>
      </div>

      {open ? (
        <div className="border-l border-iron-800 px-2 pb-3 pl-6 pt-1">
          {drops.length > 0 ? <DropTable drops={drops} habitats={habitats} /> : null}
          {listings.length > 0 ? <MerchantTable listings={listings} /> : null}
          {expeditions.length > 0 ? <ExpeditionTable rewards={expeditions} /> : null}
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

/**
 * How much of this the player already has.
 *
 * Sits inline on the row rather than in a separate inventory screen: you record
 * stock while looking at what you need, not by hunting for the item again in
 * another list.
 */
function StockInput({
  name,
  value,
  onChange,
}: {
  name: string
  value: number
  onChange: (amount: number) => void
}) {
  return (
    <input
      type="number"
      min={0}
      value={value === 0 ? '' : value}
      placeholder="have"
      aria-label={`${name} in stock`}
      onChange={(event) => onChange(Number(event.target.value))}
      className={`w-16 shrink-0 rounded-sm border bg-iron-950/60 px-1.5 py-0.5 text-right font-mono text-[0.72rem] tnum [appearance:textfield] focus:border-ember-700 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
        value > 0
          ? 'border-verdigris-400/40 text-verdigris-400'
          : 'border-iron-800 text-iron-400 placeholder:text-iron-700'
      }`}
    />
  )
}

function DropTable({ drops, habitats }: { drops: readonly DropSource[]; habitats: HabitatIndex }) {
  // Best odds first — the point of this table is "who should I hunt". Sources
  // with an unknown rate sort last rather than being treated as zero.
  const sorted = [...drops].sort(
    (a, b) => (b.chance ?? -1) - (a.chance ?? -1) || b.quantity[1] - a.quantity[1],
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
              {/* Where it lives, so a drop table reads as somewhere to go.
                  Absent for humans, NPCs, and legendaries with no wild spawn. */}
              {habitats.get(drop.source) ? (
                <span className="ml-1.5 text-iron-600">
                  {habitats.get(drop.source)!.regions.slice(0, 2).join(', ')}
                  {habitats.get(drop.source)!.dayNight === 'night' ? ' · night' : ''}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-mono text-[0.72rem] tnum text-iron-400">
              ×{drop.quantity[0]}
              {drop.quantity[1] !== drop.quantity[0] ? `–${drop.quantity[1]}` : ''}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-[0.72rem] tnum text-verdigris-400">
              {drop.chance === null ? (
                <span className="text-iron-600" title="Drop rate not recorded upstream">
                  ?
                </span>
              ) : (
                `${Math.round(drop.chance * 100)}%`
              )}
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

/**
 * Vendors that stock this.
 *
 * The point is the alternative: you may not have to farm it at all. Most
 * upstream listings carry no price, so absence of a number is normal and is
 * shown as such rather than as free.
 */
function MerchantTable({ listings }: { listings: readonly MerchantListing[] }) {
  const shown = listings.slice(0, 3)

  return (
    <>
      <div className="mb-1 mt-2 font-display text-[0.65rem] uppercase tracking-[0.15em] text-iron-600">
        Or buy from
      </div>
      <ul className="space-y-0.5">
        {shown.map((listing, i) => (
          <li key={`${listing.merchant}-${i}`} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[0.72rem] text-iron-300">
              {listing.merchant}
              {listing.locations.length > 0 ? (
                <span className="ml-1.5 text-iron-600">{listing.locations[0]}</span>
              ) : null}
            </span>
            <span className="shrink-0 font-mono text-[0.72rem] tnum text-iron-400">
              {listing.price === null ? (
                <span className="text-iron-600" title="Price not recorded upstream">
                  price ?
                </span>
              ) : (
                `${listing.price.toLocaleString()} ${listing.currency}`
              )}
            </span>
          </li>
        ))}
      </ul>
      {listings.length > shown.length ? (
        <div className="mt-1 font-mono text-[0.65rem] text-iron-700">
          +{listings.length - shown.length} more vendors
        </div>
      ) : null}
    </>
  )
}

/**
 * Expeditions that return this.
 *
 * Upstream's item pages omit expedition rewards entirely — its own `gaps` field
 * says so — so this is sourcing information the per-item data cannot give.
 */
function ExpeditionTable({ rewards }: { rewards: readonly ExpeditionReward[] }) {
  const shown = rewards.slice(0, 3)

  return (
    <>
      <div className="mb-1 mt-2 font-display text-[0.65rem] uppercase tracking-[0.15em] text-iron-600">
        Or send an expedition
      </div>
      <ul className="space-y-0.5">
        {shown.map((reward, i) => (
          <li key={`${reward.mission}-${i}`} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[0.72rem] text-iron-300">
              {reward.mission}
              {reward.durationHours !== null ? (
                <span className="ml-1.5 text-iron-600">{formatHours(reward.durationHours)}</span>
              ) : null}
            </span>
            <span className="shrink-0 font-mono text-[0.72rem] tnum text-verdigris-400">
              ×{reward.quantity}
            </span>
          </li>
        ))}
      </ul>
      {rewards.length > shown.length ? (
        <div className="mt-1 font-mono text-[0.65rem] text-iron-700">
          +{rewards.length - shown.length} more expeditions
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

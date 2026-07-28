import type { GameIndex, MaterialTotal } from '@/lib/calculator'
import type { ItemId } from '@/types/game'
import { SectionHeading, Stepper } from './ui'

export function BuildList({
  quantities,
  index,
  totals,
  onSetQuantity,
  onRemove,
  onClear,
}: {
  quantities: ReadonlyMap<ItemId, number>
  index: GameIndex
  /** Computed totals, keyed by id — carries batch surplus and any extra demand. */
  totals: ReadonlyMap<ItemId, MaterialTotal>
  onSetQuantity: (itemId: ItemId, quantity: number) => void
  onRemove: (itemId: ItemId) => void
  onClear: () => void
}) {
  const rows = [...quantities]

  return (
    <div>
      <SectionHeading
        aside={
          rows.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-[0.7rem] text-iron-600 transition-colors hover:text-ember-400"
            >
              clear all
            </button>
          ) : undefined
        }
      >
        Build list
      </SectionHeading>

      {rows.length === 0 ? (
        <p className="rounded-sm border border-dashed border-iron-800 px-4 py-8 text-center font-mono text-sm text-iron-600">
          Pick items from the catalogue to start a build.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map(([itemId, quantity]) => {
            const entry = index.byId.get(itemId)
            const total = totals.get(itemId)
            return (
              <li
                key={itemId}
                className="flex items-center gap-3 rounded-sm border border-iron-800 bg-iron-950/40 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm text-iron-100">
                    {entry?.name ?? itemId}
                  </div>
                  {/* Wraps rather than truncates — the batch maths is the
                      whole reason this line exists, so losing its tail to an
                      ellipsis on narrow screens defeats the point. */}
                  <div className="font-mono text-[0.68rem] leading-snug text-iron-600">
                    {entry?.recipe?.stationName ?? 'no recipe'}
                    {/*
                      Batch recipes can't make a partial craft, so 15 Arrows is
                      really 2 batches of 10. Say so here, where the quantity is
                      being set, rather than letting the material totals look
                      inexplicably high.
                    */}
                    {total && total.surplus > 0
                      ? ` · ${total.crafts} × ${entry?.recipe?.yield} = ${total.produced}, ${total.surplus} spare`
                      : entry?.recipe && entry.recipe.yield > 1
                        ? ` · batches of ${entry.recipe.yield}`
                        : ''}
                    {total && total.required > quantity
                      ? ` · ${total.required} needed incl. other recipes`
                      : ''}
                  </div>
                </div>

                <Stepper
                  value={quantity}
                  label={entry?.name ?? itemId}
                  onChange={(next) => onSetQuantity(itemId, next)}
                />

                <button
                  type="button"
                  onClick={() => onRemove(itemId)}
                  aria-label={`Remove ${entry?.name ?? itemId}`}
                  className="px-1 font-mono text-sm text-iron-700 transition-colors hover:text-ember-500"
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

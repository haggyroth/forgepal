import type { BreedingPal, PalId } from '@/types/breeding'

/**
 * A Pal chooser.
 *
 * A native `<select>` over all 299, rather than the search-and-filter list the
 * item catalogue uses. Two reasons: the browser gives keyboard typeahead, screen
 * reader support, and mobile pickers for free, and 299 is small enough that the
 * option list is not a performance concern — unlike the 1,320-entry catalogue,
 * which is exactly why that one needed search instead.
 */
export function PalSelect({
  label,
  value,
  pals,
  onChange,
  placeholder = 'choose a Pal…',
  exclude,
}: {
  label: string
  value: PalId | null
  /** Pre-sorted by the caller; this component does not reorder. */
  pals: readonly BreedingPal[]
  onChange: (id: PalId | null) => void
  placeholder?: string
  /** Ids to leave out — the other parent, or Pals already in the roster. */
  exclude?: ReadonlySet<PalId>
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-iron-400">
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-sm border border-iron-700 bg-iron-950/60 px-3 py-2 font-mono text-sm text-iron-100 focus:border-ember-700 focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {pals.map((pal) =>
          // The currently selected Pal is always listed, even if excluded, or
          // changing the other field would blank this one out from under you.
          exclude?.has(pal.id) && pal.id !== value ? null : (
            <option key={pal.id} value={pal.id}>
              {pal.name}
            </option>
          ),
        )}
      </select>
    </label>
  )
}

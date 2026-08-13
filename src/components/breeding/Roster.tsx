import { useMemo, useState } from 'react'
import type { BreedIndex } from '@/lib/breeding'
import type { BreedingPal, PalId } from '@/types/breeding'
import { Section } from '@/components/Section'
import { PalSelect } from './PalSelect'

/**
 * The Pals you own — the set the solver starts from.
 *
 * Persisted locally and kept out of the URL; see `rosterState.ts` for why a
 * shared link carries the question and not your Pals.
 *
 * The count is in the collapsed summary because it is the one thing you want to
 * know without expanding: an empty roster is why the solver has nothing to say.
 */
export function Roster({
  index,
  pals,
  roster,
  onAdd,
  onRemove,
  onClear,
}: {
  index: BreedIndex
  pals: readonly BreedingPal[]
  roster: readonly PalId[]
  onAdd: (id: PalId) => void
  onRemove: (id: PalId) => void
  onClear: () => void
}) {
  // Held locally rather than lifted: the half-made selection in the picker is
  // not roster state, and persisting it would restore a dangling choice.
  const [pending, setPending] = useState<PalId | null>(null)
  const owned = useMemo(() => new Set(roster), [roster])

  const add = (id: PalId | null) => {
    if (!id) return
    onAdd(id)
    // Cleared so the picker is ready for the next one — adding several in a row
    // is the normal case when you first set a roster up.
    setPending(null)
  }

  return (
    <Section
      id="breeding-roster"
      title="Your roster"
      aside={roster.length > 0 ? `${roster.length} pal${roster.length === 1 ? '' : 's'}` : 'empty'}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <PalSelect
            label="add a pal you own"
            value={pending}
            pals={pals}
            onChange={add}
            exclude={owned}
            placeholder="choose a Pal…"
          />
        </div>
        {roster.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-sm border border-iron-800 px-2.5 py-1.5 font-mono text-[0.68rem] lowercase text-iron-400 transition-colors hover:border-iron-600 hover:text-iron-300"
          >
            clear all
          </button>
        ) : null}
      </div>

      {roster.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {roster.map((id) => (
            <li key={id}>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-iron-700 bg-iron-950/40 py-1 pl-2.5 pr-1 font-mono text-[0.72rem] text-iron-300">
                {index.byId.get(id)?.name ?? id}
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  aria-label={`Remove ${index.byId.get(id)?.name ?? id} from roster`}
                  className="px-1 text-iron-400 transition-colors hover:text-ember-400"
                >
                  <span aria-hidden>×</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 max-w-[64ch] font-mono text-[0.72rem] leading-relaxed text-iron-400">
          Add the Pals you have caught. The chain below is worked out from these, so it only ever
          suggests crosses you can actually start.
        </p>
      )}
    </Section>
  )
}

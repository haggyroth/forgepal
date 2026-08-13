import { useMemo } from 'react'
import { breed, parentsFor, type BreedIndex } from '@/lib/breeding'
import type { BreedingPal, PalId } from '@/types/breeding'
import { Section } from '@/components/Section'
import { PalSelect } from './PalSelect'
import { TieBroken, TieBrokenNote } from './TieBroken'

/**
 * A + B = ?, and its inverse.
 *
 * This is the table-stakes half — every existing Palworld calculator answers it.
 * It earns its place next to the solver by being the thing you use to check the
 * solver: when a chain suggests a step you doubt, this is where you verify it,
 * and `parentsFor` gives you the alternatives if you cannot get those parents.
 */
export function PairCalculator({
  index,
  pals,
  pairA,
  pairB,
  onChange,
  onAddToRoster,
  inRoster,
  tieBreakShare,
}: {
  index: BreedIndex
  pals: readonly BreedingPal[]
  pairA: PalId | null
  pairB: PalId | null
  onChange: (pair: { pairA: PalId | null; pairB: PalId | null }) => void
  onAddToRoster: (id: PalId) => void
  inRoster: ReadonlySet<PalId>
  tieBreakShare: number
}) {
  const result = useMemo(
    () => (pairA && pairB ? breed(index, pairA, pairB) : null),
    [index, pairA, pairB],
  )

  // The inverse is only offered once there is a child to invert. 299² pairs is
  // ~45k `breed` calls, cheap enough on demand but not worth doing unprompted.
  const alternatives = useMemo(
    () => (result ? parentsFor(index, result.child).slice(0, 8) : []),
    [index, result],
  )

  const name = (id: PalId) => index.byId.get(id)?.name ?? id

  return (
    <Section id="breeding-pair" title="Pair calculator" glow>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <PalSelect
          label="parent"
          value={pairA}
          pals={pals}
          onChange={(id) => onChange({ pairA: id, pairB })}
          exclude={pairB ? new Set([pairB]) : undefined}
        />
        <span aria-hidden className="hidden self-end pb-2 font-mono text-sm text-iron-400 sm:block">
          +
        </span>
        <PalSelect
          label="parent"
          value={pairB}
          pals={pals}
          onChange={(id) => onChange({ pairA, pairB: id })}
          exclude={pairA ? new Set([pairA]) : undefined}
        />
      </div>

      {result ? (
        <div className="mt-5 rounded-sm border border-iron-800 bg-iron-950/40 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-iron-400">
              produces
            </span>
            <span className="font-display text-xl font-bold text-iron-100">
              {name(result.child)}
            </span>
            {result.special ? (
              <span className="rounded-sm border border-blueprint-500/30 px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-wider text-blueprint-400">
                fixed combo
              </span>
            ) : null}
            {result.tieBroken ? <TieBroken /> : null}
            {inRoster.has(result.child) ? (
              <span className="font-mono text-[0.68rem] text-iron-400">already in your roster</span>
            ) : (
              <button
                type="button"
                onClick={() => onAddToRoster(result.child)}
                className="rounded-sm border border-iron-700 px-2.5 py-1 font-mono text-[0.68rem] lowercase text-iron-300 transition-colors hover:border-ember-700 hover:text-ember-400"
              >
                add to roster
              </button>
            )}
          </div>

          <p className="mt-3 font-mono text-[0.68rem] leading-relaxed text-iron-400">
            {result.special
              ? 'A fixed combination, so this is an exact lookup rather than the rank formula — no ambiguity.'
              : 'From the rank formula: the child is the nearest Pal in the generic pool to the midpoint of the parents’ ranks.'}
          </p>

          {alternatives.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer font-mono text-[0.68rem] text-iron-400 hover:text-iron-100">
                other pairs that make {name(result.child)}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {alternatives.map((pair) => (
                  <li
                    key={`${pair.parentA}|${pair.parentB}`}
                    className="flex flex-wrap items-center gap-2 font-mono text-[0.7rem] text-iron-300"
                  >
                    <button
                      type="button"
                      onClick={() => onChange({ pairA: pair.parentA, pairB: pair.parentB })}
                      className="text-left transition-colors hover:text-ember-400"
                    >
                      {name(pair.parentA)} + {name(pair.parentB)}
                    </button>
                    {pair.special ? (
                      <span className="font-mono text-[0.6rem] uppercase tracking-wider text-blueprint-400">
                        fixed
                      </span>
                    ) : null}
                    {pair.tieBroken ? <TieBroken /> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 font-mono text-[0.72rem] text-iron-400">
          Pick two parents to see what they produce.
        </p>
      )}

      {result?.tieBroken ? <TieBrokenNote share={tieBreakShare} /> : null}
    </Section>
  )
}

import { useMemo } from 'react'
import { reachableFrom, solve, type BreedIndex } from '@/lib/breeding'
import type { BreedingPal, PalId } from '@/types/breeding'
import { Section } from '@/components/Section'
import { PalSelect } from './PalSelect'
import { TieBroken, TieBrokenNote } from './TieBroken'

/**
 * "I own these Pals, I want that one — what is the shortest chain?"
 *
 * The question no other Palworld calculator answers, and the reason the engine
 * exists. Everything shown here comes from `solve`, which searches breadth-first
 * so the answer is the fewest breeding *generations* rather than the fewest
 * steps — those differ, and generations are what actually costs you time in game.
 *
 * The steps are runnable top to bottom. That is a guarantee from the engine, not
 * a presentation choice: a species is recorded at the earliest generation it can
 * be reached, so a step's parents are always produced before the step itself.
 */
export function BreedPlanPanel({
  index,
  pals,
  roster,
  target,
  onTargetChange,
  tieBreakShare,
}: {
  index: BreedIndex
  pals: readonly BreedingPal[]
  roster: readonly PalId[]
  target: PalId | null
  onTargetChange: (id: PalId | null) => void
  tieBreakShare: number
}) {
  // Recomputed only when the roster or the target moves. The search is a few
  // hundred thousand `breed` calls in the worst case — fine on demand, not
  // something to run per render.
  const plan = useMemo(
    () => (target ? solve(index, roster, target) : null),
    [index, roster, target],
  )

  const name = (id: PalId) => index.byId.get(id)?.name ?? id
  const owned = useMemo(() => new Set(roster), [roster])

  return (
    <Section
      id="breeding-plan"
      title="Shortest chain"
      aside={plan && !plan.alreadyOwned ? `${plan.steps.length} steps` : undefined}
    >
      <div className="max-w-sm">
        <PalSelect
          label="pal you want"
          value={target}
          pals={pals}
          onChange={onTargetChange}
          placeholder="choose a target…"
        />
      </div>

      {!target ? (
        <p className="mt-5 max-w-[64ch] font-mono text-[0.72rem] leading-relaxed text-iron-400">
          Pick a Pal you are chasing. The chain is worked out from your roster, so every step starts
          from something you already have or something an earlier step produced.
        </p>
      ) : roster.length === 0 ? (
        <p className="mt-5 max-w-[64ch] font-mono text-[0.72rem] leading-relaxed text-iron-400">
          Add at least one Pal to your roster above and the chain will appear here. With nothing to
          breed from there is no chain to work out.
        </p>
      ) : plan === null ? (
        <Unreachable target={name(target)} index={index} roster={roster} />
      ) : plan.alreadyOwned ? (
        <p className="mt-5 font-mono text-[0.72rem] text-iron-400">
          <span className="text-iron-100">{name(target)}</span> is already in your roster — nothing
          to breed.
        </p>
      ) : (
        <>
          <ol className="mt-5 space-y-2">
            {plan.steps.map((step, position) => (
              <li
                key={`${step.child}-${step.generation}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-iron-800 bg-iron-950/40 px-3 py-2 font-mono text-[0.72rem]"
              >
                <span aria-hidden className="tnum text-iron-400">
                  {position + 1}.
                </span>
                <Parent name={name(step.parentA)} owned={owned.has(step.parentA)} />
                <span aria-hidden className="text-iron-400">
                  +
                </span>
                <Parent name={name(step.parentB)} owned={owned.has(step.parentB)} />
                <span aria-hidden className="text-iron-400">
                  →
                </span>
                <span className="font-semibold text-iron-100">{name(step.child)}</span>
                {step.child === target ? (
                  <span className="rounded-sm border border-verdigris-400/30 px-1.5 py-px text-[0.6rem] uppercase tracking-wider text-verdigris-400">
                    target
                  </span>
                ) : null}
                {step.special ? (
                  <span className="rounded-sm border border-blueprint-500/30 px-1.5 py-px text-[0.6rem] uppercase tracking-wider text-blueprint-400">
                    fixed
                  </span>
                ) : null}
                {step.tieBroken ? <TieBroken /> : null}
                <span className="ml-auto text-[0.65rem] text-iron-400">gen {step.generation}</span>
              </li>
            ))}
          </ol>

          <p className="mt-3 max-w-[64ch] font-mono text-[0.68rem] leading-relaxed text-iron-400">
            {plan.steps.length === 1
              ? 'One cross, straight from Pals you already own.'
              : `Run them in order — every step's parents are produced before the step that needs them. ${plan.steps.length} crosses across ${maxGeneration(plan.steps)} generation${maxGeneration(plan.steps) === 1 ? '' : 's'}.`}
          </p>

          {plan.tieBrokenSteps > 0 ? (
            <>
              <p className="mt-3 max-w-[64ch] font-mono text-[0.7rem] leading-relaxed text-ember-400">
                {plan.tieBrokenSteps} of {plan.steps.length} step
                {plan.steps.length === 1 ? '' : 's'} depend
                {plan.tieBrokenSteps === 1 ? 's' : ''} on the contested tie-break rule. If a marked
                cross gives you something else, that is the rule disagreeing — not a mistake in your
                roster.
              </p>
              <TieBrokenNote share={tieBreakShare} />
            </>
          ) : null}
        </>
      )}
    </Section>
  )
}

/** A parent, marked when it is something you already have rather than a step's output. */
function Parent({ name, owned }: { name: string; owned: boolean }) {
  return (
    <span className={owned ? 'text-verdigris-400' : 'text-iron-300'}>
      {name}
      {owned ? <span className="sr-only"> (in your roster)</span> : null}
    </span>
  )
}

function maxGeneration(steps: readonly { generation: number }[]): number {
  return steps.reduce((highest, step) => Math.max(highest, step.generation), 0)
}

/**
 * The failure case, which has to explain itself.
 *
 * "No" on its own is useless here: with a roster of one Pal almost everything is
 * unreachable, and the actionable answer is "your roster reaches very little
 * yet", not "that Pal is impossible".
 *
 * The reach figure comes from `reachableFrom` rather than the plan, because
 * `solve` returns null on failure and its `reachableCount` goes with it. Running
 * a second search only in the failure case is the cheap way round that.
 */
function Unreachable({
  target,
  index,
  roster,
}: {
  target: string
  index: BreedIndex
  roster: readonly PalId[]
}) {
  const reach = useMemo(() => reachableFrom(index, roster).size, [index, roster])
  const total = index.byId.size

  return (
    <div className="mt-5 max-w-[64ch] space-y-2 font-mono text-[0.72rem] leading-relaxed text-iron-400">
      <p>
        <span className="text-iron-100">{target}</span> cannot be reached from your roster.
      </p>
      <p>
        Those {roster.length} Pal{roster.length === 1 ? '' : 's'} reach{' '}
        <span className="tnum text-iron-100">{reach}</span> of {total} species, counting everything
        breedable from them and from their descendants — so this is usually a roster that needs more
        in it rather than a target that is out of the question.
      </p>
      <p>
        Some Pals are also only produced by a fixed combination, which needs those exact parents
        rather than any pair of the right ranks. The pair calculator above will show which pairs
        make one.
      </p>
    </div>
  )
}

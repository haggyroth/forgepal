import { useEffect, useMemo, useState } from 'react'
import { breedingData } from '@/data/breeding'
import { buildBreedIndex } from '@/lib/breeding'
import { applyBreeding, decodeBreeding } from '@/lib/breedingQuery'
import { useRoster } from '@/hooks/useRoster'
import { Section } from '@/components/Section'
import { PairCalculator } from '@/components/breeding/PairCalculator'
import { Roster } from '@/components/breeding/Roster'
import { BreedPlanPanel } from '@/components/breeding/BreedPlanPanel'
import type { PalId } from '@/types/breeding'

/**
 * The breeding tab.
 *
 * Default-exported and loaded lazily, which is the whole reason the breeding
 * dataset is a separate JSON file: someone who only ever costs recipes should
 * never download 299 Pals. A static import anywhere in App would undo that.
 *
 * Three panels, in the order you use them: look a pair up, record what you own,
 * then ask for a chain. The dataset and uncertainty panels stay at the bottom —
 * they are the provenance, and provenance belongs after the tool, not in front of
 * it.
 */
export default function BreedingTab() {
  const index = useMemo(() => buildBreedIndex(breedingData), [])
  const { tieBreak, meta } = breedingData
  const share = (tieBreak.affectedPairs / tieBreak.totalPairs) * 100

  /** Sorted once, by name — every picker shows the same order. */
  const pals = useMemo(
    () => [...breedingData.pals].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )

  const isKnownId = useMemo(() => (id: PalId) => index.byId.has(id), [index])
  const { roster, add, remove, clear } = useRoster(isKnownId)

  // Resolved during the first render so a shared link is already answered rather
  // than appearing a frame later. Unknown ids are dropped by decodeBreeding.
  const [pair, setPair] = useState(() => {
    const restored = decodeBreeding(window.location.search, isKnownId)
    return { pairA: restored.pairA, pairB: restored.pairB }
  })
  const [target, setTarget] = useState<PalId | null>(
    () => decodeBreeding(window.location.search, isKnownId).target,
  )

  // Mirror this tab's own params and nothing else. The calculator's build list
  // and `?tab=` share the query string, and rebuilding it wholesale would erase
  // them — applyBreeding touches only `pair` and `target`.
  //
  // replaceState, like every other writer here: changing a picker should not fill
  // the history stack.
  useEffect(() => {
    const query = applyBreeding(window.location.search, { ...pair, target })
    window.history.replaceState(
      null,
      '',
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    )
  }, [pair, target])

  const owned = useMemo(() => new Set(roster), [roster])

  return (
    <div className="mt-5 space-y-6">
      <PairCalculator
        index={index}
        pals={pals}
        pairA={pair.pairA}
        pairB={pair.pairB}
        onChange={setPair}
        onAddToRoster={add}
        inRoster={owned}
        tieBreakShare={share}
      />

      <Roster
        index={index}
        pals={pals}
        roster={roster}
        onAdd={add}
        onRemove={remove}
        onClear={clear}
      />

      <BreedPlanPanel
        index={index}
        pals={pals}
        roster={roster}
        target={target}
        onTargetChange={setTarget}
        tieBreakShare={share}
      />

      <Section
        id="breeding-dataset"
        title="Breeding dataset"
        aside={`Palworld ${meta.gameVersion}`}
        defaultOpen={false}
      >
        <p className="max-w-prose font-mono text-[0.78rem] leading-relaxed text-iron-400">
          Two parents produce a child deterministically: a fixed combination if one exists, and
          otherwise the nearest Pal by hidden breeding rank. That makes the useful question
          computable rather than merely searchable — not &ldquo;A + B = ?&rdquo;, which every
          calculator answers, but &ldquo;I own these Pals, I want that one, what is the shortest
          chain?&rdquo;
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="pals" value={breedingData.pals.length} />
          <Stat label="in generic pool" value={index.pooled.length} />
          <Stat label="fixed combos" value={breedingData.specialCombos.length} />
          <Stat label="parent pairs" value={tieBreak.totalPairs} />
        </dl>
      </Section>

      {/*
        Open by default, unlike the stats panel above it. The tie-break decides
        roughly a third of generic pairs, and CLAUDE.md's rule is that this is not
        a footnote — collapsing it by default would be a quiet step towards
        presenting a coin-flip as settled. src/App.test.tsx asserts the share is
        visible without interaction, which is what caught this.
      */}
      <Section id="breeding-tiebreak" title="Where the data is uncertain">
        <p className="max-w-prose font-mono text-[0.78rem] leading-relaxed text-iron-400">
          When a target rank lands exactly between two Pals, one of them wins by a rule the sources
          disagree about. We follow the reading verified in game — the{' '}
          <span className="text-iron-100">higher</span> rank wins — but that single rule decides{' '}
          <span className="tnum text-ember-400">{share.toFixed(1)}%</span> of all parent pairs (
          <span className="tnum">{tieBreak.affectedPairs.toLocaleString()}</span> of{' '}
          <span className="tnum">{tieBreak.totalPairs.toLocaleString()}</span>), so results that
          depend on it are marked rather than presented as settled.
        </p>

        {meta.gaps.length > 0 ? (
          <ul className="mt-4 space-y-2 border-l border-iron-800 pl-4 font-mono text-[0.7rem] leading-relaxed text-iron-400">
            {meta.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-iron-400">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-bold tnum text-iron-100">
        {value.toLocaleString()}
      </dd>
    </div>
  )
}

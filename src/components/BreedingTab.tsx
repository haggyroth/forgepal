import { useMemo } from 'react'
import { breedingData } from '@/data/breeding'
import { buildBreedIndex } from '@/lib/breeding'
import { Section } from '@/components/Section'

/**
 * The breeding tab.
 *
 * Default-exported and loaded lazily, which is the whole reason the breeding
 * dataset is a separate JSON file: someone who only ever costs recipes should
 * never download 299 Pals. A static import anywhere in App would undo that on
 * the first render.
 *
 * Phase 3 ships the shell and the dataset it stands on. The pair calculator and
 * the path solver are Phase 4 — the engine behind them is already in
 * `src/lib/breeding.ts` and tested.
 */
export default function BreedingTab() {
  const index = useMemo(() => buildBreedIndex(breedingData), [])
  const { tieBreak, meta } = breedingData
  const share = (tieBreak.affectedPairs / tieBreak.totalPairs) * 100

  return (
    <div className="mt-5 space-y-6">
      <Section
        id="breeding-dataset"
        title="Breeding dataset"
        aside={`Palworld ${meta.gameVersion}`}
        glow
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

      <Section id="breeding-tiebreak" title="Where the data is uncertain">
        <p className="max-w-prose font-mono text-[0.78rem] leading-relaxed text-iron-400">
          When a target rank lands exactly between two Pals, one of them wins by a rule the sources
          disagree about. We follow the reading verified in game — the{' '}
          <span className="text-iron-100">higher</span> rank wins — but that single rule decides{' '}
          <span className="tnum text-ember-400">{share.toFixed(1)}%</span> of all parent pairs (
          <span className="tnum">{tieBreak.affectedPairs.toLocaleString()}</span> of{' '}
          <span className="tnum">{tieBreak.totalPairs.toLocaleString()}</span>), so results that
          depend on it will be marked rather than presented as settled.
        </p>

        {meta.gaps.length > 0 ? (
          <ul className="mt-4 space-y-2 border-l border-iron-800 pl-4 font-mono text-[0.7rem] leading-relaxed text-iron-600">
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
      <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-iron-600">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-bold tnum text-iron-100">
        {value.toLocaleString()}
      </dd>
    </div>
  )
}

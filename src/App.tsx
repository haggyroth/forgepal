import { useMemo, useState } from 'react'
import { gameData } from '@/data'
import { buildIndex, calculate } from '@/lib/calculator'
import { useBuildList } from '@/hooks/useBuildList'
import type { Entry } from '@/lib/search'
import { hasAnythingToExport } from '@/lib/export'
import { analyseTech, MAX_TECH_LEVEL, parsePlayerLevel } from '@/lib/tech'
import { BuildList } from '@/components/BuildList'
import { ExportBar } from '@/components/ExportBar'
import { ItemBrowser } from '@/components/ItemBrowser'
import { Requirements } from '@/components/Requirements'
import { RecipeTree } from '@/components/RecipeTree'
import { Totals } from '@/components/Totals'
import { Panel } from '@/components/ui'

export default function App() {
  const index = useMemo(() => buildIndex(gameData), [])
  const entries = useMemo<Entry[]>(() => [...gameData.items, ...gameData.structures], [])
  const stations = useMemo(
    () => [...gameData.stations].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )

  const [playerLevel, setPlayerLevel] = useState<number | null>(null)
  const { quantities, entries: buildEntries, add, setQuantity, remove, clear } = useBuildList()
  const result = useMemo(() => calculate(buildEntries, index), [buildEntries, index])
  const tech = useMemo(() => analyseTech(result, index, playerLevel), [result, index, playerLevel])
  const targetTotals = useMemo(
    () => new Map(result.targets.map((total) => [total.itemId, total])),
    [result],
  )

  return (
    <div className="relative z-10 min-h-screen">
      <div className="mx-auto max-w-[86rem] px-5 py-8 lg:px-8">
        <Header playerLevel={playerLevel} onPlayerLevelChange={setPlayerLevel} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
          {/*
            Fixed height plus min-h-0 down the chain is what actually lets the
            results list scroll instead of running off the page — a flex child
            defaults to min-height:auto and refuses to shrink below its content.
          */}
          <Panel className="flex max-h-[32rem] flex-col lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:max-h-none">
            <ItemBrowser
              entries={entries}
              stations={stations}
              playerLevel={playerLevel}
              onAdd={add}
              inList={new Set(quantities.keys())}
            />
          </Panel>

          <div className="min-w-0 space-y-6">
            <Panel>
              <BuildList
                quantities={quantities}
                index={index}
                totals={targetTotals}
                onSetQuantity={setQuantity}
                onRemove={remove}
                onClear={clear}
              />
            </Panel>

            <Totals
              result={result}
              index={index}
              exportBar={
                <ExportBar
                  result={result}
                  index={index}
                  meta={gameData.meta}
                  disabled={!hasAnythingToExport(quantities)}
                />
              }
            />
            <Requirements tech={tech} />
            <RecipeTree quantities={quantities} index={index} />
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}

function Header({
  playerLevel,
  onPlayerLevelChange,
}: {
  playerLevel: number | null
  onPlayerLevelChange: (level: number | null) => void
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-iron-800 pb-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-iron-100">
          Forge<span className="text-ember-500">Pal</span>
        </h1>
        <p className="mt-1 font-mono text-[0.78rem] text-iron-400">
          Queue a build. Get everything you actually need to gather.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 font-mono text-[0.7rem] text-iron-400">
          tech level
          <input
            type="number"
            min={1}
            max={MAX_TECH_LEVEL}
            value={playerLevel ?? ''}
            placeholder="any"
            onChange={(event) => onPlayerLevelChange(parsePlayerLevel(event.target.value))}
            className="w-16 rounded-sm border border-iron-700 bg-iron-950/60 px-2 py-1 text-center font-mono text-sm tnum text-iron-100 placeholder:text-iron-700 focus:border-ember-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
        <a
          href="https://github.com/haggyroth/forgepal"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[0.7rem] text-iron-600 transition-colors hover:text-ember-400"
        >
          github ↗
        </a>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-iron-800 pt-5 font-mono text-[0.68rem] leading-relaxed text-iron-600">
      <p>
        Palworld {gameData.meta.gameVersion} data, updated {gameData.meta.updated}. Unofficial fan
        project — not affiliated with Pocketpair.
      </p>
    </footer>
  )
}

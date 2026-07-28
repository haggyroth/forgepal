import { useMemo } from 'react'
import { gameData } from '@/data'
import { buildIndex, calculate } from '@/lib/calculator'
import { useBuildList } from '@/hooks/useBuildList'
import type { Entry } from '@/lib/search'
import { BuildList } from '@/components/BuildList'
import { ItemBrowser } from '@/components/ItemBrowser'
import { RecipeTree } from '@/components/RecipeTree'
import { Totals } from '@/components/Totals'
import { Panel } from '@/components/ui'

export default function App() {
  const index = useMemo(() => buildIndex(gameData), [])
  const entries = useMemo<Entry[]>(() => [...gameData.items, ...gameData.structures], [])

  const { quantities, entries: buildEntries, add, setQuantity, remove, clear } = useBuildList()
  const result = useMemo(() => calculate(buildEntries, index), [buildEntries, index])
  const targetTotals = useMemo(
    () => new Map(result.targets.map((total) => [total.itemId, total])),
    [result],
  )

  return (
    <div className="relative z-10 min-h-screen">
      <div className="mx-auto max-w-[86rem] px-5 py-8 lg:px-8">
        <Header />

        <div className="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
          {/*
            Fixed height plus min-h-0 down the chain is what actually lets the
            results list scroll instead of running off the page — a flex child
            defaults to min-height:auto and refuses to shrink below its content.
          */}
          <Panel className="flex max-h-[32rem] flex-col lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:max-h-none">
            <ItemBrowser entries={entries} onAdd={add} inList={new Set(quantities.keys())} />
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

            <Totals result={result} index={index} />
            <RecipeTree quantities={quantities} index={index} />
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}

function Header() {
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
      <a
        href="https://github.com/haggyroth/forgepal"
        target="_blank"
        rel="noreferrer"
        className="font-mono text-[0.7rem] text-iron-600 transition-colors hover:text-ember-400"
      >
        github ↗
      </a>
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

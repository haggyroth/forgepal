import { useMemo } from 'react'
import { gameData } from '@/data'
import { buildIndex, calculate } from '@/lib/calculator'
import { toId } from '@/lib/id'

/**
 * Scaffold shell.
 *
 * This exists to prove the data pipeline and engine work end to end. The real
 * build-list UI is the next piece of work — see ROADMAP.md.
 */
export default function App() {
  const index = useMemo(() => buildIndex(gameData), [])

  const demo = useMemo(
    () => calculate([{ itemId: toId('Mega Sphere'), quantity: 20 }], index),
    [index],
  )

  const craftable = gameData.items.filter((i) => i.recipe).length

  return (
    <div className="min-h-screen bg-forge-50 text-forge-950 dark:bg-forge-950 dark:text-forge-50">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">
            Forge<span className="text-ember-600 dark:text-ember-400">Pal</span>
          </h1>
          <p className="mt-2 text-forge-600 dark:text-forge-200">
            Palworld crafting calculator — what you actually need to gather.
          </p>
        </header>

        <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Items" value={gameData.items.length} />
          <Stat label="Craftable" value={craftable} />
          <Stat label="Structures" value={gameData.structures.length} />
          <Stat label="Stations" value={gameData.stations.length} />
        </section>

        <section className="rounded-lg border border-forge-200 bg-white p-6 dark:border-forge-800 dark:bg-forge-900/40">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-forge-600 dark:text-forge-200">
            Engine check — 20&times; Mega Sphere
          </h2>

          <ul className="mt-4 space-y-1 font-mono text-sm">
            {demo.intermediates.map((entry) => (
              <li key={entry.itemId} className="flex justify-between">
                <span className="text-forge-600 dark:text-forge-200">
                  {entry.name}
                  <span className="ml-2 text-xs opacity-60">craft at {entry.stationName}</span>
                </span>
                <span className="tabular-nums">{entry.required}</span>
              </li>
            ))}
            {demo.raw.map((entry) => (
              <li key={entry.itemId} className="flex justify-between">
                <span>
                  {entry.name}
                  <span className="ml-2 text-xs opacity-60">{entry.sourceKind}</span>
                </span>
                <span className="tabular-nums font-semibold">{entry.required}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-10 text-xs text-forge-600 dark:text-forge-200">
          Data: Palworld {gameData.meta.gameVersion}, updated {gameData.meta.updated}. Unofficial
          fan project, not affiliated with Pocketpair.
        </footer>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-forge-200 bg-white p-4 dark:border-forge-800 dark:bg-forge-900/40">
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs uppercase tracking-wide text-forge-600 dark:text-forge-200">
        {label}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { gameData } from '@/data'
import { buildIndex, calculate, type GameIndex } from '@/lib/calculator'
import {
  buildShareUrl,
  decodeState,
  encodeState,
  isEmptyState,
  type SharedState,
} from '@/lib/shareState'
import { loadPersisted, savePersisted } from '@/lib/storage'
import { useBuildList } from '@/hooks/useBuildList'
import type { Entry } from '@/lib/search'
import { hasAnythingToExport } from '@/lib/export'
import { analyseTech, MAX_TECH_LEVEL, parsePlayerLevel } from '@/lib/tech'
import { buildHabitatIndex, buildRoute } from '@/lib/route'
import { FarmingRoute } from '@/components/FarmingRoute'
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

  // Resolved once, during the first render, so a saved or shared build is
  // already on screen rather than appearing a frame later.
  const [restored] = useState(() => resolveInitialState(index))

  const [playerLevel, setPlayerLevel] = useState<number | null>(restored.state.playerLevel)
  const { quantities, entries: buildEntries, add, setQuantity, remove, clear } = useBuildList(
    restored.state.build,
  )
  const [shared, setShared] = useState(false)

  const result = useMemo(() => calculate(buildEntries, index), [buildEntries, index])
  const tech = useMemo(() => analyseTech(result, index, playerLevel), [result, index, playerLevel])

  const habitats = useMemo(() => buildHabitatIndex(gameData), [])
  const sourcing = useMemo(
    () => ({
      habitats,
      merchantListings: gameData.merchantListings,
      expeditionRewards: gameData.expeditionRewards,
    }),
    [habitats],
  )
  const route = useMemo(() => buildRoute(result, index, habitats), [result, index, habitats])

  // Keep localStorage and the address bar in step with the current build.
  // replaceState rather than pushState: every quantity tweak would otherwise
  // add a history entry and make the back button useless.
  useEffect(() => {
    const state: SharedState = { build: buildEntries, playerLevel }
    savePersisted(state)
    const query = encodeState(state)
    window.history.replaceState(
      null,
      '',
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    )
  }, [buildEntries, playerLevel])

  const copyShareLink = async () => {
    const url = buildShareUrl(
      { build: buildEntries, playerLevel },
      window.location.origin,
      window.location.pathname,
    )
    try {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch {
      // Clipboard permission can be refused; the address bar already holds the
      // same URL, so there is nothing lost — just don't claim success.
      setShared(false)
    }
  }
  const targetTotals = useMemo(
    () => new Map(result.targets.map((total) => [total.itemId, total])),
    [result],
  )

  return (
    <div className="relative z-10 min-h-screen">
      <div className="mx-auto max-w-[86rem] px-5 py-8 lg:px-8">
        <Header playerLevel={playerLevel} onPlayerLevelChange={setPlayerLevel} />

        {/* A link shared before a data update can name items that no longer
            exist. Say so rather than quietly handing over a short list. */}
        {restored.unknownIds.length > 0 ? (
          <p
            role="status"
            className="mt-4 rounded-sm border border-ember-700/40 bg-ember-700/10 px-3 py-2 font-mono text-[0.7rem] text-ember-400"
          >
            {restored.unknownIds.length === 1
              ? '1 item from that link is no longer in the dataset and was skipped: '
              : `${restored.unknownIds.length} items from that link are no longer in the dataset and were skipped: `}
            {restored.unknownIds.join(', ')}
          </p>
        ) : null}

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
                onShare={copyShareLink}
                shared={shared}
              />
            </Panel>

            <Totals
              result={result}
              index={index}
              sourcing={sourcing}
              exportBar={
                <ExportBar
                  result={result}
                  index={index}
                  meta={gameData.meta}
                  disabled={!hasAnythingToExport(quantities)}
                />
              }
            />
            <FarmingRoute route={route} />
            <Requirements tech={tech} />
            <RecipeTree quantities={quantities} index={index} />
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}

/**
 * Where the initial build comes from.
 *
 * A URL wins over saved state: following someone's link should show their
 * build, not silently resurrect your own over the top of it.
 */
function resolveInitialState(index: GameIndex): { state: SharedState; unknownIds: string[] } {
  const isKnownId = (id: string) => index.byId.has(id)
  const fromUrl = decodeState(window.location.search, isKnownId)
  if (!isEmptyState(fromUrl.state)) return fromUrl

  // A link whose ids have *all* been dropped decodes to an empty state, so it
  // falls through to saved state here. Carry unknownIds across the fallback
  // anyway — otherwise the one case that most needs an explanation, a link
  // where nothing survived, is the one case that silently gives none.
  return { state: loadPersisted(isKnownId), unknownIds: fromUrl.unknownIds }
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

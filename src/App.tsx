import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { datasetStamp } from '@/data/meta'
import { Tabs } from '@/components/Tabs'
import { applyTab, decodeTab, type TabId } from '@/lib/tabs'

// Both tabs are lazy, and the shell imports neither dataset.
//
// Breeding was split first, on the reasoning that someone who only ever costs
// recipes should never download 299 Pals. That dataset is 6.8 kB gzipped; the
// item catalogue this shell used to import eagerly is 93 kB. The rule was being
// applied to the cheap half and not the expensive one, so a visitor landing on
// ?tab=breeding parsed 1.88 MB of items before first paint — to render the game
// version in the footer, which now comes from meta.json instead.
const CalculatorTab = lazy(() => import('@/components/CalculatorTab'))
const BreedingTab = lazy(() => import('@/components/BreedingTab'))

export default function App() {
  const [tab, setTab] = useState<TabId>(() => decodeTab(window.location.search))

  // A tab that has been opened stays mounted, so switching back is instant and
  // nothing in it is lost. Only the first visit pays for the chunk.
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set([tab]))
  const open = (next: TabId) => {
    setTab(next)
    setVisited((current) => (current.has(next) ? current : new Set(current).add(next)))
  }

  // Mirror the tab into the URL, preserving the build params CalculatorTab
  // owns. replaceState, like the build sync: flipping tabs should not fill the
  // history stack.
  useEffect(() => {
    const query = applyTab(window.location.search, tab)
    window.history.replaceState(
      null,
      '',
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    )
  }, [tab])

  return (
    <div className="relative z-10 min-h-screen">
      <div className="mx-auto max-w-[86rem] px-5 py-8 lg:px-8">
        <Header />
        <Tabs active={tab} onSelect={open} />

        {/*
          Inactive tabs are hidden, not unmounted — the opposite of the rule
          Section follows, and deliberately so. A collapsed panel is something
          you put away; a tab is something you flip back to. Unmounting would
          rebuild the 1,300-entry item index on every switch and drop a shared
          build that hadn't been edited into persistence yet.
        */}
        <TabPanel id="calculator" active={tab === 'calculator'}>
          {visited.has('calculator') ? (
            <Suspense fallback={<Loading what="recipe data" />}>
              <CalculatorTab />
            </Suspense>
          ) : null}
        </TabPanel>

        <TabPanel id="breeding" active={tab === 'breeding'}>
          {visited.has('breeding') ? (
            <Suspense fallback={<Loading what="breeding data" />}>
              <BreedingTab />
            </Suspense>
          ) : null}
        </TabPanel>

        <Footer />
      </div>
    </div>
  )
}

function TabPanel({ id, active, children }: { id: TabId; active: boolean; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!active}
      className={active ? '' : 'hidden'}
    >
      {children}
    </div>
  )
}

function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="mt-8 font-mono text-[0.72rem] text-iron-600">
      Loading {what}…
    </p>
  )
}

function Header() {
  return (
    <header className="border-b border-iron-800 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
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
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-iron-800 pt-5 font-mono text-[0.68rem] leading-relaxed text-iron-600">
      <p>
        Palworld {datasetStamp.gameVersion} data, updated {datasetStamp.updated}. Unofficial fan
        project — not affiliated with Pocketpair.
      </p>
    </footer>
  )
}

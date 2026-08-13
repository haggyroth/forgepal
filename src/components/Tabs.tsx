import { useRef } from 'react'
import { TABS, type TabId } from '@/lib/tabs'

/**
 * The top-level tool switcher.
 *
 * Full ARIA tabs rather than a row of buttons: only the active tab is in the
 * focus order, and the arrow keys move between them. That is what screen
 * readers and keyboard users expect from something announced as a tablist, and
 * announcing it as one without the behaviour is worse than not announcing it.
 */
export function Tabs({ active, onSelect }: { active: TabId; onSelect: (tab: TabId) => void }) {
  const refs = useRef(new Map<TabId, HTMLButtonElement>())

  const focus = (tab: TabId) => {
    onSelect(tab)
    refs.current.get(tab)?.focus()
  }

  const move = (delta: number) => {
    const current = TABS.findIndex((tab) => tab.id === active)
    // Wrap, so the arrow keys never dead-end on the first or last tab.
    focus(TABS[(current + delta + TABS.length) % TABS.length].id)
  }

  return (
    <div
      role="tablist"
      aria-label="ForgePal tools"
      className="mt-6 flex items-center gap-1 border-b border-iron-800"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) refs.current.set(tab.id, node)
              else refs.current.delete(tab.id)
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => {
              // Home/End as well as the arrows: the ARIA tabs pattern lists them
              // for a tablist, and with two tabs they are the difference between
              // "jump to the first tool" and counting arrow presses.
              if (event.key === 'ArrowRight') move(1)
              else if (event.key === 'ArrowLeft') move(-1)
              else if (event.key === 'Home') focus(TABS[0].id)
              else if (event.key === 'End') focus(TABS[TABS.length - 1].id)
              else return
              event.preventDefault()
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition-colors ${
              selected
                ? 'border-ember-500 text-iron-100'
                : // iron-400, not the iron-500 this used to name: that shade is not
                  // in the palette, so the class was invalid and the inactive label
                  // silently inherited its colour instead.
                  'border-transparent text-iron-400 hover:text-iron-300'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

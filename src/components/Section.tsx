import { useId, type ReactNode } from 'react'
import { useCollapsedSection } from '@/hooks/useCollapsedSection'
import { Panel } from './ui'

/**
 * The heading row of a collapsible panel: disclosure triangle, title, rule, and
 * a summary that stays visible while collapsed.
 *
 * Exported separately from `Section` because the catalogue needs its own layout
 * — sticky, fixed height, internally scrolling — and bending `Section` to allow
 * that would complicate it for every other caller. Sharing the heading keeps the
 * visuals and the ARIA wiring in one place regardless.
 */
export function SectionToggle({
  title,
  aside,
  open,
  onToggle,
  contentId,
  className = '',
}: {
  title: string
  aside?: ReactNode
  open: boolean
  onToggle: () => void
  contentId: string
  className?: string
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="group flex items-center gap-1.5 text-left"
      >
        <span
          aria-hidden
          className={`font-mono text-[0.6rem] text-iron-600 transition-transform group-hover:text-ember-400 ${
            open ? 'rotate-90' : ''
          }`}
        >
          ▶
        </span>
        <h2 className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-iron-400 transition-colors group-hover:text-iron-300">
          {title}
        </h2>
      </button>
      <div className="rule-fade h-px flex-1" />
      {aside ? <span className="font-mono text-[0.7rem] text-iron-600">{aside}</span> : null}
    </div>
  )
}

/**
 * A collapsible panel.
 *
 * Replaces the previous Panel + SectionHeading pairing, which every component
 * assembled slightly differently. One component now owns the heading, the
 * toggle, the persistence, and the ARIA wiring, so they can't drift apart.
 */
export function Section({
  id,
  title,
  aside,
  children,
  glow = false,
  defaultOpen = true,
  className = '',
}: {
  /** Stable key for the collapse preference. Changing it forgets the setting. */
  id: string
  title: string
  /** Summary shown beside the title — stays visible while collapsed on purpose. */
  aside?: ReactNode
  children: ReactNode
  glow?: boolean
  defaultOpen?: boolean
  className?: string
}) {
  const [open, toggle] = useCollapsedSection(id, defaultOpen)
  const contentId = `${useId()}-content`

  return (
    <Panel glow={glow} className={className}>
      <SectionToggle
        title={title}
        aside={aside}
        open={open}
        onToggle={toggle}
        contentId={contentId}
        className={open ? 'mb-4' : ''}
      />
      {/*
        Unmounted rather than hidden when collapsed. The Breakdown tree and the
        1,300-entry catalogue are the expensive things on this page, and keeping
        them mounted behind `display: none` would keep paying for them.
      */}
      <div id={contentId}>{open ? children : null}</div>
    </Panel>
  )
}


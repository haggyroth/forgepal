import type { ReactNode } from 'react'
import type { SourceKind } from '@/types/game'

/**
 * Etched section heading: small caps, wide tracking, closed off by a rule that
 * fades to nothing. Borrowed from technical drawings — it separates zones
 * without spending a border on every panel.
 */
export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-iron-400">
        {children}
      </h2>
      <div className="rule-fade h-px flex-1" />
      {aside ? <span className="font-mono text-[0.7rem] text-iron-600">{aside}</span> : null}
    </div>
  )
}

const SOURCE_STYLES: Record<SourceKind, { label: string; className: string }> = {
  craftable: { label: 'craft', className: 'text-blueprint-400 border-blueprint-500/30' },
  gathered: { label: 'gather', className: 'text-verdigris-400 border-verdigris-400/30' },
  drop: { label: 'drop', className: 'text-ember-400 border-ember-500/30' },
  unobtainable: { label: 'unknown', className: 'text-iron-600 border-iron-700' },
}

export function SourceBadge({ kind }: { kind: SourceKind }) {
  const style = SOURCE_STYLES[kind]
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-wider ${style.className}`}
    >
      {style.label}
    </span>
  )
}

/** Numeric input with decrement/increment, sized for repeated clicking. */
export function Stepper({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (next: number) => void
  label: string
}) {
  return (
    <div className="flex items-center rounded-sm border border-iron-700 bg-iron-950/60">
      <StepButton onClick={() => onChange(value - 1)} label={`Decrease ${label}`}>
        &minus;
      </StepButton>
      <input
        type="number"
        min={0}
        value={value}
        aria-label={`${label} quantity`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-14 border-x border-iron-700 bg-transparent px-1 py-1 text-center font-mono text-sm tnum text-iron-100 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <StepButton onClick={() => onChange(value + 1)} label={`Increase ${label}`}>
        +
      </StepButton>
    </div>
  )
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="px-2 py-1 font-mono text-sm text-iron-400 transition-colors hover:bg-iron-800 hover:text-ember-400"
    >
      {children}
    </button>
  )
}

/** Panel shell. `glow` lifts the requisition above the surrounding surfaces. */
export function Panel({
  children,
  glow = false,
  className = '',
}: {
  children: ReactNode
  glow?: boolean
  className?: string
}) {
  return (
    <section
      className={`relative rounded-md border border-iron-800 bg-iron-900/70 p-5 backdrop-blur-sm ${
        glow ? 'shadow-[0_0_0_1px_var(--color-ember-700)/20,0_8px_40px_-12px_oklch(0.68_0.19_52/0.28)]' : ''
      } ${className}`}
    >
      {children}
    </section>
  )
}

/**
 * The marker for a result that hinged on the contested tie-break rule.
 *
 * Its own component because it has to appear in all three panels and mean the
 * same thing in each. The engine threads `tieBroken` through every result and
 * `tieBrokenSteps` through every plan specifically so this can be rendered;
 * dropping it would present a coin-flip as a fact on roughly a third of generic
 * pairs.
 *
 * Ember rather than iron on purpose. Ember is reserved for the requisition and
 * interactive accents, but this is the one thing on the page a reader must not
 * skim past — an unmarked uncertain answer is indistinguishable from a certain
 * one, which is the failure this whole flag exists to prevent.
 */
export function TieBroken({ className = '' }: { className?: string }) {
  return (
    <span
      // The visible text is a symbol, so the meaning lives in the label.
      title="This result depended on the contested tie-break rule"
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm border border-ember-700/40 px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-wider text-ember-400 ${className}`}
    >
      <span aria-hidden>±</span>
      contested
    </span>
  )
}

/**
 * The standing explanation of what `contested` means.
 *
 * Shown once per panel that can produce one, rather than repeated per row: the
 * badge is the signal, this is the footnote.
 */
export function TieBrokenNote({ share }: { share: number }) {
  return (
    <p className="mt-3 max-w-[64ch] font-mono text-[0.68rem] leading-relaxed text-iron-400">
      <TieBroken className="mr-1 align-middle" /> marks a result that landed exactly between two
      Pals, where the winner is decided by a rule the sources disagree about. We follow the reading
      verified in game — the higher rank wins — but it decides{' '}
      <span className="tnum text-ember-400">{share.toFixed(1)}%</span> of generic pairs, so treat a
      marked step as worth testing before you rely on it.
    </p>
  )
}

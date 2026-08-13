import { Component, type ErrorInfo, type ReactNode } from 'react'
import { resetPersistedState } from '@/lib/resetState'

/**
 * Keeps a render throw from taking the page down with it.
 *
 * The engine already refuses to hang on bad data — `calculate` returns its
 * `cycles` rather than looping — but nothing enforced that at the render layer,
 * so a throw anywhere in the tree left a blank page. For an app whose defining
 * risk is an adversarial upstream dataset, having the engine defended and the UI
 * undefended was the wrong way round.
 *
 * One boundary per tab panel rather than one around the app: a throw in the
 * calculator should not cost you the breeding tools, and the shell — header,
 * tabs, footer — must stay usable so there is somewhere to go from here.
 *
 * A class because that is still the only way to catch a render error in React;
 * there is no hook equivalent, and a dependency for one component is not worth
 * the runtime-network-free guarantee this project keeps.
 */
interface Props {
  /** What broke, named the way the user thinks of it: "the calculator". */
  what: string
  children: ReactNode
}

interface State {
  error: Error | null
  /** Set once the user asks for a reset, so the button can't be pressed twice. */
  resetting: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetting: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry to send it to — the app makes no runtime network calls — but
    // the console is where someone reporting this will be asked to look.
    console.error(`ForgePal: ${this.props.what} failed to render`, error, info.componentStack)
  }

  private reset = () => {
    this.setState({ resetting: true })
    resetPersistedState()
    // A full reload rather than clearing the error state: whatever threw did so
    // during render from persisted input, and re-rendering the same tree with the
    // same input in memory would just throw again.
    window.location.reload()
  }

  render() {
    const { error, resetting } = this.state
    if (!error) return this.props.children

    return (
      <section
        role="alert"
        className="mt-8 rounded-md border border-ember-700/40 bg-iron-900/70 p-5 backdrop-blur-sm"
      >
        <h2 className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ember-400">
          {this.props.what} stopped working
        </h2>

        {/* Constrained measure: the panel is as wide as the app, and prose set
            across 1,400px is not readable. Matches how the breeding tab wraps. */}
        <p className="mt-3 max-w-[64ch] font-mono text-[0.78rem] leading-relaxed text-iron-300">
          Something in {this.props.what} threw while rendering. The rest of the page still works —
          the other tab is unaffected.
        </p>

        <p className="mt-2 max-w-[64ch] font-mono text-[0.72rem] leading-relaxed text-iron-400">
          This is most often a saved build that has become unreadable. Reloading is worth trying
          first; clearing saved data will fix it but discards your build lists, inventory, and panel
          layout.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-sm border border-iron-700 px-3 py-1.5 font-mono text-[0.72rem] text-iron-100 transition-colors hover:border-ember-500 hover:text-ember-400"
          >
            reload
          </button>
          <button
            type="button"
            onClick={this.reset}
            disabled={resetting}
            className="rounded-sm border border-iron-800 px-3 py-1.5 font-mono text-[0.72rem] text-iron-400 transition-colors hover:border-iron-600 hover:text-iron-300 disabled:opacity-50"
          >
            {resetting ? 'clearing…' : 'clear saved data and reload'}
          </button>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer font-mono text-[0.68rem] text-iron-600 hover:text-iron-400">
            error detail
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-sm bg-iron-950/80 p-3 font-mono text-[0.68rem] leading-relaxed text-iron-400">
            {error.message}
          </pre>
        </details>
      </section>
    )
  }
}

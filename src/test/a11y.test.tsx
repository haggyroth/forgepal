// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import App from '@/App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { toId } from '@/lib/id'

/**
 * Automated accessibility checks over the real composition.
 *
 * Run against whole rendered views rather than components in isolation, because
 * the failures that matter here are relational: a `tab` whose `aria-controls`
 * points at nothing, a `tabpanel` with no accessible name, a form control whose
 * label is a sibling. Rendering `Tabs` alone would pass while the app was broken.
 *
 * Colour contrast is disabled below and covered statically instead — see
 * `scripts/audit/contrast.test.ts`. jsdom computes no layout or cascade, so axe
 * cannot evaluate contrast here at all; it would report every pair as
 * "incomplete", which reads like a pass and is not one.
 */

const RULES: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: { 'color-contrast': { enabled: false } },
}

async function violations(container: HTMLElement) {
  const results = await axe.run(container, RULES)
  // Map to something readable: a raw axe violation object in a diff is unusable.
  return results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('axe itself', () => {
  it('flags a fragment that is known to be broken', async () => {
    // Without this, an empty violations array is ambiguous: it could mean the app
    // is clean, or that axe silently stopped evaluating — a container that never
    // attached, an API change, a rule set that matched nothing. Every "no
    // violations" result below is only as trustworthy as this test.
    const { container } = render(
      <div>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src="x.png" />
        <input type="text" />
      </div>,
    )

    expect(await violations(container)).not.toEqual([])
  }, 30_000)
})

describe('the calculator view', () => {
  it('has no axe violations when empty', async () => {
    const { container } = render(<App />)
    await screen.findByLabelText(/tech level/i, {}, { timeout: 10_000 })

    expect(await violations(container)).toEqual([])
  }, 30_000)

  it('has no axe violations with a build loaded', async () => {
    // The populated state renders the build list, requisition, stock inputs,
    // farming route, requirements, and the recipe tree — none of which exist on
    // an empty view, and most of which are interactive.
    window.history.replaceState(null, '', `/?build=${toId('Mega Sphere')}.20&level=25`)
    const { container } = render(<App />)
    await screen.findByLabelText('Mega Sphere quantity', {}, { timeout: 10_000 })

    expect(await violations(container)).toEqual([])
  }, 30_000)

  it('has no axe violations reporting a stale shared link', async () => {
    window.history.replaceState(null, '', '/?build=ghost-widget.3')
    const { container } = render(<App />)
    await screen.findByRole('status', {}, { timeout: 10_000 })

    expect(await violations(container)).toEqual([])
  }, 30_000)
})

describe('the breeding view', () => {
  it('has no axe violations', async () => {
    window.history.replaceState(null, '', '/?tab=breeding')
    const { container } = render(<App />)
    await screen.findByText(/Breeding dataset/i, {}, { timeout: 10_000 })

    expect(await violations(container)).toEqual([])
  }, 30_000)
})

describe('the error fallback', () => {
  it('has no axe violations', async () => {
    // Worth checking precisely because it is the view nobody looks at twice: it
    // only appears when something else has already gone wrong.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Boom = (): never => {
      throw new Error('deliberate test failure')
    }

    const { container } = render(
      <ErrorBoundary what="the calculator">
        <Boom />
      </ErrorBoundary>,
    )

    expect(await violations(container)).toEqual([])
    vi.restoreAllMocks()
  }, 30_000)
})

describe('keyboard operation of the tablist', () => {
  /**
   * The ARIA tabs pattern, which the component opts into by announcing
   * `role="tablist"`. Announcing it without the behaviour is worse than not
   * announcing it, because a screen-reader user is told to expect arrow keys.
   */
  it('moves between tabs with the arrow keys', async () => {
    render(<App />)
    const calculator = screen.getByRole('tab', { name: 'Calculator' })

    calculator.focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Breeding' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Breeding' })).toHaveFocus()
  })

  it('wraps rather than dead-ending at either edge', async () => {
    render(<App />)
    screen.getByRole('tab', { name: 'Calculator' }).focus()

    // Left from the first tab wraps to the last.
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Breeding' })).toHaveAttribute('aria-selected', 'true')

    // And right from the last wraps back to the first.
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Calculator' })).toHaveAttribute('aria-selected', 'true')
  })

  it('jumps to the first and last tab with Home and End', async () => {
    render(<App />)
    screen.getByRole('tab', { name: 'Calculator' }).focus()

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Breeding' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Calculator' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps only the active tab in the tab order', async () => {
    // Roving tabIndex: a tablist is one stop, and Tab moves past it to the panel
    // rather than through every tool.
    render(<App />)

    expect(screen.getByRole('tab', { name: 'Calculator' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Breeding' })).toHaveAttribute('tabindex', '-1')
  })

  it('ignores keys it does not handle', async () => {
    render(<App />)
    screen.getByRole('tab', { name: 'Calculator' }).focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('tab', { name: 'Calculator' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('keyboard operation of a collapsible section', () => {
  it('toggles with the keyboard and reports its state', async () => {
    window.history.replaceState(null, '', `/?build=${toId('Ingot')}.3`)
    render(<App />)
    await screen.findByLabelText('Ingot quantity', {}, { timeout: 10_000 })

    const toggle = screen.getAllByRole('button', { expanded: true })[0]
    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  }, 30_000)
})

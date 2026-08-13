// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'
import App from '../App'

/**
 * The calculator is mocked to throw for the integration block at the bottom.
 * Nothing else in this file renders App, so the mock is inert for the isolated
 * tests above it.
 */
vi.mock('@/components/CalculatorTab', () => ({
  default: () => {
    throw new Error('deliberate test failure')
  },
}))

function Boom({ message = 'deliberate test failure' }: { message?: string }): never {
  throw new Error(message)
}

const reload = vi.fn()

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  reload.mockClear()

  // jsdom has no navigation, so reload() throws "Not implemented" unless stubbed.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload, search: window.location.search, pathname: '/' },
  })

  // React logs every caught error. Silenced so a passing run stays readable —
  // asserted on below, since that log is the only report this app can make.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary what="the calculator">
        <p>working fine</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('working fine')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a fallback instead of unmounting when a child throws', () => {
    render(
      <ErrorBoundary what="the calculator">
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/the calculator stopped working/i)).toBeInTheDocument()
  })

  it('names what broke, so the message is not generic', () => {
    render(
      <ErrorBoundary what="the breeding tools">
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByText(/the breeding tools stopped working/i)).toBeInTheDocument()
  })

  it('logs the failure, which is the only report this app can make', () => {
    // No telemetry — the app makes no runtime network calls — so the console is
    // where anyone reporting a bug will be asked to look.
    render(
      <ErrorBoundary what="the calculator">
        <Boom />
      </ErrorBoundary>,
    )

    expect(console.error).toHaveBeenCalled()
  })

  it('exposes the error message behind a disclosure rather than in the face', () => {
    render(
      <ErrorBoundary what="the calculator">
        <Boom message="cycle in recipe graph" />
      </ErrorBoundary>,
    )

    expect(screen.getByText('error detail')).toBeInTheDocument()
    expect(screen.getByText('cycle in recipe graph')).toBeInTheDocument()
  })

  it('isolates siblings, so one broken panel does not take the other', () => {
    // The reason there is a boundary per tab panel rather than one around the app.
    render(
      <>
        <ErrorBoundary what="the calculator">
          <Boom />
        </ErrorBoundary>
        <ErrorBoundary what="the breeding tools">
          <p>breeding still fine</p>
        </ErrorBoundary>
      </>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('breeding still fine')).toBeInTheDocument()
  })
})

describe('recovering', () => {
  it('offers a plain reload that touches no saved data', async () => {
    window.localStorage.setItem('forgepal:builds:v1', '{"keep":true}')
    render(
      <ErrorBoundary what="the calculator">
        <Boom />
      </ErrorBoundary>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'reload' }))

    expect(reload).toHaveBeenCalled()
    expect(window.localStorage.getItem('forgepal:builds:v1')).toBe('{"keep":true}')
  })

  it('clears every forgepal key when asked, not just the legacy one', () => {
    // The trap this guards: clearPersisted alone only removes the pre-collection
    // key, so a reset built from it would leave forgepal:builds:v1 in place —
    // appearing to work, then throwing again on reload.
    window.localStorage.setItem('forgepal:build:v1', 'build=ingot.7')
    window.localStorage.setItem('forgepal:builds:v1', '{"corrupt":true}')
    window.localStorage.setItem('forgepal:inventory:v1', '{"ore":40}')
    window.localStorage.setItem('forgepal:sections:v1', '{"totals":false}')
    window.localStorage.setItem('unrelated:key', 'kept')

    render(
      <ErrorBoundary what="the calculator">
        <Boom />
      </ErrorBoundary>,
    )

    screen.getByRole('button', { name: /clear saved data/i }).click()

    expect(window.localStorage.getItem('forgepal:build:v1')).toBeNull()
    expect(window.localStorage.getItem('forgepal:builds:v1')).toBeNull()
    expect(window.localStorage.getItem('forgepal:inventory:v1')).toBeNull()
    expect(window.localStorage.getItem('forgepal:sections:v1')).toBeNull()
    // Someone else's key on the same origin is not ours to delete.
    expect(window.localStorage.getItem('unrelated:key')).toBe('kept')
    expect(reload).toHaveBeenCalled()
  })

  it('does not make clearing the default action', async () => {
    // The destructive option must not be the one you hit by reflex, so reload
    // comes first in the DOM and reads as the thing to try.
    render(
      <ErrorBoundary what="the calculator">
        <Boom />
      </ErrorBoundary>,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveAccessibleName('reload')
  })
})

describe('a tab that throws', () => {
  it('leaves the shell and the other tab usable', async () => {
    render(<App />)

    // The calculator is the default tab and its mock throws on render.
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    // The shell survived: heading, both tabs, and the footer are all still there.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ForgePal')
    expect(screen.getByRole('tab', { name: 'Calculator' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Breeding' })).toBeInTheDocument()
    expect(screen.getByText(/not affiliated with Pocketpair/)).toBeInTheDocument()
  })

  it('lets you switch to the working tab', async () => {
    render(<App />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Breeding' }))

    // The breeding tab renders for real — only the calculator is mocked.
    expect(
      await screen.findByText(/Breeding dataset/i, {}, { timeout: 10_000 }),
    ).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { toId } from '@/lib/id'

function visit(query: string) {
  window.history.replaceState(null, '', query ? `/?${query}` : '/')
  render(<App />)
}

/**
 * Render, then wait for the calculator's lazy chunk to resolve.
 *
 * Both tabs are lazy now, so calculator DOM is never there on the first tick.
 * Awaiting the tech-level control is the cheapest proof the chunk arrived — it
 * is in every calculator render, including one whose build list came out empty.
 *
 * Don't be tempted back to synchronous queries because they appear to pass:
 * React caches a resolved `lazy` component, so whichever test runs first pays
 * the wait and the rest silently inherit it. That makes the suite pass or fail
 * on test order.
 */
async function visitCalculator(query: string) {
  visit(query)
  // Generous timeout: whichever test mounts the calculator first pays for
  // parsing the 1.88 MB dataset module and building the 1,300-entry index, which
  // overruns the 1s default in jsdom. Everything after it hits a warm module.
  await screen.findByLabelText(/tech level/i, {}, { timeout: 10_000 })
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('restores a build from the URL', async () => {
    await visitCalculator(`build=${toId('Mega Sphere')}.20&level=25`)

    expect(screen.getByLabelText('Mega Sphere quantity')).toHaveValue(20)
    expect(screen.getByLabelText(/tech level/i)).toHaveValue(25)
  })

  it('migrates a build saved under the old single-build key', async () => {
    // Anyone using ForgePal before named builds shipped has one here; starting
    // them on an empty list would read as having lost it.
    window.localStorage.setItem('forgepal:build:v1', `build=${toId('Ingot')}.7`)
    await visitCalculator('')
    expect(screen.getByLabelText('Ingot quantity')).toHaveValue(7)
  })

  it('restores a saved build collection', async () => {
    window.localStorage.setItem(
      'forgepal:builds:v1',
      JSON.stringify({
        activeId: 'a',
        playerLevel: 30,
        builds: [{ id: 'a', name: 'Ore run', quantities: { [toId('Ingot')]: 7 } }],
      }),
    )
    await visitCalculator('')
    expect(screen.getByLabelText('Ingot quantity')).toHaveValue(7)
    expect(screen.getByLabelText(/tech level/i)).toHaveValue(30)
  })

  it('opens a shared link as its own build without clobbering saved ones', async () => {
    // Following someone's link must never cost you a list you had saved.
    window.localStorage.setItem('forgepal:build:v1', `build=${toId('Ingot')}.7`)
    await visitCalculator(`build=${toId('Mega Sphere')}.2`)

    expect(screen.getByLabelText('Mega Sphere quantity')).toHaveValue(2)
    expect(screen.queryByLabelText('Ingot quantity')).not.toBeInTheDocument()

    // The migrated build is still there, one select away.
    const options = [...screen.getByLabelText('Active build').querySelectorAll('option')]
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('My build')]),
    )
  })

  it('reports a single skipped item in the singular', async () => {
    // Regression: this read "1 item ... are no longer" before.
    await visitCalculator('build=ghost-widget.3')

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('1 item from that link is no longer in the dataset')
    expect(notice).toHaveTextContent('ghost-widget')
    expect(notice.textContent).not.toContain('items')
  })

  it('reports several skipped items in the plural', async () => {
    await visitCalculator('build=ghost-one.1_ghost-two.2')

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('2 items from that link are no longer in the dataset')
  })

  it('keeps the items it does recognise from a partly stale link', async () => {
    await visitCalculator(`build=${toId('Ingot')}.4_ghost-widget.9`)

    expect(screen.getByLabelText('Ingot quantity')).toHaveValue(4)
    expect(screen.getByRole('status')).toHaveTextContent('ghost-widget')
  })

  it('shows no notice for a clean link', async () => {
    // Awaiting the chunk matters here beyond flushing: the Suspense fallback is
    // itself a role="status", so asserting too early would find the loader and
    // read as a stale-link notice.
    await visitCalculator(`build=${toId('Ingot')}.1`)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('mirrors the active build into the URL', async () => {
    await visitCalculator(`build=${toId('Ingot')}.3&level=12`)

    expect(screen.getByLabelText('Ingot quantity')).toHaveValue(3)
    expect(window.location.search).toContain(`${toId('Ingot')}.3`)
    expect(window.location.search).toContain('level=12')
  })

  it('persists a shared build once it is edited, not merely opened', async () => {
    // Saving on load would add another copy every time the same link is opened.
    await visitCalculator(`build=${toId('Ingot')}.3`)
    expect(window.localStorage.getItem('forgepal:builds:v1')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Increase Ingot' }))
    expect(window.localStorage.getItem('forgepal:builds:v1')).toContain(toId('Ingot'))
  })

  it('renders the dataset provenance in the footer', () => {
    // Synchronous on purpose: the footer reads meta.json, not game-data.json, so
    // it paints without waiting on either tab's chunk. That is the whole point
    // of splitting the stamp out — if this ever needs an await, the shell has
    // been given a dependency on the dataset again.
    visit('')
    expect(screen.getByText(/Palworld .* data, updated/)).toBeInTheDocument()
    expect(screen.getByText(/not affiliated with Pocketpair/)).toBeInTheDocument()
  })

  it('survives a malformed link without crashing', () => {
    visit('build=_.._nope_.7_x.&level=abc')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ForgePal')
  })
})

describe('App tabs', () => {
  it('opens the calculator by default', () => {
    visit('')
    expect(screen.getByRole('tab', { name: 'Calculator' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Calculator' })).toBeVisible()
  })

  it('opens the tab named in the link', async () => {
    visit('tab=breeding')
    expect(screen.getByRole('tab', { name: 'Breeding' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText(/Breeding dataset/i)).toBeInTheDocument()
  })

  it('ignores an unknown tab rather than showing nothing', () => {
    visit('tab=teleporter')
    expect(screen.getByRole('tabpanel', { name: 'Calculator' })).toBeVisible()
  })

  it('mirrors the tab into the URL and drops it again on the way back', async () => {
    await visitCalculator('')
    await userEvent.click(screen.getByRole('tab', { name: 'Breeding' }))
    expect(window.location.search).toContain('tab=breeding')

    await userEvent.click(screen.getByRole('tab', { name: 'Calculator' }))
    // The default is omitted, so an ordinary calculator link looks exactly as
    // it did before tabs existed.
    expect(window.location.search).not.toContain('tab=')
  })

  it('keeps the build in the URL across a tab switch', async () => {
    // The regression the applyState change exists to prevent: the two effects
    // both write the query, and either one rebuilding it wholesale would erase
    // the other's params.
    await visitCalculator(`build=${toId('Ingot')}.3&level=12`)
    await userEvent.click(screen.getByRole('tab', { name: 'Breeding' }))

    expect(window.location.search).toContain(`${toId('Ingot')}.3`)
    expect(window.location.search).toContain('level=12')
    expect(window.location.search).toContain('tab=breeding')
  })

  it('keeps the calculator mounted so switching back loses nothing', async () => {
    // A shared build isn't persisted until edited; unmounting the calculator on
    // a tab switch would drop it. Lazy loading defers the first mount only — the
    // visited set keeps it mounted from then on.
    await visitCalculator(`build=${toId('Ingot')}.3`)
    await userEvent.click(screen.getByRole('tab', { name: 'Breeding' }))

    // Still in the DOM, just not on screen — which is the whole distinction.
    expect(screen.getByLabelText('Ingot quantity')).toHaveValue(3)
    expect(screen.getByLabelText('Ingot quantity')).not.toBeVisible()

    await userEvent.click(screen.getByRole('tab', { name: 'Calculator' }))
    expect(screen.getByRole('tabpanel', { name: 'Calculator' })).toBeVisible()
  })

  it('does not build the breeding tab until it is opened', async () => {
    await visitCalculator('')
    expect(screen.queryByText(/Breeding dataset/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Breeding' }))
    expect(await screen.findByText(/Breeding dataset/i)).toBeInTheDocument()
  })

  it('reports the tie-break share rather than presenting it as settled', async () => {
    visit('tab=breeding')
    expect(await screen.findByText(/of all parent pairs/i)).toBeInTheDocument()
  })
})

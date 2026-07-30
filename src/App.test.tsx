// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { toId } from '@/lib/id'

function visit(query: string) {
  window.history.replaceState(null, '', query ? `/?${query}` : '/')
  render(<App />)
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('restores a build from the URL', () => {
    visit(`build=${toId('Mega Sphere')}.20&level=25`)

    expect(screen.getByLabelText('Mega Sphere quantity')).toHaveValue(20)
    expect(screen.getByLabelText(/tech level/i)).toHaveValue(25)
  })

  it('restores a saved build when the URL carries none', () => {
    window.localStorage.setItem('forgepal:build:v1', `build=${toId('Ingot')}.7`)
    visit('')
    expect(screen.getByLabelText('Ingot quantity')).toHaveValue(7)
  })

  it('lets a URL win over saved state', () => {
    // Following someone's link should show their build, not resurrect yours.
    window.localStorage.setItem('forgepal:build:v1', `build=${toId('Ingot')}.7`)
    visit(`build=${toId('Mega Sphere')}.2`)

    expect(screen.getByLabelText('Mega Sphere quantity')).toHaveValue(2)
    expect(screen.queryByLabelText('Ingot quantity')).not.toBeInTheDocument()
  })

  it('reports a single skipped item in the singular', () => {
    // Regression: this read "1 item ... are no longer" before.
    visit('build=ghost-widget.3')

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('1 item from that link is no longer in the dataset')
    expect(notice).toHaveTextContent('ghost-widget')
    expect(notice.textContent).not.toContain('items')
  })

  it('reports several skipped items in the plural', () => {
    visit('build=ghost-one.1_ghost-two.2')

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('2 items from that link are no longer in the dataset')
  })

  it('keeps the items it does recognise from a partly stale link', () => {
    visit(`build=${toId('Ingot')}.4_ghost-widget.9`)

    expect(screen.getByLabelText('Ingot quantity')).toHaveValue(4)
    expect(screen.getByRole('status')).toHaveTextContent('ghost-widget')
  })

  it('shows no notice for a clean link', () => {
    visit(`build=${toId('Ingot')}.1`)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('writes the current build back to the URL and to storage', async () => {
    visit(`build=${toId('Ingot')}.3&level=12`)

    // The sync effect runs after paint; awaiting a query flushes it.
    expect(await screen.findByLabelText('Ingot quantity')).toHaveValue(3)
    expect(window.location.search).toContain(`${toId('Ingot')}.3`)
    expect(window.location.search).toContain('level=12')
    expect(window.localStorage.getItem('forgepal:build:v1')).toContain(`${toId('Ingot')}.3`)
  })

  it('renders the dataset provenance in the footer', () => {
    visit('')
    expect(screen.getByText(/Palworld .* data, updated/)).toBeInTheDocument()
    expect(screen.getByText(/not affiliated with Pocketpair/)).toBeInTheDocument()
  })

  it('survives a malformed link without crashing', () => {
    visit('build=_.._nope_.7_x.&level=abc')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ForgePal')
  })
})

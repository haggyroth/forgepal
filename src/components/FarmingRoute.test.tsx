// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FarmingRoute } from './FarmingRoute'
import { buildHabitatIndex, buildRoute, type FarmingRoute as Route } from '@/lib/route'
import { buildIndex, calculate } from '@/lib/calculator'
import { toId } from '@/lib/id'
import { gameData } from '@/data'
import type { GameData } from '@/types/game'

const data = gameData as unknown as GameData
const index = buildIndex(data)
const habitats = buildHabitatIndex(data)

const routeFor = (entries: [string, number][]): Route =>
  buildRoute(
    calculate(
      entries.map(([name, quantity]) => ({ itemId: toId(name), quantity })),
      index,
    ),
    index,
    habitats,
  )

describe('FarmingRoute', () => {
  it('renders nothing when there is no route to give', () => {
    const { container } = render(<FarmingRoute route={routeFor([])} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists regions with the materials and Pals found there', () => {
    render(<FarmingRoute route={routeFor([['Cloth', 10]])} />)

    expect(screen.getByRole('heading', { name: /Farming route/ })).toBeInTheDocument()
    expect(screen.getAllByText(/×20/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wool').length).toBeGreaterThan(0)
  })

  it('reports gathered materials as needing no route', () => {
    render(<FarmingRoute route={routeFor([['Mega Sphere', 20]])} />)

    expect(screen.getByText(/Gather anywhere/)).toBeInTheDocument()
    expect(screen.getByText(/Ore ×40/)).toBeInTheDocument()
  })

  it('explains materials whose sources have no wild spawn', () => {
    render(<FarmingRoute route={routeFor([['Chillet Bounty Token', 1]])} />)
    expect(screen.getByText(/No wild spawn/)).toBeInTheDocument()
  })

  it('collapses the long tail of regions behind a control', async () => {
    // A broad list touches many regions; showing all of them defeats the
    // ranking, so only the most productive few appear up front.
    render(
      <FarmingRoute
        route={routeFor([
          ['Cake', 3],
          ['Refined Ingot', 20],
          ['Cloth', 10],
        ])}
      />,
    )

    const more = screen.queryByRole('button', { name: /show \d+ more region/ })
    if (more) {
      const before = screen.getAllByRole('listitem').length
      await userEvent.click(more)
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(before)
    }
    expect(screen.getByRole('heading', { name: /Farming route/ })).toBeInTheDocument()
  })

  it('flags a night-only stop', () => {
    const route: Route = {
      stops: [
        {
          region: 'Moonless Vale',
          materials: [
            {
              itemId: 'x',
              name: 'Nocturnal Thing',
              required: 3,
              pals: [{ name: 'Nightowl', quantity: [1, 1], chance: 1, dayNight: 'night' }],
            },
          ],
          palCount: 1,
          nightOnly: true,
        },
      ],
      unroutable: [],
      gathered: [],
    }
    render(<FarmingRoute route={route} />)

    expect(screen.getByText('night')).toBeInTheDocument()
    expect(screen.getByText('Moonless Vale')).toBeInTheDocument()
    expect(screen.getByText(/1 item · 1 pal/)).toBeInTheDocument()
  })

  it('pluralises the item and pal counts', () => {
    const route = routeFor([['Cloth', 10]])
    render(<FarmingRoute route={route} />)
    // Whatever the data, the summary must never read "1 items" or "2 pal".
    for (const el of screen.getAllByText(/\d+ items? · \d+ pals?/)) {
      const text = el.textContent ?? ''
      expect(text).not.toMatch(/\b1 items\b/)
      expect(text).not.toMatch(/\b(?!1\b)\d+ pal\b/)
    }
  })
})

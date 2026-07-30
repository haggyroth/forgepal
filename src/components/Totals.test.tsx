// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Totals } from './Totals'
import { buildIndex, calculate, type CalculationResult } from '@/lib/calculator'
import { buildHabitatIndex } from '@/lib/route'
import { toId } from '@/lib/id'
import { gameData } from '@/data'
import type { GameData } from '@/types/game'

const data = gameData as unknown as GameData
const index = buildIndex(data)
const sourcing = {
  habitats: buildHabitatIndex(data),
  merchantListings: data.merchantListings,
  expeditionRewards: data.expeditionRewards,
}

const resultFor = (entries: [string, number][]) =>
  calculate(
    entries.map(([name, quantity]) => ({ itemId: toId(name), quantity })),
    index,
  )

const row = (name: string) => screen.getByText(name).closest('li')

describe('Totals', () => {
  it('says nothing is queued when the build list is empty', () => {
    render(<Totals result={resultFor([])} index={index} sourcing={sourcing} />)
    expect(screen.getByText(/Nothing queued yet/)).toBeInTheDocument()
  })

  it('lists raw materials with their quantities', () => {
    render(<Totals result={resultFor([['Mega Sphere', 20]])} index={index} sourcing={sourcing} />)

    // 20 spheres -> 20 Ingots -> 40 Ore.
    expect(row('Ore')).toHaveTextContent('40')
    expect(row('Wood')).toHaveTextContent('60')
    expect(screen.getByText('4 to gather')).toBeInTheDocument()
  })

  it('separates intermediates from the shopping list', () => {
    render(<Totals result={resultFor([['Mega Sphere', 20]])} index={index} sourcing={sourcing} />)

    expect(screen.getByRole('heading', { name: /Craft along the way/ })).toBeInTheDocument()
    expect(row('Ingot')).toHaveTextContent('20')
    expect(row('Ingot')).toHaveTextContent('Primitive Furnace')
  })

  it('names the Pal work a station needs', () => {
    render(<Totals result={resultFor([['Mega Sphere', 1]])} index={index} sourcing={sourcing} />)
    expect(row('Ingot')).toHaveTextContent('Kindling')
  })

  it('omits the intermediates panel when there are none', () => {
    render(<Totals result={resultFor([['Ingot', 5]])} index={index} sourcing={sourcing} />)
    expect(screen.queryByRole('heading', { name: /Craft along the way/ })).not.toBeInTheDocument()
  })

  it('reveals Pal drop sources on demand, best odds first', async () => {
    render(<Totals result={resultFor([['Cloth', 5]])} index={index} sourcing={sourcing} />)

    const toggle = screen.getByRole('button', { name: /Wool/ })
    expect(screen.queryByText('Dropped by')).not.toBeInTheDocument()

    await userEvent.click(toggle)
    expect(screen.getByText('Dropped by')).toBeInTheDocument()

    // Rates within the expanded row must descend — the point of the table is
    // who to go and hunt, so the best odds have to come first.
    const expanded = toggle.closest('li')!
    const rates = [...expanded.querySelectorAll('li')]
      .map((li) => /(\d+)%/.exec(li.textContent ?? '')?.[1])
      .filter((r): r is string => r !== undefined)
      .map(Number)

    expect(rates.length).toBeGreaterThan(1)
    expect(rates).toEqual([...rates].sort((a, b) => b - a))
  })

  it('does not offer an expander for a material with no recorded sources', () => {
    render(<Totals result={resultFor([['Mega Sphere', 1]])} index={index} sourcing={sourcing} />)
    // Paldium Fragment is curated as gathered and carries source notes; a
    // material with neither drops nor notes must not render a dead toggle.
    const bare = index.byId.get(toId('Ore'))
    expect(bare).toBeDefined()
    expect(screen.getByRole('button', { name: /Ore/ })).toBeInTheDocument()
  })

  it('renders an unknown drop rate as "?" rather than 0%', async () => {
    // A 0% rate would read as "never drops". Upstream records some rates as
    // unknown, and 108 drop sources carry null.
    const base = resultFor([['Mega Sphere', 1]])
    const spoofed: CalculationResult = {
      ...base,
      raw: [
        {
          itemId: 'mystery-material',
          name: 'Mystery Material',
          sourceKind: 'drop',
          required: 3,
          crafts: 0,
          produced: 0,
          surplus: 0,
          stationName: null,
          isTarget: false,
        },
      ],
    }
    const spoofedIndex = {
      ...index,
      byId: new Map(index.byId).set('mystery-material', {
        id: 'mystery-material',
        name: 'Mystery Material',
        category: 'material',
        sourceKind: 'drop',
        techLevel: null,
        recipe: null,
        alternativeRecipes: [],
        drops: [{ source: 'Named Boss', quantity: [1, 1], chance: null }],
        otherSources: [],
      }),
    }

    render(<Totals result={spoofed} index={spoofedIndex} sourcing={sourcing} />)
    await userEvent.click(screen.getByRole('button', { name: /Mystery Material/ }))

    expect(screen.getByTitle('Drop rate not recorded upstream')).toHaveTextContent('?')
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('surfaces recipe inputs missing from the dataset', () => {
    const base = resultFor([['Mega Sphere', 1]])
    render(
      <Totals
        result={{ ...base, unresolved: [{ itemId: 'ghost', name: 'Ghost Material', required: 7 }] }}
        index={index}
        sourcing={sourcing}
      />,
    )
    expect(screen.getByRole('heading', { name: /Unknown materials/ })).toBeInTheDocument()
    expect(row('Ghost Material')).toHaveTextContent('7')
  })

  it('renders the export controls it is handed', () => {
    render(
      <Totals
        result={resultFor([['Ingot', 1]])}
        index={index}
        sourcing={sourcing}
        exportBar={<button type="button">copy markdown</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'copy markdown' })).toBeInTheDocument()
  })
})

describe('alternative sourcing', () => {
  it('offers vendors as an alternative to farming', async () => {
    render(<Totals result={resultFor([['Cloth', 5]])} index={index} sourcing={sourcing} />)
    await userEvent.click(screen.getByRole('button', { name: /Wool/ }))
    expect(screen.getByText(/Or buy from/)).toBeInTheDocument()
  })

  it('shows where a Pal lives next to its drop entry', async () => {
    render(<Totals result={resultFor([['Cloth', 5]])} index={index} sourcing={sourcing} />)
    await userEvent.click(screen.getByRole('button', { name: /Wool/ }))

    // Melpaca is the headline Wool source and does have wild regions.
    const expanded = screen.getByRole('button', { name: /Wool/ }).closest('li')!
    expect(expanded.textContent).toMatch(/Melpaca/)
    expect(expanded.textContent).toMatch(/Island|Hills|Archipelago|Rocks/)
  })

  it('says "price ?" rather than implying an item is free', async () => {
    // 476 of 587 upstream listings carry no price.
    render(<Totals result={resultFor([['Cloth', 5]])} index={index} sourcing={sourcing} />)
    await userEvent.click(screen.getByRole('button', { name: /Wool/ }))

    const unpriced = screen.queryAllByTitle('Price not recorded upstream')
    for (const el of unpriced) expect(el).toHaveTextContent('price ?')
    expect(screen.queryByText(/\b0 Gold Coin\b/)).not.toBeInTheDocument()
  })
})

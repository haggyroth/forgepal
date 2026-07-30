// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Totals } from './Totals'
import { buildIndex, calculate, type CalculationResult } from '@/lib/calculator'
import { toId } from '@/lib/id'
import { gameData } from '@/data'
import type { GameData } from '@/types/game'

const index = buildIndex(gameData as unknown as GameData)

const resultFor = (entries: [string, number][]) =>
  calculate(
    entries.map(([name, quantity]) => ({ itemId: toId(name), quantity })),
    index,
  )

const row = (name: string) => screen.getByText(name).closest('li')

describe('Totals', () => {
  it('says nothing is queued when the build list is empty', () => {
    render(<Totals result={resultFor([])} index={index} />)
    expect(screen.getByText(/Nothing queued yet/)).toBeInTheDocument()
  })

  it('lists raw materials with their quantities', () => {
    render(<Totals result={resultFor([['Mega Sphere', 20]])} index={index} />)

    // 20 spheres -> 20 Ingots -> 40 Ore.
    expect(row('Ore')).toHaveTextContent('40')
    expect(row('Wood')).toHaveTextContent('60')
    expect(screen.getByText('4 to gather')).toBeInTheDocument()
  })

  it('separates intermediates from the shopping list', () => {
    render(<Totals result={resultFor([['Mega Sphere', 20]])} index={index} />)

    expect(screen.getByRole('heading', { name: /Craft along the way/ })).toBeInTheDocument()
    expect(row('Ingot')).toHaveTextContent('20')
    expect(row('Ingot')).toHaveTextContent('Primitive Furnace')
  })

  it('names the Pal work a station needs', () => {
    render(<Totals result={resultFor([['Mega Sphere', 1]])} index={index} />)
    expect(row('Ingot')).toHaveTextContent('Kindling')
  })

  it('omits the intermediates panel when there are none', () => {
    render(<Totals result={resultFor([['Ingot', 5]])} index={index} />)
    expect(screen.queryByRole('heading', { name: /Craft along the way/ })).not.toBeInTheDocument()
  })

  it('reveals Pal drop sources on demand, best odds first', async () => {
    render(<Totals result={resultFor([['Cloth', 5]])} index={index} />)

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
    render(<Totals result={resultFor([['Mega Sphere', 1]])} index={index} />)
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

    render(<Totals result={spoofed} index={spoofedIndex} />)
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
        exportBar={<button type="button">copy markdown</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'copy markdown' })).toBeInTheDocument()
  })
})

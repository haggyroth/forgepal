// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BuildList } from './BuildList'
import { buildIndex, calculate, type MaterialTotal } from '@/lib/calculator'
import { toId } from '@/lib/id'
import { gameData } from '@/data'
import type { GameData, ItemId } from '@/types/game'

const index = buildIndex(gameData as unknown as GameData)

function totalsFor(entries: [string, number][]) {
  const result = calculate(
    entries.map(([name, quantity]) => ({ itemId: toId(name), quantity })),
    index,
  )
  return new Map<ItemId, MaterialTotal>(result.targets.map((t) => [t.itemId, t]))
}

function setup(entries: [string, number][] = [], overrides = {}) {
  const props = {
    quantities: new Map(entries.map(([name, quantity]) => [toId(name), quantity])),
    index,
    totals: totalsFor(entries),
    onSetQuantity: vi.fn(),
    onRemove: vi.fn(),
    onClear: vi.fn(),
    onShare: vi.fn(),
    shared: false,
    ...overrides,
  }
  render(<BuildList {...props} />)
  return props
}

describe('BuildList', () => {
  it('prompts when empty, and hides the row actions', () => {
    setup()
    expect(screen.getByText(/Pick items from the catalogue/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'clear all' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'copy link' })).not.toBeInTheDocument()
  })

  it('lists queued items with their station and Pal work', () => {
    setup([['Mega Sphere', 20]])
    expect(screen.getByText('Mega Sphere')).toBeInTheDocument()
    expect(screen.getByText(/Sphere Workbench · Handiwork/)).toBeInTheDocument()
  })

  it('never claims a structure has no recipe', () => {
    // Regression: structures are placed from the build menu and have no
    // crafting station, and were previously labelled "no recipe" while listing
    // their materials directly below.
    setup([['Electric Furnace', 1]])
    expect(screen.getByText(/Build menu/)).toBeInTheDocument()
    expect(screen.queryByText(/no recipe/i)).not.toBeInTheDocument()
  })

  it('flags a structure that needs power and the Pal that works it', () => {
    setup([['Electric Furnace', 1]])
    expect(screen.getByText(/worked by Kindling/)).toBeInTheDocument()
    expect(screen.getByText(/needs power/)).toBeInTheDocument()
  })

  it('spells out the batch maths when a craft overshoots', () => {
    // 15 Arrows is 2 batches of 10, so 20 are produced and 5 are spare.
    // Without this the material totals look inexplicably high.
    setup([['Arrow', 15]])
    expect(screen.getByText(/2 × 10 = 20, 5 spare/)).toBeInTheDocument()
  })

  it('describes the batch size when the order divides evenly', () => {
    setup([['Arrow', 20]])
    expect(screen.getByText(/batches of 10/)).toBeInTheDocument()
    expect(screen.queryByText(/spare/)).not.toBeInTheDocument()
  })

  it('says nothing about batches for ordinary recipes', () => {
    setup([['Mega Sphere', 3]])
    expect(screen.queryByText(/batches of/)).not.toBeInTheDocument()
  })

  it('reports extra demand when a target is also an intermediate', () => {
    // 10 Mega Spheres need 10 Ingots on top of the 5 requested.
    setup([
      ['Mega Sphere', 10],
      ['Ingot', 5],
    ])
    expect(screen.getByText(/15 needed incl. other recipes/)).toBeInTheDocument()
  })

  it('wires up quantity, remove, clear, and share', async () => {
    const props = setup([['Ingot', 4]])

    await userEvent.click(screen.getByRole('button', { name: 'Increase Ingot' }))
    expect(props.onSetQuantity).toHaveBeenCalledWith(toId('Ingot'), 5)

    await userEvent.click(screen.getByRole('button', { name: 'Remove Ingot' }))
    expect(props.onRemove).toHaveBeenCalledWith(toId('Ingot'))

    await userEvent.click(screen.getByRole('button', { name: 'clear all' }))
    expect(props.onClear).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'copy link' }))
    expect(props.onShare).toHaveBeenCalled()
  })

  it('confirms once a link has been copied', () => {
    setup([['Ingot', 1]], { shared: true })
    expect(screen.getByRole('button', { name: /link copied/ })).toBeInTheDocument()
  })

  it('falls back to the id for an item missing from the dataset', () => {
    render(
      <BuildList
        quantities={new Map([['ghost-item', 2]])}
        index={index}
        totals={new Map()}
        onSetQuantity={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onShare={vi.fn()}
        shared={false}
      />,
    )
    expect(screen.getByText('ghost-item')).toBeInTheDocument()
  })
})

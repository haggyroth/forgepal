// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemBrowser } from './ItemBrowser'
import { toId } from '@/lib/id'
import { gameData } from '@/data'
import type { Entry } from '@/lib/search'
import type { GameData, ItemId } from '@/types/game'

const data = gameData as unknown as GameData
const entries: Entry[] = [...data.items, ...data.structures]
const stations = [...data.stations].sort((a, b) => a.name.localeCompare(b.name))

function setup(overrides: { playerLevel?: number | null; inList?: ItemId[] } = {}) {
  const onAdd = vi.fn()
  render(
    <ItemBrowser
      entries={entries}
      stations={stations}
      playerLevel={overrides.playerLevel ?? null}
      onAdd={onAdd}
      inList={new Set(overrides.inList ?? [])}
    />,
  )
  return { onAdd }
}

const search = () => screen.getByLabelText('Search items and structures')

describe('ItemBrowser', () => {
  it('gives every result an actionable accessible name', async () => {
    // The visible text is only the item name; the button's job is to add it,
    // which a screen reader would otherwise never hear.
    setup()
    await userEvent.type(search(), 'Mega Sphere')
    expect(
      await screen.findByRole('button', { name: 'Add Mega Sphere to build list' }),
    ).toBeInTheDocument()
  })

  it('adds the item that was clicked', async () => {
    const { onAdd } = setup()
    await userEvent.type(search(), 'Mega Sphere')
    await userEvent.click(await screen.findByRole('button', { name: /Add Mega Sphere/ }))
    expect(onAdd).toHaveBeenCalledWith(toId('Mega Sphere'))
  })

  it('reports the true total when results are capped', async () => {
    setup()
    // The catalogue renders at most 60 rows; the count must not lie about it.
    expect(await screen.findByText(/showing 60 of \d+/)).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    setup()
    await userEvent.type(search(), 'zzzzzzzz')
    expect(await screen.findByText(/Nothing matches those filters/)).toBeInTheDocument()
  })

  it('reveals non-craftable entries only when the craftable filter is off', async () => {
    setup()
    await userEvent.type(search(), 'Leather')
    expect(screen.queryByRole('button', { name: /Add Leather to/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'craftable' }))
    expect(await screen.findByRole('button', { name: /Add Leather to/ })).toBeInTheDocument()
  })

  it('filters to a single crafting station', async () => {
    setup()
    await userEvent.selectOptions(
      screen.getByLabelText('Filter by crafting station'),
      toId('Primitive Furnace'),
    )

    const rows = await screen.findAllByRole('button', { name: /^Add / })
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Add Charcoal to build list',
      'Add Ingot to build list',
    ])
  })

  it('marks a checked state for items already queued', async () => {
    setup({ inList: [toId('Mega Sphere')] })
    await userEvent.type(search(), 'Mega Sphere')
    expect(await screen.findByText('✓')).toBeInTheDocument()
  })

  it('offers the unlocked-only filter only once a level is known', () => {
    const { unmount } = render(
      <ItemBrowser
        entries={entries}
        stations={stations}
        playerLevel={null}
        onAdd={vi.fn()}
        inList={new Set()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'unlocked only' })).not.toBeInTheDocument()
    unmount()

    setup({ playerLevel: 20 })
    expect(screen.getByRole('button', { name: 'unlocked only' })).toBeInTheDocument()
  })

  it('locks entries above the player level and can hide them', async () => {
    setup({ playerLevel: 5 })
    await userEvent.type(search(), 'Mega Sphere')

    // Mega Sphere unlocks at Technology 14.
    expect(await screen.findByTitle('Unlocks at Technology 14')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'unlocked only' }))
    expect(screen.queryByRole('button', { name: /Add Mega Sphere/ })).not.toBeInTheDocument()
  })

  it('keeps ungated entries visible under the unlocked-only filter', async () => {
    // Ingot has no techLevel, so it is craftable at any level and must survive.
    setup({ playerLevel: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'unlocked only' }))
    await userEvent.type(search(), 'Ingot')
    expect(await screen.findByRole('button', { name: /Add Ingot to/ })).toBeInTheDocument()
  })
})

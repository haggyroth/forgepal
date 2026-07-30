// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Requirements } from './Requirements'
import { analyseTech } from '@/lib/tech'
import { buildIndex, calculate } from '@/lib/calculator'
import { toId } from '@/lib/id'
import { gameData } from '@/data'
import type { GameData } from '@/types/game'

const index = buildIndex(gameData as unknown as GameData)

const techFor = (entries: [string, number][], level: number | null) =>
  analyseTech(
    calculate(
      entries.map(([name, quantity]) => ({ itemId: toId(name), quantity })),
      index,
    ),
    index,
    level,
  )

describe('Requirements', () => {
  it('renders nothing when there is nothing to require', () => {
    const { container } = render(<Requirements tech={techFor([], null)} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists the stations a build needs with their tech level and Pal work', () => {
    render(<Requirements tech={techFor([['Mega Sphere', 20]], null)} />)

    expect(screen.getByText('Sphere Workbench')).toBeInTheDocument()
    expect(screen.getByText('Primitive Furnace')).toBeInTheDocument()
    expect(screen.getAllByText('Kindling').length).toBeGreaterThan(0)
    expect(screen.getByText(/Tech 10/)).toBeInTheDocument()
  })

  it('names what gates the build', () => {
    render(<Requirements tech={techFor([['Refined Ingot', 5]], null)} />)
    expect(screen.getByText(/Gated by Improved Furnace at Technology 34/)).toBeInTheDocument()
  })

  it('warns about items above the player level', () => {
    render(<Requirements tech={techFor([['Mega Sphere', 1]], 5)} />)

    const warning = screen.getByRole('status')
    expect(warning).toHaveTextContent('Not unlocked at your level: Mega Sphere')
  })

  it('stays quiet when the player is high enough', () => {
    render(<Requirements tech={techFor([['Mega Sphere', 1]], 80)} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('gates nothing when no level is set', () => {
    // Null level means "the user hasn't told us", not level zero.
    render(<Requirements tech={techFor([['Mega Sphere', 1]], null)} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('mentions Ancient Technology only when a build needs it', () => {
    const withAncient = techFor([['Ancient Civilization Parts', 1]], null)
    const without = techFor([['Mega Sphere', 1]], null)

    const { unmount } = render(<Requirements tech={{ ...without, needsAncientTech: true }} />)
    expect(screen.getByText(/Ancient Technology Points/)).toBeInTheDocument()
    unmount()

    render(<Requirements tech={without} />)
    expect(screen.queryByText(/Ancient Technology Points/)).not.toBeInTheDocument()
    expect(withAncient).toBeDefined()
  })

  it('shows a dash for a station with no known tech level', () => {
    render(
      <Requirements
        tech={{
          highestLevel: null,
          drivenBy: null,
          stations: [
            { id: 'mystery', name: 'Mystery Bench', techLevel: null, workSuitability: null, locked: false },
          ],
          lockedItems: [],
          needsAncientTech: false,
        }}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

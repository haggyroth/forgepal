// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipeTree } from './RecipeTree'
import { buildIndex } from '@/lib/calculator'
import { toId } from '@/lib/id'
import { gameData } from '@/data'
import type { GameData } from '@/types/game'

const index = buildIndex(gameData as unknown as GameData)

const quantities = (entries: [string, number][]) =>
  new Map(entries.map(([name, quantity]) => [toId(name), quantity]))

describe('RecipeTree', () => {
  it('renders nothing when the build list is empty', () => {
    const { container } = render(<RecipeTree quantities={quantities([])} index={index} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when every quantity is zero', () => {
    const { container } = render(
      <RecipeTree quantities={quantities([['Ingot', 0]])} index={index} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('nests sub-recipes beneath their parent', () => {
    render(<RecipeTree quantities={quantities([['Mega Sphere', 2]])} index={index} />)

    expect(screen.getByText('Mega Sphere')).toBeInTheDocument()
    expect(screen.getByText('Ingot')).toBeInTheDocument()
    // 2 spheres need 2 Ingots, which need 4 Ore.
    expect(screen.getByText('×4')).toBeInTheDocument()
  })

  it('labels itself per-branch, since those figures differ from the requisition', () => {
    // The totals panel batches and de-duplicates across the whole list; the
    // tree explains structure. Saying so beats letting it be discovered.
    render(<RecipeTree quantities={quantities([['Mega Sphere', 1]])} index={index} />)
    expect(screen.getByText('per branch')).toBeInTheDocument()
  })

  it('names the station on the root node', () => {
    render(<RecipeTree quantities={quantities([['Mega Sphere', 1]])} index={index} />)
    expect(screen.getByText('Sphere Workbench')).toBeInTheDocument()
  })

  it('collapses and re-expands a root', async () => {
    render(<RecipeTree quantities={quantities([['Mega Sphere', 1]])} index={index} />)

    const toggle = screen.getByRole('button', { expanded: true })
    await userEvent.click(toggle)
    expect(screen.queryByText('Ingot')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('Ingot')).toBeInTheDocument()
  })

  it('disables the toggle for an item with no sub-recipes', () => {
    render(<RecipeTree quantities={quantities([['Ingot', 1]])} index={index} />)
    // Ingot's only input is Ore, a gathered leaf, so there is still one level.
    // Wood has no recipe at all and yields a childless root.
    render(<RecipeTree quantities={quantities([['Wood', 1]])} index={index} />)
    expect(screen.getAllByRole('button').some((b) => b.hasAttribute('disabled'))).toBe(true)
  })

  it('renders a row for each queued item', () => {
    render(
      <RecipeTree
        quantities={quantities([
          ['Ingot', 1],
          ['Arrow', 10],
        ])}
        index={index}
      />,
    )
    expect(screen.getByText('Ingot')).toBeInTheDocument()
    expect(screen.getByText('Arrow')).toBeInTheDocument()
  })
})

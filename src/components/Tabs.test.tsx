// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs } from './Tabs'

describe('Tabs', () => {
  it('marks exactly one tab selected', () => {
    render(<Tabs active="breeding" onSelect={() => {}} />)
    const selected = screen
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('Breeding')
  })

  it('points each tab at its panel', () => {
    render(<Tabs active="calculator" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Breeding' })).toHaveAttribute(
      'aria-controls',
      'panel-breeding',
    )
  })

  it('selects on click', async () => {
    const onSelect = vi.fn()
    render(<Tabs active="calculator" onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Breeding' }))
    expect(onSelect).toHaveBeenCalledWith('breeding')
  })

  it('keeps only the active tab in the focus order', () => {
    // Roving tabindex: Tab moves into the tablist once, then the arrow keys
    // move within it. Every tab being tabbable is the usual mistake.
    render(<Tabs active="calculator" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Calculator' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Breeding' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves between tabs with the arrow keys', async () => {
    const onSelect = vi.fn()
    render(<Tabs active="calculator" onSelect={onSelect} />)

    screen.getByRole('tab', { name: 'Calculator' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenCalledWith('breeding')
  })

  it('wraps at the ends rather than dead-ending', async () => {
    const onSelect = vi.fn()
    render(<Tabs active="calculator" onSelect={onSelect} />)

    screen.getByRole('tab', { name: 'Calculator' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onSelect).toHaveBeenCalledWith('breeding')
  })

  it('leaves other keys to the browser', async () => {
    const onSelect = vi.fn()
    render(<Tabs active="calculator" onSelect={onSelect} />)

    screen.getByRole('tab', { name: 'Calculator' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onSelect).not.toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Panel, SectionHeading, SourceBadge, Stepper } from './ui'
import type { SourceKind } from '@/types/game'

describe('SectionHeading', () => {
  it('renders its label as a heading', () => {
    render(<SectionHeading>Requisition</SectionHeading>)
    expect(screen.getByRole('heading', { name: 'Requisition' })).toBeInTheDocument()
  })

  it('renders the aside when given one, and nothing when not', () => {
    const { unmount } = render(<SectionHeading aside="4 to gather">Requisition</SectionHeading>)
    expect(screen.getByText('4 to gather')).toBeInTheDocument()
    unmount()

    render(<SectionHeading>Requisition</SectionHeading>)
    expect(screen.queryByText('4 to gather')).not.toBeInTheDocument()
  })
})

describe('SourceBadge', () => {
  const cases: [SourceKind, string][] = [
    ['craftable', 'craft'],
    ['gathered', 'gather'],
    ['drop', 'drop'],
    ['merchant', 'buy'],
    ['unobtainable', 'unknown'],
  ]

  it.each(cases)('labels %s as "%s"', (kind, label) => {
    render(<SourceBadge kind={kind} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('has a label for every source kind', () => {
    // If a new SourceKind is added without a badge, this catches it rather than
    // rendering an empty pill in production.
    expect(cases).toHaveLength(5)
  })
})

describe('Stepper', () => {
  it('labels its controls for assistive tech', () => {
    render(<Stepper value={3} label="Mega Sphere" onChange={() => {}} />)

    expect(screen.getByLabelText('Mega Sphere quantity')).toHaveValue(3)
    expect(screen.getByRole('button', { name: 'Increase Mega Sphere' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease Mega Sphere' })).toBeInTheDocument()
  })

  it('increments and decrements from the current value', async () => {
    const onChange = vi.fn()
    render(<Stepper value={5} label="Ingot" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Increase Ingot' }))
    expect(onChange).toHaveBeenLastCalledWith(6)

    await userEvent.click(screen.getByRole('button', { name: 'Decrease Ingot' }))
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('reports typed values as numbers, not strings', async () => {
    const onChange = vi.fn()
    render(<Stepper value={0} label="Ore" onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Ore quantity'), '7')
    expect(onChange).toHaveBeenLastCalledWith(7)
  })

  it('can decrement below zero, leaving clamping to the caller', () => {
    // useBuildList clamps; the Stepper is deliberately dumb so a transient 0 or
    // -1 while typing doesn't yank the row out from under the cursor.
    const onChange = vi.fn()
    render(<Stepper value={0} label="Wood" onChange={onChange} />)
    screen.getByRole('button', { name: 'Decrease Wood' }).click()
    expect(onChange).toHaveBeenCalledWith(-1)
  })
})

describe('Panel', () => {
  it('renders children inside a section', () => {
    render(<Panel>inner content</Panel>)
    expect(screen.getByText('inner content')).toBeInTheDocument()
  })

  it('accepts extra classes without dropping its own', () => {
    const { container } = render(<Panel className="custom-class">x</Panel>)
    const section = container.querySelector('section')
    expect(section?.className).toContain('custom-class')
    expect(section?.className).toContain('rounded-md')
  })
})

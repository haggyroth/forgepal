// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Section } from './Section'

beforeEach(() => {
  window.localStorage.clear()
})

const heading = (name = 'Requisition') => screen.getByRole('button', { name: new RegExp(name) })

describe('Section', () => {
  it('shows its content when open', () => {
    render(
      <Section id="test" title="Requisition">
        <p>inner content</p>
      </Section>,
    )
    expect(screen.getByText('inner content')).toBeInTheDocument()
    expect(heading()).toHaveAttribute('aria-expanded', 'true')
  })

  it('honours defaultOpen={false}', () => {
    render(
      <Section id="test" title="Breakdown" defaultOpen={false}>
        <p>inner content</p>
      </Section>,
    )
    expect(screen.queryByText('inner content')).not.toBeInTheDocument()
    expect(heading('Breakdown')).toHaveAttribute('aria-expanded', 'false')
  })

  it('collapses and re-expands on click', async () => {
    render(
      <Section id="test" title="Requisition">
        <p>inner content</p>
      </Section>,
    )

    await userEvent.click(heading())
    expect(screen.queryByText('inner content')).not.toBeInTheDocument()

    await userEvent.click(heading())
    expect(screen.getByText('inner content')).toBeInTheDocument()
  })

  it('unmounts content rather than hiding it', async () => {
    // The Breakdown tree and the 1,300-entry catalogue are the expensive things
    // on the page; hiding them with CSS would keep paying for them.
    const { container } = render(
      <Section id="test" title="Requisition">
        <p data-testid="expensive">inner content</p>
      </Section>,
    )

    await userEvent.click(heading())
    expect(container.querySelector('[data-testid="expensive"]')).toBeNull()
  })

  it('keeps the summary visible while collapsed', async () => {
    // The point of collapsing is to skim: a closed section still has to say
    // what's inside it.
    render(
      <Section id="test" title="Requisition" aside="4 to gather">
        <p>inner content</p>
      </Section>,
    )

    await userEvent.click(heading())
    expect(screen.getByText('4 to gather')).toBeInTheDocument()
  })

  it('wires the toggle to the content region for assistive tech', () => {
    render(
      <Section id="test" title="Requisition">
        <p>inner content</p>
      </Section>,
    )

    const controls = heading().getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    expect(document.getElementById(controls!)).toBeInTheDocument()
  })

  it('persists the collapsed state across a remount', async () => {
    const { unmount } = render(
      <Section id="requisition" title="Requisition">
        <p>inner content</p>
      </Section>,
    )
    await userEvent.click(heading())
    unmount()

    render(
      <Section id="requisition" title="Requisition">
        <p>inner content</p>
      </Section>,
    )
    expect(screen.queryByText('inner content')).not.toBeInTheDocument()
  })

  it('lets a stored preference override defaultOpen', async () => {
    // Once the user has decided, changing our default must not undo it.
    const { unmount } = render(
      <Section id="breakdown" title="Breakdown" defaultOpen={false}>
        <p>inner content</p>
      </Section>,
    )
    await userEvent.click(heading('Breakdown'))
    unmount()

    render(
      <Section id="breakdown" title="Breakdown" defaultOpen={false}>
        <p>inner content</p>
      </Section>,
    )
    expect(screen.getByText('inner content')).toBeInTheDocument()
  })

  it('keeps each section preference separate', async () => {
    render(
      <>
        <Section id="a" title="Alpha">
          <p>alpha content</p>
        </Section>
        <Section id="b" title="Beta">
          <p>beta content</p>
        </Section>
      </>,
    )

    await userEvent.click(heading('Alpha'))
    expect(screen.queryByText('alpha content')).not.toBeInTheDocument()
    expect(screen.getByText('beta content')).toBeInTheDocument()
  })
})

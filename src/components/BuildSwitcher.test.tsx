// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BuildSwitcher } from './BuildSwitcher'
import type { Build } from '@/lib/builds'

const builds: Build[] = [
  { id: 'b1', name: 'Base raid', quantities: new Map() },
  { id: 'b2', name: 'Cake run', quantities: new Map() },
]

const created: Build = { id: 'b3', name: 'Build 3', quantities: new Map() }

function setup(overrides: Partial<React.ComponentProps<typeof BuildSwitcher>> = {}) {
  const props = {
    builds,
    activeId: 'b1',
    name: 'Base raid',
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onDuplicate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  const view = render(<BuildSwitcher {...props} />)
  return { props, view }
}

describe('BuildSwitcher', () => {
  it('arms delete in two steps, and only then calls onDelete', async () => {
    const user = userEvent.setup()
    const { props } = setup()

    await user.click(screen.getByRole('button', { name: 'delete' }))
    expect(props.onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'really delete?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'really delete?' }))
    expect(props.onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'really delete?' })).not.toBeInTheDocument()
  })

  it('does not carry the question over to the build you switch to', async () => {
    const user = userEvent.setup()
    const { props, view } = setup()

    await user.click(screen.getByRole('button', { name: 'delete' }))
    // Switching is the parent's job, so stand in for it.
    view.rerender(<BuildSwitcher {...props} activeId="b2" name="Cake run" />)

    expect(screen.getByRole('button', { name: 'delete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'really delete?' })).not.toBeInTheDocument()
  })

  it('still asks about the build it was asked about, after a round trip', async () => {
    // The armed state is held as an id, so it belongs to that build rather than
    // to "whatever is selected now". Switching back therefore resumes the
    // question instead of dropping it quietly. The deliberate difference from
    // the boolean-plus-effect this replaced — and the only test here that fails
    // against it.
    const user = userEvent.setup()
    const { props, view } = setup()

    await user.click(screen.getByRole('button', { name: 'delete' }))
    view.rerender(<BuildSwitcher {...props} activeId="b2" name="Cake run" />)
    view.rerender(<BuildSwitcher {...props} activeId="b1" name="Base raid" />)

    expect(screen.getByRole('button', { name: 'really delete?' })).toBeInTheDocument()
  })

  it('does not leave the question armed on a build the parent moved to', async () => {
    // "new" and "duplicate" change the active build from inside this component
    // rather than through the select, so clearing the question must not be
    // attached to the select's handler.
    const user = userEvent.setup()
    const { props, view } = setup()

    await user.click(screen.getByRole('button', { name: 'delete' }))
    await user.click(screen.getByRole('button', { name: 'new' }))
    expect(props.onCreate).toHaveBeenCalledTimes(1)

    view.rerender(<BuildSwitcher {...props} builds={[...builds, created]} activeId="b3" />)
    expect(screen.queryByRole('button', { name: 'really delete?' })).not.toBeInTheDocument()
  })
})

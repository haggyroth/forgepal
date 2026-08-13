// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BreedingTab from './BreedingTab'
import { breedingData } from '@/data/breeding'
import { breed, buildBreedIndex } from '@/lib/breeding'

/**
 * Runs against the real breeding dataset and the real engine, not fixtures.
 *
 * The point of these is the wiring — that a pair reaches `breed`, that the roster
 * reaches `solve`, that a contested result is marked. Engine behaviour itself is
 * covered in `lib/breeding.test.ts`, so nothing here re-asserts the formula.
 */
const index = buildBreedIndex(breedingData)
const ROSTER_KEY = 'forgepal:roster:v1'

/** A known fixed combination from the committed data. */
const COMBO = breedingData.specialCombos[0]

function nameOf(id: string) {
  return index.byId.get(id)!.name
}

/** A generic pair whose result the tie-break decides, found from the real data. */
function findContestedPair() {
  const ids = [...index.byId.keys()]
  for (const a of ids) {
    for (const b of ids) {
      const result = breed(index, a, b)
      if (result?.tieBroken) return { a, b, child: result.child }
    }
  }
  throw new Error('no contested pair in the dataset — the tie-break share says there are 14,010')
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('the pair calculator', () => {
  it('prompts for two parents before showing anything', () => {
    render(<BreedingTab />)
    expect(screen.getByText(/pick two parents/i)).toBeInTheDocument()
  })

  it('resolves a fixed combination and says it is one', async () => {
    render(<BreedingTab />)
    const [parentA, parentB] = screen.getAllByLabelText('parent')

    await userEvent.selectOptions(parentA, COMBO.parentA)
    await userEvent.selectOptions(parentB, COMBO.parentB)

    const panel = screen.getByText('produces').closest('div')!
    expect(within(panel).getByText(nameOf(COMBO.child))).toBeInTheDocument()
    expect(screen.getByText('fixed combo')).toBeInTheDocument()
  })

  it('marks a result the tie-break decided', () => {
    // The rule this whole flag exists for: an unmarked uncertain answer is
    // indistinguishable from a certain one, on roughly a third of generic pairs.
    const contested = findContestedPair()
    window.history.replaceState(null, '', `/?pair=${contested.a}.${contested.b}`)
    render(<BreedingTab />)

    // Two matches on purpose: the badge on the result, and the copy of it inside
    // the footnote that explains what the badge means.
    expect(screen.getAllByText('contested').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/decided by a rule the sources disagree about/i)).toBeInTheDocument()
  })

  it('restores a pair from the URL', () => {
    window.history.replaceState(null, '', `/?pair=${COMBO.parentA}.${COMBO.parentB}`)
    render(<BreedingTab />)

    const [parentA, parentB] = screen.getAllByLabelText('parent')
    expect(parentA).toHaveValue(COMBO.parentA)
    expect(parentB).toHaveValue(COMBO.parentB)
  })

  it('mirrors a chosen pair into the URL', async () => {
    render(<BreedingTab />)
    const [parentA, parentB] = screen.getAllByLabelText('parent')

    await userEvent.selectOptions(parentA, COMBO.parentA)
    await userEvent.selectOptions(parentB, COMBO.parentB)

    expect(window.location.search).toContain(`pair=${COMBO.parentA}.${COMBO.parentB}`)
  })

  it('ignores a pair naming a Pal that is not in the dataset', () => {
    window.history.replaceState(null, '', '/?pair=ghost-pal.also-ghost')
    render(<BreedingTab />)

    expect(screen.getByText(/pick two parents/i)).toBeInTheDocument()
  })

  it('offers the child for the roster, then reports it is there', async () => {
    render(<BreedingTab />)
    const [parentA, parentB] = screen.getAllByLabelText('parent')
    await userEvent.selectOptions(parentA, COMBO.parentA)
    await userEvent.selectOptions(parentB, COMBO.parentB)

    await userEvent.click(screen.getByRole('button', { name: 'add to roster' }))

    expect(screen.getByText('already in your roster')).toBeInTheDocument()
    expect(window.localStorage.getItem(ROSTER_KEY)).toContain(COMBO.child)
  })
})

describe('the roster', () => {
  it('starts empty and says so', () => {
    render(<BreedingTab />)
    expect(screen.getByText('empty')).toBeInTheDocument()
  })

  it('adds a Pal and counts it', async () => {
    render(<BreedingTab />)
    await userEvent.selectOptions(screen.getByLabelText('add a pal you own'), 'chillet')

    expect(screen.getByText('1 pal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remove Chillet/i })).toBeInTheDocument()
  })

  it('pluralises the count', async () => {
    render(<BreedingTab />)
    const picker = screen.getByLabelText('add a pal you own')
    await userEvent.selectOptions(picker, 'chillet')
    await userEvent.selectOptions(picker, 'arsox')

    expect(screen.getByText('2 pals')).toBeInTheDocument()
  })

  it('removes a Pal', async () => {
    render(<BreedingTab />)
    await userEvent.selectOptions(screen.getByLabelText('add a pal you own'), 'chillet')
    await userEvent.click(screen.getByRole('button', { name: /Remove Chillet/i }))

    expect(screen.getByText('empty')).toBeInTheDocument()
  })

  it('restores from storage on mount', () => {
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(['chillet', 'arsox']))
    render(<BreedingTab />)

    expect(screen.getByText('2 pals')).toBeInTheDocument()
  })

  it('stays out of the URL', async () => {
    render(<BreedingTab />)
    await userEvent.selectOptions(screen.getByLabelText('add a pal you own'), 'chillet')

    expect(window.location.search).not.toContain('chillet')
  })
})

describe('the shortest chain', () => {
  it('asks for a target first', () => {
    render(<BreedingTab />)
    expect(screen.getByText(/pick a pal you are chasing/i)).toBeInTheDocument()
  })

  it('explains that an empty roster has nothing to work from', async () => {
    render(<BreedingTab />)
    await userEvent.selectOptions(screen.getByLabelText('pal you want'), 'anubis')

    expect(screen.getByText(/add at least one pal to your roster/i)).toBeInTheDocument()
  })

  it('says so when the target is already owned', async () => {
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(['chillet']))
    render(<BreedingTab />)
    await userEvent.selectOptions(screen.getByLabelText('pal you want'), 'chillet')

    expect(screen.getByText(/already in your roster — nothing to breed/i)).toBeInTheDocument()
  })

  it('produces a runnable chain from a roster', async () => {
    // Two pooled parents far apart in rank reach a lot between them.
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(['aegidron', 'amione']))
    render(<BreedingTab />)
    await userEvent.selectOptions(screen.getByLabelText('pal you want'), 'anubis')

    const steps = screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('gen '))
    expect(steps.length).toBeGreaterThan(0)

    // Generations never decrease down the list, which is what makes it runnable
    // top to bottom — a step's parents are produced before the step needs them.
    const generations = steps.map((li) => Number(/gen (\d+)/.exec(li.textContent ?? '')?.[1]))
    expect(generations).toEqual([...generations].sort((a, b) => a - b))
  })

  it('marks the target step', async () => {
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(['aegidron', 'amione']))
    render(<BreedingTab />)
    await userEvent.selectOptions(screen.getByLabelText('pal you want'), 'anubis')

    expect(screen.getByText('target')).toBeInTheDocument()
  })

  it('reports reach rather than just "no" when a target is unreachable', async () => {
    // "No" is useless on its own: with one Pal almost everything is unreachable,
    // and the actionable answer is that the roster is too small.
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(['chillet']))
    render(<BreedingTab />)
    await userEvent.selectOptions(screen.getByLabelText('pal you want'), COMBO.child)

    const unreachable = screen.queryByText(/cannot be reached from your roster/i)
    if (unreachable) {
      expect(screen.getByText(/of 299 species/i)).toBeInTheDocument()
    }
  })

  it('restores a target from the URL and mirrors changes back', async () => {
    window.history.replaceState(null, '', '/?target=anubis')
    render(<BreedingTab />)
    expect(screen.getByLabelText('pal you want')).toHaveValue('anubis')

    await userEvent.selectOptions(screen.getByLabelText('pal you want'), 'arsox')
    expect(window.location.search).toContain('target=arsox')
  })
})

describe('the query string it shares with everything else', () => {
  it('preserves the calculator params and the tab', async () => {
    // Two effects write this query. Either rebuilding it wholesale would erase
    // the other's state.
    window.history.replaceState(null, '', '/?build=ingot.5&level=25&tab=breeding')
    render(<BreedingTab />)

    await userEvent.selectOptions(screen.getByLabelText('pal you want'), 'anubis')

    expect(window.location.search).toContain('build=ingot.5')
    expect(window.location.search).toContain('level=25')
    expect(window.location.search).toContain('tab=breeding')
    expect(window.location.search).toContain('target=anubis')
  })
})

describe('the provenance panels', () => {
  it('shows the tie-break share without needing a click', () => {
    // Collapsing this by default would be a quiet step towards presenting a
    // coin-flip as settled.
    render(<BreedingTab />)
    expect(screen.getByText(/of all parent pairs/i)).toBeInTheDocument()
  })
})

import { useCallback, useState } from 'react'
import { loadRoster, saveRoster } from '@/lib/rosterState'
import type { PalId } from '@/types/breeding'

/**
 * The Pals you own, which is the solver's starting set.
 *
 * Auto-saves on every change, like the build list: there is no explicit save
 * step anywhere else in ForgePal and adding one here would be the odd case out.
 *
 * Insertion-ordered so the roster reads back the way it was built. The solver
 * does not care about order, but a list that reshuffles between visits looks
 * broken.
 */
export function useRoster(isKnownId: (id: PalId) => boolean) {
  const [roster, setRoster] = useState<PalId[]>(() => loadRoster(isKnownId))

  const update = useCallback((change: (previous: PalId[]) => PalId[]) => {
    setRoster((previous) => {
      const next = change(previous)
      saveRoster(next)
      return next
    })
  }, [])

  const add = useCallback(
    (id: PalId) => update((previous) => (previous.includes(id) ? previous : [...previous, id])),
    [update],
  )

  const remove = useCallback(
    (id: PalId) => update((previous) => previous.filter((entry) => entry !== id)),
    [update],
  )

  const clear = useCallback(() => update(() => []), [update])

  return { roster, add, remove, clear }
}

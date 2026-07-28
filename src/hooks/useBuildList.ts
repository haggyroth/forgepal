import { useCallback, useMemo, useState } from 'react'
import type { BuildListEntry } from '@/lib/calculator'
import type { ItemId } from '@/types/game'

const MAX_QUANTITY = 99_999

/**
 * The user's build list.
 *
 * Insertion order is preserved so the list doesn't reshuffle under the cursor
 * as quantities change — a Map, not a plain object.
 */
export function useBuildList(initial: readonly BuildListEntry[] = []) {
  const [quantities, setQuantities] = useState<Map<ItemId, number>>(
    // Lazy initializer: restoring in an effect instead would flash an empty
    // list on every load for anyone with a saved or shared build.
    () => new Map(initial.map((entry) => [entry.itemId, clamp(entry.quantity)])),
  )

  const add = useCallback((itemId: ItemId, amount = 1) => {
    setQuantities((prev) => {
      const next = new Map(prev)
      next.set(itemId, clamp((next.get(itemId) ?? 0) + amount))
      return next
    })
  }, [])

  const setQuantity = useCallback((itemId: ItemId, quantity: number) => {
    setQuantities((prev) => {
      const next = new Map(prev)
      // 0 is a valid transient state while typing, so keep the row rather than
      // yanking it out from under the input.
      next.set(itemId, clamp(quantity))
      return next
    })
  }, [])

  const remove = useCallback((itemId: ItemId) => {
    setQuantities((prev) => {
      const next = new Map(prev)
      next.delete(itemId)
      return next
    })
  }, [])

  const clear = useCallback(() => setQuantities(new Map()), [])

  const entries = useMemo<BuildListEntry[]>(
    () => [...quantities].map(([itemId, quantity]) => ({ itemId, quantity })),
    [quantities],
  )

  return { quantities, entries, add, setQuantity, remove, clear }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_QUANTITY, Math.floor(value)))
}

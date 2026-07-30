import { useCallback, useMemo, useState } from 'react'
import { loadInventory, saveInventory } from '@/lib/inventoryState'
import type { ItemId } from '@/types/game'

const MAX_QUANTITY = 99_999

/**
 * What the player already has on hand.
 *
 * Persisted locally but deliberately kept out of the shareable URL — see
 * `inventoryState.ts` for why.
 */
export function useInventory(isKnownId: (id: ItemId) => boolean) {
  const [stock, setStock] = useState<Map<ItemId, number>>(() => loadInventory(isKnownId))

  const setAmount = useCallback((itemId: ItemId, amount: number) => {
    setStock((previous) => {
      const next = new Map(previous)
      const clamped = clamp(amount)
      // Zero is the same as not recorded, so drop the row rather than
      // persisting a pile of noise for every material ever glanced at.
      if (clamped === 0) next.delete(itemId)
      else next.set(itemId, clamped)
      saveInventory(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setStock(() => {
      const empty = new Map<ItemId, number>()
      saveInventory(empty)
      return empty
    })
  }, [])

  const total = useMemo(() => stock.size, [stock])

  return { stock, setAmount, clear, total }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_QUANTITY, Math.floor(value)))
}

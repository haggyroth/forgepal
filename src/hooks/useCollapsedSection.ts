import { useCallback, useState } from 'react'
import { readSectionOpen, writeSectionOpen } from '@/lib/sectionState'

/**
 * Collapse state for one section, persisted across reloads.
 *
 * A stored preference always wins over `defaultOpen` — once the user has
 * decided, a later change to our defaults must not override them.
 */
export function useCollapsedSection(id: string, defaultOpen: boolean): [boolean, () => void] {
  const [open, setOpen] = useState(() => readSectionOpen(id) ?? defaultOpen)

  const toggle = useCallback(() => {
    setOpen((previous) => {
      const next = !previous
      writeSectionOpen(id, next)
      return next
    })
  }, [id])

  return [open, toggle]
}

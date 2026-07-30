// Relative rather than aliased: this module is shared with the importer in
// scripts/, which compiles under tsconfig.node.json and has no '@/' mapping.
import type { ItemId } from '../types/game.ts'

/**
 * Derive a stable id from a display name.
 *
 * Ids are the join key across every dataset, and recipes reference their inputs
 * by name upstream — so this must be deterministic and applied identically on
 * both sides of a lookup. Keep it boring: lowercase, strip punctuation, hyphens.
 */
export function toId(name: string): ItemId {
  return (
    name
      .normalize('NFKD')
      // Strip combining marks so "Pal Sphère" and "Pal Sphere" collapse together.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

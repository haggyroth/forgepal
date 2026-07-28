/**
 * Post-import sanity checks.
 *
 * The whole point of a checked-in importer is that an upstream change can't
 * quietly poison the app. These checks run on every import and fail the build
 * on anything that would make the calculator produce wrong numbers.
 */

import type { GameData, Item, ItemId } from '../../src/types/game.ts'

export interface ValidationReport {
  /** Recipe cycles, each listed as the ids forming the loop. */
  cycles: ItemId[][]
  /** Recipe inputs that don't correspond to any known item or structure. */
  unresolved: { itemId: ItemId; name: string; requiredBy: string[] }[]
  /** Entries with neither a recipe nor a known source. */
  unobtainable: string[]
  /**
   * Entries whose nullable fields are `undefined` rather than `null`.
   *
   * JSON.stringify drops undefined keys entirely, so these silently vanish from
   * the generated file and break any strict `=== null` check downstream, even
   * though the type says `number | null`.
   */
  missingNullables: string[]
}

export function validate(data: GameData): ValidationReport {
  const all: Item[] = [...data.items, ...data.structures]
  const byId = new Map(all.map((entry) => [entry.id, entry]))

  const cycles: ItemId[][] = []
  const unresolvedMap = new Map<ItemId, { name: string; requiredBy: string[] }>()

  // Iterative three-colour DFS. Iterative rather than recursive because the
  // recipe graph is arbitrary upstream data and a deep chain shouldn't blow
  // the stack.
  const WHITE = 0
  const GREY = 1
  const BLACK = 2
  const colour = new Map<ItemId, number>()

  for (const root of all) {
    if ((colour.get(root.id) ?? WHITE) !== WHITE) continue

    const path: ItemId[] = []
    const stack: { id: ItemId; index: number }[] = [{ id: root.id, index: 0 }]
    colour.set(root.id, GREY)
    path.push(root.id)

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const inputs = byId.get(frame.id)?.recipe?.inputs ?? []

      if (frame.index >= inputs.length) {
        colour.set(frame.id, BLACK)
        path.pop()
        stack.pop()
        continue
      }

      const input = inputs[frame.index++]
      const next = byId.get(input.itemId)

      if (!next) {
        const existing = unresolvedMap.get(input.itemId)
        if (existing) existing.requiredBy.push(frame.id)
        else unresolvedMap.set(input.itemId, { name: input.name, requiredBy: [frame.id] })
        continue
      }

      const state = colour.get(next.id) ?? WHITE
      if (state === GREY) {
        cycles.push([...path.slice(path.indexOf(next.id)), next.id])
      } else if (state === WHITE) {
        colour.set(next.id, GREY)
        path.push(next.id)
        stack.push({ id: next.id, index: 0 })
      }
    }
  }

  return {
    cycles,
    unresolved: [...unresolvedMap].map(([itemId, v]) => ({ itemId, ...v })),
    unobtainable: all.filter((e) => e.sourceKind === 'unobtainable').map((e) => e.name),
    missingNullables: all
      .filter((entry) => entry.techLevel === undefined || entry.recipe === undefined)
      .map((entry) => entry.name),
  }
}

/** Print the report. Returns true if anything fatal was found. */
export function reportValidation(report: ValidationReport): boolean {
  let fatal = false

  if (report.cycles.length > 0) {
    fatal = true
    console.error(`\n  ✗ ${report.cycles.length} recipe cycle(s) detected:`)
    for (const cycle of report.cycles.slice(0, 10)) {
      console.error(`      ${cycle.join(' -> ')}`)
    }
    console.error('    Add a correction to scripts/import/overrides.ts.')
  }

  if (report.unresolved.length > 0) {
    // Not fatal: upstream legitimately references a few items that have no page
    // of their own. They still cost materials, so we surface them as leaves.
    console.warn(`\n  ⚠ ${report.unresolved.length} unresolved recipe input(s), e.g.:`)
    for (const u of report.unresolved.slice(0, 8)) {
      console.warn(`      ${u.name} (required by ${u.requiredBy.length} recipe(s))`)
    }
  }

  if (report.missingNullables.length > 0) {
    fatal = true
    console.error(
      `\n  ✗ ${report.missingNullables.length} entries have undefined where null is required:`,
    )
    console.error(`      ${report.missingNullables.slice(0, 8).join(', ')}`)
    console.error('    JSON.stringify drops these keys, breaking strict null checks.')
  }

  if (report.unobtainable.length > 0) {
    console.warn(`\n  ⚠ ${report.unobtainable.length} entries with no recipe and no known source.`)
  }

  return fatal
}

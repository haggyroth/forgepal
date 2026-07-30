/**
 * ForgePal data importer.
 *
 * Fetches upstream Palworld data, normalizes it into `src/types/game.ts`
 * shapes, validates it, and writes `src/data/game-data.json`.
 *
 * The output is committed to the repo on purpose: the deployed app must not
 * depend on any third-party host at runtime, and a diff on the generated file
 * makes every upstream change reviewable.
 *
 *   npm run data:import
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GameData } from '../../src/types/game.ts'
import type { BreedingData } from '../../src/types/breeding.ts'
import { normalizeBreeding } from './normalize-breeding.ts'
import { loadRawDataset } from './sources/palworld-kb.ts'
import { normalize } from './normalize.ts'
import { reportValidation, validate } from './validate.ts'

const OUT_DIR = join(import.meta.dirname, '..', '..', 'src', 'data')
const OUT_FILE = join(OUT_DIR, 'game-data.json')
// A separate file, not another key in game-data.json: the calculator chunk
// should not carry breeding data it never reads.
const BREEDING_FILE = join(OUT_DIR, 'breeding-data.json')

async function main() {
  console.log('ForgePal data import\n')

  console.log('→ loading upstream dataset')
  const raw = await loadRawDataset()

  console.log('→ normalizing')
  const data = normalize(raw)
  console.log(
    `  ${data.items.length} items, ${data.structures.length} structures, ${data.stations.length} stations`,
  )

  console.log('→ validating')
  const report = validate(data)
  if (reportValidation(report)) {
    console.error('\nImport aborted: validation failed.\n')
    process.exit(1)
  }

  const counts = data.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.sourceKind] = (acc[item.sourceKind] ?? 0) + 1
    return acc
  }, {})
  console.log(`\n  classification: ${JSON.stringify(counts)}`)

  await mkdir(OUT_DIR, { recursive: true })

  // Preserve the previous importedAt when nothing else changed, so a re-import
  // is a genuine no-op. Without this the timestamp alone rewrites the file on
  // every run, and the scheduled refresh workflow would open a PR every week
  // announcing a change that isn't one.
  const previous = await readExisting()
  const unchanged = previous !== null && isSameIgnoringTimestamp(previous, data)
  if (unchanged && previous) data.meta.importedAt = previous.meta.importedAt

  await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`)

  console.log(`\n✓ ${unchanged ? 'no change' : 'wrote'} ${OUT_FILE}`)

  await writeBreeding(raw)

  console.log(`  game version ${data.meta.gameVersion}, upstream updated ${data.meta.updated}\n`)
}

async function writeBreeding(raw: Parameters<typeof normalizeBreeding>[0]) {
  const breeding = normalizeBreeding(raw)
  const pooled = breeding.pals.filter((p) => p.inPool).length
  const { affectedPairs, totalPairs } = breeding.tieBreak
  const share = ((affectedPairs / totalPairs) * 100).toFixed(1)

  console.log(
    `  breeding: ${breeding.pals.length} pals, ${pooled} in the generic pool, ` +
      `${breeding.specialCombos.length} special combos`,
  )
  console.log(`  tie-break '${breeding.tieBreak.rule}' decides ${share}% of generic pairs`)

  // Same idempotency rule as the main dataset: preserve importedAt when nothing
  // else changed, or the weekly refresh opens a PR for a non-change.
  const previous = await readExistingBreeding()
  const unchanged = previous !== null && sameIgnoringTimestamp(previous, breeding)
  if (unchanged && previous) breeding.meta.importedAt = previous.meta.importedAt

  await writeFile(BREEDING_FILE, `${JSON.stringify(breeding, null, 2)}\n`)
  console.log(`✓ ${unchanged ? 'no change' : 'wrote'} ${BREEDING_FILE}`)
}

async function readExistingBreeding(): Promise<BreedingData | null> {
  try {
    return JSON.parse(await readFile(BREEDING_FILE, 'utf8')) as BreedingData
  } catch {
    return null
  }
}

function sameIgnoringTimestamp(a: BreedingData, b: BreedingData): boolean {
  const strip = (data: BreedingData) =>
    JSON.stringify({ ...data, meta: { ...data.meta, importedAt: '' } })
  return strip(a) === strip(b)
}

async function readExisting(): Promise<GameData | null> {
  try {
    return JSON.parse(await readFile(OUT_FILE, 'utf8')) as GameData
  } catch {
    // First run, or the file was deleted deliberately.
    return null
  }
}

/** Compare two datasets ignoring only the import timestamp. */
function isSameIgnoringTimestamp(a: GameData, b: GameData): boolean {
  const strip = (data: GameData) =>
    JSON.stringify({ ...data, meta: { ...data.meta, importedAt: '' } })
  return strip(a) === strip(b)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

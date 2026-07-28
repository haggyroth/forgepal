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

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadRawDataset } from './sources/palworld-kb.ts'
import { normalize } from './normalize.ts'
import { reportValidation, validate } from './validate.ts'

const OUT_DIR = join(import.meta.dirname, '..', '..', 'src', 'data')
const OUT_FILE = join(OUT_DIR, 'game-data.json')

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
  await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`\n✓ wrote ${OUT_FILE}`)
  console.log(`  game version ${data.meta.gameVersion}, upstream updated ${data.meta.updated}\n`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

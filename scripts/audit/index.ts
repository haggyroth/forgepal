/**
 * Data quality audit.
 *
 * Reports on the committed dataset: what we couldn't classify, what upstream
 * text we failed to interpret, and whether the curated lists in overrides.ts
 * still refer to things that exist.
 *
 * Distinct from `validate.ts`, which runs inside the importer and blocks a bad
 * import. This is a standing report you run when you want to know how good the
 * data currently is:
 *
 *   npm run data:audit
 *
 * Exits non-zero only for problems we control — a stale override, or upstream
 * text matching a pattern we claim to parse but didn't. Genuine upstream gaps
 * are reported, not treated as failures; they aren't ours to fix.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GameData, Item, SourceKind, Structure } from '../../src/types/game.ts'
import { toId } from '../../src/lib/id.ts'
import { GATHERED_MATERIALS } from '../import/overrides.ts'

const DATA_FILE = join(import.meta.dirname, '..', '..', 'src', 'data', 'game-data.json')

type Entry = Item | Structure

/** Upstream prose we claim to understand. A hit here that produced no structured data is our bug. */
const PARSEABLE_PATTERNS: { label: string; test: RegExp }[] = [
  { label: 'drop lines', test: /^Dropped by /i },
]

function heading(text: string) {
  console.log(`\n${text}\n${'─'.repeat(text.length)}`)
}

function tally<T>(items: T[], key: (item: T) => string): [string, number][] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

async function main() {
  const data: GameData = JSON.parse(await readFile(DATA_FILE, 'utf8'))
  const all: Entry[] = [...data.items, ...data.structures]
  let problems = 0

  console.log(`ForgePal data audit — Palworld ${data.meta.gameVersion}, upstream ${data.meta.updated}`)
  console.log(`${all.length} entries (${data.items.length} items, ${data.structures.length} structures)`)

  /* ---------------------------------------------------------- classification */

  heading('Classification')
  for (const [kind, count] of tally(all, (e) => e.sourceKind)) {
    const pct = ((count / all.length) * 100).toFixed(1)
    console.log(`  ${kind.padEnd(14)} ${String(count).padStart(5)}  ${pct}%`)
  }

  /* ------------------------------------------------------- unparsed upstream */

  heading('Upstream text we claim to parse but did not')
  const unparsed: { entry: string; line: string; label: string }[] = []
  for (const entry of all) {
    for (const line of entry.otherSources) {
      for (const pattern of PARSEABLE_PATTERNS) {
        if (pattern.test.test(line)) {
          unparsed.push({ entry: entry.name, line, label: pattern.label })
        }
      }
    }
  }

  if (unparsed.length === 0) {
    console.log('  none — every recognised pattern produced structured data')
  } else {
    problems += 1
    console.log(`  ✗ ${unparsed.length} line(s) matched a pattern we handle but yielded nothing:`)
    for (const item of unparsed.slice(0, 10)) {
      console.log(`      [${item.entry}] ${item.line}`)
    }
  }

  /* ------------------------------------------------------- curated overrides */

  heading('Curated lists in overrides.ts')
  const names = new Set(all.map((e) => e.name))
  const ids = new Set(all.map((e) => e.id))
  const stale = GATHERED_MATERIALS.filter((name) => !names.has(name))

  if (stale.length === 0) {
    console.log(`  GATHERED_MATERIALS — all ${GATHERED_MATERIALS.length} names match a real entry`)
  } else {
    problems += 1
    console.log(`  ✗ GATHERED_MATERIALS names matching nothing in the dataset: ${stale.join(', ')}`)
    console.log('    A name that matches nothing silently does nothing — the entry stays misclassified.')
  }

  const notGathered = GATHERED_MATERIALS.filter(
    (name) => names.has(name) && all.find((e) => e.id === toId(name))?.sourceKind !== 'gathered',
  )
  if (notGathered.length > 0) {
    problems += 1
    console.log(`  ✗ listed as gathered but classified otherwise: ${notGathered.join(', ')}`)
  }

  /* --------------------------------------------------------- internal wiring */

  heading('Internal consistency')
  const collisions = data.structures.filter((s) => data.items.some((i) => i.id === s.id))
  console.log(
    collisions.length === 0
      ? '  no id collisions between items and structures'
      : `  ⚠ ${collisions.length} id collision(s) — the structure wins in buildIndex: ${collisions
          .map((c) => c.name)
          .join(', ')}`,
  )

  const missingStations = new Set<string>()
  const stationIds = new Set(data.stations.map((s) => s.id))
  for (const entry of all) {
    const id = entry.recipe?.stationId
    if (id && !stationIds.has(id)) missingStations.add(entry.recipe?.stationName ?? id)
  }
  console.log(
    missingStations.size === 0
      ? '  every recipe station resolves to a known station'
      : `  ⚠ ${missingStations.size} station(s) referenced but absent from the station list: ${[...missingStations].slice(0, 6).join(', ')}`,
  )

  const badDrops = all.flatMap((e) =>
    e.drops
      .filter((d) => d.chance !== null && (d.chance <= 0 || d.chance > 1))
      .map((d) => `${e.name} <- ${d.source} (${d.chance})`),
  )
  console.log(
    badDrops.length === 0
      ? '  all known drop chances fall within (0, 1]'
      : `  ✗ ${badDrops.length} drop chance(s) out of range: ${badDrops.slice(0, 5).join(', ')}`,
  )
  if (badDrops.length > 0) problems += 1

  const unknownRate = all.flatMap((e) => e.drops.filter((d) => d.chance === null))
  console.log(`  ${unknownRate.length} drop source(s) have an unknown rate, recorded as null`)

  const orphanInputs = new Set<string>()
  for (const entry of all) {
    for (const input of entry.recipe?.inputs ?? []) {
      if (!ids.has(input.itemId)) orphanInputs.add(input.name)
    }
  }
  console.log(
    orphanInputs.size === 0
      ? '  every recipe input resolves to a known entry'
      : `  ✗ ${orphanInputs.size} unresolved recipe input(s): ${[...orphanInputs].slice(0, 6).join(', ')}`,
  )
  if (orphanInputs.size > 0) problems += 1

  /* ------------------------------------------------------------ upstream gaps */

  heading('Entries with no known source (upstream gaps)')
  const unobtainable = all.filter((e) => e.sourceKind === 'unobtainable')
  const silent = unobtainable.filter((e) => e.otherSources.length === 0)
  const withText = unobtainable.filter((e) => e.otherSources.length > 0)

  console.log(`  ${unobtainable.length} entries classified unobtainable`)
  console.log(`    ${silent.length} have no source text at all — nothing to work with`)
  console.log(`    ${withText.length} have text we chose not to interpret`)

  if (withText.length > 0) {
    console.log('\n  Most common uninterpreted phrases:')
    const phrases = withText.flatMap((e) => e.otherSources)
    for (const [phrase, count] of tally(phrases, (p) =>
      p.replace(/\([^)]*\)/g, '').replace(/\s*-\s*.*$/, '').trim().slice(0, 46),
    ).slice(0, 8)) {
      console.log(`    ${String(count).padStart(4)}  ${phrase}`)
    }
  }

  console.log('\n  By category:')
  for (const [category, count] of tally(unobtainable, (e) => e.category).slice(0, 8)) {
    console.log(`    ${String(count).padStart(4)}  ${category}`)
  }

  if (data.meta.gaps.length > 0) {
    console.log('\n  Gaps upstream documents itself:')
    for (const gap of data.meta.gaps) console.log(`    • ${gap.slice(0, 150)}`)
  }

  /* ------------------------------------------------------------------ verdict */

  heading('Verdict')
  const coverage = (((all.length - unobtainable.length) / all.length) * 100).toFixed(1)
  console.log(`  ${coverage}% of entries have a known source or recipe`)

  const byKind = new Map<SourceKind, number>(tally(all, (e) => e.sourceKind) as [SourceKind, number][])
  console.log(`  ${byKind.get('craftable') ?? 0} craftable, ${byKind.get('drop') ?? 0} dropped, ${byKind.get('gathered') ?? 0} gathered, ${byKind.get('merchant') ?? 0} vendor-only`)

  if (problems > 0) {
    console.log(`\n✗ ${problems} issue(s) within our control. See above.\n`)
    process.exit(1)
  }
  console.log('\n✓ No issues within our control. Remaining gaps are upstream.\n')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

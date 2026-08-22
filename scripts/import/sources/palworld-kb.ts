/**
 * Source adapter: beliarance/palworld-kb.
 *
 * This is the only file that knows the upstream JSON shape. To add another data
 * source (e.g. a .pak extractor), write a sibling adapter that returns the same
 * `RawDataset` and swap it in `scripts/import/index.ts` — nothing else changes.
 *
 * See NOTICE.md for attribution and the open licensing question.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const REPO = 'beliarance/palworld-kb'

/**
 * Pinned to a commit, not a branch.
 *
 * `main` used to be the ref, which meant the weekly refresh workflow ingested
 * whatever upstream said at that moment and a re-run months later could not
 * reproduce the committed dataset. Upstream is a third-party scrape that
 * publishes no license and offers no stability guarantee, so "whatever is there
 * now" is not a defensible input to an unattended job holding `contents: write`.
 *
 * Pinning also *is* the integrity check. `raw.githubusercontent.com` at a commit
 * sha is content-addressed — the bytes cannot change under a fixed ref without
 * breaking git's own hashing — so a separate per-file checksum would restate
 * the same guarantee rather than add one.
 *
 * Bumping this is a reviewed change, like the dataset it produces.
 * `.github/workflows/data-refresh.yml` proposes the bump and the regenerated
 * data together, in one PR, so the upstream change is reviewable rather than
 * only its downstream effect.
 */
const REF = 'cf9ecbe832e3a2a9e2d78d6579a082d968b68f17'

const BASE = `https://raw.githubusercontent.com/${REPO}/${REF}/data`

/** Give up rather than hang the scheduled job until GitHub's 6-hour limit. */
const FETCH_TIMEOUT_MS = 30_000

/**
 * Cached downloads so repeated import runs don't hammer GitHub. Git-ignored.
 *
 * Keyed by the pinned ref, which makes invalidation automatic and correct: the
 * cache is only ever consulted for the exact upstream commit it was fetched
 * from, and bumping REF misses cleanly.
 *
 * The previous flat `.cache/` never expired, so on any machine that had run the
 * importer once, `npm run data:import` stopped fetching entirely — it re-read
 * six local files and reported success, including the reassuring `no change`
 * idempotency message. CI always fetched because it starts from a clean
 * checkout, so local and CI silently disagreed.
 */
const CACHE_DIR = join(import.meta.dirname, '.cache', REF)

export interface RawRecipe {
  station: string | null
  materials: Record<string, number>
}

export interface RawItem {
  name: string
  category: string
  /** Optional: a few entries omit the key entirely rather than sending null. */
  tech_level?: number | null
  recipe: RawRecipe | null
  obtained_from?: string[]
  /** Free-text, e.g. "Crafts x10 per batch; Also craftable at: Improved Furnace". */
  notes?: string
}

export interface RawStation {
  name: string
  crafts: string | null
  tech_level: number | null
}

export interface RawStructure {
  name: string
  /** Optional: a few entries omit the key entirely rather than sending null. */
  tech_level?: number | null
  ancient_tech: boolean
  materials: Record<string, number>
  /** Work suitability required to operate it, e.g. "Kindling". */
  workers: string | null
  capacity: string | null
  power: boolean
  function: string | null
  worker_slots: number | null
}

export interface RawSourceRef {
  url: string
  what: string
  fetched: string
}

export interface RawItemsFile {
  game_version: string
  updated: string
  items: RawItem[]
  stations: RawStation[]
  notes?: string[]
  gaps?: string[]
  sources?: RawSourceRef[]
}

export interface RawBuildingFile {
  game_version: string
  updated: string
  structures: RawStructure[]
  notes?: string[]
  gaps?: string[]
  sources?: RawSourceRef[]
}

export interface RawPalLocation {
  regions?: string[] | null
  /** Only ever "both", "night", or absent — upstream never records "day". */
  day_night?: string | null
  alpha_locations?: string[] | null
  egg_types?: string[] | null
  other_sources?: string[] | null
}

export interface RawLocationsFile {
  game_version: string
  updated: string
  pals: Record<string, RawPalLocation>
  gaps?: string[]
  sources?: RawSourceRef[]
}

export interface RawShopLocation {
  area?: string | null
  coordinates?: string | null
  level?: number | null
}

export interface RawShop {
  merchant: string
  currency?: string | null
  locations?: RawShopLocation[] | null
  items?: { name: string; price?: number | null }[] | null
}

export interface RawMerchantsFile {
  game_version: string
  updated: string
  shops: Record<string, RawShop>
  gaps?: string[]
  sources?: RawSourceRef[]
}

export interface RawMission {
  name: string
  duration_hours?: number | null
  difficulty?: string | null
  required_firepower?: number | null
  rewards?: { item: string; quantity?: string | number | null; chance?: string | null }[] | null
}

export interface RawExpeditionsFile {
  game_version: string
  updated: string
  missions: RawMission[]
  gaps?: string[]
  sources?: RawSourceRef[]
}

export interface RawSpecialCombo {
  parent_a: string
  parent_b: string
  child: string
}

export interface RawBreedingFile {
  game_version: string
  updated: string
  /** Every Pal's hidden CombiRank, keyed by display name. */
  combi_ranks: Record<string, number>
  special_combos: RawSpecialCombo[]
  formula?: string
  notes?: string[]
  gaps?: string[]
  sources?: RawSourceRef[]
}

export interface RawDataset {
  items: RawItemsFile
  building: RawBuildingFile
  locations: RawLocationsFile
  merchants: RawMerchantsFile
  expeditions: RawExpeditionsFile
  breeding: RawBreedingFile
}

async function fetchCached<T>(file: string): Promise<T> {
  await mkdir(CACHE_DIR, { recursive: true })
  const cachePath = join(CACHE_DIR, file)

  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf8')) as T
    // Say so. A fully cached run used to print nothing at all about where its
    // data came from, and absence is not something anyone notices.
    console.log(`  cached   ${file}`)
    return cached
  } catch {
    // Cache miss is the normal path on a clean checkout; fall through to network.
  }

  const url = `${BASE}/${file}`
  console.log(`  fetching ${url}`)
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  await writeFile(cachePath, text)
  return JSON.parse(text) as T
}

export async function loadRawDataset(): Promise<RawDataset> {
  const [items, building, locations, merchants, expeditions, breeding] = await Promise.all([
    fetchCached<RawItemsFile>('items.json'),
    fetchCached<RawBuildingFile>('base_building.json'),
    fetchCached<RawLocationsFile>('pal_locations.json'),
    fetchCached<RawMerchantsFile>('merchants.json'),
    fetchCached<RawExpeditionsFile>('expeditions.json'),
    fetchCached<RawBreedingFile>('breeding.json'),
  ])
  return { items, building, locations, merchants, expeditions, breeding }
}

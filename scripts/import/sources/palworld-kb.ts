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
const REF = 'main'
const BASE = `https://raw.githubusercontent.com/${REPO}/${REF}/data`

/** Cached downloads so repeated import runs don't hammer GitHub. Git-ignored. */
const CACHE_DIR = join(import.meta.dirname, '.cache')

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

export interface RawDataset {
  items: RawItemsFile
  building: RawBuildingFile
}

async function fetchCached<T>(file: string): Promise<T> {
  await mkdir(CACHE_DIR, { recursive: true })
  const cachePath = join(CACHE_DIR, file)

  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as T
  } catch {
    // Cache miss is the normal path on a clean checkout; fall through to network.
  }

  const url = `${BASE}/${file}`
  console.log(`  fetching ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  await writeFile(cachePath, text)
  return JSON.parse(text) as T
}

export async function loadRawDataset(): Promise<RawDataset> {
  const [items, building] = await Promise.all([
    fetchCached<RawItemsFile>('items.json'),
    fetchCached<RawBuildingFile>('base_building.json'),
  ])
  return { items, building }
}

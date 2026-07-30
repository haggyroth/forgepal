/**
 * Normalized ForgePal game-data schema.
 *
 * These types describe the shape of the JSON in `src/data/`, which is generated
 * by `scripts/import/`. They are deliberately decoupled from any upstream
 * source's schema — the importer's job is to translate into these types, so
 * swapping data sources never ripples into the app.
 */

/** Stable identifier derived from an entry's display name (e.g. "Mega Sphere" -> "mega-sphere"). */
export type ItemId = string

/** Where an item sits in the game's own categorization. */
export type ItemCategory =
  | 'material'
  | 'ingredient'
  | 'consumable'
  | 'medicine'
  | 'weapon'
  | 'armor'
  | 'accessory'
  | 'ammo'
  | 'sphere'
  | 'structure'
  | 'key_item'
  | 'technology'
  | 'other'

/**
 * How ForgePal treats an entry when expanding a recipe tree.
 *
 * - `craftable` — has a recipe; expand it.
 * - `gathered`  — harvested from the world: mined, chopped, farmed, looted from
 *                 chests, or picked up as a wild egg. Leaf node.
 * - `drop`      — obtained from Pals/mobs (Leather, Wool, Bone). Leaf node.
 * - `merchant`  — only purchasable from a vendor. Leaf node.
 * - `unobtainable` — no known recipe and no known source; leaf node, flagged in the UI.
 */
export type SourceKind = 'craftable' | 'gathered' | 'drop' | 'merchant' | 'unobtainable'

/** Pal work suitability required to operate a crafting station. */
export type WorkSuitability =
  | 'Kindling'
  | 'Watering'
  | 'Planting'
  | 'Generating Electricity'
  | 'Handiwork'
  | 'Gathering'
  | 'Lumbering'
  | 'Mining'
  | 'Medicine Production'
  | 'Cooling'
  | 'Transporting'
  | 'Farming'

/** One material requirement inside a recipe. */
export interface RecipeInput {
  /** Id of the required item. May reference an item that has no entry of its own. */
  itemId: ItemId
  /** Display name as it appeared upstream, kept for unresolved references. */
  name: string
  /** Units required to produce one batch (see `Recipe.yield`). */
  quantity: number
}

export interface Recipe {
  /** Lowest-tier station that crafts this, e.g. "Primitive Workbench". Null for base structures. */
  stationId: ItemId | null
  stationName: string | null
  /** Higher-tier stations that also craft it, e.g. an Improved Furnace for Ingots. */
  alternativeStationNames: string[]
  /** Materials consumed per craft. */
  inputs: RecipeInput[]
  /**
   * Units produced per craft. Usually 1, but ammo and similar craft in batches
   * (Arrow is x10) — the calculator divides by this and rounds up.
   */
  yield: number
}

/** A Pal, mob, or NPC that drops a material, with the observed rate. */
export interface DropSource {
  /** Name of the Pal / mob / NPC. */
  source: string
  /** Quantity range per kill or capture, e.g. [1, 3]. */
  quantity: [number, number]
  /**
   * Drop chance as a fraction in [0, 1], or null when upstream records the rate
   * as unknown (written `(?)`). Null means "this drops, rate unknown" — it is
   * not the same as a zero chance, and must not be rendered as 0%.
   */
  chance: number | null
}

export interface Item {
  id: ItemId
  name: string
  category: ItemCategory
  sourceKind: SourceKind
  /** Technology tree level required to unlock, if any. */
  techLevel: number | null
  /** Primary recipe used by the calculator. Null when the item cannot be crafted. */
  recipe: Recipe | null
  /**
   * Other valid ways to craft this (e.g. the Crusher turns either Stone *or*
   * Ore into Paldium Fragment). Not yet used by the calculator — see ROADMAP.
   * Kept separate from `recipe` because collapsing alternatives into one
   * ingredient list turns an OR into an AND and produces nonsense totals.
   */
  alternativeRecipes: Recipe[]
  /** Pals/mobs that drop this. Populated for `drop` leaves, but craftables can have them too. */
  drops: DropSource[]
  /** Free-text acquisition notes that did not parse into structured drops (merchants, chests). */
  otherSources: string[]
}

/** A base structure. Structures share the item pipeline but carry build-specific fields. */
export interface Structure extends Item {
  category: 'structure'
  /** Work suitability needed to operate it, if it is a worked station. */
  workSuitability: WorkSuitability | null
  /** Whether it draws power. */
  requiresPower: boolean
  /** In-game description of what it does. */
  description: string | null
  /** Whether it needs Ancient Technology Points rather than ordinary tech points. */
  ancientTech: boolean
}

/** A crafting station, referenced by `Recipe.stationId`. */
export interface Station {
  id: ItemId
  name: string
  /** Primary category of item this station produces. */
  crafts: string | null
  techLevel: number | null
  /** Work suitability of the Pals that speed it up. Null if hand-crafted only. */
  workSuitability: WorkSuitability | null
}

/** Provenance for the generated dataset — surfaced in the UI so data age is never a mystery. */
export interface DatasetMeta {
  /** Palworld version the data describes, e.g. "1.0". */
  gameVersion: string
  /** ISO date the upstream data was last updated. */
  updated: string
  /** ISO timestamp of our import run. */
  importedAt: string
  /** Human-readable upstream attribution. */
  sources: string[]
  /** Known omissions carried forward from upstream. */
  gaps: string[]
}

/**
 * Where a Pal lives, so a drop table can become a route.
 *
 * Keyed by the Pal's display name, which is what `DropSource.source` carries.
 * Note that many drop sources are humans and NPCs (Syndicate Thug, Villager)
 * rather than Pals, so a lookup miss is normal and not an error.
 */
export interface PalHabitat {
  name: string
  /** Named map regions where it spawns. Empty for Pals with no wild spawn. */
  regions: string[]
  /**
   * `night` means night-only, `both` means any time, null means upstream
   * doesn't say. There is deliberately no `day` — upstream never records one,
   * so inventing the value would imply knowledge we don't have.
   */
  dayNight: 'night' | 'both' | null
}

/** A vendor that sells an item, and what they want for it. */
export interface MerchantListing {
  merchant: string
  /** Gold Coin, Battle Ticket, Medal, and so on — not every vendor takes gold. */
  currency: string
  /**
   * Null when upstream records no price — which is the majority case, 476 of
   * 587 listings. "This vendor stocks it" is useful on its own, so the listing
   * is kept rather than discarded for lacking a number.
   */
  price: number | null
  /** Where to find them, e.g. "Arena (631, 16)". */
  locations: string[]
}

/** An expedition that can return an item. */
export interface ExpeditionReward {
  mission: string
  durationHours: number | null
  requiredFirepower: number | null
  /** Free text, e.g. "5-7" — upstream records ranges, not single values. */
  quantity: string
  /** Free text, e.g. "40%". Null when upstream doesn't record one. */
  chance: string | null
}

export interface GameData {
  meta: DatasetMeta
  items: Item[]
  structures: Structure[]
  stations: Station[]
  /** Pal habitats, for turning drop tables into a farming route. */
  habitats: PalHabitat[]
  /** Vendor listings, keyed by item id. */
  merchantListings: Record<ItemId, MerchantListing[]>
  /** Expedition rewards, keyed by item id. Upstream's item pages omit these. */
  expeditionRewards: Record<ItemId, ExpeditionReward[]>
}

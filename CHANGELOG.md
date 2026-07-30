# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-07-29

### Added

- feat(ui): every panel is collapsible — Catalogue, Build list, Requisition, Craft along the way, Farming route, Requirements, and Breakdown. Collapsed panels keep their summary visible (`8 to gather`, `4 across 23 regions`), so a fully collapsed page is still skimmable
- feat(ui): collapse state persists across reloads, per section

### Changed

- feat(ui): Breakdown now starts collapsed. It is the most verbose panel and its per-branch figures deliberately duplicate the Requisition, so it is the one section worth hiding by default. Every other panel is unchanged and still opens
- refactor(ui): replaced the ad-hoc `Panel` + `SectionHeading` pairing, which each component assembled slightly differently, with a single `Section` component owning the heading, toggle, persistence, and ARIA wiring

### Notes

- Collapse state is deliberately **not** encoded in the shareable URL. It is a personal view preference; putting it in the link would impose the sender's layout on the recipient and pollute every shared build
- Collapsed content is unmounted rather than hidden with CSS — the Breakdown tree and the 1,300-entry catalogue are the expensive things on the page

## [1.1.0] — 2026-07-29

### Added

- feat(route): farming route panel — inverts the requisition to group dropped materials by the map region where the Pals that drop them live, ranked by how much of the list each region covers. Gathered materials are listed as needing no route, and materials whose sources have no wild spawn (bosses, humans, legendaries) are called out rather than omitted
- feat(sourcing): each raw material now shows where its Pals live, which vendors stock it, and which expeditions return it — so the requisition offers alternatives to farming
- chore(data): import `pal_locations.json`, `merchants.json`, and `expeditions.json`. Expedition rewards are sourcing information upstream's item pages omit entirely

### Changed

- docs: added the ForgePal logo to the top of the README, linked to the live site. Losslessly recompressed 558 kB → 483 kB; not part of the app bundle
- chore(deps): bump `actions/checkout` v4→v7, `actions/setup-node` v4→v7, `github/codeql-action` v3→v4. Also clears the Node 20 deprecation warning every workflow run was emitting
- chore(deps): bump `actions/configure-pages` v5→v6, `actions/upload-pages-artifact` v3→v5, `actions/deploy-pages` v4→v5. Split from the above because these run only on `main`, so pull-request CI cannot exercise them
- chore(ci): `main` is fully protected — a pull request with green CI, CodeQL, and code-scanning checks is required for every change, with `enforce_admins` on so it cannot be bypassed. Force pushes and branch deletion blocked
- docs: the version bump and doc updates now go *in* the branch rather than as a follow-up commit on `main`, which admin enforcement makes impossible. One PR per change, with the version and its changelog entry landing atomically alongside the code

## [1.0.1] — 2026-07-28

### Fixed

- fix(export): escape backslashes before pipes in Markdown table cells. Escaping only pipes turned `Odd\|Name` into `Odd\\|Name`, which Markdown reads as an escaped backslash followed by a *live* pipe, silently splitting the column. Latent — no current item name contains a backslash — but the dataset is regenerated from a scraped upstream. Found by CodeQL's first run on `main`

## [1.0.0] — 2026-07-28

First stable release. ForgePal does what it was built to do: queue any mix of Palworld items and structures, and get one consolidated list of everything you actually need to gather, with the Pals that drop it.

### Added

- test: component, hook, and `App` coverage — 145 → 237 tests
- test: static guard on Tailwind utility usage. Catches undefined theme tokens (`bg-forge-900`) and numeric font weights (`font-600`), neither of which is reachable by a render test because jsdom applies no CSS and Tailwind emits nothing for an unknown utility
- chore(ci): Dependabot for npm and GitHub Actions, grouped by concern, majors ignored
- chore(ci): CodeQL analysis on push, pull request, and weekly
- chore(ci): scheduled weekly upstream data refresh (`.github/workflows/data-refresh.yml`). Re-imports and opens a PR only when the output actually changes; never commits to `main`

### Fixed

- fix(state): a shared link whose item ids had *all* been dropped from the dataset decoded to an empty state, so the fallback to saved state discarded the report of what was skipped — the case most needing an explanation was the one giving none
- fix(data): the importer is now idempotent. `meta.importedAt` was stamped on every run, so the output file always differed even when upstream had not changed — the refresh workflow would have opened a noise PR every week

### Changed

- docs: recorded the upstream licensing position in `NOTICE.md` — asking `palworld-kb` for an explicit license was drafted and deliberately shelved, with the reasoning and revisit conditions written down

## [0.6.1] — 2026-07-28

### Added

- chore(data): `npm run data:audit`, a standing data-quality report covering classification coverage, unparsed upstream text, stale curated overrides, and internal consistency. Runs in CI, failing only on problems within our control
- feat(data): `merchant` source kind for vendor-only entries

### Fixed

- fix(data): the drop parser required a numeric percentage, silently discarding 108 `Dropped by <Boss> (?)` lines — every bounty token in the game lost its source. `DropSource.chance` is now `number | null`
- fix(data): a literal `(0%)` drop rate is recorded as unknown rather than zero; rendering "0%" implied the item never drops
- fix(data): `GATHERED_MATERIALS` listed `Quartz` and `Sulfuric Acid Bottle`, neither of which exists in the game. The dead `Quartz` entry had let Pure Quartz be classified as a drop despite upstream recording "Mining quartz nodes"
- fix(data): treasure chests, wild egg spawns, and merchant sales now count as real sources. `unobtainable` falls from 319 to 111 — coverage 75.8% → 91.6%

## [0.6.0] — 2026-07-28

### Added

- feat(state): the build list and tech level persist across reloads via localStorage
- feat(state): shareable URLs — state encodes into the query string as `?build=mega-sphere.20_arrow.15&level=25`, with a "copy link" action in the build-list header
- feat(state): a link naming items no longer in the dataset reports what it skipped instead of silently showing a shorter list

### Notes

- The wire format uses item ids rather than array indices, so links stay correct across dataset regeneration; `.` and `_` are safe separators given ids are `[a-z0-9-]`, keeping URLs readable
- A URL takes precedence over saved state, so following a link shows that build rather than restoring your own over it
- `clear all` keeps your tech level, which describes your save rather than the build list
- Storage key is versioned (`forgepal:build:v1`) to allow a clean migration later

## [0.5.0] — 2026-07-28

### Added

- feat(tech): tech level input in the header; entries above it are flagged with a lock in the catalogue, and an "unlocked only" filter hides them
- feat(tech): Requirements panel listing every crafting station a build needs — most advanced first, with tech level and Pal work suitability — plus a warning naming queued items that aren't unlocked yet, and a flag for Ancient Technology
- feat(ui): filter the catalogue by crafting station

### Fixed

- fix(data): three entries (`WoodCreator`, `Ancient Turret`, `Ancient Air Conditioner`) shipped with no `techLevel` key at all, because `JSON.stringify` drops `undefined` — despite the type declaring `number | null`. The importer now coerces to null, and validation fails the import if any nullable field is `undefined`

### Notes

- Technology *levels* are shown but not point costs; upstream records no point data

## [0.4.0] — 2026-07-28

### Added

- feat(export): export the build list as Markdown, either copied to the clipboard or downloaded as a `.md` file. Raw materials include a "where to get it" column naming the best Pal drop sources

### Notes

- `.xlsx` export was implemented and deliberately backed out: `xlsx-js-style` adds ~863 kB to the bundle for a format Markdown already covers, and its cell styling did not survive a write/read round-trip. Deferred to ROADMAP with that context; the export model is format-agnostic, so resuming needs only a renderer

## [0.3.0] — 2026-07-28

### Added

- feat(ui): show the Pal work suitability needed to operate each crafting station, e.g. `Improved Furnace · Kindling`, on build-list rows and in the intermediates panel
- feat(ui): flag structures that require power

### Fixed

- fix(ui): structures were labelled "no recipe" because they have no crafting station — they are placed from the build menu. Rows now read `Build menu · worked by Kindling · needs power`

## [0.2.1] — 2026-07-28

### Fixed

- fix(data): stop free-text prose hints from outvoting parsed drop sources during import. The gathering-hint `farm` matched `Ranch: Flambelle (Farming)` — where "Farming" is a Pal work suitability — and the prose check ran ahead of the structured-drop check, so one substring match outweighed 45 parsed drop entries. Reclassifies 17 entries including Wool, Egg, Milk, Honey, Flame Organ, and the Ancient Relics; material totals are unaffected, but drop sources are now available for those materials

### Added

- test: unit coverage for the importer's drop-line, batch-yield, and station parsing, plus classification precedence. Vitest now includes `scripts/`

## [0.2.0] — 2026-07-28

### Added

- feat(ui): catalogue with ranked search, category filters, and a craftable-only toggle
- feat(ui): build list supporting any number of items and structures at arbitrary quantities
- feat(ui): requisition panel listing raw materials, with Pal/mob drop sources expandable per material and sorted by drop chance
- feat(ui): intermediates panel showing each sub-component and the station that crafts it
- feat(ui): per-item recipe breakdown tree
- feat(ui): batch-yield maths shown per build-list row, e.g. `2 × 10 = 20, 5 spare` for 15 Arrows
- chore: bundle Chakra Petch and IBM Plex Mono via `@fontsource`, preserving the app's no-runtime-network-calls property

## [0.1.0] — 2026-07-28

### Added

- chore: initialize repository with MIT license, `.gitignore`, README, and data attribution notice
- chore: scaffold React 19 + TypeScript + Vite 8 + Tailwind 4 application
- chore: data importer (`npm run data:import`) with a pluggable source adapter, normalization to an internal schema, curated overrides, and cycle/reference validation
- chore: recipe expansion engine with topological demand aggregation, batch-yield rounding, and defensive cycle handling
- chore: 21 unit tests, including a suite that runs against the committed dataset to catch bad imports
- chore: CI workflow (lint, test, build) and GitHub Pages deployment workflow

### Changed

- chore: rename the repository and npm package from `palforge` to `forgepal`, matching the product name. Updates the GitHub Pages base path, which every production asset URL depends on

### Fixed

- chore(data): correct upstream recipes where alternative crafting paths were flattened into a single AND-list, which produced impossible material costs and 15 recipe cycles. Affects Paldium Fragment and the four Pal Soul tiers
- chore(data): read batch yields from upstream free-text notes, so batch recipes such as Arrow (x10 per craft) no longer overstate materials by an order of magnitude

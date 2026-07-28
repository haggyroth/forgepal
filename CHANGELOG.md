# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

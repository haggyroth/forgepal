# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

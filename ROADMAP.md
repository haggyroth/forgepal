# Roadmap

## Now — core calculator

- [x] Project scaffold, CI, GitHub Pages deploy
- [x] Data importer with validation and curated overrides
- [x] Recursive expansion engine with batch-yield handling
- [x] Item browser — searchable, filterable by category
- [x] Build list — add items and structures at arbitrary quantities
- [x] Totals panel — targets, intermediates, and the raw shopping list
- [x] Expandable recipe tree per item
- [x] Drop sourcing UI — "where do I farm this?" for `drop` leaves
- [x] Crafting station display, with batch-yield maths shown per build-list row
- [x] Pal work suitability shown for stations and structures, plus a power flag
- [x] Filter the catalogue by tech level and by crafting station
- [x] Technology gating — lock indicators, an "unlocked only" filter, and a Requirements panel listing the stations a build needs

## Next — exports

- [x] Export build list to Markdown (download, and copy to clipboard)
- [ ] **Export build list to `.xlsx`** — deferred. A working implementation using
      `xlsx-js-style` was built and backed out: the library adds ~863 kB to the
      bundle for a format Markdown already covers, and cell styling did not
      survive a write/read round-trip. Revisit with a lighter writer, or emit
      CSV instead. `buildExportModel` is already format-agnostic, so only a
      renderer is needed.

## Later — deferred from v1 scope

These were considered for v1 and consciously deferred, not dropped.

- [x] **Shareable URL state** — the build list and tech level encode into the URL, with a copy-link action
- [x] **Persistence** — the build list survives a reload via localStorage
- [ ] **Inventory offset** — enter what you already have, see only the net remainder
- [ ] **Tech point costs** — the dataset carries technology *levels* but no point costs, because upstream doesn't record them. Would need another source
- [ ] **Alternative recipe selection** — `alternativeRecipes` is populated but unused. Let the user choose the Crusher path for Paldium, a higher-tier station, or a soul downgrade
- [ ] Save *named* build lists, so several can be kept side by side (single-build persistence is done)

## Data quality

- [ ] **Resolve the upstream licensing question** (see [NOTICE.md](NOTICE.md)) — ask `palworld-kb` to add an explicit license, or remove the dependency
- [ ] **`.pak` source adapter** — let users with the game generate data from their own install, removing the third-party dependency
- [ ] Audit the 318 entries classified `unobtainable` — mostly quest/key items, but some may be miscategorized
- [ ] Verify the curated `GATHERED_MATERIALS` list against in-game reality; it is currently hand-written
- [ ] Automated upstream-refresh check (scheduled workflow that runs the importer and opens a PR on a diff)

## Technical debt

- [ ] **Bundle size** — the 1.5 MB dataset inlines into the JS bundle (~1 MB minified, 144 kB gzipped). Split it out and fetch it as a static asset, or trim unused fields at import time
- [ ] Component tests once there are components to test
- [ ] Consider indexing items by category/station at import time rather than filtering at runtime

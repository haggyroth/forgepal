# Roadmap

## Now — core calculator

- [x] Project scaffold, CI, GitHub Pages deploy
- [x] Data importer with validation and curated overrides
- [x] Recursive expansion engine with batch-yield handling
- [ ] Item browser — searchable, filterable by category, tech level, and station
- [ ] Build list — add items and structures at arbitrary quantities
- [ ] Totals panel — targets, intermediates, and the raw shopping list
- [ ] Expandable recipe tree per item
- [ ] Drop sourcing UI — "where do I farm this?" for `drop` leaves
- [ ] Crafting station + Pal work suitability display

## Next — exports

- [ ] Export build list to Markdown
- [ ] Export build list to `.xlsx`

## Later — deferred from v1 scope

These were considered for v1 and consciously deferred, not dropped.

- [ ] **Shareable URL state** — encode the build list in the URL
- [ ] **Inventory offset** — enter what you already have, see only the net remainder
- [ ] **Tech tree info** — required technology level and points; flag items not yet unlockable
- [ ] **Alternative recipe selection** — `alternativeRecipes` is populated but unused. Let the user choose the Crusher path for Paldium, a higher-tier station, or a soul downgrade
- [ ] Save named build lists to localStorage

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

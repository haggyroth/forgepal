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

## Next — new feature areas

The upstream dataset has 19 files; we now use 5. These are the two worth building
next, both grounded in data already published by the same source.

- [ ] **Breeding path solver** — `breeding.json` carries the full CombiRank
      formula plus all 299 ranks and 164 special combos, so results are
      _computable_, not just searchable:
      `target = floor((rankA + rankB + 1) / 2)`, nearest rank wins, ties break
      to the higher rank. Every existing calculator answers "A + B = ?"; the gap
      is the inverse over _your_ roster — "I own these six Pals, I want a
      Jetragon, what's the shortest chain?" That's graph search over a
      deterministic relation, structurally the same problem as recipe expansion.
      Note the data's own `gaps` field flags conflicting documentation on the
      tie-break rule, so surface uncertainty on exact ties rather than
      pretending it's settled.
- [ ] **Base production planner** — `base_building.json` already carries
      `worker_slots`, `workers` (suitability), `power`, and `energy_per_sec`, and
      we import the file while using almost none of it. Upgrades Requirements
      from "which stations" to "how many stations, how many Pals, which
      suitabilities, how much power."

**Deliberately not building: a server/world-settings config creator.** Those
settings live in `PalWorldSettings.ini`, which isn't in this dataset at all. It
is a form builder rather than a calculator, so it shares no engine, no data
pipeline, and no audit tooling with anything here — and several tools already do
it well. It belongs in its own repo, not this one.

## Later — deferred from v1 scope

These were considered for v1 and consciously deferred, not dropped.

- [x] **Shareable URL state** — the build list and tech level encode into the URL, with a copy-link action
- [x] **Persistence** — the build list survives a reload via localStorage
- [ ] **Inventory offset** — enter what you already have, see only the net remainder
- [ ] **Tech point costs** — the dataset carries technology _levels_ but no point costs, because upstream doesn't record them. Would need another source
- [ ] **Alternative recipe selection** — `alternativeRecipes` is populated but unused. Let the user choose the Crusher path for Paldium, a higher-tier station, or a soul downgrade
- [ ] Save _named_ build lists, so several can be kept side by side (single-build persistence is done)

## Data quality

- [x] **Upstream licensing position settled** — asking `palworld-kb` for an explicit license was drafted and deliberately shelved; a refusal would be worse than the current ambiguity. Reasoning and the conditions that should trigger a revisit are recorded in [NOTICE.md](NOTICE.md)
- [ ] **`.pak` source adapter** — let users who own the game generate data from their own install. Also the preferred long-term answer to the licensing question, since it removes the third-party dependency rather than negotiating it
- [x] **Audit the entries classified `unobtainable`** — cut 319 → 111 by parsing drop lines with unknown rates and by treating treasure chests, wild egg spawns, and merchant sales as real sources. Coverage is now 91.6%. Repeatable via `npm run data:audit`, which also runs in CI
- [x] **Verify the curated `GATHERED_MATERIALS` list** — found two names matching nothing (`Quartz`, `Sulfuric Acid Bottle`), which had let Pure Quartz regress to `drop`. The audit now fails on any stale entry
- [ ] The remaining 111 entries have no source text upstream at all (Ancient Bark, Ancient Bone, Animal Skin, …). `palworld-kb` documents these as its own gaps — filling them needs a second data source
- [x] **Automated upstream-refresh check** — `.github/workflows/data-refresh.yml` re-imports weekly and opens a PR only when the output actually changes. Required making the importer idempotent

## Technical debt

- [ ] **Bundle size** — the 1.8 MB dataset inlines into the JS bundle (~1.22 MB minified, 163 kB gzipped), up from 1 MB after adding habitat, merchant, and expedition data. Split it out and fetch it as a static asset, or trim unused fields at import time. This is now the largest single piece of debt
- [x] **Component tests** — every component, the build-list hook, and `App`, plus a static guard on Tailwind utility usage that catches the class of bug render tests structurally cannot
- [ ] Consider indexing items by category/station at import time rather than filtering at runtime

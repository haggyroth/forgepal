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
      _Phase 1 done_ — `breeding-data.json`, pool derivation, tie-break measured
      at 31.4% of generic pairs.
      _Phase 2 done_ — `src/lib/breeding.ts`: `breed`, `parentsFor`, and a BFS
      `solve` returning the fewest-generation chain, every step flagged when it
      hinged on the contested tie-break.
      _Phase 3 done_ — tab shell with `?tab=` routing; the breeding tab and its
      dataset load lazily.
      _Remaining_ — the breeding UI: pair calculator, roster, and the solved
      chain with tie-broken steps marked.
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
- [x] **Inventory offset** — a `have` field on every material. Applied during demand propagation rather than subtracted from the finished totals, so stock cascades: ten Ingots on hand is twenty Ore you no longer mine. Persisted locally and deliberately kept out of the shareable URL
- [ ] **Tech point costs** — the dataset carries technology _levels_ but no point costs, because upstream doesn't record them. Would need another source
- [ ] **Alternative recipe selection** — `alternativeRecipes` is populated but unused. Let the user choose the Crusher path for Paldium, a higher-tier station, or a soul downgrade
- [x] **Named build lists** — several builds side by side, with rename, duplicate, and a two-step delete. Edits auto-save, matching the behaviour the single build already had; a pre-existing build migrates in as "My build", and a shared link opens as its own build rather than overwriting a saved one

## Data quality

- [x] **Upstream licensing position settled** — asking `palworld-kb` for an explicit license was drafted and deliberately shelved; a refusal would be worse than the current ambiguity. Reasoning and the conditions that should trigger a revisit are recorded in [NOTICE.md](NOTICE.md)
- [ ] **`.pak` source adapter** — let users who own the game generate data from their own install. Also the preferred long-term answer to the licensing question, since it removes the third-party dependency rather than negotiating it
- [x] **Audit the entries classified `unobtainable`** — cut 319 → 111 by parsing drop lines with unknown rates and by treating treasure chests, wild egg spawns, and merchant sales as real sources. Coverage is now 91.6%. Repeatable via `npm run data:audit`, which also runs in CI
- [x] **Verify the curated `GATHERED_MATERIALS` list** — found two names matching nothing (`Quartz`, `Sulfuric Acid Bottle`), which had let Pure Quartz regress to `drop`. The audit now fails on any stale entry
- [ ] The remaining 111 entries have no source text upstream at all (Ancient Bark, Ancient Bone, Animal Skin, …). `palworld-kb` documents these as its own gaps — filling them needs a second data source
- [x] **Automated upstream-refresh check** — `.github/workflows/data-refresh.yml` re-imports weekly and opens a PR only when the output actually changes. Required making the importer idempotent

## Technical debt

- [x] **Bundle size** — the dataset now builds into its own chunk, so the app-code
      chunk fell from 1,223 kB to 223 kB (gzip 163 → 68 kB) and a code change no
      longer invalidates ~92 kB gzipped of unchanged game data. Vite's
      `json.stringify` also emits it as `JSON.parse('…')`, which parses far
      faster than a megabyte of object literals.
- [ ] **Trimming redundant fields from the dataset** — deliberately _not_ done, with
      numbers: `RecipeInput.name` (51 kB) and `Recipe.stationName` (26 kB) duplicate
      data already in the file, and interning the 891 distinct drop-source strings
      would save a further 65 kB. That is 142 kB of 1,049 kB raw, or roughly 10 kB
      gzipped once compressed — compression already collapses most of this
      repetition. Not worth losing the unresolved-input name fallback and adding a
      string-table indirection. Revisit only if the dataset grows substantially.
- [x] **Component tests** — every component, the build-list hook, and `App`, plus a static guard on Tailwind utility usage that catches the class of bug render tests structurally cannot
- [ ] Consider indexing items by category/station at import time rather than filtering at runtime

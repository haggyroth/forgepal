# CLAUDE.md — ForgePal

Guidance for Claude Code when working in this repository.

## What this is

ForgePal is a **Palworld crafting calculator**. The user picks items and structures with quantities; ForgePal recursively expands every recipe down to raw materials and produces one consolidated shopping list, exportable to Markdown.

The differentiator versus existing tools (palcraft.xyz, palworld.gg) is the **build list**: many items at many quantities, aggregated. Single-item costing is table stakes.

Repo, package, and product are all **ForgePal** / `forgepal`.

## Stack

React 19 + TypeScript + Vite 8 + Tailwind 4. Vitest for tests, Oxlint for linting. Fully static, deployed to GitHub Pages. **No backend, no runtime network calls** — the dataset is committed to the repo.

## Commands

```bash
npm run dev           # dev server
npm run build         # tsc -b && vite build
npm test              # vitest run
npm run lint          # oxlint
npm run format        # prettier --write .
npm run format:check  # prettier --check . (enforced in CI)
npm run data:import   # regenerate src/data/game-data.json
npm run data:audit    # data quality report (also runs in CI)
```

`validate.ts` blocks a bad import; `scripts/audit/` reports on quality. The audit fails **only** on problems within our control — a curated override naming something that doesn't exist, or upstream text matching a pattern we claim to parse but didn't. Upstream's own gaps are reported, never treated as failures.

Two silent-failure modes it exists to catch, both of which had already happened: a name in `GATHERED_MATERIALS` that matches no item does nothing at all, and a too-strict parser discards data without complaining.

Run `npm test` and `npm run build` before committing. Both are enforced in CI.

## Architecture

```
scripts/import/          Data pipeline (Node, run manually, not at build time)
  sources/palworld-kb.ts   Upstream adapter — the ONLY file that knows upstream's shape
  normalize.ts             Upstream shape -> our schema
  overrides.ts             Curated corrections to upstream data
  normalize-breeding.ts    Breeding data -> src/data/breeding-data.json
  breeding-overrides.ts    Curated breeding-pool corrections and tie-break policy
  validate.ts              Cycle + dangling-reference checks; fails the import
  index.ts                 Orchestrator
        |
        v
src/data/game-data.json      Generated + COMMITTED. Never hand-edit.
src/data/breeding-data.json  Generated + COMMITTED. Separate file on purpose —
                             Pals are not items, and the calculator's chunk must
                             not carry breeding data it never reads.
src/types/game.ts        The schema. Everything downstream depends on this, not upstream.
src/lib/
  id.ts                  Name -> stable id slug. Shared by app and scripts.
  calculator.ts          Recipe expansion engine.
  breeding.ts            Breeding engine: pair resolution and the path solver.
                         Also shared by scripts — see below.
  search.ts              Catalogue search, filtering, and ranking.
src/hooks/useBuildList.ts  Build-list state (insertion-ordered Map).
src/components/
  ui.tsx                 SourceBadge, Stepper, Panel.
  Section.tsx            Collapsible panel: heading, toggle, ARIA. Use this,
                         not Panel + a hand-rolled heading.
  ItemBrowser.tsx        Search + category filters + results.
  BuildList.tsx          Selected items with quantity steppers.
  Totals.tsx             Requisition (raw), intermediates, drop sourcing.
  RecipeTree.tsx         Per-item expandable breakdown.
```

Data flows one way: `upstream -> adapter -> normalize -> overrides -> validate -> committed JSON -> app`. The app never sees an upstream shape.

### Why the data is committed

The deployed site must not depend on a third-party host at runtime, and a diff on `game-data.json` makes every upstream change reviewable before it ships. Regenerating is a deliberate act (`npm run data:import`), not a build step.

`.github/workflows/data-refresh.yml` re-runs the importer weekly and opens a PR **only** when the output actually changes. It never commits to `main` — reviewing the diff is the entire point.

**The importer must stay idempotent** for that to work. `meta.importedAt` is deliberately preserved when nothing else changed; if it were stamped on every run, the refresh workflow would open a PR every week announcing a change that isn't one. Anything else non-deterministic added to the output has the same problem.

### Adding a new data source

Write a new adapter in `scripts/import/sources/` returning the same `RawDataset`, then swap it in `index.ts`. Nothing else should need to change. If a source change ripples past `normalize.ts`, the abstraction has leaked — fix that rather than patching downstream.

## Data model

Defined in `src/types/game.ts`. The load-bearing concept is `SourceKind`, which decides where recursion stops:

| `sourceKind`   | Meaning                             | Expanded?          |
| -------------- | ----------------------------------- | ------------------ |
| `craftable`    | Has a recipe                        | Yes                |
| `gathered`     | Mined/chopped/farmed from the world | No — leaf          |
| `drop`         | From Pals, mobs, or NPCs            | No — leaf          |
| `unobtainable` | No recipe, no known source          | No — flagged in UI |

`gathered` and `drop` leaves are the shopping list. `drop` leaves carry a `drops[]` array of Pal/mob sources with rates, so the UI can answer "where do I farm this?"

## Upstream data is unreliable — read this before touching the importer

Data comes from [beliarance/palworld-kb](https://github.com/beliarance/palworld-kb), which is itself scraped from paldb.cc. Scraping loses information, and it has lost it in a specific, dangerous way:

**Alternative recipes get flattened into a single AND-list.** The Crusher turns Stone _or_ Ore _or_ any Sphere into Paldium Fragment. Upstream records this as one recipe requiring Stone AND Ore AND one of every Sphere. That is wrong twice: the cost is nonsense, and it creates a recipe cycle (`Mega Sphere -> Paldium Fragment -> Mega Sphere`).

Known instances, all corrected in `overrides.ts`:

- **Paldium Fragment** — caused 15 cycles on its own. Now classified `gathered` (which is also how players actually get it); real Crusher conversions kept in `alternativeRecipes`.
- **Pal Souls** — Small/Medium/Large/Giant convert in _both_ directions. Only the upgrade direction is kept as the primary recipe.

Consequences for anyone editing this area:

1. **Never collapse alternative recipes into one ingredient list.** An OR is not an AND. Use `Recipe` for the primary path and `alternativeRecipes` for the rest.
2. **`validate.ts` failing the import on a cycle is a feature.** If a new cycle appears after an upstream refresh, it is almost certainly another flattened-alternatives bug. Add a documented override; do not relax the check.
3. **The calculator is defensively cycle-safe anyway** (`calculate` returns `cycles` rather than hanging). Keep it that way — bad data should degrade to a warning, never a frozen tab.

Useful details upstream hides in a free-text `notes` string, already parsed in `normalize.ts`:

- `"Crafts x10 per batch"` -> `Recipe.yield` (45 recipes; Arrow is x10, so costing it per-unit overstates materials tenfold)
- `"Also craftable at: Improved Furnace, ..."` -> `Recipe.alternativeStationNames` (upstream's `station` is only ever the lowest tier)

### Breeding data is derived, and the derivation is load-bearing

Upstream never states which Pals the rank formula can produce. It says only that variants and "special-combo-only children" are excluded, so the pool is derived: everything except Pals appearing as a special-combo child (183 of 299).

**A wrong exclusion does not just make one Pal unreachable.** The formula picks the nearest rank _in the pool_, so removing an entry changes which Pal is nearest for every target near its rank — one mistake silently corrupts unrelated parent pairs. Corrections go in `breeding-overrides.ts` with a rationale, and `data:audit` checks that no special-combo child leaks into the pool and that every pooled rank is unique.

**The tie-break rule decides ~31% of generic pairs.** When a target lands exactly between two pooled ranks, upstream's `formula` says the higher rank wins (verified in game: Turtacle 2410 + Aegidron 30 → 1220 → Nitemary over Quivern) while its own `gaps` field says palworld.wiki.gg documents the opposite. We follow the verified observation, record the affected share in the dataset, and the solver must flag results that depended on it. This is not a footnote — it is a third of the table.

### Editing `overrides.ts`

This is the one place we knowingly disagree with upstream. Every entry must explain **why**. An override without a rationale is indistinguishable from a bug. Keep the file small — if it grows, the adapter is wrong.

Never guess a quantity. A known gap is better than a plausible wrong number.

## The calculator

`src/lib/calculator.ts`. Two entry points:

- **`calculate(buildList, index)`** — authoritative totals. Does a topological pass so demand is fully aggregated _before_ costing. This matters: if 40 Ingots are needed across three recipes, Ore must be derived once from 40, not three times from partial subtotals. With batch recipes and their rounding, per-branch costing overcounts.
- **`buildTree(itemId, qty, index)`** — display tree for one item. Branch quantities are per-branch and will not always sum to `calculate`'s figures. That is expected: the tree explains structure, the totals are what you take shopping. Don't "fix" the discrepancy by making the UI sum the tree.

Batch recipes round up per craft, and the surplus is reported (`MaterialTotal.surplus`) rather than silently discarded.

## The breeding engine

`src/lib/breeding.ts`. Pure, no UI, no React. `buildBreedIndex(data)` once, then:

- **`breed(index, a, b)`** — one pair. Fixed combo first, formula second; order-insensitive.
- **`parentsFor(index, child)`** — the inverse, sorted exact-combo first and tie-broken last.
- **`solve(index, owned, target)`** — breadth-first over reachable species, returning the fewest-**generation** chain. Because each species is recorded at the earliest generation it can be reached, the returned steps are runnable top to bottom: a step's parents are always produced before it. Null means genuinely unreachable, and the failure case still reports `reachableCount` so the UI can say why.

Two rules for anyone editing this:

- **`comboKey` and `nearestInPool` live here, and `scripts/import/normalize-breeding.ts` imports them** — the same relative-import exception as `id.ts`. Do not reimplement either in the importer. The importer measures the tie-break share with them; a second copy would let the figure the UI cites drift from the answers the solver gives. A test asserts the two still agree pair for pair.
- **Every result carries `tieBroken`, and every plan `tieBrokenSteps`.** Dropping the flag would be silently presenting a coin-flip as a fact on a third of pairs. See the tie-break note above.

## UI

Dark-only, by design — see the comment at the top of `src/index.css`. The palette is iron (surfaces), ember (accent), blueprint (stations/structures), verdigris (gathered). **Ember is reserved for the Requisition panel and interactive accents**; spending it elsewhere is what would make this look like every other dark dashboard.

Fonts are bundled via `@fontsource` and imported in `main.tsx`, not fetched from a CDN — the app makes no runtime network calls, and Google Fonts would be the sole exception.

Tailwind 4 notes that have already bitten once:

- Font weights are named utilities (`font-semibold`, `font-bold`). **`font-600` is not a class** and silently does nothing.
- Every colour used must exist in the `@theme` block. A reference to an undefined shade (`bg-forge-900`) is an invalid class, so the preceding utility wins and the bug looks like a specificity problem.
- Scrollable flex children need `min-h-0` on every ancestor in the chain; `min-height: auto` otherwise refuses to shrink and the list runs off the page instead of scrolling.

Every panel is a `Section` — collapsible, with its state persisted per section in localStorage under `forgepal:sections:v1`. Two rules worth keeping:

- **Collapse state stays out of the shareable URL.** It's a view preference; encoding it would impose the sender's layout on whoever opens the link.
- **Collapsed content is unmounted, not hidden.** The Breakdown tree and the full catalogue are the expensive renders here, and `display: none` would keep paying for them.

The catalogue renders at most 60 results and reports the true total. Rendering all ~1,320 entries is slow and useless — search is the intended way through the list.

## Conventions

- **Prettier owns formatting**; `.prettierrc.json` encodes the style the codebase already used (no semicolons, single quotes, 100 columns). Don't hand-tune whitespace — run `npm run format`. CI fails on unformatted code.
- **`src/data/game-data.json` is in `.prettierignore` and must stay there.** The importer writes it with `JSON.stringify(data, null, 2)`; if Prettier reformatted it, every `npm run data:import` would produce a diff against the committed file and the weekly refresh workflow would open a PR for a change that isn't one.
- Path alias `@/` -> `src/`. **Exception:** modules shared with `scripts/` (currently `src/lib/id.ts`) must use relative imports — `scripts/` compiles under `tsconfig.node.json`, which has no alias mapping.
- Ids come from `toId(name)` and nothing else. It is the join key across every dataset; recipes reference inputs by name upstream, so both sides of a lookup must slugify identically.
- Comments explain _why_, especially around upstream data quirks. The code is not self-documenting when the data is this adversarial.
- Tests in `src/**/*.test.ts`. The `describe('the committed dataset')` block runs against real data on purpose — it is the tripwire for a bad import. Keep it.

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`, on push to `main`. `vite.config.ts` sets `base` to `/forgepal/` when `GITHUB_ACTIONS` is set and `/` otherwise — if the repo is ever renamed, that string must change too, or every asset 404s in production.

## Git workflow

Follow the user's git-workflow skill, which is the authority. In short: never commit to `main`; branch `<type>/<short-description>`; Conventional Commits; every PR gets a description body; **CI must be green before merging**; merge commits titled `merge: <branch> (#<PR>)`; bump the version for `feat/*` and `fix/*`; update README/ROADMAP/CHANGELOG.

One documented deviation from the skill: the version bump and doc updates go **in the branch**, not as a follow-up commit on `main` — see below.

### Branch protection on `main`

**Nothing reaches `main` except through a pull request with green checks — including you.**

- Required status checks: `Lint, test, build`, `Analyze`, `CodeQL`
- A pull request is required (0 approving reviews, since you cannot approve your own)
- `enforce_admins` is **on**, so none of the above can be bypassed
- Force pushes and branch deletion are blocked
- Conversation resolution is required

Two settings are deliberately _off_:

- **`required_linear_history`** — the workflow uses merge commits on purpose, to preserve branch history.
- **`strict`** (require branch up to date before merging) — on a single-contributor repo that trades constant rebasing for almost no benefit.

### The version bump and doc updates go _in_ the branch

This is a deliberate deviation from the git-workflow skill, which says to bump the version and update docs as a follow-up commit **directly on `main`**. With `enforce_admins` on, that is no longer possible.

Rather than opening a second follow-up PR per change, **put the version bump and the README/ROADMAP/CHANGELOG updates in the same branch as the work itself.** So a `feat/*` branch contains the feature, its minor version bump, and its changelog entry, and lands as one PR.

This is better than a follow-up PR, not merely a workaround:

- the version and the change it describes land atomically, so `main` is never at a version that misrepresents its contents
- the changelog entry sits in the same diff as the code it describes, where a reviewer can check it
- one PR per change instead of two

The bump rules themselves are unchanged: `feat/*` → minor, `fix/*` → patch, and no bump for `chore`, `docs`, `refactor`, `test`, or `style`.

### Reviewing Dependabot action bumps

Actions used by `ci.yml` and `codeql.yml` are exercised on the pull request itself. The Pages actions in `deploy.yml` only run on `main`, so **split those into their own PR** — otherwise a broken deploy arrives buried among unrelated bumps.

## Legal posture

Unofficial fan project, not affiliated with Pocketpair. Upstream `palworld-kb` publishes no license — we rely on it only for factual game data (see `NOTICE.md`). Don't copy upstream prose, code, or its cached HTML. Keep the attribution and trademark disclaimer in `LICENSE`, `NOTICE.md`, and the app footer intact.

# CLAUDE.md — ForgePal

Guidance for Claude Code when working in this repository.

## What this is

ForgePal is a **Palworld crafting calculator**. The user picks items and structures with quantities; ForgePal recursively expands every recipe down to raw materials and produces one consolidated shopping list, exportable to Markdown and `.xlsx`.

The differentiator versus existing tools (palcraft.xyz, palworld.gg) is the **build list**: many items at many quantities, aggregated. Single-item costing is table stakes.

Repo is `palforge`; the product is called **ForgePal**. Both names are intentional — don't "fix" one to match the other.

## Stack

React 19 + TypeScript + Vite 8 + Tailwind 4. Vitest for tests, Oxlint for linting. Fully static, deployed to GitHub Pages. **No backend, no runtime network calls** — the dataset is committed to the repo.

## Commands

```bash
npm run dev           # dev server
npm run build         # tsc -b && vite build
npm test              # vitest run
npm run lint          # oxlint
npm run data:import   # regenerate src/data/game-data.json
```

Run `npm test` and `npm run build` before committing. Both are enforced in CI.

## Architecture

```
scripts/import/          Data pipeline (Node, run manually, not at build time)
  sources/palworld-kb.ts   Upstream adapter — the ONLY file that knows upstream's shape
  normalize.ts             Upstream shape -> our schema
  overrides.ts             Curated corrections to upstream data
  validate.ts              Cycle + dangling-reference checks; fails the import
  index.ts                 Orchestrator
        |
        v
src/data/game-data.json  Generated + COMMITTED. Never hand-edit.
src/types/game.ts        The schema. Everything downstream depends on this, not upstream.
src/lib/
  id.ts                  Name -> stable id slug. Shared by app and scripts.
  calculator.ts          Recipe expansion engine.
```

Data flows one way: `upstream -> adapter -> normalize -> overrides -> validate -> committed JSON -> app`. The app never sees an upstream shape.

### Why the data is committed

The deployed site must not depend on a third-party host at runtime, and a diff on `game-data.json` makes every upstream change reviewable before it ships. Regenerating is a deliberate act (`npm run data:import`), not a build step.

### Adding a new data source

Write a new adapter in `scripts/import/sources/` returning the same `RawDataset`, then swap it in `index.ts`. Nothing else should need to change. If a source change ripples past `normalize.ts`, the abstraction has leaked — fix that rather than patching downstream.

## Data model

Defined in `src/types/game.ts`. The load-bearing concept is `SourceKind`, which decides where recursion stops:

| `sourceKind` | Meaning | Expanded? |
|---|---|---|
| `craftable` | Has a recipe | Yes |
| `gathered` | Mined/chopped/farmed from the world | No — leaf |
| `drop` | From Pals, mobs, or NPCs | No — leaf |
| `unobtainable` | No recipe, no known source | No — flagged in UI |

`gathered` and `drop` leaves are the shopping list. `drop` leaves carry a `drops[]` array of Pal/mob sources with rates, so the UI can answer "where do I farm this?"

## Upstream data is unreliable — read this before touching the importer

Data comes from [beliarance/palworld-kb](https://github.com/beliarance/palworld-kb), which is itself scraped from paldb.cc. Scraping loses information, and it has lost it in a specific, dangerous way:

**Alternative recipes get flattened into a single AND-list.** The Crusher turns Stone *or* Ore *or* any Sphere into Paldium Fragment. Upstream records this as one recipe requiring Stone AND Ore AND one of every Sphere. That is wrong twice: the cost is nonsense, and it creates a recipe cycle (`Mega Sphere -> Paldium Fragment -> Mega Sphere`).

Known instances, all corrected in `overrides.ts`:
- **Paldium Fragment** — caused 15 cycles on its own. Now classified `gathered` (which is also how players actually get it); real Crusher conversions kept in `alternativeRecipes`.
- **Pal Souls** — Small/Medium/Large/Giant convert in *both* directions. Only the upgrade direction is kept as the primary recipe.

Consequences for anyone editing this area:

1. **Never collapse alternative recipes into one ingredient list.** An OR is not an AND. Use `Recipe` for the primary path and `alternativeRecipes` for the rest.
2. **`validate.ts` failing the import on a cycle is a feature.** If a new cycle appears after an upstream refresh, it is almost certainly another flattened-alternatives bug. Add a documented override; do not relax the check.
3. **The calculator is defensively cycle-safe anyway** (`calculate` returns `cycles` rather than hanging). Keep it that way — bad data should degrade to a warning, never a frozen tab.

Useful details upstream hides in a free-text `notes` string, already parsed in `normalize.ts`:
- `"Crafts x10 per batch"` -> `Recipe.yield` (45 recipes; Arrow is x10, so costing it per-unit overstates materials tenfold)
- `"Also craftable at: Improved Furnace, ..."` -> `Recipe.alternativeStationNames` (upstream's `station` is only ever the lowest tier)

### Editing `overrides.ts`

This is the one place we knowingly disagree with upstream. Every entry must explain **why**. An override without a rationale is indistinguishable from a bug. Keep the file small — if it grows, the adapter is wrong.

Never guess a quantity. A known gap is better than a plausible wrong number.

## The calculator

`src/lib/calculator.ts`. Two entry points:

- **`calculate(buildList, index)`** — authoritative totals. Does a topological pass so demand is fully aggregated *before* costing. This matters: if 40 Ingots are needed across three recipes, Ore must be derived once from 40, not three times from partial subtotals. With batch recipes and their rounding, per-branch costing overcounts.
- **`buildTree(itemId, qty, index)`** — display tree for one item. Branch quantities are per-branch and will not always sum to `calculate`'s figures. That is expected: the tree explains structure, the totals are what you take shopping. Don't "fix" the discrepancy by making the UI sum the tree.

Batch recipes round up per craft, and the surplus is reported (`MaterialTotal.surplus`) rather than silently discarded.

## Conventions

- Path alias `@/` -> `src/`. **Exception:** modules shared with `scripts/` (currently `src/lib/id.ts`) must use relative imports — `scripts/` compiles under `tsconfig.node.json`, which has no alias mapping.
- Ids come from `toId(name)` and nothing else. It is the join key across every dataset; recipes reference inputs by name upstream, so both sides of a lookup must slugify identically.
- Comments explain *why*, especially around upstream data quirks. The code is not self-documenting when the data is this adversarial.
- Tests in `src/**/*.test.ts`. The `describe('the committed dataset')` block runs against real data on purpose — it is the tripwire for a bad import. Keep it.

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`, on push to `main`. `vite.config.ts` sets `base` to `/palforge/` when `GITHUB_ACTIONS` is set and `/` otherwise — if the repo is ever renamed, that string must change too.

## Git workflow

Follow the user's git-workflow skill, which is the authority. In short: never commit to `main`; branch `<type>/<short-description>`; Conventional Commits; every PR gets a description body; **CI must be green before merging**; merge commits titled `merge: <branch> (#<PR>)`; bump the version after `feat/*` and `fix/*` merges; update README/ROADMAP/CHANGELOG after every merge.

## Legal posture

Unofficial fan project, not affiliated with Pocketpair. Upstream `palworld-kb` publishes no license — we rely on it only for factual game data (see `NOTICE.md`). Don't copy upstream prose, code, or its cached HTML. Keep the attribution and trademark disclaimer in `LICENSE`, `NOTICE.md`, and the app footer intact.

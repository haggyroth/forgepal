# ForgePal

A Palworld crafting calculator that answers one question well: **"What do I actually need to gather to build all of this?"**

Pick any number of craftable items and structures, set quantities, and ForgePal recursively expands every sub-recipe down to raw gatherable materials — then tells you which Pals and mobs drop them.

> Mega Sphere x20 doesn't just need 60 Ingots. It needs 120 Ore, and you'll want a Digtoise.

## Why another calculator?

The existing tools ([palcraft.xyz](https://www.palcraft.xyz/), [palworld.gg](https://palworld.gg/items)) are good at costing a *single* item. ForgePal is built around a **build list** — many items, many quantities, one consolidated shopping list you can export to Markdown or `.xlsx`.

## Features

- **Recursive material expansion** — sub-recipes resolved all the way down to raw inputs
- **Build lists** — queue up multiple items at multiple quantities
- **Drop sourcing** — raw materials show which Pals/mobs drop them, with rates
- **Station & work info** — which workbench crafts it, and which Pal work suitability powers it
- **Export** — Markdown and `.xlsx`
- **Fully static** — no backend, no tracking, deploys to GitHub Pages

## Status

🚧 **Early development.** Project scaffolding and the data pipeline are in place; the calculator UI is being built. See [ROADMAP.md](ROADMAP.md).

## Development

```bash
npm install
npm run dev
```

Other commands:

| Command | Does |
|---------|------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Oxlint |
| `npm run data:import` | Regenerate `src/data/*.json` from upstream |

## Data

Game data is normalized into `src/data/` by a checked-in importer (`scripts/import/`) and committed to the repo, so the app has no runtime dependency on any third party. See [NOTICE.md](NOTICE.md) for attribution and [CLAUDE.md](CLAUDE.md) for the schema.

## License

[MIT](LICENSE). Unofficial fan project, not affiliated with Pocketpair.

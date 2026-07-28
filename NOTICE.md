# Data Attribution

ForgePal's game data is derived from community-maintained Palworld datasets. This file records where it comes from and under what terms.

## Upstream sources

| Source | Used for | Terms |
|--------|----------|-------|
| [beliarance/palworld-kb](https://github.com/beliarance/palworld-kb) | Items, recipes, crafting stations, structures, drop tables, tech levels | **No license file published.** See caveat below. |
| [paldb.cc](https://paldb.cc/) | Ultimate upstream — `palworld-kb` is scraped from it | Community wiki; see site terms |

Snapshot in use: `palworld-kb` @ game version **1.0**, data updated **2026-07-14**.

## Caveat on licensing

`palworld-kb` does not publish a license, which formally means "all rights reserved." ForgePal relies on it only for **factual game data** — recipe quantities, item names, drop rates — which is generally not copyrightable subject matter. We do not redistribute its schema, prose, code, or the cached HTML in its `data/raw/` directory.

Nonetheless this is a known open question, tracked in [ROADMAP.md](ROADMAP.md). Mitigations under consideration:

1. Ask the `palworld-kb` maintainer to add an explicit open license.
2. Add a `.pak` extraction adapter so users who own the game can generate data from their own install, removing the third-party dependency entirely.

If you are a rights holder and object to this use, please open an issue and we will remove the data promptly.

## Trademark

Palworld is a trademark of Pocketpair, Inc. ForgePal is an unofficial fan-made tool with no affiliation to, endorsement by, or sponsorship from Pocketpair. All game content, item names, and Pal names are the property of their respective owners.

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

Nonetheless this is a known open question. Mitigations, in order of preference:

1. **Ask the `palworld-kb` maintainer for an explicit license.** Considered and deliberately not done — see below.
2. **Add a `.pak` extraction adapter** so users who own the game can generate data from their own install, removing the third-party dependency entirely. Tracked in [ROADMAP.md](ROADMAP.md).

### Why we haven't asked upstream

Opening an issue asking `beliarance/palworld-kb` to add a license was drafted and consciously shelved. It is worth recording the reasoning, because "nobody got round to it" and "we decided not to" are different states and only one of them needs revisiting.

The ask cuts both ways. It invites a definitive answer, and a "no" would be worse than the current ambiguity: today ForgePal relies on facts that are very likely not copyrightable at all, whereas an explicit refusal would convert a quiet position into a declined request. The upside — converting a probably-fine position into a definitely-fine one — is smaller than it looks, since the underlying claim rests on the data being factual rather than on any permission granted.

This is not a determination that no license is needed. It is a judgement that the current use is low-risk and that the `.pak` adapter is the better answer, because it removes the dependency rather than negotiating it.

**If circumstances change** — the project takes on ads, sponsorship, or any commercial dimension; upstream adds a restrictive license; or upstream asks us to stop — revisit immediately. A drafted request is in the history of this file's PR if it is ever wanted.

If you are a rights holder and object to this use, please open an issue and we will remove the data promptly.

## Trademark

Palworld is a trademark of Pocketpair, Inc. ForgePal is an unofficial fan-made tool with no affiliation to, endorsement by, or sponsorship from Pocketpair. All game content, item names, and Pal names are the property of their respective owners.

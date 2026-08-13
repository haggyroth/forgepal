/**
 * The breeding tab's URL params.
 *
 * Two things go in: the pair you are looking up (`pair=turtacle.aegidron`) and
 * the Pal you are trying to reach (`target=jetragon`). Both are *questions*, and
 * a question is what a link is for — "look what these two make", "here is what I
 * am chasing".
 *
 * The roster stays out. It is your stuff, not part of the question, and putting
 * it in a link would either overwrite the recipient's roster or show them a
 * chain assembled from Pals they do not own — which reads as a plan and isn't
 * one. Same reasoning as the calculator's inventory; see `rosterState.ts`.
 *
 * Like every other URL writer here, `applyBreeding` touches only its own params.
 * The tab and the whole build list live in the same query string, and rebuilding
 * it wholesale would erase them.
 */

import { formatQuery, parseQuery } from './query'
import type { PalId } from '@/types/breeding'

const PAIR_PARAM = 'pair'
const TARGET_PARAM = 'target'
const PAIR_SEPARATOR = '.'

export interface BreedingUrlState {
  pairA: PalId | null
  pairB: PalId | null
  target: PalId | null
}

export const emptyBreedingState: BreedingUrlState = { pairA: null, pairB: null, target: null }

/** Ids are `[a-z0-9-]` by construction, so nothing here needs percent-encoding. */
function validId(raw: string | undefined, isKnownId: (id: PalId) => boolean): PalId | null {
  if (!raw) return null
  if (!/^[a-z0-9-]+$/.test(raw)) return null
  return isKnownId(raw) ? raw : null
}

/**
 * `isKnownId` rejects anything not in the current dataset, so a link shared
 * before a data refresh degrades to an empty field rather than a phantom
 * selection the solver would silently ignore.
 */
export function decodeBreeding(
  search: string,
  isKnownId: (id: PalId) => boolean = () => true,
): BreedingUrlState {
  const params = parseQuery(search)
  const [rawA, rawB] = (params.get(PAIR_PARAM) ?? '').split(PAIR_SEPARATOR)

  return {
    pairA: validId(rawA, isKnownId),
    pairB: validId(rawB, isKnownId),
    target: validId(params.get(TARGET_PARAM) ?? undefined, isKnownId),
  }
}

export function applyBreeding(search: string, state: BreedingUrlState): string {
  const params = parseQuery(search)

  // Only write a pair once both halves are chosen. A half-filled `pair=turtacle.`
  // would be a link that restores nothing while looking like it should.
  if (state.pairA && state.pairB) {
    params.set(PAIR_PARAM, `${state.pairA}${PAIR_SEPARATOR}${state.pairB}`)
  } else {
    params.delete(PAIR_PARAM)
  }

  if (state.target) params.set(TARGET_PARAM, state.target)
  else params.delete(TARGET_PARAM)

  return formatQuery(params)
}

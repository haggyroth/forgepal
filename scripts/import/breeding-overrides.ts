/**
 * Curated corrections to the derived breeding pool.
 *
 * Upstream never states which Pals the rank formula can produce. It says only
 * that "elemental/regional variant pals and special-combo-only children are
 * excluded from the generic rank pool", so membership has to be derived — and
 * getting it wrong is worse than it first looks.
 *
 * Excluding a Pal wrongly does not merely make that Pal unreachable. The
 * formula picks the *nearest rank in the pool*, so removing one entry changes
 * which Pal is nearest for every target near its rank. A single bad exclusion
 * silently corrupts results for unrelated parent pairs.
 *
 * That is why the default rule is deliberately mechanical and every deviation
 * has to be written down here with a reason, exactly like `overrides.ts`.
 */

/**
 * Pals forced *into* the generic pool despite appearing as a special-combo
 * child. Empty today — the default rule matches upstream's description, and no
 * counter-example has been verified in game.
 *
 * Add an entry only with evidence that the formula really can produce it.
 */
export const FORCE_IN_POOL: readonly string[] = []

/**
 * Pals forced *out* of the generic pool despite not appearing as a
 * special-combo child. Empty today.
 *
 * The obvious candidates were the eleven crossover Pals sharing CombiRank 3100
 * (Green Slime, Cave Bat, Eye of Cthulhu and friends), which upstream's `gaps`
 * field flags as depending "entirely on the tie-break rule / their exclusion
 * from the generic pool". They turn out to be excluded already: every one of
 * them appears as a special-combo child, so the default rule removes them and
 * no two pooled Pals share a rank.
 */
export const FORCE_OUT_OF_POOL: readonly string[] = []

/**
 * How an equidistant target resolves.
 *
 * Upstream's `formula` field claims `higher`, verified in game against one
 * worked example: Turtacle 2410 + Aegidron 30 gives target 1220, an exact tie
 * between Quivern 1210 and Nitemary 1230, and the observed result was Nitemary.
 * Its `gaps` field simultaneously notes that palworld.wiki.gg documents the
 * opposite, so upstream contradicts itself on the point.
 *
 * We follow the verified observation over the undated wiki claim. This is not a
 * rare edge case — roughly 31% of generic parent pairs land on an exact tie —
 * so the importer measures the affected share and the solver flags any result
 * that depended on it rather than presenting it as certain.
 */
export const TIE_BREAK: 'higher' | 'lower' = 'higher'

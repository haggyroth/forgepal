/**
 * Contrast audit for the palette, and a static guard on text colours.
 *
 * ForgePal is dark-only with a deliberately sparse palette, and its body text is
 * 0.68–0.78rem mono — roughly 11–12.5px, well below the 18.66px/24px threshold
 * for "large text". So WCAG AA's 4.5:1 is the applicable bar almost everywhere,
 * and a shade chosen by eye is easy to get wrong.
 *
 * It was wrong. `text-iron-600` (2.24:1 on a panel) had 38 usages and
 * `text-iron-700` (1.49:1) had 11, including two input placeholders.
 *
 * The palette cannot be fixed by lightening those tokens: `iron-600` needs
 * L >= 0.604 to clear 4.5:1 and `iron-400` is L 0.62, so they would merge and the
 * dim tier would vanish rather than improve. The fix was to stop using them for
 * text; both remain in the palette for borders, rules, and hover states, where
 * the 3:1 non-text bar applies instead.
 *
 * Hence the guard below: it is what stops a future `text-iron-600` from being
 * added back, which is otherwise invisible — jsdom applies no CSS, so a render
 * test cannot see a contrast failure.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compositeOver,
  contrastRatio,
  oklchToLinearRgb,
  parsePalette,
  relativeLuminance,
} from './contrast.ts'

const SRC = join(import.meta.dirname, '..', '..', 'src')
const palette = parsePalette(readFileSync(join(SRC, 'index.css'), 'utf8'))

const rgb = (name: string) => {
  const token = palette.get(name)
  if (!token) throw new Error(`No such colour token: ${name}`)
  return oklchToLinearRgb(token)
}

const AA_TEXT = 4.5
const AA_NON_TEXT = 3

/**
 * The surfaces text actually sits on.
 *
 * `iron-800` is deliberately absent: it appears only as a hover background, and
 * the same hover swaps the text to `ember-400`, so `iron-400` on `iron-800`
 * (4.40:1, marginally short) never renders.
 */
const SURFACES: [string, ReturnType<typeof rgb>][] = [
  ['iron-950 (body)', rgb('iron-950')],
  // bg-iron-900/70 over the body — the Panel surface. Its effective luminance is
  // what matters, not iron-900's.
  ['iron-900/70 (panel)', compositeOver(rgb('iron-900'), rgb('iron-950'), 0.7)],
  ['iron-850 (lifted)', rgb('iron-850')],
]

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sourceFiles(path, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

/**
 * Text colour classes in use, with their variant prefixes preserved.
 *
 * Prefixes matter here in a way they do not for the token-existence audit:
 * WCAG 1.4.3 exempts inactive controls, so `disabled:text-iron-700` is allowed
 * where a bare `text-iron-700` is not.
 */
function textColourClasses(source: string): string[] {
  return [...source.matchAll(/(?:className|class)\s*=\s*(?:\{`|"|'|`)([\s\S]*?)(?:`\}|"|'|`)/g)]
    .flatMap(([, body]) => body.split(/\s+/))
    .filter((token) => /(?:^|:)(?:text|placeholder:text)-[a-z]{2,}-\d+$/.test(token))
}

const files = sourceFiles(SRC)

describe('the contrast maths', () => {
  // Verified against known values before anything is concluded from it. A sign
  // error in the OKLab matrix would still yield plausible ratios.
  it('puts white on black at 21:1', () => {
    expect(contrastRatio([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 1)
  })

  it('puts a colour against itself at 1:1', () => {
    expect(contrastRatio(rgb('iron-400'), rgb('iron-400'))).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    const a = rgb('iron-100')
    const b = rgb('iron-950')
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
  })

  it('converts oklch white and black correctly', () => {
    expect(relativeLuminance(oklchToLinearRgb([1, 0, 0]))).toBeCloseTo(1, 2)
    expect(relativeLuminance(oklchToLinearRgb([0, 0, 0]))).toBeCloseTo(0, 5)
  })

  it('composites at alpha 0 and 1 as the identity', () => {
    const fg = rgb('iron-900')
    const bg = rgb('iron-950')
    expect(compositeOver(fg, bg, 1)).toEqual(fg)
    expect(compositeOver(fg, bg, 0)).toEqual(bg)
  })

  it('reads the palette out of the @theme block', () => {
    expect(palette.size).toBeGreaterThan(10)
    expect(palette.get('iron-950')).toEqual([0.15, 0.012, 255])
  })
})

describe('text colours in use', () => {
  const inUse = new Set<string>()
  const exempt = new Set<string>()

  for (const file of files) {
    for (const token of textColourClasses(readFileSync(file, 'utf8'))) {
      const shade = /(?:text|placeholder:text)-([a-z]{2,}-\d+)$/.exec(token)?.[1]
      if (!shade) continue
      // WCAG 1.4.3 exempts text in an inactive control.
      if (token.startsWith('disabled:')) exempt.add(shade)
      else inUse.add(shade)
    }
  }

  it('found text classes to check', () => {
    expect(inUse.size).toBeGreaterThan(3)
  })

  it('meets AA on every surface text sits on', () => {
    const failures: string[] = []

    for (const shade of [...inUse].sort()) {
      if (!palette.has(shade)) continue // the token-existence audit owns this case
      for (const [surfaceName, surface] of SURFACES) {
        const ratio = contrastRatio(rgb(shade), surface)
        if (ratio < AA_TEXT) {
          failures.push(`text-${shade} on ${surfaceName}: ${ratio.toFixed(2)}:1 (needs ${AA_TEXT})`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  it('keeps the two dim tokens out of text entirely', () => {
    // Named rather than left to the ratio check alone, so the reason survives:
    // these two cannot be lightened into compliance without merging with
    // iron-400, so they are non-text colours now and the rule is explicit.
    expect([...inUse]).not.toContain('iron-600')
    expect([...inUse]).not.toContain('iron-700')
  })

  it('still allows them on a disabled control, which WCAG exempts', () => {
    // Not an accident to be tidied up later: greying out an inactive button is
    // the conventional signal, and the spec carves it out on purpose.
    expect([...exempt]).toContain('iron-700')
  })
})

describe('the accent colours', () => {
  // These carry meaning — source kind, station, tech state — so a reader who
  // cannot resolve them loses information, not just polish.
  for (const shade of [
    'ember-400',
    'ember-500',
    'blueprint-400',
    'blueprint-500',
    'verdigris-400',
  ]) {
    it(`${shade} meets AA on every surface`, () => {
      for (const [surfaceName, surface] of SURFACES) {
        const ratio = contrastRatio(rgb(shade), surface)
        expect(ratio, `${shade} on ${surfaceName}`).toBeGreaterThanOrEqual(AA_TEXT)
      }
    })
  }
})

describe('non-text contrast', () => {
  /**
   * WCAG 1.4.11 wants 3:1 for the visual boundary of a control, where that
   * boundary is what identifies it.
   *
   * `border-iron-700` is 1.55:1 on the body and is the border on inputs and
   * buttons. Recorded rather than asserted, because those controls are also
   * distinguished by their own `bg-iron-950/60` fill and their label, and
   * lightening every border to 3:1 would change the drawing-ink character of the
   * whole UI. Revisit deliberately, not by making this test fail.
   */
  it('records where borders stand, without failing on them', () => {
    const measured = Object.fromEntries(
      ['iron-800', 'iron-700', 'iron-600', 'ember-700'].map((shade) => [
        shade,
        Number(contrastRatio(rgb(shade), rgb('iron-950')).toFixed(2)),
      ]),
    )

    // Pinned so a palette change surfaces here rather than silently.
    expect(measured).toEqual({
      'iron-800': 1.23,
      'iron-700': 1.55,
      'iron-600': 2.33,
      'ember-700': 3.34,
    })
  })

  it('has at least one border colour that clears 3:1 for when it matters', () => {
    // ember-700 is the focus-ring border, which is the one place a boundary
    // genuinely has to be perceivable on its own.
    expect(contrastRatio(rgb('ember-700'), rgb('iron-950'))).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })
})

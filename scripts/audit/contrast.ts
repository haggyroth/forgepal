/**
 * WCAG contrast maths for the oklch palette.
 *
 * The `@theme` block declares colours in oklch, which no contrast checker reads
 * directly, so the conversion has to happen here: oklch -> OKLab -> linear sRGB
 * -> relative luminance -> ratio.
 *
 * Lives under scripts/ with the other audits because it reads `src/index.css`
 * from disk, and src/ compiles with browser types only.
 *
 * The conversion is verified against known reference pairs in the test beside
 * this file. That check is not ceremony: a sign error in the OKLab matrix would
 * still produce plausible-looking ratios, and every conclusion the audit draws
 * would be wrong in a way nobody would notice.
 */

export type Oklch = readonly [l: number, c: number, h: number]
export type LinearRgb = readonly [r: number, g: number, b: number]

/** oklch -> linear sRGB, clamped into gamut. */
export function oklchToLinearRgb([l, c, h]: Oklch): LinearRgb {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)

  // OKLab -> LMS', cubed to LMS.
  const lCube = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mCube = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sCube = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  const rgb = [
    4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
    -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
    -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
  ].map((v) => Math.min(1, Math.max(0, v)))

  return [rgb[0], rgb[1], rgb[2]]
}

/** WCAG relative luminance, from *linear* (not gamma-encoded) channels. */
export function relativeLuminance([r, g, b]: LinearRgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: LinearRgb, b: LinearRgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Composite `fg` over `bg` at `alpha`, in linear light.
 *
 * Needed because the panel surface is `bg-iron-900/70` over the body, and its
 * effective luminance is what text actually sits on — not iron-900's.
 */
export function compositeOver(fg: LinearRgb, bg: LinearRgb, alpha: number): LinearRgb {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ]
}

/** Parse `--color-<name>: oklch(L C H)` declarations out of an @theme block. */
export function parsePalette(css: string): Map<string, Oklch> {
  const block = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)
  if (!block) throw new Error('No @theme block found')

  const palette = new Map<string, Oklch>()
  const declaration = /--color-([a-z0-9-]+)\s*:\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g
  for (const [, name, l, c, h] of block[1].matchAll(declaration)) {
    palette.set(name, [Number(l), Number(c), Number(h)])
  }
  return palette
}

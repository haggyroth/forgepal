/**
 * Static guard on Tailwind utility usage.
 *
 * Lives under scripts/ rather than src/ because it reads the filesystem: src/
 * compiles with browser types only, so Node APIs don't belong there.
 *
 * Two real bugs shipped past types, lint, and the whole test suite:
 *
 *   font-600        — not a Tailwind utility. Silently did nothing, so every
 *                     heading rendered at normal weight.
 *   bg-forge-900    — 'forge' was renamed to 'iron' and this shade never
 *                     existed. An undefined token is an invalid class, so the
 *                     preceding utility won and it looked like a specificity
 *                     bug.
 *
 * Neither is detectable by a render test: jsdom applies no CSS, so a class that
 * does nothing looks identical to one that works. Tailwind also doesn't fail a
 * build over an unknown utility — it just emits nothing. So the only place to
 * catch this is by reading the source and comparing against the @theme block.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', '..', 'src')
const THEME_FILE = join(SRC, 'index.css')

/** Utility prefixes that take a colour token. */
const COLOUR_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'outline',
  'divide',
  'placeholder',
  'caret',
  'accent',
  'fill',
  'stroke',
  'shadow',
  'from',
  'via',
  'to',
  'decoration',
]

/** Colour families Tailwind 4 ships by default, so they need no @theme entry. */
const BUILTIN_FAMILIES = new Set([
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
])

/** Font families Tailwind ships by default. */
const BUILTIN_FONTS = new Set(['sans', 'serif', 'mono'])

/** Valid Tailwind font-weight utilities. Anything else — `font-600` — is not a class. */
const FONT_WEIGHTS = new Set([
  'thin',
  'extralight',
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
  'extrabold',
  'black',
])

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out)
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

/** Colour and font tokens declared in the @theme block. */
function readTheme() {
  const css = readFileSync(THEME_FILE, 'utf8')
  const block = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)
  if (!block) throw new Error('No @theme block found in index.css')

  const colours = new Set<string>()
  const fonts = new Set<string>()
  for (const [, name] of block[1].matchAll(/--color-([a-z0-9-]+)\s*:/g)) colours.add(name)
  for (const [, name] of block[1].matchAll(/--font-([a-z0-9-]+)\s*:/g)) fonts.add(name)
  return { colours, fonts }
}

/** Class-name-ish strings, with arbitrary values and template holes removed. */
function classCandidates(source: string): string[] {
  return [...source.matchAll(/(?:className|class)\s*=\s*(?:\{`|"|'|`)([\s\S]*?)(?:`\}|"|'|`)/g)]
    .flatMap(([, body]) => body.split(/\s+/))
    .map((token) =>
      token.replace(
        /^(hover|focus|focus-visible|active|disabled|group-hover|odd|even|sm|md|lg|xl|dark|placeholder):/g,
        '',
      ),
    )
    .filter(
      (token) => token && !token.includes('[') && !token.includes('$') && !token.includes('{'),
    )
}

const files = sourceFiles(SRC)
const theme = readTheme()

describe('Tailwind theme tokens', () => {
  it('finds source files and a theme to check against', () => {
    expect(files.length).toBeGreaterThan(5)
    expect(theme.colours.size).toBeGreaterThan(5)
    expect(theme.fonts.size).toBeGreaterThan(0)
  })

  it('only references colour tokens that exist', () => {
    const offenders: string[] = []

    for (const file of files) {
      for (const raw of classCandidates(readFileSync(file, 'utf8'))) {
        // Strip any opacity modifier: bg-iron-900/40 -> bg-iron-900
        const token = raw.split('/')[0]
        const match = new RegExp(`^(?:${COLOUR_PREFIXES.join('|')})-([a-z]{2,})-(\\d+)$`).exec(
          token,
        )
        if (!match) continue

        const [, family, shade] = match
        if (BUILTIN_FAMILIES.has(family)) continue
        if (theme.colours.has(`${family}-${shade}`)) continue

        offenders.push(`${file.replace(SRC, 'src')}: ${raw}`)
      }
    }

    // An undefined shade is an invalid class that silently does nothing.
    expect(offenders).toEqual([])
  })

  it('uses named font weights rather than numeric ones', () => {
    const offenders: string[] = []

    for (const file of files) {
      for (const token of classCandidates(readFileSync(file, 'utf8'))) {
        const match = /^font-([a-z0-9]+)$/.exec(token)
        if (!match) continue
        const value = match[1]
        if (FONT_WEIGHTS.has(value)) continue
        if (BUILTIN_FONTS.has(value) || theme.fonts.has(value)) continue
        offenders.push(`${file.replace(SRC, 'src')}: font-${value}`)
      }
    }

    // `font-600` is not a Tailwind class; the weight utilities are named.
    expect(offenders).toEqual([])
  })

  it('catches an undefined shade when one is introduced', () => {
    // Proves the check above can actually fail, rather than passing vacuously
    // because the regex matches nothing.
    const bad = classCandidates('className="bg-iron-123 text-nonexistent-500"')
    const found = bad.filter((token) => {
      const match = new RegExp(`^(?:${COLOUR_PREFIXES.join('|')})-([a-z]{2,})-(\\d+)$`).exec(token)
      if (!match) return false
      const [, family, shade] = match
      return !BUILTIN_FAMILIES.has(family) && !theme.colours.has(`${family}-${shade}`)
    })
    expect(found).toEqual(['bg-iron-123', 'text-nonexistent-500'])
  })

  it('catches a numeric font weight when one is introduced', () => {
    const bad = classCandidates('className="font-600 font-bold font-mono"')
    const found = bad.filter((token) => {
      const match = /^font-([a-z0-9]+)$/.exec(token)
      if (!match) return false
      const value = match[1]
      return !FONT_WEIGHTS.has(value) && !BUILTIN_FONTS.has(value) && !theme.fonts.has(value)
    })
    expect(found).toEqual(['font-600'])
  })
})

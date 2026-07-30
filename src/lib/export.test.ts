import { describe, expect, it } from 'vitest'
import {
  buildExportModel,
  describeSources,
  exportFilename,
  hasAnythingToExport,
  toMarkdown,
} from './export'
import { buildIndex, calculate } from './calculator'
import { toId } from './id'
import { gameData } from '@/data'
import type { DropSource, GameData } from '@/types/game'

const data = gameData as unknown as GameData
const index = buildIndex(data)
const AT = new Date('2026-07-28T12:00:00Z')

function modelFor(entries: { name: string; quantity: number }[]) {
  const buildList = entries.map((e) => ({ itemId: toId(e.name), quantity: e.quantity }))
  return buildExportModel(calculate(buildList, index), index, data.meta, AT)
}

const drop = (source: string, min: number, max: number, chance: number): DropSource => ({
  source,
  quantity: [min, max],
  chance,
})

describe('describeSources', () => {
  it('describes gathered materials without naming Pals', () => {
    expect(describeSources('gathered', [])).toBe('Gathered from the world')
  })

  it('names the best sources first', () => {
    const result = describeSources('drop', [drop('Rushoar', 1, 2, 0.3), drop('Melpaca', 1, 1, 1)])
    expect(result.startsWith('Melpaca')).toBe(true)
  })

  it('collapses a fixed quantity into a single number', () => {
    expect(describeSources('drop', [drop('Melpaca', 1, 1, 1)])).toBe('Melpaca ×1 (100%)')
  })

  it('shows a range when the drop varies', () => {
    expect(describeSources('drop', [drop('Digtoise', 2, 3, 1)])).toBe('Digtoise ×2–3 (100%)')
  })

  it('counts the sources it did not name', () => {
    const result = describeSources('drop', [
      drop('A', 1, 1, 1),
      drop('B', 1, 1, 0.9),
      drop('C', 1, 1, 0.8),
      drop('D', 1, 1, 0.7),
    ])
    expect(result).toContain('+2 more')
  })

  it('flags materials with no known source', () => {
    expect(describeSources('unobtainable', [])).toContain('Unknown')
  })
})

describe('buildExportModel', () => {
  const model = modelFor([{ name: 'Mega Sphere', quantity: 20 }])

  it('separates targets, raw materials, and intermediates', () => {
    expect(model.targets.map((r) => r.name)).toEqual(['Mega Sphere'])
    expect(model.intermediates.map((r) => r.name)).toEqual(['Ingot'])
    expect(model.raw.map((r) => r.name)).toEqual(['Ore', 'Paldium Fragment', 'Stone', 'Wood'])
  })

  it('carries the calculated quantities', () => {
    expect(model.raw.find((r) => r.name === 'Ore')?.quantity).toBe(40)
  })

  it('records how each item is made', () => {
    expect(model.targets[0].madeAt).toContain('Sphere Workbench')
    expect(model.intermediates[0].madeAt).toBe('Primitive Furnace · Kindling')
  })

  it('attaches sources to raw materials only', () => {
    expect(model.raw.find((r) => r.name === 'Ore')?.source).toBeTruthy()
    expect(model.targets[0].source).toBe('')
  })

  it('stamps the dataset version and generation date', () => {
    expect(model.generatedOn).toBe('2026-07-28')
    expect(model.gameVersion).toBe(data.meta.gameVersion)
  })
})

describe('toMarkdown', () => {
  const markdown = toMarkdown(modelFor([{ name: 'Mega Sphere', quantity: 20 }]))

  it('renders a heading and the three sections', () => {
    expect(markdown).toContain('# ForgePal build list')
    expect(markdown).toContain('## Building')
    expect(markdown).toContain('## Materials to gather')
    expect(markdown).toContain('## Craft along the way')
  })

  it('renders quantities in right-aligned tables', () => {
    expect(markdown).toContain('| Material | Qty | Where to get it |')
    expect(markdown).toContain('| --- | ---: | --- |')
    expect(markdown).toMatch(/\| Ore \| 40 \|/)
  })

  it('attributes the tool and dataset', () => {
    expect(markdown).toContain('ForgePal')
    expect(markdown).toContain('2026-07-28')
  })

  it('handles an empty build list without producing a broken table', () => {
    const empty = toMarkdown(modelFor([]))
    expect(empty).toContain('_Nothing to gather._')
    expect(empty).not.toContain('## Building')
  })

  it('escapes backslashes before pipes, so the escape cannot be broken', () => {
    // Escaping only pipes turns `Odd\\|Name` into `Odd\\\\|Name`, which Markdown
    // reads as an escaped backslash followed by a live pipe — the column
    // silently splits. Flagged by CodeQL as incomplete sanitization.
    const model = modelFor([{ name: 'Mega Sphere', quantity: 1 }])
    model.raw[0] = { name: 'Odd\\|Name', quantity: 1, madeAt: '', source: '' }
    const rendered = toMarkdown(model)

    // Backslash doubled, then the pipe escaped: Odd\|Name -> Odd\\\|Name
    expect(rendered).toContain('Odd\\\\\\|Name')
    expect(rendered).not.toContain('Odd\\\\|Name ')
  })

  it('escapes pipe characters so they cannot break the table', () => {
    const model = modelFor([{ name: 'Mega Sphere', quantity: 1 }])
    model.raw[0] = { name: 'Odd | Name', quantity: 1, madeAt: '', source: 'a | b' }
    const rendered = toMarkdown(model)
    expect(rendered).toContain('Odd \\| Name')
    expect(rendered).toContain('a \\| b')
  })
})

describe('exportFilename', () => {
  it('is dated and extension-free', () => {
    expect(exportFilename(modelFor([]))).toBe('forgepal-build-2026-07-28')
  })
})

describe('hasAnythingToExport', () => {
  it('is false for an empty list or one of only zero quantities', () => {
    expect(hasAnythingToExport(new Map())).toBe(false)
    expect(hasAnythingToExport(new Map([['ingot', 0]]))).toBe(false)
  })

  it('is true once something is actually queued', () => {
    expect(hasAnythingToExport(new Map([['ingot', 1]]))).toBe(true)
  })
})

describe('describeSources with unknown rates', () => {
  it('says the rate is unknown rather than printing 0%', () => {
    const result = describeSources('drop', [
      { source: 'Named Boss', quantity: [1, 1], chance: null },
    ])
    expect(result).toBe('Named Boss ×1 (rate unknown)')
  })

  it('ranks known rates above unknown ones', () => {
    const result = describeSources('drop', [
      { source: 'Unknown', quantity: [1, 1], chance: null },
      { source: 'Certain', quantity: [1, 1], chance: 1 },
    ])
    expect(result.startsWith('Certain')).toBe(true)
  })

  it('describes vendor-only materials', () => {
    expect(describeSources('merchant', [])).toBe('Bought from a merchant')
  })
})

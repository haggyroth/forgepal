// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportBar } from './ExportBar'
import { buildIndex, calculate } from '@/lib/calculator'
import { toId } from '@/lib/id'
import { gameData } from '@/data'
import type { GameData } from '@/types/game'

const data = gameData as unknown as GameData
const index = buildIndex(data)
const result = calculate([{ itemId: toId('Mega Sphere'), quantity: 20 }], index)

/** Capture what the download helper would have saved. */
function captureDownloads() {
  const saved: { name: string; blob: Blob }[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:stub')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, blob: new Blob() })
  })
  return saved
}

function setup(disabled = false) {
  render(<ExportBar result={result} index={index} meta={data.meta} disabled={disabled} />)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ExportBar', () => {
  it('disables both actions when there is nothing to export', () => {
    setup(true)
    expect(screen.getByRole('button', { name: /copy markdown/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /download \.md/ })).toBeDisabled()
  })

  it('enables them once a build exists', () => {
    setup()
    expect(screen.getByRole('button', { name: /copy markdown/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /download \.md/ })).toBeEnabled()
  })

  it('copies Markdown to the clipboard and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    setup()

    await userEvent.click(screen.getByRole('button', { name: /copy markdown/ }))

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('# ForgePal build list')
    expect(await screen.findByRole('button', { name: /copied/ })).toBeInTheDocument()
  })

  it('falls back to a download when the clipboard is refused', async () => {
    // Clipboard permission can be denied outright; the list must not be lost.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const saved = captureDownloads()
    setup()

    await userEvent.click(screen.getByRole('button', { name: /copy markdown/ }))

    expect(saved).toHaveLength(1)
    expect(saved[0].name).toMatch(/^forgepal-build-\d{4}-\d{2}-\d{2}\.md$/)
    expect(screen.queryByRole('button', { name: /copied/ })).not.toBeInTheDocument()
  })

  it('downloads a dated .md file', async () => {
    const saved = captureDownloads()
    setup()

    await userEvent.click(screen.getByRole('button', { name: /download \.md/ }))

    expect(saved).toHaveLength(1)
    expect(saved[0].name).toMatch(/^forgepal-build-\d{4}-\d{2}-\d{2}\.md$/)
  })
})

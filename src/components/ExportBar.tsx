import { useState } from 'react'
import type { CalculationResult, GameIndex } from '@/lib/calculator'
import { buildExportModel, exportFilename, toMarkdown } from '@/lib/export'
import { downloadMarkdown } from '@/lib/download'
import type { DatasetMeta } from '@/types/game'

type Status = 'idle' | 'copied'

export function ExportBar({
  result,
  index,
  meta,
  disabled,
}: {
  result: CalculationResult
  index: GameIndex
  meta: DatasetMeta
  disabled: boolean
}) {
  const [status, setStatus] = useState<Status>('idle')

  const model = () => buildExportModel(result, index, meta)

  const exportMarkdown = () => {
    const m = model()
    downloadMarkdown(toMarkdown(m), `${exportFilename(m)}.md`)
  }

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(model()))
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 1800)
    } catch {
      // Clipboard access can be denied outright; fall back to a download so the
      // user still ends up with their list.
      exportMarkdown()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ExportButton onClick={copyMarkdown} disabled={disabled}>
        {status === 'copied' ? 'copied ✓' : 'copy markdown'}
      </ExportButton>
      <ExportButton onClick={exportMarkdown} disabled={disabled}>
        download .md
      </ExportButton>
    </div>
  )
}

function ExportButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-sm border border-iron-700 px-2.5 py-1 font-mono text-[0.7rem] lowercase text-iron-300 transition-colors hover:border-ember-700 hover:text-ember-400 disabled:cursor-not-allowed disabled:border-iron-800 disabled:text-iron-700 disabled:hover:border-iron-800 disabled:hover:text-iron-700"
    >
      {children}
    </button>
  )
}

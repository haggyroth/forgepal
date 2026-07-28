/**
 * Browser download helpers.
 *
 * Kept apart from `export.ts` so the shaping and formatting there stays pure
 * and testable in a Node environment, with no DOM required.
 */

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoking immediately can cancel the download in some browsers; a tick is
  // enough for the click to have been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadText(text: string, filename: string, mime = 'text/plain') {
  saveBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}

export function downloadMarkdown(markdown: string, filename: string) {
  downloadText(markdown, filename, 'text/markdown')
}

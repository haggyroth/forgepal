/**
 * Query-string helpers shared by everything that owns a URL parameter.
 *
 * Two features now write to the address bar — the build list and the active
 * tab — and more will. Each must update only its own params and leave the rest
 * alone, or the last effect to run silently drops the others' state. Parsing
 * and formatting live here so that contract is written once.
 */

export function parseQuery(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
}

/**
 * Serialise params without escaping the separators our ids rely on.
 *
 * URLSearchParams percent-encodes '.' and '_' in some engines. Both are safe
 * characters here, and escaping them turns a readable shared link into noise.
 */
export function formatQuery(params: URLSearchParams): string {
  return params.toString().replace(/%2E/gi, '.').replace(/%5F/gi, '_')
}

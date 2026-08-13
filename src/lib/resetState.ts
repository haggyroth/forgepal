/**
 * Forget everything ForgePal has stored — builds, inventory, collapse state.
 *
 * The recovery the error boundary offers, on the theory that a corrupt stored
 * payload is the likeliest way to get a render throw in the first place.
 *
 * Its own module rather than a function in `storage.ts`, for two reasons:
 *
 * 1. Scope. `storage.ts` owns the pre-collection single-build key specifically.
 *    This clears every key any of the state modules writes, so living inside one
 *    of them would misdescribe it.
 * 2. Weight. The error boundary is in the app shell, and `storage.ts` pulls in
 *    `shareState` -> `query` + `tech` for its encoding. Importing it from the
 *    shell put all of that in the initial download, which is exactly the coupling
 *    the dataset split was meant to end. This module imports nothing.
 *
 * Prefix-based rather than a list of keys, also deliberately: a reset assembled
 * from the named clears we happen to export would miss `forgepal:builds:v1` and
 * appear to work, then throw again on reload. A key added later is covered here
 * for free.
 */

const PREFIX = 'forgepal:'

/** See storage.ts — Node's own global shadows the DOM one under test. */
function storage(): Storage {
  return window.localStorage
}

export function resetPersistedState(): void {
  try {
    const store = storage()
    // Collect before removing: deleting during iteration shifts the indices and
    // silently skips half the keys.
    const keys: string[] = []
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key !== null && key.startsWith(PREFIX)) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
  } catch {
    // Storage unavailable, which also means nothing was persisted to corrupt.
  }
}

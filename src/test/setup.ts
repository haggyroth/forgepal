/**
 * Shared test setup.
 *
 * Loaded for every suite, including the Node-environment ones, so it must not
 * assume a DOM exists.
 */

import { afterEach } from 'vitest'

if (typeof document !== 'undefined') {
  const [{ cleanup }] = await Promise.all([import('@testing-library/react')])
  await import('@testing-library/jest-dom/vitest')
  // React Testing Library does not auto-clean when tests run outside its own
  // globals setup, and a leaked tree makes later queries match twice.
  afterEach(cleanup)

  installLocalStorage()
}

/**
 * Give jsdom a working `localStorage`.
 *
 * Node 26 ships its own experimental `localStorage` global which is `undefined`
 * unless `--localstorage-file` is passed, and it overwrites the one jsdom
 * installs — the property is present on `window` but reads as undefined. Rather
 * than requiring a Node flag to run the tests, install a minimal in-memory
 * Storage. Behaviour that matters here is get/set/remove/clear.
 */
function installLocalStorage() {
  if (typeof window.localStorage !== 'undefined') return

  const store = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return store.size
    },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
  }

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

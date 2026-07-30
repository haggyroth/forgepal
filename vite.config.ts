import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves this project from https://<user>.github.io/forgepal/,
// so assets must be requested from that subpath. Local dev stays at '/'.
const base = process.env.GITHUB_ACTIONS ? '/forgepal/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  json: {
    // Emit the dataset as JSON.parse('…') rather than an object literal. The
    // engine parses a JSON string far faster than it evaluates a megabyte of
    // nested literals, and the output is smaller.
    stringify: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split the dataset into its own chunk. Application code changes often
        // and the dataset changes weekly at most, but they previously shared
        // one content hash — so any code tweak forced every visitor to
        // re-download ~160 kB of unchanged game data. Separate chunks mean
        // separate cache lifetimes.
        manualChunks: (id: string) => (id.includes('game-data.json') ? 'game-data' : undefined),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Node by default — the lib and importer suites are the bulk of the tests
    // and don't need a DOM. Component tests opt in per file with
    // `// @vitest-environment jsdom`, which keeps the fast path fast.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    environmentOptions: {
      // jsdom defaults to about:blank, which is an opaque origin — localStorage
      // is then undefined and anything touching persistence throws.
      jsdom: { url: 'http://localhost/' },
    },
    // scripts/ is included so the importer's parsing and classification logic
    // is covered directly, not just via assertions on the generated data.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
})

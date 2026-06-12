import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Vitest sets process.env.VITEST before loading this config.
// The plugin below is activated ONLY when isTest is true and is never bundled
// into a production build (Vite evaluates this file fresh each run; a production
// `npm run build` has VITEST unset so the plugin list is empty).
const isTest = !!process.env.VITEST
const stubPath = resolve(__dirname, 'src/__mocks__/firebase.js')

// Custom resolveId plugin — intercepts at the Rollup resolver level (enforce: 'pre')
// before vite:import-analysis sees the import, so it catches relative imports that
// resolve.alias regex does not reach in Vite 8.
// Matches any import whose specifier ends in /firebase (covers ../firebase,
// ../../firebase, etc.) and redirects to the inert test stub.
// vi.mock(id, factory) in test files takes priority via Vitest's mock-hoisting layer,
// so existing return-value service mocks remain fully backward-compatible.
const firebaseTestStubPlugin = {
  name: 'firebase-test-stub',
  enforce: 'pre',
  resolveId(source) {
    if (/\/firebase$/.test(source)) return stubPath
    return null
  },
}

export default defineConfig({
  plugins: [
    ...(isTest ? [firebaseTestStubPlugin] : []),
    react({ jsxRuntime: 'automatic' }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'AgencyTrack',
        short_name: 'AgencyTrack',
        description: 'Tatil Life Sales Activity Tracker',
        theme_color: '#01696f',
        background_color: '#f7f6f2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB (bundle exceeds 2 MiB default)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-cache', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    env: {
      VITE_YEAR_PLAN_ENABLED: 'true',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/worktrees/**',
      // Emulator rules tests require a running Firebase emulator — run via
      // 'firebase emulators:exec --only firestore "node <test-file>"' instead.
      'tests/rules/**',
      'firestore.rules.test.mjs',
      // CF tests use Jest (not Vitest) — run via `npm test` in functions/
      'functions/**',
    ],
  },
})
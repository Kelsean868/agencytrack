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
      // 'prompt' (not 'autoUpdate'): the waiting SW genuinely waits for an explicit
      // user tap before activating. SKIP_WAITING is driven by vite-plugin-pwa's
      // virtual module (updateSW(true) in ReloadPrompt), NOT force-set in workbox —
      // this avoids the lost-work footgun on explicit-save surfaces (Monthly Plan
      // "Save draft", daily-entry "Save"). Offline precache is unchanged.
      registerType: 'prompt',
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
        // No runtimeCaching: Firestore's Listen/channel is a long-lived SSE stream that
        // NetworkFirst cannot cache and times out at 5s, dropping every realtime listener.
        // Firestore offline is handled by persistentLocalCache in src/firebase.js — SW has
        // no role in the Firestore request path.
      },
    }),
  ],
  server: {
    port: 5173,
  },
  // EFF-002 Phase 2 (foundation) — Rollup manualChunks vendor grouping.
  // Pins the heavy shared dependencies into a few STABLE named vendor chunks so
  // (a) app-code redeploys no longer bust their cache (lucide is imported by 146
  // files; firebase + recharts by many), and (b) the follow-up per-manager-tab
  // lazy-split lands WITHOUT fanning these shared leaves into dozens of tiny
  // chunks (the sprawl that reverted the first Phase-2 attempt — see
  // docs/audits/eff002-run/RUN-LOG.md). Function form is required so substrings
  // match nested d3/@firebase submodules. @react-pdf keeps its OWN chunk here so
  // EFF-011's dynamic-import split (#802) stays lazy — it must NOT fall through
  // into the eager `vendor` catch-all.
  //
  // `jspdf` / `jspdf-autotable` (Policy Ledger L2 export, lazy `import()`
  // only) are EXPLICITLY EXCLUDED from every manual bucket below, including
  // the eager `vendor` catch-all they would otherwise fall into. Two
  // named-chunk shapes were tried and rejected here after actually building
  // and checking the emitted chunk graph each time (Rule 17 — this is not a
  // theoretical concern, both alternatives measurably shipped the library to
  // every page load, confirmed by loading the built app and watching network
  // requests fire on the plain login screen, before AgentDashboard's own lazy
  // chunk is even requested):
  //   1. No rule at all -> falls into the catch-all `vendor` chunk, which
  //      `dist/assets/index-*.js` (the entry script `index.html` loads)
  //      references directly, same failure mode Ruling 1 exists to prevent.
  //   2. A dedicated named bucket (`vendor-pdf` OR its own `vendor-jspdf`) ->
  //      STILL produced a static `import` edge from the entry chunk. A
  //      `manualChunks` function only decides which FILE a module's code
  //      lands in, not when the file loads; forcing jspdf's two interdependent
  //      packages (`jspdf-autotable` statically imports `jspdf` itself) into
  //      one named chunk, reached from two separate `import()` call sites in
  //      the same lazy-loaded consumer module, gave Rollup's chunk-splitting
  //      algorithm a reason to hoist a shared binding up to the entry.
  // Returning `undefined` here (falling through to Rollup's own automatic,
  // un-forced code-splitting for these two packages) is what actually stayed
  // lazy — checked the same way, zero jspdf requests before the export menu
  // is opened.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('jspdf')) return; // let Rollup auto-split — see note above
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts';
          if (id.includes('@react-pdf') || id.includes('yoga-layout') || id.includes('fontkit')) return 'vendor-pdf';
          if (id.includes('/firebase/') || id.includes('@firebase/')) return 'vendor-firebase';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    env: {
      VITE_GAME_PLAN_LOOP_ENABLED: 'true',
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
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
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
    // ── CI fork cap — the fix for the long-running suite flake ────────────────
    //
    // MEASURED, NOT REASONED. Three configurations run BACK-TO-BACK on ONE
    // ubuntu-24.04 runner, same commit, only the pool size varying
    // (2026-08-02, PR #888 diagnostic):
    //
    //   default (3-4 forks)  FAILED   272s   TestingLibraryElementError:
    //                                        [data-testid="planner-week-next"]
    //   maxForks: 2          378/378  304s   (+32s, +12%)
    //   maxForks: 1          378/378  521s   (+249s, +92%)
    //
    // Runner: nproc 4 · availableParallelism() 4 · 16.8 GB · ubuntu-24.04.
    // NOTE that is the PUBLIC-repo runner class; private repos get 2 vCPU.
    //
    // WHY 2 AND NOT 3: this buys MARGIN, not wall-clock. The flake's timeouts
    // came in at 5006 · 5006 · 5007 · 5008 · 5015 · 5027 ms against the 5000ms
    // asyncUtilTimeout — six to twenty-seven milliseconds past the cliff. 3 of 4
    // cores leaves roughly the same starvation condition that produced those
    // numbers; +32s on a ~315s job is a trivial price for headroom.
    //
    // ⚠ A PINNED LITERAL, DELIBERATELY NOT A FORMULA. Do NOT replace this with
    // availableParallelism()/2 or similar — what was measured is "2 forks on a
    // 4-vCPU ubuntu-24.04 runner", and a formula generalises past the evidence
    // to runner classes nobody has tested. IF THE RUNNER CLASS EVER CHANGES,
    // RE-MEASURE and update this number and this comment together.
    //
    // CI-ONLY BY DESIGN. All the evidence is from CI. Capping local runs on 8-
    // and 16-core dev machines would make the local loop several times slower to
    // fix a problem never seen in a normal local flow — and a suite people stop
    // running locally is a worse outcome than a slow gate.
    //
    // Do NOT "fix" this by raising asyncUtilTimeout again (src/test-setup.js).
    // That lever has been pulled twice already; the race survived both times and
    // is now hitting the new ceiling from 6ms above.
    poolOptions: {
      forks: {
        maxForks: process.env.CI ? 2 : undefined,
      },
    },
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
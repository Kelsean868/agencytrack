import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Design-reference handoff bundles are not production code (raw mockup JSX with
  // undefined design tokens, etc.) — ignore them so they never drown lint.
  // `design_handoff_v2_app` is a whole tracked bundle; `design_handoff_agencytrack_v3`
  // is the same shape (24 prototype .jsx/.css modules under prototypes/ — its README
  // §"design references created in HTML" states they are browser-transpiled sketches
  // with no build step, no persistence and no network, so they reference undefined
  // globals by construction and are not app source). `docs/**` covers the entire
  // docs tree — design-system reference JSX/JS (docs/design-system/, added in
  // 0cad5971, ~90 files / 539 lint errors) plus planner-handoff mockups under
  // docs/handoffs/. None of docs/ is app source. `docs/**/mockups/**` is retained
  // (redundant under docs/**) so the prior explicit intent stays on record.
  globalIgnores([
    'dist',
    'design_handoff_v2_app',
    'design_handoff_agencytrack_v3',
    'docs/**',
    'docs/**/mockups/**',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // ── React Compiler rules (eslint-plugin-react-hooks v7) ─────────────────
      // This project does not use @babel/plugin-react-compiler. The v7
      // flat.recommended preset enables these Compiler-only rules as errors,
      // but they fire on valid, idiomatic React patterns (e.g. setLoading(true)
      // inside a data-fetch useEffect). Disable until the Compiler is adopted.
      // If @babel/plugin-react-compiler is ever added, remove these overrides
      // and fix the flagged sites.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/config': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/gating': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/use-memo': 'off',
      // Allow _prefixed variables as intentionally unused
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_|^React$' }],
    },
  },
  // Node.js environment for Cloud Functions, scripts, and Vite/Vitest config files
  // (CommonJS — require/exports/process are valid; vite.config.js uses process.env.VITEST)
  {
    files: ['functions/**/*.{js,cjs}', 'scripts/**/*.{js,cjs}', 'vite.config.js', '*.config.{js,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Jest globals for Cloud Function unit tests. Covers both the flat
  // functions/__tests__/ tree and per-feature suites (functions/<feature>/__tests__/).
  {
    files: ['functions/**/__tests__/**/*.test.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
  // ── v3 business-action boundary ────────────────────────────────────────────
  // Components may not import v3 services directly — they go through
  // `src/actions/`, which is where the cross-module rules live. Rules that live
  // in components drift into components and rot, which is what happened to every
  // rule in the source build that had a twin.
  //
  // ⚠ THIS RESTRICTS *WHICH* SERVICES, NOT *WHETHER*. That inversion is the
  // whole design, and it has three consequences worth protecting:
  //
  //   · ZERO allowlist entries. 92 component files import PRE-v3 services today;
  //     none is on this list, so all 92 are untouched rather than
  //     pretended-fixed. A 92-entry allowlist would be theatre — a rule with an
  //     escape hatch that large teaches authors the allowlist is where you go
  //     when the rule is inconvenient.
  //   · Fully enforced from the first commit. No escape hatch exists, so nobody
  //     learns to reach for one.
  //   · It grows DELIBERATELY: each new v3 service is a one-line addition made
  //     by the slice that introduces it. A decision point, not a default.
  //
  // Scoping this to `src/actions/**` instead was considered and rejected —
  // actions are exactly the layer that SHOULD import services, so that scoping
  // would forbid the correct thing while forbidding nothing that matters.
  //
  // ── OWNERSHIP ───────────────────────────────────────────────────────────────
  // This list is the ENFORCEMENT MIRROR of the contract in `src/actions/README.md`
  // — the same relationship the `firestore.rules` `d.type` allowlist has to
  // `ACTIVITY_METADATA`: a mirror with a stated owner, NOT a twin. The README is
  // the contract; this is the machine-checked half. Change them together.
  //
  // If this list grows past a handful of entries WITHOUT a corresponding actions
  // layer being built out, that is the signal to revisit the approach rather
  // than to keep appending.
  {
    files: ['src/components/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/services/activityLogService', '**/services/activityLogService.js'],
          message:
            'Components must not import v3 services directly. Route through src/actions/ — ' +
            'the cross-module rules live there (see src/actions/README.md). ' +
            'This list is the enforcement mirror of that contract.',
        }],
      }],
    },
  },

  // jsx-a11y rules — flipped to 'error' in PR3 after PR1/PR2/PR3 fixes
  // brought all violations to zero. Future regressions now fail CI.
  // control-has-associated-label remains 'off' (intentional — it duplicates
  // label-has-associated-control with stricter heuristics that misfire on
  // labelled-by-id patterns).
  {
    files: ['src/**/*.{jsx,js}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/autocomplete-valid': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/control-has-associated-label': 'off',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/lang': 'error',
      'jsx-a11y/media-has-caption': 'error',
      'jsx-a11y/mouse-events-have-key-events': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'jsx-a11y/no-noninteractive-tabindex': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/scope': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
    },
  },
])

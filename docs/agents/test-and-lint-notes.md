# Test harness and lint configuration internals

Moved out of CLAUDE.md (§ Lint Policy, original line 346; § Test Policy / Global Firebase
stub, lines 352–365; § Banked patterns, line 786) on the router split.

CLAUDE.md keeps the binding gates: `npm run lint && npm test && npm run build` must all
pass before any push; baseline is 0 errors / 0 `jsx-a11y` warnings; never mock a service
solely to avoid Firebase init; `vi.mock(id, factory)` takes priority over the global stub;
and env-unset parity is the default gate. This file carries the mechanism.

## React Compiler rules are disabled

**React Compiler rules disabled:** `eslint-plugin-react-hooks` v7 ships React Compiler lint rules (`set-state-in-effect`, `purity`, `preserve-manual-memoization`, etc.) in its `flat.recommended` preset. This project does not use `@babel/plugin-react-compiler`, so all Compiler-only rules are set to `off` in `eslint.config.js`. If the Compiler is ever adopted, remove those overrides and fix the flagged sites.

## `_` prefix convention

**`_` prefix convention:** Variables that must appear in a destructuring/param list but are intentionally unused should be prefixed with `_` (e.g. `_agentId`, `_ws`). The lint rule is configured to ignore `/^_/` patterns.

## The global Firebase stub — full text

### Global Firebase stub

`src/firebase.js` calls `initializeApp` / `getAuth` / `initializeFirestore` at module load. Any test that transitively imports it (via a service or component) without a local `vi.mock` factory would crash in CI (where no `VITE_FIREBASE_*` env vars are set) with `auth/invalid-api-key`.

**`src/firebase.js` is globally stubbed in tests via a custom Vite plugin** in `vite.config.js` (the `firebaseTestStubPlugin`, active only when `process.env.VITEST` is set). The plugin intercepts any relative import ending in `/firebase` at the Rollup `resolveId` layer (before `vite:import-analysis`), redirecting it to `src/__mocks__/firebase.js` — an inert stub exporting `auth = {}`, `db = {}`, `storage = {}`, `functions = {}`, and `default = {}`. **Note (Vite 8):** `test.alias` (Vitest) and `resolve.alias` (Vite) do not intercept relative transitive imports in Vite 8 — `vite:import-analysis` processes relative specifiers before the alias resolver fires. The custom `resolveId` plugin with `enforce: 'pre'` is the only approach that works.

**Rules for test authors:**
- **Never mock a service solely to avoid Firebase init.** The global stub handles init. Mock services only to control their return values for assertions.
- **`vi.mock(id, factory)` takes priority** over the global stub for any service a test explicitly mocks — all existing return-value mocks are fully backward-compatible.

**Env-unset parity is now the default gate, not a separate parity check.** `942/942` with `VITE_FIREBASE_*` env vars UNSET is the baseline, matching CI exactly. Run `npx vitest run` after temporarily removing (or not having) `.env.local` to confirm. Do not rely on local env vars masking failures that will surface in CI.

Banked from PR #264 (2026-05-22). Surfaced 3× before the fix: F2 (#244), F3 (#246), I1.3c-i (#262).


## New JSX components must import React explicitly

- **All new JSX components must explicitly import React for Vitest compatibility.** Vite supports automatic JSX transform but Vitest does not apply the same config. Files relying on automatic transform will fail any new test that mounts them. Audit: as of PR #153, `CommissionPlayground/index.jsx` was the only file in this state; post-#153 it is fixed. Future new components must explicitly import React even when adding only `useState`/`useEffect`/etc. Banked from PR #153 test phase debug.

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

## Property tests must be mutation-verified

**A property test that passes proves nothing until a mutation makes it fail.** A passing property can mean the invariant holds, OR that the generator never reaches the defect — and the second is indistinguishable from the first without mutating. **Diffuse generators are as dangerous as narrow ones:** in P0-B, four partition properties passed under the *exact* defect they were written for, because ≤8 events spread over 7 days and 8 types essentially never produced two call-attributed blocks overlapping on one day. The fix was a second, deliberately dense generator run alongside the broad one via `fc.oneof`. **Every property must be paired with a mutation that makes it fail, and that mutation's counterexample is the deliverable — not the green run.**

Worked example: PR #884 (P0-B activity ledger). Three property families, each mutation-verified, and the contrast is the point — substituting `max(dials, itemised)` with `dials + itemised` (06-DEFECT-CLASSES.md §3's first listed defect, the container summed with its contents) passes **all five** monotonicity properties and **all four** partition properties, and is caught only by the aggregation property. Monotonicity proves direction, partition proves attribution, aggregation proves magnitude; none of the three substitutes for another.

## Choosing between `userEvent` and `fireEvent` — the remedy follows from what the test is testing

Both idioms fix the stale-listener race (a synchronous dispatch served by a handler closure from the previous commit, because the pending passive effect had not flushed). **The flush is the fix.** `userEvent` is *one way to obtain a flush*, bundled with a change of dispatch target. Pick by what the test is actually asserting, never by which idiom is nearby:

- **A test that models a USER pressing a key → `await userEvent.keyboard(...)`.** It is the faithful idiom, it is act-wrapped so the flush comes for free, and its `activeElement` targeting is a **feature** — that is how a real keypress reaches the handler.
- **A test that deliberately dispatches at a SPECIFIC target to exercise target-sensitive logic → keep `fireEvent` and obtain the flush separately** (`await act(async () => {})`, extracted as a named `flushPendingEffects()` helper). `userEvent` retargets at `activeElement`; if the handler branches on `e.target`, retargeting **destroys what the test is testing**.

Worked example, both halves shipped together in the flake Phase 1 slice: `MeetingMode.test.jsx`'s four `ArrowRight` dispatches model a user driving a deck, so the target change is inert → `userEvent.keyboard('{ArrowRight}')`. `AgentPlannerPanel.test.jsx`'s `pressKey` / `ctrlZ` / `ctrlY` helpers dispatch at `document` **on purpose**, against a handler that bails on form-field targets (`AgentPlannerPanel.jsx:1256`, `:1270`), with a test that appends an input, fires at it to prove the shortcut is ignored, then fires at `document` as an explicit sanity leg → keep `fireEvent`, add the flush. **Different answers, one rule.**

Two corollaries worth stating, because both have cost time here:

- **Do not bundle a behaviour change with a mechanism fix.** #563 shipped `delay: null` removal *and* `CHIP_WAIT` as one change, and two sessions later the record still could not say which half did the work. If the proven mechanism is "the effect had not flushed", ship the flush — not the flush plus a retarget that is untested against that mechanism.
- **Mutation-verify the flush rather than assuming it.** Remove it, burn, show the failures return; restore, burn, show they are gone. An `await` that happens to be in the right place is indistinguishable from one that does the work, until you take it out.

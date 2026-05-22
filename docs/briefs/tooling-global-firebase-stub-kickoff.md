# PR Kickoff — TOOLING: Global vitest firebase.js stub (kill the transitive-init false-green)

**Track:** Tooling / test-infra (banked FU, now elevated). **Type:** Chore/Refactor · **Size:** M · **Risk:** Medium — touches the global test setup, so it affects all ~942 tests. Mitigated by a strict no-regression gate + CI.
**Provenance:** the transitive-firebase-import false-green has now surfaced 3× — F2 (#244), proactively dodged in F3 (#246), and I1.3c-i (#262, `TenantAdminDashboard.test` + `TeamWarsTab.test` crashed in CI on unmocked `managerActivityStandardsService` → `firebase.js`). Each time: passes locally with env vars, crashes in CI without. Banked FU "global vitest firebase stub." Doing it now.

## The problem (precise)

`src/firebase.js` calls `initializeApp` / `getAuth` / `getFirestore` at module load. Any test that *transitively* imports it (via a service or component) and runs in an env without Firebase config (CI) throws `auth/invalid-api-key`. Today each such test must `vi.mock` the importing service purely to dodge init — and forgetting that mock is a false-green: green locally, red in CI.

## Goal

A **global** test stub so `firebase.js` never initializes real Firebase in any test, regardless of env vars. After this, tests no longer need to mock a service *solely* to avoid init (they still mock services to control return values — that's unchanged). **942/942 with NO env vars becomes the baseline**, not a separate parity check.

## Source-verify first (Rule 17, Phase 1 — STOP, this is the crux)

Report verbatim before any change:

1. **Test config** — quote the vitest/vite test block (`vite.config.js` or `vitest.config.*`): existing `test.setupFiles`, `test.environment`, `test.alias`, `test.env`, any global setup already present.
2. **`src/firebase.js`** — quote its full export surface (`auth`, `db`/`firestore`, `app`, `functions`, `storage`, any helper fns/constants) and the exact init calls at module load. The stub must replicate this export *shape* as inert objects, or the alias/mock will break tests that import those symbols.
3. **Current mock pattern** — how do tests avoid init today? Survey: count test files that `vi.mock('.../firebase.js')` or `vi.mock` a firebase-importing service. For each, classify **init-only** (mock exists purely to dodge init; test doesn't assert on its return value) vs **return-value** (test controls what the service returns). Explicitly classify the two #262 additions (`TenantAdminDashboard.test`, `TeamWarsTab.test`).
4. **Env-in-test today** — is there a `.env.test` / test env injection? How does the current env-unset-parity command run, and confirm the CI failure mode (no env → `firebase.js` init throws).
5. **RECOMMEND the stub mechanism**, with trade-offs:
   - (a) `test.alias` mapping `firebase.js` → a test stub module that re-exports inert `auth`/`db`/etc. (single point; must match export shape exactly);
   - (b) a global `setupFiles` that mocks the firebase SDK packages (`firebase/app`, `firebase/auth`, `firebase/firestore`) so `firebase.js`'s own logic still runs but its SDK calls are stubbed (keeps any non-init exports of `firebase.js` intact; larger mock surface);
   - (c) any cleaner option you find.
   State which you'd pick and why. **STOP for my decision before implementing.**

## Build (after I lock the mechanism)

- Implement the chosen stub: a **test-only** stub module + the config wiring. Confirm it lives in test scope and is referenced only by the test config (no runtime import).
- **No runtime `src/` code changes.** The diff should be: the test config, the new stub file, and test files only. Confirm this explicitly.
- **942/942 with NO env vars** — run the full suite with Firebase env unset; this is now the default gate (not a separate parity run).
- **Prove it:** remove at least one per-file mock that Phase 1 classified as *init-only* and confirm the test still passes via the global stub (the #262 additions are the prime candidates — undoing those band-aids). If no purely-init-only mock exists, demonstrate with a temporary unmocked-import test that you then revert, and report the method.
- **Do NOT sweep all redundant mocks** — removing return-value-coupled mocks would change assertions. Remove only the proof mock(s) that are unambiguously init-only; bank the broader sweep as a follow-up.
- **Document:** CLAUDE.md note — "`firebase.js` is globally stubbed in tests; never mock a service solely to avoid Firebase init — mock services only to control return values." Update the env-unset-parity convention (now the default).

## Scope

**IN:** the global firebase stub mechanism + config wiring; full-suite green with no env vars; proof via init-only mock removal; CLAUDE.md doc + the two #262 init-only mocks removed if Phase 1 confirms they're init-only.
**OUT (named):** the full redundant-mock sweep (follow-up); ANY runtime `src/` change; any rule/CF/index/deploy; any user-visible behavior.

## Phases

1. **Source-verify** (the 5 items). STOP; I lock the mechanism.
2. **Implement the stub + wiring.** Confirm no runtime code touched.
3. **Verify + prove.** 942/942 with env unset; remove the proof mock(s); confirm pass; CLAUDE.md doc.
4. **Docs (placeholders).** CONTEXT.md recently-shipped + Where-we-left-off (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark the global-stub FU resolved, note the broader redundant-mock sweep as a new LOW follow-up.
5. **Commit / push / PR.** Branch off fresh main. Lint + build. Full suite with NO env vars. Push, PR via `gh`, Rule 15. Do NOT merge.

## SMOKE — WAIVED (justified)

Test-infra only: changes are limited to the test config, a test-only stub, and test files; **no runtime `src/` code, no rules, no user-visible behavior**. The authoritative gate is the full suite passing with env unset + CI green + the proof removal. (CC must confirm in Phase 5 that the diff contains no runtime code, which is the justification.)

## Acceptance criteria

- 942/942 with Firebase env vars UNSET — locally and in CI.
- At least one Phase-1-classified init-only mock removed and still passing via the global stub; method reported.
- Diff contains NO runtime `src/` changes (config + stub + test files only) — confirmed.
- Lint 0; build green; CI green.
- CLAUDE.md documents the global-stub pattern; FOLLOW_UPS.md marks the FU resolved + notes the sweep follow-up.

## Post-merge

Standard docs fill. No deploy.

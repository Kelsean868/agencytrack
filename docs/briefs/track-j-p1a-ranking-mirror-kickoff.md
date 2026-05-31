# Track J — P1a: Server-side production-ranking mirror + cross-check

**Sized:** S
**Branch:** `redesign/ranking-logic-cjs-mirror` (off main)
**Type:** Backend logic module + cross-check test. No UI, no CF, no rules, no collection. **Human-merge + dispatcher pre-review.**
**Foundation for:** P1b (the leaderboard-aggregate Cloud Function), which composes this module server-side.

## Outcome

A CJS module under `functions/` mirroring the production-ranking math the leaderboard CF needs, plus a **cross-check test** asserting the CJS twin produces identical output to the `src/` ESM source on shared fixtures — CI-failing on drift. `src/lib/productionReport/computations.js` is ESM and cannot be imported by the gen-1 CJS functions, so a twin is required; the cross-check test is the drift guard (it closes the long-standing mirror-sync gap noted in the `escalationLogic.js` ↔ `accountabilityFlag.js` FU).

## Decisions baked in

- **Mirror the SUBSET only:** `getPeriodBoundaries`, `filterSubmissionsByPeriod`, `computeAgentTotals`, `rankAgentsByApi`, `extractTotalProductionCredit`, plus the `rankForLeaderboard` composition. (The #398 draft branch has an ESM `rankForLeaderboard`; it is NOT on main — re-author CJS-side, do not depend on the draft.)
- **Sync-guard headers** on the twin, per the `escalationLogic` precedent: `// Mirrors src/lib/productionReport/computations.js (+ rankForLeaderboard) — sync if either changes; guarded by the cross-check test.`
- **Cross-check test:** one test imports BOTH the `src/` ESM functions and the `functions/` CJS twin, runs a shared fixture set, and asserts identical output for all four periods (WK/MTD/QTD/YTD) + ranking. CI-fail on any divergence.

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`; `git checkout main && git pull --ff-only origin main`.
2. `git log origin/main --oneline -1` — capture verbatim.
3. Move the brief from Downloads into `docs/briefs/track-j-p1a-ranking-mirror-kickoff.md`; `git checkout -b redesign/ranking-logic-cjs-mirror`; commit as commit 1.
4. Any failure/drift → **STOP and wait for dispatcher.**

## Phase 1 — source-verify (Rule 11 + Rule 17, pair grep with git ls-files)

1. Confirm exact signatures + return shapes of the src functions to mirror: `getPeriodBoundaries`, `filterSubmissionsByPeriod`, `computeAgentTotals`, `rankAgentsByApi`, `extractTotalProductionCredit`. Record verbatim.
2. Confirm where a single test can import BOTH the ESM `src/` functions and the CJS `functions/` twin (vitest ESM/CJS interop) — the cross-check test's home.
3. Confirm the gen-1 CJS module convention in `functions/` (`'use strict'`, `require`, `module.exports`, sub-folder + re-export pattern).
4. Any drift, signature mismatch, or interop blocker → **STOP and wait for dispatcher.**

## Phase 2 — build the CJS twin + tests

1. New CJS module, e.g. `functions/leaderboard/rankingLogic.js` — mirrors the subset; `module.exports` the functions + the `rankForLeaderboard` composition. Sync-guard header.
2. **Cross-check test:** shared fixtures run through src ESM + functions CJS; assert identical output for WK/MTD/QTD/YTD + ranking (including tie order and zero-API agents). CI-fail on divergence.
3. **Unit tests** for the `rankForLeaderboard` composition: ranking correctness, zero-API agents ranked (not excluded), tie handling, empty input → empty output (no crash).
4. Do NOT modify `src/lib/productionReport/computations.js` — the twin mirrors it; the cross-check test enforces parity.

## Phase 3 — gates

- **3a lint / test / build:** all green; report verbatim. The cross-check test + the composition unit tests are the gate. Run BOTH the functions test suite and the app/vitest suite.
- **3b hex-grep:** N/A (no JSX/colors) — run for form, expect empty.
- **3c scope (FINAL diff):** new `functions/` twin + its test(s) + the cross-check test + brief + CONTEXT row + FOLLOW_UPS only. No `src/` change.
- **axe + both-themes smoke — WAIVED, justified:** pure logic module, no UI, no runtime surface. State in the PR body per the smoke-default rule. P1b carries the real write-read-verify smoke.

## Phase 4 — docs + FUs (same commit as Phase 2)

- CONTEXT.md recently-shipped row (`#{TBD}`/`{TBD}`): "Track J P1a — CJS server-side production-ranking mirror (period filter / totals / rank / rankForLeaderboard composition) for the leaderboard CF, with an ESM↔CJS cross-check test (CI-fail on drift). No UI, no CF, no rules. Foundation for P1b."
- **Upgrade the mirror-sync FU:** the existing `escalationLogic`↔`accountabilityFlag` drift concern wished for a cross-check; this P1a ships one for the ranking math. Note that the same cross-check pattern could be extended to the `escalationLogic` pair (bank as an optional cleanup FU).
- **Bank an FU:** possible future "dual-consumable `computations.js`" refactor to eliminate the twin entirely (out of scope here — touches 11 existing consumers).

## Phase 5 — commit, push, open PR — STOP for pre-review

1. `git add` in-scope files only.
2. Commit; `git push -u origin redesign/ranking-logic-cjs-mirror`.
3. Open PR vs main. Body: reference this brief; state human-merge + the axe/smoke waiver; paste lint/test/build verbatim + the cross-check test output.
4. **STOP and wait for dispatcher.** Do NOT merge. Surface PR URL + gate results — I pre-review the cross-check test (parity coverage across all four periods + ranking) before you merge.

## Phase 6 — post-merge fill (after dispatcher confirms merge)

Sync main, capture squash SHA, fill `#{TBD}`/`{TBD}` in CONTEXT.md + FOLLOW_UPS, push direct to main, then **Rule 15 — PASTE VERBATIM**: `git log origin/main --oneline -1` and `git rev-parse HEAD && git rev-parse origin/main`; confirm match; mismatch → **STOP.** No CF/rules deploy in P1a. Prod smoke N/A (no runtime surface) — waived; P1b carries the production exercise.

## Acceptance criteria

- CJS twin under `functions/` mirrors the subset; sync-guard header present.
- Cross-check test proves ESM ≡ CJS parity on WK/MTD/QTD/YTD + ranking, and CI-fails on drift.
- `rankForLeaderboard` composition unit-tested (rank / zero / tie / empty).
- No modification to `src/lib/productionReport/computations.js`.
- Lint 0 / both test suites green / build clean. Final-diff scope per 3c. FUs banked.

## Out of scope

- The Cloud Function, `leaderboards` collection, rules, branch join/grouping, deploy, write-read-verify smoke — all P1b.
- Any UI (P3+). Reconciled-production migration (FU-2). Multi-tenant CF iteration (FU).

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.

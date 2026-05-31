# Track J — P1: Shared production-ranking data layer (Leaderboard keystone)

**Sized:** S
**Branch:** `redesign/production-ranking-hook` (off main)
**Type:** Data layer, no UI. **Human-merge + dispatcher pre-review.**
**Keystone for:** P3 (podium/tail), P4 (around-me row), P7 (AgentProductionView around-me + rank-pill fix). Build the ranking once; the three consumers import it.

## Outcome

A reusable `useProductionRanking({ scope, period })` hook (pure selector + thin hook) that composes the **existing** production-report pipeline to return period-scoped, branch-scoped, ranked agents for the Leaderboard family. No UI. No new ranking or period math. No modification to the shared computation/service modules — consume only.

## Decisions baked in

- **Production source (D1 — decided, overridable):** the existing **submissions** pipeline — `getAllYTDSubmissions` (managerService) → branch-scope filter → `filterSubmissionsByPeriod` → `computeAgentTotals` → `rankAgentsByApi` (all in `src/lib/productionReport/computations.js`). This is the audit's clean-reuse path and matches `RankedLeaderboard` + the production views + 8 kiosk panels. NOT reconciled-ledger (flip-gate data-blocked) and NOT the awards settlement path (separate system; `usesPolicyLedger` has zero footprint in `computations.js`). **If the dispatcher overrides to reconciled-now: STOP — a settlement-data-richness audit precedes any build.**
- **Period source (D2 — resolved):** reuse `getPeriodBoundaries` + `filterSubmissionsByPeriod`. WK = the Sunday WAR week (`triniSundayBefore`). QTD = calendar quarters (Awards agrees today). No new period math.
- **Scope:** P1 wires **branch** scope only (the leaderboard default). The hook accepts a `scope` param for extensibility; role variants (UM unit↔branch, BM picker) are P5.

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`; `git checkout main && git pull --ff-only origin main`.
2. `git log origin/main --oneline -1` — capture verbatim.
3. Move the brief from Downloads into `docs/briefs/track-j-p1-production-ranking-hook-kickoff.md`; `git checkout -b redesign/production-ranking-hook`; commit as commit 1.
4. Any failure/drift → **STOP and wait for dispatcher.**

## Phase 1 — source-verify (Rule 11 + Rule 17, pair grep with git ls-files)

1. Confirm the audit's signatures haven't drifted: `filterSubmissionsByPeriod`, `computeAgentTotals`, `rankAgentsByApi`, `getPeriodBoundaries`, `extractTotalProductionCredit`, `getAllYTDSubmissions`. Record actual signatures + return shapes.
2. Confirm the **branch-scope filtering** approach — how `BranchManagerProductionView` narrows tenant/year submissions to a branch (and which user/branch fields drive it). Mirror it; do not invent a new scoping path.
3. Confirm the **return shape** the consumers need against the Leaderboard spec addendum (`design_handoff_v2_app/`): at minimum `{ agentId, name, unitCode, periodApi, apps, rank }` plus what around-me needs (total agent count, `rankWithinUnit`).
4. Any drift, missing function, or scope-path ambiguity → **STOP and wait for dispatcher.**

## Phase 2 — build the hook + unit tests

1. New module (e.g. `src/hooks/useProductionRanking.js` + a pure `src/lib/productionReport/rankForLeaderboard.js` selector if cleaner). Compose the existing functions only.
2. Do **NOT** modify `computations.js` or `managerService` — consume them. (This keeps the family on one pipeline so the future reconciled migration is a single fetch-source swap.)
3. Handle loading / error / empty: empty data → empty ranking array, never a crash.
4. Unit tests: ranking correctness per period (WK/MTD/QTD/YTD), branch-scope filtering, tie handling, and empty-data → empty (not crash). Mock the services.

## Phase 3 — gates

- **3a lint / test / build:** all green; report verbatim. Unit tests for the hook ARE the gate.
- **3b hex-grep:** run on the new files (expected empty — no JSX/colors).
- **3c scope (FINAL diff):** new hook/selector file(s) + their test(s) + brief + CONTEXT row + FOLLOW_UPS only. No edit to `computations.js`/`managerService`/any existing `src/` file. (Scope is the terminal check, run last.)
- **axe + both-themes smoke — WAIVED, justified:** pure data layer, no UI, no user-visible behavior. Nothing renders; nothing to smoke. State this in the PR body per the smoke-default rule. The hook is exercised end-to-end by P3's prod smoke when the surface consumes it.

## Phase 4 — docs + FUs (same commit as Phase 2)

- CONTEXT.md recently-shipped row (`#{TBD}`/`{TBD}`): "Track J P1 — shared production-ranking hook (keystone). Composes the existing submissions pipeline (getAllYTDSubmissions → period-filter → computeAgentTotals → rankAgentsByApi), branch-scoped, period-windowed. No UI; consumed by P3/P4/P7. No change to computations.js/managerService."
- Bank **FU-1:** Awards vs production-report period logic are two separate code paths computing the same calendar periods (awards inline `getQuarter`/`getQuarterMonths` vs `getPeriodBoundaries`). Latent single-source divergence; reconcile if awards ever need to match the leaderboard's windows exactly.
- Bank **FU-2 (Track H):** family-wide reconciled-production migration — when the policy-ledger flip-gate clears, swap the production fetch source for the whole production-report family (RankedLeaderboard, production views, kiosk panels, leaderboard) in one coordinated move; the leaderboard inherits via the shared pipeline. Realizes the anti-gameable reconciled-production intent.

## Phase 5 — commit, push, open PR — STOP for pre-review

1. `git add` in-scope files only.
2. Commit; `git push -u origin redesign/production-ranking-hook`.
3. Open PR vs main. Body: reference this brief; state human-merge + the axe/smoke waiver justification; paste lint/test/build verbatim + the unit-test results.
4. **STOP and wait for dispatcher.** Do NOT merge. Surface PR URL + gate results.

## Phase 6 — post-merge fill (after dispatcher confirms merge)

Sync main, capture squash SHA, fill `#{TBD}`/`{TBD}` in CONTEXT.md + FOLLOW_UPS, push direct to main, then **Rule 15 — PASTE VERBATIM**: `git log origin/main --oneline -1` and `git rev-parse HEAD && git rev-parse origin/main`; confirm match; mismatch → **STOP and wait for dispatcher.** Prod smoke N/A (no UI) — waived; P3 carries the production exercise.

## Acceptance criteria

- `useProductionRanking({ scope, period })` returns correct period-scoped, branch-ranked agents with the consumer return shape.
- Unit tests cover all four periods + branch scope + tie + empty.
- No modification to `computations.js` / `managerService` / any existing `src/` file.
- Lint 0 / tests green / build clean. Final-diff scope per 3c. FU-1 + FU-2 banked.

## Out of scope

- Any UI (P3). Around-me row (P4). Role-scope variants (P5). Reconciled-production migration (FU-2). Awards engine.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.

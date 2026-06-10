# Brief: Leaderboard Test-Account Exclusion — Part 2 (branch-aggregate surface; completes FU #2)

**Type:** Cloud Function change + test · **Merge:** human (gated) · **Deploy:** functions, now (pilot-blocking — test account visible on the demo board)

## Why a Part 2
FU #2 has **two** surfaces. PR #550 fixed one; the rendered podium is the other:
- **Surface A — fixed by #550:** `src/components/gamification/Leaderboard.jsx` → `tenants/{tid}/leaderboard/{uid}` (**singular**), per-user gamification points. Guarded in `onSubmissionWrite`. ✓ Correct, not wasted.
- **Surface B — this brief:** `src/components/leaderboard/ProductionLeaderboardSurface.jsx` (the "Top of the Board · YTD" podium the operator actually sees, plus "Last Week's Champions") → `tenants/{tid}/leaderboards/{branchId}` (**plural**) via `src/hooks/useLeaderboard.js`, written by the hourly `recomputeLeaderboardScheduled` cron in `functions/leaderboard/leaderboardAggregate.js`. **Not guarded** → flagged test agents still appear (kelsean@ as Champion, TTD 25,000; testagent@ at $0).

The `isTestAccount` flag is already set on all 5 test accounts — Surface B's aggregation just doesn't read it.

## Goal
Exclude `isTestAccount === true` agents from the branch-aggregate podium **and** the weekly-champions widget. Completes FU #2.

## Approach — same flag, same pattern as the existing `provisioning !== true` filter
Three edits in `functions/leaderboard/leaderboardAggregate.js` (line numbers per CC's investigation — Phase 1 reconfirms against live code):
- **Site A — `groupByBranch()` ~L270** (builds `branchByAgent`): add `&& u.isTestAccount !== true`.
- **Site B — `groupByBranch()` ~L284** (pushes into `byBranch[branchId].users`): add `&& u.isTestAccount !== true`.
- **Site C — `computeWeeklyChampions()` ~L176** (champion eligibility skip): add `|| u.isTestAccount === true`.

Mirror the existing provisioning guard exactly. Touch no other logic.

## Prerequisites (verify on main)
- main clean at the post-#550 state (CC confirms HEAD).
- `functions/service-account-key.json` present (for a recompute trigger if it needs Admin SDK).

## Phase 1 — Recon (HARD STOP, report)
1. Reconfirm the three exact line numbers + current code at each site against **live** code.
2. Confirm how `recomputeLeaderboardOnDemand` is invoked (callable? admin script? in-app action?) so we can refresh `leaderboards/{branchId}` promptly post-deploy. If there's no clean trigger, note that the hourly cron refreshes within the hour.
**STOP and report.**

## Phase 2 — Aggregate filter
Apply the three `isTestAccount` guards above. Localized; no change to the cron schedule or `recomputeLeaderboardScheduled`'s other logic.

## Phase 3 — Test
Add/extend a test on `leaderboardAggregate` (uses fake uids): an `isTestAccount:true` agent's submissions are NOT bucketed, the agent does NOT appear in the ranked output (even at $0), and is NOT a weekly-champion candidate; a normal agent still appears. Keep `functions-tests` green.

## Phase 4 — Docs (commit with placeholders)
- `docs/FOLLOW_UPS.md`: **correct FU #2** — it was marked RESOLVED prematurely in #550. Mark it RESOLVED only now, noting BOTH surfaces (the `leaderboard/{uid}` guard in #550 + this `leaderboards/{branchId}` aggregate filter).
- Document the **two-surface distinction** durably (CLAUDE.md or a docs note): `leaderboard/{uid}` (singular, gamification points, `Leaderboard.jsx`, guarded in `onSubmissionWrite`) vs `leaderboards/{branchId}` (plural, branch-aggregate podium + champions, `ProductionLeaderboardSurface.jsx`, filtered in `leaderboardAggregate.js`).
- `CONTEXT.md` Rule 16 fields with SHA placeholders.

## Phase 5 — Commit / push / PR
Branch, commit (CF + test + docs), push, open PR. Report feature-branch HEAD SHA (Rule 20). Poll + disposition every Gemini comment (Rule 21). **No auto-merge.**

## Post-merge — deploy + verify (CORRECTED: verify the surface the user actually sees)
1. Human squash-merge.
2. `firebase deploy --only functions`.
3. Refresh `leaderboards/{branchId}`: trigger `recomputeLeaderboardOnDemand` (per Phase 1's method), or wait for the hourly cron.
4. **Verify the actual podium** — the lesson from the miss:
   - **Operator:** refresh the dashboard "Top of the Board" podium → "Kelsean Agent" and "Test Agent" are GONE (the branch shows only real agents — Kyron, until the bulk-8 are added). Check "Last Week's Champions" too.
   - **Programmatic:** read `tenants/tatillife_south/leaderboards/{branchId}` and assert no flagged-agent UID appears in the ranked output.
   - **Do NOT** verify via a `leaderboard/{uid}` check — wrong surface; that was the original miss.
5. `git log origin/main` (Rule 15), then `/post-merge`.

## Guardrails / non-goals
- Do **not** bundle the banked `leaderboardAggregate` crash fix — keep this focused; the crash fix stays in the Functions-day batch.
- Do not change the cron schedule or other `recomputeLeaderboardScheduled` logic.
- `isTestAccount` absent/false → unchanged behavior.

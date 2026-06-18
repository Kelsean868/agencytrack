# Brief — Daily Capture v2 · Phase 2.2: Sunday confirm targets the COMPLETED week (bugfix)

**Track:** Daily Capture v2 · **Phase:** 2.2 (bugfix on #686/#687). **Size:** S.
**Merge:** HUMAN-MERGE — agent-facing, deploys to live agents. First exposure Sun 2026-06-21.
**Stacks on:** `main` (#687 / `4a12532`).

## Goal
On Sunday, the DCv2 confirm view (and the #687 deep-link it feeds) must show the **completed** week the agent just logged — not the empty week starting that Sunday. Bring DCv2's week selection in line with the aggregator cron's `resolveWeekToAggregate`.

## Root cause (confirmed by recon)
`DailyCaptureV2.jsx`: `weekStarting = getSundayOf(today)`. `getSundayOf(Sunday)` returns that same Sunday → on Sunday it targets the just-**starting** (empty) week. The cron `functions/aggregators/sundayDailyToWeekly.js::resolveWeekToAggregate` correctly subtracts 7 days (with a comment naming this exact trap). Mon–Sat is correct; **only Sunday is wrong.**

## Decisions Locked (do not deviate)
1. **Sunday-conditional ONLY.** Mon–Sat behavior is UNCHANGED (`getSundayOf(today)` = current logging week). Sunday → the prior completed week. A blanket prior-week is FORBIDDEN (breaks Mon–Sat logging).
2. Reuse the canonical helper `src/lib/leaderboard/prevWeekStarting.js` IF Phase 0 confirms its semantics == "the Sunday of the most-recently-completed TT week"; else an inline `-7` mirroring `resolveWeekToAggregate`. No third variant.
3. The #687 deep-link (`onReviewSubmit(weekStarting)`) inherits the corrected value — no separate change; confirm it passes the completed week.
4. Verify the `isTodaySunday` memo (~L399) is declared before the `weekStarting` memo if they become co-dependent.

## Phase 0 — source re-verify (STOP-and-report triggers below)
1. Confirm `prevWeekStarting` semantics + safe reuse (or use inline `-7`).
2. **Audit the wizard's direct-entry default** (`getMostRecentSunday` in `AgentDashboard`): does opening the wizard NOT via the deep-link also default to the empty starting week on Sunday? If a trivial same-shape fix → include it; if broader → bank as FU and report.
3. **Draft-population timing (residual-risk gate):** is the completed week's weekly DRAFT kept current by daily writes (client-side `aggregateCurrentWeekDaily`) so the deep-link wizard is populated BEFORE the Sun 23:00 cron runs? If the draft only populates at the cron, **STOP and report** — scope may need "ensure target-week aggregation on deep-link," which is a decision for the dispatcher, not an autonomous expansion.

## Scope
The single `weekStarting` correction in DCv2 (Sunday-conditional) + conditionally the wizard-default fix (per Phase 0 #2). Nothing else.

## NON-scope
Mon–Sat logic; the cron (already correct); pace (Phase 3); any wizard step-entry work.

## Phase 1 — implement the Sunday-conditional week selection.

## Phase 2 — static verify
Lint/build/full suite + component tests: weekStarting resolves to the **prior** Sunday when `isTodaySunday`, and to the current Sunday Mon–Sat (table-drive a Sunday date and a weekday date); the deep-link passes the corrected week.

## Phase 3 — smoke (SEEDED non-empty Sunday — this is the headline proof)
1. Seed daily entries for the week BEFORE the forced Sunday (so the completed week is non-empty).
2. Force date to that Sunday (BACKWARD Sunday, auth-safe).
3. Assert the DCv2 confirm shows the **completed** week's entries — **non-empty** aggregation (closes the long-deferred check).
4. Tap "Review & submit" → assert the wizard opens on the **completed** week (`weekStarting` = prior Sunday), pre-filled.
5. Both themes; axe NO-NEW vs main.
If the seed-then-force path is intractable, STOP and report — do not downgrade to a wiring-only smoke and call the non-empty check done.

## Phase 4 — docs (note this supersedes the #687 Rule 13 Sunday deferral).
## Phase 5 — branch `fix/daily-capture-v2-2-2-sunday-week` off `main`; PR; Rule 20 SHA; HOLD.
## Phase 6 — Gemini disposition.

## Self-critique (Rule 22)
The load-bearing residual is Phase 0 #3 (draft timing). If the draft only populates at the 23:00 cron, the week-targeting fix alone still yields an empty wizard for an agent who deep-links Sunday morning — the fix would look correct in a seeded smoke yet fail in production timing. That gate must be answered, not assumed. Secondary: the wizard direct-entry default (Phase 0 #2) may quietly carry the same bug on a path this fix doesn't touch.

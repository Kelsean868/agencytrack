# Brief — Daily Capture v2 · Phase 2.2: Sunday review shows the completed week, from a live draft

**Supersedes** `brief-daily-capture-v2-2-2-sunday-week-fix.md` (week-targeting-only; expanded now that there is no live data and we are doing the full fix).
**Track:** Daily Capture v2 · **Phase:** 2.2. **Size:** M. **Merge:** HUMAN-MERGE (save-path + draft writes).
**Stacks on:** `main` (#687 / `4a12532`). **Data note:** no agent has used the app; existing entries are disposable — no migration, no preservation of existing drafts. (The in-draft merge requirement below is for correctness once agents DO use it.)

## Goal
Make the Option B chain work end-to-end: daily log → **live** weekly draft → Sunday review of the **completed** week → pre-filled submit. Two coupled fixes, one end-to-end proof.

## The two fixes
1. **Week-targeting (DCv2).** `weekStarting` Sunday-conditional → the completed (prior) week, via inline `-7` mirroring `sundayDailyToWeekly.js::resolveWeekToAggregate`. Mon–Sat unchanged. The Sunday summary + the #687 deep-link both target the completed week.
2. **Aggregate-on-save (draft currency).** The daily-save path also recomputes the current week's draft via the EXISTING client aggregator `aggregateCurrentWeekDaily`, so the draft stays current as the agent logs. By Sunday, the completed-week draft is built → the deep-link wizard pre-fills.

## Decisions Locked (do not deviate)
1. Week-targeting is **Sunday-conditional ONLY** — Mon–Sat keeps `getSundayOf(today)`. Blanket prior-week FORBIDDEN.
2. Reuse the EXISTING `aggregateCurrentWeekDaily`. Do NOT write a new aggregator. Saves happen Mon–Sat, where its `getMostRecentSunday` key already resolves to the correct current week — no key change on the save path.
3. The aggregator MUST **merge**: recompute activity fields from daily, PRESERVE manual ratings/targets + status already in the draft. (Phase 0 establishes current behavior.)
4. **Failure isolation:** the daily save writes the daily doc FIRST (must succeed); aggregation runs after, best-effort — a thrown aggregation must NOT fail the log. Log/swallow, don't propagate.
5. Wizard direct-entry default Sunday-edge stays an **FU** (out of scope — different module, affects weekly-only agents).

## Phase 0 — source re-verify (STOP-and-report triggers)
1. **Merge behavior (load-bearing):** does `aggregateCurrentWeekDaily` preserve manual ratings/targets when it recomputes, or clobber the draft doc? If clobber → report; merge-handling is then in scope (flag the size).
2. **Wiring:** can the daily-save path call `aggregateCurrentWeekDaily` cleanly (no circular import)? Confirm the await + failure-isolation shape per Decision #4.
3. **Prefill read:** confirm the wizard's `getDraft` reads the same draft doc the aggregator writes.
4. **Submit path intact:** confirm activity is snapshotted into the submission at submit so `onSubmissionWrite`/leaderboard read stable numbers — this fix must not disturb that.

## Scope
DCv2 week-targeting + aggregate-on-save wiring on the daily-save path + (if Phase 0 #1 shows clobber) aggregator merge-handling. Nothing else.

## NON-scope
New aggregator; the cron (already correct); wizard direct-entry default; pace (Phase 3); any wizard step-entry work.

## Phase 1 — implement both fixes.
## Phase 2 — static verify
Lint/build/full suite + component/unit tests: weekStarting resolves to the prior Sunday when `isTodaySunday` (and current week on a weekday); the save path invokes the aggregator and isolates its failure; the aggregator preserves a pre-set ratings/targets field across a recompute (merge test).

## Phase 3 — smoke (END-TO-END, the full Option B chain)
1. Via the app, log daily entries across a week through the real save path (so on-save aggregation builds the draft).
2. Force date to the FOLLOWING Sunday (backward Sunday, auth-safe).
3. Assert the DCv2 Sunday confirm shows the **completed** week, **non-empty** summary.
4. Tap "Review & submit" → assert the wizard opens on the **completed** week, **pre-filled** with the aggregated activity.
5. Pre-set a manual field (e.g. a target) in the draft, log one more daily entry, assert the on-save recompute **preserved** the manual field (merge proof).
6. Both themes; axe NO-NEW vs main.
If any leg is intractable, STOP and report — do not downgrade the prefill or merge assertions and call them done.

## Phase 4 — docs (this supersedes the #687 Rule 13 Sunday deferral and the week-fix brief).
## Phase 5 — branch `fix/daily-capture-v2-2-2-sunday-review-live-draft` off `main`; PR; Rule 20 SHA; HOLD.
## Phase 6 — Gemini disposition.

## Self-critique (Rule 22)
The merge behavior (Phase 0 #1) is the load-bearing unknown: if the aggregator clobbers and we ship it, an on-save recompute could wipe ratings/targets the agent entered — the Phase 3 #5 merge proof exists precisely to catch this and must not be waived. Secondary: aggregate-on-save adds a read-7 + write to every daily save; confirm it's awaited and failure-isolated so logging never blocks on it, and that it doesn't double-fire per keystroke (debounce/save-commit boundary).

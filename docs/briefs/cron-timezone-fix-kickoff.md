# Cron Timezone Fix — Kickoff Brief

**Status:** Ready to dispatch to fresh CC session.
**Estimated CC effort:** 1–2 hours including pre-merge deploy + gcloud verification.
**Two-strike counter:** Project carry-in **0/2** (clean — post PR-F, memory refresh, doCreateUser emailQueued, Track D Phase 1 investigation). Standard 2-strike loop applies.
**Main HEAD at brief drafting:** post-#136 squash SHA (will be captured by CC in Phase 1).
**Source:** Track D Phase 1 investigation (Track D cron portion verification FOLLOW_UPS entry) — surfaced timezone misconfiguration on all 4 scheduled CFs.

---

## Context

Phase 1 investigation confirmed all 4 scheduled Cloud Functions are deployed and firing, but fire in `America/Los_Angeles` (Firebase Functions v1 default) instead of UTC. The cron strings in source are written for UTC interpretation (visible in code comments like "Sunday 6 PM Trinidad time (22:00 UTC)"), so the LA timezone causes 3–7 hour drift from intended fire times.

User-facing impact pre-fix:

- `sendSundayNudge` — fires Mon 01:00 AST instead of Sun 18:00 AST (agents asleep, useless)
- `sendMondayNudge` — fires Mon 14:00 AST instead of Mon 07:00 AST (5 hours AFTER 9 AM deadline, embarrassing copy)
- `flagMissedDeadlines` — fires Mon 16:01 AST instead of Mon 09:01 AST (lets late agents off the hook)
- `aggregateDailyToWeekly` — fires Mon 06:00 AST instead of Sun 23:00 AST (functionally OK due to internal date math, but wrong wall-clock)

This brief fixes it.

---

## Decisions locked (do not re-litigate)

### Fix path: Option A — chain `.timeZone('UTC')`, leave cron strings unchanged

Considered alternative (Option B): rewrite cron strings to AST-local time and chain `.timeZone('America/Port_of_Spain')`. Rejected because:
- Option A matches the original author's UTC-interpretation reasoning (visible in existing code comments)
- Option A is one-line per function vs. two-edit per function for Option B
- Option A leaves cron strings matched to their existing UTC comments (no risk of comment drift)
- Both UTC and AST are DST-immune — no advantage to either on that axis

### Schedule intent is unchanged

The cron strings stay as-is. No intent change — we're correcting the timezone so the existing intent is actually realized.

### Pre-merge deploy permitted

Per the banked C2 additive-deploy rule, deploying functions from the feature worktree pre-merge is allowed when the deploy is additive/non-breaking. This deploy is technically a behavior change (different fire times) but production already runs broken, so deploying the fix from preview is strictly an improvement.

### Verification gate: `gcloud scheduler jobs describe`

Post-deploy verification is the merge gate. All 4 jobs must show:
- `timeZone: UTC`
- `scheduleTime` advanced to the correct next UTC fire instant

No automated smoke — cron behavior can't be practically unit-tested (would require waiting for actual fire). Manual gcloud verification + log spot-check after next natural fire is the verification path.

---

## Scope

Ships in this single PR:

- `.timeZone('UTC')` chained to all 4 scheduled CFs (3 in `functions/index.js`, 1 in `functions/aggregators/sundayDailyToWeekly.js`)
- Pre-merge deploy from feature worktree
- gcloud verification documented in PR description
- `docs/CONTEXT.md` "Recently shipped" row append (5-row sliding window, drop oldest)
- `docs/FOLLOW_UPS.md` — mark "Track D cron portion verification" entry resolved with closing PR # placeholder

---

## File inventory

**Files to touch:**

| Path | Change |
|---|---|
| `functions/index.js` | Chain `.timeZone('UTC')` to `sendSundayNudge`, `sendMondayNudge`, `flagMissedDeadlines` schedule definitions |
| `functions/aggregators/sundayDailyToWeekly.js` | Chain `.timeZone('UTC')` to the aggregator schedule definition |
| `docs/CONTEXT.md` | Append "Recently shipped" row (SHA/PR# placeholders post-merge) |
| `docs/FOLLOW_UPS.md` | Mark "Track D cron portion verification" entry resolved with closing PR # placeholder |

**No new files expected.**

---

## Phases

### Phase 1 — Re-verification (gates Phase 2)

Phase 1 of Track D already happened (the investigation that surfaced this bug). This Phase 1 is a fast sanity re-check before editing:

1. Re-grep `functions/` for all `pubsub.schedule(` / `onSchedule(` / `scheduled*` exports. Confirm count is exactly 4 and matches the previously-identified set.
2. Check each of the 4 functions for any existing `.timeZone()` chain. There should be zero — if any function already has a timezone set, STOP and surface (suggests partial fix or different intent).
3. Confirm Firebase Functions runtime is v1 across all 4 (the `.timeZone()` API differs in v2; v2 uses `{ schedule: '...', timeZone: '...' }` in the options object).
4. Capture current main HEAD SHA via `git log origin/main --oneline -1` for the brief header trace.

Surface confirmation in chat: "4 scheduled CFs confirmed, no existing timezone chains, all v1, main HEAD `<sha>`. Proceeding to Phase 2."

If anything diverges from expectation → STOP and surface.

### Phase 2 — Apply timezone chains

- Single-line addition per function: `.timeZone('UTC')`
- For v1 syntax: `functions.pubsub.schedule('0 22 * * 0').timeZone('UTC').onRun(...)` — chain order matters per Firebase docs (schedule first, then timeZone, then onRun)
- No cron string changes
- No handler logic changes

### Phase 3 — Pre-merge deploy + gcloud verification

1. From the feature worktree: `firebase deploy --only functions:sendSundayNudge,functions:sendMondayNudge,functions:flagMissedDeadlines,functions:aggregateDailyToWeekly`
2. Wait for deploy completion (~30–60s)
3. For each of the 4 jobs, run `gcloud scheduler jobs describe <job-name> --location=<region>` and capture output. Confirm:
   - `timeZone: UTC`
   - `scheduleTime: <next-fire-in-UTC>` reflects the new schedule (compare against pre-deploy `scheduleTime` to verify it advanced/shifted)
4. Compute the expected next AST wall-clock fire from the `scheduleTime` and assert it matches intent:
   - `sendSundayNudge`: next Sunday 22:00 UTC = Sunday 18:00 AST ✓
   - `sendMondayNudge`: next Monday 11:00 UTC = Monday 07:00 AST ✓
   - `flagMissedDeadlines`: next Monday 13:01 UTC = Monday 09:01 AST ✓
   - `aggregateDailyToWeekly`: next Monday 03:00 UTC = Sunday 23:00 AST ✓

If any job fails to show `timeZone: UTC` or `scheduleTime` doesn't match the expected UTC instant → STOP and surface.

### Phase 4 — Doc updates, commit, push, PR

- Update `docs/CONTEXT.md` Recently-shipped row with placeholders
- Update `docs/FOLLOW_UPS.md` to mark Track D entry resolved with placeholder
- `npm run lint` → 0 errors
- `npm run build` → success
- Conventional commits (single or split — CC's call)
- Push, open PR
- **PR title:** `fix(functions): chain .timeZone('UTC') to all 4 scheduled CFs (Track D)`
- **PR description must include:**
  - Summary
  - Brief premise correction documented (CC's Phase 1 recommendation said "keep cron strings as-is with Port_of_Spain timezone"; corrected to UTC timezone per Kyron's math review)
  - gcloud describe output for all 4 jobs showing `timeZone: UTC` and correct `scheduleTime`
  - Verification matrix

### Phase 5 — STOP

DO NOT MERGE. Kyron reviews, runs independent gcloud spot-check, merges manually.

---

## Hard stops

- `npm run lint` fails → fix, don't commit broken state
- Number of scheduled CFs found ≠ 4 → STOP and surface (suggests new function was added or one was removed)
- Any function already has `.timeZone()` chained → STOP and surface (partial fix or different intent already deployed)
- Firebase Functions runtime is v2 for any of the 4 → STOP and surface (different timezone syntax, brief assumes v1)
- `firebase deploy` fails → STOP and surface, do not retry
- Post-deploy `gcloud scheduler jobs describe` shows `timeZone` is NOT `UTC` → STOP and surface
- Post-deploy `scheduleTime` does NOT match expected UTC instant → STOP and surface
- First unexpected behavior of any kind — standard 2-strike loop applies, but lean toward surfacing early

---

## NOT in scope

- v2 Cloud Functions migration (separate ticket, not pilot-blocking)
- Cron string rewrites (Option B was rejected)
- Schedule time changes — intent stays the same, we're just correcting timezone
- Adding new scheduled functions
- Modifying notification copy / email templates / handler logic
- `firebase.json` runtime config changes
- Server-side tenant isolation for scheduled CFs (SEC-9c — separate ticket)
- Adding automated tests for cron behavior (impractical without time mocking)

---

## Verification matrix (CC must include in PR description)

| Item | Command | Expected |
|---|---|---|
| Lint clean | `npm run lint` | 0 errors |
| Tests pass | `npm test` | 100% pass, no new failures |
| Build succeeds | `npm run build` | success, no warnings |
| sendSundayNudge timezone | `gcloud scheduler jobs describe sendSundayNudge` | `timeZone: UTC` |
| sendMondayNudge timezone | `gcloud scheduler jobs describe sendMondayNudge` | `timeZone: UTC` |
| flagMissedDeadlines timezone | `gcloud scheduler jobs describe flagMissedDeadlines` | `timeZone: UTC` |
| aggregateDailyToWeekly timezone | `gcloud scheduler jobs describe aggregateDailyToWeekly` | `timeZone: UTC` |
| Next fire times match AST intent | (computed from `scheduleTime` UTC) | All 4 match expected AST intent |
| CONTEXT.md updated | `git diff docs/CONTEXT.md` | "Recently shipped" row added, oldest removed |
| FOLLOW_UPS.md updated | `git diff docs/FOLLOW_UPS.md` | Track D entry marked resolved |

---

## CC kickoff prompt (one-liner)

> Execute the cron timezone fix per the brief in `docs/briefs/cron-timezone-fix-kickoff.md`. Project strike count 0/2 (clean). Standard 2-strike loop. Pre-merge deploy permitted per banked C2 additive-deploy rule. Read the brief, begin Phase 1 (re-verification), surface the verification result before Phase 2. Do NOT merge — open PR with gcloud verification output, stop.

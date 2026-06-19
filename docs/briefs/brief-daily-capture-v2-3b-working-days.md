# Brief — Daily Capture v2 · Phase 3b: Configurable working days (pace denominator + strip)

**Track:** Daily Capture v2 · **Phase:** 3b. **Size:** S–M.
**Merge:** HUMAN-MERGE — pace/points-adjacent + tenant config. **Stacks on:** `main` (after `/post-merge 689`).

## Goal
Replace 3a's hardcoded 5-day week with a configurable `workingDaysPerWeek`, so the pace denominator and the week strip respect the actual work week (e.g. a Saturday-working tenant paces against /6, and Saturday shows as a working day in the strip).

## Decisions Locked (do not deviate)
1. **Tenant default**, NOT per-agent: `workingDaysPerWeek` lives in `config/companyMinimums` and rides the existing `getCompanyMinimums` pipeline the floors already use. No new Firestore read, no agent self-write, no rules change (the Tenant Admin already writes `companyMinimums`). Per-agent override is explicitly DEFERRED.
2. Default **5**; allowed **{5, 6}**. `7` is out of model (Sunday is the review day, not in the strip). Treat absent/invalid as 5.
   - 5 = Mon–Fri working, Sat+Sun off. 6 = Mon–Sat working, Sun off.
3. **Strip** (`deriveWeekStripDays`): replace the hardcoded `isOff: d.getUTCDay() === 6` with `isOff` derived from `workingDaysPerWeek` — Saturday is off iff `wd < 6`. Mon–Fri always working; Sunday is not in the strip.
4. **Pace denominator**: replace 3a's `WORKING_DAYS = 5` constant with the configured `wd`. `weekToDateTarget = weeklyPointsFloor × (elapsedWorkingDays / wd)`; `elapsedWorkingDays` counts Saturday only when `wd = 6`.
5. Off days never break streaks/nudges (carry 3a behavior).

## Phase 0 — source re-verify (STOP-and-report triggers)
1. Confirm `getCompanyMinimums` is the read path 3a already added the floors fetch through, and that `workingDaysPerWeek` can ride that same fetch (one read). Confirm adding the field needs NO rules change.
2. **UI surface:** is there an existing admin UI for `companyMinimums`/floors? If YES → add a `workingDaysPerWeek` control (5/6) to it. If floors are set via script/Firestore only → 3b adds NO new UI; the value is set via the existing `companyMinimums` path + a seed. Report which, and do not build a new admin surface unilaterally if none exists — report first.
3. Confirm the exact locations of 3a's `WORKING_DAYS` constant and the `elapsedWorkingDays` helper (the swap points).

## Scope
The `companyMinimums.workingDaysPerWeek` read (default 5) + the two wirings (strip off-day derivation + pace denominator) + (conditional, per Phase 0 #2) the admin-UI control.

## NON-scope
Per-agent override; `wd = 7` / Sunday-as-working; the floor values themselves; a per-agent Profile UI; any new admin surface if none exists.

## Phase 1 — implement.

## Phase 2 — static verify
Lint/build/full suite + unit tests: `deriveWeekStripDays` off-days for `wd = 5` vs `wd = 6` (Saturday flips); `elapsedWorkingDays` across the week for both (Saturday counts only at 6); the pace denominator uses `wd`; **absent/invalid `wd` falls back to 5** (no `NaN`/divide-by-zero in the denominator — assert this explicitly).

## Phase 3 — smoke (REAL)
Seed `tatillife_smoke` `companyMinimums.workingDaysPerWeek = 6`; assert the strip renders Saturday as a working (non-off) cell AND the pace target reflects `/6` (a known points total lands in a different badge state than it would at `/5`). Also exercise the default-5 path (field absent → strip Saturday off, denominator 5). Both themes; axe NO-NEW.

## Phase 4 — docs (close the 3a `WORKING_DAYS` deferral FU).
## Phase 5 — branch `feat/daily-capture-v2-3b-working-days` off `main`; PR; Rule 20 SHA; HOLD.
## Phase 6 — Gemini disposition.

## Self-critique (Rule 22)
The tenant-default choice means a mixed-schedule tenant (some agents work Saturdays, some don't) can't be modeled until a per-agent override lands — deferred, acceptable for a uniform-work-week pilot, flagged. The load-bearing robustness item is the default-5 fallback: an absent or malformed `workingDaysPerWeek` must resolve to 5, never to `0`/`undefined`/`NaN` in the pace denominator — the Phase 2 test must pin this so a bad config can't divide-by-zero the pace math in front of a live agent.

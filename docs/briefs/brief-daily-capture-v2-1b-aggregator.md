# Brief — Daily Capture v2 · Phase 1b: Aggregator extension + distinct telContacts weekly field

**Track:** Daily Capture v2 · **Phase:** 1b of N (stacks on 1a). **Size:** L (careful).
**Merge:** HUMAN-MERGE — money + rules-affecting (aggregator → leaderboard/points; weekly schema; floor; new Firestore rules). Do NOT auto-merge.
**Stacks on:** `feat/daily-capture-v2-1a-schema` (branch off its HEAD).

## Goal
Roll the 1a daily funnel fields into the weekly draft, and add a real distinct `telContacts` field across weekly + floor + extractFields (full parity, ratified).

## Recon anchors (2026-06-17 — CC RE-CONFIRMS Phase 0, Rule 17)
- Aggregators: `functions/aggregators/sundayDailyToWeekly.js` (cron) + `src/services/loggingModeService.aggregateCurrentWeekDaily` (client). Possible shared map: `functions/aggregators/dailyToWeekly.js` — LOCATE the single source of the field map and extend THERE.
- `extractFields.js:86` — `telContacts` already falls back to `qualifiedApproaches`. Weekly floor: `src/utils/weeklyActivityFloors.js` (`contactsMade: 40`).
- Weekly target names per recon reconciliation table.

## Scope
1. **Aggregator field-map extension** — sum each 1a daily field into its weekly target, idempotent (Σ, never `+=`); preserve the skip-if-`submitted` guard. Both cron + client paths stay in sync (extend the shared map once if it exists).
   - Σ-by-same-key where aligned (prospectingLettersSent, seminarsConducted, f2fAttempts, livesSold, policiesDelivered, officeHours, fieldHours).
   - `dials` → weekly dials total. **Lean:** for daily-originated weeks, daily `dials` total IS the week's dial count — bypass the 4-call-type split; CC confirms against `computeProspectingCallsActual()` and reports the chosen mapping.
   - social daily fields → the 4 live weekly social fields (+ platform breakdown if captured).
   - `newNamesAdded` → `namesFromOther`.
2. **Distinct `telContacts`** — add to weekly Step 3 schema (`INITIAL_DATA`); switch `extractFields` to use it directly (fallback already present); remap floor `contactsMade` → `telContacts`; daily `telContacts` (from 1a) aggregates into it. Update `planVariance` if it reads the proxy.

## NON-scope: UI (Phase 2), pace/floor-in-points (Phase 3), reopen-after-submit.

## Phase 0
- Locate the single aggregator field-map source; confirm both paths extend together.
- Confirm 1a's landed daily field names match this brief (if 1a Phase-0 renamed any weekly target, **HALT and flag** before building on a wrong name).
- Confirm whether weekly/daily rules field-validate (telContacts + new daily fields → rules update; flag clearly — keeps HUMAN-MERGE).

## Phase 1 — implement (per scope). Phase 2 — lint/build/tests + aggregation unit tests (Σ correctness, idempotent recompute, back-fill re-sync).
## Phase 3 — smoke (REAL write-read-verify): log in (smoke tenant) → write daily docs across ≥2 days with the new fields → trigger mid-week client recompute → reload weekly draft → assert each new field aggregated to the correct weekly target; assert re-running is idempotent.
## Phase 4 — docs placeholders (CONTEXT, FOLLOW_UPS). Phase 5 — branch `feat/daily-capture-v2-1b-aggregator` off 1a HEAD; PR; Rule 20 SHA; HOLD. Phase 6 — Gemini disposition.

## Self-critique (Rule 22)
The `dials` single-total → weekly mapping is the weakest link; if `computeProspectingCallsActual` double-counts a daily-originated dials total against any residual typed calls, flag it rather than guessing.

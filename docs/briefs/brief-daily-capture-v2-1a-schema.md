# Brief — Daily Capture v2 · Phase 1a: Daily schema extension (full funnel parity)

**Track:** Daily Capture v2 (Option B daily reporting)
**Phase:** 1a of N — daily schema extension. Foundation; **additive only**.
**Size:** L (≈14 fields + validation + service surface). No aggregator, no weekly change, no UI.
**Merge:** HOLD for human merge (Kyron). Money-adjacent feature foundation; may touch daily rules.
**Design source:** `Daily Entry — Option B Build` (UI) + `Daily → Weekly Aggregator — Field Map` (data). Full funnel parity ratified 2026-06-17.

---

## Goal
Extend the **existing** `dailyActivity` daily-entry schema so every weekly-wizard funnel field has a daily home. This phase ONLY adds daily fields + validation + service read/write. Aggregation into the weekly draft = Phase 1b. UI = Phase 2. Pace/working-days = Phase 3.

## Recon-verified anchors (2026-06-17 — CC RE-CONFIRMS in Phase 0, Rule 17)
- Collection: `tenants/{tenantId}/users/{userId}/dailyActivity/{YYYY-MM-DD}`.
- Service: `src/services/dailyActivityService.js`. Schema: `src/lib/schema/dailyActivity.js`.
- **Already in daily — do NOT re-add:** appointmentsSet, ffisScheduled, ffiConducted, newCIBooked, oldCIBooked, ciConducted, solutionPresentations, newBusiness.apps/api, pppIncreases.*, lumpsums.*, serviceContacts, oldNamesWorked, hoursWorked (reflection field), wins/blockers/notes, isCatchUp.
- Weekly target names (align daily fields to these so 1b is Σ-by-same-key): per recon reconciliation table.

## Scope — daily fields to ADD
Name each daily field to **match its weekly aggregation target** so Phase 1b is Σ-by-same-key. Where the weekly target is derived/nested, capture a single daily headline and leave the split to 1b.

| Add (daily) | Weekly target · step | Notes |
|---|---|---|
| `prospectingLettersSent` | prospectingLettersSent · 1 | count |
| `seminarsConducted` | seminarsConducted · 2 | count. Tradeshows: see open item |
| `dials` | step 3 (4 call-types → totalCalls) | single daily count; split mapping = 1b |
| `telContacts` | step 3 (proxy vs distinct) | distinct per CD; weekly mapping = 1b |
| `f2fAttempts` | f2fAttempts · 1 | count |
| `socialPostsTotal`, `socialEngagementTotal`, `socialInboxEnquiries`, `namesFromSocial` | step 4 | **match live weekly shape, NOT CD's posts/content/engagements**. Optional `socialPlatformBreakdown.{facebook,instagram,whatsapp,linkedin}` to mirror weekly |
| `newNamesAdded` | namesFromOther · 5 | single headline; channel split stays weekly |
| `livesSold` | livesSold · 7 | count |
| `policiesDelivered` | policiesDelivered · 8 | count |
| `officeHours`, `fieldHours` | officeHours, fieldHours · 9 | aggregating hours; **reconcile vs existing daily `hoursWorked`** (don't duplicate) |

All numerics: `parseFloat`, default 0, reject bad types (domain rule).

## Explicit NON-scope (later phases)
- Aggregator changes (`functions/aggregators/sundayDailyToWeekly.js`, `src/services/loggingModeService.aggregateCurrentWeekDaily`) → **1b**.
- Weekly schema / floor / `extractFields` changes incl. the distinct `telContacts` field → **1b**.
- Option B UI → **Phase 2**.
- `workingDaysPerWeek` + pace/floor derivation → **Phase 3**.
- Reopen-after-submit, notes→reflection concat → out of v1 (Kyron-ratified).

## Phase 0 — source re-verify
1. Confirm recon anchors (paths, existing daily fields, weekly field names).
2. Confirm the live weekly `socialPlatformBreakdown` shape — use it, not CD's guess.
3. Determine whether the daily Firestore rules **field-validate** (allowlist → new fields need a rules update → HUMAN-MERGE) or are **owner-scoped** (no rules change). Report which.
4. Reconcile existing daily `hoursWorked` with new `officeHours`/`fieldHours` — decide replace/derive; do not duplicate.
5. Report any field whose real weekly target name differs from this table BEFORE building.

## Phase 1 — implement
- Add the fields to `src/lib/schema/dailyActivity.js` (types, defaults-to-zero, parseFloat).
- Update `dailyActivityService.js` read/write to carry them.
- If rules field-validate: add the new fields to the daily rules block (flag clearly — this makes it HUMAN-MERGE on rules grounds).
- NO aggregation, NO weekly touch.

## Phase 2 — static verify
- Lint + build clean; full suite passes; add unit tests for the new fields (accept valid, default 0, reject bad types).

## Phase 3 — smoke (REAL write-read-verify)
- Log in as A11Y agent (smoke tenant) → write a `dailyActivity/{date}` doc populating the NEW fields → reload → assert each new field persisted with correct value. No aggregation assertion (that's 1b).

## Phase 4 — docs (with placeholders)
- `CONTEXT.md`: Daily Capture v2 · Phase 1a row (PR #TBD, SHA TBD).
- `FOLLOW_UPS.md`: bank phases 1b / 2 / 3 + open items (below).
- Brief committed under `docs/briefs/`.

## Phase 5 — commit / push / PR
- Branch `feat/daily-capture-v2-1a-schema`; commit; push; open PR; Rule 20 HEAD SHA in report; **HOLD for human merge**.

## Phase 6 — Gemini disposition
- Poll + disposition each comment (Rule 21); in-PR fixes per Rule 9; hold-for-merge report.

## Open items to bank (not blockers)
- Tradeshows: does the daily need a distinct `tradeshowsAttended` count, or is `seminarsConducted` enough? (Weekly step 2 has both.)
- `dials` → 4-call-type weekly split mapping (1b).
- `telContacts` → weekly proxy (`qualifiedApproaches`) vs distinct field (1b decision; rec = distinct).
- `hoursWorked` vs `officeHours`/`fieldHours` reconciliation outcome.

## Self-critique gap (Rule 22)
Known risk: naming daily fields to match weekly targets assumes the recon's weekly names are exact; Phase 0 step 5 is the guard. If any weekly target is nested (e.g. `newBusiness.apps`), the daily field is flat — 1b owns that translation, not 1a.

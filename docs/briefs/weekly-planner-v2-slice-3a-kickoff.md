# Kickoff — Weekly Planner v2 Slice 3a: plan-vs-actual + variance (Game Plan card)

**Size:** L · **Type:** feature, READ/DERIVE ONLY (no new collections, no rules, no writes
from app code) · **Merge:** HUMAN-MERGE + dispatcher pre-review (information-design change
on a shipped surface).
**Branch:** `feat/weekly-planner-v2-slice-3a`
**Layout authority:** `docs/design/Weekly-Planner-Slice-3-Build.html` (lands with this
brief) — S3a implements ONLY the Game Plan committed-card portions; the WeeklyStandardCard
sections of that annotation are S3b and OUT OF SCOPE here.

## Context
S2 (#471) ships committed weekly plans. S3a closes the loop: the committed-plan view's 5
metric rows become PACE ROWS — floor tick (neutral baseline) + plan cap (teal) + actual
fill (variance-colored) + a pace marker ("where you should be today"). Variance is measured
against pace, not the full-week number. S3b (WeeklyStandardCard evolution) follows
separately and will reuse this slice's variance module.

## Locked decisions (dispatcher)

### D1 — Verified actual-source mappings (from the 2026-06-04 read-only probe; cite in PR)
| Plan metric | Weekly actual | Daily actual |
|---|---|---|
| callsMade | SUM of `referralCalls + followUpCalls + coldCalls + seminarTradeshowCalls + serviceCalls` (root fields, submissionService.js:51-55) | **NONE** — hatched "weekly only · no daily pace" |
| contactsMade | `qualifiedApproaches` (:57; `telContacts` is a read-time alias only) | `qualifiedApproaches` (dailyActivity.js:34) |
| factFindsCompleted | `ffiConducted` (:60) | `ffiConducted` (:37) |
| closingInterviewsKept | `ciConducted` (:65) | `ciConducted` (:41) |
| applicationsSubmitted | `newBusiness.apps` (v2 nested, :31; flat-read via extractFields v2 arm) | `newBusiness.apps` (:43) |
- Calls semantics: the 5-component sum INCLUDES serviceCalls **by design**, for parity with
  the wizard's own displayed Step-2 total. Phase 0 must confirm the wizard's UI total sums
  exactly these 5; if it differs, STOP and surface.
- UI honesty: the Contacts row label clarifies the mapping — e.g. "Contacts (qualified
  approaches)" — so agents see what's counted.

### D2 — Variance semantics (operator-default; overridable pre-landing)
Ahead: actual ≥ plan · On-track: actual ≥ 90% of pace · Behind: actual < 90% of pace ·
**Day-1 suppression:** no Behind state until the 2nd working day of the week ·
**Elapsed days:** working days Mon–Sat; Sunday excluded from the pace denominator (week
still starts Sunday per domain rules) · **Floor-above-plan:** no special state — the floor
tick renders wherever it falls, even above the plan cap.

### D3 — Source-of-record switch
If a submitted weekly report exists for the plan's week → actuals come from it, provenance
chip "final · submitted". Otherwise → actuals aggregate the week's dailyActivity docs
(Sun–Sat, doc IDs YYYY-MM-DD), chip "mid-week · daily capture", pace marker live. Calls
mid-week = the hatched no-daily-source state; once submitted, the 5-component sum shows.

### D4 — The variance module is card-agnostic
New pure module `src/utils/planVariance.js` (sibling to goalDecomposition.js): pace
computation, per-metric actual assembly (both sources), variance-state derivation per D2,
provenance resolution per D3, the calls 5-component sum. NO React, NO firebase imports —
S3b consumes the same API. ALL date math TT-safe (`getTodayTT` / parseDateOnlyTT-class
helpers — the canonical UTC-4 trap applies to "elapsed days" and week membership).

## Phase 0 — source-verify (Rule 17)
- The wizard Step-2 UI total = sum of exactly the 5 components (D1 parity check).
- The agent's own dailyActivity read path: collection location
  (`tenants/{tid}/users/{uid}/dailyActivity/{date}`), rules permit own-read, and what query
  shape the week-aggregate needs (7 deterministic doc IDs → direct gets, NO new index).
- What GamePlanV2/AgentDashboard already load (submissions are loaded for other cards —
  reuse, don't refetch; daily docs likely need a new fetch in the GamePlan wiring).
- extractFields.js v2 flat-read arm for the submission-side values.
- The S2 card's committed-view structure + tests (item-14 set + the S2 plan tests must
  stay green; the pace rows replace the committed-view value rows).
- Smoke cleanup path for a dailyActivity doc written during the walk: prefer DELETE via
  whatever the product/rules allow as the agent; if own-delete isn't permitted, surface the
  cleanup method at the stop rather than improvising (delete-not-zero doctrine).
Stop-on-contradiction applies (no mandatory hard stop this slice — no rules/schema).

## Phase 2 — build
`planVariance.js` + exhaustive unit tests (threshold boundaries at 90%, Day-1 suppression,
Mon–Sat elapsed across a TT week incl. Sunday-start edge, calls component sum incl.
missing components, source switch, no-daily-source state, floor-above-plan rendering
input) · committed-view pace rows per the annotation (statusToken success/warning roles,
hatched calls row, provenance chip, floor tick + plan cap + pace marker, both themes,
≥44px, stable testids) · GamePlanV2 wiring (week's submission + daily aggregate; loading/
error states).

## Phase 3 — gates
Lint 0 · full suite (S1 item-14 + S2 plan tests unchanged-green) · build · hex-grep clean.

## Smoke (E3 — real walk, both themes)
Login test agent → commit a plan (S2 path) → Game Plan shows pace rows in the mid-week
state (zero actuals → Day-1/Behind suppression per D2; Calls hatched) → enter a Daily
Capture with values for qualifiedApproaches / ffiConducted / ciConducted / apps via the
real UI → return to Game Plan → assert actual fills + "mid-week · daily capture" chip +
pace marker + correct variance states for the entered values → cleanup: delete the smoke's
plan doc (S2 own-delete) AND remove the daily entry per the Phase-0-determined method →
axe NO-NEW serious/critical + 0 console errors → screenshots of mid-week, hatched-calls,
and (if reachable) ahead/behind states, both themes.

## Phase 4 — docs
Standard placeholders. ALSO bank two FUs: (1) "S2 derived-state live walk — closes when an
8-week submission seed or real usage exists" (carried from #471 pre-review); (2) "Daily
Capture dials field — single-field product enhancement so the calls pace row gains a daily
source; candidate behind S3b."

## Out of scope
WeeklyStandardCard (S3b) · any Daily Capture schema change · notifications · manager
views · any write path beyond what the smoke exercises through existing product UI.

## Acceptance
Mappings exactly per D1 with the parity check passed · variance per D2 incl. suppression ·
source switch per D3 · module card-agnostic per D4 · annotation's Game-Plan grammar
realized both themes · smoke walk PASS incl. cleanup · S1/S2 test sets untouched-green ·
Rules 12/15/17/18/19/20 throughout.

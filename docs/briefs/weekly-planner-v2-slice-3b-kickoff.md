# Kickoff — Weekly Planner v2 Slice 3b: WeeklyStandardCard → plan-vs-actual-with-floor-baseline

**Size:** M · **Type:** feature, READ/DERIVE ONLY (no new collections, rules, or app writes)
· **Merge:** HUMAN-MERGE + dispatcher pre-review (information-design change on the
dashboard's primary weekly card + a floor-comparison semantics change).
**Branch:** `feat/weekly-planner-v2-slice-3b`
**Layout authority:** `docs/design/Weekly-Planner-Slice-3-Build.html` — the
WeeklyStandardCard sections (explicitly out-of-scope in 3a, now IN scope). The Game Plan
sections are shipped (#473) and untouched here.

## Context
S3a shipped `planVariance.js` (card-agnostic by design — D4) and the pace-row grammar on
the Game Plan committed view. S3b brings the same truth to the dashboard:
WeeklyStandardCard evolves from floor-only expectations to plan-vs-actual-with-floor-
baseline, with three honest states and the same variance semantics.

## Locked decisions (dispatcher)

### D1 — Calls-sum reconciliation (HEADLINE; operator-overridable pre-landing)
**5-sum everywhere.** The calls actual on EVERY surface = the S3a 5-component sum
(`referralCalls + followUpCalls + coldCalls + seminarTradeshowCalls + serviceCalls`),
including the WeeklyStandardCard's calls-vs-floor comparison — replacing today's 4-sum
(`totalTelAttempts`) on that card. One number, one truth, parity with the wizard's
displayed total and the Game Plan pace rows.
- Do NOT modify `extractFields.totalTelAttempts` itself or `weeklyActivityFloors.js`'s
  mapping definitions for other consumers. Phase 0 must INVENTORY every consumer of
  `totalTelAttempts` and of the floors mapping: if any OTHER shipped surface compares
  calls-vs-floor with the 4-sum, STOP and surface it — silent cross-surface divergence is
  the failure mode this decision exists to prevent.
- The PR body states the behavior change plainly: service calls now count toward the
  calls floor on this card.

### D2/D3 — Inherited unchanged from S3a
Variance semantics (Ahead / On-track ≥90% of pace / Behind, Day-1 suppression, Mon–Sat
elapsed, floor-tick-renders-anywhere) and the source switch (submitted week → "final ·
submitted"; else daily aggregate → "mid-week · daily capture"; calls hatched mid-week) come
from `planVariance.js` AS-IS. Zero forks of the semantics: if the card needs something the
module lacks, extend the module with tests — never reimplement.

### D4 — Three honest card states (per the annotation)
1. **Plan committed, mid-week:** plan-vs-actual rows — floor tick + plan cap + variance
   fill + pace marker, "mid-week · daily capture" chip; calls hatched.
2. **No plan committed:** TODAY'S floor-only presentation preserved verbatim, labeled
   "Company floor", plus a quiet "Commit a plan in Game Plan →" nudge that navigates to the
   Game Plan tab. The floor is never dressed as a personal plan.
3. **Plan committed, final:** submitted-source rows, "final · submitted" chip, no live pace
   marker, calls resolved via the 5-sum.

### D5 — Contrast doctrine (new, permanent)
**No `text-ink-faint` on any new text — use `text-ink-muted`.** Four consecutive slices
had the smoke catch faint-on-new-text AA failures; this brief bans it at authoring time.
Phase 4 additionally graduates the rule to CLAUDE.md with a one-line addition
(dispatcher-authorized; call it out in the PR body — this PR is human-merge anyway).

## Phase 0 — source-verify (Rule 17)
- Locate WeeklyStandardCard: file, where it mounts (HomeV2 vs legacy dashboard section),
  its current floor-comparison logic and data inputs, its existing tests (baseline that
  must stay green or be consciously evolved — surface which).
- The D1 consumer inventory: `totalTelAttempts` + `weeklyActivityFloors` mapping consumers,
  per the STOP condition above.
- What the card's mount already receives vs needs (submissions are loaded; the week's
  daily docs fetch pattern from S3a's GamePlanV2 wiring — reuse the same
  getDailyEntriesForWeek approach; confirm whether Home and Game Plan can share one fetch
  or each fetches).
- The committed-plan read for the dashboard surface (getWeeklyPlan own-doc get — confirm
  the service call + loading/error handling pattern).
- The annotation's WeeklyStandardCard sections — reconcile against the shipped card's
  structure; flag redesign-class deltas (stop-on-contradiction; no mandatory hard stop —
  no rules/schema this slice).

## Phase 2 — build
Card evolution per D4 using `planVariance.js` outputs · the nudge navigation · preserve or
consciously evolve the card's existing tests (state the choice in the PR) · new RTL tests
for the three states incl. the no-plan fallback and the D1 5-sum floor comparison ·
loading/error states · both themes · ≥44px · stable testids · D5 enforced.

## Phase 3 — gates
Lint 0 · full suite (S1/S2/S3a sets untouched-green) · build · hex-grep clean ·
static-CSS check for any new utilities.

## Smoke (E3 — source-aware, both themes)
Login test agent → dashboard → with the account's existing committed plan absent, commit
one via Game Plan (S2 path) → dashboard card shows the plan-vs-actual state for whichever
D3 arm the account is in (the test agent has a submitted week → expect FINAL arm; assert
source-aware like S3a's smoke) → verify the calls row uses the 5-sum → DELETE the plan
(own-delete) → card reverts to the no-plan floor-only state + nudge; tap the nudge →
lands on Game Plan → cleanup complete (plan already deleted; delete any daily doc the walk
created) → axe NO-NEW serious/critical + 0 console errors (D5 should make this pass
first-run) → screenshots of plan-state and no-plan-state, both themes. Mid-week arm
remains the banked FU (same as S3a).

## Phase 4 — docs
Standard placeholders · CLAUDE.md one-liner per D5 (called out in PR body) · FOLLOW_UPS:
mark Slice 3b shipped in the planner section; note S4 (manager roll-up, get-fan-out
architecture already locked) as the remaining slice.

## Out of scope
S4 · Daily Capture schema changes · `extractFields`/`totalTelAttempts`/floors-mapping
modifications · Playground absorption · manager surfaces · Game Plan card changes.

## Acceptance
D1 5-sum on the card with the consumer inventory clean (or stopped) · D4's three states
per the annotation, both themes · semantics provably from `planVariance.js` (no forks) ·
nudge navigates · prior test sets untouched-green (or consciously-evolved with rationale) ·
smoke PASS incl. the no-plan reversion walk · D5 zero faint on new text · Rules
12/15/17/18/19/20 throughout.

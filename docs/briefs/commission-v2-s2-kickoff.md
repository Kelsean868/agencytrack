# Kickoff — Commission v2 Slice 2: Decomposition Ladder + Modal Targeting restyle

**Size:** M · **Type:** REDESIGN slice, VISUAL/INTERACTION ONLY (no writes, no rules, no
new data reads beyond what the tabs already consume) · **Merge:** HUMAN-MERGE +
dispatcher pre-review.
**Branch:** `feat/commission-v2-s2`
**Layout authority:** `docs/design/commission-v2-s1.html` (on main — the same agent-view
annotation; its ladder + Modal Targeting sections govern this slice). "Set as my goal"
WRITE + manager variant remain S3 — OUT here.

## Locked decisions

### D1 — Engine discipline (the 12-vs-10 convention guard)
The tabs run on TWO characterized engines with DIFFERENT month conventions:
goalDecomposition (working-year: WEEKLY_DIVISOR=43, the ÷10 month) feeds the
decomposition ladder; commissionMath (calendar: monthly=1/12) feeds Modal Targeting's
modeBreakdown/cashFlowForecast. This slice restyles AROUND both engines and changes
NEITHER — the 2026-06-05 characterization suites (34 + chain tests) must pass
untouched-green. Phase 0 cites which engine feeds each displayed figure; any
"inconsistency" between conventions is documented behavior, not a bug to fix.

### D2 — The 7-stage ladder (GoalDecompositionTab restyle)
Per the annotation: Income → pre-tax → 1st-yr commission → API → Apps → CIs →
**Prospecting calls** → Prospects, each connector showing its transform; cadence toggle
(Annual/Semi/Quarter/Month/Week per the engine's divisors — cite, don't hardcode). The
dials-stage label is "Prospecting calls" everywhere (ratified #477/#491 semantics); no
user-visible "Dials" copy may remain in these tabs. The engine's outputs are untouched —
this is presentation.

### D3 — Modal Targeting restyle
Mode-mix control → API required + the stacked 12-month cash-flow chart with cumulative
overlay per the annotation. Recharts + Nexus tokens, no gradients, both themes, ≥44px
controls. Engine = commissionMath (characterized — reuse, never reimplement).

### D4 — Empty-state upgrade (supersedes the annotation; operator veto at merge)
DISPATCHER-DECIDED from the banked S1 design question: YTD earned and run-rate are
goal-independent facts, so the no-committed-goal AnchorStrip state now SHOWS them,
suppresses only the gap figure, and keeps the navigate-CTA. Rationale: an agent with
real earnings and no goal should never see an empty wallet. Small change to
CommissionAnchorStrip states + its tests; the S1 smoke's no-goal assertions evolve
consciously.

### D5 — React imports pre-authorized (un-park the RTL baseline)
Add the one-line `import React from 'react'` to GoalDecompositionTab.jsx and
ModalTargetingTab.jsx (the #153 vitest lesson; PARKed 2026-06-05). Then COMPLETE the
parked expand-dependent RTL baseline (tab switch, input interaction, localStorage
assumption persistence — the 4 parked tests), updated to the restyled DOM. Close the
PARK FU.

## Phase 0 — source-verify (Rule 17)
Which engine/function feeds each tab figure (cite per displayed number) · the cadence
divisor sources in both engines · the ratio auto-fill function (cited in S1 Phase 0 —
re-cite for the restyled ladder's "auto-filled from your history" affordances) · current
tab DOM/test structure (evolutions enumerated) · AnchorStrip state logic for D4 ·
testids for the smoke · NumField labels (fixed in S1 — verify no regression).

## Phase 3 gates
Lint 0 · full suite — the S1 anchor suite, both characterization suites, and the
baseline tests untouched-green or consciously evolved (enumerate) · build · hex-grep ·
static-CSS on new utilities.

## Smoke (E3 — AGENT credential, both themes, source-aware)
Commission tab → ladder renders all 7 stages with transforms · cadence toggle
interaction changes displayed figures · a recompute spot-check: one ladder figure ==
the goalDecomposition engine recompute for the same inputs (client-side parity, the
established == pattern) · Modal Targeting renders the chart + mix control interaction ·
D4: the AnchorStrip arm the data yields (no-goal state now asserts YTD/run-rate visible
+ gap suppressed) · axe NO-NEW vs the bell-badge baseline · 0 console errors · §2
screenshots both themes. Read-only.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: close the React-import PARK FU + the S2 design
question (resolved by D4) · S3 (the write + manager suggest-a-goal) stays queued with
a note that its brief locks the goal-write shape against the cascade.

## Out of scope
Any write · "Set as my goal" wiring · manager variant · engine math changes · new data
fetches · Goals/Persistency surfaces.

## Acceptance
Annotation-true ladder + targeting in both themes · zero engine drift (characterization
suites green untouched) · "Prospecting calls" copy throughout, zero "Dials" ·
D4 state shipped with evolved tests · parked RTL baseline completed + FU closed ·
recompute spot-check green · Rules 12/15/17/18/19/20.

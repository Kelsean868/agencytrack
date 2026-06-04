# Kickoff — Prospecting Calls Flip: floor/plan calls semantics → 4-sum, relabeled

**Size:** XS–S · **Type:** ratified semantics change + relabel (no new data, rules, or
collections) · **Merge:** HUMAN-MERGE + dispatcher pre-review (floor-judgment semantics).
**Branch:** `feat/prospecting-calls-flip`
**Dispatch AFTER #475's post-merge fill is on main** (shared files).

## Ratified decision (operator, 2026-06-04)
Service calls do NOT count toward effort/minimum/plan surfaces. Rationale on record:
service-originated production is already fully credited downstream (approaches, FFIs, CIs,
apps are call-type-agnostic); counting raw service-call volume credits only the gameable,
low-signal part and hides absent prospecting muscle in developing agents. Principle:
SEPARATE, NOT ERASE — service calls stay captured and visible as their own line; they are
no longer conflated into the prospecting metric.

## Locked decisions

### D1 — One prospecting helper, everywhere, atomically
- Add `computeProspectingCallsActual` to `src/utils/planVariance.js`: 4-sum of
  `referralCalls + followUpCalls + coldCalls + seminarTradeshowCalls` (NO serviceCalls),
  same input handling as the existing 5-sum helper. Unit tests incl. the explicit
  5-vs-4 discrimination case (service calls present → excluded).
- Repoint IN ONE PR (no surface may diverge mid-flip):
  1. planVariance's internal callsMade actuals assembly (feeds S3a Game Plan pace row AND
     S3b drawer plan row) → 4-sum.
  2. `deriveWeeklyFloorActuals` callsMade → 4-sum (carries the StandardDetail floor rows
     and the PulseStrip "Standard" chip automatically — verify the chip flows through the
     mapping, cite).
- `computeCallsActual` (5-sum): grep for remaining consumers after the repoint; expected
  ZERO outside tests/smokes → DELETE it (dead-code doctrine, double-proof: grep + suite
  green). If a real consumer exists, STOP and surface — do not leave both exports alive
  silently.
- UNTOUCHED by design: wizard Step-2 displayed total (data-entry sum, stays 5);
  `extractFields.totalTelAttempts` and its consumers (YTD, kiosk, century milestone,
  exports — confirmed working-as-intended under the ratified decision).

### D2 — Honest relabel
Everywhere the plan/floor calls metric renders, the label becomes **"Prospecting calls"**:
the S2 stepper row label, S3a pace row, S3b drawer plan row, the StandardDetail floor row
for calls, and any aria-labels naming it. The label is the parity answer: the number may
differ from the wizard's total, and now it says why. Floor VALUE (e.g. 60) is unchanged —
only what's compared against it. Phase 0 inventories every render site of the calls label
(grep the metric key + current label strings; cite each).

### D3 — Decision record
PR body cites the ratified decision verbatim-in-summary. FOLLOW_UPS: CLOSE the "Dials
display semantics" FU as RATIFIED (prospecting-only on effort surfaces; 4-sum
informational surfaces confirmed correct), with PR # placeholder for /post-merge.

## Phase 0 — source-verify (Rule 17)
Consumer grep for computeCallsActual · render-site inventory for the calls label across
S2/S3a/S3b surfaces · chip-flows-through-mapping citation · current test expectations
that encode the 5-sum (planVariance tests, StandardDetail.s3b, pace tests,
weeklyActivityFloors test — all consciously re-evolve to 4-sum with the rationale comment).

## Phase 2–3
Helper + repoint + relabel + test evolution · lint 0 · full suite green · build ·
hex-grep · D5 (no text-ink-faint) holds for any touched text.

## Smoke (E3, both themes — reuse, don't rewrite)
Update the S3a and S3b smoke scripts' calls expectations to the 4-sum and label
assertions to "Prospecting calls", then run BOTH against the preview. Known data-state
limit: test agent's call components are 0, so the live sum assertion is non-discriminating
(0=0) — the unit discrimination case is the proof; state this in the PR. Axe NO-NEW on
touched surfaces · cleanup per scripts (with the retry added per the 2026-06-04 hygiene
note).

## Phase 4 — docs
FOLLOW_UPS FU closure per D3 · standard placeholders for /post-merge.

## Out of scope
Wizard changes · extractFields/totalTelAttempts · YTD/kiosk/milestone surfaces · Daily
Capture · manager surfaces · any new affordance.

## Acceptance
4-sum is the single plan/floor calls truth on every surface in one atomic PR · 5-sum
export deleted (or STOPped with evidence) · "Prospecting calls" label at every render
site · informational 4-sum surfaces untouched · FU closed as ratified · both smokes PASS ·
prior test sets green via conscious evolution only · Rules 12/15/17/18/19/20.

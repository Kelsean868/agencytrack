# Kickoff — Compliance v2 Slice 3: plan-adoption lens + toggle (completes the surface)

**Size:** M · **Type:** REDESIGN slice — reads via the LOCKED get-fan-out + one
ALLOWLIST EXTENSION to an existing CF (post-merge deploy) · **Merge:** HUMAN-MERGE +
dispatcher pre-review. NO new collections, NO rules changes (#471's upline GET +
S2's nudges rules already cover everything).
**Branch:** `feat/compliance-v2-s3`
**Layout authority:** `docs/design/compliance-v2-s1.html` — the lens-toggle sections.

## Context
S1 shipped the filing lens (read/derive); S2 shipped the row actions (nudge CF +
notifications + unlock/view). S3 adds the second lens: weekly-plan ADOPTION — the
manager sees who has NOT committed a plan this week and nudges them. This completes the
Compliance v2 surface AND delivers S4a of the planner program (the manager-visibility
half that rides Compliance; pace roll-up = S4b, rides WARs v2 later).

## Locked decisions

### D1 — Plan-adoption data via the locked get-fan-out (zero rules changes)
For the current week (TT Sunday), for each roster agent: deterministic-ID GET
`tenants/{tid}/weeklyPlans/{uid}_{weekStart}` (Promise.all, no list query, no index —
the #471 upline-GET rule authorizes UM/BM/SM/TA reads; absent doc = not-committed,
clean not-found). Derive: committed % · committed count · not-committed list.
Loading/error states for the fan-out; roster size bounds N.

### D2 — Lens toggle semantics (per the CD spec + annotation)
A segmented Filing ⇄ Plan adoption toggle swaps the REALITY BAR metric set and the
EXCEPTION LIST beneath in lockstep. Filing lens = today's S1/S2 surface unchanged
(bar, not-in list + Nudge, streak roster, CBTT). Plan lens = bar (committed % ·
committed · not-committed) + the not-committed exception list with Nudge. The streak
roster and CBTT are filing artifacts and render in the FILING lens only. Phase 0
reconciles this against the annotation's lens sections; stop-on-contradiction if the
annotation materially disagrees.

### D3 — Plan nudge reuses S2's machinery
- Same NudgeAction grammar, cooldown chip, Nudge-all confirm — type =
  'compliance.plan.nudge', so the deterministic record
  `nudges/{uid}_compliance.plan.nudge_{weekStart}` dedupes independently of filing
  nudges (an agent can receive both in one week; that is correct).
- CF CHANGE (the slice's only functions edit): extend the TYPE ALLOWLIST to exactly
  ['compliance.filing.nudge','compliance.plan.nudge'] + functions tests (new type
  accepted, unknown types still rejected). Payload lens field = 'plan'.
- EMAIL: new compliance-plan-nudge.txt/.html template pair (kind, minimal, names the
  week, invites committing a plan in Game Plan — no shaming), following the S2
  templates; Phase 0 confirms buildMailDoc template selection mechanics.

### D4 — Deploy choreography + the deferred live leg (READ CAREFULLY)
The CF change EDITS an existing deployed function ⇒ POST-MERGE deploy by the operator
(the corrected doctrine: additive new CFs may deploy pre-merge; edits never do). 
Consequences, stated honestly:
- The PRE-MERGE smoke CANNOT fire a live plan nudge (the deployed CF would reject the
  type). The live plan-nudge leg is DEFERRED-VERIFICATION: a scoped prod check that runs
  immediately after the operator's post-merge CF deploy (see Smoke).
- Functions tests carry the allowlist proof pre-merge; RTL carries the UI wiring proof.

## Phase 0 — source-verify (Rule 17)
The annotation's lens sections vs D2 (stop-on-contradiction) · S2's NudgeAction /
cooldown / Nudge-all components and testids (reuse surface) · getWeeklyPlan or the raw
doc-get pattern to fan out with (cite #471's service or use direct getDoc — pick the
established pattern and cite) · current-week TT weekStart derivation (the canonical
helpers) · buildMailDoc template selection (how type → template maps; extend minimally) ·
the CF allowlist location + test file · confirm NO rules edits are needed (cite the
#471 + S2 blocks).

## Phase 2 — build
Lens toggle + plan bar + not-committed list per annotation · the fan-out hook with
loading/error · plan NudgeAction wiring (cooldown GET works pre-deploy — the upline GET
is rules-side and live) · CF allowlist + tests · email templates · RTL: toggle swap,
plan bar derivation from mocked plans, not-committed exactness, plan-nudge handler
wiring (mock the callable) · D5/D6 conventions throughout (muted-not-faint;
bg-primary always with dark:bg-primary-dark on white-text buttons).

## Phase 3 — gates
Lint 0 · vitest suite green · build · hex-grep · functions tests green (incl. the
allowlist pair) · CI both jobs.

## Smoke (E3 — BM, both themes) + deferred leg
PRE-MERGE (preview): toggle swaps bar + list in lockstep both directions → plan bar
counts CONSISTENT with a manual fan-out recompute (bar == derived) → not-committed list
exact → filing lens unchanged (S1/S2 legs spot-checked: bar, one cooldown chip if
present, View) → plan-Nudge button renders enabled with correct copy (DO NOT fire — the
deployed CF rejects the type; assert the button + confirm-free single-nudge wiring via
RTL only) → axe enumerate-and-accept (S1 allowlist) 0 unexpected · 0 console errors ·
§2 screenshots both themes, both lenses.
POST-MERGE (the deferred leg, runs in the /post-merge session AFTER the operator's CF
deploy): fire ONE live plan nudge as BM on prod → CF success → cooldown chip renders →
creator-delete the nudges record → getDoc-confirm gone → report. Bell + audit + one
email are durable by design (the S2 clarification). This leg is part of acceptance —
/post-merge for this PR is not complete without it.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: Compliance v2 COMPLETE (S1+S2+S3); planner S4a
DELIVERED via the plan lens (S4b pace roll-up remains, rides WARs v2); note the
deferred-leg result slot · CONTEXT next-track updates accordingly.

## Out of scope
Agent inbox · escalation · plan-pace data on this surface (S4b) · streaks for plans ·
Master Sheet · any rules edit · template refactors beyond the new pair.

## Acceptance
Toggle lockstep per D2 with the annotation reconciled · plan bar provably consistent
with the fan-out · zero rules edits (cited) · allowlist extended with functions-test
proof · pre-merge smoke PASS with the no-fire constraint honored · the POST-MERGE
deferred leg executed and reported (live plan nudge round-trip + cleanup) · filing lens
regression-free · Rules 12/15/17/18/19/20 + D4 choreography exactly.

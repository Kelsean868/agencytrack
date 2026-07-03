# PR-B1 - Plan Upline Read Arms + Honesty Copy (Fork B slice 1)

run_model: claude-opus-4-8
size: S-M
track: Game Plan manager review (Fork B), slice 1 of 3 (B1 rules+copy -> B2 drawer -> B3 suggest-back)
depends_on: GPM1 #785 (Team Plans reader); recon @ 1e8e0d3e
rules_change: YES (two additive get arms) | data_model_change: NONE
deploy_required: YES - MANUAL by Kyron (firebase deploy --only firestore:rules)
channel: HUMAN-MERGE (firestore.rules)

## Intent
Consent model (dispatcher-ruled): moneyNeeds stays OPT-IN (toggle, unchanged);
yearPlan + monthlyPlan become UNCONDITIONAL-UPLINE readable, mirroring weeklyPlans
("like submissions"). This slice lands the two rules arms + the emulator matrix + the
agent-facing honesty copy that makes the boundary explicit. No manager UI consumes the
arms yet (that is B2) - but the copy is only truthful once the rules are live, so copy
and rules ship together.

## Locked design (from recon, do not re-derive)
- Helper does NOT port verbatim from weeklyPlans: yearPlan/monthlyPlan are user
  subcollections (users/{uid}/...), so the helper keys off the PATH uid - no
  planId.split. One block-local helper per block (uplineCanReadUserPlan()):
  canManage && (role in [sales_manager, tenant_admin, platform_admin]
    OR (unit_manager && get(users/{uid}).unitId == callerUnitId)
    OR (branch_manager && get(users/{uid}).branchId == callerBranchId)).
- Get arm: owner OR upline, WITH the weeklyPlans existence-oracle guard replicated
  (resource == null -> deny, not not-found). LIST stays owner-only (get-fan-out shape:
  no manager list arm, no index, no collectionGroup wildcard).
- NO visibility gate on these two docs - that is the ruled difference from moneyNeeds.

## Phase 0 - Falsification (STOP on any miss)
0.1 Cite current owner-only arms + the TODO comments reserving this slice
  (yearPlan ~firestore.rules:1486-1518; monthlyPlan ~:1521-1529).
0.2 Cite the weeklyPlans upline arm + existence-oracle (~:1418-1443) and the moneyNeeds
  sibling arms (~:1451-1483) as the two precedents this design splits between.
0.3 Harness state: yearPlan.rules.test.mjs + monthlyPlan.rules.test.mjs are Style A
  (inline rules, port 9090); confirm monthlyPlan's harness seeds NO user docs (the new
  helper's cross-doc get(users/{uid}) requires seeding UM/BM/SM user docs with
  unitId/branchId); yearPlan seeds um-1/bm-1 but needs same-unit-vs-other-unit + SM/TA
  expansion. Cite the current TA/UM/BM/SM -> DENY cases that will INVERT (yearPlan
  ~:101-131, monthlyPlan ~:79-109).
0.4 Copy anchors: toggle label MoneyNeedsPanel.jsx ~:1155 (no helper text today);
  Game Plan hub subtitle GamePlanV2/index.jsx ~:219; MonthlyPlanModal (no visibility
  copy today); the already-honest ReviewCommitModal lines (~:276, :464) and the
  template tone StepRateYourWeek.jsx ~:56 ("visible to your manager").

## Phase 2 - Rules
Add uplineCanReadUserPlan() + the owner-OR-upline get arm (existence-oracle included)
inside BOTH blocks. Keep list owner-only. No other rules change. Comment each arm:
"Fork B1 - unconditional upline read, ruled <date>; mirrors weeklyPlans, deliberately
NO visibility gate (moneyNeeds keeps the opt-in)."

## Phase 3 - Honesty copy (three sites, approved wording - match repo tone)
3a. Toggle helper line under MoneyNeedsPanel.jsx ~:1159: "This controls your budget
  worksheet only. Your production plan (targets by line) is visible to your managers,
  like your weekly plan."
3b. Game Plan hub subtitle (GamePlanV2/index.jsx ~:219): one-line disclosure covering
  year + monthly plan visibility to managers.
3c. MonthlyPlanModal: one line, same tone ("Visible to your managers.").
Copy renders for agents only where those surfaces already render; no layout change.

## Phase 4 - Emulator matrix (per block; lift persona set from weeklyPlans.rules.test.mjs)
owner GET own ALLOW / other-agent DENY / UM same-unit ALLOW (flips) / UM other-unit
DENY / BM same-branch ALLOW (flips) / BM other-branch DENY / SM ALLOW (flips) /
TA ALLOW (flips - ruled) / PA ALLOW / unauthenticated DENY / cross-tenant DENY /
owner LIST ALLOW (unchanged) / manager LIST DENY (no arm).
Update the inverting cases with a comment citing this ruling. Add the user-doc seeding
monthlyPlan's harness lacks. Paste the full matrix result in the PR body.

## Phase 5 - Verification (split, deploy-gated like K10b/K10c)
PRE-MERGE: emulator matrix green (both blocks); lint/suite/build; a UI check that the
  three copy lines render (unit test or the GPM1 smoke's agent leg extended by one
  assertion each - cheapest honest vehicle).
POST-DEPLOY (Rule 13 waiver in PR body + deferred-verification FU with exact steps):
  live legs as real subjects in tatillife_smoke - UM reads an in-unit agent's
  yearPlan/{year} + monthlyPlan doc (value-level), out-of-unit UM foil DENIED, agent
  still reads own. OPERATOR OPTION (note in PR body): the additive-rules pre-merge
  deploy carve-out applies - if Kyron chooses to deploy the additive arms pre-merge,
  run the live legs pre-merge and close the waiver early; otherwise post-deploy.

## Standing
Rule 19 HOLD at PR-open -> human merge -> operator deploy -> post-deploy smoke ->
/post-merge. Rule 21: trigger Gemini on-demand (rules PR) + the pre-merge final poll
before any merge. Rule 22 >=1 gap. Rule 23: every DENY case genuinely denies; the
existence-oracle gets its own case. Strike 0/2.

## Queued behind this (do not build here)
B2 - drawer plan tabs + focus-trap rework + plan-health (3 checks; "renewals" DROPPED
unless its Phase 0 mockup read says persistency %). B3 - planSuggestions collection
(mockup read required first; agent-READ hybrid of financingEscalations + prospectInfo).

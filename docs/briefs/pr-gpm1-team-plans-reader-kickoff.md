# PR-GPM1 - Team Plans Reader (UM+BM read shared Money Needs)

run_model: claude-opus-4-8
size: M
track: Game Plan manager surface, slice 1 (Fork A)
depends_on: G5 #354 (rules arms, live); K10a #769 (roster/drawer/nav patterns)
rules_change: NONE | data_model_change: NONE | deploy_required: NO
channel: HUMAN-MERGE (renders agents' personal financial data to managers)

## Intent
Make the "Share with my Unit Manager & Branch Manager" toggle honest: a shared Money
Needs worksheet actually lands in front of the UM/BM. G5 (PR #354, f200bc6) already
shipped + live-smoke-proved the consent-gated read arms (firestore.rules:1451-1483:
UM unit-scoped + visibility=='shared'; BM branch-scoped + same; TA/PA excluded by
design). This PR builds ONLY the missing UI reader. Zero rules change.

NOT in this PR (Fork B, banked): yearPlan/monthlyPlan manager rules, the mockup's
suggest-back card + plan-health checklist, any SM surface (shareWithSm stays dormant),
any lock/approve (design-forbidden).

## Projection contract - LOCKED (dispatcher ruling #2)
The worksheet is an itemized household budget; the manager view renders the DERIVED
coaching layer only. View-layer projection (G5 grants whole-doc read; render less):
SHOWN: totalAnnualAfterTax, totalAnnualPreTax, computedPAYE (aggregate only),
  estimatedRenewalIncome, firstYearCommissionsRequired,
  firstYearCommissionsTargets {life,ah,property,motor}, worksheet year, updatedAt.
PRIVATE - never in DOM (allow-list enforcement, K9-style): every expenseGroups line
  item (rent, food, medical, debt, donations...), every subCalculators internal (car,
  loans, sou-sou...), and any field not explicitly SHOWN. If a field is ambiguous,
  it is PRIVATE - surface it, don't render it.
TTD; dates DD-MM-YYYY.

## Phase 0 - Falsification (STOP on any miss)
0.1 RE-RUN scripts/verification/g5-privacy-smoke.mjs fresh against production (the
  recon's "rules proven" rests on a close-note, not a fresh run). Must pass before
  anything is built on the grant. If it fails -> STOP: the premise is dead.
0.2 Cite the G5 arms + helpers at current lines (firestore.rules ~:1451-1483, :59).
  Confirm TA/PA have NO read arm (the surface must not be mounted for them).
0.3 Cite the write path: MoneyNeedsPanel toggle ~:1147/:1016, updateVisibility
  (moneyNeedsService.js ~:570, patches visibility only), scaffold defaults ~:354-355.
0.4 unitId/branchId population probe (reuse the #779 read-only Admin-SDK probe
  pattern) - null unitId silently drops an agent from roster AND rule. Both tenants.
0.5 Reuse anchors: getTenantUsers role-scoping (managerService.js ~:45-50),
  UnitFinancingRoster fan-out (Promise.allSettled + partial-degrade + loadSeq),
  AgentFinancingDrawer prop shape, CoachingNotesModal props + agentUnitId denorm,
  navConfig My Team + WORKSPACE_TEAM_SECTIONS + render-switch pattern.
0.6 Confirm mp-game-plan (manager's OWN plan) is a distinct surface - no collision.

## Phase 2 - Build
2a. Service: getSharedMoneyNeeds(tenantId, agentId, year) - path-addressed read of
  users/{agentId}/moneyNeeds/{year}. CRITICAL: under the G5 arm, permission-denied
  means "not shared OR no worksheet" - the reader maps denied -> {notShared:true},
  never an error state. A UM cannot and should not distinguish the two.
2b. Roster: TeamPlansRoster - getTenantUsers (role-scoping free: UM->unit, BM->
  branch) -> filter role==='agent' -> per-agent getSharedMoneyNeeds fan-out.
  Every unit/branch agent gets a row: shared rows show headline SHOWN figures +
  View; not-shared rows show a neutral "Not shared" state (opt-in is the agent's;
  no nudge-shaming copy). Partial-fan-out failure -> resolved rows only; no
  aggregates from partial reads. Loading/error/empty per house rules.
2c. Drawer: AgentPlanDrawer({row,onClose,onCoach}) - read-only SHOWN projection
  (commissions-required hero, targets by line, renewal estimate), Coach button
  reusing CoachingNotesModal (pass the agent's unitId for the denorm). No write
  affordances of any kind.
2d. Nav: team-game-plans in My Team, roles ['unit_manager','branch_manager'],
  + WORKSPACE_TEAM_SECTIONS (workspace invariant test) + render-switch arm.
  NOT mounted for TA/PA (no read arm exists - the nav gate must match the rules).
2e. Unit test: projection contract lock - SHOWN fields render, PRIVATE fields
  (assert several expense-line names/values) absent from innerHTML; denied->notShared
  mapping; the K9-style field allow-list test shape.

## Phase 5 - Smoke (subject-consent round-trip, NON-WAIVABLE)
Seed tatillife_smoke via the A11Y accounts (agent in UM's unit + BM's branch, #779
probe pattern). Value-level, both themes:
5.1 CONSENT ON: as the agent (client SDK or UI), set visibility='shared' with a
  seeded worksheet -> sign in as UM -> roster shows the agent's row with the EXACT
  seeded derived figures -> drawer opens -> PRIVATE ABSENCE: no expense line item
  (assert seeded rent/medical values NOT in DOM anywhere).
5.2 CONSENT OFF (the round-trip): flip visibility back to 'private' as the agent ->
  UM reload -> row shows "Not shared", figures gone. The toggle must be live in both
  directions - this is the honesty proof.
5.3 BM leg: sign in as BM -> branch roster shows the shared row (G5 BM arm exercised
  by UI for the first time).
5.4 Foil: out-of-unit agent absent from the UM roster entirely.
5.5 Coach: UM writes a note from the drawer -> reload -> persisted (write-read).
Cleanup incl. restoring the worksheet's original visibility; 0 orphans.

## Post-merge notes
Fix the stale FU (FOLLOW_UPS ~L2716: updateVisibility no longer patches shareWithSm)
in this PR's post-merge fill. Bank Fork B (whole-plan suggest-back: yearPlan/
monthlyPlan rules + suggestion store + plan-health cards) as the follow-on track.

## Standing
Rule 19 HOLD at PR-open (personal-financial-data surface). Rule 21 poll + disposition.
Rule 22 >=1 gap. Rule 23: the projection test must FAIL if a PRIVATE field is rendered
(demonstrate once). No inline styles; reads via service files. Strike 0/2.

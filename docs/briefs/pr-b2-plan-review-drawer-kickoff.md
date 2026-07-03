# PR-B2 - Manager Plan Review: Drawer Tabs + Plan Health (Fork B slice 2)

run_model: claude-opus-4-8
size: L
track: Game Plan manager review (Fork B), slice 2 of 3
depends_on: GPM1 #785 (drawer/roster); B1 (rules arms) - SEE SMOKE GATING below.
  B2 builds off main file-disjoint from B1 (B1 = rules + agent-side copy; B2 =
  manager-side drawer/roster). Merge order is B1 first regardless.
rules_change: NONE | data_model_change: NONE | deploy_required: NO (B1 owns the deploy)
channel: HUMAN-MERGE (net-new financial rendering to managers)

## Intent
Extend GPM1's AgentPlanDrawer into the whole-plan review the Fork B design prescribes:
tabs (Overview = existing moneyNeeds projection / Year Plan / Monthly), a read-only
plan-health checklist, and the one-time focus-trap rework the new controls force.
Read-only throughout - the suggest-back card is B3, not here.

## Locked design (recon @ 1e8e0d3e + dispatcher rulings - do not re-derive)
- Fetch contract (RULED, per the projectSharedWorksheet:589 contract-change gate):
  the ROSTER row contract is UNCHANGED. The DRAWER fetches yearPlan/{year} +
  monthlyPlan on open, via a new manager-side service read (path-addressed by the
  agent uid, exercising B1's upline arm at runtime). Lazy per-open fetch, not an
  N x 3 roster fan-out. Drawer gains its own loading/error/empty states for the
  plan tabs; the Overview tab keeps the existing row-driven projection untouched.
- DENIED -> NEUTRAL mapping: a permission-denied plan read renders a neutral
  "Plan unavailable" state - NEVER an error alarm. (Pre-B1-deploy every read denies;
  post-deploy a denial means out-of-scope. Same lesson as GPM1's notShared mapping.)
- Plan-health checklist - exactly THREE checks (renderd on the Year Plan tab):
  1. Above floor: plan API = sum(yearPlan.lines.*.targetAPI) vs the tenure floor
     via the shipped resolver (src/utils/tenureFloors.js, defaults-merged).
  2. Line mix: per-line targetAPI/pct/enabled from yearPlan.lines.{life,ah,general}.
  3. Not over-committed (CONDITIONAL): moneyNeeds.firstYearCommissionsRequired vs
     sum(yearPlan.lines.*.derivedCommission) - commission-to-commission, never
     API-vs-income. Renders ONLY when the worksheet is shared (the row already knows);
     otherwise the check is silently OMITTED - not an "unknown" alarm.
  "Renewals realistic" is DROPPED - Phase 0 falsifier below.
- Focus trap: AgentPlanDrawer's trap hardcodes two focusables (~:49-62). B2 OWNS the
  rework: dynamic focusable enumeration (query visible tabbables within the panel),
  so tabs + future B3 controls don't re-break it. Unit-test the enumeration.
- weeklyPlans: OUT of the drawer (already upline-visible elsewhere). Link if trivial.
- Clarity invariant (#786): all new content renders INSIDE the existing masked
  panel div (AgentPlanDrawer.jsx ~:78 data-clarity-mask="True") -> no guard/doc
  edits needed. Any new portal/modal/file rendering financial data MUST carry its
  own data-clarity-mask="True" AND be added to MASKED_SURFACES in
  clarity-mask-guard.test.js + docs/clarity-integration.md. State which case applied.

## Phase 0 - Falsification (STOP on any miss)
0.1 MOCKUP FALSIFIER (the "renewals" drop): read the Fork B mockup material
  (design_handoff_v2_app/mockups/gameplan-shared.jsx manager branch + the v2 HTML
  manager section). If "renewals realistic" plainly means renewal PERSISTENCY %
  (persistencyService territory), STOP and surface - do not build a renewals check
  either way without a ruling. If it means renewal income, confirm the DROP stands
  (no baseline data exists).
0.2 Anchors at current lines: AgentPlanDrawer panel div + focus trap + body seam
  (~:78/:49-62/:152); TeamPlansRoster drawer invocation (~:227-233) + row build;
  yearPlanService/monthlyPlanService doc shapes ({lines...} / {targets[12], split,
  status, anchorAPI}); tenureFloors resolver + goalsService companyFloor read;
  the clarity mask guard's MASKED_SURFACES list.
0.3 B1 state check: gh pr list/view - is B1 merged? deployed? Record it; it gates
  which smoke legs run (below), not whether B2 builds.
0.4 Confirm the GPM1 projection tests + roster projection test - B2 must not alter
  the Overview tab's SHOWN/PRIVATE behavior (those tests stay green untouched).

## Phase 2 - Build
2a. Service: getAgentYearPlan / getAgentMonthlyPlan manager-side reads (explicit
  tenantId + agent uid; denied -> {unavailable:true}).
2b. Drawer: tab shell (Overview / Year Plan / Monthly), lazy fetch on tab open or
  drawer open (say which and why), per-tab loading/neutral-unavailable/empty states,
  TTD + DD-MM-YYYY formatting, plan-health checklist on the Year Plan tab per the
  locked spec. No write affordances.
2c. Focus-trap rework: dynamic enumeration + unit test (tab-cycles across N
  focusables; regression case for exactly-two).
2d. Unit tests: plan-health check logic as pure functions (floor pass/fail, line mix
  shape, over-committed bridge incl. the shared-only conditional); denied->neutral
  mapping; tab render.

## Phase 5 - Smoke (conditional on B1 deploy state, honest either way)
ALWAYS (preview): UM opens a shared agent's drawer -> tabs render; Overview unchanged
  (GPM1 18/18 re-run as regression); focus trap cycles all controls; both themes;
  PRIVATE-absence re-asserted (no expense line items anywhere incl. new tabs).
IF B1 arms are LIVE (merged + deployed at smoke time): value-level plan legs - seeded
  yearPlan targets render exactly; plan-health verdicts match hand-computed fixture
  (one above-floor, one below-floor agent); monthly tab shows the 12-split; foil
  out-of-unit drawer denied->neutral.
IF NOT: run the denied->neutral leg as the live proof (every plan read denies today,
  which IS the pre-deploy behavior contract), and bank the value-level plan legs as a
  Rule 13 deferred-verification FU with exact steps, re-run post-B1-deploy.
Seed/cleanup tatillife_smoke, 0 orphans.

## Standing
Rule 19 HOLD at PR-open; merge order B1 -> B2. Rule 21 poll + disposition + the
pre-merge final poll. Rule 22 >=1 gap. Rule 23: the plan-health fixture must include
a FAILING floor case (a checklist that cannot show a red check is decoration).
Strike 0/2. B3 (planSuggestions) queued behind - do not build any write path here.

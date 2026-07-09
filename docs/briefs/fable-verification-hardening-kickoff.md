# FABLE ORCHESTRATION RUN 2 — Verification & Hardening (staging autonomous run)

## MISSION
Prove and harden everything Run 1 built, ahead of promotion. Four phases: (A) deepen
the staging seed with rich synthetic fixtures; (B) build + run a comprehensive
cross-role LIVE smoke suite over every Run-1 surface; (C) fix confirmed regressions
found by B and re-smoke; (D) build the pre-ruled follow-up items. CONTINUOUS run —
no mid-run checkpoint (this run is verification-shaped; the operator reviews the
final report). RESUMABLE: every session reads this brief +
docs/fable-vh-run-progress.md and continues from checklist state.

## ROLE & MODEL ROUTING
Fable 5 orchestrator. Same routing as Run 1: Opus subagents for builds/complex
smoke suites, Sonnet for fixtures/mechanical patterns, orchestrator directly for
anything rules/functions-adjacent, seed writes, and verification of subagent
output. Telemetry protocol applies FROM THE START: TIMING LOG rows written at
dispatch (item | model | effort=inherited-default | dispatched | completed |
duration | outcome), per-phase rollups.

## AUTHORITY & HARD BOUNDARIES
Identical to Run 1 (docs/briefs/fable-redesign-orchestration-kickoff.md AUTHORITY
section governs): staging branch merge authority ONLY; agencytrack-staging Firebase
ONLY (verify active project before EVERY firebase command; alias restored after);
rules/functions changes allowed but flagged NEEDS-HUMAN-REVIEW-BEFORE-PROMOTION;
HARD STOPS unchanged — never touch prod, never money-release logic, never merge or
push main, synthetic data only, no cross-project IAM. Seed writes go through the
Admin SDK with the staging service-account key + project-guard (seed-staging.mjs
GUARD pattern) — abort if credential is not bound to agencytrack-staging.

## CHECKLIST
Maintain docs/fable-vh-run-progress.md (same protocol as Run 1: statuses PENDING /
IN-PROGRESS / DONE-IN-STAGING / NEEDS-HUMAN-REVIEW / SKIPPED-with-reason; updated in
the SAME commit as the work; session log; TIMING LOG at bottom).

## PHASE A — SEED DEEPENING (first; everything else depends on it)
Extend scripts/staging/seed-staging.mjs (or add scripts/staging/seed-fixtures.mjs
invoked after it — keep both idempotent + re-runnable + staging-guarded). All data
synthetic, schema-valid per domain invariants (TTD, YYYY-MM-DD stored, parseFloat
numerics, tenantId staging_test, weeks start Sunday, UTC-4). Read the REAL service/
schema shapes before writing fixtures (Rule 17) — fixtures must satisfy the deployed
staging rules (write them AS the owning users via Admin SDK, matching required
fields). Seed:
1. SUBMISSIONS: 8-10 weeks of weekly reports for BOTH agents (varied API/apps/
   activity: agent-1 strong + streaky above weekly floor to trigger award-weeks/
   streaks/celebrations + a best week; agent-2 weak/gappy to trigger exceptions
   floor/pace/report flags). Include this week + drafts where useful (Master Sheet
   draft-exception). A few manager (producing) submissions for mp surfaces.
2. WARs: manager weekly reports for the branch-manager + unit-manager incl.
   status='submitted' ones (so the 2.1 review flow has reviewable targets) and one
   draft.
3. GOALS: goal hierarchy + personal commitments for both agents (annualAPI targets
   that make pace/derived-income/celebration thresholds reachable); tier goals with
   FFI/CI/Dials for the unit/branch.
4. FINANCING: terms + monthly ledger rows for agent-1 (a declining runningBalance
   history so the K9 arc + projection render; a miss + >10% flag on agent-2 so the
   K7 roster risk cards render).
5. POLICIES: a mix per agent — settled+undelivered (CRO register + DeliveryStripCard
   + clawback tones: within/at-risk/overdue via dateIssued spread), settled+
   delivered, submitted in-flight, one lapsed (persistency + lens EXCLUDED).
6. PERSISTENCY: records for both agents across months (one above 90, one in the
   80-84 band — exercises gate bands + persistency tab).
7. CAMPAIGNS: one ACTIVE tiered 'qualify' campaign (3 tiers, persistencyGateEnabled,
   kiosk=true, meeting=true) + one 'placement' campaign — participants = both
   agents; windows covering the seeded submissions so standings compute.
8. RECRUITING: 6-8 candidates spread across the 8 stages incl. one stalled (>14d
   stageChangedAt), one licensed this year, mixed owners (UM + BM).
9. APPOINTMENTS: agent-1 planner week — today (mixed types incl. FFI/CI/PC + a free
   block), rest of week, one postponed-with-rebook pair, follow-up-eligible prospect
   preps.
10. PROSPECT PREPS: upcoming (today/tomorrow/in-N-days), one overdue, one fully
    prepped (policyType + objections from the taxonomy), one unprepped.
11. CRO user: ensure the staging-cro account from Run 1 persists (re-seed if
    absent) + enough undelivered policies for the register tabs.
12. FEATURE FLAGS: set tenants/staging_test/config/settings.featureFlags =
    { persistencyV2: true, policyLedgerCampaignLens: true, awardsProvenance: true }
    (staging only — operator-ruled ON for review).
Document every fixture family in the checklist row (what/why/which surface it
unlocks). Deliverable: seed script(s) committed + executed against staging.

## PHASE B — FULL-SURFACE LIVE SMOKE SUITE
Extend the Run-1 smoke assets (scripts/verification/smoke-tier0-staging.mjs pattern,
VERCEL_BYPASS_TOKEN bypass, mobile-viewport-aware login) into a tiered suite
scripts/verification/smoke-vh-staging.mjs (register in SMOKES.md). Value-level
assertions only (numbers, order, state changes — selector-presence alone is not a
pass). Per role (agent-1, agent-2 where exception-flavored, branch-manager,
unit-manager, tenant-admin, cro), covering EVERY Run-1 surface now unlocked by the
seed. Minimum legs:
- Tier-1: palette cross-role (incl. mobile trigger), Agent Report View POPULATED
  (numbers match a hand-computed fixture expectation — the extractFields path),
  admin quick-add fires, drag-reorder write-read-verify persists, exception lead
  panel shows agent-2's flags + AgentDrill Report tab hosts the report, Master
  Sheet reality bar/presets/exceptions toggle with real rows.
- Tier-2: WAR review round-trip AS UPLINE (approve + request-changes on a seeded
  submitted WAR — write accepted by deployed rules, pill renders; self-review
  DENIED as owner), recruiting kanban write-read (advance a seeded candidate,
  stalled badge on the 14d fixture), settings round-trip, PDF download CTAs enabled
  (click -> generation starts; do not diff PDF bytes), History drill + EDIT PATH
  (draft opens wizard on that week), awards pace line renders with seeded gap math,
  financing K9 arc + K7 roster tones, campaigns standings (tier resolution + gate
  multiplier vs fixture persistency — assert the projected payout NUMBER), daily
  anchor strip WTD vs floor + a streak celebration fire (then fire-once holds),
  game-plan hub AllocationBar/MiniMonthStrip with seeded actuals.
- Tier-3: CRO register tabs + mark-delivered round-trip (Arm E write accepted),
  planner day/week + churn (postpone-with-rebook creates the link), Team Planner
  read-only rows AS UM+BM, Meeting Mode deck AS BM (scene count vs seeded data —
  campaign scene present, celebrations skip honest), flag-gated shells RENDER with
  flags ON (persistency v2 preview banner, ledger lens counts vs fixtures, awards
  provenance chip) AND a flags-OFF spot-check (flip one flag off, assert absent,
  restore), prospect prep hero + countdown tones + rehearsal chips, kiosk stage
  (rotation includes campaign panel, podium ranks match fixture order,
  reduced-transparency fallback class present).
- Cross-cutting: reduced-motion leg (emulate; count-ups snap, no animation classes),
  dark-mode contrast spot-checks on new surfaces, console-clean assertion on every
  leg (fail on uncaught errors), no request to agencytrack-2a610 ANYWHERE (assert
  on network log — the isolation regression check).
Report a PASS/FAIL/SKIP table per leg per role + screenshots for failures.
Env gaps (fixture missing, surface unreachable) = SKIP-with-reason, then EXTEND THE
SEED and re-run that leg — the seed and the suite iterate together.

## PHASE C — FIX CONFIRMED REGRESSIONS
For every FAIL: reproduce (2x) -> root-cause -> classify: (a) Run-1 code bug ->
FIX (smallest correct change, regression test verified red-without-fix, gates,
commit, re-smoke that leg); (b) smoke-script bug -> fix script, note; (c) needs an
operator ruling or a schema/rules change beyond run scope -> SKIP-and-log with
precise unblock. Never widen scope to redesign a surface. Every fix follows Run-1
conventions (states/tokens/a11y/import-React/etc.).

## PHASE D — PRE-RULED FOLLOW-UPS (operator-confirmed, decision-free)
D1. Manager mp-game-plan prefetch: extend the #829 pattern (gamePlanPrefetch.js)
    to ManagerDashboard idle for the producing-manager game-plan docs — same
    listener-warm approach, same opt-in scoping; motion-verifier before/after
    numbers on the manager transition (the #833 carried observation).
D2. Keyboard nav-reorder: layer keyboard semantics onto 1.4's Sidebar drag machine
    (rows already buttons w/ focus rings): a reorder mode or modifier (e.g.
    Alt+ArrowUp/Down moves within section, Escape cancels, Enter commits), announces
    via aria-live, persists through the same useNavOrder path. Reduced-motion safe.
D3. SM / TA Team Planner nav: wire the existing TeamPlannerPanel for sales_manager
    + tenant_admin (service getTeamWeek already supports their role split) — nav
    item + render block per dashboard idiom; read-only, same trust marker.
Each: tests + gates + live-smoke leg appended to the Phase-B suite.

## ALSO IN SCOPE (operator-ruled)
- ProfileScreen loggingMode picker STAYS (operator clarified the model: agent
  selects own mode; manager override is intended). Do NOT remove or alter it.
  The manager-override half (upline write path onto a team member's loggingMode
  + modeSetBy/locked provenance fields, which also unblocks 2.10's skipped
  provenance tag) is a POST-PROMOTION contracted item — do not build it this run.
- Tunable constants CONFIRMED as-is this run (pace 0.5/0.85, stalled 14d, gate
  bands 90/85/80, readiness criteria) — no changes, no config surface yet.

## PRE-RULED SKIPS (do not build)
Noticeboard collection · kiosk per-slide config persistence · prospect
callbackDueAt · manager plan-review banner · mobile presenter remote · density
substrate · anything needing a new collection/write-path contract — all deferred
to a post-promotion ruled batch. Payout-release logic (HARD STOP, always).

## VERIFICATION SUMMARY (operator will check)
- docs/fable-vh-run-progress.md current; TIMING LOG complete from item 1.
- Final smoke table: every Run-1 surface PASS (or SKIP with a reason the operator
  accepts) across roles; console-clean; zero prod requests.
- All Phase-C fixes red-verified + re-smoked. Suite green at every commit.
- Any new NEEDS-HUMAN-REVIEW flags listed (expected: none — this run should not
  need rules changes; if one becomes necessary, flag + explain).

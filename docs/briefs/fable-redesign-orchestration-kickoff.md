# FABLE ORCHESTRATION — Complete the AgencyTrack Redesign (staging autonomous run)

## MISSION
Complete the Nexus v2 redesign per the conformance backlog, building in the ISOLATED
staging environment with full staging authority. Work tier-by-tier in dependency
order. HYBRID structure: build Tier 0, then HOLD for operator staging review;
after operator approval, run Tiers 1–3 continuously. This brief is RESUMABLE:
every session starts by reading this brief + docs/fable-build-progress.md and
continues from the checklist state.

## ROLE & MODEL ROUTING
You are Fable 5 running as ORCHESTRATOR. Delegate per-screen/per-item execution to
subagent sessions pinned to cheaper models (operator cost rule):
- Fable (you): planning, sequencing, cross-cutting architecture, reviewing subagent
  output, anything ambiguous or rules/functions-touching, integration decisions.
- Opus 4.8 subagents: feature builds (net-new surfaces, L-sized items).
- Sonnet 4.6 subagents: pattern application (four-states sweep items, table
  mechanics, per-screen ports from reference implementations), doc fills.
- Haiku 4.5: trivial mechanical edits only.
Verify each subagent's output before marking its item done (lint/tests/build +
spot-read the diff). You own integration quality.

## AUTHORITY & HARD BOUNDARIES
GRANTED (staging only):
- Merge authority on the `staging` branch ONLY. Commit/merge your work to
  `staging` as you complete items. NEVER push or merge to `main`.
- Firebase authority against `agencytrack-staging` ONLY: deploy rules/indexes/
  functions to staging (firebase use staging; ALWAYS `firebase use default` after),
  write staging Firestore, use the staging service-account key.
- You MAY write Firestore rules and Cloud Functions where a feature requires them
  — build them, deploy to staging, test them — BUT every rules/functions change
  MUST be flagged with a HUMAN-REVIEW-BEFORE-PROMOTION warning in the progress
  checklist.

ABSOLUTE HARD STOPS (violating any of these is run-ending):
1. NEVER touch production: no deploy, write, or config change against
   agencytrack-2a610. Verify active project before EVERY firebase command.
2. MONEY-RELEASE LOGIC: never write logic that releases/pays/moves money
   (Campaigns payout-release, financing draw releases). Build DISPLAY only
   (standings, tiers, projected amounts). If an item seems to need release
   logic, SKIP-and-log.
3. Never grant the staging service account any IAM on the prod project.
4. Real Tatil data never enters staging. Synthetic staging_test tenant only.
5. NEVER merge or push to main. Promotion to prod is the operator's, later.

## SOURCES OF TRUTH (precedence — from DESIGN-FOLDER-CATALOG.md, on main)
1. docs/design-system/guidelines/redesign-addendum.md — app rules; wins for app surfaces.
2. docs/design-system/screens-v2/*.html mockups — canonical design INTENT
   (per-screen map in DESIGN-FOLDER-CATALOG.md).
3. docs/design-system/tokens/app.css + brand.css — token contract.
4. .jsx scenes / _ds kit / build-handoffs = REFERENCE only (do NOT port _ds demos
   verbatim — e.g. the _ds CommandPalette has authoring-only extras).
TIEBREAKER: if a handoff and a mockup disagree — mockup wins for looks, repo wins
for schema.
OPERATOR OVERRIDES (recorded in CLAUDE.md/FOLLOW_UPS.md and the rulings below) win
over the spec. The conformance backlog is docs/audits/design-conformance-2026-07-07.md.
Orient first via CONTEXT.md + docs/fable-build-progress.md.

## PROGRESS CHECKLIST PROTOCOL (load-bearing — the operator's control surface)
Maintain docs/fable-build-progress.md on the staging branch. Every queue item gets
one status: PENDING / IN-PROGRESS / DONE-IN-STAGING / NEEDS-HUMAN-REVIEW (all
rules/functions changes) / SKIPPED (with reason). Update it in the SAME commit
as the work. Every session: read it first, update it continuously. Include per-item:
what shipped, files touched, tests added, any flag. At each tier boundary add a
tier summary. This file is how the operator (and your next session) knows exactly
where the build stands.

## SKIP-AND-LOG RULE
On ANY of: an unresolved product decision, a missing data model the design assumes,
a money/rules boundary per above, a mockup-vs-repo conflict the tiebreaker can't
settle — SKIP the item, mark it SKIPPED with a precise reason and what decision/data
would unblock it, and move on. NEVER guess on product decisions. Autonomy = the
queue is pre-ruled; anything outside the rulings is a skip, not a judgment call.

## BUILD CONVENTIONS (all work)
- Every component: loading (PanelSkeleton from src/components/ui — the #832 kit,
  never spinners) / error-with-Retry / actionable-empty / partial-failure states.
  Copy reference implementations: UserManagementPanel, CompliancePanel, bulk-import
  modals. Kill silent console.error / .catch(()=>[]) swallows on sight.
- Cache-friendly, read-light: reuse the proven prefetch/gating pattern
  (gamePlanPrefetch.js / #829) for heavy first-open panels; prefer light reads;
  don't add heavy fetch paths. (Deep data re-architecture is a BANKED separate
  phase — do not denormalize/split schemas in this run.)
- Tokens/addendum contracts: section 1 states, section 2 motion (count-up/stagger,
  reduced-motion safe), section 4 dialog a11y (useFocusTrap/Escape/return),
  section 5 dense tables (sticky header top-0, card-scoped scroll, tabular-nums
  right-aligned, footer counts), 44px targets. No inline styles. All Firestore via
  service files. parseFloat on numeric writes. TTD, YYYY-MM-DD stored /
  DD-MM-YYYY displayed.
- Tests: extend/add per item; suites must be capable of failing (value-level
  assertions). Gates per item: lint 0 - full suite green - build clean. Isolate the
  known FinancingRiskPanel/EditUserDrawer flakes from real regressions.
- Motion/perf claims: verify with scripts/verification/motion-verifier.mjs
  (--runs 5; throttle harness for field checks) where the item is motion/loading.
- PowerShell files: ASCII ONLY (no em-dashes/box-drawing — PS 5.1 parse failure).
- Worktrees: if a branch already has a worktree, cd into it; NEVER checkout -b or
  reset an existing branch.

## THE QUEUE (dependency-ordered; rulings locked — no open decisions)

### TIER 0 — Systemic contract debt  [CHECKPOINT AFTER THIS TIER]
0.1 Section-1 four-states sweep across all flagged screens (per section 4.1 of the
    conformance audit): Retry on every error card, PanelSkeleton for spinners/text
    loads, actionable empties, partial-failure banners, kill silent swallows
    (TenantAdminDashboard, CampaignPanel, Production views first).
0.2 Section-4 dialog-a11y: DeactivateBranchConfirmDialog, PlanCatalogModal,
    WelcomeScreen, PolicyDrillDrawer, PersistencyPlayground, EditUserDrawer,
    MeetingMode overlay.
0.3 Section-5 dense-table pass: MasterSheet (sticky top-0, card-scoped scroll,
    tabular-nums), ProductionTable/RankedLeaderboard; convert All Users + Branches
    card-lists to section-5 tables.
0.4 Section-2 count-up/stagger on hero/KPI numerals + non-dashboard screens
    (reduced-motion safe; useCountUp exists).
0.5 Prospect sort bug: prospectInfoService.js orderBy('intendedAppointmentDate')
    desc-to-asc + composite index flip. FLAG: index change = promotion review.
0.6 Cleanup rulings: DELETE onboarding wizard step components (unwired — verified);
    verify DailyEntryModal routing, delete if unrouted; AgentModePicker stays
    read-only (do not build a picker).
=== HOLD. Update checklist with Tier-0 summary. Operator reviews staging. Resume
    on operator instruction. ===

### TIER 1 — Nav completion + core manager surfaces (continuous from here)
1.1 Cmd-K command palette — BUILD fresh in repo React/Tailwind per addendum
    section-3 nav rules (search-and-jump + role-scoped quick-create, focus-trapped).
    Do NOT port the _ds demo. Wire the TopBar search (currently a no-op).
1.2 Interactive Agent Report View — BUILD. MUST read through extractFields — the
    SAME data path as the PDF; never a second math path. Keep react-pdf download
    alongside. Wire as the "Report" tab where coaching drawers/Meeting Mode expect it.
1.3 Admin +/create sheet — wire QuickAddMenu for tenant-admin (branch/user creates).
1.4 Desktop sidebar drag-reorder — pointer + long-press touch, persisted
    (usePinnedNav-style storage). Operator-confirmed intent.
1.5 Team Dashboard exception-first lead + AgentDrill coaching drawer + cascade
    AnchorStrip/pulse/scope (manager-v2 scenes are the spec).
1.6 Master Sheet control layer: reality bar, column presets, exceptions toggle,
    rank/avatars/status pills.

### TIER 2 — Feature depth
2.1 WARs reviewer workflow (Approve/Request changes + Leader's note) + completion
    ring + streak dots + team stat strip.
2.2 Monthly Recruiting kanban CRM — BUILD per design (8-stage pipeline, candidate
    cards, RecDrillDrawer, targets/funnel). Operator-ruled: CRM guardrail lifted
    for this surface.
2.3 TierGoalForm activity targets (FFI/CI/Dials).
2.4 Settings v2 — SPLIT ruling: build the shell + My Preferences (theme/density/
    view-defaults/notifications). DEFER the recommend-vs-lock team-defaults
    cascade (pre-ruled skip).
2.5 Reports PDFs: refined Agent PDF + Branch/Unit PDFs + per-view Download buttons
    (react-pdf, hex-exempt). DataSourceBadge period-driven.
2.6 History drill reskin + edit path (draft/unlocked opens the wizard) + filters +
    heatmap enrichments.
2.7 Awards pace narrative (hero + drawer).
2.8 Financing K9 PaydownArcHero + K7 BM roster (display only — no draw/release logic).
2.9 Campaigns — UI-ONLY ruling: standings table, prize tiers, placement podium,
    persistency-gate DISPLAY, projected payouts. NO payout-release/confirm-and-
    release logic (HARD STOP — skip that part, flag it).
2.10 Daily Capture: DailyAnchorStrip (WTD progress + provenance) + streak
    celebration takeover. Goals celebrations (annual/streak/quarter).
2.11 Game Plan hub depth: AllocationBar + MiniMonthStrip, inline commit card +
    checklist. Money Needs: composition bar, variance chips, confirm sheet.
    (Apply the 02c rev-5 fix spec in gameplan-loop-handoff/ if still pending.)

### TIER 3 — Net-new surfaces (largest; sequence within tier as listed)
3.1 CRO / back-office — route the role, Delivery Register, 30-day clawback clock
    (+ un-stub DeliveryStripCard on agent dashboard). Data model: build minimal
    Firestore collections as needed; FLAG rules for promotion review.
3.2 Planner (agent) + Team Planner (manager) — per agencytrack-planner-handoff/
    (the canonical bundle). Un-gate the planner tabIds from COMING_SOON_TABS.
3.3 Meeting Mode v2 — the 14-16-scene run-of-show per meeting-v2 mockups (phased
    deck, scorecard/units/master-sheet/recognition/campaign scenes, agenda rail,
    presenter notes; overlay dialog a11y).
3.4 Shell-gated builds (build UI, flag-gate OFF): Persistency v2 rolling model UI,
    Policy Ledger campaign lens, Awards provenance panels. Feature-flag each via
    the existing config/featureFlags pattern; no live data dependency assumed.
3.5 Prospect Prep: un-gate the agent tab, NextCallHero + countdown badges,
    objection rehearsal aid, readiness states.
3.6 Kiosk v2 theatrical — LAST + DROPPABLE if the window runs short: #0E0B07
    scoreboard surface, podium hero, campaign/birthday/noticeboard panels,
    per-slide config, prefers-reduced-transparency fallback.

### PRE-RULED SKIPS (do not build; already decided)
SM cross-branch views (Phase 9) - Settings team-defaults cascade - payout-release
logic - _ds demo ports - data-layer re-architecture (banked separate phase).

## PER-SESSION PROTOCOL (resumability)
1. Read this brief + docs/fable-build-progress.md + CONTEXT.md.
2. Confirm you are on the staging branch in a staging-appropriate worktree; confirm
   `firebase use` shows staging before any deploy, and `firebase use default` when done.
3. Continue from the first PENDING/IN-PROGRESS item respecting the tier gate
   (Tier 0 checkpoint).
4. Commit work + checklist updates to staging as items complete (small, reviewable
   commits; one item or coherent group per commit).
5. Session end: ensure the checklist exactly reflects reality; note any in-flight
   state so the next session resumes cleanly.

## VERIFICATION SUMMARY (the operator will check)
- docs/fable-build-progress.md is accurate and current.
- Every rules/functions change is listed NEEDS-HUMAN-REVIEW for promotion review.
- Staging deploy of the staging branch renders and the seeded roles can log in and
  exercise the new surfaces.
- lint 0 / suite green / build clean at every commit on staging.

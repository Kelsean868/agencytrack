# Fable Redesign Build — Progress Checklist

> **Control surface for the Fable orchestration run** (brief: `docs/briefs/fable-redesign-orchestration-kickoff.md`).
> Lives on the `staging` branch; updated in the SAME commit as each item's work.
> Statuses: `PENDING` / `IN-PROGRESS` / `DONE-IN-STAGING` / `NEEDS-HUMAN-REVIEW` (all rules/functions/index changes) / `SKIPPED` (with reason).
> Backlog source: `docs/audits/design-conformance-2026-07-07.md`. Run started 2026-07-08.

## Run state

| Field | Value |
|---|---|
| Current tier | Tier 0 |
| Tier gate | Tier-0 checkpoint: HOLD for operator staging review after Tier 0 completes |
| Last session | 2026-07-08 — run start; checklist created |
| Staging branch base | `c3b788d0` (main @ brief landing) |

## Promotion-review flags (rules / functions / indexes — ALL need human review before prod)

_None yet._

---

## TIER 0 — Systemic contract debt  [CHECKPOINT AFTER THIS TIER]

| Item | Status | Notes |
|---|---|---|
| 0.1 §1 four-states sweep (Retry on error cards, PanelSkeleton for spinners, actionable empties, partial-failure banners, kill silent swallows — TenantAdminDashboard, CampaignPanel, Production views first; then per audit §4.1) | PENDING | |
| 0.2 §4 dialog-a11y: DeactivateBranchConfirmDialog, PlanCatalogModal, WelcomeScreen, PolicyDrillDrawer, PersistencyPlayground, EditUserDrawer, MeetingMode overlay | DONE-IN-STAGING | All 7 fixed: role="dialog"+aria-modal+focus-trap+Escape+focus-return via `useFocusTrap` hook (5 components: DeactivateBranchConfirmDialog, PlanCatalogModal, WelcomeScreen, PolicyDrillDrawer, PersistencyPlayground, MeetingMode) or inline focus-trap idiom preserving custom initial-focus-on-form-field behavior (EditUserDrawer). 44px touch targets: DeactivateBranchConfirmDialog close button, PersistencyPlayground close+Reset+Close footer buttons. Also fixed 3 pre-existing missing `import React` (Vitest-only crash risk per CLAUDE.md rule) surfaced while adding tests: DeactivateBranchConfirmDialog, WelcomeScreen, MeetingMode. Tests: extended PlanCatalogModal/PersistencyPlayground/EditUserDrawer test files (+4 tests each); added new test files for DeactivateBranchConfirmDialog (10 tests), WelcomeScreen (7 tests), PolicyDrillDrawer (6 tests), MeetingMode (7 tests). Gates green: lint 0/0, full suite 254 files/4346 tests, build clean. |
| 0.3 §5 dense-table pass: MasterSheet (sticky top-0, card-scoped scroll, tabular-nums), ProductionTable/RankedLeaderboard; All Users + Branches card-lists → §5 tables | PENDING | |
| 0.4 §2 count-up/stagger on hero/KPI numerals + non-dashboard screens (reduced-motion safe; useCountUp exists) | PENDING | |
| 0.5 Prospect sort bug: prospectInfoService.js orderBy desc→asc + composite index flip | PENDING | FLAG: index change = promotion review |
| 0.6 Cleanup rulings: DELETE onboarding wizard step components (verify unwired); verify DailyEntryModal routing, delete if unrouted; AgentModePicker stays read-only (no picker) | PENDING | |

### Tier 0 summary

_Pending._

---

## TIER 1 — Nav completion + core manager surfaces (continuous after operator approval)

| Item | Status | Notes |
|---|---|---|
| 1.1 Cmd-K command palette (fresh build per addendum §3; wire TopBar search; do NOT port _ds demo) | PENDING | |
| 1.2 Interactive Agent Report View (reads through extractFields — same data path as PDF; keep react-pdf download; wire as "Report" tab) | PENDING | |
| 1.3 Admin +/create sheet — wire QuickAddMenu for tenant-admin (branch/user creates) | PENDING | |
| 1.4 Desktop sidebar drag-reorder (pointer + long-press touch, persisted) | PENDING | |
| 1.5 Team Dashboard exception-first lead + AgentDrill coaching drawer + cascade AnchorStrip/pulse/scope | PENDING | |
| 1.6 Master Sheet control layer: reality bar, column presets, exceptions toggle, rank/avatars/status pills | PENDING | |

---

## TIER 2 — Feature depth

| Item | Status | Notes |
|---|---|---|
| 2.1 WARs reviewer workflow (Approve/Request changes + Leader's note) + completion ring + streak dots + team stat strip | PENDING | |
| 2.2 Monthly Recruiting kanban CRM (8-stage pipeline, candidate cards, RecDrillDrawer, targets/funnel) | PENDING | CRM guardrail lifted for this surface (operator-ruled) |
| 2.3 TierGoalForm activity targets (FFI/CI/Dials) | PENDING | |
| 2.4 Settings v2 — shell + My Preferences only; team-defaults cascade = pre-ruled SKIP | PENDING | |
| 2.5 Reports PDFs: refined Agent PDF + Branch/Unit PDFs + per-view Download buttons; DataSourceBadge period-driven | PENDING | |
| 2.6 History drill reskin + edit path (draft/unlocked opens wizard) + filters + heatmap enrichments | PENDING | |
| 2.7 Awards pace narrative (hero + drawer) | PENDING | |
| 2.8 Financing K9 PaydownArcHero + K7 BM roster (display only — no draw/release logic) | PENDING | |
| 2.9 Campaigns UI-ONLY: standings table, prize tiers, placement podium, persistency-gate DISPLAY, projected payouts. NO payout-release logic (HARD STOP) | PENDING | |
| 2.10 Daily Capture: DailyAnchorStrip (WTD progress + provenance) + streak celebration takeover; Goals celebrations | PENDING | |
| 2.11 Game Plan hub depth: AllocationBar + MiniMonthStrip, inline commit card + checklist; Money Needs composition bar, variance chips, confirm sheet | PENDING | Apply 02c rev-5 fix spec if still pending |

---

## TIER 3 — Net-new surfaces

| Item | Status | Notes |
|---|---|---|
| 3.1 CRO / back-office: route role, Delivery Register, 30-day clawback clock, un-stub DeliveryStripCard | PENDING | Minimal Firestore collections as needed; FLAG rules |
| 3.2 Planner (agent) + Team Planner (manager) per agencytrack-planner-handoff/; un-gate planner tabIds | PENDING | |
| 3.3 Meeting Mode v2 — 14–16-scene run-of-show per meeting-v2 mockups | PENDING | |
| 3.4 Shell-gated builds (flag OFF): Persistency v2 rolling model UI, Policy Ledger campaign lens, Awards provenance panels | PENDING | |
| 3.5 Prospect Prep: un-gate agent tab, NextCallHero + countdown badges, objection rehearsal aid, readiness states | PENDING | |
| 3.6 Kiosk v2 theatrical | PENDING | LAST + DROPPABLE if window runs short |

---

## PRE-RULED SKIPS (do not build)

SM cross-branch views (Phase 9) · Settings team-defaults cascade · payout-release logic · _ds demo ports · data-layer re-architecture (banked separate phase).

## Session log

- **2026-07-08 (session 1):** Run started. Brief pulled to main + merged into staging (`c3b788d0`). Checklist created. Beginning Tier 0.

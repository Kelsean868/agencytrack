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
| 0.2 §4 dialog-a11y: DeactivateBranchConfirmDialog, PlanCatalogModal, WelcomeScreen, PolicyDrillDrawer, PersistencyPlayground, EditUserDrawer, MeetingMode overlay | DONE-IN-STAGING | All 7 fixed: role="dialog"+aria-modal+focus-trap+Escape+focus-return via `useFocusTrap` hook (5 components: DeactivateBranchConfirmDialog, PlanCatalogModal, WelcomeScreen, PolicyDrillDrawer, PersistencyPlayground, MeetingMode) or inline focus-trap idiom preserving custom initial-focus-on-form-field behavior (EditUserDrawer). 44px touch targets: DeactivateBranchConfirmDialog close button, PersistencyPlayground close+Reset+Close footer buttons. Also fixed 3 pre-existing missing `import React` (Vitest-only crash risk per CLAUDE.md rule) surfaced while adding tests: DeactivateBranchConfirmDialog, WelcomeScreen, MeetingMode. Tests: extended PlanCatalogModal/PersistencyPlayground/EditUserDrawer test files (+4 tests each); added new test files for DeactivateBranchConfirmDialog (10 tests), WelcomeScreen (7 tests), PolicyDrillDrawer (6 tests), MeetingMode (7 tests). Gates green: lint 0/0, full suite 254 files/4346 tests, build clean. Follow-up (operator-requested): shared `ui/ConfirmDialog.jsx` close button 32px→44px (`w-11 h-11 -m-1.5`) + focus-visible ring + touch-target test; gates re-run green (4368/4368). |
| 0.3 §5 dense-table pass: MasterSheet (sticky top-0, card-scoped scroll, tabular-nums), ProductionTable/RankedLeaderboard; All Users + Branches card-lists → §5 tables | DONE-IN-STAGING | MasterSheet: header row now `sticky top-0` (z-30 on the two sticky-left identity columns to win both axes, z-20 elsewhere); table wrapped in card-scoped `overflow-x-auto overflow-y-auto max-h-[70vh]` (was page-level vertical scroll); numeric columns right-aligned + `tabular-nums` via `isNumericCol()` (identity/status/weekend-badge columns stay left). Scope-guarded — no rank/avatars/pills/reality-bar added. ProductionTable: converted to card-scoped scroll + rank/agent sticky-left pair (rank given explicit `w-8` for a stable left-offset) + 2-row sticky header (top-0/top-8, z-40/30/20/10 tiers matching TeamPerfRoster's reference pattern) + footer count + `title` on truncated agent-name cell; columns/data unchanged. RankedLeaderboard: added a sticky header row (was header-less) + card-scoped vertical scroll + footer ("Showing N of M" when `topN` caps the list, else "N agents") + `title` on truncated name; also fixed a latent bug where the component destructured `_valueLabel` (never read) while every caller already passed `valueLabel` — renamed to `valueLabel` so caller-supplied labels ("Avg API", "API") now actually render in the new header. All Users (UserManagementPanel): card-list → real `<table>`, sticky header, zebra stripes (`bg-card-raised/40` on odd rows), new dedicated Status column using `StatusPill` (Active/Deactivated, replacing the old inline "Inactive" text tag), footer count with active/deactivated breakdown (`data-testid="user-roster-footer"`); all existing row actions/filters/toggle/loading/error/empty states preserved verbatim. Branches (BranchesPanel): same conversion — table, zebra, `StatusPill` (kept `uppercase tracking-wide` via `className` to preserve the pre-existing pill look), footer count with active/inactive breakdown (`data-testid="branches-roster-footer"`); all modals/actions preserved. Deliberate scope call: sticky-left (frozen identity column) applied only to MasterSheet + ProductionTable, where the design already called for it (wide multi-column tables); skipped for the modest 5-6 column Users/Branches tables per the brief's "where the design calls for it" qualifier — narrow-viewport overflow is handled by the card's own horizontal scroll instead. Tests: extended `productionReport/__tests__/components.test.jsx` (+9: footer count/pluralization, `title` attr, sticky-header tiers, tabular-nums, sticky header + value-label + footer for RankedLeaderboard); extended `UserManagementPanel.test.jsx` (+3) and `BranchesPanel.test.jsx` (+2) with footer/status-pill/sticky-header contract checks; added new `MasterSheet.test.jsx` (5 tests — first coverage for this component, using hoisted `extractFields`/`computeRatios`/`extractTotalProductionCredit` mocks). Gates green: lint 0/0, full suite 255 files/4365 tests (baseline 4346 + 19 new), build clean (pre-existing >700kB vendor-pdf chunk warning only, no new one). No flaky-test reruns needed. Audit-vs-source: audit's `ProductionTable.jsx:12-18`/`RankedLeaderboard.jsx:24-30`/`:40` line refs had drifted (current line numbers differed) but the described gaps (no sticky/footer/title, and for RankedLeaderboard genuinely-absent tabular-nums claim was stale — it already had `tabular-nums` on value cells) were otherwise accurate after re-verification against source per Rule 17. |
| 0.4 §2 count-up/stagger on hero/KPI numerals + non-dashboard screens (reduced-motion safe; useCountUp exists) | DONE-IN-STAGING | Count-up (existing `useCountUp` hook + `formatCurrency`/percent formatting, decimals:2 for TTD money so the final value never rounds off cents): HeroCard.jsx YTD hero figure; PlanAnchorStrip.jsx Plan-Built% + all 4 chip currency values; CommissionAnchorStrip.jsx hero (committed-goal) state's headline/gap/YTD-Earned/Projected/Goal/persistency% (no-goal state left static — untouched by existing tests, out of scope per audit line ref); DerivedIncomePanel.jsx annual-income/per-month/YTD-earned; ProductionLeaderboardSurface.jsx `PodiumCard` API figure; wizard `v2chrome/Celebration.jsx` API + earned-points stat numerals (no new medal/cards added, per brief). Reduced-motion: `useCountUp` itself gates via `matchMedia('(prefers-reduced-motion: reduce)')` and snaps straight to the target value (already reduced-motion safe pre-existing code — verified, no hook changes needed). Stagger (reused `.stagger` CSS class from index.css, gated behind `prefers-reduced-motion: no-preference`, transform-only per §2): added to root container of ProductionLeaderboardSurface, AgentAwardsPanel, CareerPortal, PersistencyTab (agent), PolicyLedgerPanel (both list + create-form views), AgentProductionView, UnitManagerProductionView, BranchManagerProductionView, ProspectInfoPanel (agent), ProspectInfoTab (manager). Where a fixed-position drill-drawer/modal was a direct child (AgentAwardsPanel's AwardDrillDrawer, CareerPortal's LevelDrillDrawer, PersistencyTab's PersistencyEntryForm/PersistencyPlayground, PolicyLedgerPanel's PolicyDrillDrawer), pulled it outside the `.stagger` wrapper as a Fragment sibling — mirrors the existing GamePlanV2 modalsBlock/contentBlock split (these only mount post-click, well after the one-shot mount-time stagger animation ends, so no containing-block-reparenting risk). Tests: mocked `useCountUp` to the identity function in 9 existing test files that render the touched components (matches the established kiosk-panel convention) so pre-existing numeral-text assertions keep passing byte-for-byte; added 2 new tests — HeroCard.test.jsx gets a real (unmocked) `prefers-reduced-motion: reduce` `matchMedia` mock across the whole file proving the REAL hook's reduced-motion path renders the exact final TTD figure (with cents) synchronously; CommissionAnchorStrip.test.jsx gets new coverage for its previously-untested hero (committed-goal) branch. Gates green: lint 0/0, full suite 255 files/4367 tests (baseline 4365 + 2 new), build clean (pre-existing >700kB vendor-pdf chunk warning only). Live `motion-verifier.mjs` run deferred to operator staging review per brief (requires running app + credentials). Not done: TailRow / AroundMeCluster numerals, WeeklyChampionsBanner champion-card values, and CommissionAnchorStrip's no-goal-state chips were left un-animated (out of the audit's named targets; the no-goal chips also have direct pre-existing test coverage that would otherwise need a mock for no added value). Gamification `Leaderboard.jsx` (singular, dashboard tab) was left alone — already covered by ManagerDashboard's own `.screen-enter`, and out of scope as a dashboard surface. |
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

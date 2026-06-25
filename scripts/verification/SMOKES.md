# Standing Smoke Registry — AgencyTrack

This file is a **descriptive reference**, not an enforcement mechanism. Smokes are manual and per-PR — there is no CI smoke job. Use this registry to find which smoke guards a given surface before touching it, and to decide which smokes need a re-run after a change.

Local flag-ON smokes cannot run against the flag-OFF Vercel preview; they require a local `vite preview` build with the relevant `VITE_*` flag set.

All smokes read credentials from `.env.local` (never echoed — Rule 4). Common required keys: `VERCEL_BYPASS_TOKEN`, `A11Y_AGENT_EMAIL`, `A11Y_AGENT_PASSWORD`. Role-specific smokes note additional keys inline.

---

## Standing per-surface smokes

| Surface | Smoke file | Run mode | Re-run when touching |
|---------|-----------|----------|----------------------|
| Game Plan · yearPlan loop (allocator → yearPlan write cycle) | `smoke-yearplan-unified.mjs` | **split** — local `VITE_MONEY_NEEDS_MERGED_ENABLED=true` (full write cycle); `SMOKE_PREVIEW_URL=<url>` (3-step rail-collapse assertion only) | `MoneyNeedsAllocator`, `yearPlanService`, `GamePlanV2`, `firestore.rules` yearPlan block |
| Money Needs merged surface (flag-ON render + swap) | `smoke-money-needs-merged-local.mjs` | **local flag-ON** — `VITE_MONEY_NEEDS_MERGED_ENABLED=true`; `A11Y_AGENT_*` | `MoneyNeedsPanel`, `MoneyNeedsAllocator`, merged-surface gating logic |
| Commission-first allocator (line number = commission, rate → derived API) | `smoke-commission-first-local.mjs` | **local flag-ON** — `VITE_MONEY_NEEDS_MERGED_ENABLED=true`; `A11Y_AGENT_*` | `MoneyNeedsAllocator` commission-first input model, rate field, slider label |
| AllocationSummaryCard (line rows, total, ack modal) | `smoke-summary-card-local.mjs` | **local** — `A11Y_AGENT_*`; optional `BASE` as argv[2] (default `localhost:5175`) | `AllocationSummaryCard`, ack modal, per-product subtotals |
| Agent Dashboard home v2 (HeroCard, Pulse chips, StandardDetail) | `smoke-agentdash-home-v2.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` | `AgentDashboard`, `HeroCard`, `PulseChips`, `StandardDetail`, tab routing |
| Agent Dashboard nav IA v2 (sidebar groups, tab routing, mobile BOTTOM_NAV) | `smoke-agentdash-nav-v2.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` | `navConfig`, sidebar sections, tab IDs, `BOTTOM_NAV`, `AgentDashboard` routing |
| Career Portal v2 (career ladder, CommitmentScorecards, TimeToNext, Trajectory) | `smoke-career-portal-v2.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` | `CareerPortal`, career-ladder nodes, `CommitmentScorecards`, `TrajectoryCard` |
| History + Awards tabs v2 (HistoryAnchorStrip, AwardDrillDrawer) | `smoke-history-awards-v2.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` | `HistoryTab`, `AwardsTab`, `SubmissionViewer` drawer, `AwardDrillDrawer` |
| Nav redesign PR-1 (navConfig, sidebar groups, scope chips, Planner SOON) | `smoke-nav-pr1.mjs` | **preview-capable** — `SMOKE_BASE_URL=<url>` + `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` + `A11Y_UNIT_MANAGER_*` + `A11Y_BRANCH_MANAGER_*` | `navConfig`, sidebar group definitions, scope chips, `AgentDashboard`/`ManagerDashboard` nav, mobile `More` drawer |
| Nav redesign PR-2 (★ Pinned model, localStorage mirror, Firestore prefs round-trip) | `smoke-nav-pr2.mjs` | **preview-capable** — `SMOKE_BASE_URL=<url>` + `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` + `A11Y_UNIT_MANAGER_*`; Firestore round-trip leg is **deploy-gated** (`prefs/{prefId}` rule must be live in prod) | `NavPrefs` localStorage mirror, `prefs/{prefId}` Firestore rules, pinned-nav seed config |
| Nav redesign PR-3 (Quick-Add FAB, daily entry, mobile bottom sheet) | `smoke-nav-pr3.mjs` | **preview-capable** — `SMOKE_BASE_URL=<url>` + `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` + `A11Y_UNIT_MANAGER_*` | Quick-Add FAB, `DailyCaptureV2` entry point, mobile bottom sheet, `MeetingMode` launch |
| Nav redesign PR-4 (Menu-layout preference, Workspace / Both layouts) | `smoke-nav-pr4.mjs` | **preview-capable** — `SMOKE_BASE_URL=<url>` + `VERCEL_BYPASS_TOKEN` + `A11Y_UNIT_MANAGER_*` (required; fail-loud if absent) + `A11Y_AGENT_*` | `menuLayout` preference, `NavPrefsResolver`, Workspace/Both layouts, layout persistence |
| DailyCaptureV2 Sunday confirm flow (week-targeting, SundayConfirmView, wizard pre-fill) | `smoke-sunday-confirm-check.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*`; **Sunday-gated** (some legs skip on non-Sunday) | `DailyCaptureV2` Sunday mode, `SundayConfirmView`, week-targeting logic, wizard draft pre-fill |
| Producing-manager fast-path Confirm (daily FAB → DailyCaptureV2 → Confirm screen) | `smoke-mp-fastpath-confirm.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_UNIT_MANAGER_*` (default) or `A11Y_BRANCH_MANAGER_*` (`MP_ROLE=branch`); MP-1 leg **Sunday-gated** | `ManagerDashboard` daily-entry path, producing-manager `DailyCaptureV2` mount, Confirm screen routing |
| Onboarding wizard Slice C (Money Needs, Game Plan, Profile, Goals teaser, `onboardingComplete`) | `smoke-648-onboarding-slice-c.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` + `VITE_FIREBASE_API_KEY` (admin SDK reads) | `OnboardingWizard`, MoneyNeeds / GamePlan / Profile / Goals steps, `onboardingComplete` flag, localStorage resume |
| Tenure Firestore rules (write-once `contractStartDate` / `monthsAtTatil`) | `smoke-649-tenure-rules.mjs` | **admin-SDK only** (no browser) — firebase-admin via `functions/node_modules`; `VITE_FIREBASE_API_KEY` + service account ambient creds; runs against **prod Firestore** post-rules-deploy | `firestore.rules` tenure write-once block, `contractStartDate` / `monthsAtTatil` write guards |
| Brand-mark / logo (icons.svg asset, WizardWelcome, sidebar) | `smoke-650-logo.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*` + `A11Y_BRANCH_MANAGER_*` | `icons.svg` static asset, `WizardWelcome` brand-mark img, sidebar-brand-mark |
| Tenure fields UI (write-once flow, floor validation, derived vs seasoned path) | `smoke-651-tenure-fields.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_AGENT_*`; **re-run requires reset** first (`scripts/maintenance/reset-onboarding-tenure.mjs --apply`); boundary assertion valid until 2026-07-15 | `TenureStep` UI, `monthsInIndustry` derived / seasoned path, floor validation |
| Policy Ledger manager UI (BM Self tab, create + persist + dark mode) | `smoke-653-policy-ledger-mgr-ui.mjs` | **preview-capable** — `VERCEL_BYPASS_TOKEN` + `A11Y_BRANCH_MANAGER_*` + `VITE_FIREBASE_API_KEY` (admin cleanup); smoke self-cleans test policy | `PolicyLedgerPanel`, `GoalsPanel` SelfTab, BM credentials, `firestore.rules` policy-ledger write block |

---

## Ambiguous / one-off smokes

These files exist in `scripts/verification/` but their standing status is unclear. Listed here for discoverability; do not include in re-run checklists without confirming the smoke is still applicable to current code.

| File | Why ambiguous |
|------|--------------|
| `smoke-money-needs-rev4-5.mjs` | PR #738 UX-polish verification; behaviors now established — may be superseded by the standing Money Needs smokes above |
| `smoke-money-needs-double-tax-fix.mjs` | PR #734 bug-fix verification; regression asserted in `smoke-money-needs-summary-clarity.mjs` L3 |
| `smoke-money-needs-summary-clarity.mjs` | PR #735 verification; L3 is a regression guard (playground double-tax fix) — borderline standing |
| `smoke-wizard-confirm-phase2.mjs` | Self-labeled "ad-hoc, not committed" in file header; Wizard v3 Phase 2 one-off |
| `smoke-wizard-confirm-preview.mjs` | Self-labeled "ad-hoc, not committed" in file header; Wizard v3 Phase 1 one-off |

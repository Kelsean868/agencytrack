# Claude Design Handoff — Curated Screenshot Set

**Purpose:** input set for a Claude Design critique of the AgencyTrack webapp (portal.agencytrack.app).
One best representative cell per screen (desktop; light unless dark shows the design better).
Two batches so each attach stays well under CD's degradation threshold (~30 images).

Sources: `docs/audits/ux/screenshots/` (2026-07-04 full audit) + `docs/audits/webapp-ux/screenshots/`
(2026-07-04 follow-up walk: wizard, daily capture, meeting mode). All screens show the seeded
Smoke test tenant — **do not share externally without redacting test-account emails** (INFO-001).

**Known coverage gaps:** branch-manager *per-agent drill-in tabs* were not captured in either audit
pass; unit-manager / sales-manager / platform-admin role views likewise. Meeting Mode deck shown is
the 2-slide empty-week state.

---

## Batch A — login + agent-facing screens + input flows (23)

| # | File | Screen | Role | Viewport / theme | What it demonstrates |
|---|------|--------|------|------------------|----------------------|
| 01 | batch-a-01-login-desktop-light.png | Login | unauthenticated | desktop light | Card-on-pattern login, brand mark, teal primary; always renders light (known bug A11Y-002) |
| 02 | batch-a-02-agent-dashboard-desktop-light.png | Agent dashboard | agent | desktop light | Teal YTD hero + 6-card KPI row + points card; the app's signature screen |
| 03 | batch-a-03-agent-dashboard-desktop-dark.png | Agent dashboard | agent | desktop dark | Warm near-black dark mode, lifted-teal accents — dark-identity reference |
| 04 | batch-a-04-agent-daily-log-tab-desktop-light.png | Daily Log tab | agent | desktop light | Day-by-day log history surface (sidebar tab, not the takeover) |
| 05 | batch-a-05-daily-capture-entry-desktop-light.png | Daily Capture — entry | agent | desktop light | Full-screen "Log Today" takeover, stepper counters, pts pill; note day-strip wrap + narrow column (BUG-103 / DESIGN-102) |
| 06 | batch-a-06-daily-capture-saved-desktop-light.png | Daily Capture — saved | agent | desktop light | Reopened after save: streak flame, loaded values, week strip states |
| 07 | batch-a-07-wizard-select-week-desktop-light.png | Wizard — select week | agent | desktop light | Sparse pre-screen (single select + CTA on empty canvas) |
| 08 | batch-a-08-wizard-step1-letters-desktop-light.png | Wizard — step 1 | agent | desktop light | Wizard chrome: phase rail, live "Your week so far" panel, contextual Next label, Saved chip |
| 09 | batch-a-09-wizard-step7-new-business-desktop-light.png | Wizard — step 7 | agent | desktop light | Sales phase step (new business / policy entry) |
| 10 | batch-a-10-wizard-review-submit-desktop-light.png | Wizard — review & submit | agent | desktop light | Summary card with per-section Edit·Step jump-backs, phase rail complete |
| 11 | batch-a-11-wizard-celebration-desktop-light.png | Wizard — celebration | agent | desktop light | Post-submit reward moment ("You shipped", points, leaderboard copy) |
| 12 | batch-a-12-game-plan-desktop-light.png | Game Plan | agent | desktop light | Year-plan hero with 3-step done rail + stacked plan tiers — strongest planning surface |
| 13 | batch-a-13-money-needs-desktop-light.png | Money Needs | agent | desktop light | Needs worksheet (line-item allocation feeding Game Plan) |
| 14 | batch-a-14-goals-desktop-light.png | Goals | agent | desktop light | Personal commitment vs hierarchy targets, gap analysis |
| 15 | batch-a-15-commission-desktop-light.png | Commission | agent | desktop light | Reality hero band + Commission Playground reverse-calculator form |
| 16 | batch-a-16-persistency-desktop-light.png | Persistency | agent | desktop light | Persistency metric surface with playground |
| 17 | batch-a-17-policy-ledger-desktop-light.png | Policy Ledger | agent | desktop light | Per-policy cards/timeline strip |
| 18 | batch-a-18-financing-desktop-light.png | Financing | agent | desktop light | Agent self-view of financing status |
| 19 | batch-a-19-history-desktop-light.png | History | agent | desktop light | Submitted-weeks list |
| 20 | batch-a-20-production-report-desktop-light.png | Production Report | agent | desktop light | Tabular production report surface |
| 21 | batch-a-21-leaderboard-desktop-light.png | Leaderboard | agent | desktop light | Editorial headline ("Who's leading the year.") + crafted gold-medal empty state |
| 22 | batch-a-22-awards-desktop-dark.png | Awards | agent | desktop dark | Award hero ring + QUALIFIED/ALMOST THERE tiers with gold accents — best-in-app dark composition |
| 23 | batch-a-23-career-desktop-light.png | Career Portal | agent | desktop light | Level/CPD career progression surface |

## Batch B — tenant-admin + branch-manager operational + meeting/kiosk (22)

| # | File | Screen | Role | Viewport / theme | What it demonstrates |
|---|------|--------|------|------------------|----------------------|
| 01 | batch-b-01-admin-dashboard-desktop-light.png | Admin dashboard | tenant_admin | desktop light | KPI trio + users-by-role bars + branch overview |
| 02 | batch-b-02-admin-branches-desktop-light.png | Branches | tenant_admin | desktop light | Branch config panel |
| 03 | batch-b-03-admin-users-desktop-light.png | All Users | tenant_admin | desktop light | User management table (contains test-account emails — redact before sharing) |
| 04 | batch-b-04-admin-config-desktop-light.png | Company Config | tenant_admin | desktop light | Company minimums / tenant settings forms |
| 05 | batch-b-05-admin-campaigns-desktop-light.png | Campaigns | tenant_admin | desktop light | Campaign management panel |
| 06 | batch-b-06-bm-overview-desktop-light.png | Overview | branch_manager | desktop light | Manager landing: branch KPIs + actions |
| 07 | batch-b-07-bm-mastersheet-desktop-light.png | MasterSheet | branch_manager | desktop light | Weekly submissions grid — note bare empty state (UX-001) |
| 08 | batch-b-08-bm-team-performance-desktop-light.png | Team Performance | branch_manager | desktop light | Team production dashboard |
| 09 | batch-b-09-bm-compliance-desktop-light.png | Compliance | branch_manager | desktop light | "Filing Reality" teal band + nudge roster — strongest manager surface |
| 10 | batch-b-10-bm-settlements-desktop-light.png | Settlements | branch_manager | desktop light | Settlement entry/confirmation surface |
| 11 | batch-b-11-bm-financing-desktop-light.png | Financing | branch_manager | desktop light | Financing terms + risk monitor panels |
| 12 | batch-b-12-bm-policy-reconciliation-desktop-light.png | Policy Reconciliation | branch_manager | desktop light | Ledger-vs-settlement reconciliation panel |
| 13 | batch-b-13-bm-team-wars-desktop-light.png | Weekly WARs | branch_manager | desktop light | Team weekly-activity-report review |
| 14 | batch-b-14-bm-team-gameplans-desktop-light.png | Team Game Plans | branch_manager | desktop light | Team year-plan adoption view |
| 15 | batch-b-15-bm-goals-desktop-light.png | Goals | branch_manager | desktop light | Branch/unit target setting |
| 16 | batch-b-16-bm-persistency-desktop-light.png | Persistency | branch_manager | desktop light | Persistency entry + at-risk book |
| 17 | batch-b-17-bm-agent-of-month-desktop-light.png | Agent of Month | branch_manager | desktop light | AOM category scoring surface |
| 18 | batch-b-18-bm-my-war-desktop-light.png | My WAR | branch_manager | desktop light | Manager's own weekly activity report |
| 19 | batch-b-19-bm-production-report-desktop-light.png | Production Report | branch_manager | desktop light | Branch production report |
| 20 | batch-b-20-bm-campaigns-desktop-light.png | Campaigns | branch_manager | desktop light | Branch campaign panel |
| 21 | batch-b-21-bm-kiosk-desktop-light.png | Kiosk Mode | branch_manager | desktop light | TV-dashboard URL generator — sparsest surface in the app |
| 22 | batch-b-22-meeting-mode-desktop-dark.png | Meeting Mode | branch_manager | desktop (always-dark presentation) | Theme-independent projector surface on presentation tokens (empty-week 2-slide deck) |

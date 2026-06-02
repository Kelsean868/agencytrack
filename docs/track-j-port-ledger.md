# Track J — V2 Redesign port-completeness ledger

**Snapshot date:** 2026-06-01 (main HEAD `e301213` post-#418 Wizard v2 PR2 live-compute layer. Wizard row 5 stays **PARTIAL** — shell + compute layer ported (PR1 #416 + PR2 #418); discrete Review step + celebration pending PR3. Headline NOT advanced.)

**Source of truth:** `design_handoff_v2_app/mockups/` — 35 `.html` files, of which **34 are canonical screens** per the v2 handoff README §6 (`app-leaderboard-around-me.html` is an auxiliary artboard inside the Leaderboard screen, not a separate canonical screen).

**Out of scope (per v2 handoff README §12):** the Tenant Admin configuration suite (Dashboard, Branches, Company Config, Awards Ruleset, Plan Catalog, Bulk Imports) is intentionally excluded from the v2 mockups and not counted as a port gap.

**Not Track J:** `mocks/concept-*.html` (concept-1-clarity, concept-2-command, concept-3-momentum, concept-4-complete, concept-4-hybrid, manager-portal-concepts) — these are the older Track B "Concept 4 Complete" mocks already shipped via PRs #42–#55.

## Headline (snapshot)

**14 of 34 v2 screens ported.** Track J stacked-sequence finale: #413 Kiosk + #414 System Screens + #415 Emails. Persistency v2 row 10 remains agent-side-only (manager-entry side pending). Leaderboard row 28 fully ported through #411 (agent + UM/BM/SM).

**20 pending v2 mockups remain to port.** Surprise-stop on the first restyle attempt (Wizard v2, this session) surfaced a class of brief-vs-mockup contradictions that means several "pending restyle" rows are actually **REDESIGN**s, not chrome-only restyles. See `docs/FOLLOW_UPS.md` for the Wizard v2 REDESIGN reclassification; STEP 2 of the same session re-classifies the remaining 23.

## Ledger — 34 canonical v2 screens

| # | Screen mockup | Status | PR# | React component(s) | Note |
|---|---|---|---|---|---|
| 1 | App Layout | **PORTED** | [#388](https://github.com/Kelsean868/agencytrack/pull/388) (`63cb0cf`) | `shell/Shell.jsx`, `Sidebar.jsx`, `TopBar.jsx` | App Shell chrome restyle; covers the three shell-related mockup HTMLs |
| 2 | App Mobile | **PORTED** | [#388](https://github.com/Kelsean868/agencytrack/pull/388) (bundled) | `shell/MobileBottomNav.jsx` | Bundled with shell restyle |
| 3 | Mobile Nav | **PORTED** | [#388](https://github.com/Kelsean868/agencytrack/pull/388) (bundled) | `shell/MobileNavDrawer.jsx` | Bundled with shell restyle |
| 4 | Agent Dashboard v2 | **PORTED** | [#392](https://github.com/Kelsean868/agencytrack/pull/392) (`fd9fdd6`) + [#393](https://github.com/Kelsean868/agencytrack/pull/393) (`9a145e6`) | `dashboard/AgentDashboard.jsx` + `HeroCard`, `PulseStrip`, `NeedsActionBanner`, `StandardDetail` | Pair: nav IA (#392) then home rework (#393). 2 LOW FUs banked (HeroCard YoY delta, DeliveryStripCard wire) |
| 5 | Weekly Report Wizard v2 | **PARTIAL — shell + compute layer ported (PR1 + PR2); review/celebration pending (PR3)** | [#416](https://github.com/Kelsean868/agencytrack/pull/416) (`ebefb89`) shell · [#418](https://github.com/Kelsean868/agencytrack/pull/418) (`e301213`) compute layer | `wizard/WizardForm.jsx` (rewired) · `wizard/v2steps/*` (PR1, NEW) · `wizard/v2chrome/{PhaseProgress,AutosaveChip,WeekSoFarPanel,MiniSparkline}.jsx` (NEW; last two = PR2) · `wizard/CardStack.jsx` (NumericField + CurrencyField gain optional `lastWeek` prop) · `lib/schema/wizardLive.computations.js` + `wizardLive.config.js` (NEW, pure compute lib importing canonical formulas) · `utils/extractFields.js` (extracted `computeTotalNewNames` for app-wide single source of truth) · `services/submissionService.js` (added `getRecentSubmissions`, `getLastSubmission` refactored to thin wrapper) · legacy `wizard/steps/Step1–9.jsx` (unchanged) | PR1 (MERGED) = 12-step/4-phase shell. PR2 (this row, OPEN) = WeekSoFarPanel desktop rail + mobile collapsed strip + 6-week MiniSparkline + last-week field hints + canonical-formula reuse (decisions A/C/D/E locked). PR3 = discrete Review step 12 + Edit·Step-N jump-back + submit celebration (FU). Decision-A SUGGESTED-atom + goal-seeding deferred (FU). Post-PR3 legacy-step retirement + v2steps dedupe (FU). Mobile expand-to-sheet (FU, LOW). |
| 6 | Daily Capture v2 | PENDING | — | `daily/DailyEntryModal.jsx`, `dashboard/DailyFAB.jsx` | NOT YET AUDITED (held pending Wizard v2 reclassification). Classification deferred to STEP 2 audit table |
| 7 | Game Plan v2 | PENDING | — | `agent/MoneyNeedsPanel.jsx`, `goals/GapAnalysisPanel.jsx` | MoneyNeedsPanel is recent skeleton (#343 G1), not v2-styled |
| 8 | Goals v2 | PENDING | — | `manager/GoalsPanel.jsx`, `wizard/steps/Step9Goals.jsx` | Cascade + agent target |
| 9 | Policy Ledger v2 | PENDING | — | `agent/PolicyLedgerPanel.jsx` | Shipped pre–Track J via Track H (#300) |
| 10 | Persistency v2 | **PORTED (agent only)** | [#395](https://github.com/Kelsean868/agencytrack/pull/395) (`f62ea76`) | `agent/PersistencyTab.jsx` ✓ · `manager/PersistencyTab.jsx`, `PersistencyEntryForm`, `PersistencyAgentRow` ✗ | Manager-entry side within same mockup pending |
| 11 | Prospect Prep v2 | PENDING | — | `agent/ProspectInfoPanel.jsx`, `manager/JointCallsTab.jsx` | Track F shipped functional surfaces (#246, #319, #360, #365) |
| 12 | Commission v2 | PENDING | — | `goals/CommissionPlayground/` | |
| 13 | Agent Awards v2 (incl. Manager Awards section per README §6) | **PORTED** | [#391](https://github.com/Kelsean868/agencytrack/pull/391) (`84abe6e`) + [#412](https://github.com/Kelsean868/agencytrack/pull/412) (`4dc0859`) | `awards/AgentAwardsPanel.jsx` ✓ (#391) · `awards/ManagerAwardsPanel.jsx` ✓ + `awards/BmAtRiskPanel.jsx` ✓ (manager-side carve-out) · new `awards/awardPrimitives.jsx` + `awards/awardGrouping.js` shared modules | `AwardMedalCard.jsx` + `AwardMedal.jsx` + `awardIconMap.js` now orphaned (cleanup FU banked) |
| 14 | Career Portal v2 | **PORTED** | [#389](https://github.com/Kelsean868/agencytrack/pull/389) (`8371818`) | `profile/CareerPortal.jsx` | Career ladder + commitment scorecards |
| 15 | History v2 | **PORTED** | [#390](https://github.com/Kelsean868/agencytrack/pull/390) (`f151183`) | `submissions/HistoryTab.jsx` + WeekCard + year heatmap + YTD anchor strip | |
| 16 | Agent Report View v2 | **PORTED** | [#397](https://github.com/Kelsean868/agencytrack/pull/397) (`e17cb55`) + [#403](https://github.com/Kelsean868/agencytrack/pull/403) (`b12dda1`) | `productionReport/AgentProductionView.jsx` | Hero + 3-KPI + 4-window grid + floor bar; rank pill + around-me. `profile/AgentReportDocument.jsx` (react-pdf) NOT v2-restyled (HEX-only by design) |
| 17 | Settings v2 | PENDING | — | `profile/ProfileScreen.jsx`, `EmailUpdateModal` | |
| 18 | Manager Dashboard v2 | PENDING | — | `dashboard/ManagerDashboard.jsx` + `ManagerHeroSection`, `ManagerOverviewTab`, `BranchKPIStrip`, `TeamMedalsPanel`, `BranchActivityFeed` | Touched in #409 for nav swap; no v2 visual port |
| 19 | Master Sheet v2 | PENDING | — | `manager/MasterSheet.jsx` | 23-col sticky table — no v2 restyle |
| 20 | Compliance v2 | PENDING | — | `manager/CompliancePanel.jsx` | |
| 21 | Weekly WARs | PENDING | — | `manager/ManagerWarTab.jsx`, `ManagerWarDetail.jsx`, `TeamWarsTab.jsx` | |
| 22 | Monthly Recruiting | PENDING | — | `manager/MonthlyRecruitingTab.jsx` | |
| 23 | Campaigns | PENDING | — | `campaigns/CampaignPanel.jsx`, `CampaignCard.jsx` | |
| 24 | Manager Reports | PENDING | — | `productionReport/UnitManagerProductionView.jsx`, `BranchManagerProductionView.jsx`, `ProductionReportTab.jsx` | Manager-tier views; `RankedLeaderboard` token-swapped in #396 |
| 25 | Branch Report | PENDING | — | `productionReport/BranchManagerProductionView.jsx` + `ProductionTable` | Open FU: BranchManagerProductionView + Leaderboard podium aggregate-wiring |
| 26 | Reports | PENDING | — | `productionReport/ProductionReportTab.jsx` | Cross-scope reports surface |
| 27 | Production Report v2 | PENDING (agent variant only via #397) | — | `productionReport/ProductionReportTab` + scope views | Agent variant ported (rows 16 + 24 dimensions); UM/BM/SM scopes remain |
| 28 | Leaderboard | **PORTED (agent + UM/BM/SM)** | [#396](https://github.com/Kelsean868/agencytrack/pull/396) (`c0c956a`) + [#401](https://github.com/Kelsean868/agencytrack/pull/401) (`8a1aeb2`) + [#402](https://github.com/Kelsean868/agencytrack/pull/402) (`6eb465c`) + [#404](https://github.com/Kelsean868/agencytrack/pull/404) (`a3b0142`) + [#406](https://github.com/Kelsean868/agencytrack/pull/406) (`20a2be2`) + [#407](https://github.com/Kelsean868/agencytrack/pull/407) (`c5d099e`) + [#408](https://github.com/Kelsean868/agencytrack/pull/408) (`b72bfd0`) + [#409](https://github.com/Kelsean868/agencytrack/pull/409) (`189ae56`) + [#411](https://github.com/Kelsean868/agencytrack/pull/411) (`40296b6`) | `productionReport/ProductionLeaderboardSurface.jsx` + `leaderboard/SmLeaderboardView.jsx` + `WeeklyChampionsBanner`, `RankedLeaderboard`, `gamification/Leaderboard.jsx` | Backend infra: #399 (CJS ranking mirror), #400 (aggregate CF), #405 (aggregate enrichment), #410 (test-data seed). All role tiers shipped through #411 (SM all-branches picker) |
| 29 | CRO | PENDING | — | `manager/PolicyReconciliationPanel.jsx`, `SettlementPanel.jsx`, `productionReport/*` + ★ Delivery Register / 30-day clawback clock | Role routing also needs decision (README §7 — `App.jsx` has no CRO branch) |
| 30 | Policy Reconciliation | PENDING | — | `manager/PolicyReconciliationPanel.jsx` | |
| 31 | Kiosk Mode | **PORTED** | [#413](https://github.com/Kelsean868/agencytrack/pull/413) (`e685610`) | `kiosk/KioskShell.jsx`, `KioskModeTab.jsx`, `KioskRoute.jsx`, `kiosk/panels/*` | Animation/visual restyle on `--color-presentation-*` (+ new `gold`/`hot` accents). Infra/routes/validation/rotation UNTOUCHED |
| 32 | Meeting Mode v2 | PENDING | — | `manager/MeetingMode.jsx` | |
| 33 | System Screens | **PORTED** | [#414](https://github.com/Kelsean868/agencytrack/pull/414) (`91f9054`) | `auth/LoginScreen.jsx` ✓ · `App.jsx` (LoadingScreen / PlatformAdminStubScreen / ProvisioningScreen) ✓ · `onboarding/*`, `ui/Toast`, `ConfirmDialog`, `NotificationDrawer` already token-driven (no v2 deltas needed) | Animated drifting glyph backdrop + liquid-glass card + password eye-toggle. Auth flow + AppRoot routing UNCHANGED (the brief's danger zone) |
| 34 | Emails | **PORTED** | [#415](https://github.com/Kelsean868/agencytrack/pull/415) (`aae5c35`) | `functions/email-templates/{monday-nudge,sunday-nudge,password-reset}.{html,txt}` | Email-hex exception applies (inline raw hex required); verified by static render not preview smoke. **Functions deploy gated** — takes effect ONLY after `firebase deploy --only functions` |

## Pending — 24 screens

5. Weekly Report Wizard v2 ← REDESIGN per Wizard v2 surprise-stop (2026-06-01)
6. Daily Capture v2
7. Game Plan v2
8. Goals v2
9. Policy Ledger v2
11. Prospect Prep v2
12. Commission v2
17. Settings v2
18. Manager Dashboard v2
19. Master Sheet v2
20. Compliance v2
21. Weekly WARs
22. Monthly Recruiting
23. Campaigns
24. Manager Reports
25. Branch Report
26. Reports
27. Production Report v2 (UM/BM/SM scopes)
29. CRO (also needs role routing decision per README §7)
30. Policy Reconciliation
32. Meeting Mode v2

## Partial-port carve-outs (already counted as PORTED above)

- **Row 10 Persistency v2** — manager-entry side (`manager/PersistencyTab.jsx`, `PersistencyEntryForm`, `PersistencyAgentRow`) within the same Persistency v2 mockup is pending.
- **Row 13 Agent Awards v2** — ~~Manager Awards subsection pending~~ **RESOLVED via PR #412**. Both `ManagerAwardsPanel.jsx` and `BmAtRiskPanel.jsx` now consume the v2 grammar via the new `awardPrimitives.jsx` + `awardGrouping.js` shared modules. Two cleanup FUs banked: (a) dedup AgentAwardsPanel's inline copies onto the shared primitives; (b) delete now-orphaned `AwardMedalCard.jsx` + `AwardMedal.jsx` + `awardIconMap.js`.
- **Row 28 Leaderboard** — fully ported through #411 (agent + UM/BM/SM all live); only PA still uses the legacy points-board fallback (cleanup FU banked).

## Methodology note (from this session's surprise-stop)

Mockup-vs-brief contradictions surfaced on Wizard v2 are likely to recur. The audit table in STEP 2 (separate output) classifies each remaining pending mockup as **TRUE-RESTYLE** (presentational only — chrome + tokens, same composition + data, no new computation) vs **REDESIGN** (re-pagination, new live/derived data, new components, new flows). Briefs for REDESIGN-class mockups need a different shape than briefs for TRUE-RESTYLE: REDESIGN briefs must allow composition + computation changes; TRUE-RESTYLE briefs lock those down.

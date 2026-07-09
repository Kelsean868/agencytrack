# Hero-Card Conformance Audit — Nexus v2

**Purpose:** Ground the "no blanket hero cards" ruling in actual evidence. For every live screen/tab across all roles, compare against its paired canonical Nexus v2 mockup (`docs/design-system/screens-v2/*.html` + sibling `.jsx` scene files) to determine whether a hero card (a large, usually full-width card at the top of a screen answering one dominant question with supporting data) is: present in both design and live (conforming), absent in both (correct, expected on workspace/table screens), present in design but missing live (a real build gap), or present live but not called for by design (drift).

**Date:** 2026-07-09

**Method note:** The canonical `screens-v2/*.html` mockup files are thin script-loader shells; the actual markup/design intent lives in sibling `.jsx` scene files (or, for net-new Track K / Money-Needs builds, in `design_handoff_*` build-annotation HTML). All "design has hero" findings below trace to those sibling files, not the `.html` wrapper text — matching the catalog's own guidance that the `.jsx` scenes are the mockups' render source. Hero was read structurally (a standalone full-width card immediately below the page header, one dominant number/answer + supporting stats — commonly implemented with `.glass.hero.teal` in both mockups and live code) rather than by literal string-matching "hero," since the word appears loosely in some source comments (e.g. leaderboard podiums, career-ladder framing) without denoting this specific pattern.

---

## 1. Summary counts

| Classification | Count |
|---|---|
| MATCH-HAS (design has hero, live has hero) | 20 |
| MATCH-NONE (design has no hero, live has none — correct absence) | 15 |
| MISSING (design has hero, live lacks it) | 8 |
| EXTRA (live has a hero design doesn't call for) | 0 |
| UNCLEAR (mockup/pairing ambiguous or unreadable) | 12 |
| **Total screens/tabs covered** | **55** |

Not counted in the table above (no live surface exists, or the artifact isn't a content screen — see § Gaps): agent `planner` tab (coming-soon gated), CRO Branch Desk + Delivery Register (role not routed at all), sales_manager cross-branch overview (doesn't exist as a distinct screen), and four shell/system artifacts (`App Layout.html`, `App Mobile.html`, `Mobile Nav.html`, `Emails.html`) which depict chrome/infrastructure, not a single content screen.

**Headline finding supporting the ruling:** hero cards are NOT applied blanket in the canonical design itself. 15 of 55 audited screens are MATCH-NONE — the mockups themselves show no hero on workspace/table/roster/form-type screens (Master Sheet, Weekly WARs list, Monthly Recruiting, Campaigns hub, tenant-admin roster/config screens, Weekly Wizard, Career Portal, Settings, financing terms setup). The live app's inconsistency is real (8 MISSING), but it is inconsistency relative to a *selective* design intent, not relative to a blanket rule — reinforcing that the fix is "port the heroes the design actually specifies," not "add a hero everywhere."

---

## 2. Full table

### Agent-role screens

| Role | Screen | Mockup ref | Design hero? | Live hero? | Classification | Notes |
|---|---|---|---|---|---|---|
| agent | Dashboard | `screens-v2/app-dashboard-v2.jsx:127-200` (`HeroCard`) | Y — YTD Settled API vs. annual goal, progress bar, MDRT marker, "Submit weekly report" CTA | Y | **MATCH-HAS** | `src/components/dashboard/HomeV2/index.jsx:220` → `HeroCard.jsx:16-70`. Near 1:1 port. |
| agent | Daily Capture (modal) | `screens-v2/dailycap-shared.jsx:149-189` (`DailyAnchorStrip`) | Y — "Today's activity is logged" headline, streak-flame stat, week-to-date progress bar | N | **MISSING** | `src/components/daily/DailyCaptureV2.jsx:686-742` — collapsed to a slim sticky header with an inline `Flame` badge (line 706-715), no headline sentence, no WTD bar in the header. |
| agent | Weekly Wizard | `screens-v2/wizard-v2-screens.jsx` | N — step form, header + phase-progress rail only | N | **MATCH-NONE** | `src/components/wizard/WizardForm.jsx:522-581`. Active-entry flow, correctly hero-free both sides. |
| agent | Game Plan | `screens-v2/gameplan-shared.jsx:243-296` (`PlanAnchorStrip`) | Y — "Earn TTD X to cover your year," committed/draft badge, PLAN BUILT %, after-tax/gross-need chips | Y | **MATCH-HAS** | `src/components/dashboard/GamePlanV2/index.jsx:376` renders its own `PlanAnchorStrip.jsx`. |
| agent | Goals | `screens-v2/goals-v2-shared.jsx:55-92` (`GoalCascade`) | UNCLEAR — the file paired to "Goals v2" is actually the **branch-manager's** Goals surface (5-agent cascade inside `ManagerShell`), not an agent-scoped mockup | Y — `data-testid="commitment-hero"` | **UNCLEAR** | Live: `src/components/goals/GapAnalysisPanel.jsx:43-121,291` (`CommitmentHero`). No true agent-only Goals mockup exists in this set to certify design intent for this row. |
| agent | Commission | `screens-v2/commission-v2-shared.jsx:267-320` (`AnchorStrip`) | Y — "On pace for TTD X," YTD earned, gap-to-goal, progress bar | Y | **MATCH-HAS** | `src/components/agent/CommissionAnchorStrip.jsx:39+` (`.glass.hero`), mounted `AgentDashboard.jsx:831`. |
| agent | Persistency | `screens-v2/persistency-v2-scenes.jsx` (branch-manager roster scene) / `screens-v2/persistency-lab.jsx:148-193` (`AgentPlayground`) | UNCLEAR — primary "Persistency v2" mockup is the manager roster view, not agent self-view; the Playground alt file is closer but framed as a coaching tool | Y — `data-testid="agent-persistency-summary"` | **UNCLEAR** | Live: `src/components/agent/PersistencyTab.jsx:106-141` (`@@hero-pane-start` glass-hero card). Same mockup-pairing gap as Goals. |
| agent | Policy Ledger | `screens-v2/app-policy-v2.jsx:222-291,856-857` (`PipelineStrip`) | Y — "{N} policies in motion," 5-stage pipeline tiles | Y | **MATCH-HAS** | `src/components/agent/PolicyLedgerPanel.jsx:297` → `src/components/agent/policyLedger/PipelineStrip.jsx`. |
| agent | History | `screens-v2/history-v2-shared.jsx:168+` (`HistoryAnchorStrip`) | Y — "YOUR YEAR" weeks-submitted count, YTD API, "on track for X," streak chips | Y | **MATCH-HAS** | `src/components/submissions/HistoryTab.jsx:84-185,514` (`@@hero-pane-start`, `.glass.hero.teal`). |
| agent | Production Report | `screens-v2/prodreport-v2-scenes.jsx:56-77` (explicit `{/* hero */}`) | Y — name/avatar, "BRANCH RANK N/28," 3 big stats | Y | **MATCH-HAS** | `src/components/productionReport/AgentProductionView.jsx:154-204` (`.glass.hero.teal`). Near-identical field set. |
| agent | Leaderboard | `screens-v2/app-leaderboard.jsx:97` (3-card podium grid) | N (by structural rubric — a 3-card comparison, not a single-answer hero, despite "hero" in the source comment) | N | **MATCH-NONE** | `src/components/leaderboard/ProductionLeaderboardSurface.jsx` — same podium-grid pattern. |
| agent | Awards | `screens-v2/app-awards-v2.jsx:90-149` (`HeroAwardCard`) | Y — "★ ALMOST THERE," donut %, "TTD X to qualify" | Y | **MATCH-HAS** | `src/components/awards/AgentAwardsPanel.jsx:128,151` (`heroAward` = highest-% in-contention award). |
| agent | Career Portal | `screens-v2/app-career-v2.jsx:609-635` (2-col grid, ladder + sidebar) | N (structurally two columns, no full-width hero, despite "the hero" language in a source comment) | N | **MATCH-NONE** | `src/components/profile/CareerPortal.jsx:838-856` — line-for-line same 2-col grid. |
| agent | Prospect Prep | `screens-v2/prospect-pages.jsx:5-86` (`NextCallHero`) | Y — "YOUR NEXT JOINT CALL," client name/age/occupation, countdown badge | N/A | **MISSING** | `src/components/dashboard/AgentDashboard.jsx:761` — `<ComingSoonPanel label="Prospect Prep" />`; feature not built at all (same state as the skipped `planner` tab). |
| agent | Settings | `screens-v2/settings-v2.jsx:171-199` | N — tabs + setting-group lists | N | **MATCH-NONE** | `src/components/profile/ProfileScreen.jsx:191-239` — leads with an avatar/photo card (identity block, not a KPI hero), then form fields. |
| agent | Financing (self-view) | `design_handoff_track_k/Track K Financing Self-View - Build.html:392-459` (`.hero` block, explicitly locked-in per the doc's own design rationale) | Y — "You're carrying TTD 22,400 — on track to clear it by month 12" narrative + wind-down clocks | N | **MISSING** | `src/components/financing/FinancingSelfView.jsx:265-308` — flat "Your financing agreement" card, 3-figure grid, no narrative headline/arc; wind-down clocks exist but as a separate plain card. |

### Producing-manager (unit_manager + branch_manager) — team-oversight screens

| Role | Screen | Mockup ref | Design hero? | Live hero? | Classification | Notes |
|---|---|---|---|---|---|---|
| UM/BM | Team Dashboard (`overview`) | `AgencyTrack Manager Dashboard v2.html` | Y — Team YTD API vs. annual goal, exception-first framing | Y | **MATCH-HAS** | `ManagerHeroSection.jsx:26` (`.glass.hero.teal`), mounted `ManagerOverviewTab.jsx:36`. |
| UM/BM | Team roster (`team`) | none found (checked Master Build Reference — no roster row) | UNCLEAR | N | **UNCLEAR** | `src/components/manager/UserManagementPanel.jsx` — plain `<h2>` header, no hero. No mockup to confirm intended absence. |
| UM/BM | Master Sheet (`mastersheet`) | `AgencyTrack Master Sheet v2.html` | N | N | **MATCH-NONE** | `src/components/manager/MasterSheet.jsx` — dense table, no hero either side. Expected. |
| BM only | Weekly WARs (`team-wars`) | `AgencyTrack Weekly WARs.html` | N | N | **MATCH-NONE** | `src/components/manager/TeamWarsTab.jsx` — list/detail, no hero. |
| UM/BM | Monthly Recruiting (`monthly-recruiting`) | `AgencyTrack Monthly Recruiting.html` | N | N | **MATCH-NONE** | `src/components/manager/MonthlyRecruitingTab.jsx` — own-form + team roster, no hero. |
| UM/BM | Team Plans (`team-game-plans`) | none confidently found (Master Build Ref citation doesn't resolve to a real screen file) | UNCLEAR | N | **UNCLEAR** | `src/components/manager/TeamPlansRoster.jsx` — roster list, no hero. |
| UM/BM | Team Goals (`goals`, scope TEAM) | `screens-v2/goals-v2-shared.jsx` (`GoalCascade`) | Y | Y | **MATCH-HAS** | `src/components/manager/GoalsPanel.jsx:1149-1155` mounts `GapAnalysisPanel` (`data-testid="commitment-hero"`) unconditionally above tabs. **Caveat:** the always-visible hero shows the manager's *own* commitment, not a team aggregate — the actual team data lives in a sub-tab below, so the hero's content is arguably mis-scoped for a screen labeled "Team Goals." |
| UM/BM | Persistency Entry (`persistency`, scope TEAM) | `screens-v2/persistency-v2-scenes.jsx` — "reality bar first" | Y | Y | **MATCH-HAS** | `src/components/manager/PersRealityBar.jsx:75` (`.glass.hero.teal`), mounted in `PersistencyTab.jsx`. |
| UM/BM | Compliance (`compliance`) | `AgencyTrack Compliance v2.html` — "reality bar first (filed %, on-time, late, not-in)" | Y | Y | **MATCH-HAS** | `src/components/manager/CompliancePanel.jsx:450` (`.glass.hero.teal`, `data-testid="compliance-reality-bar"`). |
| UM/BM | Campaigns (`campaigns`) | `AgencyTrack Campaigns.html` — own subtitle calls it "the hub," a multi-card collection, not a hero | N | N | **MATCH-NONE** | `src/components/campaigns/CampaignPanel.jsx` — list/table of campaigns. |
| BM | Team Reports (`production-report`, BM) | `AgencyTrack Production Report v2.html` (role-conditional subtitle) | Y | Y | **MATCH-HAS** | `src/components/productionReport/BranchManagerProductionView.jsx:136` (`.glass.hero.teal`). |
| UM | Team Reports (`production-report`, UM) | same mockup — same "aggregate" framing intended for both tiers | Y | N | **MISSING** | `src/components/productionReport/UnitManagerProductionView.jsx:126` — structurally identical "Unit Aggregate" card (Total API/Apps/Avg API-per-agent) but rendered as a **plain `.card`**, no hero class. Internal UM/BM inconsistency, likely an oversight rather than a deliberate distinction. |
| UM/BM | Team Awards (`awards`, scope TEAM) | none found (no manager-specific "Awards v2" mockup) | UNCLEAR | Y | **UNCLEAR** | `src/components/awards/ManagerAwardsPanel.jsx:44-60` (`MonthlyBonusHero`); component's own doc-comment says it's a v2 hero port of the agent-awards grammar, so it functionally matches Nexus v2 intent even without a literal manager mockup. |
| UM/BM | Team Roster (`team-perf`) | none found (same gap as `team`) | UNCLEAR | N | **UNCLEAR** | `src/components/manager/TeamPerfRosterPage.jsx:51` — plain `<h2>` + roster table. |
| UM/BM | Settlements (`settlements`) | none found (CRO handoff describes a different role/surface, not this ledger) | UNCLEAR | N | **UNCLEAR** | `src/components/manager/SettlementPanel.jsx` — ledger/table + form. Practically consistent with the no-hero pattern elsewhere, but no true mockup to certify. |
| UM/BM | Reconciliation (`policy-reconciliation`) | `AgencyTrack Policy Reconciliation.html` — "leads with TTD at risk this cycle, then a worklist" | **Y (surprising)** | Y | **MATCH-HAS** | `src/components/manager/PolicyReconciliationPanel.jsx:279` (`.glass.hero.teal`, `data-testid="pending-hero"`). **Flagged per task instructions:** reconciliation/ledger-type screens were expected MATCH-NONE; both mockup and live actually lead with a hero here — a genuine exception to the "workspace screens don't get heroes" heuristic, not silently normalized. |
| BM only | Agent of Month (`agent-of-month`) | none found (Master Build Ref: "within Awards/recognition" — not a literal file) | UNCLEAR | N | **UNCLEAR** | `src/components/manager/AgentOfMonthTab.jsx:96-103` — plain `<h2>` + description text. |
| BM only | Kiosk Mode admin (`kiosk`) | `AgencyTrack Kiosk Mode.html` describes the actual wall-display screen, not this admin tab | UNCLEAR (mismatch) | N | **UNCLEAR** | `src/components/manager/KioskModeTab.jsx` — this tabId is the token-management admin panel (generate/revoke links), a different screen than the mockup depicts. Admin/settings screens are appropriately hero-free; the mockup pairing itself is the problem, not a real gap. |
| UM/BM | Leaderboard (`leaderboard`, scope BOTH) | `AgencyTrack Leaderboard.html` — "#1 as full-width hero" on mobile, elevated podium on desktop | Y | Y | **MATCH-HAS** | `src/components/leaderboard/ProductionLeaderboardSurface.jsx:95-99,522`. Same component serves both UM and BM. |

### Producing-manager (unit_manager + branch_manager) — own-production ("My Production") + Track K financing screens

| Role | Screen | Mockup ref | Design hero? | Live hero? | Classification | Notes |
|---|---|---|---|---|---|---|
| UM/BM | Weekly Report (`mp-report`) | `AgencyTrack Weekly Report Wizard v2.html` — design intent is a **side-rail** panel ("Your week so far"), not a top hero | N | N | **MATCH-NONE** | `src/components/wizard/WizardForm.jsx` — `WeekSoFarPanel` (desktop right-rail / mobile collapsed strip). Same file as the agent wizard; design intent itself is side-panel, and live matches it. |
| UM/BM | Commission (`mp-commission`) | `screens-v2/commission-v2-shared.jsx` | Y | Y | **MATCH-HAS** | `ManagerDashboard.jsx:621-632` renders `CommissionAnchorStrip.jsx:155` (same file as agent Commission) above `CommissionPlayground`. |
| UM/BM | Policy Ledger (`mp-policies`) | `screens-v2/app-policy-v2.jsx` (`PipelineStrip`) | Y | Y | **MATCH-HAS** | `ManagerDashboard.jsx:645` → `PolicyLedgerPanel.jsx:297` — same shared file as agent's tab. |
| UM/BM | My WAR (`my-war`) | `screens-v2/war-v2-desktop.jsx:38-93` (`MyWarCard`) — completion ring, "MY API·THIS WEEK/APPLICATIONS/FILING STREAK" row, submit action | Y | N | **MISSING** | `src/components/manager/ManagerWarTab.jsx` (`ManagerDashboard.jsx:503`) — plain form (week selector, KPI inputs, `AccountabilityFlagPanel`); no completion ring, production summary, streak, or hero. |
| UM/BM | History (`mp-history`) | `screens-v2/history-v2-shared.jsx` (`HistoryAnchorStrip`) | Y | Y | **MATCH-HAS** | `HistoryTab.jsx:84-185,514` — same shared file as agent History. |
| UM/BM | Financing self-view (`mp-financing`) | `design_handoff_track_k/Track K Financing Self-View - Build.html` (`.hero`, `.mhero`, `.hero-eye`) | Y | N | **MISSING** | `ManagerDashboard.jsx:649` → `src/components/financing/FinancingSelfView.jsx` — same shared file/gap as the agent Financing row above (one component, two mounts). |
| UM/BM | Game Plan (`mp-game-plan`) | `screens-v2/gameplan-shared.jsx` — "anchored in your reality" | Y | Y | **MATCH-HAS** | `ManagerDashboard.jsx:613` → `GamePlanV2/index.jsx` (same component as agent Game Plan; hero inferred from source comments, not independently screenshotted — slightly lower confidence). |
| UM/BM | Money Needs (`mp-money-needs`) | `money-needs-allocator-handoff/mockups/Money Needs Merged.html` — "one full-width primary band... restates the required commission as a headline" | Y | **Y, but flag-gated OFF by default** | **MISSING (in shipped default path)** | `src/components/agent/MoneyNeedsPanel.jsx:1197-1213` — `TheSeam` hero band (`MoneyNeedsAllocator.jsx:77-80,689`) only renders when `VITE_MONEY_NEEDS_MERGED_ENABLED=true`; production default is OFF, falling back to the legacy `CommissionTargetsPanel` (no hero). |
| UM/BM | Goals (`mp-goals`, scope MINE) | `screens-v2/goals-v2-shared.jsx` — "Self" cascade segment | Y | Y | **MATCH-HAS** | `GapAnalysisPanel.jsx:40-96,291` (`CommitmentHero`) — same shared file as agent/Team Goals. |
| BM only | Financing terms setup (`financing`) | `design_handoff_track_k/Track K Financing Terms Setup - Build.html` (annotation spec, not a pixel render) | N (best-effort read) | N | **MATCH-NONE** | `src/components/manager/FinancingTab.jsx` → `FinancingTermsSetup.jsx` — both form-first, no hero. Lower confidence since the "mockup" is an annotation doc. |
| UM only | Unit Financing (`unit-financing`) | `design_handoff_track_k/Track K Unit Financing - Unit Manager Build.html` — literal `.reality` "reality strip" | Y | Y | **MATCH-HAS** | `src/components/financing/UnitFinancingRoster.jsx:234-250` (`data-testid="unit-financing-reality"`). Strongest 1:1 match in this audit — near-identical field set and naming lineage. |
| BM only | Take-Home Waterfall (`FinancingTab` sub-view) | `design_handoff_track_k/Track K Take-Home Waterfall - Component.html` — frames the component as an **agent payout embed** | N/A (mismatch) | N | **UNCLEAR** | `src/components/manager/TakeHomeWaterfallView.jsx` — a BM cross-agent picker/breakdown utility, a legitimately different surface than what the mockup describes; neither embodies the mockup's hero framing on its own. |

### sales_manager / tenant_admin / CRO / shell / Meeting Mode

| Role | Screen | Mockup ref | Design hero? | Live hero? | Classification | Notes |
|---|---|---|---|---|---|---|
| sales_manager | Leaderboard (via `SmLeaderboardView`) | `AgencyTrack Leaderboard.html` | not independently re-verified | N/A (wrapper) | **UNCLEAR** | `src/components/leaderboard/SmLeaderboardView.jsx:73` — thin branch-picker wrapper around the same `ProductionLeaderboardSurface` already audited for UM/BM; not a distinct hero-bearing screen. |
| sales_manager | (no cross-branch overview exists) | — | — | — | N/A | Confirmed via `ManagerDashboard.jsx:68-118`: sales_manager shares BM's exact `NAV_ITEMS`; no SM-only screen exists. Not counted in totals. |
| tenant_admin | Dashboard | none (Master Build Ref marks "(B5)" = no mockup) | N/A | N | **MATCH-NONE** | `TenantAdminDashboard.jsx:173-201` — even-weight 3-tile `StatCard` grid + 2-col grid, no primary tile. No mockup exists to contradict this. |
| tenant_admin | Branches | none (Master Build Ref: no mockup) | N/A | N | **MATCH-NONE** | `src/components/admin/BranchesPanel.jsx:198-216` — header + button + list. |
| tenant_admin | All Users | none dedicated; closest is `AgencyTrack System Screens.html:113-114` describing a roster table | N | N | **MATCH-NONE** | `src/components/manager/UserManagementPanel.jsx:534-548` — roster header + filters. Design intent (roster table) confirms no hero was ever intended. |
| tenant_admin | Company Config | Master Build Reference claims `Settings v2.html (admin section)` — **verified false**, no such section exists in that file | N/A (stale citation) | N | **MATCH-NONE** | `src/components/admin/CompanyConfigPanel.jsx:1-40` — flat 6-tile grid regardless. Hero-wise still correct-absence, but the mockup citation itself is broken (see § Gaps). |
| tenant_admin | Campaigns | `AgencyTrack Campaigns.html` — "the hub," multi-card collection | N | N | **MATCH-NONE** | Shared `CampaignPanel.jsx` (same as BM row above). |
| tenant_admin | Profile | `AgencyTrack Settings v2.html` (agent/mobile sections only, not TA-specific) | N/A | not re-derived | **UNCLEAR** | `src/components/profile/ProfileScreen.jsx` — shared cross-role component, out of scope to re-audit here since it's not TA-specific. |
| CRO (unrouted) | Branch Desk (home) | `AgencyTrack CRO.html:53-64` — "a single glance at what needs her today," anchor framing | Y | none | N/A — no live surface | Confirmed unrouted: `src/App.jsx` `MANAGER_ROLES` (no `cro`) and the role-switch has no `cro` branch. Not-yet-built (Master Build Reference: role not routed), not a regression. Not counted in totals. |
| CRO (unrouted) | Delivery Register | `AgencyTrack CRO.html:66-77` — explicitly "the hero" | Y | none | N/A — no live surface | Same as above. Not counted in totals. |
| BM | Meeting Mode — opening/summary slide | `AgencyTrack Meeting Mode v2.html:154-155` — "the week pulse" (one primary metric) + cascade bar + 3 secondary counts, anchor-first | Y | N | **MISSING** | `src/components/manager/MeetingMode.jsx:234-263` — flat 2×2 grid of four equal-weight stats (Total API, Apps Sold, Avg Closing, Submissions), no visual hierarchy, no cascade-bar chart. |
| — | `App Layout.html` / `App Mobile.html` / `Mobile Nav.html` / `Emails.html` | shell chrome / theme demos / email templates, not content screens | — | — | **OUT OF SCOPE** | Excluded from the audit — these depict infrastructure, not a single screen with a "dominant question." See § Gaps. |

---

## 3. MISSING build list

Eight rows above classify MISSING; they collapse to **seven distinct build items** (Financing self-view is one shared component serving two access points — agent `financing` tab and producing-manager `mp-financing` tab — counted as one build item, two audit rows).

### A. Daily Capture anchor strip (agent)
- **Screen:** agent Daily Capture modal (`src/components/daily/DailyCaptureV2.jsx`)
- **Intended hero content (per `screens-v2/dailycap-shared.jsx:149-189`):** a full glass hero card answering "have I logged today" — headline sentence ("Today's activity is logged" / "Log today before you clock off"), a 46px streak-flame stat, and a week-to-date progress bar.
- **Size estimate:** **S** — the live component already has the underlying data (streak count, WTD totals) surfaced elsewhere in the same file as a compact `Flame` badge + `CountStrip`; this is a presentation/layout change (promote existing values into a hero card format), not new data plumbing.
- **Data dependency:** Data already exists and is already rendered (just not in hero format). No new Firestore reads needed.

### B. Prospect Prep hero (agent)
- **Screen:** agent Prospect Prep (`prospect-info` tab)
- **Intended hero content (per `screens-v2/prospect-pages.jsx:5-86`, `NextCallHero`):** "YOUR NEXT JOINT CALL" — client name/age/occupation, an appointment countdown badge, and call facts (when/type/policy/estimated API).
- **Size estimate:** **L** — this is not a hero-only gap; the entire screen is unbuilt (`ComingSoonPanel`). Building the hero is inseparable from building the whole Prospect Prep feature.
- **Data dependency:** Per the Workshop Roadmap Revision (Track F), this needs an appointment-bound Prospect-Info form/collection that does not yet exist in the documented Firestore structure (`submissions`, `goals`, etc. have no appointment/joint-call shape today). Real data-model work required, not just UI.

### C. Financing self-view hero (shared: agent `financing` + producing-manager `mp-financing`)
- **Screen:** `src/components/financing/FinancingSelfView.jsx` (one component, two mounts per its own header comment)
- **Intended hero content (per `design_handoff_track_k/Track K Financing Self-View - Build.html:392-459`, an explicitly locked design decision):** a narrative "you're carrying TTD X — on track to clear it by month N" headline paired with a running-balance/wind-down visualization, not a flat statement.
- **Size estimate:** **M** — the underlying figures (financing this month, agreed monthly, validating API, wind-down clocks) are already computed and rendered as plain cards (`FinancingSelfView.jsx:265-308`); the work is restyling into the documented narrative-hero pattern plus adding the trend/arc visualization the design doc calls load-bearing.
- **Data dependency:** Data already exists (`financingTerms` doc + validating API figures already power the existing plain cards). No new collection needed.

### D. Production Report hero parity for Unit Manager view
- **Screen:** `src/components/productionReport/UnitManagerProductionView.jsx:126`
- **Intended hero content:** identical to the BM sibling (`BranchManagerProductionView.jsx:136`) — Total API / Apps / Avg API-per-agent aggregate, styled as `.glass.hero.teal`.
- **Size estimate:** **S** — this is a parity fix, not new design work. UM and BM views already render the same content; only the CSS class differs.
- **Data dependency:** None — same data, same component family, already shipped for BM.

### E. My WAR individual-filing hero (producing manager)
- **Screen:** `src/components/manager/ManagerWarTab.jsx`
- **Intended hero content (per `screens-v2/war-v2-desktop.jsx:38-93`, `MyWarCard`):** a completion ring, a "MY API · THIS WEEK / APPLICATIONS / FILING STREAK" metric row, and a managerial-KPI grid summary above the filing form.
- **Size estimate:** **M** — needs a completion-ring visualization and streak computation not currently surfaced on this tab (though similar streak logic exists elsewhere, e.g. History/Daily Capture, and could be reused).
- **Data dependency:** Likely available — the manager's own weekly production figures already exist via the same submission pipeline agents use; streak logic exists as a pattern elsewhere in the codebase to adapt.

### F. Money Needs merged hero band — flip the flag
- **Screen:** `src/components/agent/MoneyNeedsPanel.jsx` (agent `money-needs`) + producing-manager `mp-money-needs`
- **Intended hero content:** already built — `TheSeam` full-width "primary band" restating the required commission as a headline (per `money-needs-allocator-handoff/mockups/Money Needs Merged.html` README).
- **Size estimate:** **S (verification/rollout only, not new build)** — the hero component exists in code; it is gated behind `VITE_MONEY_NEEDS_MERGED_ENABLED`, default OFF. This is a flag-flip + regression-check item, not a build item, but it is a real MISSING in the shipped default path today.
- **Data dependency:** N/A — already wired, feature-flagged.

### G. Meeting Mode opening-slide hero
- **Screen:** `src/components/manager/MeetingMode.jsx:234-263` (BM presentation deck, summary slide)
- **Intended hero content (per `AgencyTrack Meeting Mode v2.html:154-155`):** anchor-first — one dominant "week pulse" metric, a year-vs-cascade bar chart, and three secondary counts — rather than four equal-weight tiles.
- **Size estimate:** **M** — requires establishing visual hierarchy (promote one stat to dominant position) and adding a cascade-bar chart component; the four underlying stats already exist.
- **Data dependency:** Data already exists (Total API, Apps Sold, Avg Closing, Submissions are already computed for the current flat grid). The cascade-bar chart would need the same annual-goal-vs-actual data Game Plan/Goals already use — no new collection.

---

## 4. EXTRA list

**None found.** No screen across any audited role renders a hero card that the paired canonical mockup does not call for. This is a meaningful data point for the ruling: the live app's drift is entirely in the direction of under-building documented heroes (MISSING) or ambiguous mockup pairings (UNCLEAR) — not in the direction of agents/CC adding heroes speculatively where design didn't ask for one.

---

## 5. UNCLEAR list

Twelve items — listed honestly rather than forced into a classification:

1. **Agent Goals** — the mockup paired to "Goals v2" is the branch-manager's cascade scene, not an agent-scoped screen; no true agent-only Goals mockup exists in this set.
2. **Agent Persistency** — same mockup-pairing gap; the primary "Persistency v2" file is the manager roster view, and the alternate "Playground" file is styled as a coaching tool rather than a status screen.
3. **Team roster (`team` tab, UM/BM)** — no dedicated v2 mockup found for this screen at all.
4. **Team Plans (`team-game-plans`)** — Master Build Reference cites a mockup that doesn't resolve to an actual file.
5. **Team Awards (`awards`, scope TEAM)** — live ships a hero (`MonthlyBonusHero`) with a doc-comment claiming v2 parity, but no manager-specific mockup file exists to independently confirm.
6. **Team Roster (`team-perf`)** — same gap as #3.
7. **Settlements (`settlements`)** — no mockup found; practically consistent with the no-hero ledger pattern elsewhere but unconfirmed by design intent.
8. **Agent of Month (`agent-of-month`)** — no mockup found (Master Build Reference references it only as "within Awards/recognition," not a literal file).
9. **Kiosk admin config (`kiosk`, BM)** — the paired mockup (`Kiosk Mode.html`) depicts the actual wall-display presentation screen, a different surface entirely from this token-management admin tab; not a meaningful comparison.
10. **Take-Home Waterfall (BM utility)** — the mockup frames this component as an agent-facing payout embed; the live BM surface is a distinct cross-agent picker/breakdown tool. Neither embodies the other's framing.
11. **sales_manager Leaderboard (`SmLeaderboardView`)** — a thin branch-picker wrapper around the already-audited `ProductionLeaderboardSurface`; not independently re-auditable as its own screen.
12. **tenant_admin Profile** — shared cross-role `ProfileScreen.jsx`, not a TA-specific screen; out of scope to re-derive here (would duplicate the agent Settings/Profile row).

---

## 6. Gaps (self-critique, per Rule 22)

- **Screens with no paired mockup at all:** five live, shipped screens (`team` roster, `team-game-plans`, `team-perf`, `settlements`, `agent-of-month`) have no confidently-identified v2 mockup despite the Master Build Reference claiming near-complete coverage. Either the mockups exist somewhere unindexed in the 1,244-file `screens-v2/` tree and weren't found by the recon passes, or the Master Build Reference's own screen→mockup map has gaps/stale citations it doesn't self-flag. This audit did not exhaustively search every subfolder (`_ds/`, `design-system/`, screenshot dumps) for a possible match — a full-tree search was judged out of proportion to this audit's scope, per the "don't rabbit-hole" guidance in the task brief.
- **Stale Master Build Reference citation confirmed, not just suspected:** the Company Config row claims mockup `Settings v2.html (admin section)` — a full read of that file plus a grep of its companion `settings-v2.jsx` confirmed no admin/company section exists anywhere in it. This is a documentation-quality finding independent of the hero audit and is worth a follow-up correction to the Master Build Reference itself.
- **Mockup-role mismatches, not gaps, drove two agent-role UNCLEARs:** Goals and Persistency both have canonical "v2" mockup files, but those files render the branch-manager's scene, not the agent's own screen. This audit did not attempt to reverse-engineer an implied agent-scoped hero from the manager scene's structure — that would be speculation, not evidence, so both are reported UNCLEAR rather than forced to MATCH or MISSING.
- **Some MATCH-HAS calls rest on source comments, not independent rendering.** `mp-game-plan`'s hero classification is inferred from `GamePlanV2` source comments describing "anchor" framing, not from an independently confirmed rendered screenshot comparison — flagged at lower confidence in the table itself.
- **Confidence on `financing` (BM Terms Setup) is lower than other MATCH-NONE calls** because its paired "mockup" is a build-annotation spec document (`design_handoff_track_k/...Terms Setup - Build.html`), not a rendered pixel mockup like the per-screen `AgencyTrack <Screen> v2.html` files — the annotation chrome could be obscuring an intended hero that a rendered mockup would show more plainly.
- **The four sub-agents that produced this audit's raw findings ran independently and were not cross-verified against each other file-by-file** (e.g., no second pass independently re-opened `PolicyReconciliationPanel.jsx:279` to confirm the surprising MATCH-HAS finding). The citations are taken as reported; a spot-check of 2-3 high-stakes rows (the surprising Reconciliation hero, and the UM/BM Production Report asymmetry) before this audit is used to scope build work would be prudent.
- **CRO, shell-chrome, and the not-yet-routed `planner` tab were deliberately excluded from the main count** rather than force-classified — they represent "no live screen exists" rather than a hero-presence question, and forcing them into MISSING/N-A would have muddied the count that matters for the ruling (live screens that exist today vs. their design intent).
- **This audit did not independently verify the underlying data dependency claims against live seeded/staging data** — the "Size estimate" and "data dependency" judgments in § 3 are schema-level reasoning (per CLAUDE.md's documented Firestore collections) rather than confirmed against an actual seed/staging run, per the task's own "reasonable judgment call, don't rabbit-hole" instruction.

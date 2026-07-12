# AgencyTrack — Design-Conformance Revalidation (supersedes 2026-07-07)

> **VALIDITY SHA (mandatory header).**
> **Describes staging HEAD:** `e65fe14357e23c14c48d5fd428363105707236cc`
> `e65fe143 test(vh): t1-admin-exception-lead + t1-company-config-gate legs (Run 6)`
> **Branch:** `staging` · **Worktree:** `C:\Projects\at-fable-staging` · **Working tree:** clean (0 `src/` changes at capture).
> **Verification window:** all file:line citations were taken from the live tree while HEAD moved `6ec0f743` → `e65fe143` (both are Run-6-era commits; Run 6 was actively landing VH-leg + exception-lead commits during authoring). Run 6's deltas only *strengthen* the resolutions recorded here (it added the admin `ExceptionLeadPanel` + config-gate legs); no citation below was invalidated by the HEAD advance. Re-run any single citation with `git show e65fe143:<path>` if a byte-exact anchor is needed.
>
> **Date:** 2026-07-12 · **Type:** READ-ONLY revalidation · **Author:** Claude Code (Phase-0 overnight executor) · **Method:** Rule-17 source re-verification (every finding re-grepped/re-read against current source; the old doc's text was never trusted — where it said "grep = 0 hits", the grep was re-run).

---

## 0 · Why this document exists

`docs/audits/design-conformance-2026-07-07.md` was the declared "active build map" in `docs/CONTEXT.md`. It was authored on branch `feat/more-sheet-v2`, **before** the Nexus v2 promotion (Runs 1+2, PR #849) and the overnight **Runs 3 / 4 / 5** (and the in-flight Run 6). It is now materially **stale**: the large majority of its ~92 "MISSING" findings shipped in the intervening runs. This document re-verifies **every** finding it contained against current HEAD, reclassifies each, and re-scopes the remaining real work.

**This document is now the active build map.** The old audit is preserved unedited as a historical record.

### What shipped between the two audits (the reclassification driver)

| Run | PR/commits | Relevant surfaces landed |
|---|---|---|
| Runs 1+2 (Nexus v2) | #849 (`2c2932f3`) | Tokens/reskin, mobile nav v2, **command palette** (⌘K), **sidebar drag-reorder** (`useNavOrder`), admin **QuickAddMenu**, four-states/skeleton/dialog-a11y sweeps (Tier-0), `AgentReportView`, **prospect prep un-gated + sort fix**, PDF suite, financing K9 hero |
| Run 3 | `86f44a40`…`c2d9516c` | My WAR hero + CompletionRing, WAR review pill/streak dots, UM Unit Aggregate hero, filing-streak milestones, planner edit-in-place, MasterSheet column collapse |
| Run 4 | `bae7a409`…`063dd12e` | **8-stage funnel Master Sheet** + filters panel, **FunnelMeetingScene** (part of a 12-scene deck), streak-celebration reskin, planner recurrence, Settings "Default RANK BY" |
| Run 5 | `7eae1f48`…`322d666f` | **Company Config slice 1** (12-section registry-driven surface, ⌘F, config audit, feature-flag allowlist) |
| Run 6 (in flight) | …`e65fe143` | Admin tenant-wide `ExceptionLeadPanel`, config-gate VH legs |

Plus the operator's **Settings-split ruling**: **"My Preferences"** = user prefs (`SettingsScreen.jsx`), **"Company Config"** = tenant policy (`CompanyConfigSurface.jsx`). This ruling *supersedes* the old "Settings v2 consolidated surface" NEEDS-RULING findings.

---

## 1 · Recount of the summary buckets (honest, against current HEAD)

The old doc claimed **~92 MISSING + ~30 NEEDS-RULING + ~22 DELIBERATE-DIVERGENCE + ~55 COSMETIC**. Re-verifying the **117 material findings** it enumerated (nav §3 + per-screen §5.1–§5.6, plus the 4 operator-flagged headline items) against current source:

| New class | Count | Meaning |
|---|---:|---|
| **RESOLVED-SINCE** (fully) | **~63** | Designed feature shipped; cited by current file:line or commit. |
| **PARTIALLY-RESOLVED** | **~26** | Core shipped; a residual sub-gap remains (residuals are itemized in §4 as the real backlog). |
| **STILL-VALID** | **~24** | Gap persists at current HEAD; cited by current file:line. |
| **SUPERSEDED** | **~2** | Absorbed by Company Config slice 1 + the Settings-split ruling. |
| **DELIBERATE-DIVERGENCE (confirmed intact)** | **~2** | 3-step Game Plan rail (PR-U1 lock); vertical GoalCascade. |

**Headline:** the old audit's central claim — "many Built screens are missing substantial designed features + the systemic four-states/motion/dialog-a11y/dense-table contracts" — is **~76% closed** (89 of 117 findings fully or partially resolved). The **systemic contract debt that was the old doc's #1 recommendation is now largely paid down** (see §2). What remains is a smaller, mostly-additive backlog (§4).

### Systemic §4 contracts — separate mini-tally (these overlap per-screen, counted once here)

| Contract | Old state | Current state | Evidence |
|---|---|---|---|
| §1 four-states — **error+Retry** | unmet on ~13 panels | **9/13 resolved**, 1 partial, 2 still-valid, +1 new | resolved: `AgentAwardsPanel.jsx:182`, `PolicyLedgerPanel.jsx:180`, all 3 production views, `CompliancePanel.jsx:362`, `BranchesPanel.jsx:264`, `SettlementPanel.jsx:495`, `MonthlyRecruitingTab.jsx:300`, WAR tabs. **Still-valid:** `Leaderboard.jsx:142-156` (gamification, plain-text error), `ManagerAwardsPanel.jsx:216-228`; **new gap:** manager-side `PersistencyTab.jsx:238-242` |
| §1 — **silent-swallow** | 3 sites | **resolved** | `TenantAdminDashboard.jsx:159-219` (per-source + `retryFailed`, "never a silent swallow"), `CampaignPanel.jsx:860-955`; `AgentProductionView.jsx:102-104` remaining `.catch(()=>{})` is an intentional fail-soft secondary fetch |
| §1 — **skeleton-not-spinner** | 4 sites | **resolved** | `PanelSkeleton` now wired across **~28 non-test files** (Daily Capture, Wizard, AwardsRuleset, PlanCatalog, recruiting, WARs, production views, admin dashboard, …) |
| §2 — **count-up** | absent | **resolved** | `useCountUp` consumed by ~20 components incl. `HeroCard.jsx:21`, `PlanAnchorStrip`, `CommissionAnchorStrip`, kiosk panels. *(Per-block **stagger** still thin — §4 residual.)* |
| §4 — **dialog focus-trap/Escape/return** | 7 dialogs failing | **7/7 resolved** | `useFocusTrap` on DeactivateBranchConfirmDialog:22, PlanCatalogModal:49, WelcomeScreen:56, PolicyDrillDrawer:42, PersistencyPlayground:64, MeetingMode:682; EditUserDrawer:216-260 (documented inline equivalent) |
| §5 — **dense tables** | incomplete | **MasterSheet resolved** (sticky `top-0` + tabular-nums + `<tfoot>` after Run-4 funnel rebuild, `MasterSheet.jsx:684,837`); All-Users + Branches now real sticky tables; **ProductionTable/RankedLeaderboard/Settlements** still lack footer/sticky (§4 residual) |
| §4/UI — **44px targets** | Persistency 36–40px | **resolved** | `PersistencyPlayground.jsx:125` close `h-11 w-11`, CTAs `h-11` (one tertiary link remains `h-9`) |

---

## 2 · Navigation (old §3)

| # | Finding | Old | New | Evidence |
|---|---|---|---|---|
| N1 | Desktop sidebar drag-reorder (pointer + long-press), persisted | MISSING | **RESOLVED** | `Sidebar.jsx:50-56,144-208,291-312` (custom pointer + Alt+Arrow keyboard reorder); persisted via `hooks/useNavOrder.js:31-96` (localStorage + Firestore reconcile), wired `Shell.jsx:68-71`. *(Not dnd-kit — old library-name grep was the wrong signal.)* |
| N2 | Global ⌘K command palette (search-jump + role-scoped create, focus-trap) | MISSING | **RESOLVED** | `Shell.jsx:76-86` (Cmd/Ctrl+K), mounts `CommandPalette.jsx` (`role=dialog aria-modal`, focus trap :94-111, Escape :128); command set built from caller's role-filtered `navItems`/`quickAddActions`. **Residual:** bare `/` shortcut not bound (minor). |
| N3 | Admin ＋/create sheet (branch/user) | MISSING | **RESOLVED** | `TenantAdminDashboard.jsx:282-298` (FAB + `QuickAddMenu`); `quickAddConfig.js:56-69` `TENANT_ADMIN_ACTIONS` = new-branch + new-user |
| N4 | Mobile-tab drag reorder | MISSING | **STILL-VALID** | `MobileBottomNav.jsx:34-93` — no `onReorder`, plain `onClick` only |
| N5 | More slot vertical ⋮ affordance | COSMETIC | **STILL-VALID** | `MobileBottomNav.jsx:2,90` still `MoreHorizontal` (⋯) |
| N6 | More slot adaptive deep-screen label | MISSING | **STILL-VALID** | `MobileBottomNav.jsx:91` hardcoded `<span>More</span>` |

Built-and-conformant (Pinned zone, WorkspaceToggle, More-sheet-v2) confirmed no regression.

---

## 3 · Per-screen re-verification (old §5)

Legend: **R** = RESOLVED-SINCE · **P** = PARTIALLY-RESOLVED (residual noted) · **SV** = STILL-VALID · **SUP** = SUPERSEDED · **DD** = confirmed DELIBERATE-DIVERGENCE.

### 3.1 Agent surfaces (old §5.1)

| Finding | Old | New | Evidence |
|---|---|---|---|
| DeliveryStripCard "Policies to deliver" | MISSING | **R** | `HomeV2/DeliveryStripCard.jsx:21-70` (full component + clawback sort; `null` only on empty) |
| Hero count-up + staggered assemble | MISSING | **P** | count-up `HeroCard.jsx:21`; **residual:** per-block stagger absent |
| DailyCelebration streak takeover | MISSING | **R** | `DailyCaptureV2.jsx:337-360,800-816` `DailyStreakTakeover` (flame medal, confetti, stat cards); milestones in `lib/celebrations.js` |
| DailyAnchorStrip WTD bar + provenance | MISSING | **P** | WTD bar `DailyCaptureV2.jsx:299-335`; mode-provenance tag = **DD** (no attribution field; skip-logged :295-298) |
| AgentModePicker in Daily Capture | NEEDS-RULING | **SV** | no picker in `components/daily/`; `loggingMode` read-only from `ProfileScreen` |
| Daily error inline card + Retry | MISSING | **R** | `DailyCaptureV2.jsx:1222-1233` (`role=alert` + Retry) |
| Wizard Celebration gold WEEK-N medal + Apps/Est-Comm cards + 2nd CTA | MISSING | **P** | count-up `Celebration.jsx:34-35`; **residual:** no gold medal (:72-80 plain check halo), no Apps/Est-Commission stat cards, single CTA only |
| Mobile WeekSoFar expand-to-sheet | MISSING | **SV** | `WeekSoFarPanel.jsx:276` (comment: "not built — LOW FU") |
| History drill action-oriented footer CTA | MISSING | **R** | new `HistoryDrillDrawer` `HistoryTab.jsx:609-786`, status-driven footer :735-782 (Download PDF / Continue editing / Edit & resubmit). *(`SubmissionViewer.jsx` intentionally kept for MasterSheet/Compliance.)* |
| Draft/unlocked chip → wizard (not read-only) | MISSING | **R** | `HistoryTab.jsx:758-773` `onEditWeek` → `AgentDashboard.jsx:994` `openWizardForWeek` |
| HistoryFilterRow (Year/Month/★Award/Search) | MISSING | **R** | `HistoryTab.jsx:348-439` all four controls |
| YearHeatmap enrichments (gold dot/best-week ring/current pulse/streak underline) | MISSING | **R** | `HistoryTab.jsx:211-346` (all four + legend + streak callout) |

### 3.2 Agent planning / money / tools (old §5.2 + persistency/policy of §5.3)

| Finding | Old | New | Evidence |
|---|---|---|---|
| GamePlan AllocationBar + MiniMonthStrip | MISSING | **R** | `PlanCascade.jsx:9,40` |
| Inline Review&Commit card + checklist | MISSING | **R** | `GamePlanV2/index.jsx:421` `PlanCommitCard`; checklist `PlanCommitCard.jsx:53` |
| PlanManagerBanner / managerView | MISSING | **R** | `manager/AgentPlanDrawer.jsx:531` PlanHealth + :406 "Suggest a change" → `createPlanSuggestion` |
| 4-step rail vs 3-step | DD | **DD (intact)** | `StepRail.jsx:106-149` 3 steps (PR-U1 lock, CONTEXT.md) |
| Money Needs Option-C 3-level disclosure | MISSING | **P/R** | compact subtotals `MoneyNeedsPanel.jsx:301-329`, single-open accordion :985, first-run adaptivity :1004-1012 (no literal Compact/Edit toggle) |
| CompositionBar 5-group spine + % chips | MISSING | **R** | `MoneyNeedsPanel.jsx:413` |
| Monthly variance suggestion chips | MISSING | **P/R** | `MonthlyPlanModal.jsx:438` via `lib/monthlyPlanMath.js:349` (pace chips; activity-count style skip-logged, not derivable) |
| ProductDrill BALANCED/OVER/UNDER + sum-bar | MISSING | **R** | `MoneyNeedsAllocator.jsx:109-110,150-151` |
| Pre-send itemized confirm sheet | MISSING | **R** | `MoneyNeedsAllocator.jsx:456` `ConfirmSheet` |
| Goals-page celebration takeovers | MISSING | **P/R** | `goals/GoalsCelebration.jsx:18-24` (annual+streak; quarter skip-logged, no per-Q target) |
| Horizontal 5-node GoalCascade | DD | **DD (intact)** | `GoalsPanel.jsx:1149` vertical `GapAnalysisPanel` |
| MinimumsStrip persistent floors above roster | MISSING | **R** | `GoalsPanel.jsx:1007-1012` |
| Commission saved-scenario chips + Save | MISSING | **SV** | no scenario refs in `CommissionPlayground/` |
| Commission manager suggest-a-goal-back | MISSING | **SV** | `CommissionPlayground/index.jsx:11,20` copy-only `isManagerSelf` |
| Commission Daily cadence chip | MISSING | **SV** | `GoalDecompositionTab.jsx:15-20` no `daily` in `PERIODS` |
| Persistency v2 rolling/per-policy model | NEEDS-RULING | **P/R** | `persistency/PersistencyV2Shell.jsx` flag-gated (`persistencyV2`) + `lib/persistency/rollingModelV2.js`; wired `agent/PersistencyTab.jsx:19,277`. **Residual:** fixture-shape preview, live wiring pending Tatil sign-off |
| Persistency "Share this plan" coaching action | MISSING | **SV** | `PersistencyPlayground.jsx:274-285` Reset/Close only |
| Policy Ledger lens/campaign mode | NEEDS-RULING | **P/R** | `policyLedger/CampaignLensPanel.jsx` (ContributionBadge :36, lens chips :229, Export-proof :101) flag-gated `PolicyLedgerPanel.jsx:315`. **Residual:** Export-proof button not wired to an export |
| Policy Ledger insured name (insured≠owner) | MISSING | **SV** | `PolicyCard.jsx:67` / `PolicyDrillDrawer.jsx:111` render owner only; `insuredName` captured but used for search only |
| PolicyDrillDrawer focus-trap | MISSING | **R** | `PolicyDrillDrawer.jsx:42` `useFocusTrap` |

### 3.3 Agent report / recognition / profile (old §5.3 remainder)

| Finding | Old | New | Evidence |
|---|---|---|---|
| Prospect Prep agent tab (was ComingSoon stub) | NEEDS-RULING | **R** | `AgentDashboard.jsx:817` renders `<ProspectInfoPanel/>` (un-gated) |
| Prospect prep desc-sort behavioral bug | MISSING | **R** | `prospectInfoService.js:205,208` now `orderBy('intendedAppointmentDate','asc')` (index flipped) |
| Objection rehearsal aid (label+meaning+counter) | MISSING | **R** | `ProspectInfoPanel.jsx:27,165` `ObjectionRehearsal` (reused `NextCallHero.jsx:102`) |
| NextCallHero + ApptBadge countdown | MISSING | **R** | `prospect/NextCallHero.jsx`; wired `ProspectInfoPanel.jsx:588-593` |
| Readiness ✓Prepped + prep note + Est.API | MISSING | **P** | readiness pill `NextCallHero.jsx:85-99`; **residual:** prep note + Est.API skip-logged (schema ruling, `utils/prospectPrep.js:127`) |
| Interactive Agent Report View | MISSING | **R** | `profile/AgentReportView.jsx` (404 lines); wired `AgentDashboard.jsx:68,943` |
| Dense ProductionTable roster (persistency/status pill/zebra/gold top-3) | MISSING | **SV** | `productionReport/ProductionTable.jsx:1-122` still the NB/PPP/LMPS breakdown; `RankedLeaderboard.jsx:35-40` has medals but no persistency col/status pill/zebra |
| "Download report" button every role view | MISSING | **R** | `AgentProductionView.jsx:219`, `UnitManager…:226`, `BranchManager…:247` |
| DataSourceBadge period-driven (PROVISIONAL vs SETTLED) | MISSING | **P** | mechanism derived (`lib/productionReport/computations.js:275`) but all 3 views pass `settlements:[]` → always "Estimated"; SETTLED upgrade deferred |
| ProdTotals AVG PERSISTENCY + ON-PACE tiles | MISSING | **SV** | unit/branch heroes show API/Apps/Avg/Agents only; no avg-persistency or on-pace tile |
| Leaderboard error card no Retry | MISSING | **R** | `ProductionLeaderboardSurface.jsx:452-472`. *(Note: sibling `gamification/Leaderboard.jsx:142` still lacks Retry — see §4.)* |
| Podium stagger/bar-grow/count-up | COSMETIC | **P** | count-up on PodiumCard; **residual:** per-card stagger + tail-row bar-grow absent |
| Awards provenance system (ContributionBar/LedgerSourceChip/ProvenancePanel) | NEEDS-RULING | **R** | `awards/awardProvenance.jsx:23,39,60` + `lib/awardProvenance.js`; flag-gated `awardsProvenance` |
| Awards pace narrative (hero + drawer "Your pace") | MISSING | **R** | `awardPrimitives.jsx:161-167,422-442` |
| Awards §1 skeleton/empty CTA/Retry/drawer CTA | MISSING | **P** | Retry resolved `AgentAwardsPanel.jsx:182`; **residual:** no loading skeleton, top-level empty has no CTA (:163), drawer has no footer CTA |
| Consolidated Settings surface (role-scoped tabs) | NEEDS-RULING | **SUP** | `settings/SettingsScreen.jsx` ("My Preferences"/"Account", docstring cites operator split ruling); mounted in all 4 dashboards |
| My Preferences: Theme + Density + View Defaults/RANK BY | MISSING | **P** | Theme :110, Default period :134, Default RANK BY :148 (commit `ee4794f9`); **residual:** Density deliberately not built (:31-33, DS decision) |
| Career Portal (ladder/badges) | high-conformance | **R (no regression)** | `CareerPortal.jsx:100-296` intact; ladder-node dates + badge caption still absent (COSMETIC) |

### 3.4 Manager surfaces (old §5.4)

| Finding | Old | New | Evidence |
|---|---|---|---|
| ExceptionList "★ Needs attention" lead panel | MISSING | **R** | `dashboard/ExceptionLeadPanel.jsx` (4-state), rendered first `ManagerOverviewTab.jsx:95-101` |
| AgentDrill coaching drawer (tabs + RecommendGoal) | MISSING | **P** | `manager/AgentDrillDrawer.jsx:162-298` (3 tabs), wired :117-125; **residual:** no Notes/Joint-Work tabs, no RecommendGoal |
| AnchorStrip goal cascade + pulse trio + counters | MISSING | **R** | `dashboard/CascadeAnchorStrip.jsx:29-173`, rendered :80-92 (`ManagerHeroSection.jsx` now dead code) |
| KpiStrip incl. Active Agents + Persistency | MISSING | **SV** | `BranchKPIStrip.jsx:4-9` still compliance/api/apps/ffi only |
| MyWeekPanel (player-coach own week) | MISSING | **SV** | no `MyWeek*` in src |
| ChampionsPanel ranked weekly champions | MISSING | **SV** | `TeamMedalsPanel.jsx` still count-based badge grid (ranked banner exists but on Leaderboard tab) |
| MasterReality bar (period/scope + team stats) | MISSING | **R** | `MasterSheet.jsx:366-410` (Week API/Submitted/Filed/Exceptions tiles) |
| MasterActionBar column presets + exceptions toggle | MISSING | **P** | "only exceptions" toggle :485-497 + funnel expand/rank-by/unit filters :417-570; **residual:** the named preset set (Production/Recruiting/…) replaced by a different mechanism |
| Rank # + gold top-3 + avatars + status pill | MISSING | **R** | `MasterSheet.jsx:794-825` |
| §5 sticky header-top + card-scoped scroll + tabular-nums | MISSING | **R** | `MasterSheet.jsx:677,684,695,719-721,837` (Run-4 funnel rebuild) |
| Recon discrepancy taxonomy — 8 typed flags | MISSING | **SV** | `PolicyReconciliationPanel.jsx:341-342` still 4 states (toReconcile/clean/flagged/confirmed); no missing/unmatched detection |
| ReconDrawer side-by-side compare | MISSING | **P** | inline side-by-side compare `:359-383`; **residual:** no separate drawer, action set reduced |
| "Confirm all N clean" bulk | MISSING | **SV** | `:309` comment "per-policy only; Slice-2 FU" |
| WAR reviewer Approve / Request-changes | NEEDS-RULING | **R** | `ManagerWarDetail.jsx:266-280` |
| WarHeaderStrip team stat strip | MISSING | **R** | `TeamWarsTab.jsx:161-171` |
| WAR CompletionRing (My WAR + team rows) | MISSING | **R** | `WarCompletionRing` at `ManagerWarTab.jsx:356`, `TeamWarsTab.jsx:240` |
| WAR StreakDots + My-WAR production block | MISSING | **R** | `WarStreakDots` `TeamWarsTab.jsx:264`; My-WAR hero `ManagerWarTab.jsx:345-452` |
| WarKpiChip actual/target progress bar | COSMETIC | **P** | ratio text only; **residual:** no per-KPI bar (only aggregate ring) |
| Recruiting 8-stage kanban CRM + RecDrillDrawer | NEEDS-RULING | **R** | `MonthlyRecruitingTab.jsx` (`RECRUITING_STAGES`, `RecDrillDrawer`, four-states) |
| RecTargetCard + funnel stats strip | MISSING | **P** | funnel strip `:116-138`; **residual:** RecTargetCard not built (no configurable target source, :18-21) |
| Campaign persistency-gate multiplier | NEEDS-RULING | **R** | `campaigns/CampaignStandings.jsx:48-81` + form toggle `CampaignPanel.jsx:686-691` |
| Campaign prize tier ladder + placement podium | MISSING | **R** | `CampaignStandings.jsx:100-205` |
| Campaign StandingsTable + Confirm&release | MISSING | **P** | ranked StandingsTable + projected payout `:208-296`; **residual:** no close/confirm/release flow (by design, :14-15) |
| Campaign rank badges gold-rule token | COSMETIC | **SV** | `CampaignCard.jsx:41-46` still hardcoded `bg-amber-500` (newer `CampaignStandings.jsx` uses tokens) |

### 3.5 Presentation / reports / financing (old §5.5)

| Finding | Old | New | Evidence |
|---|---|---|---|
| Meeting Mode phased run-of-show (14–16 steps) | MISSING | **R** | `MeetingMode.helpers.js:386-433` `SCENE_SEQUENCE`/`deriveDeck` — 12-scene deck w/ skip-log |
| Branch scorecard scene | MISSING | **R** | `MeetingMode.helpers.js:195-217`; `BranchScene` `MeetingMode.jsx:796` |
| Units scene | MISSING | **R** | `helpers.js:223-252`; `UnitsScene` :797 |
| Activity + Production master-sheet scenes | MISSING | **R** | `MeetingMode.jsx:274-380` (sticky thead, tabular-nums, Branch-total tfoot) + `FunnelMeetingScene.jsx` |
| Recognition podium + Celebrations + Awards-within-reach | MISSING | **P** | Recognition/Celebrations scenes :802-803; **residual:** "Awards-within-reach" absent |
| Campaign meeting scene | MISSING | **R** | `CampaignScene` :804 |
| Agent step: KPIs vs floor + sparkline + flag taxonomy | MISSING | **R** | `AgentScene` :411-452 (Sparkline :445, FloorTile :452, `classifyFlag` helpers:104-122) |
| Meeting overlay dialog focus-trap | MISSING | **R** | `MeetingMode.jsx:682` `useFocusTrap`; role=dialog :819-820 |
| Kiosk unified 3-up podium + period chip selector | MISSING | **R** | `RankedLeaderboardPanel.jsx:15-53,163` |
| Kiosk campaign leaderboard panel + "Show on kiosk" | MISSING | **R** | `KioskShell.jsx:49` PANEL_COMPONENTS; toggle `CampaignPanel.jsx:784` → `kioskServices.js:56` |
| Kiosk Birthdays/Anniversaries + Noticeboard panels | MISSING | **P** | `CelebrationsPanel.jsx` (anniversaries; DOB absent by design); **residual:** Noticeboard absent |
| Kiosk theatrical surface (#0E0B07 blob/vignette/glass) | DD/MISSING | **R** | `KioskShell.jsx:165-170` blob field + vignette |
| Kiosk per-slide enable/disable config + skip | MISSING | **P** | empty-panel skip `kioskRotation.js:22-49` + overlay `KioskOverlay.jsx`; **residual:** manager enable/disable read-only (`KioskModeTab.jsx:208-219`) |
| `getKioskTenantUsers` degrade → names="Agent" | MISSING | **SV** | `KioskShell.jsx` `.catch(()=>[])` (SEC-012 FU, acknowledged unresolved) |
| Refined Agent PDF (cover + 3 pages) | MISSING | **R** | `AgentReportDocument.jsx:360,524,633,760` (cover + 3 pages) |
| Branch PDF | MISSING | **R** | `exportService.js:95` `generateBranchPDF` |
| Unit PDF | MISSING | **R** | `exportService.js:100` `generateUnitPDF` |
| SM cross-branch agency view | NEEDS-RULING | **SV** | `ProductionReportTab.jsx:13-21` falls through to BM view (Phase 9) |
| K9 self-view glass PaydownArcHero | MISSING | **R** | `FinancingSelfView.jsx:186,209,225,427` (`.glass.hero.teal` + SVG arc) |
| K8 Agent Validation Dashboard | MISSING | **P** | consolidated into `FinancingSelfView.jsx` (Gates :150, embedded waterfall :98, recon :553); named sub-components not separate |
| K7 BM financing roster (fan-out + chips) | MISSING | **R** | `FinancingRiskPanel.jsx:1-6,533-540` (branch roster fan-out) |
| Settlements dense-table conventions | COSMETIC | **P** | table + "Load More (N remaining)" count; **residual:** no sticky header, no tabular-nums |

### 3.6 Admin / shell / system (old §5.6)

| Finding | Old | New | Evidence |
|---|---|---|---|
| TA Dashboard silent fetches / no Retry / no skeleton | MISSING | **R** | `TenantAdminDashboard.jsx:173-260,377-410` (per-source + retryFailed + partial-failure banner); StatCard skeleton :97-101 |
| RoleDistribution/BranchHealth loading skeleton | COSMETIC | **R** | `RoleDistributionCard.jsx:54`, `BranchHealthCards.jsx:76` `PanelSkeleton` |
| DeactivateBranchConfirmDialog a11y | MISSING | **R** | `DeactivateBranchConfirmDialog.jsx:22,29-30,74-76` (trap + role + 44px close) |
| Branches dense sticky table + footer count | MISSING | **R** | `BranchesPanel.jsx:283-296,364-369` |
| Branches error Retry | MISSING | **R** | `BranchesPanel.jsx:252-267` |
| All Users dense zebra table (sticky/scroll-in-card) | MISSING | **R** | `UserManagementPanel.jsx:646-667,767-774` |
| All Users stat strip + search + role filter chips | MISSING | **SV** | `UserManagementPanel.jsx:579-617` — label + inactive toggle only; no stat tiles/search/filter chips |
| All Users RoleChip pills + BRANCH·UNIT col + LAST-activity | MISSING | **SV** | `:684` plain role text; column still "Joined"; no branch/unit column |
| EditUserDrawer commission-rate + activity-override + Reset-password + a11y | MISSING | **P** | focus-trap/Escape/return resolved `:216-260`; **residual:** commission-rate, activity-standard override, "Reset password" footer absent |
| Consolidated Company Config surface + recommend-vs-lock inheritance | NEEDS-RULING | **SUP / SV(inheritance)** | surface **SUPERSEDED** by Company Config slice 1: `CompanyConfigSurface.jsx` (12 registry sections `companyConfigRegistry.js`, ⌘F palette, `ChangeHistoryDrawer`/`configAuditService`, draft/save); **residual:** 3-tier recommend-vs-lock cascade not built — `ConfigRow.jsx:19` only `lock:'soon'|'platform'` display; real inheritance = "Company Config v2" (FOLLOW_UPS.md:8) |
| PlanCatalogModal focus machinery | MISSING | **R** | `PlanCatalogModal.jsx:49,192-193` |
| §1 skeleton/Retry across config panels | MISSING | **R/P** | AwardsRuleset `:645-646,640`, PlanCatalog `:250-251,245` resolved; ActivityStandards Retry :96 but loading `null` not skeleton |
| Persistency calc-model v1/v2 + restatement-scope | NEEDS-RULING | **SV** | `companyConfigRegistry.js:161` display-only floor; no calc-model/restatement control (deferred to Company Config v2) |
| Onboarding wizard steps built-but-unwired | NEEDS-RULING | **R** | deleted in `214ea26c` ("delete unwired onboarding steps"); `onboarding/` now only `WelcomeScreen.jsx` |
| Login caps-lock/help footer/trust line/carded error | MISSING | **SV** | `LoginScreen.jsx:228-230` bare `role=alert`; no caps-lock listener, no footer/trust line |
| Onboarding tour dialog a11y + per-slide themed icons | MISSING | **P** | a11y resolved `WelcomeScreen.jsx:56,62-63`; **residual:** per-slide themed icons absent (single brand mark) |

---

## 4 · STILL-VALID backlog — the active build map

Remaining real work at HEAD `e65fe143`, grouped for actionability. Severity/effort carried from the old doc where it stated them (S/M/L). Items marked **[R]** are residuals from PARTIALLY-RESOLVED findings (the surface exists; finish it). Items marked **[ruling]** need an operator decision before build.

### Tier 0 — small systemic residuals (cheap, high polish ROI)
1. **Four-states holdouts** (S each): add Retry to `gamification/Leaderboard.jsx:142`, `ManagerAwardsPanel.jsx:216`, manager-side `PersistencyTab.jsx:238`. — the only panels the Tier-0 sweep missed.
2. **Dense-table footers/sticky** (S): footer count on `ProductionTable.jsx` + `RankedLeaderboard.jsx`; sticky header + `tabular-nums` on `SettlementPanel.jsx:522-565`. **[R]**
3. **Per-block stagger** (S): hero/list stagger where only count-up shipped (`HomeV2`, Leaderboard podium tail-row bar-grow). **[R]**
4. **Nav mobile polish** (S): mobile-tab reorder (N4), ⋮ affordance (N5), adaptive More-label (N6).
5. **Awards §1 finish** (S): loading skeleton + top-level empty CTA + drawer footer CTA on `AgentAwardsPanel.jsx`. **[R]**

### Tier 1 — manager decision-surface depth
6. **Team Dashboard KPI + panels** (S–M): add Active-Agents + Persistency cards to `BranchKPIStrip.jsx`; ranked `ChampionsPanel` (vs count grid); `MyWeekPanel` player-coach own week.
7. **AgentDrillDrawer completion** (M): Notes/Joint-Work tabs + RecommendGoal action. **[R]**
8. **Policy Reconciliation taxonomy** (L): the 8 typed flags incl. **missing/unmatched** detection (read Tatil-settled-without-ledger); side-by-side ReconDrawer + "Confirm all N clean" bulk. **[R]** (the one genuinely large manager gap left)
9. **Production roster table** (L): the dense `ProductionTable` roster (persistency col + status pill + zebra + gold top-3); ProdTotals AVG-PERSISTENCY + ON-PACE tiles; wire `DataSourceBadge` settlements so SETTLED renders (currently always "Estimated"). **[R]**

### Tier 2 — agent feature depth
10. **Commission scenarios** (M): saved-scenario chips (Coach/Commitment/Stretch) + Save; manager suggest-a-goal-back; Daily cadence chip.
11. **Wizard Celebration polish** (M): gold WEEK-N medal + Apps/Est-Commission stat cards + secondary "View submission" CTA. **[R]**
12. **Policy Ledger** (S): show insured name when insured≠owner; wire Export-proof button. **[R]**
13. **Persistency coaching** (M): "Share this plan with {agent}" recommend action.

### Tier 3 — presentation / kiosk residuals
14. **Meeting** (M): Awards-within-reach scene. **[R]**
15. **Kiosk** (M): Branch Noticeboard panel; per-slide manager enable/disable write path; **fix `getKioskTenantUsers` degrade** (names fall back to "Agent" — SEC-012, functional). **[R]**
16. **Settlements sticky/tabular** — folded into Tier-0 #2.

### Tier 4 — admin / system residuals
17. **All Users roster** (M): stat strip + search + role-filter chips; RoleChip pills + BRANCH·UNIT column + LAST-activity time.
18. **EditUserDrawer** (M): commission-rate field, activity-standard override, "Reset password" footer. **[R]**
19. **Login** (S): caps-lock warning, help footer + "Secured by Tatil Life" trust line, carded error.
20. **Onboarding tour** (S): per-slide themed icons. **[R]**

### NEEDS-RULING (do not build without a decision)
- **AgentModePicker** in Daily Capture (or keep profile-only?).
- **Persistency v2 calc-model + restatement-scope** — Tatil sign-off pending; model built behind `persistencyV2` flag as fixture preview only.
- **Company Config v2 recommend-vs-lock 3-tier inheritance** — next major track (FOLLOW_UPS.md:8).
- **Prospect readiness prep-note / Est.API** — schema ruling.
- **SM cross-branch agency view** — Phase 9.
- **RecTargetCard** — needs a configurable recruiting-target source.
- **Campaign close/confirm/release payout flow** — currently projection-only by design; confirm that's the accepted state.

### DELIBERATE-DIVERGENCE (confirmed intact — not gaps)
- Game Plan **3-step rail** (Year Plan folded into Money Needs, PR-U1 lock).
- Goals **vertical GoalCascade** (`GapAnalysisPanel`) vs horizontal 5-node.
- Daily-anchor **mode-provenance tag** omitted (no attribution field to render honestly).
- Kiosk DOB birthdays / Meeting DOB — no DOB schema field; anniversaries-only is the honest build.

---

## 5 · Known gaps in THIS revalidation (Rule 22)

- **Citations are structural (grep/read), not runtime.** "Resolved" means the component/handler/state exists and is wired at the cited line; it does not re-assert pixel-level mockup fidelity or that every resolved surface passed a fresh smoke.
- **PARTIAL is a judgment call.** Where a surface shipped its core but skip-logged a sub-feature with an in-code rationale (no backing schema/data), I classified PARTIALLY-RESOLVED and treated the skip-log as a defensible divergence, not a silent gap — but a stricter reading could reclassify a few of these residuals as STILL-VALID. They are all listed in §4 regardless, so the backlog is unaffected.
- **Bucket counts are curated, not a census** (same caveat as the old doc): the ~117 re-verified findings are the material rows the old doc enumerated; low-value cosmetic micro-drift was not re-counted. Treat the §1 counts as representative.
- **HEAD moved during authoring** (`6ec0f743`→`e65fe143`, Run 6 landing). The working tree was clean at capture and Run 6's committed deltas only add resolutions; no citation was invalidated, but a byte-exact re-pin should use `git show e65fe143:<path>`.
- **Flag-gated resolutions** (Awards provenance, Policy Ledger lens, Persistency v2) are counted RESOLVED because the code exists and is wired behind a tenant flag — they render only when the flag is ON, which is the intended rollout posture, not a gap.

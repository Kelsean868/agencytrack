# Track-J Recon — Per-Screen Reskin-vs-Redesign Map

**Date:** 2026-07-07 · **Branch:** `recon/trackj-surface` · **Mode:** READ-ONLY recon (one file write, no source edits, no deploy, no merge) · **Scope:** pure frontend + email templates (`src/`, `functions/email-templates/`; broader `functions/` not inventoried)
**Base:** `origin/main` @ `f80d5ba1` (migration-doc reconciliation was cut at `9dcae1a3`, 2026-07-05; only motion-verifier #824 + recon commits sit between — no screen-port state changed)
**Method:** 6 parallel read-only sub-agents, each diffing a mockup's `.intro` design-intent card + its sibling `.jsx` scene modules against the live component + `git log` per file. Every verdict cites the mockup and a live `path:line`. Prior classifications (`track-j-port-ledger.md`, `track-j-redesign-scoping-notes.md`) were verified, not trusted.

---

## Summary

**The headline flips the brief's framing.** Track-J is not a fresh reskin sweep to scope — it is a **redesign program that is ~2/3 shipped**. The Nexus v2 *token foundation* (colors/fonts/glass/motion, #813 + #820 + #821) already handles the pure-reskin layer app-wide; what remains is **component-level redesign work**, and most of the agent surfaces + several manager surfaces have already been built out in multi-slice PRs.

### By classification (nature of the mockup vs its pre-v2 baseline — 34 canonical screens)

| Classification | Count | Screens |
|---|---|---|
| **REDESIGN** (layout/IA/data/flow changes) | **27** | Almost everything — see table |
| **RESKIN** (styling-only over same layout/IA/data) | **5** | App Layout (shell chrome), Agent Awards (base), Kiosk, System Screens (Login), Emails |
| **Mixed** (reskin one side, redesign another) | **2** | Persistency (agent reskin + manager redesign), Production Report (agent reskin + UM/BM/SM redesign) |
| **UNCLASSIFIED** | **0** | (all resolved; 3 items flagged for operator confirmation — see §Flagged) |

> **The dominant finding: Track-J is redesign-heavy, not reskin-heavy.** The token layer already produced the cosmetic v2 look everywhere; the genuine reskins (Kiosk, Login, Emails, shell chrome) were the *easy* ports and are done. The remaining pending work is all real component/data/flow building.

### By current port status (verified against current tree, NOT the stale 2026-06-03 ledger)

| Status | Count | Screens (ledger #) |
|---|---|---|
| **SHIPPED** | **16** | App Layout(1) · App Mobile(2) · Mobile Nav(3) · Agent Dashboard(4) · Wizard(5) · Goals(8) · Persistency(10, both sides) · Commission(12) · Agent Awards(13) · Career Portal(14) · History(15) · Compliance(20) · Leaderboard(28) · Kiosk(31) · System/Login(33) · Emails(34) |
| **PARTIAL** | **6** | Daily Capture(6) · Game Plan(7) · Policy Ledger(9) · Agent Report View(16) · Production Report(27) · Policy Reconciliation(30) |
| **PENDING** | **12** | Prospect Prep(11) · Settings(17) · Manager Dashboard(18) · Master Sheet(19) · Weekly WARs(21) · Monthly Recruiting(22) · Campaigns(23) · Manager Reports(24) · Branch Report(25) · Reports(26) · CRO(29) · Meeting Mode(32) |

**~65% has shipped work (16 full + 6 partial = 22/34); 12 screens are genuinely unbuilt.** The one *net-new-role* surface (CRO) is the single biggest lift and is gated on a role-routing decision.

---

## Per-screen table (34 canonical screens)

Numbering follows `docs/track-j-port-ledger.md`'s canonical spine. Mockups live in `docs/design-system/screens-v2/` (top-level `AgencyTrack *.html` — verified **byte-identical** to `design_handoff_v2_app/mockups/` copies, so this refreshes the same set the prior docs classified).

### Agent surfaces

| # | Mockup | Live path | Class | Scope | Status | What differs (mockup ↔ live) |
|---|---|---|---|---|---|---|
| 4 | `AgencyTrack Agent Dashboard v2.html` (`app-dashboard-v2.jsx`) | `dashboard/HomeV2/index.jsx:32` + `AgentDashboard.jsx` | REDESIGN | major | **SHIPPED** #393 (#628, #685) | Flat dashboard → 3-tier hero + 6-chip PulseStrip + in-place StandardDetail drawer (`index.jsx:67-263`); live adds MyPointsCard superset. 1:1 structural port. |
| 5 | `AgencyTrack Weekly Report Wizard v2.html` (`wizard-v2-screens.jsx`) | `wizard/WizardForm.jsx:81-98` + `v2steps/*` + `v2chrome/*` | REDESIGN | major | **SHIPPED** #416/#418/#419 (v3 #697/#722) | 9-step→12-step/4-phase (`V2_STEPS`); live "Week so far" compute panel (`:794`), AutosaveChip (`:554`), PhaseProgress (`:577`), ReviewSubmit (`:709`), Celebration (`:774`). |
| 6 | `AgencyTrack Daily Capture v2.html` (`dailycap-*.jsx`) | `daily/DailyCaptureV2.jsx` | REDESIGN | major | **PARTIAL** #426 + #685/#688/#690/#692 | Entry surface SHIPPED (steppers, grouped sections, streak, WTD anchor). **UNBUILT:** reporting-mode **governance** (recommend-vs-lock + provenance + tenant-default resolution — `dailycap-mode.jsx` `AgentModePicker`/`ManagerModePanel` have no live twin; banked `FOLLOW_UPS.md:2204`). |
| 7 | `AgencyTrack Game Plan v2.html` (`gameplan-pages.jsx`) | `dashboard/GamePlanV2/index.jsx` | REDESIGN | major | **PARTIAL→mostly SHIPPED** #438/#445/#584/#744/#790 | Hub + step rail + cascade + Money-Needs + Year-Plan + Monthly + Review&Commit + manager suggest-back all live. **Deliberate IA change:** merged to a 3-step rail vs the mockup's 4 (PR-U1 Direction 1.5, `index.jsx:69`). |
| 8 | `AgencyTrack Goals v2.html` (`goals-v2-scenes.jsx`) | `manager/GoalsPanel.jsx:1149` + `goals/GapAnalysisPanel.jsx` | REDESIGN | major | **SHIPPED** #616/#618/#612 (#645/#663) | Cascade (Personal→Unit→Branch→SM→floor) + exception-first agent sort + tenure-API-floor banding + recommend-vs-lock drawer + provenance all live. Minor: live tab default Self-first vs mockup Agents-first. |
| 9 | `AgencyTrack Policy Ledger v2.html` (`app-policy-v2.jsx`) | `agent/PolicyLedgerPanel.jsx` + `agent/policyLedger/*` | REDESIGN | major | **PARTIAL** #432 (Slice 1) | Pipeline strip + filter chips + card feed + drill drawer (lifecycle bar/history/inline transition) live. **UNBUILT:** the campaign **Lens** overlay (`SPRINT_LENS` per-policy contributions — 0 hits in `src/`). |
| 10 | `AgencyTrack Persistency v2.html` (`persistency-v2-*.jsx`) | agent `agent/PersistencyTab.jsx:26` · mgr `manager/PersistencyTab.jsx:45` | **Mixed** | major (mgr) | **SHIPPED** agent #395 · mgr #505/#509/#515 | **Agent = RESKIN** (glass hero + 90%-gate banner + trend, no new data). **Manager = REDESIGN, shipped in slices:** reality bar + at-risk book + banded roster (#505) + entry drawer/gold precedence (#509) + what-if playground (#515). Ledger row-10 "manager ✗" is **STALE**. |
| 11 | `AgencyTrack Prospect Prep v2.html` (`prospect-pages.jsx`) | `agent/ProspectInfoPanel.jsx` | REDESIGN | major | **PENDING** (gated) | Live is still the flat Track-F form-list (`PrepCard`, `:46`). v2 prep-tool (NextCallHero countdown, objection *rehearsal* with meaning+counter, bottom-sheet flow) unbuilt. Tab **gated "coming soon"** (`config/comingSoonTabs.js`, #542 — not un-gated like Goals/MoneyNeeds). Track-F *data* layer works. |
| 12 | `AgencyTrack Commission v2.html` (`commission-v2-tabs.jsx`) | `goals/CommissionPlayground/*` + `agent/CommissionAnchorStrip.jsx` | REDESIGN | major | **SHIPPED** #496/#498/#500 | Promoted to top-level page + anchor "your reality" + activity ladder + mode-mix slider + stacked cash-flow + set-as-goal write. Minor gaps: manager `managerView` suggest-a-goal absent (0 hits); 7th ladder rung "API to settle" collapsed to 6. |
| 13 | `AgencyTrack Agent Awards v2.html` (`app-awards-v2.jsx`) | `awards/AgentAwardsPanel.jsx:56` + `awardPrimitives.jsx` | **RESKIN** (+pocket) | — | **SHIPPED** #391/#412 | Base 3-tier hero/tabs/state-grid/drill-drawer/ratio-trend is a clean tokenized reskin. **UNBUILT REDESIGN pocket:** the Policy-Ledger **provenance** layer (`AwardProvenancePanel`/`ContributionBar`/`LedgerSourceChip`, campaign COUNTS-vs-STANDALONE) has no live equivalent. Medal trio orphaned (cleanup FU). |
| 14 | `AgencyTrack Career Portal v2.html` (`app-career-v2.jsx`) | `profile/CareerPortal.jsx:838` | REDESIGN | major | **SHIPPED** #389 (#816) | 7-level vertical ladder + achieved/current/locked states + "★ what you unlock" drawer + commitment scorecards + trajectory chart. IA change realized: Commission Playground moved OFF to Tools/AgentDashboard. |
| 15 | `AgencyTrack History v2.html` (`history-v2-feed.jsx`) | `submissions/HistoryTab.jsx` | REDESIGN | major | **SHIPPED** #390 (#534) | Flat list → anchor strip + 52-square year heatmap + filter row + rich WeekCard (4-up KPI, WoW deltas, MiniSpark, rating bar). Soft spot: drill delegates to existing `SubmissionViewer`, not the mockup's bespoke `HistoryDrillContent`. |
| 16 | `AgencyTrack Agent Report View v2.html` (`agentreport-v2.jsx`) | `productionReport/AgentProductionView.jsx:44` | REDESIGN | major | **PARTIAL** #397/#403 | Agent-own tab shipped (hero + 3-KPI + 4-window + floor bar + rank pill + around-me). **UNBUILT core premise:** ONE `AgentReportView` reused in 4 contexts — a new manager-drawer **"Report" tab** + Meeting 1-on-1 + mobile. Live is agent-only; mockup's coaching-ratios/activity-density/coaching-note/Download-PDF not present. |
| 17 | `AgencyTrack Settings v2.html` (`settings-v2.jsx`) | `profile/ProfileScreen.jsx:17` (closest analog) | REDESIGN | major (net-new) | **PENDING** | Live `ProfileScreen` is a profile editor only. Mockup = new surface: **My Preferences** + **Team Defaults** (recommend-vs-lock per row + LockChip provenance) resolving Company→SM→Branch→Unit→Agent. The recommend-vs-lock grammar exists only on Goals (`RecommendLockDrawer.jsx`). |

### Manager surfaces

| # | Mockup | Live path | Class | Scope | Status | What differs (mockup ↔ live) |
|---|---|---|---|---|---|---|
| 18 | `AgencyTrack Manager Dashboard v2.html` (`manager-v2-scenes.jsx`) | `dashboard/ManagerOverviewTab.jsx:34` (+`ManagerHeroSection`) | REDESIGN | major | **PENDING** | Live = M2 comp: GoalDonut YTD hero + BranchKPIStrip + BranchActivityFeed + TeamMedalsPanel (#107). Mockup replaces the donut with an **AnchorStrip** leading an **exception-triage list** (below-floor/off-pace/gone-quiet/late) → **coaching drill drawer** + **recommend-a-target** action. None live. |
| 19 | `AgencyTrack Master Sheet v2.html` (`mastersheet-v2-scenes.jsx`) | `manager/MasterSheet.jsx` | REDESIGN | **minor→major (lightest)** | **PENDING** (only #799 empty-state) | 23-col table data/order/sticky **byte-identical**. **UNBUILT:** reality bar, column presets, "Show only exceptions" toggle, status-pill + mini-API bars, shared **5-tab coaching drawer** (all 0 grep hits). *The single lightest remaining port.* |
| 20 | `AgencyTrack Compliance v2.html` (`compliance-v2-scenes.jsx`) | `manager/CompliancePanel.jsx` | REDESIGN | major | **✅ SHIPPED (FULL) — exceeds mockup** #481/S2/#485 | Reality bar (`:449`) + exception-first "haven't filed" + **Nudge/Nudge-all** (CF `sendComplianceNudge`) + on-time-streak roster + coaching drawer — all live. **Beyond the mockup:** Filing⇄Plan lens (S3) + retained CBTT. |
| 21 | `AgencyTrack Weekly WARs.html` (`war-v2-desktop.jsx`) | `manager/ManagerWarTab.jsx` + `ManagerWarDetail.jsx` + `TeamWarsTab.jsx` | REDESIGN | major | **PENDING** | Live = Track-I self-file form + read-only upline detail + flat single-week team list. **UNBUILT:** team matrix + **8-week consistency** + **review drawer (approve / request-changes)** + filing streaks (0 hits across all 3 files). |
| 22 | `AgencyTrack Monthly Recruiting.html` (`recruiting-v2-desktop.jsx`) | `manager/MonthlyRecruitingTab.jsx` | REDESIGN | **major (largest schema delta)** | **PENDING** | Live = monthly aggregate rollup *form* (`candidatesAssessed`/`agentsContracted`/notes). **UNBUILT:** per-candidate document model + **8-stage kanban pipeline** + candidate drawer (stage timeline/referrer/owner/advance) — no per-candidate model anywhere in `src/`. |
| 23 | `AgencyTrack Campaigns.html` (`campaigns-v2-desktop.jsx`) | `campaigns/CampaignPanel.jsx` + `CampaignCard.jsx` | REDESIGN | major | **PENDING** | Live = flat single-prize threshold race. **UNBUILT (signature mechanics):** qualify-target **ladders**, **1st/2nd/3rd placement races**, the **persistency gate** (payout scales ≥90/85/80/<80%), confirm-winners flow — all 0 grep hits. |
| 24 | `AgencyTrack Manager Reports.html` (`pdf-unit.jsx`/`pdf-agency.jsx`) | *(none — Unit/Agency PDF)* | REDESIGN | major (net-new PDF) | **PENDING** | **⚠ Not an app tab — a PDF-document mockup.** Two net-new 4-page react-pdf exports (Unit Performance + Agency Performance). No `UnitReport`/`AgencyReport` generator exists (only the Agent PDF). |
| 25 | `AgencyTrack Branch Report.html` (`pdf-branch.jsx`) | *(none — Branch PDF; today = raw CSV)* | REDESIGN | major (net-new PDF) | **PENDING** | **⚠ PDF-document mockup.** 4-page Branch Performance PDF to replace the raw `exportBranchCSV()` jsPDF path. No refined Branch PDF component in `src/`. |
| 26 | `AgencyTrack Reports.html` (`pdf-refined-*.jsx`) | `profile/AgentReportDocument.jsx` (react-pdf, HEX-exempt) | REDESIGN | major (PDF) | **PENDING** | **⚠ PDF-document mockup.** Refined 4-page Agent PDF (cover + 3 content pages). Live is the *current* 2-page layout the mockup itself recreates as "Current"; only token/brand reconciled (#817), no 2→4-page refactor. |
| 27 | `AgencyTrack Production Report v2.html` (`prodreport-v2-scenes.jsx`) | `productionReport/ProductionReportTab.jsx` → Agent/UM/BM views | **Mixed** | major | **PARTIAL** #397/#403 | **Agent view = RESKIN, SHIPPED.** **UM/BM views = REDESIGN, unported** — last functional work #72 (E4); no `ProdControls`/`ProdTotals`/two-column `ProductionTable`+`RankedLeaderboard` composition, no Download button. **SM view does not exist** (no `sales_manager` branch in the router). |
| 28 | `AgencyTrack Leaderboard.html` (`app-leaderboard.jsx`) | `leaderboard/ProductionLeaderboardSurface.jsx` (+`AroundMeCluster`, `SmLeaderboardView`, `ui/MedalCoin`) | REDESIGN | major (net-new surface) | **SHIPPED** #401–#411 | Net-new production-ranked board (period API, not points) **replacing** the old `gamification/Leaderboard.jsx`. Live is a **superset** of the mockup: adds MovementChip, scope control, around-me pinned cluster, WeeklyChampionsBanner. |

### CRO / back-office

| # | Mockup | Live path | Class | Scope | Status | What differs (mockup ↔ live) |
|---|---|---|---|---|---|---|
| 29 | `AgencyTrack CRO.html` (`cro-v2-ops.jsx`, `cro-v2-delivery.jsx`) | *(none — role not routed)* | REDESIGN | major (**net-new role + collection**) | **PENDING + GATED** | **The one genuinely-new surface.** No `cro` role, no `CRODashboard`, no `DeliveryRegister`/`ClawbackClock` (0 hits in `src/` and `functions/`). Needs a new role/claim + rules + a delivery collection + money-affecting 30-day clawback writeback. `App.jsx` has no CRO branch (README §7). |
| 30 | `AgencyTrack Policy Reconciliation.html` (`reconcile-v2-desktop.jsx`) | `manager/PolicyReconciliationPanel.jsx` | REDESIGN | major | **PARTIAL** #434 (Slice 1, manual model) | v2 confirm-worklist SHIPPED (glass-hero "pending reconciliation" + 3 tiles + filter chips + per-policy key-in). **UNBUILT:** side-by-side **compare drawer** (delta + downstream-impact + per-flag actions), full exception taxonomy (unmatched/missing/duplicate/NTU/period — live has only flagged/confirmed + a lapse tab), agent "my settlements" + mobile. |

### Presentation surfaces (always-dark `presentation` tokens)

| # | Mockup | Live path | Class | Scope | Status | What differs (mockup ↔ live) |
|---|---|---|---|---|---|---|
| 31 | `AgencyTrack Kiosk Mode.html` (`kiosk-refined-a/b.jsx`) | `kiosk/KioskShell.jsx` + `panels/*` | **RESKIN** | — | **SHIPPED** #413 (#817/#821) | Panel visual restyle on `--color-presentation-*`; rotation/routes/IA untouched. **UNBUILT sliver:** the mockup's live **campaign-leaderboard panels 11 & 12** (join rotation on a "Show on kiosk" toggle) — no campaign panels live. |
| 32 | `AgencyTrack Meeting Mode v2.html` (`meeting-v2-scenes.jsx`) | `manager/MeetingMode.jsx` | REDESIGN | **large (largest pending item)** | **PENDING** | Live = old 3-part stat slideshow (summary → per-agent 3×3 → close). Mockup = full **guided-presentation rebuild**: branch scorecard (w/m/q/y), units team-by-team, two master sheets, exception-vs-**floor** drill, recognition + "on the rise", birthdays/anniversaries, awards-within-reach, in-meeting campaigns, 1-on-1 step, Tweaks, **team-photo upload (Storage)**, **presenter remote**. No Track-J commit on `MeetingMode.jsx`. |

### Shell / system / cross-cutting

| # | Mockup | Live path | Class | Scope | Status | What differs (mockup ↔ live) |
|---|---|---|---|---|---|---|
| 1 | `AgencyTrack App Layout.html` (`app-shell.jsx`) | `shell/Shell.jsx` + `Sidebar.jsx` + `TopBar.jsx` | **RESKIN** (chrome) | — | **SHIPPED** #388 | Shell chrome restyle. **Note:** nav *IA* then went **past** the mockup via a separately-shipped REDESIGN — grouped nav + ★Pinned zone + scope chips + workspace toggle (#726/#727/#731). Live is *ahead of* the App Layout mockup. |
| 2 | `AgencyTrack App Mobile.html` (`app-mobile.jsx`) | `shell/MobileBottomNav.jsx` | REDESIGN | minor | **SHIPPED** #388 | 4 flat tabs → tabs + **elevated center FAB** + "More" drawer (new interaction pattern). Extended past mockup by #729 Quick-Add + #727 pins in the drawer. |
| 3 | `AgencyTrack Mobile Nav.html` (`app-mobile.jsx`) | `shell/MobileNavDrawer.jsx` | REDESIGN | minor | **SHIPPED** #388 | Slide-up full-catalog "More" drawer (bundled with #2); live drawer adds Pinned/Workspace/scope-chips/"Soon" rows beyond the mockup. |
| 33 | `AgencyTrack System Screens.html` (`auth-v2.jsx`) | `auth/LoginScreen.jsx` + `App.jsx` states + `onboarding/*` | **RESKIN** (Login) | — | **SHIPPED** #414 (Login) | Login: drifting-glyph backdrop + liquid-glass card + password eye-toggle; auth flow unchanged. **Flagged:** the mockup also bundles Onboarding tour / Profile / User-Mgmt v2 — out of #414's diff scope; those sub-surfaces' v2 status is unconfirmed (MED confidence). |
| 34 | `AgencyTrack Emails.html` (`emails-refined.jsx`) | `functions/email-templates/{monday-nudge,sunday-nudge,password-reset}.{html,txt}` | **RESKIN** (3 templates) | — | **SHIPPED** #415 (deploy-gated) | 3 existing templates restyled to v2 (inline hex, email-exempt). **UNBUILT:** 2 net-new templates the mockup introduces — **submission-received** + **manager-escalation**. Note: merged ≠ deployed (functions deploy gated). |

---

## Sequence recommendation

**Principle:** the reskins and the token foundation are done; what's left is redesign component-building. Sequence to (a) bank cheap momentum, (b) extract shared primitives *once* before the screens that reuse them, and (c) push the heaviest, gated, money/auth-touching item (CRO) to the end. This is a hybrid of "cheap wins first" and "worst-offender last."

**Shared-dependency graph (change these once, many screens reuse):**
- **Reality bar + 5-tab coaching drawer** — already built inside Compliance (#481, SHIPPED). Reused by Master Sheet(19), Manager Dashboard(18), Weekly WARs(21). → *Extract as shared primitives.*
- **recommend-vs-lock drawer** — `goals/RecommendLockDrawer.jsx` (SHIPPED). Reused by Settings(17 Team Defaults), Manager Dashboard(18 recommend-target), Daily Capture governance(6).
- **Persistency data** (SHIPPED #505/#509/#515) — Campaigns(23) persistency-gate joins it.
- **Production Report UM/BM/SM views(27)** — must be v2-ported before the PDF exports(24/25/26) that "Download" from them.
- **MedalCoin/podium** — Leaderboard(28)↔Kiosk(31), already factored.

**Wave 1 — Finish the PARTIALs (cheap, unlocks shared primitives):**
1. **Master Sheet v2 S1 (19)** — the single lightest remaining port (23-col data byte-identical; only chrome + reality-bar + coaching-drawer). Do this **first** and harvest the reality-bar + 5-tab coaching drawer out of Compliance into shared primitives here. This de-risks all of Wave 2. (Candidate for a TRUE-RESTYLE green-channel dispatch if scoped to chrome only, per scoping-notes item 7.)
2. Small partial closes, each isolated: Policy Ledger **Lens** (9) · Policy Reconciliation **compare drawer + taxonomy** (30) · Agent Report View **manager-drawer "Report" tab** (16) · Daily Capture **DIALS/anchor** (6) · Game Plan remaining Year-Plan micro-features (7).

**Wave 2 — Manager redesigns reusing the Wave-1 drawer/reality-bar + Goals recommend-lock:**
3. **Manager Dashboard v2 (18)** — exception-triage + coaching drawer [reuse W1] + recommend-target [reuse Goals drawer].
4. **Weekly WARs (21)** — team matrix + 8-week consistency + review drawer (approve/request-changes = new status write).

**Wave 3 — Schema-heavy new-data redesigns** (each needs the full new-collection architectural unit per CLAUDE.md: rules + write + read + composite indexes + smoke):
5. **Settings v2 (17)** — per-user prefs store + team-defaults + resolver (model on the Goals cascade; reuse recommend-lock).
6. **Monthly Recruiting (22)** — per-candidate collection + kanban (largest schema delta; PII/retention question for candidate contacts).
7. **Campaigns (23)** — ladder/placement/persistency-gate (joins Persistency; migration of live campaigns).

**Wave 4 — Presentation + PDF exports:**
8. **Meeting Mode v2 (32)** — largest surface; Firebase Storage (team photos) + presenter-remote session doc → **human-merge** for the Storage path.
9. **Production Report UM/BM/SM v2 (27)** → then the **PDF exports** Manager Reports/Branch/Reports (24/25/26) that download from them.

**Wave 5 — CRO (29) LAST.** Net-new `cro` role + custom claim + rules + delivery collection + money-affecting 30-day clawback. Blocked on the README-§7 role-routing decision. **Human-merge throughout** (auth/rules/money). Everything learned building the manager redesigns (drawers, reality bars, Firestore write flows, status lifecycles) feeds directly into it — which is *why* it goes last.

**Deferred / low-urgency (no user pressure):** Prospect Prep(11) — gated "coming soon"; build v2 prep-tool + ungate when pilot timing allows. Kiosk campaign panels(31) + 2 net-new email templates(34) — small additive slices; fold into the Campaigns / notifications work. System Screens non-Login(33) — verify onboarding/profile/user-mgmt v2 status first (likely small).

---

## Cross-reference — migration-doc reconciliation (Task 5)

The migration-doc reconciliation **exists on the branch base**: `docs/design-system/screens-v2/AgencyTrack App - DS Audit & Migration Plan v2 (Repo-Reconciled).html`, reconciled against `main HEAD 9dcae1a3` (2026-07-05). It is fresh and on-point.

**Where this recon agrees with it:**
- Its headline — *"not a from-scratch migration… finishing a per-screen port that is already ~80% built, plus one genuinely-new surface"* — matches this recon's 16 SHIPPED / 6 PARTIAL / 12 PENDING and the single net-new CRO surface.
- Both confirm the token foundation is done (`src/index.css` `:root`/`.dark`) — this is a port, not a rebuild — and that the `_ds` bundle never ships into the app.
- Both isolate **CRO** as the one genuinely-new build (role not routed).

**Where this recon corrects / sharpens it (the value-add):**
- The migration doc's **"Built" badge means "a target component exists with v2 primitives" — NOT that the v2 mockup deltas are applied.** Its own §4 build plan says most "Built" screens still need "verify each screen against its mockup — confirm no visual drift." Per-mockup diffing shows the badge **overstates completion on 5 screens** it marks "Built":
  - **Master Sheet(19)** — "Built" but no reality-bar/presets/exceptions-toggle/coaching-drawer (0 hits; only #799 empty-state).
  - **Weekly WARs(21)** — "Built" but no matrix/consistency/review-drawer/streaks.
  - **Monthly Recruiting(22)** — "Built" but still the aggregate rollup form; no candidate pipeline.
  - **Campaigns(23)** — "Built" but none of the ladder/placement/persistency-gate mechanics (0 hits).
  - **Meeting Mode(32)** — "Built" but still the old stat slideshow; the guided-presentation rebuild is unstarted.
  - Only **Compliance(20)** among the manager redesigns actually shipped its v2 mockup.
- The migration doc lists Manager Reports / Branch Report / Reports under "Production Report" screens; this recon reclassifies them as **PDF-document mockups** (`pdf-*.jsx`), not app tabs — a distinction that changes their target (react-pdf generators, only the Agent PDF exists).

**Other recon reports on the branch base (complementary, cross-referenced):**
- `docs/audits/reskin-recon-2026-07-05.md` — *token-level* foundation-swap surface (the DECISIONS behind #813). Complementary: it maps the token plumbing; this maps the screen composition.
- `docs/audits/nav-recon-2026-07-06.md` (+ addendum) — nav verdict **TIER-1 reskin** (the shipped nav already realizes the locked new-design proposal). Corroborates rows 1–3 here.
- `docs/audits/motion-recon-2026-07-06.md` / `glass-recon-2026-07-06.md` — motion + glass subsystem surfaces (both since acted on: #821 motion, #820 glass close).
- `docs/track-j-port-ledger.md` (2026-06-03) — the canonical 34-row spine; **its port-status column is ~1 month stale** (this recon supersedes it — e.g. Persistency-manager, Compliance, Commission, Goals all shipped since).
- `docs/design/track-j-redesign-scoping-notes.md` + `track-j-redesign-schema-matrix.md` (2026-06-04) — the 8-screen REDESIGN reclassification + schema deltas. This recon **confirms all 8 remain REDESIGN**, and updates status: Compliance & Persistency-mgr have since **shipped**; Master Sheet/WARs/Recruiting/Campaigns/Settings/Meeting Mode remain **PENDING**.

---

## Flagged for operator review (Autonomy rule — surfaced, not guessed)

Nothing was left genuinely UNCLASSIFIED, but three items carry a judgment call the operator should confirm:

1. **Reports family (rows 24/25/26) are PDF documents, not app-tab redesigns.** The prior ledger/README framing ("same `productionReport/*` suite at different scopes") is misleading — these map to `@react-pdf/renderer` generators (Unit/Branch/Agency/refined-Agent PDFs), of which only the Agent PDF exists. Confirm whether the PDF-export track is in Track-J's scope or a separate deliverable.
2. **System Screens non-Login sub-surfaces (row 33).** #414 shipped only the Login reskin. The mockup also bundles Onboarding-tour v2 / Profile v2 / User-Management v2 (`profile-v2.jsx`, `usermgmt-v2.jsx`). Their v2 status was inferred from #414's diff scope, not a component-by-component diff (MED confidence). Worth a focused re-audit.
3. **Net-new / separate tracks (not primary Track-J).** These mockups have **no live counterpart and are their own feature tracks** — flag, don't sequence into Track-J: `Planner & Scheduler v2` + `Planner - Manager Surfaces` (live shows "Planner SOON", #726), `On-Track Engine`, `Loop Prototype` (Game Plan loop), the `Money Needs` merged/options variants, and the top-level `Persistency Playground v1-v2.html` (an auxiliary v1-vs-v2 comparison lab, not a screen port). Money Needs *itself* is already built (`agent/MoneyNeedsPanel.jsx`, per migration doc).

---

## Known gaps (Rule 22)

- **Static / source-derived only — no rendered visual diff.** Every classification rests on the mockup's `.intro` design-intent card + its scene-module composition + the live component's code structure + `git log`. No screenshots were compared. A RESKIN could still carry pixel drift a source read won't catch; a "SHIPPED" screen could have sub-feature drift within an already-ported surface.
- **Scene modules read selectively.** Sub-agents read each screen's primary scene module(s) but not every sibling in full. The weakest-verified "already-shipped" claims: History drill-drawer parity (delegated to `SubmissionViewer`, not directly read) and Game Plan's exact Year-Plan micro-features.
- **PENDING calls are `origin/main` + current-tree evidence only.** An in-flight *unmerged* feature branch would not show here. On merged history + working tree, only the statuses above hold.
- **"Built"-vs-"redesign-applied" is the axis the migration doc conflates and this recon separates** — but the separation itself is a source-read judgment, not a rendered proof.
- **The 34-row spine follows the port-ledger's enumeration.** My agent/manager granularity differs slightly from it (e.g. Persistency's single mockup covers both agent + manager sides; App Mobile + Mobile Nav share one live surface). Counts treat each ledger row once.
- **`functions/` beyond `email-templates/` not inventoried** (per scope) — CRO's would-be Cloud-Function surface (clawback/delivery writes) is assessed only from the absence of any client-side counterpart.
- **Net-new tracks (Planner/On-Track/Loop/Money-Needs variants) were flagged, not classified** — deliberately out of primary Track-J scope; a full reskin-vs-redesign pass on those is a separate recon.

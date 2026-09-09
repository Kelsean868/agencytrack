# Track J — V2 Redesign port-completeness ledger

> **Rebuilt from ground truth 2026-07-25.** This document replaces the 2026-06-03 snapshot in full.
> It also **supersedes the port-status columns of [`docs/audits/trackj-recon-2026-07-07.md`](audits/trackj-recon-2026-07-07.md)** —
> that recon's `16 SHIPPED / 6 PARTIAL / 12 PENDING` counts predate the numbered build program
> (items 1.x–3.x, 2026-07-08→07-10), Runs 5–9, and all of Run A. Its **RESKIN-vs-REDESIGN
> classification and per-screen mockup↔live diffs remain valid and are not superseded.**

**Base:** `origin/staging` @ **`8a1a17e4`** (PR #870 squash — Run A Tier 3 conformance closeout).
**Refreshed 2026-09-09 against `main` @ `fb0416c8`** (PR #941 squash) - a DELTA pass, not a re-derivation of all 37 rows. Only rows whose ground truth changed since the base are restated; every other row carries its 2026-07-25 status forward, un-re-verified. Delta method: `git diff --name-only 8a1a17e4 main` filtered to this ledger's component paths, then a source read of every row that filter touched.
**Method:** Rule-17 source verification — every status below is derived from `git log`/`git grep`/diff evidence against `origin/staging`, not from any prior ledger's text. Prior statuses were verified, never trusted.

> ## STAGING-vs-PROD CAVEAT - RESOLVED 2026-08-16
>
> The promotion landed: `b4d9be7b` (merge - "promote staging to main - Phase 0 (P0-A..P0-D,
> P0-G), flake fix, governance convergence", 98 files). `main` has since advanced to
> `fb0416c8`. Every status below is now **main-true, not staging-true.** Run A
> (#865/#866/#870 + #867/#868/#869) is promoted, and the two PRs this box called "open and
> holding" are both merged - #872 on 2026-07-26 (`d3fe88e4`), #871 on 2026-07-27
> (`d52eacf6`). The original box is in git history; do not re-add it.

---

## Headline

> **25 of 37 screens ported - 11 partial - 0 pending - 1 retired.** *(2026-09-09 refresh.)*

> **Count correction, flagged rather than silently reconciled.** The 2026-07-25 headline read
> `28 ported / 8 partial / 0 pending / 1 gated`, but that same pass's own table counts
> **24 PORTED / 12 PARTIAL / 1 GATED**. The table is the ground truth and the headline was
> wrong on arithmetic, not on any row's status. The figures above are counted from the rows:
> row 19 moves PARTIAL -> PORTED (24 -> 25) and row 10 moves GATED -> RETIRED.

**There are no un-started screens left.** Track J is no longer a port backlog — it is a
finish-the-last-slice backlog. The 2026-07-07 recon's thesis is confirmed and now complete:
the Nexus v2 *token layer* produced the cosmetic v2 look app-wide, and the remaining work is
component-level redesign, all of it in flight or scoped.

### Spine arithmetic — why 37 rows, not 39

The canonical spine was 34 screens (the exact byte-set intersection of `docs/design-system/screens-v2/*.html`
and `design_handoff_v2_app/mockups/*.html` — verified 34/34 this pass). Seven files live **only** in
`design_handoff_v2_app/mockups/`. Of those:

- **3 absorb as new spine rows** → Planner & Scheduler v2 · Planner — Manager Surfaces · Money Needs Merged.
- **2 are companions to the Money Needs row, not screens** → `Money Needs - 3 Options.html` (2.0 kB,
  *"worksheet depth: 3 options"* — an options-comparison ideation artefact) and
  `Money Needs Merged - Build Notes.html` (18 kB build-notes companion to the same prototype).
  Consolidating these into row 37 is the "consolidate sensibly" instruction applied.
- **2 are not screens at all** → recorded in § Absorbed-logic / ideation below.

34 + 3 = **37**. The 39 figure in the Wave-1 brief counted all five Money-Needs-family files as
separate screens; consolidating them as instructed necessarily yields 37. Flagged rather than
silently reconciled.

---

## Ledger — 37 screens

| # | Screen | Status | PR# / SHA | Component(s) | Note |
|---|---|---|---|---|---|
| 1 | App Layout | **PORTED** | #388 `63cb0cf` · 1.1 · #847 · #867 | `shell/{Shell,Sidebar,TopBar,CommandPalette}` | ⌘K palette fresh-built, not the `_ds` demo. #867 fixed the rail pin-star swallowing nav clicks at 768–1023px |
| 2 | App Mobile | **PORTED** | #388 · `2b16e760` | `shell/MobileBottomNav` | Run 8 A-7 More-slot glyph |
| 3 | Mobile Nav | **PORTED** | #388 · `2b16e760` | `shell/MobileNavDrawer` | |
| 4 | Agent Dashboard v2 | **PORTED** | #392 `fd9fdd6` + #393 `9a145e6` · `72daabf8` | `dashboard/HomeV2/*` | Run 6 §2 stagger residuals |
| 5 | Weekly Wizard v2 | **PORTED** | #416–#422 · `0dd3701f` · `b84d5e60` · `e41baffc` | `wizard/*` (legacy `steps/` deleted) | 100% v2 |
| 6 | Daily Capture v2 | **PARTIAL** | #426 `8e82cca` * `858be570` * #909 * #927 | `daily/DailyCaptureV2.jsx` | **Corrected 2026-07-25 (was PORTED); re-confirmed 2026-09-09.** Half A is still open at `fb0416c8` - `deriveCountStripChips` (`DailyCaptureV2.helpers.js:40-48`) still returns exactly `{appr, ffi, ci, apps}`, no dials chip. #909 (call-type split, schema v1->v2) and #927 (the two-writer guard) touched this surface for data reasons, not for the slice-2 redesign. See � Row-6 verdict |
| 7 | Game Plan v2 | **PARTIAL** | `51e814b3` (2.11) · #438 · #445 · #785 · #790 | `dashboard/GamePlanV2/*` | Hub + cascade viz + inline commit + Money Needs merged + Fork-A reader. **Fork-B suggest-back design-gated** |
| 8 | Goals v2 | **PORTED** | #638 · `0fc62efa` · #645 · `858be570` | `goals/{DerivedIncomePanel,MdrtTracker,AwardsReachPanel,GapAnalysisPanel,GoalsCelebration}` | v3.1 + v3.3 + manager portfolio catch-up |
| 9 | Policy Ledger v2 | **PARTIAL** | #432 `5a24aa3` · `38f1360a` · `41885ff5` · `10507856` | `agent/policyLedger/*` | Agent surface + insured-name + campaign-proof CSV shipped. **Campaign Lens behind `policyLedgerCampaignLens`, default OFF** |
| 10 | Persistency v2 | **RETIRED** | #395 * #505 * `10507856` * **removed `6eefdea2` (#939)** | ~~`persistency/PersistencyV2Shell.jsx`~~ | **Corrected 2026-09-09 (was GATED).** This is not a pending port - the surface is deleted. Tatil's 29 Aug 2026 memo adopted a different model (an aggregate formula plus a 24-month inclusion window), so the `rollingModelV2` debit curve was the rejected proposal; P2 (#939) deleted the shell, the model, their tests, the flag-gated mount, and the flag's entries in `featureFlagsService.js` and `companyConfigRegistry.js`. **Residue:** `configService.js` `ALLOWED_FLAG_KEYS` still names `persistencyV2` - unreachable, but real debt, waiting on a `firestore.rules` edit. The shipped 24-month work (PRs #937-#941) lives in `lib/persistency/*`, outside this spine. |
| 11 | Prospect Prep v2 | **PORTED** | `fe541fe3` (3.5) · `bd474304` | `prospect/{NextCallHero,ObjectionRehearsal,ApptBadge}` | Joint-Call Observation Log is Track F, a separate spine |
| 12 | Commission v2 | **PARTIAL** | #496 `0b79a92f` · #870 · `d4d2aaf0` | `goals/CommissionPlayground/*`, `agent/CommissionAnchorStrip` | AnchorStrip + R-06 chips + §4.7 daily chip (258 = 43×6). **Two-column rail+ladder STOP→DROPPED** (no in-repo authority). Hero persistency stat pending render evidence |
| 13 | Agent Awards v2 | **PORTED** | #391 `84abe6e` + #412 `4dc0859` · `9beb2aa7` | `awards/*` | Provenance layer behind `awardsProvenance` flag (OFF) — additive; base screen conformant |
| 14 | Career Portal v2 | **PORTED** | #389 `8371818` | `profile/CareerPortal.jsx` | |
| 15 | History v2 | **PORTED** | #390 `f151183` · `e2c4e7fb` (2.6) | `submissions/HistoryTab.jsx` | |
| 16 | Agent Report View v2 | **PORTED** | #397 `e17cb55` + #403 `b12dda1` | `productionReport/AgentProductionView.jsx` | `AgentReportDocument.jsx` HEX-only by design (exempt) |
| 17 | Settings v2 | **PORTED** | `b8f7bf8c` (2.4) · `ee4794f9` | `settings/SettingsScreen.jsx` | |
| 18 | Manager Dashboard v2 | **PORTED** | `8f39d02c` (1.5) · `fa0fe12e` · `9c7759a8` | `dashboard/{ManagerOverviewTab,ChampionsPanel,MyWeekPanel,ExceptionLeadPanel,CascadeAnchorStrip,BranchKPIStrip}` | R-08 verified conformant in #870 |
| 19 | Master Sheet v2 | **PORTED** | `b626f03d` + `7148b0b1` + `a003f85d` + **#871 `d52eacf6`** | `manager/MasterSheet.jsx`, `utils/funnelStatus.js` | **Corrected 2026-09-09 (was PARTIAL).** #871 merged 2026-07-27; STATUS chips are live at `fb0416c8` (`buildStatusMap`, `STATUS_NODATA_KEY`, `StatusPill`, `ROW_REACHABLE_STATUS_OPTS` all present), and the blocking pre-merge threshold condition was satisfied inside that same PR - the decimal-vs-percent scale reconciliation is #871's own title. **Two items carried, neither a port gap:** five chips ship, not six ("Gone quiet" omitted in `6a2e3709`, still awaiting an operator ruling against the banked six-band taxonomy), and LEVEL stays explicitly blocked. See � Row-19 detail |
| 20 | Compliance v2 | **PORTED** | `3d42125f` (S4) · `233650b4` | `manager/CompliancePanel.jsx` | |
| 21 | Weekly WARs | **PORTED** | `4f2c9052` (2.1) · `138fda81` · `75717d6d` | `manager/{ManagerWarTab,ManagerWarDetail,TeamWarsTab,WarCompletionRing,WarStreakDots}` | |
| 22 | Monthly Recruiting | **PORTED** | `82ce5631` (2.2) | `manager/{MonthlyRecruitingTab,RecDrillDrawer,recruitingVisuals}` | |
| 23 | Campaigns | **PORTED** | `e3b22fcb` (2.9) · `10639cb5` | `campaigns/{CampaignPanel,CampaignCard,CampaignStandings}` | |
| 24 | Manager Reports | **PARTIAL** | `9c08c40b` (2.5) · `c2d9516c` | `productionReport/UnitManagerProductionView` + `ManagerReportDocument` | **Corrected 2026-07-25 (was PORTED).** PDF/download ported; on-screen surface never v2-ported — see § The 9c08c40b verdict |
| 25 | Branch Report | **PARTIAL** | `9c08c40b` (2.5) | `productionReport/BranchManagerProductionView` + `ProductionTable` | **Corrected 2026-07-25.** Same verdict |
| 26 | Reports | **PARTIAL** | `9c08c40b` (2.5) | `productionReport/ProductionReportTab.jsx` | **Corrected 2026-07-25.** Router only — gained 2 pass-through props in 2.5, nothing else |
| 27 | Production Report v2 | **PARTIAL** | #397 (agent) · `c2d9516c` (Run3 D) | `productionReport/*` scope views | Agent variant genuinely ported; **UM/BM/SM scopes not** — restores the original ledger's read |
| 28 | Leaderboard | **PORTED** | #396–#411 (9 PRs) · `72daabf8` | `leaderboard/*`, `ProductionLeaderboardSurface` | All role tiers |
| 29 | CRO | **PARTIAL** | `0b64948b` (3.1) | `cro/{CRODashboard,DeliveryRegisterPanel,MarkDeliveredDialog,ClawbackChip}` | **No longer gated** — role routing live (`App.jsx:131`, corrected Run A Tier 1). Commit self-labels "UI half"; data/backend half outstanding |
| 30 | Policy Reconciliation | **PARTIAL** | #434 `0136bcc` | `manager/PolicyReconciliationPanel.jsx` | Slice 2 deferred: bulk-confirm, 8-way taxonomy, dispute/escalate, Lapse-in-worklist |
| 31 | Kiosk Mode | **PORTED** | #413 `e685610` · `2066d366` · `57567786` · `58ff208b` | `kiosk/*` | |
| 32 | Meeting Mode v2 | **PORTED** | `389d2cc7` (3.3) · `09cb1168` · `e04f6978` | `manager/{MeetingMode,FunnelMeetingScene}` | |
| 33 | System Screens | **PORTED** | #414 `91f9054` · `27db30cf` · `843af4e4` | `auth/LoginScreen`, `App.jsx` states, `onboarding/*` | |
| 34 | Emails | **PARTIAL** | #415 `aae5c35` | `functions/email-templates/*` | 3 templates restyled; **2 net-new templates still absent - re-confirmed 2026-09-09** by a directory read at `fb0416c8`: the folder holds only `compliance-nudge`, `compliance-plan-nudge`, `financing-adjustment-notify`, `monday-nudge`, `password-reset`, `sunday-nudge` (.html + .txt each). No `submission-received.*`, no `manager-escalation.*`. Also **merged != deployed** |
| **35** | **Planner & Scheduler v2** *(absorbed)* | **PORTED** | #866 · #867 · Run 9 (`d0e74c12`) · `550b7a97` (3.2) | `planner/*` (20 files) | E1/E5/E2/E4/E3 + A1–A5 + F3. Mockup scenes 6 + 8 **scoped out by design** — see § Absorbed rows |
| **36** | **Planner — Manager Surfaces** *(absorbed)* | **PORTED** | `550b7a97` (3.2) · `22c12b20` (D3) | `planner/manager/TeamPlannerPanel.jsx` | Read-only team view; SM + TA nav arms |
| **37** | **Money Needs Merged** *(absorbed)* | **PORTED** | PR-U1 · PR-U2 · #438 | `agent/{MoneyNeedsPanel,MoneyNeedsAllocator}`, `lib/moneyNeedsAllocation.js` | Consolidates 3 handoff files. `yearPlan` 3-line canonical; `.allocation` cut |

---

## The `9c08c40b` verdict (rows 24–27) — evidenced correction

The prior ledger rated rows 24–27 **PORTED** on the strength of commit `9c08c40b`'s subject line
alone (*"2.5 refined Agent PDF + Branch/Unit PDFs + per-view Download + honest DataSourceBadge"*).
Reading the full diff overturns that.

**What 2.5 actually did to the three on-screen manager views** (`BranchManagerProductionView` +88,
`UnitManagerProductionView` +77, `ProductionReportTab` +11 lines):

1. Added a `Download report` button (`min-h-[44px]`, token classes) + busy state.
2. Added an inline `role="alert"` PDF-error card.
3. Swapped `<DataSourceBadge source="estimated" />` → `source={dataSource}` via `deriveProductionDataSource`.
4. `ProductionReportTab` gained two pass-through props (`onDownloadPDF`, `generating`).

**No layout, IA, composition, or visual restyle.** The bulk of the commit (`AgentReportDocument.jsx`
±1709, new `ManagerReportDocument.jsx` +398, `managerReportModel.js` +72, `agentReportPdfModel.js` +282)
is **react-pdf document work** — a surface that is HEX-only by design and explicitly exempt from the
v2 token system.

**Corroborating file history** — `git log origin/staging -- <view>` shows these two components have
**never received a dedicated Track-J v2 port**:

| Commit | Nature |
|---|---|
| `783c07aa` (#72, 2026-05-09) | Original Track-E build — **pre-v2**; still the structural basis |
| `b10a3801` · `e0ac355f` · `3601341f` · `0773af3a` | Systemic sweeps (contrast, axe, glass, gold) — app-wide, not per-screen |
| `2ab27cc0` · `d3178618` · `15f724ec` · `cd58da5e` | Systemic tier-0 sweeps (states, dense tables, motion) |
| `9c08c40b` | The above — PDF + download + badge |
| `c2d9516c` | UM Unit-Aggregate hero parity with BM |

That is exactly the 2026-07-07 recon's own thesis — *"the token layer already produced the cosmetic
v2 look everywhere; what remains is component-level redesign."* Rows 24–26 received the token layer.
They did not receive the redesign.

**What remains:** the on-screen composition/IA port for the UM and BM production surfaces
(`BranchManagerProductionView.jsx`, `UnitManagerProductionView.jsx`) against
`AgencyTrack Production Report v2.html` / `Manager Reports.html` / `Branch Report.html`.
Row 27's agent variant (#397/#403) is genuinely ported and is not in scope.

---

## Row-6 verdict (Daily Capture) — evidenced correction

The Slice-2 FU reads *"targets + dials chip on the strip (manager-set targets + new dials field)"*.
Both halves are **still open**, for narrower and more precise reasons than banked:

| Half | Verdict | Evidence |
|---|---|---|
| **Dials chip on the strip** | **NOT shipped.** `dials` is captured and scored, but the WTD count strip is still the original four chips. | `DailyCaptureV2.helpers.js:40-48` — `deriveCountStripChips` returns exactly `{appr, ffi, ci, apps}`. The `Dials` row exists only in `SundayConfirmView` (`DailyCaptureV2.jsx:431`), a different surface. The field itself is live (`:969` `StepperRow label="Dials (total calls)"`; `:55` maps it to the `coldCalls` points bucket). |
| **Manager-set targets** | **NOT shipped.** A target *is* rendered, but it is the tenant-wide company floor, never a per-agent manager-set value. | `:695-697` — `weeklyApiTarget = Number(weeklyFloors?.api ?? DEFAULT_WEEKLY_ACTIVITY_FLOORS.api)`, with the in-source comment *"company floor, same source HistoryTab uses. Code default (4800) applies until floors load."* `DailyAnchorStrip` (`:299-330`) and `computePaceState` (`:709-715`) both consume it. No per-agent read exists. |

**FU re-scope — APPROVED and APPLIED 2026-07-25** (dispatcher, Wave 1 item 2). `docs/FOLLOW_UPS.md`
§ *Daily Capture anchor strip* is now split into **Half A** (add a Dials chip to `deriveCountStripChips`
— SMALL, self-contained, no schema/rules/read change) and **Half B** (per-agent manager-set targets to
replace the company-floor fallback — MEDIUM, the actual head-of-sales ask, a goals-hierarchy read-path
and provenance question). The original body is preserved there under a `<details>` drift trail.

**Rule 11 note:** the original FU body asserted that capturing daily dials required a *new schema field*.
That premise is **stale** — `dials` is live, captured at `:969`, and already feeds the points path via
`helpers.js:55`. Four of the original six scope steps were obsolete. Corrected in the re-scope.

---

## Row-19 detail (Master Sheet) — from the PR #871 diff

PR #871 (`post-run-a/master-sheet-status`, 7 files, +912/−29) is **correctly scoped to STATUS only**;
`LEVEL` is untouched and explicitly re-confirmed blocked. Three things the ledger must record:

1. **Five chips ship, not six.** CodeRabbit found (🟠 Major) that **"Gone quiet" can never match a row**
   on a filers-only surface — `quiet` means zero submissions this year, but a row exists only for an agent
   who filed the selected week. Fixed in `6a2e3709` by **omitting** the chip, on the same reasoning that
   already excludes LEVEL and the report family's "Missing". **This deviates from the banked "six-band
   taxonomy" spec and is awaiting an operator ruling.**
2. **The `quiet` mapping is a judgement, not a ruling.** No in-repo derivation exists; the mockup supplies
   vocabulary only, and `MeetingMode.helpers.js:97-101` explicitly declines to derive it. #871 maps it to
   `deriveExceptions`' existing "No reports" kind rather than inventing a recency threshold — isolated in
   `exceptionToStatusKey`, four lines.
3. **Threshold divergence — RULED 2026-07-25: this is now a blocking pre-merge condition on #871.**
   Three surfaces carry three literals for the persistency floor: `MeetingMode.helpers.js` `< 80`
   (percentage), `getCompanyMinimums` default `90`, `calculations.js` `PERS_FLOOR = 0.80` /
   `PERS_GATE = 0.90` (decimal). **#871 must not merge until these reconcile to one canonical constant**
   — its STATUS chips band agents on a persistency floor, and merging would add a fourth consumer of an
   already-ambiguous number on a money-adjacent surface. `calculations.js` is the canonical export and
   decimal is the stored shape. Tracked at `docs/FOLLOW_UPS.md` § Persistency threshold — three surfaces,
   three literals.

Also recorded from the PR: the "unit friendly names" LOW FU is **not a code gap** — `unitLabel`,
`deriveUnitOptions` and `userMeta` all already prefer a real name; user docs simply carry no `unitName`.
That FU should be re-scoped to *"populate `unitName` on user docs"*.

---

## Absorbed rows — provenance (rows 35–37)

These three were built without ever entering the 34-row spine, which is why the spine read as
"incomplete" while the app shipped them. Recording them here **closes the
`design_handoff_v2_app/` vs `screens-v2/` reconciliation** (Run A Tier 3c item 3).

**Row 35 — Planner & Scheduler v2.** The mockup declares 9 `DCSection` scenes.
`AgentPlannerPanel.jsx:290-291` self-documents the built scope as *"handoff screens 1-9, scoped to
Today / Week / Follow-ups + the plan→actual handoff"*. Built: scenes 1, 2, 3 (`PlannerDesktopBoard`,
E1), 4 (`AppointmentSheet`), 5 (churn sheet), 7 (`followupsList`), 9 (`DailyCaptureV2.jsx:47,586`
`blankFillSeed`, which cites *"Planner handoff seed (item 3.2 screen 9)"* by name).
**Scoped out by documented decision:** scene 6 (Freed-slot suggested fill ⭐) and scene 8 (Prep card) —
0 grep hits across `components/planner` + `services`. Recorded as decisions to re-ratify, not defects.
Status stays PORTED because the built scope matches the component's own declared contract.

**Row 36 — Planner Manager Surfaces.** `planner/manager/TeamPlannerPanel.jsx`; D3 (`22c12b20`)
added `sales_manager` + `tenant_admin` read-only nav on the pre-verified rules arm.

**Row 37 — Money Needs Merged.** Consolidates `Money Needs Merged.html` (the prototype),
`Money Needs - 3 Options.html` (options-compare ideation) and `Money Needs Merged - Build Notes.html`
(build companion). Shipped via PR-U1/U2 — `yearPlan` 3-line canonical, `.allocation` write cut,
round-trip invariant Σ`targetAPI` === allocator `totalAllocatedAPI`.

---

## Absorbed-logic / ideation — NOT screens

Two `design_handoff_v2_app/mockups/` files have no screen counterpart and are deliberately
**not** given spine rows:

| File | Disposition |
|---|---|
| `AgencyTrack On-Track Engine.html` | **Absorbed logic.** No 1:1 component. The on-track concept ships distributed across `utils/planVariance.js`, `lib/monthlyVarianceChips.js`, `GamePlanV2/SuggestedWeekCard.jsx` (pace) and `HomeV2/StandardDetail.jsx`. A cross-cutting engine mockup, not a screen. |
| `AgencyTrack Loop Prototype.html` | **Ideation.** Backed by `loop-proto.jsx`; no target screen. |

---

## Out of scope (unchanged)

The Tenant Admin configuration suite (Dashboard, Branches, Company Config, Awards Ruleset, Plan
Catalog, Bulk Imports) is intentionally excluded from the v2 mockups per the v2 handoff README §12
and is not counted as a port gap. `mocks/concept-*.html` are Track B "Concept 4 Complete" mocks
(PRs #42–#55), not Track J.

---

## RESKIN vs REDESIGN classification (retained — still valid)

Mockup-vs-brief contradictions of the kind surfaced on Wizard v2 recur. The STEP 2 reclassification,
committed at [`docs/design/track-j-redesign-scoping-notes.md`](design/track-j-redesign-scoping-notes.md),
classifies each mockup as **TRUE-RESTYLE** (presentational only — chrome + tokens, same composition +
data, no new computation) vs **REDESIGN** (re-pagination, new live/derived data, new components, new
flows). REDESIGN briefs must permit composition + computation changes; TRUE-RESTYLE briefs lock them down.

The 2026-07-07 recon's own classification table (27 REDESIGN / 5 RESKIN / 2 Mixed) is **not** superseded
by this ledger and remains the authority on the *nature* of each port.

---

## Rule-22 — known gaps in THIS ledger

Carried forward from the 2026-07-24 audit, with items 1–3 now **CLOSED** by this pass:

| # | Gap | State |
|---|---|---|
| 1 | ~~Rows 24–27 rest on `9c08c40b`'s subject line, not its diff~~ | **CLOSED** — full diff read; four rows corrected PORTED → PARTIAL with cited evidence |
| 2 | ~~Row 6 targets/dials not traced through the render path~~ | **CLOSED** — traced; FU confirmed open on both halves and re-scoped |
| 3 | ~~PR #871 completeness assumed from its title~~ | **CLOSED** — diff + body read; scope confirmed STATUS-only, three new facts recorded |
| 4 | **Component-level visual conformance is not diffed here.** A row marked PORTED can still carry conformance drift. | **OPEN** — partially addressed for five surfaces by [`docs/audits/design-conformance-2026-07-25.md`](audits/design-conformance-2026-07-25.md); the other 32 rows are unaudited since 2026-07-13 |
| 5 | **Flag defaults (rows 9/10/13) are read from source, not from a live tenant config.** Code-true; whether any tenant has flipped them in prod is unverified. | **OPEN** — needs a prod config read |
| 6 | **Scene-inventory diffing was done for the Planner mockup only** (row 35). Rows 1–34 and 36–37 were not re-checked scene-by-scene against their mockups. | **OPEN** — the single largest remaining verification debt in this document |
| 7 | **Row 29 (CRO) "data/backend half outstanding" is inferred** from the commit's own "(UI half)" label, not from a diff of what the CRO mockup's data layer requires. | **OPEN** |
| 8 | **No live verification anywhere in this ledger.** Every status is a source-and-history inference. | **OPEN by design** — this was a read-only pass |
| 9 | **The 2026-09-09 pass is a delta, not a re-derivation.** 31 of 37 rows carry their 2026-07-25 status forward without being re-read against `fb0416c8`. | **OPEN by design** - a row whose files did not change cannot have gained a port, but it can have gained drift (see gap 4) |
| 10 | **Rows 24-27 stand by absence of change, not by re-reading them.** No file under `src/components/productionReport/` appears in `git diff --name-only 8a1a17e4 main`. | **CLOSED for status, OPEN for conformance** |

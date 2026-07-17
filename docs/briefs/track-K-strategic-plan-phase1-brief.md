# Track K — Strategic Plan Dashboard (Phase 1)

**Author:** Claude-web (architect)
**Date:** 2026-07-17
**Status:** Ready for dispatch
**Model:** Opus 4.8
**Channel:** Client-only feature branch → CodeRabbit review → squash-merge. No rules, no functions, no human-deploy gate.
**Branch:** `feat/strategic-plan-dashboard-p1` (single-branch-per-PR)
**Recon basis:** `docs/briefs/` recon 2026-07-17 (line-cited). Every claim below is grep-verified against that recon; CC re-verifies file:line at build time (Rule 17 applies to executor).

---

## 1. Goal

An in-app, Branch-Manager-owned **Strategic Plan** dashboard that reproduces the Tatil Life Agency Strategic Plan deck as a live, interactive, drillable surface — with a full-screen **presentation mode** for presenting to the Sales Manager, and a **PDF export** for a frozen snapshot. All Phase 1 data renders read-only from existing collections with **zero schema change**.

Scope mapping (locked): deck "Agency Manager" = **Branch Manager** (plan owner/author); "Unit Manager" / "Trainee Manager" = units beneath; **Sales Manager** = audience. "Trainee Manager" is a display label only and operates as a Unit Manager.

---

## 2. Scope

### In (Phase 1)
Five "Have" slide sections, all backed by existing collections:
1. **Agent Performance Tracker** (deck p5)
2. **Production Summary** (deck p9)
3. **Period Metrics** (deck p18) — quarter/half toggle
4. **Org Structure** (deck p8/14–17)
5. **Recruitment Pipeline** (deck p6–7)

Plus: interactive dashboard shell, presentation mode, PDF export.

### Out (deferred — do NOT build in Phase 1)
- `branchPlans` collection + narrative sections (Vision, SWOT, Lessons Learned, Sales/Recruitment Strategy, Training, Implementation). Needs rules → human-merge. **Phase 2.**
- PowerPoint export (net-new `pptxgenjs` engine). **Phase 2.**
- Quotas-by-classification (deck p20) — no classification-split quota model exists (goals are single-number `api`/`apps`). **Phase 3.**
- Monthly quota model — no monthly quota at any tier. Phase 1 prorates annual ÷ 12. **Phase 3.**
- Age/sex demographic columns (deck p15–17) — **not on the user doc** per recon (`buildDocFields` at `functions/index.js:216–234` carries `careerLevel`, `unitId`, `unitName`, `branchId` only; no age/sex). Org structure renders counts + title + experience-from-`contractDate` + unit grouping; age/sex columns omitted. Re-confirm at build via grep; if CC finds the fields, include them, else drop silently.
- Kiosk/share-link reuse — kiosk endpoint carries SEC-008 (public/CORS-* unauthenticated, no rate limiting, `docs/audits/agencytrack-audit-2026-07-04.md:192`). Out of Phase 1.

---

## 3. Locked decisions

1. **Scope selector is role-driven.** Branch Manager → defaulted to own branch (own "agency"). Sales Manager / Tenant Admin / Platform Admin → branch picker (any branch in scope). Gate on `MANAGER_ROLES` (`App.jsx:33`); resolve BM's branch from the `branchId` custom claim (same pattern as `managerService.js:35–38`).
2. **Net Settled / % Objective Achieved = calendar-period net.** Sum `settledAPI` for policies **settled within the plan period, lapsed excluded** — the derivation already in `policiesDerivation.js:33` (lapsed excluded). Do **not** use the persistency-doc `netSettled` (that is a 12-month rolling window, `persistencyService.js:63–74` — wrong denominator for a production-vs-annual-quota deck).
3. **Monthly Quota (p9) = annual `branchGoals.api` ÷ 12, labeled "prorated."** No real monthly quota exists.
4. **Title label fallback = `levelTitle ?? careerLevel ?? role`** (existing display pattern at `MasterSheet.jsx:158`, `AgentDashboard.jsx:571`). Renders "Trainee Manager" where `careerLevel` carries it; falls to role label where blank. No new field.
5. **Period = granularity toggle.** `period = { year, granularity: 'quarter' | 'half', index }`. Quarter mode → Q1–Q4 rows; half mode → H1/H2 rows. Drives selector, window math, and the Period Metrics slide.
6. **Projected EOY (p9) = simple run-rate**, clearly labeled "run-rate projection": `actualToDate ÷ (elapsedDaysInPeriod ÷ totalDaysInPeriod)`. Persistency EOY projection: Phase 1 shows current % only (no auto-projection — `projectPersistency` is a what-if lever tool, not a run-rate extrapolator, `calculations.js:105–133`); label the projection column "—" or "current" for Phase 1.
7. **Phase 1 is client-only.** No new collection, no rules, no functions. Standard feature-branch review.
8. **Model = Opus 4.8** (standard feature build; no money-field writes, no rules).

---

## 4. Architecture — derive-model contract

Single hook, single math path. Every render target (dashboard, presentation mode, PDF) reads from this — numbers can never disagree across views.

**`src/hooks/useStrategicPlan.js`**

```
useStrategicPlan(branchId, period) -> {
  meta:        { branchId, branchName, authorName, period, generatedAt },
  agents:      AgentTrackerRow[],   // p5
  production:  ProductionSummary,   // p9
  periodMetrics: PeriodMetricsTable,// p18
  orgStructure: OrgStructure,       // p8/14-17
  recruitment: RecruitmentPipeline, // p6-7
  loading, error, empty
}
```

Assemble by **reusing** these existing pure functions / services (do not re-derive):
- Activity funnel + team totals: `computeFunnelRow` / `computeFunnelTotals` (`funnelModel.js:23–148`, `:181–185`).
- Branch windows (WTD/MTD/QTD/YTD): `deriveBranchWindows` (`MeetingMode.helpers.js:197–219`). Extend window keying to honor `period.granularity` (quarter vs half) — this is the one net-new window-math addition; keep it a pure helper.
- Unit rollups: `deriveUnits` (`MeetingMode.helpers.js:225–251`).
- Production 3-way: submitted via `extractTotalProductionCredit` (`teamRoster.js:56–58`); gross settled `settledAPI` / `settledApps` (`policiesDerivation.js:42`, `settlementService.js:54–57`); net settled = calendar-period settled minus lapsed (`policiesDerivation.js:33`).
- Persistency (branch): `aggregatePersistency` — sum numerators/denominators, never average percentages (`calculations.js:58–80`).
- Branch quota: `branchGoals/{year}` via `goalsService` (`goalsService.js:269–285`); unit quotas summable via `getUnitGoals` per UM uid.
- Roster / users (branch-scoped): `getTenantUsers` (branch filter, `managerService.js:35–38`).
- Recruitment: `recruitingService` — `recruitingCandidates` 8 ordered stages sourced→licensed (`recruitingService.js:29–50`); monthly counts `managerMonthlyRollups` (`firestore.rules:1393`).

**AgentTrackerRow** (p5 columns): agent name, experience (years, from `contractDate`), calls, contacts, fact finds, closing interviews, persistency %, APP quota, API quota, prod API submitted / gross settled / net settled, prod APP submitted / gross settled / net settled, API % obj achieved, APP % obj achieved. All present in source per recon; % obj achieved = net settled ÷ quota.

**Empty/partial handling:** every section renders its own loading / error / empty state (Nexus v2 four-states requirement). A branch with no recruiting candidates shows the recruitment section's empty state, not a broken table.

---

## 5. Component specs (slide-by-slide)

Location: `src/components/strategicPlan/`. One file per section (mirror `FunnelMeetingScene.jsx` single-file-scene pattern).

1. **Cover** — branch name, period (formatted per granularity), author, generated timestamp. Hero treatment (teal glass), per Nexus v2 top-card rule.
2. **AgentPerformanceTracker.jsx** — dense per-agent table; conditional formatting on % obj (red < 50%, amber 50–80%, green ≥ 80%), same banding as Master Sheet. Horizontally scroll-safe on the 18-column width. Drill: tap agent → existing agent drill-down.
3. **ProductionSummary.jsx** — three stacked tables (monthly, annual, persistency) matching p9: monthly quota (prorated) / avg monthly production / % achieved; annual quota / projected EOY (run-rate) / projected % ; persistency current + EOY column ("current" for Phase 1).
4. **PeriodMetrics.jsx** — goal vs actual for APPS / API / manpower + variance row, rows driven by the granularity toggle (Q1–Q4 or H1/H2).
5. **OrgStructure.jsx** — branch → units tree with per-unit advisor counts, admin count, and per-advisor rows (name, title via fallback label, experience). Renders **live units** (group roster on `unitId`), not the deck's fixed 2+2 template.
6. **RecruitmentPipeline.jsx** — candidate rows across the 8 stages with Y/N-style stage completion + hired status; objective header ("20 by end of 2026" style) from the recruiting objective if stored, else omit.

**Dashboard shell** `src/components/strategicPlan/StrategicPlanDashboard.jsx`: scope selector (role-driven), period selector with granularity toggle, section nav, "Present" button (→ presentation mode), "Export PDF" button. All sections stacked and drillable.

---

## 6. Presentation mode

Clone the MeetingMode shell into **`StrategicPlanMode.jsx`** — do **not** extend the existing meeting deck (different audience/order). Reuse:
- Scene-list assembly pattern from `deriveDeck` (`MeetingMode.helpers.js:457`).
- `AgendaRail` click-to-jump (`MeetingMode.jsx:716`), prev/next nav (`:970–995`), per-scene `presenterNotes` (`:676–692`).
- Full-screen high-contrast presentation-token surface (always-dark), keyboard-navigable (arrow keys).

Feed it the `useStrategicPlan` model (not a re-derive). One scene per Phase 1 section, in deck order (Cover → Agent Tracker → Production → Period Metrics → Org → Recruitment). Presenter notes optional per scene.

---

## 7. PDF export

**`src/components/strategicPlan/BranchPlanDocument.jsx`** — follow `AgentReportDocument.jsx` exactly:
- `@react-pdf/renderer`, **hex-only palette** mirroring light-mode Nexus tokens (react-pdf cannot resolve `var(--x)`; see `AgentReportDocument.jsx:16–20`).
- Single math path = the `useStrategicPlan` model passed in (no re-derivation in the document).
- Entry via `exportService.generateBranchPlanPDF()` (mirror `generateAgentPDF()` at `AgentReportDocument.jsx:22`).
- One page per section; page breaks between sections.

---

## 8. Design (Nexus v2)

Canonical tokens: `docs/design-system/tokens/app.css` (v2, AA-reconciled) + `brand.css`; rules in `redesign-addendum.md`. Satoshi + Cabinet Grotesk; no gradient buttons; 44px touch targets; every component handles loading/error/empty; no inline styles. Top summary card per section gets hero (teal glass); hero ink stays in hero panes (bidirectional ink guard). A Claude Design mockup prompt accompanies this dispatch for the dashboard + presentation-mode layout — CC follows the CD output for looks, source for schema.

---

## 9. Acceptance criteria

1. Branch Manager opens the dashboard, sees own branch's live plan across all five sections; no manual data entry required for Phase 1 sections.
2. Sales Manager / Admin can pick any in-scope branch and see the same.
3. Granularity toggle switches Period Metrics between Q1–Q4 and H1/H2 correctly; window math matches `deriveBranchWindows`.
4. % Objective Achieved = calendar-period net settled ÷ branch quota (verified against a seeded branch with known settled/lapsed policies).
5. Presentation mode: full-screen, keyboard-navigable, one scene per section, agenda rail jumps work.
6. PDF export produces a multi-page document, hex-only palette, numbers identical to the dashboard.
7. Every section renders loading / error / empty states.
8. No new Firestore collection, no rules change, no functions change (grep-confirm at PR).

---

## 10. Testing / smoke

- **Write-read-verify smoke** (production standard): log in as a seeded Branch Manager (managed foil from `tatillife_south`), open the dashboard, assert the Agent Tracker's net-settled total for one agent matches the seeded policy ledger (settled-in-period minus lapsed), reload, assert persisted render. Value-level assertion, account for History "K" abbreviation on values ≥ 1000.
- Toggle granularity, assert Period Metrics row count changes (4 ↔ 2) and totals reconcile.
- PDF: assert `generateBranchPlanPDF()` returns a document with the expected page count and one known figure.
- **Axe:** no NEW serious/critical violations vs main baseline (delta gate).

---

## 11. Rule 17 verification log (authoring-time)

| Claim | Source (recon-cited) |
|---|---|
| Branch quota exists as `branchGoals/{year}` | `goalsService.js:269–285` |
| Net-of-lapse derivation exists, lapsed excluded | `policiesDerivation.js:33` |
| Persistency-doc netSettled is 12-mo rolling (not used) | `persistencyService.js:63–74` |
| `deriveBranchWindows` gives WTD/MTD/QTD/YTD | `MeetingMode.helpers.js:197–219` |
| Funnel model + totals | `funnelModel.js:23–148`, `:181–185` |
| Title fallback pattern | `MasterSheet.jsx:158`, `AgentDashboard.jsx:571` |
| Recruiting 8-stage pipeline exists | `recruitingService.js:29–50` |
| MeetingMode scene/agenda/notes pattern | `MeetingMode.jsx:676–692`, `:716`, `:970–995` |
| PDF hex-only precedent | `AgentReportDocument.jsx:16–22` |
| No age/sex on user doc | `functions/index.js:216–234` (buildDocFields) |
| No branch-plan collection exists | full rules inventory `firestore.rules` |

CC re-verifies each file:line before writing; hard-stop and report if any has drifted.

---

## 12. Phase 2 preview (not this dispatch)

`branchPlans/{branchId}_{year}` collection (narrative + status + versioning, rules → human-merge) · PowerPoint export (`pptxgenjs`) · quotas-by-classification + monthly quota schema · optional manual overrides for projections. Deferred by design so the high-value read-only dashboard ships fast.

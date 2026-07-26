# AgencyTrack — Branch-Manager "Strategic Plan" · complete build handoff

Everything Claude Code needs to build the **Strategic Plan** surface into `Kelsean868/agencytrack`. Grounded against the repo at `main@cc9c339` (17 Jul 2026).

```
stratplan-handoff/
├── README.md                 ← you are here (the full spec)
├── CLAUDE_CODE_PROMPT.md     ← paste-ready kickoff prompt
└── mockups/                  ← runnable design board (source of truth for visuals)
    ├── AgencyTrack Strategic Plan v2.html   ← open in a browser / npx serve
    └── *.jsx                                ← design-canvas modules (reference, NOT production code)
```

**Open the mockup:** serve `mockups/` (`npx serve`) and open the HTML. Pan = drag, zoom = ⌘-scroll, Focus (⤢) an artboard for fullscreen. Four artboards: dashboard light (QUARTER granularity), dashboard dark (HALF), and two presentation-mode slides.

---

## 1 · What it is

A Branch Manager's annual operating document as one live, scrollable surface — replacing the paper "strategic plan" binder — plus a **Presentation mode** for projecting it to leadership. Read-only aggregation: **no new Firestore collections are required**; every number derives from data the manager dashboard already reads.

Two views:

1. **Dashboard** — control bar (branch selector · year · QUARTER/HALF granularity toggle · **Present** · **Export PDF**), then six stacked sections, each opening on ONE teal-glass summary card (the per-screen glass budget applies per *section* here — this is a document surface, deliberate):
   - **01 Cover** — branch, period, author, generated timestamp, 3 headline KPIs
   - **02 Agent Performance Tracker** — dense ~18-col table: activity funnel + API/APP as Submitted / Gross Settled / Net Settled + % of prorated objective, red/amber/green banded
   - **03 Production Summary** — monthly prorated quota · annual quota vs run-rate EOY projection · persistency vs the 85% floor
   - **04 Period Metrics** — goal vs actual + variance for APPS / API / manpower; rows are Q1–Q4 or H1/H2 per the granularity toggle
   - **05 Org Structure** — BM + admin → 3 unit cards (UM, advisor rows with band dots + YTD net)
   - **06 Recruitment Pipeline** — candidates across the 8 stages sourced→licensed, completion %, HIRED / IN PROGRESS / DROPPED
2. **Presentation mode** — full-screen, always-dark, high-contrast; one section per slide; left agenda rail (click-to-jump); 48px prev/next; ESC exits. Pres tables drop the CLOSE% / NTU / PERS columns and scale type up (see `SP_SZ.pres` in `stratplan-shared.jsx`).

## 2 · Where it plugs in

- **Nav + render switch:** `src/components/dashboard/ManagerDashboard.jsx` — add to `NAV_ITEMS` under the Operations section:
  `{ id:'strategic-plan', label:'Strategic Plan', tabId:'strategic-plan', Icon: FileBarChart, roles:['branch_manager','sales_manager','tenant_admin','platform_admin'] }`
  and `{activeTab === 'strategic-plan' && <StrategicPlanTab />}` in the render switch. BM is a producing manager → also add the row to the `producingManager` config in `src/components/shell/navConfig.js` (route-faithful, same tabId).
- **Presentation mode** replaces the dashboard while open — copy the **MeetingMode pattern exactly**: early `return <StrategicPresentMode …/>` in ManagerDashboard, `useFocusTrap` (`src/hooks/useFocusTrap.js`), and the `startMeetingBtnRef` focus-return-on-close fix (the trigger unmounts; the owner of the unmount restores focus).
- **New files:** `src/components/manager/stratplan/` — `StrategicPlanTab.jsx` (control bar + sections), one component per section, `StrategicPresentMode.jsx`, plus `src/hooks/useStrategicPlan.js` (the composing data hook, modeled on `src/hooks/useBranchOverview.js`: parallel reads on mount, memoized derivations, `reload()` token, §1 error-card + Retry).

## 3 · Data sources (all existing)

| Need | Source |
|---|---|
| Users / units / org | `getTenantUsers` (`src/services/managerService.js`); `role`, `unitId`, `unitName`, `contractStartDate`; `getUnitDisplayName` + `initials` (`src/utils/formatters.js`) |
| Submissions (funnel + submitted API/APPS) | `getAllYTDSubmissions` (managerService); fields via `extractFields` / `extractTotalProductionCredit` (`src/utils/extractFields.js`): `totalTelAttempts`, `telContacts`, `f2fAttempts`, `ffiConducted`, `ciConducted`, `applicationsSold` |
| Settled API/APPS | settlement docs (`settledAPI` / `settledApps`, `periodKey` YYYY-MM) — same map `src/lib/teamRoster.js#assembleRoster` consumes |
| Row assembly | **reuse `src/lib/teamRoster.js`** (`assembleRoster`, `computePctOfGoal`, `containingMonth`, `sortRows`) — extend the row with funnel counts rather than forking |
| Goals / objectives | `getBranchGoals`, `getUnitGoals`, `getCompanyMinimums` (`src/services/goalsService.js`); per-agent floors via `resolveAnnualAPIFloor` (`src/utils/tenureFloors.js`) |
| Persistency | `getPersistencyMapForYear` (`src/services/persistencyService.js`); aggregate **sum-then-divide** via `aggregatePersistency` (`src/lib/persistency/calculations.js`) — docs store 0–1 decimals, ×100 only at render |
| Recruitment | `src/services/recruitingService.js` — `RECRUITING_STAGES` ({key,label,short}), `getCandidatesForBoard`, `stageIndex`, `daysInStage`, `isStalled`; stage-dot visuals already exist in `src/components/manager/recruitingVisuals.jsx` — reuse |
| Variance / projection math | `src/utils/planVariance.js`, `src/lib/yearPlanProjection.js`, `src/lib/monthlyPlanMath.js` |
| Currency | `formatCompactTTD` (`src/utils/formatters.js`) — matches the mockup's `ttd()` exactly |
| Count-ups, reduced motion | `src/hooks/useCountUp.js`; gate all motion on `prefers-reduced-motion` (repo idiom in index.css) |

**Derivation notes**
- *% objective achieved* = net settled YTD ÷ (annual objective × elapsed-year fraction). Banding: ≥100 success/`ON PACE` · 85–99 warning/`AT FLOOR` · <85 danger/`BELOW` (mirrors `SP_ELAPSED`/`spBand` in the mockup).
- *Submitted* = `extractTotalProductionCredit` over submissions. *Gross settled* = settlement docs. *Net settled* = gross − clawback/NTU adjustments — confirm the exact net derivation against `src/lib/policyLedgerDerivation.js` / `src/utils/clawbackClock.js` before wiring (open question #1).
- *Run-rate EOY* = YTD net ÷ months elapsed × 12; *monthly prorated quota* = annual ÷ 12.
- Q3-in-progress rows show actuals muted with an `IN PROGRESS` chip; future rows show `—` + `UPCOMING`; variance renders only for closed periods.

## 4 · Export & controls

- **Export PDF:** follow the `generateBranchPDF` pattern in `src/services/exportService.js` — dynamic-import `@react-pdf/renderer`, new `StrategicPlanDocument` beside `src/components/productionReport/ManagerReportDocument.jsx`; the calling view passes already-derived rows (no refetch in the exporter). Filename `AgencyTrack_Strategic_Plan_{branch}_{date}.pdf`.
- **Controls:** branch selector (SM/TA see all branches; BM locked to own — mirror `SmLeaderboardView`'s scope pattern), year, QUARTER/HALF segmented toggle (persist per-user like `useMenuLayout` does, or session state — designer's default: session). All controls ≥44px (`min-h-[44px]`, repo idiom).

## 5 · Design contract (from the mockups)

Tokens only — map every raw hex/px in the mockup JSX to `src/index.css` Nexus tokens; never introduce a new color. Light teal `#01696F` on warm neutrals; dark base `#1a1612` with lifted teal `#4AB5B8`. Glass hero recipe per section summary (`GlassHero` in `stratplan-shared.jsx` carries the exact light/dark values); hero ink (`#013D40` / `#E4F5F5`) never leaves the glass panes. Mono uppercase eyebrows (`01 · STRATEGIC PLAN`), numbered sections. `TTD` compact everywhere. No gradient buttons, no emoji (★ recognition / ✓ checks only), gold strictly for recognition (★ TOP PRODUCER). Presentation palette = `SP_PRES` in `stratplan-scenes.jsx`. Light + dark for the dashboard; presentation is dark-only. Empty/loading/error states follow the repo's PanelSkeleton / error-card + Retry idiom.

## 6 · Build order (slices)

1. Nav entry + `StrategicPlanTab` shell + `useStrategicPlan` hook + control bar + Cover hero
2. §02 Agent Tracker (extend teamRoster assembly; banding)
3. §03 Production Summary + §04 Period Metrics (granularity toggle)
4. §05 Org Structure + §06 Recruitment (reuse recruitingService + recruitingVisuals)
5. Presentation mode (MeetingMode pattern; keyboard: ←/→/ESC; agenda rail)
6. Export PDF (StrategicPlanDocument)

## 7 · Open questions (resolve before/while building)

1. **Net-settled derivation** — exact clawback source (see §3 note).
2. **Manpower goals** — no per-period manpower goal exists in the goals docs today; add a `manpower` field to the branch goals doc (goalsService) or company config, else hide the manpower variance column and show actual only.
3. **Quarterly APPS/API goals** — branch goals are annual (`teamGoalDoc.api`); quarter/half goals in the mockup assume even proration unless a per-period plan exists (`commitPlanService` / Game Plan year docs may supply real ones for producing managers).
4. **Sales-manager scope** — mockup is BM-scoped; SM view = branch picker, otherwise identical.

## Target stack

React 19 · Vite · Tailwind 3.4 (`darkMode:'class'`) + `@layer components` in `src/index.css` · lucide-react · Firebase multi-tenant `tenants/{tenantId}/…` · no router lib (tab switch in ManagerDashboard) · vitest (explicit `import React` in tests — banked rule) · CI a11y gate. WCAG 2.2 AA in both modes.

> The `mockups/*.jsx` are **design reference, not production code** — recreate in the repo's React/Tailwind, lifting exact values. Start from `stratplan-shared.jsx` (data shapes, sizes, glass recipe, banding).

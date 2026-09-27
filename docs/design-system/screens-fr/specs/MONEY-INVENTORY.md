# AgencyTrack — Agent-Facing Money Calculator Feature Inventory

Repo: `C:\Projects\AgencyTrack` (branch `main`). Read-only research pass. All paths are
relative to the repo root unless a drive letter is shown. Labels are quoted verbatim
where the UI renders them; formulas are given in plain maths with the constant and its
source file.

---

## SPECIAL QUESTIONS (A–D)

### A. Persistency "projected" — what, from what, as-of what date; is 1 Oct 2026 (2026-10) tied to anything; any flag still to flip?

`src/lib/persistency/persistencyOutlook.js` → `buildPersistencyOutlook({ policies, records, today })`
builds **five distinct figures**, not one "projected" number:

1. **`confirmed`** — the most recent *saved* `persistencyRecords` doc (manager/agent-entered via
   `savePersistency`), i.e. the last month someone actually confirmed.
2. **`derived`** — `deriveFromLedger()`'s (src/lib/persistency/deriveFromLedger.js) computation
   straight off the agent's own policy ledger for the *current* report month, no manual save
   required.
3. **`estimateToday`** — `derived` re-run "as of right now" (today's date passed in as `today`),
   used for the live in-month reading before month-end.
4. **`ifPendingSettle`** — a what-if: derived figure assuming every currently-pending policy settles.
5. **`gateMonth`** — the specific month whose persistency % gates an active tiered campaign/award
   (via `campaignPersistencyReading.js` / `persistencyPctForGate`), independent of the calendar
   "current" month.

The **"AS OF" date** for `estimateToday`/`derived` is the `today` parameter the caller supplies
(`getTodayTT()` in production — Trinidad-local "now"), not a hard-coded date. The headline
month itself is whatever `monthKey` the caller resolves as "current" (typically the latest
month with ledger activity).

**Nothing in the codebase is tied to 1 October 2026 / "2026-10".** An exhaustive
`Select-String -Pattern '2026-10|October 2026|1 October'` across the persistency/financing/goals
tree returned **zero matches**. The only hard-coded month boundary anywhere in the persistency
stack is:

```js
// src/lib/persistency/model.js
export const PERSISTENCY_MODEL_24M_EFFECTIVE_FROM = '2026-09';
```

The model comment explicitly documents the design decision: the 24-month ("Tatil24") model
switches on **purely by report `monthKey >= '2026-09'`** — there is **no tenant/company flag**
gating it, by deliberate architectural choice (comment in `model.js` explains this was
chosen so the switch cannot drift out of sync between tenants or be half-flipped). Since
today's date is **2026-09-27**, every report month from September 2026 onward is **already**
on the 24-month model — there is nothing left to flip for the model switch to be "live"; it
already is, automatically, driven only by calendar month.

Separately, `PERSISTENCY_OUTLOOK_STALE_DAYS = 45` (in `persistencyOutlook.js`) controls when
the hero shows a "stale data" state — unrelated to the 24-month switch.

The only other user-facing toggle in this stack is the **annuity missed-premium rule**
(`AnnuityRuleSwitch.jsx` / `annuityMissedPremiumRule`), which is a **per-agent/per-policy
display convention** (`ignore` default vs `lapse`, 60-day grace), not a company-wide flag and
not related to the 24-month switch — the two axes are deliberately named/kept apart in code
comments to avoid confusion.

**Verdict: no flag needs flipping.** The 24-month model and the "projected" (`estimateToday`)
figure are both already live, driven only by `monthKey >= '2026-09'` and by `today`.

### B. Monthly persistency history available to chart — what/how many months/YoY?

`src/components/agent/PersistencyTab.jsx` calls
`persistencyService.getAgentHistory(tenantId, uid, 12)` — **the last 12 months** of saved
`persistencyRecords` docs for that agent (one Firestore doc per `monthKey`, fields per the
model: `grossSettled`, `notTakens`, `decreases`/`increases` (24-month only), `lumpsums`,
`lapses`, `reinstatements`, plus computed `persistency`). This feeds a Recharts `LineChart`
labelled **"Monthly trend"** — X axis = month abbreviation, Y axis = persistency %, one line.

`getAvailableMonths()` (persistencyService.js, ~lines 220–260) enumerates which `monthKey`s
have a saved doc at all (used to populate the month picker on the confirm form).

**No year-over-year / same-month-last-year comparison exists anywhere in this stack.** There
is no query, field, or component that reads e.g. "Sep 2025 vs Sep 2026" — the only comparison
axis is the flat 12-month trailing trend line, plus the five cross-sectional "outlook" figures
in Question A.

### C. Commission back-solve — TTD X this month → what does the app say you need?

Two calculators do this, sharing one modal-mix formula from
`src/components/goals/CommissionPlayground/utils/commissionMath.js`:

**Forward** (`commissionThisMonth`): given API written this month and a mode mix, the immediate
first-payment commission is

```
commission = Σ_mode ( API × modeMix[mode] × commissionRate/100 × FIRST_PAYMENT_RATIO[mode] )
```
where `FIRST_PAYMENT_RATIO = { annual: 1.0, semiAnnual: 0.5, quarterly: 0.25, monthly: 1/12 }`
(only the first-due installment counts as this month's commission — an annual-pay policy pays
its whole first-year commission up front, a monthly-pay policy pays 1/12 of it).

**Reverse** (`reverseCalc` / the "I want TTD X" flow, driven from
`GoalDecompositionTab.jsx`): solves the same equation for API —

```
requiredAPI = desiredCommission ÷ ( Σ_mode ( modeMix[mode] × FIRST_PAYMENT_RATIO[mode] ) × commissionRate/100 )
```
then chains onward through the shared `goalDecomposition.js` engine (see Question D) to turn
that API into applications, CIs, FFIs, dials and prospects using the agent's average-policy-size
assumption and their ratio set. `commissionRate` is per-agent (`userProfile.commissionRate`,
company-set, product/year not separately modeled in this stack — one flat rate per agent is
what the calculators read; the mode mix is what varies the *timing*, not the *rate*).

The **mode mix** itself is user-adjustable via `ModeMixSlider.jsx` (four sliders that must sum
to 100%, rebalanced by `modeMixBalancer.js`) and can be auto-populated from the agent's own
historical mode split, with company defaults as fallback (mirrors the same
history-then-default pattern as Question D's ratios).

`CashFlowChart.jsx` + `cashFlowStacking.js` (`buildStackedData`) turn the same inputs into a
12-month **stacked bar + cumulative line** showing when each mode's commission actually lands
(annual pays out once in month 1; monthly pays 1/12 every month; etc.) — this is the visual
answer to "when do I actually get paid," downstream of the back-solve.

### D. Goals "budget → inventory" — how a goal/budget becomes activity inventory, and where the ratios come from

`src/utils/goalDecomposition.js` is **the single shared decomposition engine** used by both the
Commission Playground's `GoalDecompositionTab` and Game Plan v2's `SuggestedWeekCard`. The chain,
in order:

```
income goal (after-tax, from Money Needs or typed directly)
  → pre-tax income   = grossFromNet(afterTaxIncome, DEFAULT_PAYE_CONFIG)      [payeEngine.js]
  → 1st-year commission needed = pre-tax income (this-year's slice)
  → persistency-adjusted commission = commission ÷ persistencyRate            (must OVER-write to net the target after lapses)
  → API to WRITE (submitted) = commission ÷ (commissionRate/100 × modal-mix weighted first-payment ratio)
  → API to SETTLE = API to write ÷ placementRate (or 1 if not modeled)
  → applications = API to settle ÷ avgPolicyAPI
  → CIs (Closing Interviews) = applications ÷ ciToSaleRatio
  → dials/FFIs = CIs ÷ dialsToCIRatio  (chained: FFI → CI → sale)
  → prospects/names needed = dials ÷ prospectRatio (contact-rate assumption)
```

**Ratio provenance — three-tier fallback, in this order:**
1. **Agent's own history** — `deriveRatiosFromHistory()` computes CI-to-sale and dials-to-CI
   ratios from the agent's **last 12 *submitted* weekly activity logs**, but only kicks in once
   the agent has **≥ 8 submitted weeks** of data (below that, too noisy to trust).
2. **Company floor / defaults** — `DEFAULT_WEEKLY_ACTIVITY_FLOORS` and
   `DEFAULT_TENURE_API_FLOORS` (`src/utils/weeklyActivityFloors.js`,
   `src/utils/tenureFloors.js`), merged over the tenant's `config/companyMinimums` doc
   (`goalsService.getCompanyMinimums`) — tenant-set values win, missing keys fall back to the
   built-in defaults (annual API floor 200,000 TTD flat fallback, 42 apps, persistency = the
   award **gate** 90% by default, not the at-risk floor 80%).
3. **Hard-coded engine defaults** — when neither of the above exists, `goalDecomposition.js`'s
   own constants are used as the last resort.

The **budget/annual-API-floor per agent** is *tenure-banded*: `resolveAnnualAPIFloor()` reads
the agent's `contractStartDate` against `tenureApiFloors` (a step table by tenure band), falling
back to a flat `FLAT_ANNUAL_API_FALLBACK` (200,000 TTD) if the contract date is missing/invalid.
Apps and Persistency floors stay flat (not tenure-banded) at 42 / gate-% respectively.

A manager-set **locked target** (`targetLocked: true` on the tenant's `goals/{agentId}` doc)
raises the agent's *effective* floor to `max(companyFloor, managerLockedTarget)` — a
"recommended" (`targetLocked: false`) target is advisory only and never blocks the agent's save
(`goalsService.setGoals`, enforced with explicit thrown errors quoting which source — "company
minimum" vs "manager locked target" — set the binding floor).

---

## GOALS

### GapAnalysisPanel — `src/components/goals/GapAnalysisPanel.jsx`
- **Mount**: agent's Goals tab in `AgentDashboard.jsx` ("Goals" tab); also mounted at the top of
  the manager-facing `src/components/manager/GoalsPanel.jsx` ("Goal Cascade" title override) for
  Self/Agent/Unit/Branch/SM sub-tabs.
- **Roles**: Agent, Unit Manager, Branch Manager, Sales Manager, Tenant Admin, Platform Admin
  (anyone who can view a goal hierarchy).
- **Inputs**: none directly — pure display over the `hierarchy` prop (from
  `goalsService.getGoalHierarchy`) and `ytdTotals`.
- **Outputs**: 5-layer goal cascade — "Company Floor" / "Sales Manager Target" /
  "Branch Target" / "Unit Target" / "Personal Commitment" — each showing API + Apps (+ FFI/CI/
  dials where set), and a gap read against `ytdTotals` (current YTD API/Apps vs. each tier).
- **Charts**: none (bar/cascade rows, not a chart component).
- **States**: loading skeleton; `error` prop renders an inline message; empty tiers render "—".

### DerivedIncomePanel — `src/components/goals/DerivedIncomePanel.jsx`
- **Mount**: Goals tab (agent), and manager `GoalsPanel` → Self sub-tab, gated `isProducing`.
- **Inputs**: none (reads `hierarchy`, `ytdTotals`, `commissionRate`).
- **Outputs**: derives an **implied income** figure from the agent's Personal Commitment API ×
  `commissionRate`, cross-referenced against YTD actuals; shows progress toward that derived
  income.
- **States**: `loading` prop.

### AwardsReachPanel — `src/components/goals/AwardsReachPanel.jsx`
- **Mount**: Goals tab; manager `GoalsPanel` Self sub-tab (`isProducing` only).
- **Inputs**: none directly (reads `submissions`, `confirmedSettlements`, `agentProfile`).
- **Outputs**: "how close am I to the next award tier" read against submitted/settled API,
  cross-checked with persistency gate eligibility.

### MdrtTracker — `src/components/goals/MdrtTracker.jsx`
- **Mount**: Goals tab; manager `GoalsPanel` Self sub-tab (`isProducing`).
- **Inputs**: none (reads `ytdTotals`).
- **Outputs**: progress toward MDRT (Million Dollar Round Table) production qualification
  threshold, using YTD commission/API totals.
- **States**: `loading`.

### RecommendLockDrawer — `src/components/goals/RecommendLockDrawer.jsx`
- **Mount**: manager `GoalsPanel.jsx` → `AgentGoalsTab` → "Set target"/"Edit target" button opens
  this drawer per-agent.
- **Roles**: any manager role that can set targets for an agent (Unit/Branch/Sales Manager,
  Tenant Admin).
- **Inputs**: "Annual API (TTD)" (number, currency), "Annual Apps" (number), "Annual
  Persistency %" (number), "Weekly API (TTD)" (number, currency); a **Recommend vs Lock**
  toggle — "Recommend" (`targetLocked: false`, advisory) or "Lock" (`targetLocked: true`,
  binding floor the agent's own commitment must meet or exceed).
- **Actions**: "Save" → `goalsService.setGoals` with the four target fields + `targetLocked`.
- **States**: `saving` spinner; drawer closes on completed save (parent re-fetches).

### GoalsCelebration — `src/components/goals/GoalsCelebration.jsx`
- Confetti/celebratory overlay triggered when a goal/award threshold is newly crossed. Pure
  presentational; no inputs/writes of its own.

### LedgerLoadError — `src/components/goals/LedgerLoadError.jsx`
- **Mount**: manager `GoalsPanel.jsx` (top of panel) when `ownProduction.policiesError` is set.
- **Action**: "Retry" button → calls `onRetry` (`own.loadPolicies`) to re-fetch the ledger.

### GoalCarousel — `src/components/dashboard/GoalCarousel.jsx`
- **Mount**: agent dashboard home/hero area (role-hero region), separate from the Goals tab.
- **Inputs**: none — pure display, tabbed by period.
- **Tabs (verbatim labels)**: "Week", "Month", "Quarter", "YTD" (targetSuffix strings: "weekly
  target", "monthly target", "quarterly target", "annual personal commitment").
- **Outputs per tab**: current value (`formatCurrency`), "of {target} {targetSuffix}", a
  progress bar (`bar-fill` width = `min(max(percent,0),100)%`), a status line, and a
  `GoalDonut` (circular progress) per period.
- **Behavior**: auto-rotates every `AUTO_ROTATE_MS = 6000`ms through the 4 tabs unless
  `prefers-reduced-motion`, paused, or `autoRotate={false}`; pauses on hover/focus and resumes
  `RESUME_DELAY_MS = 6000`ms after both leave, preserving whichever tab the user was on.
- **Accessibility**: full ARIA tablist/tabpanel wiring, arrow-key/Home/End navigation.

### goalsService.js — `src/services/goalsService.js`
- `getGoals(tenantId, agentId)` — reads `tenants/{t}/goals/{agentId}`.
- `getGoalsForAgents(tenantId, agentIds)` — batched (≤30 ids) `documentId() in` read for roster
  views; per-batch failure is swallowed (partial results still returned).
- `getCompanyMinimums(tenantId)` — reads `tenants/{t}/config/companyMinimums`, defaults:
  `annualAPI: 200000`, `annualApps: 42`, `persistency: PERS_GATE_PCT` (the award-eligibility
  gate, i.e. 90 — a deliberate choice, NOT the at-risk `PERS_FLOOR`), plus merged
  `weeklyActivityFloors` and `tenureApiFloors` defaults.
- `setCompanyMinimums(tenantId, data, updatedBy)` — tenant_admin write; validates
  `annualAPI` positive and ≤ 10,000,000 TTD; validates `weeklyActivityFloors` (non-`api` keys
  must be whole numbers, `api` must be positive); `workingDaysPerWeek` must be 5 or 6.
- `setGoals(tenantId, agentId, data, setBy, setByName)` — writes manager `target*` fields
  (requires `targetLocked` alongside them) and/or agent `personal*` fields. **Personal writes
  are floor-enforced**: `personalAnnualAPI` must be ≥ `max(tenureFloor, lockedManagerTarget)`
  else throws `Annual API must be at least TTD {floor} ({source})` naming the binding source;
  same pattern for `personalAnnualApps` (vs `mins.annualApps`) and
  `personalAnnualPersistency` (vs `mins.persistency`, in %). Also accepts CSV-import audit
  fields (`csvImportBatchId`, `importedFromCsv`) and the 9 "Playground assumption" fields
  (`playgroundIncomeGoal`, `playgroundTaxRate`, `playgroundRenewalIncome`,
  `playgroundCommissionRate`, `playgroundAvgPolicyAPI`, `playgroundPersistencyRate`,
  `playgroundCiToSaleRatio`, `playgroundDialsToCIRatio`, `playgroundProspectRatio`).
- `getUnitGoals` / `setUnitGoals`, `getBranchGoals` / `setBranchGoals`,
  `getSalesManagerGoals` / `setSalesManagerGoals` — same shape (api, apps, ffiConducted,
  ciConducted, dials, `locked` boolean) at each roll-up tier.
- `getSalesManagerUid(tenantId)` — resolves the tenant's SM uid via a Cloud Function
  (`resolveSalesManagerUid`), bypassing client-side security rules.
- `getGoalHierarchy(tenantId, unitId, year, agentId, smUid)` — assembles the full 5-layer
  cascade (companyFloor, branchTarget, salesManagerTarget, unitTarget, personal) in one call,
  each sub-fetch independently `.catch(() => null)`-guarded so one missing doc doesn't blank
  the whole cascade.

### manager/GoalsPanel.jsx (the manager-side Goals PAGE mount)
- **Sub-tabs (verbatim)**: "Self", "Agent", conditionally "Unit" (unit_manager+), "Branch"
  (branch_manager/sales_manager/tenant_admin/platform_admin), "SM Target" (sales_manager/
  tenant_admin/platform_admin).
- **Self tab**: mounts `CommissionPlayground` (as `isManagerSelf`) + the manager's own
  "Your Personal Annual Target" card (Annual API, Annual Apps, "Last updated" date) +, if the
  manager role is itself producing (unit/branch manager), `DerivedIncomePanel` /
  `AwardsReachPanel` / `MdrtTracker`.
- **Agent tab** (`AgentGoalsTab`): one expandable row per direct agent, each showing a
  **Status chip** ("Above floor" / "Below floor" / "Not set"), **"Game Plan committed"** badge
  when `gamePlanCommitted === true`, and **"Locked"/"Suggested"** badge for any manager target
  set. Expanded form: "Annual API (TTD)", "Annual Apps", "Annual Persistency %" (all
  live-validated against the agent's tenure-resolved floor with an inline
  `<AlertTriangle> {field} below company minimum` warning), "Monthly API Target", "Quarterly
  API Target" (both optional), "Weekly API (TTD)", "Weekly Apps", "Weekly Dials", "Weekly FFI",
  and a free-text "Notes" (max 300 chars). "Save Goals" button writes via `setGoals`.
  Rows sort exception-first: unset → below-floor → above-floor. Below-floor agents auto-expand
  on load.
- **Unit/Branch/SM tabs**: each is a `GoalLevelForm` — "Annual API (TTD) *", "Annual Apps *"
  (required), "FFIs (optional)", "CIs (optional)", "Dials (optional)", plus a
  **Recommend/Lock** toggle (`LockToggle`) whose copy differs by tier ("Agents' commitments
  must meet or exceed this unit target" when locked, vs. "Suggested target — a guide, not a
  binding commitment" when not).

---

## COMMISSION (Commission Playground)

### CommissionPlayground — `src/components/goals/CommissionPlayground/index.jsx`
- **Mount**: Goals tab (agent, standalone card) and manager `GoalsPanel` → Self tab
  (`isManagerSelf` prop suppresses agent-only writes).
- **Tabs**: Goal Decomposition (`GoalDecompositionTab.jsx`) and Modal Targeting
  (`ModalTargetingTab.jsx`), switchable via `TabPills`.
- **Persisted assumptions**: reads/writes the 9 `playground*` fields on the Goals doc via
  `goalsService.setGoals`/`getGoals`, plus a `localStorage` fallback key
  `agencytrack-playground-income-goal` (`PLAYGROUND_INCOME_GOAL_KEY`) for the income-goal input
  before a save.
- **Saved scenario chips** (`SavedScenarioChips.jsx`): lets the agent save/recall named
  scenario snapshots of their assumption set (mode mix, ratios, avg policy size) without
  overwriting the "live" saved goal.

### GoalDecompositionTab — `.../CommissionPlayground/tabs/GoalDecompositionTab.jsx`
- **Inputs**: "Income goal" (TTD, after-tax, annual — the entry point of the Question-D chain),
  "Tax rate" (%, feeds `grossFromNet`/PAYE reversal — though the canonical bracket table lives
  in `payeEngine.js`'s `DEFAULT_PAYE_CONFIG`), "Renewal income" (TTD, subtracted before solving
  for new first-year commission needed), "Commission rate" (%), "Average policy API" (TTD),
  "Persistency rate" (%), "CI-to-sale ratio", "Dials-to-CI ratio", "Prospect ratio" — each field
  pre-fills from the agent's saved `playground*` value, else from
  `deriveRatiosFromHistory()` (≥8 submitted weeks), else company floor/default.
- **Outputs**: API to write, API to settle, Applications needed, CIs needed, Dials/FFIs needed,
  Prospects/names needed — the full inventory chain from Question D, each shown with its
  intermediate value.
- **Actions**: "Save assumptions" (writes the 9 `playground*` fields); scenario save/recall via
  `SavedScenarioChips`.
- **Insight cards** (`InsightCard.jsx`): contextual call-outs, e.g. flagging when the derived
  ratio differs materially from the company default, or when history is too thin (<8 weeks) to
  derive from.

### ModalTargetingTab — `.../CommissionPlayground/tabs/ModalTargetingTab.jsx`
- **Inputs**: "This month's commission target" (TTD — the reverse-solve entry point for
  Question C), the four **mode-mix sliders** ("Annual", "Semi-Annual", "Quarterly", "Monthly" —
  percentages that must sum to 100%, rebalanced by `modeMixBalancer.js` when one is dragged).
- **Outputs**: **Required API** (via `reverseCalc`), then `CommissionBreakdownTable.jsx` — one
  row per mode showing "Mode", "Mix" (%), "API Required" (rounded to nearest 10 TTD),
  "Commission" (rounded to nearest whole TTD) — and `CashFlowChart.jsx`, a Recharts
  `ComposedChart`: stacked bars per mode (Annual/Semi/Quarter/Monthly, 12-month X axis
  Jan–Dec) plus a dashed **cumulative** line, tooltip breaking out each mode's contribution +
  running cumulative total.
- **Formula constants**: `FIRST_PAYMENT_RATIO = { annual: 1.0, semiAnnual: 0.5, quarterly: 0.25,
  monthly: 1/12 }` (commissionMath.js). `cashFlowStacking.buildStackedData` distributes each
  mode's annualized commission across the 12 months independently (annual pays month 1 only,
  semi pays months 1 & 7 at half each, quarterly pays months 0/3/6/9 at a quarter each, monthly
  pays 1/12 every month) — rounded per-component (max ±2 TTD drift vs. the exact-float
  `cashFlowForecast` used elsewhere, documented and covered by a parity test).

### commissionAnchor.js / CommissionAnchorStrip.jsx — `src/utils/commissionAnchor.js`, `src/components/agent/CommissionAnchorStrip.jsx`
- **Mount**: persistent strip on the agent dashboard (cross-tab anchor showing "where you stand"
  on commission this month at a glance).
- **Inputs**: none (pure display).
- **Outputs**: current-month commission run-rate anchored against the agent's target,
  typically a compact "TTD X of Y" readout with a status color.

---

## GAME PLAN (GamePlanV2)

### GamePlanV2 hub — `src/components/dashboard/GamePlanV2/index.jsx`
- **Mount**: agent dashboard "Game Plan" tab.
- **Structure**: a 3-step rail (`StepRail.jsx`) — Step 1 "Money Needs", Step 2 "Monthly Plan",
  Step 3 "Review & Commit" — each step gated on the previous being filled
  (`yearPlanFilled`, `monthlyPlanFilled`).
- **Feature flag**: `VITE_GAME_PLAN_LOOP_ENABLED` (`GAME_PLAN_LOOP_ENABLED`) — gates the
  suggest-back loop (manager suggestions surfaced to the agent via `PlanSuggestionsCard`).
- **`PlanAnchorStrip.jsx`**: sticky header showing the current Personal Commitment / progress.
- **`PlanCascade.jsx`**: the same 5-layer goal hierarchy visual as `GoalsCascade` (Company
  Floor → Sales Manager Target → Branch Target → Unit Target → Personal Commitment), reused
  inside the commit flow.

### PlanSuggestionsCard — `.../GamePlanV2/PlanSuggestionsCard.jsx`
- **Mount**: Game Plan hub, "From your manager" card.
- **Purpose**: shows plan-level suggestions an upline manager raised on this agent's plan (the
  manager→agent "suggest-back" loop, gated by `GAME_PLAN_LOOP_ENABLED`).
- **Data**: `listPlanSuggestions({tenantId, agentId})`; unread (`status: 'open'`) items show a
  pulsing dot and an "{n} new" badge; simply viewing the card best-effort acks them
  (`markSuggestionSeen`) so the emphasis clears next load — advice only, never blocks the
  agent's own commit.
- **States**: renders **nothing** while loading, when empty, or on a read failure — "quiet by
  design," no nagging zero-state or error alarm.
- **Privacy**: `data-clarity-mask="True"` — masked from session-replay tooling since it surfaces
  financial-plan commentary.

### SuggestedWeekCard — `.../GamePlanV2/SuggestedWeekCard.jsx`
- Runs the shared `goalDecomposition.js` backward-solve (Question D chain) at **weekly**
  granularity to produce a "suggested week" of activity (dials/FFIs/CIs/apps), with a floor vs.
  derived resolution mode (uses the agent's own ratios when available, else floors) and
  pace-tracking against the committed weekly plan.

### PlanCommitCard / ReviewCommitModal — `.../GamePlanV2/PlanCommitCard.jsx`, `ReviewCommitModal.jsx`
- **Modal flow (4 views)**: **review** → **consequence** → **confirm** → **done**.
  - *Review*: "Annual API target" hero (`formatCurrency(yearPlanTotalAPI)`), derived apps count
    via `deriveAnnualApps(totalAPI, avgPolicyAPI)` ("{n} apps · avg {avg} per policy"), a by-line
    breakdown (Life/A&H/General), a 12-month "Monthly shape" grid (Jan–Dec, rounded TTD), and
    inline nudges ("Plan not allocated yet → Go to Year Plan", "Monthly Plan not drafted →
    Go to Monthly Plan") when a prior step is incomplete.
  - *Consequence* ("What committing means"): explains committing sets the agent's Personal
    Commitment — "No manager approval needed. Your managers can see your commitment once it's
    set, but only you can change it." — plus the `GoalsCascade` 5-layer visual.
  - *Confirm* ("Confirm commitment"): recap + hard **floor validation** on submit —
    `BelowApiFloorError` ("Plan is below your API floor... Raise it in Money Needs"),
    `BelowAppsFloorError` ("Plan is below the apps floor... Plan more or smaller policies, or
    raise your API in Money Needs"), `AvgPolicyMissingError` → inline "Avg policy (TTD)" capture
    field that saves to `playgroundAvgPolicyAPI` via `setGoals` and re-attempts the commit.
  - *Done* ("Plan committed"): confirmation with commit date (Trinidad-local,
    `America/Port_of_Spain`), a "3 / 3 steps built · 100%" badge, and a "Change your mind?
    Re-open your plan" link back to *confirm* for a re-commit.
- **Action/write**: `commitPlanService.commitPlan(tenantId, uid, year, {annualAPI, annualApps})`
  — this is the write that sets the agent's **Personal Commitment**, the one layer of the
  5-tier goal hierarchy only the agent can set.

### gamePlanPrefetch.js — `src/services/gamePlanPrefetch.js`
- `prefetchGamePlanYearDocs(tenantId, uid, year)` — attaches live `onSnapshot` listeners (not a
  one-shot `getDoc`) on the 3 year-doc collections (`moneyNeeds`, `yearPlan`, `monthlyPlan`) as
  soon as the dashboard mounts, so the Firestore local cache is already warm by the time the
  agent taps into Game Plan — purely a perceived-latency optimization (targets beating a
  400ms gated-entrance cap even on Slow 4G); failure-silent, no user-visible effect either way.

---

## MONEY NEEDS

### MoneyNeedsPanel — `src/components/agent/MoneyNeedsPanel.jsx` (~1,292 lines)
- **Mount**: Game Plan Step 1, and standalone "Money Needs" tab/card on the agent dashboard.
- **Feature flag**: `VITE_MONEY_NEEDS_MERGED_ENABLED` (`MONEY_NEEDS_MERGED_ENABLED`, **default
  OFF**) — gates the newer **commission-canonical 3-line allocation model** (Life / A&H /
  General, each with per-product drill-down) vs. the legacy **4-line target model**. With the
  flag off, agents see the legacy 4-line worksheet only.
- **5 expense groups** (worksheet accordions), each an editable line-item list with
  frequency-annualized amounts: the exact category set is seeded from
  `DEFAULT_MONEY_NEEDS_CATEGORIES` (34 named seed items across groups + 3 sub-calculators,
  first-run state is `{filled: 0, total: 34}` per `countFilledLineItems`).
- **Sub-calculators** (each a nested drawer, "N of M filled" tally each):
  - **Insurance Industry** calculator — its own line items, rolled into
    `insuranceIndustry.annualTotal`.
  - **Car Expenses** calculator — "With loan?" toggle, **personal/business split** defaulting
    to `CAR_PERSONAL_PCT = 33.3` / `CAR_BUSINESS_PCT = 66.7`, producing
    `annualTotalPersonal` / `annualTotalBusiness` separately (only the personal share counts
    toward the worksheet's after-tax needs; business share is informational).
  - **Loans & Debt** calculator — its own line items → `loansDebt.annualTotal`, seeded with
    `seed-ld-1` (`CAR_LOAN_LOANSDEBT_LINE_ID`).
- **PAYE gross-up**: `computeWorksheetRollup(expenseGroups)` sums every group's
  `groupAnnualTotal` → `totalAnnualAfterTax`, then **grosses it up to pre-tax** via
  `grossFromNet(totalAnnualAfterTax, DEFAULT_PAYE_CONFIG)` and computes the resulting annual tax
  via `computePAYE(...)`. Result: `{ totalAnnualAfterTax, totalAnnualPreTax, computedPAYE }`.
- **PAYE bracket table** (`src/utils/payeEngine.js`, `DEFAULT_PAYE_CONFIG`,
  `PAYE_BRACKETS_VERSION = 'default-2026'`):
  ```
  personalAllowance = 90,000 TTD
  chargeable = max(0, gross − 90,000)
  bracket 1: chargeable ≤ 1,000,000 → 25%
  bracket 2: chargeable  > 1,000,000 → 30%
  ```
  `computePAYE(gross)` walks the bracket table on chargeable income; `grossFromNet(net)`
  inverts it band-by-band (net ≤ allowance → gross = net, i.e. a zero-tax zone below 90,000).
- **Frequency multipliers**: `FREQUENCY_MULTIPLIERS = { A: 1, S: 2, Q: 4, M: 12 }` — used by
  `annualizeAmount()` to convert a line item's entered amount + frequency code into an annual
  figure.
- **Actions/writes**: `updateExpenseGroup(tenantId, uid, year, groupKey, updatedGroup,
  fullExpenseGroups)` — patches one group and re-derives+writes the whole-worksheet rollup
  (`totalAnnualAfterTax`, `totalAnnualPreTax`, `computedPAYE`, `payeBracketsVersionId`,
  `updatedAt`, `updatedBy`) on every group save, at `tenants/{t}/users/{uid}/moneyNeeds/{year}`.
- **States**: empty (first-run 34-item seed, all zero); a first-time-missing sub-calculator is
  back-filled from `defaultSubCalc(key)` rather than shown blank ("the UI never shows an empty
  checklist instead of the seeded items" — Gemini review #714 fix).

### MoneyNeedsAllocator — `src/components/agent/MoneyNeedsAllocator.jsx`
- **Mount**: Game Plan Step 1, paired with `MoneyNeedsPanel` — this is the piece that turns the
  computed pre-tax income need into an **allocation across product lines** (Life / A&H /
  General under the merged model; legacy 4-line target otherwise), using
  `moneyNeedsAllocation.js` / `moneyNeedsComposition.js` for the underlying math.
- **Outputs**: "Where the money goes" composition bar (`compositionSegments()` from
  `moneyNeedsComposition.js` — a pure helper turning the group totals into a percentage-segment
  breakdown for the stacked bar).

### moneyNeedsAllocation.js / moneyNeedsComposition.js — `src/lib/`
- Pure calculation modules backing the Allocator's line-split math and the composition-bar
  segments; no Firestore/side effects.

### moneyNeedsService.js — `src/services/moneyNeedsService.js`
- `computeGroupTotal(group)` — sums a group's `lineItems[].annualizedAmount`.
- `computeWorksheetRollup(expenseGroups)` — see above (PAYE gross-up chain).
- `countFilledLineItems(expenseGroups)` — worksheet-level "N of M filled" tally (added for
  Game Plan v2 1.8) — total = every line item across all groups, filled = items with a
  positive amount.
- `updateExpenseGroup(...)` — the write path (see above).
- `calcFedValue(calcKey, subCalculators)` — pulls a sub-calculator's federated total by key:
  `'carExpenses.personal'`, `'carExpenses.business'`, `'insuranceIndustry'`, `'loansDebt'`
  (unknown key → 0).
- `defaultSubCalc(key)` — back-fill scaffold for a legacy/sparse worksheet missing a
  sub-calculator entirely (car-expenses shape includes `withLoan`, `personalSharePct`,
  `businessSharePct`, `annualTotalPersonal`, `annualTotalBusiness`; others are
  `{lineItems, annualTotal: 0}`).
- Exported constants: `PAYE_BRACKETS_VERSION = 'default-2026'`,
  `FREQUENCY_MULTIPLIERS = {A:1, S:2, Q:4, M:12}`,
  `PLAYGROUND_INCOME_GOAL_KEY = 'agencytrack-playground-income-goal'`,
  `CAR_PERSONAL_PCT = 33.3`, `CAR_BUSINESS_PCT = 66.7`,
  `CAR_LOAN_LOANSDEBT_LINE_ID = 'seed-ld-1'`.

---

## PERSISTENCY (agent-facing)

### PersistencyOutlookHero — `src/components/persistency/PersistencyOutlookHero.jsx`
- **Mount**: top of `PersistencyTab.jsx` / Persistency card.
- **Data**: `buildPersistencyOutlook()` — see Question A for the five figures
  (`confirmed`/`derived`/`estimateToday`/`ifPendingSettle`/`gateMonth`).
- **Outputs**: a headline % with its label (`outlookLabels.js` supplies the display strings per
  figure kind — e.g. distinguishing a "confirmed" figure from an "estimate"), and a **stale**
  indicator once the underlying data is older than `PERSISTENCY_OUTLOOK_STALE_DAYS = 45` days.
- **States**: stale banner; empty (`known === false`) renders "—" rather than a fabricated %.

### PersistencyPlayground — `src/components/persistency/PersistencyPlayground.jsx`
- **Mount**: within the Persistency tab, a "what if" sandbox.
- **Inputs**: hypothetical adjustments to the underlying components (e.g. additional lapses,
  reinstatements) to see the resulting persistency % — runs `projectPersistency()` /
  `calculateShortfall()` from `calculations.js` without writing anything.
- **Outputs**: projected persistency % under the hypothetical, and the **shortfall** against
  `PERS_GATE` (0.90, award-eligibility gate) or `PERS_FLOOR` (0.80, at-risk convention) —
  whichever threshold is relevant to what's being checked.

### ConfirmPersistencySheet — `src/components/persistency/ConfirmPersistencySheet.jsx`
- **Mount**: month-confirmation flow off the Persistency tab.
- **Inputs**: the 3 **derived** figures (pre-filled from the ledger, editable but normally
  left as computed) plus the **4 manual figures** the ledger export cannot supply (per
  `LEDGER_MANUAL_INPUTS` / `ledgerPrefill.js`) — these render **empty, never 0**, and the form's
  save button is disabled until all applicable manual fields are answered
  (`MANUAL_BLOCK_MESSAGE`: "Enter the 4 figures the export does not have." — or the singular/
  count-scoped variant via `manualBlockMessage(n)`). On a **legacy-12** month, the 24-month-only
  manual field (`decreases`) is not shown and not gated on (`applicableManualInputs(monthKey)`
  intersects the full manual set with that month's own model).
- **Actions**: "Save"/"Confirm" → persists the month's figures plus `manualConfirmedBy` /
  `manualConfirmedAt` provenance fields (so a later reader can tell a *checked* 0 from an
  *unchecked* one) — an existing manual entry always wins over a re-derived ledger value.
- **Provenance label**: "From portfolio import, {d} {Mon} {yyyy}" when the prefill came from a
  ledger export (`importProvenanceLabel`).

### CountedPoliciesDrawer — `src/components/persistency/CountedPoliciesDrawer.jsx`
- **Mount**: drill-down from the outlook hero / confirm sheet — shows exactly which policies
  were counted (and which were excluded, with reason) in the ledger-derived figure.

### AnnuityRuleSwitch — `src/components/persistency/AnnuityRuleSwitch.jsx`
- **Input**: a 2-way toggle — "Ignore" (default) vs "Lapse" (60-day grace period) — for how a
  missed annuity premium is treated in the persistency ledger derivation. Deliberately named/
  scoped apart from the 12-vs-24-month **model** switch (different axis entirely).

### outlookLabels.js — `src/components/persistency/outlookLabels.js`
- Pure string-formatting helpers (`formatOutlookPct` etc.) mapping each outlook figure kind to
  its display label/decimal precision (e.g. never rounding an 89.6% up to a passing 90%).

### PersistencyTab (agent) — `src/components/agent/PersistencyTab.jsx`
- **Mount**: agent dashboard "Persistency" tab.
- **Outputs**: `PersistencyOutlookHero`, the "Monthly trend" 12-month `LineChart` (Question B),
  the confirm/edit entry point, and drill-down drawers.
- **States**: no-data (agent has no policies/records yet) renders an empty-state prompt rather
  than a chart with a single flat line.

### src/lib/persistency/model.js
- `persistencyModelFor(monthKey)` — resolves `legacy12` vs `tatil24` purely from
  `monthKey >= PERSISTENCY_MODEL_24M_EFFECTIVE_FROM ('2026-09')`; returns the model's `inputs`
  list (24-month model adds `decreases`/`increases` beyond the legacy set). See Question A.

### src/lib/persistency/calculations.js
- Formulas (see Question A intro):
  ```
  Net Gross Settled = Gross Settled − Not Takens − Decreases + Increases + 10% × Lumpsums
  Net Settled        = Net Gross Settled − Lapses + Reinstatements
  Persistency        = Net Settled ÷ Net Gross Settled
  ```
- Constants: `PERS_FLOOR = 0.80` (at-risk convention), `PERS_GATE = 0.90` /
  `PERS_GATE_PCT` (Tatil-locked award-eligibility threshold — a **different** concept from
  `PERS_FLOOR`, never interchanged per explicit code comments in `goalsService.js`).
- `projectPersistency()` / `calculateShortfall()` — the Playground's what-if math.

### src/lib/persistency/deriveFromLedger.js
- `deriveFromLedger(ledgerDocs, {monthKey, exportDate, annuityMissedPremiumRule, windowMonths})`
  — walks the agent's policy ledger (imported **and** organic — persistency is the one reader
  that must not exclude imported docs) to produce the 3 derived inputs, with an `evidence`/
  `excluded` breakdown (feeds `CountedPoliciesDrawer`).

### src/lib/persistency/ledgerPrefill.js
- `buildLedgerPrefill()` / `manualGate()` / `manualConfirmationFields()` — the pure
  prefill+gate logic behind `ConfirmPersistencySheet` (see above). `LEDGER_DERIVED_INPUTS`
  (3 fields) always prefill from the ledger unless a human already saved a value; the 4
  `LEDGER_MANUAL_INPUTS` are gated per-month-model and never defaulted to 0.

### src/lib/campaignPersistencyReading.js
- `campaignPersistencyReading({campaign, policies, records, today})` — the single shared
  persistency reading used by both the Home compact campaign card and the Policy Ledger's
  campaign card, so the two surfaces can never show two different persistency figures for the
  same tiered campaign. Prefers the actual gate reading (`persistencyPctForGate`); falls back to
  the outlook's headline month (labelled with full decimal precision) only when the gate figure
  is not yet known. Returns `null` (no ring shown) when the campaign isn't a tiered "qualify"
  campaign or its persistency gate is switched off (`campaign.persistencyGateEnabled === false`).

---

## FINANCING (agent self-view)

### FinancingSelfView — `src/components/financing/FinancingSelfView.jsx`
- **Mount**: agent dashboard "Financing" tab/card — **read-only** for the agent (all writes are
  manager-side; this component enforces a strict field-projection contract that excludes
  manager-internal fields from what the agent ever sees).
- **Data assembly**: `getProjectedBonus(tenantId, agentId, ruleset, scope)`
  (`financingProjectedBonus.js`) — the thin per-agent, current-quarter adapter that:
  1. Reads `financingTerms` (effectiveDate, financingStatus) via `financingService`.
  2. Resolves **year-in-agreement** (1 or 2) and **quarter** (1–4) from
     `monthsBetweenKeys(effectiveMonthKey, currentMonthKey)`.
  3. Pulls the quarter's own policies (Q1 = submitted-basis `proposedAPI`, any non-lapsed
     status; Q2+ = settled-basis `settledAPI`, `status === 'settled'` only), excluding any
     imported historical book (financing only ever projects off business written in
     AgencyTrack).
  4. Reads the agent's persistency fraction (0–1) for the current month.
  5. Runs `computeFinancingBonus()` then `computeTakeHome()`.
- **Bonus formula** (`financingBonusEngine.js`, ruleset `DEFAULT_FINANCING_RULESET_2026`):
  - **creditWeight(policy)** — per-policy API credit fraction: `0` if `isSelfOrFamily`; `0` if
    `staffPolicyTreatment === 'exclude'` and `isStaff` (declared but currently inert — no
    ledger field sets `isStaff` yet); else `creditMap[newBusinessType] ?? 0` (replacement and
    SPIA policies are both credited **0%**).
  - **Gross** = Σ(settledAPI × creditWeight) − notTakenAPI.
  - **Net-for-Persistency** = Gross − lapsedSurrenderedUnder2yrAPI + reinstatedUnder2yrAPI.
  - **Net-for-Production** = Net-for-Persistency − (credited lumpsum + inc_ppp portion).
  - **Quarterly gate**: Q1 is gate-exempt except a flat `$37,500` gross minimum (submitted
    basis, no persistency test); Q2+ requires gross ≥ `quarterlyGrossMin` **and** persistency ≥
    95% (year 1) / 90% (year 2).
  - **Consistency bonus** = `consistencyRate × Net-for-Persistency` (only if gates qualified,
    floored at 0). **Production bonus** = `productionRateY1|Y2 × Net-for-Persistency` (same
    gating/floor).
  - **Annual Bonus Adjustment** (only when `input.annual` supplied): rate tier resolved from
    annual Gross against `rateTiers` (inclusive upper bound), `livesQualified` when
    `netPoliciesSettled ≥ livesPolicyMin`; `totalBonusRate = tier.apiRate +
    (livesQualified ? tier.livesRate : 0)`; `annualQualifyingAmount = netProductionAPI ×
    totalBonusRate`; `annualAdjustment = max(0, annualQualifyingAmount − priorBonusesPaidYTD)`
    when the annual gross gate is met.
- **Take-home waterfall** (`financingTakeHome.js`): tax-first sequencing of the gross bonus down
  to a net take-home figure (the exact sequence/rates were not re-read verbatim this pass but
  the module is confirmed pure/deterministic, mirroring the K3 engine's structure, invoked as
  `computeTakeHome(grossBonus, financingStatus, ruleset)`).
- **Paydown-arc hero** (`financingPaydownArc.js`, `computePaydownArcModel`): SVG geometry
  (`viewBox 0 0 560 150`) for an **actual balance polyline** plus a **straight-line projection
  to zero** at the current average paydown rate (balance decline per calendar month across the
  entered history). Honesty rules, all explicit: < 2 balance points → no projection; rate ≤ 0
  (flat/growing balance) → no projection, never a NaN/garbage line; latest balance ≤ 0 (already
  cleared or surplus) → arc dips below baseline, no fabricated projection. Outputs
  `nowBalance`, `isSurplus`, `projectedClearMonths`, `projectedClearMonthKey`.
- **Validation-schedule proration** (`financingProration.js`): monthly basis machine — months
  1–3 of the agreement → `submitted-final`; month 4+ **past** → `settled-confirmed`; month 4+
  **current/in-flight** → `submitted-provisional` (display-only projection, never a stored
  determination). `suggestedFinancing = agreedMonthlyFinancing × min(1, actualAPI ÷
  validatingAPI)` (capped at 100%, ratio 0 if `validatingAPI ≤ 0`).
  `adjustmentPct = (currentMonthlyFinancing − managerFinancing) ÷ currentMonthlyFinancing`,
  computed only once a manager has confirmed a figure (null until then).
- **Termination-risk flags** (`financingMissEngine.js` — **flag-only, never auto-executed**):
  a monthly **miss** = `actualAPI < validatingAPI` on a confirmed basis (never
  `submitted-provisional`). A consecutive-miss counter resets on any confirmed meet, increments
  on a confirmed miss, and **holds** (no-op) across any pending/no-entry month.
  `MISS_AMBER_AT = 2`, `MISS_CRITICAL_AT = 3` (the 3rd consecutive confirmed miss is flagged as
  meeting the contract's 7.2c termination *condition* — the disposition always stays with a
  human). Separately, `ADJUSTMENT_NOTIFY_THRESHOLD = 0.10` flags any **confirmed** downward
  adjustment strictly greater than 10% below the amount in effect (clause 5.3 notify duty;
  exactly 10% does not flag).
- **Reconciliation** (`financingReconciliation.js`): service-gated reconciliation logic —
  waiver eligibility requires 12 months continuous service (12-month waiver clock), against a
  24-month total term wind-down clock (re-confirmed from the earlier research pass; not
  re-read verbatim this session).
- **States**: no financing agreement (`terms?.effectiveDate` missing) → `getProjectedBonus`
  returns `null`, panel renders an empty/not-applicable state; all read-only for the agent.

---

## FLAT CHECKLIST (for redesign parity checking)

### Goals
- [ ] GapAnalysisPanel — 5-layer goal cascade (Company Floor / SM Target / Branch Target / Unit Target / Personal Commitment) vs YTD
- [ ] DerivedIncomePanel — implied income from Personal Commitment API × commission rate
- [ ] AwardsReachPanel — progress toward next award tier (submitted/settled API + persistency gate)
- [ ] MdrtTracker — MDRT qualification progress vs YTD commission/API
- [ ] RecommendLockDrawer — manager sets per-agent "Annual API (TTD)", "Annual Apps", "Annual Persistency %", "Weekly API (TTD)" + Recommend/Lock toggle
- [ ] GoalsCelebration — celebratory overlay on threshold crossed
- [ ] LedgerLoadError — "Retry" on ledger read failure
- [ ] GoalCarousel — Week/Month/Quarter/YTD auto-rotating tabs with donut + progress bar
- [ ] goalsService.getGoals/setGoals — personal + manager target read/write, floor-enforced
- [ ] goalsService.getCompanyMinimums/setCompanyMinimums — tenant floor config (API/Apps/Persistency/weekly floors/tenure floors/working days)
- [ ] goalsService.getGoalHierarchy — assembles the 5-tier cascade in one call
- [ ] goalsService.getUnitGoals/setUnitGoals, getBranchGoals/setBranchGoals, getSalesManagerGoals/setSalesManagerGoals — roll-up tier targets (API, Apps, FFIs, CIs, Dials, locked)
- [ ] manager/GoalsPanel — Self/Agent/Unit/Branch/SM Target sub-tabs, status chips (Above floor/Below floor/Not set), Game Plan committed + Locked/Suggested badges

### Commission Playground
- [ ] GoalDecompositionTab inputs — Income goal, Tax rate, Renewal income, Commission rate, Average policy API, Persistency rate, CI-to-sale ratio, Dials-to-CI ratio, Prospect ratio
- [ ] GoalDecompositionTab outputs — API to write, API to settle, Applications, CIs, Dials/FFIs, Prospects/names (the Question-D inventory chain)
- [ ] deriveRatiosFromHistory — auto-derives ratios from agent's own last-12-submitted-weeks (needs ≥8 weeks), else company floor/default
- [ ] ModalTargetingTab — "This month's commission target" reverse-solve → Required API
- [ ] ModeMixSlider — Annual/Semi-Annual/Quarterly/Monthly mix sliders summing to 100%, auto-rebalanced
- [ ] CommissionBreakdownTable — per-mode Mix %, API Required, Commission
- [ ] CashFlowChart — 12-month stacked bar (per mode) + cumulative line
- [ ] SavedScenarioChips — save/recall named assumption-set scenarios
- [ ] InsightCard — contextual callouts (thin history, ratio deviation from default)
- [ ] Playground assumption persistence — 9 playground* fields on goals doc + localStorage fallback key
- [ ] CommissionAnchorStrip — persistent dashboard strip: current-month commission run-rate vs target
- [ ] Formula: commission = Σ API×modeMix×commissionRate/100×FIRST_PAYMENT_RATIO[mode] (annual 1.0/semi 0.5/quarterly 0.25/monthly 1/12)

### Game Plan
- [ ] GamePlanV2 hub — 3-step rail (Money Needs → Monthly Plan → Review & Commit)
- [ ] PlanAnchorStrip — sticky Personal Commitment/progress header
- [ ] PlanCascade/GoalsCascade — 5-layer hierarchy visual reused in commit flow
- [ ] PlanSuggestionsCard — manager→agent suggestion loop, unread badge, quiet empty/error states, clarity-masked
- [ ] SuggestedWeekCard — weekly backward-solve (shared goalDecomposition engine) with pace tracking
- [ ] PlanCommitCard/ReviewCommitModal — Review → Consequence → Confirm → Done flow
- [ ] Review view — Annual API hero, derived apps count, by-line breakdown, 12-month monthly-shape grid
- [ ] Confirm view — BelowApiFloorError / BelowAppsFloorError / AvgPolicyMissingError inline handling incl. avg-policy capture
- [ ] Done view — "3/3 steps built · 100%" + "Change your mind? Re-open your plan"
- [ ] commitPlanService.commitPlan — writes agent's Personal Commitment (annualAPI, annualApps)
- [ ] gamePlanPrefetch — background cache-warm for moneyNeeds/yearPlan/monthlyPlan docs (perf only, no user-visible feature)
- [ ] Flag: VITE_GAME_PLAN_LOOP_ENABLED (gates suggestion loop)

### Money Needs
- [ ] MoneyNeedsPanel — 5 expense-group worksheet (34 seeded line items), frequency-annualized
- [ ] Insurance Industry sub-calculator
- [ ] Car Expenses sub-calculator — With-loan toggle, 33.3%/66.7% personal/business split
- [ ] Loans & Debt sub-calculator
- [ ] PAYE gross-up — grossFromNet/computePAYE, personalAllowance 90,000 TTD, 25% to 1,000,000 chargeable then 30%
- [ ] computeWorksheetRollup — totalAnnualAfterTax → totalAnnualPreTax → computedPAYE, written on every group save
- [ ] countFilledLineItems — worksheet-wide "N of M filled" tally
- [ ] MoneyNeedsAllocator — "Where the money goes" composition bar (Life/A&H/General or legacy 4-line)
- [ ] Flag: VITE_MONEY_NEEDS_MERGED_ENABLED (default OFF) — 3-line commission-canonical model vs legacy 4-line target model
- [ ] Back-fill for missing sub-calculator (never shows an empty checklist instead of the seed)

### Persistency
- [ ] PersistencyOutlookHero — 5 figures: confirmed / derived / estimateToday / ifPendingSettle / gateMonth
- [ ] PersistencyOutlookHero stale state — PERSISTENCY_OUTLOOK_STALE_DAYS = 45
- [ ] PersistencyPlayground — what-if sandbox (projectPersistency/calculateShortfall), no writes
- [ ] ConfirmPersistencySheet — 3 ledger-derived (prefilled) + up to 4 manual inputs (never defaulted to 0), month-model-scoped gating, manualConfirmedBy/At provenance
- [ ] CountedPoliciesDrawer — drill-down of counted vs excluded policies
- [ ] AnnuityRuleSwitch — Ignore (default) vs Lapse (60-day grace) toggle
- [ ] PersistencyTab "Monthly trend" — 12-month LineChart from getAgentHistory(tenantId, uid, 12); NO year-over-year data anywhere
- [ ] Formula: Net Gross Settled = Gross − NotTakens − Decreases + Increases + 10%×Lumpsums; Net Settled = NetGrossSettled − Lapses + Reinstatements; Persistency = NetSettled ÷ NetGrossSettled
- [ ] Constants: PERS_FLOOR = 0.80 (at-risk), PERS_GATE = 0.90 (award-eligibility gate) — never interchanged
- [ ] Model switch — legacy12 vs tatil24 purely by monthKey ≥ '2026-09' (PERSISTENCY_MODEL_24M_EFFECTIVE_FROM), no flag, already live
- [ ] campaignPersistencyReading — single shared reading used by Home + Policy Ledger campaign cards (prevents two different numbers for one campaign)

### Financing
- [ ] FinancingSelfView — read-only agent view, strict field-projection excluding manager-internal fields
- [ ] getProjectedBonus — resolves year-in-agreement/quarter from effectiveDate, pulls quarter's policies (Q1 submitted-basis / Q2+ settled-basis), excludes imported book
- [ ] Bonus formula — creditWeight (self/family=0, staff-exclude=0 [inert], replacement & SPIA=0%), Gross/Net-for-Persistency/Net-for-Production chain
- [ ] Quarterly gate — Q1 flat $37,500 gross-only exception; Q2+ gross ≥ min AND persistency ≥ 95%(Y1)/90%(Y2)
- [ ] Consistency bonus + Production bonus (floored at 0, gated on qualification)
- [ ] Annual Bonus Adjustment — rate tier by annual Gross, lives-qualified add-on, floored top-up only
- [ ] Take-home waterfall — tax-first sequencing of gross bonus to net (financingTakeHome.js)
- [ ] Paydown-arc hero — actual balance polyline + honest straight-line projection to zero (no projection when <2 points, flat/growing balance, or already cleared)
- [ ] Validation-schedule proration — basis machine (months 1-3 submitted-final; month 4+ past=settled-confirmed, current=submitted-provisional), suggestedFinancing capped at 100% of agreed
- [ ] adjustmentPct — confirmed-only downward-adjustment % (denominator = currentMonthlyFinancing)
- [ ] Termination-risk flags — consecutive-miss counter (amber at 2, critical/7.2c-condition at 3), resets on confirmed meet, holds on pending — flag only, never auto-executed
- [ ] >10% downward-adjustment notify duty — flagged only on a CONFIRMED adjustmentPct > 0.10
- [ ] Reconciliation — 12-month continuous-service waiver gate vs 24-month term wind-down clock

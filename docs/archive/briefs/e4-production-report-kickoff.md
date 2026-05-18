# E4 — Digital Production Report / Branch Leaderboard

## Source

- Spec: `docs/Track-E-Specs.md` §E4
- Foundation:
  - PR #68 — schema utilities, V2 helpers
  - PR #69, #70 — wizard restructure + surface adaptation
  - PR #71 — daily input mode + Sunday aggregator (deployed)
- Planning decisions (May 9 2026, with Kyron):
  - **Three role-based views:** Agent / Unit Manager / Branch Manager (Sales Manager + Tenant Admin see Branch Manager view)
  - **UI placement:** new "Production Report" tab on existing dashboards (don't touch existing tabs)
  - **Time period toggles:** Week / MTD / Quarter / YTD
  - **Data source:** settled when available, fall back to submitted (with existing Confirmed teal / Estimated amber badge pattern from AgentAwardsPanel)

## Scope

### IN — this PR

1. New time-period-aware computation utilities (rank, aggregates, period filtering)
2. Reusable components: ProductionTable (whiteboard format), Leaderboard, TimePeriodToggle, DataSourceBadge
3. Role-specific views: AgentProductionView, UnitManagerProductionView, BranchManagerProductionView
4. Container: ProductionReportTab — role-aware switch
5. Wire into AgentDashboard + ManagerDashboard (new tab)
6. Vitest unit tests for computations + role-routing logic
7. Playwright walk verifying all three views

### OUT — deferred

- E5 — TV Display Kiosk Mode (built on E4 views post-pilot)
- Real-time updates (subscriptions vs polling — uses standard listener pattern, no special infra)
- Per-agent drill-down view (clicking an agent in branch leaderboard) — surfaces existing SubmissionViewer for now
- PDF export of the production report (existing PDFs cover this)

## Discipline gates

- Single-branch PR rule
- Fetch-first
- Two-strike counter starts at 0/2 (fresh session)
- No auto-merge — substantial new feature
- Phases produce intermediate state. Stop and surface between phases if running long
- Bundle CONTEXT.md sync into Phase 1 first commit (HEAD will be #71 — confirm)
- **Verification discipline (lesson from E6 deploy):** the PR description must explicitly state which artifacts are in-repo vs deployed. No claims of "shipped" without verification evidence (file path + commit SHA + functions:list output if applicable)

---

## Phase 1 — Sync + worktree

Standard:

```
git fetch origin --prune
git checkout main
git pull origin main
git log origin/main --oneline -5   → HEAD should be 31d3c3d (PR #71)
```

Bundle CONTEXT.md sync into first commit:
- HEAD bumped to current
- PR #71 added to "Recently shipped"
- "Where we left off" → E4 starting; pre-pilot HIGH queue done; post-pilot Track E in progress
- Active follow-up row updated

Branch: `feat/e4-production-report`
Worktree: `.claude/worktrees/feat-e4-production-report`

---

## Phase 2 — Discovery

Read these completely before writing code. Output to `docs/e4-discovery-notes.md`:

### Existing tab patterns
- `src/components/dashboard/AgentDashboard.jsx` — tab structure (Dashboard / Career / Awards / Leaderboard / History per PRD)
- `src/components/dashboard/ManagerDashboard.jsx` — tab structure (Overview / Awards / Settlements / etc.)
- Where to insert "Production Report" tab — recommend between Awards and History on agent, between Overview and Awards on manager

### Existing patterns to reuse (don't reinvent)
- `src/components/manager/MasterSheet.jsx` — agent table with totals per period
- `src/utils/weeklyChampions.js` — top-N ranking logic
- `src/components/awards/AgentAwardsPanel.jsx` — data-source badge (Confirmed teal / Estimated amber)
- `src/services/settlementService.js` — fetching confirmed settlement data
- `src/utils/extractFields.js` — extractTotalProductionCredit, extractTotalCommission helpers

### Time-period boundary logic
- Week starting: Sunday (existing convention, validated everywhere)
- MTD: from 1st of current month
- Quarter: calendar quarters (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
- YTD: from Jan 1
- All in Trinidad time (UTC-4) — use the existing pattern from `functions/aggregators/sundayDailyToWeekly.js` getTriniSundayString helper as reference for timezone handling

### STOP conditions

- Rank computation requires server-side aggregation that doesn't exist yet (e.g., Cloud Function + aggregate docs) — surface; for pilot of 50-80 agents, client-side computation is fine, but verify the data shape supports it
- Existing tab structure has constraints that prevent simple insertion (e.g., dynamic tab loading) — surface
- Settlement service can't be called from agent context due to rules restrictions — surface

---

## Phase 3 — Computation utilities

New file: `src/lib/productionReport/computations.js`

```javascript
// Pure functions, no Firebase, no React. Testable in isolation.

export function getPeriodBoundaries(period, referenceDate = new Date()) {
  // period: 'week' | 'mtd' | 'quarter' | 'ytd'
  // returns { start: Date, end: Date }
  // All in Trinidad time (UTC-4)
  // Week: previous Sunday 00:00 → following Saturday 23:59
  // MTD: 1st of month 00:00 → end of current day
  // Quarter: 1st of quarter month → end of current day
  // YTD: Jan 1 → end of current day
}

export function filterSubmissionsByPeriod(submissions, period, referenceDate) {
  // returns submissions where weekStarting falls within period boundaries
}

export function computeAgentTotals(submissions) {
  // sum totalProductionCredit, totalCommission, apps across submissions
  // returns { totalApi, totalCommission, totalApps, nb: {api, apps}, ppp: {api, apps}, lmps: {api} }
  // Uses extractTotalProductionCredit, etc. from extractFields.js
}

export function rankAgentsByApi(agentTotalsArray) {
  // input: [{ agentId, agentName, unitId, branchId, totals }]
  // returns: same array with `rank` and `rankWithinUnit`, `rankWithinBranch` fields
  // Tie-breaker: apps count, then alphabetical name
}

export function computeUnitAggregates(unitId, allSubmissions, allAgents) {
  // returns { unitId, totalApi, totalCommission, totalApps, agentCount, avgApiPerAgent }
  // agentCount excludes agents with provisioning: true
}

export function computeBranchAggregates(branchId, allSubmissions, allAgents, allUnits) {
  // returns { branchId, totalApi, totalCommission, totalApps, unitCount, agentCount, avgApiPerAgent, unitBreakdown: [...] }
}

export function computeComplianceStats(submissions, agentRoster, weekStarting) {
  // returns { submitted: N, total: M, percent: P }
  // submitted = unique agentIds with status='submitted' for weekStarting
  // total = active agents in roster (excludes provisioning)
}
```

### Tests: `src/lib/productionReport/__tests__/computations.test.js`

Cover:
- `getPeriodBoundaries`: each period returns correct Trinidad-time boundaries
- Boundary edge cases: period start/end on day boundaries
- `filterSubmissionsByPeriod`: includes submissions exactly at boundaries
- `computeAgentTotals`: V2 schema with NB+PPP+LMPS sums correctly via extractors
- `rankAgentsByApi`: ties broken by apps then name
- `rankAgentsByApi`: empty input returns empty array
- `computeUnitAggregates`: 0-agent unit handled (avg defined as 0 or null)
- `computeBranchAggregates`: includes unit breakdown sorted by avg API per agent
- `computeComplianceStats`: agents in provisioning excluded from total

Run `npm test`. All green before moving on.

---

## Phase 4 — Reusable components

New directory: `src/components/productionReport/`

### `TimePeriodToggle.jsx`

```
[ Week | MTD | Quarter | YTD ]
```
- Pill-button toggle pattern (match existing app style)
- Persists selection to component state (not localStorage, not URL — per app convention)
- Default: 'Week'
- Mobile-friendly (44px touch targets)

### `DataSourceBadge.jsx`

Reuse pattern from `AgentAwardsPanel.jsx` exactly:
- Confirmed (teal): when data is from settlements collection
- Estimated (amber): when falling back to submissions
- Tooltip on hover explaining what each means

### `ProductionTable.jsx`

Whiteboard-format table — shows the breakdown columns.

```
              | NEW BUSINESS  | API ADJUSTMENTS              |
              | APPS | API    | APPS | Inc. PPP | 10% LMPS  | TOTAL
[Agent name]    3      $25K     1       $4,800     $2,500    $32,300
```

Props:
- `rows`: array of { label, nb: {apps, api}, ppp: {apps, apiIncrease}, lmps: {apiCredit}, total }
- `showRankColumn`: boolean (true for leaderboards)
- `period`: 'week' | 'mtd' | 'quarter' | 'ytd' (for column header context)

### `Leaderboard.jsx`

Ranked list component.

Props:
- `entries`: ranked array [{ rank, name, value, secondaryValue, badgeStatus }]
- `valueLabel`: e.g. "API" or "Apps"
- `secondaryLabel`: optional (e.g. "apps" when value is API)
- `topN`: optional cap (default unlimited)
- `currentEntityId`: highlights the row matching this ID (for "you are #X" pattern)

Mobile: stack rows vertically with rank → name → value layout.

### Tests
Vitest for each component:
- TimePeriodToggle: clicking changes selected period, fires callback
- DataSourceBadge: renders correct color for each status
- ProductionTable: handles empty rows, renders breakdown correctly
- Leaderboard: highlights currentEntityId row, respects topN

---

## Phase 5 — Role-specific views

New components in `src/components/productionReport/`:

### `AgentProductionView.jsx`

For role: `agent`

Layout:
```
┌─────────────────────────────────────────────────┐
│  Production Report      [Week|MTD|Quarter|YTD]  │
│                          [Confirmed/Estimated]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  My Production (whiteboard format table)         │
│  [single row: agent's totals]                    │
│                                                  │
│  My Ranking                                      │
│  In your unit:  #2 of 8                          │
│  In the branch: #7 of 42                         │
│                                                  │
└─────────────────────────────────────────────────┘
```

Data source:
- Read all submissions for current agent (existing service)
- Filter by selected period
- Compute totals via `computeAgentTotals`
- For ranks: read all agents in unit + branch, compute their totals, rank, find current agent's position

### `UnitManagerProductionView.jsx`

For role: `unit_manager`

Layout:
```
┌─────────────────────────────────────────────────┐
│  Production Report      [Week|MTD|Quarter|YTD]  │
│                          [Confirmed/Estimated]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  Unit Aggregate                                  │
│  Total API: TTD 384,000   Apps: 124              │
│  Avg API per agent: TTD 48,000                   │
│                                                  │
│  Compliance: 7 of 8 agents submitted             │
│                                                  │
│  Unit Leaderboard (ranked by API)                │
│  [whiteboard-format table, all agents in unit]   │
│                                                  │
│  Unit rank in branch: #3 of 5                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

Data source:
- Read all submissions for agents in unit_manager's unit
- Read agent roster for unit (read users where unitId == manager's unitId)
- Read all units in branch for unit-rank calculation

### `BranchManagerProductionView.jsx`

For roles: `branch_manager`, `sales_manager`, `tenant_admin`, `platform_admin`

Layout:
```
┌─────────────────────────────────────────────────┐
│  Production Report      [Week|MTD|Quarter|YTD]  │
│                          [Confirmed/Estimated]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  Branch Aggregate                                │
│  Total API: TTD 1,920,000   Apps: 620            │
│  Avg API per agent: TTD 45,714                   │
│                                                  │
│  Unit Leaderboard (ranked by avg API per agent)  │
│  [table: unit name, agent count, total API,      │
│   avg per agent, rank]                           │
│                                                  │
│  Top 10 Agents Across Branch                     │
│  [leaderboard component]                         │
│  [+ View all agents] (expandable)                │
│                                                  │
│  Branch Total (whiteboard format)                │
│  [single-row table, branch grand total]          │
│                                                  │
└─────────────────────────────────────────────────┘
```

Data source:
- Read all submissions in tenant
- Read all agents and units
- Compute per-unit and per-agent aggregates

### `ProductionReportTab.jsx`

Container that switches based on role:

```jsx
function ProductionReportTab({ user }) {
  if (user.role === 'agent') return <AgentProductionView user={user} />;
  if (user.role === 'unit_manager') return <UnitManagerProductionView user={user} />;
  // branch_manager, sales_manager, tenant_admin, platform_admin all see branch view
  return <BranchManagerProductionView user={user} />;
}
```

### STOP conditions

- Computing branch aggregates client-side fetches > 1000 documents (performance concern) → surface; pilot is 50-80 agents so this shouldn't hit, but verify
- A view requires a Firestore index that doesn't exist → surface; document the index requirement

---

## Phase 6 — Wire into dashboards

### AgentDashboard.jsx

Add new tab between Awards and History (or wherever fits the existing structure — confirm via discovery).

```jsx
{ label: 'Production Report', value: 'production-report', component: <ProductionReportTab user={user} /> }
```

### ManagerDashboard.jsx

Same pattern — add tab. Container handles role-based view internally so no role-specific tab logic needed at the dashboard level.

### Tests

Vitest:
- AgentDashboard renders new tab
- Clicking new tab shows ProductionReportTab
- ManagerDashboard new tab works for unit_manager and branch_manager roles

---

## Phase 7 — Tests + lint + build

```
npm test     → all green (~120+ tests including new ones)
npm run lint → 0 errors, 3 known warnings OK
npm run build → green
```

---

## Phase 8 — Playwright walk

Create `scripts/verification/e4-walk.mjs` based on `e1-slice-2b-walk.mjs` patterns (most-recent template, has accumulated knowledge from Slice 2B + E6).

### Required checks

1. Login as test agent → AgentDashboard shows Production Report tab → click it → screenshot
2. Agent view: production breakdown shows correct values (verify against Firestore via Admin SDK or browser fetch) → screenshot
3. Agent view: rank within unit and branch displayed correctly → screenshot
4. Agent view: Time period toggle to MTD → values change → screenshot
5. Agent view: Time period toggle to YTD → values change → screenshot
6. Agent view: Data source badge shows correct status → screenshot
7. Login as unit_manager test seat → ManagerDashboard shows Production Report tab → click it → screenshot
8. Unit Manager view: unit aggregate, compliance count, unit leaderboard → screenshot
9. Unit Manager view: Time period toggles work → screenshot
10. Login as branch_manager test seat → branch view shows → screenshot
11. Branch Manager view: branch aggregate, unit leaderboard, top 10 agents → screenshot
12. Branch Manager view: "View all agents" expansion works → screenshot
13. Mobile (380px) — Agent view + Branch view → screenshots
14. Dark mode — Agent view + Branch view → screenshots

Save artifacts to `verification/e4/`.

### STOP if checks 1-3, 7-8, or 10-11 fail

Mobile + dark mode (13, 14) failures are flag-don't-stop level.

---

## Phase 9 — Open PR + STOP

### PR title

```
feat(e4): digital production report — three role-based views with time-period toggles
```

### PR description

```
## Summary
E4 — Digital Production Report. First post-pilot Track E item.
Three role-based views replacing the Friday whiteboard PDF:
- Agent self-view (personal totals + ranks)
- Unit Manager view (unit aggregate + leaderboard + compliance)
- Branch Manager view (branch aggregate + unit leaderboard + top agents)

Time-period toggles: Week / MTD / Quarter / YTD.
Data source: settled when available, falls back to submitted (Confirmed/Estimated badge).

Per docs/Track-E-Specs.md §E4 + planning decisions May 9 2026.

## What ships

### Pure utilities
- src/lib/productionReport/computations.js — period boundaries, ranking, aggregates
- Vitest tests cover all computations including timezone edge cases

### Reusable components
- TimePeriodToggle, DataSourceBadge, ProductionTable, Leaderboard

### Role-specific views
- AgentProductionView, UnitManagerProductionView, BranchManagerProductionView
- ProductionReportTab — role-aware container

### Wired in
- New "Production Report" tab on AgentDashboard
- New "Production Report" tab on ManagerDashboard
- Existing dashboards untouched otherwise

## Verification

### Vitest
- <X> tests pass (new tests for computations + components + tab routing)

### Lint + build
- 0 errors, 3 known warnings (baseline)
- Build green

### Playwright walk
- <Y>/14 checks pass (artifacts in verification/e4/)
- Light + dark + mobile + all three role views verified

## Out of scope (deferred)
- E5 — TV Display Kiosk Mode (built on these views, post-pilot)
- Real-time updates / live data (uses standard listener pattern)
- Per-agent drill-down beyond existing SubmissionViewer
- PDF export (existing PDFs cover this format)

## Awaiting Kyron
- Spot-check screenshots from verification/e4/
- Manual test: log in as each role, verify production report data matches MasterSheet
- Verify the period boundaries match Trinidad-time expectations
- Squash-merge if happy
```

**STOP. Do NOT merge.** New feature touching live UI — requires Kyron review.

---

## Hard stops (any → surface and wait)

- Phase 2 discovery surfaces architectural blocker (e.g., rank computation needs server-side aggregation)
- Phase 4 reusable components can't cleanly reuse existing patterns — surface, may need refactor first
- Phase 5 role views require data that's not accessible (rules denial for unit_manager reading branch data) — surface
- Phase 8 Playwright walk fails on core role-view checks (1-3, 7-8, 10-11)
- Two strikes hit (counter at 2/2) → STOP regardless of phase
- 5-hour window expiring with substantial work remaining → surface progress with state dump, even mid-phase

## Success states

**Best:** PR open with green CI, Playwright 14/14, all three role views working, awaiting Kyron review.

**Acceptable:** PR open with 11-14/14 Playwright (mobile or dark mode failures tolerable), all three role views shipped, awaiting Kyron review.

**Acceptable with note:** Phases 1-7 + 9 ship, Phase 8 Playwright defers because the 5-hour window is closing. Run a manual smoke test on Vercel preview, document gaps in PR description, surface for Kyron to run Playwright after returning. NOT a strike — explicit time-window scope-cut, surfaced.

**Stopped:** Two strikes hit OR critical architectural blocker, full state dump in chat for Kyron's direction.

---

## Notes for CC

- **Strike counter resets to 0/2** — fresh session.
- **Trust-but-verify discipline from E6 lesson:** PR description must explicitly state which artifacts are in-repo with file path + commit SHA evidence. No claims of "shipped" without verification evidence. If something can't be verified, say so explicitly in the PR description.
- **Reuse aggressively** — MasterSheet, weeklyChampions, AgentAwardsPanel patterns, extractFields helpers, settlement service. Don't reinvent.
- **Pilot scale matters** — 50-80 agents in tatillife_south. Client-side computation of ranks is fine at this scale. If you're tempted to introduce server-side aggregation, surface for Kyron — that's E4-followup territory, not E4-core.
- **5-hour window:** Kyron is away. If you're approaching the window edge, prioritize getting Phases 1-7 + 9 done over a perfect Playwright walk. State-dump and surface; don't push through with quality compromises.
- **Time period boundaries are the non-obvious part** — Trinidad time, Sunday-starts-week, calendar quarters. Test them carefully. If unsure about a boundary, surface for Kyron rather than guess.

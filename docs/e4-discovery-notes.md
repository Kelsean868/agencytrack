# E4 Discovery Notes

Generated 2026-05-09 during Phase 2. Reference before writing any E4 component.

---

## Tab insertion points

### AgentDashboard.jsx NAV_ITEMS (current)
dashboard → career → awards → **[insert production-report here]** → leaderboard → history → profile

- Insert after `awards`, before `leaderboard`
- NAV_ITEMS entry: `{ id: 'production-report', label: 'Production Report', tabId: 'production-report', Icon: BarChart2 }`
- No BOTTOM_NAV change needed (5 slots already used; leaderboard is in bottom nav, production-report is discoverable via sidebar)

### ManagerDashboard.jsx NAV_ITEMS (current)
overview → team → campaigns → **[insert production-report here]** → awards → mastersheet → compliance → persistency → goals → settlements → leaderboard → profile

- Insert after `campaigns`, before `awards` (brief: "between Overview and Awards")
- NAV_ITEMS entry: `{ id: 'production-report', label: 'Production Report', tabId: 'production-report', Icon: BarChart2 }`

---

## Existing patterns to reuse

### DataSourceBadge
`src/components/awards/AgentAwardsPanel.jsx:13-26` — local component.
- Confirmed: `bg-primary/10 text-primary` pill
- Estimated: `bg-warning/10 text-warning` pill
- Move to shared component at `src/components/productionReport/DataSourceBadge.jsx`

### Ranking pattern
`src/utils/weeklyChampions.js:44-49` — `pickBest` with sort + tie-break by name.
- Extend to `rankAgentsByApi` in computations.js: sort by API desc, tie-break apps then name

### extractTotalProductionCredit
`src/utils/extractFields.js:127-139` — handles V2 (stored field), V2 derived (NB+PPP+LMPS sub-objects), and V1 (apiSold/api/annualPremium fallback).

### Data services
- `managerService.getAllYTDSubmissions()` — all tenant submissions current year, status='submitted'
- `managerService.getWeeklySubmissions(weekStarting)` — by week
- `managerService.getTenantUsers()` — all tenant users, filters `provisioning !== true`
- `settlementService.getSettlementsForUnit(tenantId, agentIds, year)` — batch-aware, up to 30 per query

### Table pattern
`MasterSheet.jsx:258` — `overflow-x-auto rounded-xl border border-border bg-[var(--color-surface)]` + `<thead><tbody>` HTML table

---

## Data access (Firestore rules verified)

All manager roles (unit_manager, branch_manager, sales_manager, tenant_admin, platform_admin) can read:
- `submissions/*` — via `canManage(tenantId)` (firestore.rules:94)
- `users/*` — via `canManage(tenantId)` (firestore.rules:60)
- `settlements/*` — via `canManage(tenantId)` (firestore.rules:131)

**No STOP condition.** Unit_manager can read all branch submissions client-side.

---

## Period filtering approach

Submissions have `weekStarting: 'YYYY-MM-DD'` (always a Sunday).
`filterSubmissionsByPeriod` compares `weekStarting` against period start/end dates as strings.

Trinidad = UTC-4 (no DST). `getPeriodBoundaries`:
- Compute "today in Trinidad" by offsetting UTC-4 from `referenceDate`
- Return start/end as `Date` objects; caller compares `weekStarting` date string

Week boundary:
- Start = most-recent Sunday in Trinidad time
- End = that Sunday + 6 days (Saturday)
- Filter: `weekStarting === sundayString`

MTD:
- Start = 1st of current Trinidad month
- Filter: `weekStarting >= '${year}-${mm}-01'` and in same month

Quarter:
- Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
- Filter: `weekStarting >= quarterStart` and `weekStarting <= quarterEnd`

YTD:
- Filter: `weekStarting >= '${year}-01-01'`

---

## Settlement vs submitted (data source)

Settlement docs are monthly/quarterly (`periodType`, `periodKey`).
There are no weekly settlement docs.

For E4 data source logic:
- Week period → always "estimated" (no weekly settlements)
- MTD/Quarter/YTD → check if `settledAPI` from settlement docs covers the period; if any settlement exists, prefer it for that agent; otherwise fall back to submissions sum
- DataSourceBadge shown at view level: "Confirmed" if all agents have settlement data for period; "Estimated" if none; "Estimated" if mixed (simplest; pilot-era, agents won't have settlements in place yet)

For initial build: use submitted data only (all "Estimated"). Settlement integration is additive — computations.js accepts `settlements` array alongside `submissions` and falls back naturally.

---

## Scale check

Tatil South pilot: ~50-80 agents. 
- `getAllYTDSubmissions()`: ~50 agents × 52 weeks = ~2,600 docs max. Fine.
- `getTenantUsers()`: ~80 docs. Fine.
- Client-side rank computation: trivial.
- No server-side aggregation needed. **No STOP condition.**

---

## Firestore index requirements

`getAllYTDSubmissions` uses `where('weekStarting', '>=', ...) + where('status', '==', 'submitted')` — may need composite index on `(weekStarting, status)`.
If not already deployed: surface in PR description. Not a blocker for the Vercel preview (index creation is async in production).

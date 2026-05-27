# H4 Plan Configuration — Codebase Recon

> **Purpose:** Read-only inventory of existing goals/plans/config infrastructure to inform H4 design.
> No build decisions. Produced: 2026-05-27 (autonomous session).

---

## 1. Existing Goals/Plans Data Model

**File:** `src/services/goalsService.js`

**Firestore paths:**
- Personal agent goals: `tenants/{tenantId}/goals/{agentId}`
- Unit goals: `tenants/{tenantId}/unitGoals/{unitId}_{year}`
- Branch goals: `tenants/{tenantId}/branchGoals/{year}`
- Company minimums: `tenants/{tenantId}/config/companyMinimums`

**Personal agent goals document fields:**
- `personalAnnualAPI`, `personalAnnualApps`, `personalAnnualPersistency` — annual personal commitments
- `targetAnnualAPI`, `targetAnnualApps`, `targetAnnualPersistency` — manager-set annual targets
- `targetWeeklyAPI`, `targetWeeklyApps`, `targetWeeklyDials`, `targetWeeklyFFI` — manager-set weekly targets
- `agentId`, `tenantId`, `setBy`, `setByName`, `updatedAt`, `notes`
- CSV import audit: `csvImportBatchId`, `importedFromCsv`
- Playground: 9 `playground*` fields (commission rate, income goal, tax rate, etc.)

**Unit goals document fields (`{unitId}_{year}`):**
- `api`, `apps`, `ffiConducted`, `ciConducted`, `dials`
- `setBy`, `setByName`, `setByRole`, `setAt`

**Branch goals document fields (`{year}`):**
- Same shape as unit goals minus `unitId`

**Exported functions:**
- `getGoals / setGoals` — personal
- `getUnitGoals / setUnitGoals` — unit (keyed by `unitId_year`)
- `getBranchGoals / setBranchGoals` — branch (keyed by `year`)
- `getGoalHierarchy(tenantId, unitId, year, agentId)` — assembles 4-level for gap analysis
- `getCompanyMinimums / setCompanyMinimums` — tenant-wide floor (singleton)

---

## 2. Company Minimums

**Firestore path:** `tenants/{tenantId}/config/companyMinimums` (singleton doc)

**Shape:**
```
annualAPI            number     required; positive; ≤ 10M TTD
annualApps           number
persistency          number     %
weeklyActivityFloors {          10 metric sub-fields (defaults apply on read)
  callsMade:60, contactsMade:40, appointmentsScheduled:20, interviewsKept:15,
  factFindsCompleted:10, closingInterviewsKept:10, applicationsSubmitted:1,
  clientsSold:1, api:4800, referralsNewLeads:100
}
tenureApiFloors      {          6 tenure bands (0–11mo, 12–24mo, …, 60+mo)
  band0_lt12:150000, band12_to_24:200000, …
}
updatedBy            uid
updatedAt            serverTimestamp
```

**Validation in `setCompanyMinimums`:** `annualAPI` finite/positive/≤10M; each floor key ≥ 0; non-API keys must be integers; API key positive.

---

## 3. Tenant Admin Config Editor UI Pattern

**Files:**
- `src/components/admin/CompanyConfigPanel.jsx` — read-only 6-tile display
- `src/components/admin/EditConfigModal.jsx` — edit form (modal with focus trap)

**UI pattern:** Read-only display with Edit button → modal. Modal edits `annualAPI` + all 10 `weeklyActivityFloors` rows. Shows current vs. new value inline. Validates before submit; modal closes only on success. No optimistic UI. Read-before-write pattern (parent loads config, passes as prop).

---

## 4. Activity Standards / Floors

**Files:**
- `src/services/managerActivityStandardsService.js` — service
- `src/utils/weeklyActivityFloors.js` — defaults + display metadata
- `src/components/admin/ActivityStandardsPanel.jsx` — UI

**Manager activity standards path:** `tenants/{tenantId}/config/managerActivityStandards`

**Shape:** Keyed by role (`unit_manager`, `branch_manager`, `sales_manager`), each with:
- Numeric: `jfwCount`, `oneOnOnesConducted`, `namesSourced`, `interviewsConducted`, `recruitsInFirstWeeks`, `trainingSessions`
- Boolean: `unitMeetingHeld`, `dashboardReviewDone`
- Audit: `updatedBy`, `updatedAt`

---

## 5. Gap Analysis & Data Flow

**Files:** `src/utils/gapAnalysis.js`, `src/services/goalsService.js#getGoalHierarchy`

`computeGapAnalysis(hierarchy, ytdTotals)`:
- Input: 4-level hierarchy + YTD actuals
- Output: per-metric `{ actual, personal, unitTarget, branchTarget, companyFloor, gap*, pct* }`
- Metrics: `api`, `apps`, optionally `ffiConducted`, `ciConducted`, `dials`

Hierarchy assembly fetches: company minimums → branch goals → unit goals → personal goals + tenure band resolution. Displayed in `AgentDashboard` Goals section and `CareerPortal` via `GapAnalysisPanel.jsx`.

---

## 6. Firestore Structure Summary

| Path | Doc ID Pattern | Temporal? | Scope |
|---|---|---|---|
| `goals/{agentId}` | Agent UID | No | Personal + manager targets |
| `unitGoals/{unitId}_{year}` | `{unitId}_{year}` | Year | Unit manager targets |
| `branchGoals/{year}` | `{year}` | Year | Branch targets |
| `config/companyMinimums` | Singleton | No | Tenant-wide floors |
| `config/managerActivityStandards` | Singleton | No | Manager weekly standards |
| `campaigns/{autoId}` | Auto-ID | startDate/endDate | Temporal incentive scope |
| `settlements/{agentId}_{year}_{periodKey}` | Composite | Year + YYYY-MM | Monthly confirmed production |

---

## 7. Campaign System (Reference for Temporal Config)

**File:** `src/services/campaignService.js`

**Shape:**
- `name`, `startDate` (ISO), `endDate` (ISO), `status` (`draft|active|closed`), `prize`
- `targets[]` — array of `{ metric, threshold }` (metrics: `apiSold`, `applicationsSold`, `ffiConducted`, `ciConducted`)
- `scope: { type: 'branch|unit|agent', unitIds?: [], agentIds?: [] }`
- `createdBy`, `createdByName`, `createdByRole`, `createdAt`, `updatedAt`

Temporal pattern with `startDate`/`endDate` + nested scope object for visibility gating.

---

## Key Patterns for H4 Design (inventory only — no decisions)

**Temporal doc patterns already in use:**
1. Year-keyed singleton: `unitGoals/{unitId}_{year}`, `branchGoals/{year}`
2. Compound key: `settlements/{agentId}_{year}_{periodKey}`
3. Start/end date range: `campaigns/{autoId}` with `startDate`/`endDate`

**Config singleton pattern:** `tenants/{tenantId}/config/{docId}` — tenant admin writes; all read.

**4-level hierarchy already wired:** company floor → branch → unit → personal. Gap analysis consumes all 4 levels already. H4 could add a 5th or override an existing level.

**Validation pattern:** `setCompanyMinimums()` and `setManagerActivityStandards()` are canonical examples — validate then write, no batching needed for singleton docs.

**UI pattern:** `CompanyConfigPanel` + `EditConfigModal` is the reference pattern for a tenant-admin config editor.

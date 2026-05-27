# Phase 9 — Sales Manager Target Goals Layer Recon

> **Purpose:** Read-only inventory of the SM goals gap to inform the Phase 9 brief.  
> Produced: 2026-05-27 (Phase D tail, autonomous session).

---

## 1. Gap summary

The Sales Manager (SM) goals layer is **not built**. The 4-level hierarchy today is:

```
Company Floor (companyMinimums)
  └─ Branch Target (branchGoals/{year})
       └─ Unit Target (unitGoals/{unitId}_{year})
            └─ Personal (goals/{agentId})
```

SM sits between Company Floor and Branch Target in the org hierarchy, but has no dedicated goals collection, service functions, rules block, or UI surface.

---

## 2. Service gap — goalsService.js

**File:** `src/services/goalsService.js` (272 lines)

Exports today:
- `getGoals / setGoals` — personal agent goals
- `getUnitGoals / setUnitGoals` — unit-level targets (`unitGoals/{unitId}_{year}`)
- `getBranchGoals / setBranchGoals` — branch-level targets (`branchGoals/{year}`)
- `getGoalHierarchy(tenantId, unitId, year, agentId)` — assembles 4 levels
- `getCompanyMinimums / setCompanyMinimums` — tenant-wide floor

**Missing:** `getSalesManagerGoals`, `setSalesManagerGoals`.  
**Missing:** SM fetch in `getGoalHierarchy` (line 219–271 — returns only `{ companyFloor, branchTarget, unitTarget, personal }`).

---

## 3. Firestore path gap

No `salesManagerGoals` or `smGoals` collection exists in Firestore rules or service code.

**Pattern to follow:** `unitGoals/{unitId}_{year}` and `branchGoals/{year}`.  
**Expected new path:** `tenants/{tenantId}/salesManagerGoals/{managerId}_{year}`  
Doc ID: `{salesManagerUid}_{year}` (mirrors `{unitId}_{year}` pattern).

**Fields (same shape as unitGoals/branchGoals):**
- `api`, `apps`, `ffiConducted`, `ciConducted`, `dials`
- `setBy`, `setByName`, `setByRole`, `setAt`
- (implicit) `year`, `managerId`, `tenantId`

---

## 4. Firestore rules gap

**File:** `firestore.rules`

`sales_manager` IS referenced in rules (e.g., persistency read at line 466; unitGoals write at line 537 with `// BUG-N2` comment). But:
- No `match /tenants/{tenantId}/salesManagerGoals/{docId}` block exists
- `branchGoals` write rule (line 546–556) excludes `sales_manager` — only `branch_manager`, `tenant_admin`, `platform_admin` can write branch goals

**Rules needed:**
```
match /tenants/{tenantId}/salesManagerGoals/{docId} {
  allow read:  if isManager() && getTenantId() == tenantId;
  allow write: if (isSalesManager() || isTenantAdmin()) && getTenantId() == tenantId;
}
```

---

## 5. Gap analysis gap — gapAnalysis.js

**File:** `src/utils/gapAnalysis.js`  
**Function:** `computeGapAnalysis(hierarchy, ytdTotals)`

Current destructure: `const { companyFloor, branchTarget, unitTarget, personal } = hierarchy;`  
Current per-metric object: `{ actual, personal, unitTarget, branchTarget, companyFloor, gaps: { toPersonal, toUnit, toBranch, toFloor }, pcts: { ... } }`

**Changes needed:**
- Destructure `salesManagerTarget` from `hierarchy`
- Add `salesManagerTarget` to per-metric output
- Add `toSalesManager` gap and `ofSalesManager` pct

---

## 6. UI gap — GapAnalysisPanel + GoalsPanel

**GapAnalysisPanel.jsx** (`src/components/goals/GapAnalysisPanel.jsx`):  
Hardcoded 4-item `LAYER_CONFIG` array (lines 6–11). Needs 5th entry:
```js
{ key: 'salesManagerTarget', pctKey: 'ofSalesManager', gapKey: 'toSalesManager', label: 'Sales Manager Target', barClass: 'bg-amber-400' }
```

**GoalsPanel.jsx** (`src/components/manager/GoalsPanel.jsx`):  
Lines 147 and 744–751 show branch_manager and unit_manager goal-setting forms. SM needs a parallel form gated to `role === 'sales_manager'`. Form shape: same as branch goals (API + apps + activity targets) scoped to SM's cross-branch territory.

---

## 7. 6-point change surface (from FOLLOW_UPS.md)

From `docs/FOLLOW_UPS.md` Phase 9 SM target FU (lines 37–59):

| # | Change | File |
|---|---|---|
| 1 | Add `getSalesManagerGoals` / `setSalesManagerGoals` | `src/services/goalsService.js` |
| 2 | Extend `getGoalHierarchy()` to fetch + return `salesManagerTarget` | `src/services/goalsService.js:219` |
| 3 | Extend `computeGapAnalysis()` to destructure + compute SM tier | `src/utils/gapAnalysis.js` |
| 4 | Add 5th `LAYER_CONFIG` entry | `src/components/goals/GapAnalysisPanel.jsx:6` |
| 5 | New rules block for `salesManagerGoals/{managerId}_{year}` | `firestore.rules` |
| 6 | SM target-setting form in GoalsPanel (role-gated) | `src/components/manager/GoalsPanel.jsx` |

---

## 8. Cross-concerns / questions for the brief

1. **SM scope:** Does a SM set ONE cross-branch target (single SM goals doc per year) or separate targets per branch? Answer assumed: one doc per SM per year (mirrors BM one doc per year). If SM manages multiple BMs, the doc covers all their branches.

2. **`getGoalHierarchy` caller:** Currently called from `AgentDashboard` and `CareerPortal` with `unitId`. SM layer needs to be fetched using the agent's `branchId` to resolve SM goals (SM doc key = `{smUid}_{year}`). But what is the SM uid for a given branch? Requires `branches/{branchId}` lookup for the SM. The existing `branches/{branchId}.managerId` field stores the BM uid, not the SM uid. A `smUid` (or `salesManagerId`) field may need to be added to branch docs or resolved via `users` query.

3. **`// BUG-N2` on line 537 of firestore.rules** — `sales_manager` is listed in the `unitGoals` write arm. This may be intentional (SM can set unit goals cross-branch) or a bug. Brief should audit this before adding SM-specific write gates.

4. **Gap analysis display:** The 5-layer GapAnalysisPanel will only display correctly if `salesManagerTarget` is non-null. If no SM has been assigned goals yet, the SM row should be omitted or shown as "—". Needs a null-guard in `LAYER_CONFIG` render.

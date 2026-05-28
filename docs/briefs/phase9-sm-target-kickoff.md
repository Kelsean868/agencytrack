# Phase 9 — Sales Manager Target Goals Layer (Build Brief)

> ✅ **ACK COMPLETE — 2026-05-28. All 9 decisions locked and confirmed.**  
> See `docs/phase9-sm-target-design-questions.md` for the full ACK checklist.  
> Build dispatched under this brief.

---

## Methodology requirement

CC must STOP and wait for dispatcher before making any decision not pre-listed in this brief's "Decisions locked" section — including scope expansion, new architectural patterns, and any "how to solve" choice not explicitly pre-decided. Rule 1 applies to every phase.

---

## Context

**Track:** Phase 9 — Sales Manager Goals Layer  
**Recon:** `docs/phase9-sm-target-recon.md`  
**Design questions:** `docs/phase9-sm-target-design-questions.md`  
**6-point change surface:** Defined in recon § 7.

The existing 4-tier goals hierarchy (`companyFloor → branchTarget → unitTarget → personal`) is missing the SM layer that sits between Company Floor and Branch Target. This PR adds the 5th tier: `salesManagerTarget`.

---

## Decisions locked (all PENDING KYRON ACK)

| Decision | Source question | Status |
|---|---|---|
| Doc path: `salesManagerGoals/{smUid}_{year}` | Q1 | ✅ CONFIRMED |
| Write rule: SM self-sets + TA/PA override | Q2 | ✅ CONFIRMED |
| Read rule: any authenticated tenant member | Q3 | ✅ CONFIRMED |
| SM uid resolution: `getSalesManagerUid(tenantId)` query-by-role; optional 5th param | Q4 | ✅ CONFIRMED |
| BUG-N2 unitGoals arm: leave unchanged in this PR | Q5 | ✅ CONFIRMED |
| SM does NOT write branchGoals | Q6 | ✅ CONFIRMED |
| Null SM tier: always-render + "Not set" | Q7 | ✅ CONFIRMED |
| Single-aggregate SM doc model for Phase 9 | Q8 | ✅ CONFIRMED |
| `getGoalHierarchy`: optional 5th param (`smUid = null`) | Q9 | ✅ CONFIRMED |

---

## File inventory

| # | File | Change | Blocked on |
|---|---|---|---|
| 1 | `src/services/goalsService.js` | Add `getSalesManagerGoals` / `setSalesManagerGoals`; extend `getGoalHierarchy` with optional `smUid` param + SM fetch | Q1, Q2, Q3, Q9 |
| 2 | `src/utils/gapAnalysis.js` | Extend `computeGapAnalysis` to destructure `salesManagerTarget`, compute `toSalesManager` gap + `ofSalesManager` pct | Q1 |
| 3 | `src/components/goals/GapAnalysisPanel.jsx` | Add 5th entry to `LAYER_CONFIG` (label, key, barClass); null-guard for SM tier | Q7 |
| 4 | `src/components/manager/GoalsPanel.jsx` | Add SM target-setting form tab gated to `role === 'sales_manager'` | Q2 |
| 5 | `firestore.rules` | Add `match /tenants/{tenantId}/salesManagerGoals/{docId}` block with read + write rules | Q2, Q3 |
| 6 | `firestore.indexes.json` | Add composite index for any `salesManagerGoals` query shape used in smoke or production | Q1, Q3 |

---

## Phase 0 — Branch gate

```
git rev-parse --abbrev-ref HEAD   # must return 'main'
git fetch origin && git pull origin main
```

If not on main: `git checkout main` before proceeding.

---

## Phase 1 — Source audit (run before writing any code)

All of the following must be verified against current source. Report findings before Phase 2.

### 1a. Confirm recon's 6-point change surface is still accurate

```powershell
# Verify getGoalHierarchy signature and return shape
Select-String -Path "src\services\goalsService.js" -Pattern "getGoalHierarchy" -Context 2

# Verify LAYER_CONFIG in GapAnalysisPanel
Select-String -Path "src\components\goals\GapAnalysisPanel.jsx" -Pattern "LAYER_CONFIG" -Context 8

# Verify GoalsPanel tab structure
Select-String -Path "src\components\manager\GoalsPanel.jsx" -Pattern "canSeeBranch|sales_manager" -Context 3

# Verify no salesManagerGoals collection exists yet
Select-String -Path "firestore.rules" -Pattern "salesManagerGoals"
```

Expected: last command returns 0 matches. Any hit = recon was stale → STOP and wait for dispatcher.

### 1b. Verify BUG-N2 line is present and unchanged

```powershell
Select-String -Path "firestore.rules" -Pattern "BUG-N2" -Context 3
```

Expected: line 537 `sales_manager` in unitGoals write arm with `// BUG-N2` comment. If absent or already changed: STOP and wait for dispatcher.

### 1c. Verify branchGoals write rule still excludes sales_manager

```powershell
Select-String -Path "firestore.rules" -Pattern "branchGoals" -Context 15
```

Confirm `sales_manager` is absent from the write arm. If it's already present, recon is stale → STOP and wait for dispatcher.

### 1d. Verify branch doc schema for salesManagerId field

LOCKED PENDING KYRON ACK on Q4. The Phase 1 command for this check will be added once Kyron confirms whether `salesManagerId` exists on branch docs.

```powershell
# Placeholder — will be filled after Q4 ACK:
# Select-String -Path "src\services\*.js" -Pattern "salesManagerId|smUid"
```

### 1e. Confirm callers of getGoalHierarchy

```powershell
Select-String -Path "src" -Pattern "getGoalHierarchy" -Recurse
```

Expected: 2 call sites (AgentDashboard, CareerPortal). Any additional callers = scope expansion → STOP and wait for dispatcher.

### 1f. Verify firestore.indexes.json for any existing salesManagerGoals index

```powershell
Select-String -Path "firestore.indexes.json" -Pattern "salesManagerGoals"
```

Expected: 0 matches.

---

## Phase 2 — Implementation

**Do not begin Phase 2 until all Phase 1 checks pass and Kyron has ACK'd all design questions.**

### Change 1 — `src/services/goalsService.js`

Add after existing `setBranchGoals` / `getBranchGoals`:

```js
// ✅ DECISIONS LOCKED — Q1: salesManagerGoals/{smUid}_{year}; Q2: SM self + TA/PA; Q3: any tenant member; Q9: optional 5th param
export async function getSalesManagerGoals(tenantId, smUid, year) { ... }
export async function setSalesManagerGoals(tenantId, smUid, year, data) { ... }
```

Extend `getGoalHierarchy`:

```js
// ✅ Q9 LOCKED — optional 5th param smUid = null; callers pass getSalesManagerUid(tenantId) result
export async function getGoalHierarchy(tenantId, unitId, year, agentId, smUid = null) {
  // existing 4 fetches ...
  // + smUid ? getSalesManagerGoals(tenantId, smUid, year).catch(() => null) : Promise.resolve(null)
  // salesManagerTarget shape: same as branchTarget (api, apps, ffiConducted, ciConducted, dials)
  return { companyFloor, branchTarget, unitTarget, personal, salesManagerTarget };
}
```

### Change 2 — `src/utils/gapAnalysis.js`

```js
// ✅ Q1 LOCKED — salesManagerTarget field in hierarchy
const { companyFloor, branchTarget, unitTarget, personal, salesManagerTarget } = hierarchy;
// Add salesManagerTarget to per-metric object
// Add toSalesManager gap and ofSalesManager pct
```

### Change 3 — `src/components/goals/GapAnalysisPanel.jsx`

```js
// ✅ Q7 LOCKED — always render; show "Not set" when null (match existing tier null behavior).
// Position: SECOND in array (between personal and unitTarget), mirroring cascade order
// Company Floor → SM Target → Branch → Unit → Personal (highest → lowest accountability).
// LAYER_CONFIG entry: { key: 'salesManagerTarget', pctKey: 'ofSalesManager', gapKey: 'toSalesManager', label: 'SM Target', barClass: 'bg-amber-400' }
```

### Change 4 — `src/components/manager/GoalsPanel.jsx`

```js
// ✅ Q2 LOCKED — SM tab visible to sales_manager (sets own doc) + tenant_admin/platform_admin (resolves SM via getSalesManagerUid).
// Mirror BranchGoalsTab shape: same 5 fields (api, apps, ffiConducted, ciConducted, dials).
// On save → setSalesManagerGoals(tenantId, smUid, year, data).
```

### Change 5 — `firestore.rules`

```
// ✅ Q1/Q2/Q3 LOCKED — exact rule text:
match /tenants/{tenantId}/salesManagerGoals/{docId} {
  allow read: if request.auth != null
    && request.auth.token.tenantId == tenantId;
  allow write: if request.auth != null
    && request.auth.token.tenantId == tenantId
    && (
      request.auth.token.role in ['platform_admin', 'tenant_admin']
      || (request.auth.token.role == 'sales_manager'
          && docId.matches(request.auth.uid + '_.*'))
    );
}
```

Position: after the `branchGoals` block. Do not modify any existing goals block.

### Change 6 — `firestore.indexes.json`

`getSalesManagerGoals(tenantId, smUid, year)` fetches a single doc by ID (`{smUid}_{year}`) — no composite query, no index required. `getSalesManagerUid(tenantId)` queries `users` where `role == 'sales_manager'` — single `where()` clause, no composite index required. No `firestore.indexes.json` change needed for Phase 9.

---

## Phase 3 — Verification

### Tests

**`src/utils/gapAnalysis.test.js`** (if it exists — check before writing):
- Extend existing test for `computeGapAnalysis` to cover `salesManagerTarget` present and null cases.
- Do NOT rewrite the test file from scratch. Targeted additions only (Rule 1: surface before test-file rewrite).

**`src/services/goalsService.test.js`** (check if exists):
- Add tests for `getSalesManagerGoals` (returns null on missing doc), `setSalesManagerGoals` (writes correct shape).

### Smoke

LOCKED PENDING KYRON ACK Q4 (SM uid resolution). The smoke walk depends on knowing how to seed an SM goals doc.

Smoke plan skeleton (to be filled after Q4 ACK):

1. Sign in as `sales_manager` user (use `A11Y_SALES_MANAGER_EMAIL` / `A11Y_SALES_MANAGER_PASSWORD` from `.env.local` — or note if this account doesn't exist yet: STOP and wait for dispatcher, do not auto-create).
2. Navigate to GoalsPanel → SM Target tab.
3. Set SM target values (api, apps, activity metrics).
4. Hard-reload and verify persisted.
5. Sign in as agent.
6. Navigate to AgentDashboard or CareerPortal → Goals / GapAnalysisPanel.
7. Verify 5-tier cascade renders: Personal → Unit → Branch → SM Target → Company Floor.
8. Verify SM tier shows the value set in step 3.

**Smoke hard stop:** If `A11Y_SALES_MANAGER_EMAIL` does not exist in `.env.local` when smoke runs: STOP and wait for dispatcher. Do not seed a new user autonomously.

---

## Phase 4 — Docs

Fill in `docs/CONTEXT.md`:
- Active track → Phase 9 SM Target
- Update Recently shipped table with PR number + squash SHA (placeholder `#TBD` / `{TBD}` at PR-open time)
- Update Phase 9 row in CLAUDE.md Build Phase History from "Planned (post-pilot)" to "IN FLIGHT"

Update `docs/FOLLOW_UPS.md`:
- Close the Phase 9 SM target FU row once the PR merges

---

## Phase 5 — PR

```
gh pr create --title "feat(goals): Phase 9 SM target goals layer (5th tier)"
```

PR description must include:
- Firestore rules deploy status (additive new block — pre-merge deploy safe per CLAUDE.md workflow rule)
- `firestore.indexes.json` deploy status (per CLAUDE.md: `firebase deploy --only firestore:indexes` required, capture output)
- Smoke checklist per Rule 18 (leave smoke box unchecked until smoke actually runs)

**Hard stops in this phase:**
- If rules deploy fails: STOP and wait for dispatcher — do not merge without rules live.
- If Firestore index build is still pending when smoke runs: note in PR, dispatcher decides whether to waive per Rule 13.

---

## Acceptance criteria

All of these are LOCKED — the specific values/thresholds fill in after Kyron ACKs the design questions.

- [ ] `getSalesManagerGoals(tenantId, smUid, year)` returns correct shape or null on missing doc
- [ ] `setSalesManagerGoals` writes to `salesManagerGoals/{smUid}_{year}` with correct fields
- [ ] `getGoalHierarchy` called without `smUid` returns `salesManagerTarget: null` (backward-compat)
- [ ] `getGoalHierarchy` called with `smUid` returns populated `salesManagerTarget`
- [ ] `computeGapAnalysis` computes `toSalesManager` gap and `ofSalesManager` pct correctly
- [ ] GapAnalysisPanel renders 5-tier cascade when all tiers are populated
- [ ] GapAnalysisPanel renders SM tier as "Not set" (or per Q7 ACK) when `salesManagerTarget` is null
- [ ] GoalsPanel SM tab visible to `sales_manager` role only (not visible to branch_manager)
- [ ] SM can save goals via the UI; persisted value is readable on hard-reload
- [ ] Agent can view SM tier in GapAnalysisPanel
- [ ] `npm run lint && npm test && npm run build` all pass
- [ ] CI green on PR

---

## Out of scope (do not touch)

- `branchGoals` write rule — SM write access is explicitly NOT added (Q6)
- `unitGoals` BUG-N2 arm — leave unchanged pending separate audit (Q5)
- Branch doc schema (`salesManagerId` field) — separate PR if needed (Q4 dependent)
- Multi-territory SM goals (per-branch SM targets) — Phase 9+ concern (Q8)
- Any other Firestore collection not listed in file inventory

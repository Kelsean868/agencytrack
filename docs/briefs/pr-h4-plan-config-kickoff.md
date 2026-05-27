---
brief: pr-h4-plan-config
date: 2026-05-27
track: H4
pr-size: M
---

# H4 Policy Plan Configuration — Kickoff Brief

> Design source: `docs/h4-design-questions.md` — all 10 recommended answers ack'd by dispatcher. No amendments.
> Methodology: Rules 1–19 apply. Phase structure below.

---

## Decisions locked (from h4-design-questions.md)

| Q | Decision |
|---|----------|
| Q1 — Data shape | Singleton at `tenants/{tenantId}/config/policyPlans` = `{ plans: [{ id, name, class, productLine, isActive }], pendingReview: [{ name, loggedByAgents, firstLoggedAt }] }`. id = client UUID. |
| Q2 — Agent read | `allow read: if isTenantMember` — same as companyMinimums. Agents read full doc; filter `isActive===true` client-side. |
| Q3 — pendingReview write | CF aggregation (option b). No client agent-write arm. CF on `policy.onCreate` aggregates free-text planName into pendingReview. |
| Q4 — policyClass auto-fill | Auto-fill from plan.class on catalog selection — EDITABLE (soft suggestion). |
| Q5 — Free-text UX | Single combobox with "Other" option at bottom. On "Other": free-text planName input appears; planId stays null. |
| Q6 — Admin entry point | 7th tile in CompanyConfigPanel. Opens PlanCatalogModal (NOT EditConfigModal). |
| Q7 — Versioning | Soft-delete only (isActive=false). Never hard-delete. Retired shown "(Retired)" in admin; hidden from agent picker; still resolvable for history. |
| Q8 — Soft migration | No backfill. Pre-catalog policies (planId=null) show planName raw; no change. |
| Q9 — Service | New `planCatalogService.js`. |
| Q10 — Badge | Computed on panel mount (no subscription). |

---

## Phase 1 — Source verification (Rule 17)

### Verified claims before locking

1. **`firestore.rules` config wildcard** — `match /config/{docId}` at line 509 already provides:
   - `allow read: if isSignedIn() && getTenantId() == tenantId;` (all tenant members)
   - `allow write: if isSignedIn() && getRole() in ['platform_admin', 'tenant_admin'] && (getRole() == 'platform_admin' || getTenantId() == tenantId);`
   - **Consequence: NO new rules block needed**. Emulator tests still needed to verify the wildcard covers `config/policyPlans` specifically.

2. **`PolicyLedgerPanel.jsx` plan fields** — Lines 59–80 `EMPTY_FORM` already has `planId: ''` and `planName: ''`. Plan Name at lines 595–598 is currently a plain text input — combobox replacement confirmed.

3. **`CompanyConfigPanel.jsx` tiles array** — Line 59: `const tiles = [` with 6 entries (keys: annualAPI, currency, fiscal, persistency, week, selfreg). 7th tile adds after `selfreg`.

4. **`goalsService.js` line count** — 271 lines confirmed via `wc -l`. New `planCatalogService.js` is correct (adding plan catalog to goalsService would make it unwieldy).

5. **CF module pattern** — `functions/index.js` uses `require('./policyPlans/aggregatePendingPlan').aggregatePendingPlan`. New subfolder `functions/policyPlans/`.

6. **Test file pattern** — `PolicyLedgerPanel.test.jsx` uses hoisted vi.mock pattern. Needs `planCatalogService` mock added (`getPolicyPlans: hoisted.getPolicyPlans`).

7. **Rule 17 sub-bullet: Phase 1 verification commands**:
   - `git ls-files | grep -i planCatalog` → expect 0 (confirms new files)
   - `git grep -n "planName" src/components/agent/PolicyLedgerPanel.jsx` → confirms line 596-598 is the current text input
   - `git grep "match /config" firestore.rules` → confirms existing wildcard at line 509

### Phase 1 enumerate outputs (pre-build)

- `src/services/planCatalogService.js`: NOT YET EXISTS → new
- `src/components/admin/PlanCatalogModal.jsx`: NOT YET EXISTS → new
- `functions/policyPlans/aggregatePendingPlan.js`: NOT YET EXISTS → new
- `tests/rules/policyPlans.rules.test.mjs`: NOT YET EXISTS → new

---

## Phase 2 — File inventory

### New files

| File | Purpose | Est size |
|------|---------|---------|
| `src/services/planCatalogService.js` | 5 exported functions (getPolicyPlans, addPlan, updatePlan, deactivatePlan, promotePendingPlan, dismissPendingPlan) | ~140 lines |
| `src/services/__tests__/planCatalogService.test.js` | Unit tests — all 5 functions + concurrent write simulation | ~120 lines |
| `src/components/admin/PlanCatalogModal.jsx` | Two-tab modal: Active Plans + Pending Review | ~300 lines |
| `src/components/admin/__tests__/PlanCatalogModal.test.jsx` | Component tests — both tabs, all actions | ~140 lines |
| `functions/policyPlans/aggregatePendingPlan.js` | CF on policy.onCreate — idempotent aggregation | ~80 lines |
| `functions/__tests__/aggregatePendingPlan.test.js` | CF unit tests — all early-returns + aggregation paths | ~120 lines |
| `tests/rules/policyPlans.rules.test.mjs` | Emulator rules tests — allow/deny matrix | ~140 lines |

### Modified files

| File | Change | Est delta |
|------|--------|-----------|
| `src/components/admin/CompanyConfigPanel.jsx` | +1 tile (7th), state for `planCatalogOpen`, import PlanCatalogModal | ~30 lines |
| `src/components/agent/PolicyLedgerPanel.jsx` | Replace planName text input with combobox; add planId wire; getPolicyPlans on mount | ~60 lines net |
| `src/components/agent/__tests__/PolicyLedgerPanel.test.jsx` | Add planCatalogService mock; +3 combobox tests | ~40 lines |
| `functions/index.js` | +2 lines export + require for aggregatePendingPlan | ~2 lines |

**firestore.rules — NO CHANGE.** Existing `match /config/{docId}` wildcard covers policyPlans.

---

## Phase 2 — Implementation specifics

### planCatalogService.js

```js
// src/services/planCatalogService.js
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const CONFIG_DOC = (tenantId) => doc(db, 'tenants', tenantId, 'config', 'policyPlans');

// Returns { plans: [], pendingReview: [] } — tolerates missing doc (returns empty)
export async function getPolicyPlans(tenantId) { ... }

// Add a new plan. id = crypto.randomUUID(). Transaction on singleton.
export async function addPlan(tenantId, { name, class: policyClass, productLine }) { ... }

// Update an existing plan (name, class, productLine). Finds by id.
export async function updatePlan(tenantId, planId, updates) { ... }

// Soft-delete: sets isActive=false on the plan entry matching planId.
export async function deactivatePlan(tenantId, planId) { ... }

// Move pendingReview[i] to plans[] as active. Remove from pendingReview.
export async function promotePendingPlan(tenantId, pendingName, { policyClass, productLine }) { ... }

// Remove from pendingReview[].
export async function dismissPendingPlan(tenantId, pendingName) { ... }
```

All functions use `runTransaction` for optimistic concurrency on the singleton.

### aggregatePendingPlan CF

```js
// functions/policyPlans/aggregatePendingPlan.js
exports.aggregatePendingPlan = functions.firestore
  .document('tenants/{tenantId}/policies/{policyId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tenantId, policyId } = context.params;

    // Early returns (idempotent gates)
    if (data.planId) return null;           // catalog plan selected
    if (!data.planName?.trim()) return null; // no free-text name
    
    const cfgRef = admin.firestore().doc(`tenants/${tenantId}/config/policyPlans`);
    const cfgSnap = await cfgRef.get();
    if (!cfgSnap.exists) return null;  // admin hasn't initialized catalog yet
    
    const normalized = data.planName.trim().toLowerCase();
    const { plans = [], pendingReview = [] } = cfgSnap.data();
    
    // Don't aggregate if an active catalog plan matches (case-insensitive)
    if (plans.some(p => p.isActive && p.name.trim().toLowerCase() === normalized)) return null;
    
    // Transaction: upsert pendingReview entry. Idempotent guard via contributedPolicyIds[].
    await admin.firestore().runTransaction(async (tx) => {
      const freshSnap = await tx.get(cfgRef);
      if (!freshSnap.exists) return;
      const { pendingReview: pending = [], plans: activePlans = [] } = freshSnap.data();
      
      // Re-check active plans inside transaction
      if (activePlans.some(p => p.isActive && p.name.trim().toLowerCase() === normalized)) return;
      
      const idx = pending.findIndex(p => p.name.trim().toLowerCase() === normalized);
      const newPending = [...pending];
      if (idx >= 0) {
        // Increment — guard duplicate via policyId tracking
        const entry = { ...newPending[idx] };
        const ids = entry.contributedPolicyIds ?? [];
        if (ids.includes(policyId)) return; // already counted
        entry.loggedByAgents = (entry.loggedByAgents ?? 0) + 1;
        entry.contributedPolicyIds = [...ids, policyId];
        newPending[idx] = entry;
      } else {
        // New entry
        newPending.push({
          name: data.planName.trim(),
          loggedByAgents: 1,
          firstLoggedAt: admin.firestore.FieldValue.serverTimestamp(),
          contributedPolicyIds: [policyId],
        });
      }
      tx.update(cfgRef, { pendingReview: newPending });
    });
    
    return null;
  });
```

### PolicyLedgerPanel.jsx — combobox replacement

Replace `FieldGroup label="Plan Name"` block with:

```jsx
// State additions at top of component
const [catalogPlans, setCatalogPlans] = useState([]);
const [planPickerMode, setPlanPickerMode] = useState('catalog'); // 'catalog' | 'other'

// useEffect on mount:
useEffect(() => {
  if (!tenantId) return;
  getPolicyPlans(tenantId).then(d => setCatalogPlans(d.plans.filter(p => p.isActive)));
}, [tenantId]);

// handlePlanSelect:
function handlePlanSelect(e) {
  const val = e.target.value;
  if (val === '__other__') {
    setPlanPickerMode('other');
    setForm(f => ({ ...f, planId: null, planName: '' }));
  } else if (val === '') {
    setPlanPickerMode('catalog');
    setForm(f => ({ ...f, planId: null, planName: '' }));
  } else {
    const plan = catalogPlans.find(p => p.id === val);
    if (!plan) return;
    setPlanPickerMode('catalog');
    setForm(f => ({ ...f, planId: plan.id, planName: plan.name, policyClass: plan.class }));
  }
}

// JSX:
<FieldGroup label="Plan Name" id="planPicker">
  <select id="planPicker" value={form.planId ?? (planPickerMode === 'other' ? '__other__' : '')}
    onChange={handlePlanSelect} className={selectCls}>
    <option value="">Select plan…</option>
    {catalogPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    <option value="__other__">Other (enter manually)</option>
  </select>
  {planPickerMode === 'other' && (
    <input id="planName" name="planName" value={form.planName} onChange={handleChange}
      placeholder="Enter plan name" className={`${inputCls} mt-2`} />
  )}
</FieldGroup>
```

### CompanyConfigPanel.jsx — 7th tile

```jsx
// Add import at top:
import PlanCatalogModal from './PlanCatalogModal';

// Add state:
const [planCatalogOpen, setPlanCatalogOpen] = useState(false);
const [planCatalog, setPlanCatalog] = useState(null); // { plans, pendingReview }

// Add to tiles array after 'selfreg':
{
  key: 'policyPlans',
  label: 'Policy Plans',
  value: planCatalog ? `${planCatalog.plans.filter(p => p.isActive).length} active` : '—',
  sub: planCatalog?.pendingReview?.length > 0
    ? `${planCatalog.pendingReview.length} pending review`
    : 'No pending items',
  editable: true,
  onEdit: () => setPlanCatalogOpen(true),
}

// Tile renders a separate onClick for editable tiles with onEdit:
// (modify tile JSX to check tile.onEdit vs setEditing)
```

Note: CompanyConfigPanel currently has a single "Edit company config" button that opens EditConfigModal. The 7th tile needs its own click handler separate from the main edit button. Implementation: add `data-testid` + `onClick` to the tile div for the policyPlans tile. The tile div currently has no click handler — add one gated on `tile.onEdit`.

---

## Phase 3 — Tests

### planCatalogService.test.js coverage

- `getPolicyPlans`: missing doc returns `{ plans: [], pendingReview: [] }`
- `getPolicyPlans`: doc exists returns data
- `addPlan`: writes new plan with UUID id, isActive=true, correct fields
- `updatePlan`: finds plan by id, patches name/class/productLine
- `deactivatePlan`: sets isActive=false on correct entry; others unchanged
- `promotePendingPlan`: moves named entry from pendingReview to plans[]; assigns id, isActive=true
- `dismissPendingPlan`: removes named entry from pendingReview

### PlanCatalogModal.test.jsx coverage

- Active Plans tab: renders plan rows with name/class; Edit/Deactivate buttons present
- Active Plans tab: Add Plan button opens add form; submit calls addPlan; row appears
- Active Plans tab: Edit click shows edit form; submit calls updatePlan
- Active Plans tab: Deactivate click calls deactivatePlan; row disappears (filtered isActive)
- Pending Review tab: renders pending rows with name/loggedByAgents
- Pending Review tab: Approve click opens approve form; submit calls promotePendingPlan
- Pending Review tab: Dismiss click calls dismissPendingPlan; row disappears
- Empty state: "No active plans" when plans[] empty

### PolicyLedgerPanel.test.jsx additions

- Combobox renders plan options from catalog (mock getPolicyPlans)
- Selecting catalog plan auto-fills policyClass
- Selecting "Other" reveals free-text input; planId stays null on submit
- Existing F3.1 prefill test still works (initialForm passes planId+planName correctly)

### aggregatePendingPlan.test.js coverage

- `planId` set → returns null (no aggregation)
- `!planName` → returns null
- config doc missing → returns null
- Active catalog plan matches (case-insensitive) → returns null
- Case-insensitive pendingReview match → increments loggedByAgents + appends policyId to contributedPolicyIds
- Duplicate policyId → does NOT double-count (contributedPolicyIds guard)
- New name → appends `{ name, loggedByAgents:1, firstLoggedAt, contributedPolicyIds:[policyId] }`
- Transaction retry: concurrent write → handles correctly (transaction retry semantics)

### policyPlans.rules.test.mjs coverage

- ALLOW: agent read `config/policyPlans` (isTenantMember)
- ALLOW: unit_manager read `config/policyPlans`
- ALLOW: branch_manager read `config/policyPlans`
- ALLOW: sales_manager read `config/policyPlans`
- ALLOW: tenant_admin read `config/policyPlans`
- ALLOW: tenant_admin write `config/policyPlans` (create + update)
- DENY: agent write `config/policyPlans` (assertFails)
- DENY: unit_manager write `config/policyPlans` (assertFails)
- DENY: unauthenticated read (assertFails)
- DENY: wrong-tenant member read (assertFails)

---

## Phase 4 — Self-check before PR-OPEN (Rule 1d)

- [ ] `gh pr diff <n> --name-only` matches declared surface
- [ ] Lint 0, unit suite green (env-unset), build clean
- [ ] Emulator allow AND deny green
- [ ] Rule 18 PR checklist: smoke box UNCHECKED

---

## Phase 5 — PR-OPEN and STOP

Per session rubric: **ALWAYS PR-OPEN for H4**. Do not merge or deploy rules/CF.

Post-merge sequence (Rule 16 + Rule 15) runs AFTER dispatcher reviews and merges.

---

## Halt conditions

- **STOP and wait for dispatcher**: any decision not in "Decisions locked" above
- **STOP IMMEDIATELY**: any cross-tenant data touch, production Firestore write, or credential exposure

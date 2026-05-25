# H2b — Policy Reconciliation Polish Kickoff

**Track:** H — Policy Ledger MVP  
**Scope:** Reconciliation panel grouped-by-agent + side-by-side + bulk-confirm (PRD §7.8) + agentId-pinning hardening on history create (DENY test for mismatch).  
**Size:** S  
**Methodology requirement:** CC must surface before making any decision not pre-listed in "Decisions locked."

---

## Decisions locked

- **Grouped-by-agent:** `getPoliciesForManager` returns policies with `agentId`; load `getTenantUsers` once on mount to build `uid → name` map for agent section headers.
- **Side-by-side layout:** two-column (left = agent's submitted values, right = manager input fields) on ≥ sm breakpoint; stacks on mobile.
- **Bulk-confirm semantics:** for each selected policy with blank `managerSettledAPI`, default to `policy.settledAPI` (i.e. "I agree with agent's value" — silent confirmation). Filled-in value overrides. Runs sequential `confirmPolicy` calls; reload after all settle.
- **agentId-pinning rule:** add `&& request.resource.data.agentId == get(.../policies/$(policyId)).data.agentId` to the **manager arm** of history `allow create`. Agent arm already has this check. One new DENY test: BM writes history with `agentId: 'wrong-agent'` on a policy owned by `agent-a` → `assertFails`.
- **Access gate unchanged:** `branch_manager || tenant_admin || platform_admin || canConfirmSettlements`. BM-only means no TenantAdminDashboard tab — tab is already ManagerDashboard-only; no change needed.
- **No new service function:** reuse existing `confirmPolicy` + `getPoliciesForManager` + `getTenantUsers`.
- **New test file:** `src/components/manager/__tests__/PolicyReconciliationPanel.test.jsx` (no existing file).
- **Smoke:** two-actor (agent submits + BM reconciles); verify grouped sections render + bulk-confirm fires; verify DENY from rules emulator.

---

## Phase 0 gate

```
git rev-parse --abbrev-ref HEAD   # must be main
git status --short                # must be empty
git fetch origin && git pull origin main
```

---

## Phase 1 — source verify

1. Confirm `PolicyReconciliationPanel.jsx` line count matches ~291 (no concurrent edits).
2. Confirm `getPoliciesForManager` signature: `(tenantId, scope)` — no `agentId` param added since brief authoring.
3. Confirm `getTenantUsers` is in `src/services/managerService.js` (not `userService.js`).
4. Confirm manager-arm history create in `firestore.rules` does NOT yet have `request.resource.data.agentId == get(...).data.agentId` check (Rule 17 verify).
5. Confirm `tests/rules/policies.rules.test.mjs` has 50 `run(` calls — count should not have changed since PR #306 + PR #313 check.
6. Confirm no `PolicyReconciliationPanel.test.jsx` exists under `src/`.

Phase 1 source-verify command set:
```powershell
(Get-Content src/components/manager/PolicyReconciliationPanel.jsx | Measure-Object -Line).Lines
grep -c "getTenantUsers" src/services/managerService.js
grep -n "agentId == get" firestore.rules | grep -i "manager arm\|history"
grep -c "run(" tests/rules/policies.rules.test.mjs
Get-ChildItem src -Recurse -Filter "*PolicyReconcil*test*" | Select-Object FullName
```

---

## Phase 2 — edits

### Expected file set (5 files)

1. `firestore.rules` — manager arm history create: add agentId pin
2. `tests/rules/policies.rules.test.mjs` — +1 DENY case (BM writes wrong agentId history)
3. `src/components/manager/PolicyReconciliationPanel.jsx` — grouped + side-by-side + bulk-confirm + `getTenantUsers` load
4. `src/components/manager/__tests__/PolicyReconciliationPanel.test.jsx` — new test file (≥8 tests)
5. `docs/CONTEXT.md` — Phase 4 placeholder fill (post-merge only)

### 2a. firestore.rules — manager arm history create

Append to the manager `allow create` block (after `&& request.resource.data.actorUid == request.auth.uid`):

```
&& request.resource.data.agentId == get(
     /databases/$(database)/documents/tenants/$(tenantId)/policies/$(policyId)
   ).data.agentId
```

### 2b. tests/rules/policies.rules.test.mjs — DENY case

After the existing `'History manager arm DENY: UM writes confirmation history on another unit policy'` case, add:

```js
// agentId mismatch: BM writes history with wrong agentId on agent-a policy → DENY.
await run('History manager arm DENY: BM writes history with wrong agentId (agentId != parent.agentId)', false, () =>
  addDoc(
    collection(bmADb, 'tenants', TENANT_ID, 'policies', 'policy-a1-settled', 'history'),
    { ...MANAGER_HISTORY, agentId: 'agent-b', unitId: 'um-b' }  // policy-a1-settled.agentId == 'agent-a'
  )
);
```

### 2c. PolicyReconciliationPanel.jsx — grouped + bulk-confirm

Key changes:
- Import `getTenantUsers` from `managerService`
- Load `agentMap` (uid → name) on mount alongside policies
- Group policies by agentId using `Map` / `Array.groupBy` pattern
- Add `selectedIds` state (`Set`) + `selectAll` + checkbox per policy
- `handleBulkConfirm`: for each selected id, use `fs.managerSettledAPI || policy.settledAPI.toString()` as the value; call `confirmPolicy` sequentially; reload after allSettled
- Side-by-side: `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">` with agent column + manager column

### 2d. PolicyReconciliationPanel.test.jsx

Test cases (minimum 8):
1. Access-denied renders fallback text for unit_manager with no canConfirmSettlements
2. Loading state shows loading indicator
3. Error state shows error message
4. Empty state renders empty message
5. Policies grouped by agent — two agents → two section headers
6. Side-by-side: agent settled API visible + manager input visible in same card
7. Checkbox selection — select one policy → confirm button activates
8. Bulk-confirm with blank managerSettledAPI defaults to agent settledAPI
9. Select-all checkbox selects all visible unconfirmed policies
10. Individual confirm still works (single policy, managerSettledAPI filled)

---

## Phase 3 — tests + lint + build

```
npx vitest run                 # all app tests must pass
node tests/rules/policies.rules.test.mjs   # emulator must be running; new DENY must pass
npm run lint
npm run build
```

---

## Phase 4 — docs (placeholder fill post-merge)

Update `docs/CONTEXT.md`:
- Recently shipped: PR #TBD (`{TBD}`) — H2b reconciliation polish
- HEAD: `{TBD}`
- Active track: H2c next

---

## Phase 5 — PR

Branch: `feat/h2b-reconciliation-polish`  
Title: `feat(policy-ledger): H2b — reconciliation grouped-by-agent + bulk-confirm + agentId-pin`

PR body must include:
- File inventory (5 files)
- Rules emulator result (51/51 including new DENY)
- Vitest count
- Smoke: two-actor description

Hard stops:
- Phase 0 gate divergence → **STOP and wait for dispatcher**
- Phase 1 finds manager arm already has agentId pin → **STOP and wait for dispatcher** (brief premise shifted)
- `npm run lint` or `npm run build` fails on files outside the edit set → **STOP and wait for dispatcher**
- Smoke surfaces a regression → **STOP and wait for dispatcher**

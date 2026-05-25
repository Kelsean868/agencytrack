# Track H — H2c: Lapsed Status (BM-only Settled→Lapsed + Agent Notification + H11 lapse half) (BUILD LOCK)

**Branch:** `feat/track-h-h2c-lapsed-status`
**Depends on:** H2b (#315 `d01d0bc`) shipped.
**Banked decisions (dispatcher, 2026-05-25):**
- `lapsed` is a BM-only terminal status. Agent cannot set lapsed (`isLegalAgentTransition` already guards this). Only Branch Manager / platform_admin / tenant_admin can write.
- Transition: `settled → lapsed` only. No other fromStatus.
- `dateLapsed` is required. `lapseReason` is optional.
- Centurion deduction language in the agent notification is **informational text only** — the awards engine integration (actual deduction logic) is H3. Do NOT touch awardsEngine.js.
- H11 lapse half: agent-visible muted chip on PolicyLedgerPanel. Design resolved at authoring: add `lapsed` to STATUS_BADGE_CLS with muted/grey styling; add lapse-date chip in the policy row footer (mirrors confirmation chip from H11 discrepancy half in PR #305).
- Manager history arm in `firestore.rules` (line 387) already has no `fromStatus`/`toStatus` constraint → already allows lapse history writes. No change to the history arm needed.
- Lapse UI: second tab ("Lapsed") in PolicyReconciliationPanel showing all settled policies for the period (confirmed or not). Per policy: inline expandable form (dateLapsed input + optional lapseReason) with "Confirm Lapse" button. Avoids touching the existing "Confirm" tab flow.

---

## In scope (H2c)
1. `policyLifecycle.js` — add `lapsed` to `POLICY_STATUSES`, `POLICY_STATUS_LABELS`, `TRANSITION_REQUIRED_FIELDS` (requires `dateLapsed`), `TRANSITION_OPTIONAL_FIELDS` (allows `lapseReason`). No change to `isLegalAgentTransition` (guard already present at line 34).
2. `policiesService.js` — new `lapsePolicy(tenantId, managerProfile, policyId, policy, fields)`: BM-only guard, `writeBatch`: policy update (`status: 'lapsed'`, `statusUpdatedAt`, `dateLapsed`, `lapseReason?`) + lapse history doc + agent `policy_lapsed` notification doc. Commit atomically.
3. `NotificationDrawer.jsx` — add `policy_lapsed` to `TYPE_META`: `{ Icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/10' }`.
4. `PolicyLedgerPanel.jsx` — add `lapsed` to `STATUS_BADGE_CLS` (muted/grey); add lapse-date footer chip on lapsed policies (H11 lapse half). Mirrors confirmed-at chip in PR #305.
5. `PolicyReconciliationPanel.jsx` — add "Lapsed" tab: shows settled policies for the period (confirmed or not). Per policy: inline expandable form (date input for `dateLapsed` + text input for `lapseReason`), "Confirm Lapse" button, calls `lapsePolicy()`. Post-lapse: policy row shows lapsed pill (no further actions).
6. `firestore.rules` — new **Arm D** (BM-only settled→lapsed): OR'd with Arms A/B/C. Gate: `canManage(tenantId)` + role in `['platform_admin', 'tenant_admin', 'branch_manager']` (explicitly excludes UM + `canConfirmSettlements`-only) + `resource.data.status == 'settled'` + `affectedKeys().hasOnly(['status', 'statusUpdatedAt', 'dateLapsed', 'lapseReason'])` + `request.resource.data.status == 'lapsed'` + `request.resource.data.dateLapsed is timestamp`.
7. Tests: `policiesService.test.js` (lapsePolicy unit — batch shape, guard rejections, notification content) + `tests/rules/policies.rules.test.mjs` (Arm D ALLOW BM, DENY agent, DENY UM, DENY `canConfirmSettlements`-only UM, DENY non-settled source, DENY extra keys).
8. Docs: CONTEXT.md recently-shipped row + FOLLOW_UPS.md H11 lapse-half RESOLVED + H2c entries updated.

## Explicitly NOT in scope (do not build)
- Awards engine deduction logic for lapsed policies → H3.
- `usesPolicyLedger` flag + awards switch → H3.
- Bulk-lapse or grouped-by-agent lapse → H2b polish (already shipped, not this PR).
- Any change to the agent-side `isLegalAgentTransition` function (guard already exists).
- Re-instatement (lapsed → re-entry) — not in PRD.
- `canConfirmSettlements` users getting lapse rights — explicitly out (BM+ only).
- SettlementPanel / settlementService — untouched.
- Any Cloud Function changes — no CF involved.

---

## Locked spec

### `policyLifecycle.js` additions
```js
// POLICY_STATUSES — append 'lapsed'
export const POLICY_STATUSES = ['submitted', 'rated', 'postponed', 'ntu', 'denied', 'settled', 'lapsed'];

// POLICY_STATUS_LABELS — add entry
lapsed: 'Lapsed',

// TRANSITION_REQUIRED_FIELDS — add entry
lapsed: ['dateLapsed'],

// TRANSITION_OPTIONAL_FIELDS — add entry (create if not yet exported)
lapsed: ['lapseReason'],
```
Leave `isLegalAgentTransition` unchanged — the existing `if (to === 'lapsed') return false;` guard at line 34 is already correct.

### `policiesService.js` — `lapsePolicy`
```js
export async function lapsePolicy(tenantId, managerProfile, policyId, policy, fields) {
  // fields: { dateLapsed: Timestamp, lapseReason?: string }
  const { role } = managerProfile;
  if (!['branch_manager', 'tenant_admin', 'platform_admin'].includes(role)) {
    throw new Error('Only Branch Manager or above can lapse a policy.');
  }
  if (policy.status !== 'settled') {
    throw new Error('Only settled policies can be lapsed.');
  }
  const batch = writeBatch(db);
  const policyRef = doc(db, 'tenants', tenantId, 'policies', policyId);
  batch.update(policyRef, {
    status: 'lapsed',
    statusUpdatedAt: serverTimestamp(),
    dateLapsed: fields.dateLapsed,
    ...(fields.lapseReason ? { lapseReason: fields.lapseReason } : {}),
  });
  const historyRef = doc(collection(db, 'tenants', tenantId, 'policies', policyId, 'history'));
  batch.set(historyRef, {
    fromStatus: 'settled',
    toStatus: 'lapsed',
    changedFields: { dateLapsed: fields.dateLapsed, ...(fields.lapseReason ? { lapseReason: fields.lapseReason } : {}) },
    actorUid: managerProfile.uid,
    actorRole: managerProfile.role,
    agentId: policy.agentId,
    unitId: policy.unitId,
    at: serverTimestamp(),
  });
  const notifRef = doc(collection(db, 'tenants', tenantId, 'notifications'));
  batch.set(notifRef, {
    userId: policy.agentId,
    tenantId,
    type: 'policy_lapsed',
    title: 'Policy Lapsed',
    body: `Policy for ${policy.ownerName || policy.insuredName || 'your client'} has lapsed. This has been deducted from your Centurion progress.`,
    link: '/policies',
    read: false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
```

### `firestore.rules` — Arm D (add after Arm C, before `allow delete`)
```
// Arm D — BM-only settled→lapsed (H2c). Explicitly excludes UM and canConfirmSettlements-only.
allow update: if isSignedIn()
  && canManage(tenantId)
  && getRole() in ['platform_admin', 'tenant_admin', 'branch_manager']
  && resource.data.status == 'settled'
  && request.resource.data.status == 'lapsed'
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['status', 'statusUpdatedAt', 'dateLapsed', 'lapseReason'])
  && request.resource.data.dateLapsed is timestamp;
```
No change to the history subcollection's manager arm — it already allows any fromStatus/toStatus combination for BM+.

### `NotificationDrawer.jsx` — TYPE_META entry
```js
policy_lapsed: { Icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/10' },
```
Import `AlertTriangle` from lucide-react if not already imported (verify in Phase 1 — `policy_discrepancy` uses it).

### `PolicyLedgerPanel.jsx` — STATUS_BADGE_CLS + footer chip
```js
// STATUS_BADGE_CLS — append
lapsed: 'bg-gray-50 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400',
```
Footer logic: after the `confirmedAt` chip block, add:
```jsx
{p.status === 'lapsed' && p.dateLapsed && (
  <span className="text-xs text-ink-muted">
    Lapsed {formatDate(p.dateLapsed)}
  </span>
)}
```
Verify `formatDate` utility path in Phase 1 (check existing confirmed-at display for the correct helper).

### `PolicyReconciliationPanel.jsx` — "Lapsed" tab
- Add a tab selector: `['Confirm', 'Lapse']` (default: Confirm). Existing confirm logic unchanged under the Confirm tab.
- **Lapse tab** query: all `status === 'settled'` policies for the period (confirmed or not), scoped to manager's unit/branch. Reuse `getPoliciesForManager`; client-filter to `status === 'settled'` without the `!confirmedAt` restriction.
- Per policy row: policy identity (ownerName, insuredName, policyNumber, settledAPI). Expand toggle → form: date input for `dateLapsed` (required, validate is a valid date), text input for `lapseReason` (optional). "Confirm Lapse" button → calls `lapsePolicy()` → shows "Lapsed" pill on row; dismiss form.
- Already-lapsed policies (`status === 'lapsed'`): also visible in this tab with a "Lapsed on [date]" indicator and no further action button.
- 44px touch targets, Nexus tokens, no inline styles, loading/error/empty states.

---

## Phases (Windows PowerShell — one command per line, never `&&`)

### Phase 0 — branch
```
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/track-h-h2c-lapsed-status
```

### Phase 1 — read before writing (Rule 17)
**Source verify before touching anything:**

1. Confirm `POLICY_STATUSES` has no `lapsed` yet:
   ```
   git grep "POLICY_STATUSES" src/constants/policyLifecycle.js
   ```
2. Confirm `isLegalAgentTransition` already rejects `lapsed` at line 34:
   ```
   git grep -n "lapsed" src/constants/policyLifecycle.js
   ```
3. Confirm `TRANSITION_REQUIRED_FIELDS` and `TRANSITION_OPTIONAL_FIELDS` export shape (both may not yet exist as named exports):
   ```
   git grep -n "TRANSITION_REQUIRED_FIELDS\|TRANSITION_OPTIONAL_FIELDS" src/constants/policyLifecycle.js
   ```
4. Confirm no `lapsePolicy` in policiesService.js:
   ```
   git grep "lapsePolicy" src/services/policiesService.js
   ```
5. Confirm manager history arm has no fromStatus/toStatus constraint (firestore.rules ~line 387):
   Read `firestore.rules` lines 382–406.
6. Confirm `AlertTriangle` is already imported in `NotificationDrawer.jsx`:
   ```
   git grep "AlertTriangle" src/components/ui/NotificationDrawer.jsx
   ```
7. Confirm `STATUS_BADGE_CLS` in `PolicyLedgerPanel.jsx` has no `lapsed` entry:
   ```
   git grep -A 8 "STATUS_BADGE_CLS" src/components/agent/PolicyLedgerPanel.jsx
   ```
8. Confirm confirmed-at chip display in `PolicyLedgerPanel.jsx` and the date helper used:
   Read `PolicyLedgerPanel.jsx` footer section (~lines 280–310).
9. Confirm `PolicyReconciliationPanel.jsx` tab structure (if any) and current settled filter:
   ```
   git grep -n "status.*settled\|confirmedAt\|tab" src/components/manager/PolicyReconciliationPanel.jsx
   ```
10. Confirm `getPoliciesForManager` signature in `policiesService.js`:
    ```
    git grep -n "getPoliciesForManager" src/services/policiesService.js
    ```
11. Confirm `policy_discrepancy` exists in `NotificationDrawer.jsx` TYPE_META (to verify import shape):
    ```
    git grep -n "policy_discrepancy\|TYPE_META" src/components/ui/NotificationDrawer.jsx
    ```
12. Read `tests/rules/policies.rules.test.mjs` to understand test fixture shape and how Arm C is currently tested (to model Arm D tests the same way).
13. Read `src/services/__tests__/policiesService.test.js` to understand mock pattern for `confirmPolicy` (to model `lapsePolicy` tests).
14. Paired Phase 1 source-verify: `git ls-files | Select-String "policyLifecycle"` (path accuracy); `git ls-files | Select-String "policiesService"` (path accuracy).

If any Phase 1 find contradicts a brief premise, **STOP and wait for dispatcher** before proceeding.

### Phase 2 — build

**Order:**
1. `src/constants/policyLifecycle.js` — add `lapsed` to POLICY_STATUSES, POLICY_STATUS_LABELS, TRANSITION_REQUIRED_FIELDS, TRANSITION_OPTIONAL_FIELDS.
2. `src/services/policiesService.js` — add `lapsePolicy` export (spec above).
3. `src/components/ui/NotificationDrawer.jsx` — add `policy_lapsed` to TYPE_META.
4. `src/components/agent/PolicyLedgerPanel.jsx` — add `lapsed` to STATUS_BADGE_CLS; add lapse-date chip in footer (H11 lapse half).
5. `firestore.rules` — add Arm D after Arm C (before `allow delete`).
6. `src/components/manager/PolicyReconciliationPanel.jsx` — add "Lapsed" tab.

### Phase 3 — tests / lint / build

**Emulator rules tests** (`tests/rules/policies.rules.test.mjs`):
- Arm D ALLOW: BM lapses an in-scope settled policy (affectedKeys = `['status', 'statusUpdatedAt', 'dateLapsed']`).
- Arm D ALLOW: tenant_admin lapses a settled policy.
- Arm D DENY: agent tries to lapse (should fail — not in BM+ role list + Arm B rejects lapsed target).
- Arm D DENY: UM without `canConfirmSettlements` tries to lapse (not in `['platform_admin','tenant_admin','branch_manager']`).
- Arm D DENY: `canConfirmSettlements`-only UM tries to lapse (role is `unit_manager`, not in the Arm D list).
- Arm D DENY: lapse attempt on non-settled policy (`status == 'rated'`).
- Arm D DENY: extra key (`managerNote`) added beyond allowed `affectedKeys`.
- Arm D DENY: `dateLapsed` missing (not a timestamp).

**Unit tests** (`src/services/__tests__/policiesService.test.js`):
- `lapsePolicy` — non-BM role guard throws.
- `lapsePolicy` — non-settled policy guard throws.
- `lapsePolicy` — writeBatch: policy update + history doc + notification doc (3 writes total).
- `lapsePolicy` — `lapseReason` present: written to both policy update and history changedFields.
- `lapsePolicy` — `lapseReason` absent: not written to policy update or history.
- `lapsePolicy` — notification content: `type: 'policy_lapsed'`, `userId: policy.agentId`.

**Baseline:**
```
npx vitest run
npm run lint
npm run build
```
All must pass. Baseline before H2c: 1326/1326 (post PR #319 Track E(c) open).

### Phase 4 — docs (`#TBD` placeholders)
- `docs/CONTEXT.md`: add recently-shipped row `H2c | feat/track-h-h2c-lapsed-status | #TBD | {SHA}`.
- `docs/FOLLOW_UPS.md`:
  - Mark `## Track H — H11 agent-side discrepancy/lapse surfacing` lapse half: **RESOLVED H2c #TBD `{SHA}`**.
  - Update H2c status from PLANNED to SHIPPED.
- No PRD file change required (PRD §7 H2c entry exists; mark shipped in FOLLOW_UPS only).

### Phase 5 — push + PR (Rule 18; STOP at PR open — no self-merge per Rule 19)
```
git add -A
git commit -m "feat(policy-ledger): Track H H2c — BM lapsed status + agent notification + H11 lapse chip"
git push -u origin feat/track-h-h2c-lapsed-status
git rev-parse HEAD
git rev-parse origin/feat/track-h-h2c-lapsed-status
```
Paste both SHAs (must match). Open PR with smoke box **unchecked** (rules deploy is post-merge per Rule 19).

### Phase 6 — POST-merge (separate dispatch; Rule 19)
1. Sync main, capture squash SHA, fill `#TBD`/`{SHA}` placeholders, commit direct to main, Rule 15 verify.
2. `firebase deploy --only firestore:rules` — paste output verbatim.
3. Two-actor smoke:
   - As **test agent**: create and transition a policy to `settled` (with `settledAPI`). Verify it appears on the agent's Policy Ledger as "Settled".
   - As **branch_manager**: open Policy Reconciliation → Lapse tab → find the settled policy → expand → enter `dateLapsed` → click "Confirm Lapse".
   - Reload as agent: verify the policy now shows "Lapsed" badge (muted/grey) + lapse-date chip on the ledger. Verify a `policy_lapsed` notification appears in the notification drawer with the AlertTriangle icon.
   - Check Firestore: policy doc `status == 'lapsed'`, `dateLapsed` present. History subcollection: `fromStatus: 'settled', toStatus: 'lapsed'`. Notifications: `type: 'policy_lapsed'`, `userId == agentId`.
   - Report 4/4 or note which steps failed. STOP — cleanup (policy delete with `-r` history, notification delete) is a separate admin step.

---

## Expected file set (scope check — `gh pr diff <n> --name-only` must equal this exactly)
- `firestore.rules`
- `src/constants/policyLifecycle.js`
- `src/services/policiesService.js`
- `src/components/ui/NotificationDrawer.jsx`
- `src/components/agent/PolicyLedgerPanel.jsx`
- `src/components/manager/PolicyReconciliationPanel.jsx`
- `tests/rules/policies.rules.test.mjs`
- `src/services/__tests__/policiesService.test.js`
- `docs/CONTEXT.md`, `docs/FOLLOW_UPS.md`
- **NO** `firestore.indexes.json` (reuses `getPoliciesForManager` output, client-filtered). **NO** awardsEngine / settlements / CF / WizardForm / Step files.

## Acceptance criteria
- `lapsePolicy` is BM+ only: agent and UM calls are rejected; non-settled source is rejected.
- `lapsePolicy` writes 3 docs atomically: policy update (`status: 'lapsed'`, `dateLapsed`), history (`fromStatus: 'settled'`, `toStatus: 'lapsed'`), notification (`type: 'policy_lapsed'`).
- `lapseReason` is truly optional: absent from update doc and history changedFields when not provided.
- Arm D ALLOW for BM/tenant_admin/platform_admin; DENY for agent, UM, canConfirmSettlements-only UM. All via `assertFails`.
- Agent ledger: lapsed policy shows muted/grey badge + lapse-date chip (H11 lapse half).
- Reconciliation panel: "Lapsed" tab lists settled policies with inline lapse form; post-lapse row shows lapsed indicator with no further action button.
- `policy_lapsed` notification renders with AlertTriangle icon in the drawer.
- awardsEngine untouched. SettlementPanel untouched. No new composite index.

# Track H — H2a: Manager Policy Confirmation (BUILD LOCK)

**Branch:** `feat/track-h-h2a-manager-confirmation`
**Depends on:** H1.2 (#302) shipped + deployed.
**Banked decisions (dispatcher + Kyron, 2026-05-25):**
- Manager confirms `managerSettledAPI` + `managerNote` only; `hasDiscrepancy = managerSettledAPI ≠ agent's settledAPI` (exact match, no tolerance). Other settled fields stay agent-reported.
- **Confirm-only** — the manager writes confirmation fields; does NOT change the agent's status or entered values.
- Reconciliation list = `status == 'settled'` AND `confirmedAt` absent, scoped to the manager's unit/branch, for a selected period keyed by `dateIssued` month.
- Lapsed → H2c. Settlements run parallel; `usesPolicyLedger` + the awards switch → H3. Reuse `canConfirmSettlements` (no new flag).

---

## In scope (H2a walking skeleton)
1. Rules: new **Arm C** (manager confirmation) + a **manager-write arm** on the `history` subcollection. Fold in banked loosening **#1** (Arm B per-target `hasOnly`) and **#2** (history-create parent-policy ownership check), since this rewrites that region.
2. Service: `confirmPolicy(...)` — atomic `writeBatch`: policy confirmation fields + a manager `history` doc + (only on discrepancy) an agent notification.
3. UI: a minimal **Policy Reconciliation** tab in `ManagerDashboard` — in-scope settled-unconfirmed list for a selected month, per-policy confirm form (`managerSettledAPI` + `managerNote`), writes the fields + `hasDiscrepancy`, fires the agent notification on a discrepancy, shows a "Confirmed by [Name]" indicator.
4. Emulator + unit tests; two-actor production smoke (Phase 6).

## Explicitly NOT in scope (do not build)
- §7.8 polish — grouped-by-agent, side-by-side editable, **bulk-confirm** → **H2b.**
- **Lapsed** (BM-only Settled→Lapsed arm + lapse notification) → **H2c.**
- Any manager **status/value override** of the agent's entry → later.
- `usesPolicyLedger` + awards-engine switch → **H3** (engine still reads settlements only; do not touch it).
- `getPolicyHistory` read fix + history-display UI → stays on its existing FU (banked loosening **#3** is NOT in H2a).
- Settlement retirement → H5; `SettlementPanel` runs unchanged in parallel.
- No new submissions/settlements/awards/CF files.

---

## Locked spec

### Manager confirmation fields (written on confirm)
- `confirmedByManager` (string — manager's display name)
- `confirmedByUid` (string — MUST equal `request.auth.uid`)
- `confirmedAt` (serverTimestamp)
- `managerSettledAPI` (number, `parseFloat`, > 0)
- `managerNote` (string, optional — empty string allowed)
- `hasDiscrepancy` (bool — computed = `managerSettledAPI !== policy.settledAPI`, exact)

### `firestore.rules` — policies block
- `get` / `list` / `create` / `delete`: UNCHANGED.
- **Arm A** (agent body-edit): UNCHANGED.
- **Arm B** (agent transition): replace the union `hasOnly` with **per-target field sets** (loosening #1) — for each target status, allow only `status`, `statusUpdatedAt`, and that status's own fields. Keep the existing legal-transition gate and value-guards.
- **NEW Arm C** (manager confirmation), OR'd in:
  - Gate: `isSignedIn() && canManage(tenantId)` AND `(getRole() in ['platform_admin','tenant_admin'] || getRole() == 'branch_manager' || get(/…/users/$(request.auth.uid)).data.canConfirmSettlements == true)` AND `(getRole() != 'unit_manager' || resource.data.unitId == request.auth.uid)` — mirrors the settlements gate + the existing UM unit-scoping.
  - Only when `resource.data.status == 'settled'`.
  - `affectedKeys().hasOnly(['confirmedByManager','confirmedByUid','confirmedAt','managerSettledAPI','managerNote','hasDiscrepancy'])` — NOT `status`, NOT any agent field.
  - Value-guards: `confirmedByUid == request.auth.uid`, `managerSettledAPI is number && > 0`, `hasDiscrepancy is bool`.
- `history` subcollection:
  - **Agent arm** (existing): keep, and ADD the parent-policy ownership check (loosening #2) — `get(/…/policies/$(policyId)).data.agentId == request.auth.uid`.
  - **NEW manager arm**: `canManage(tenantId)` + in-scope via `get(/…/policies/$(policyId))` (UM → parent `unitId == uid`; BM/admin → tenant) + `actorUid == request.auth.uid` + valid manager-history shape. Allow `fromStatus == toStatus` (a confirm event is a field-change, not a transition).
  - `update` / `delete`: still `if false`.
- **No new composite index expected** (reconciliation client-filters `getPoliciesForManager` output). Flag if one turns out necessary.

### `history` doc shape (manager confirm event)
`{ fromStatus: 'settled', toStatus: 'settled', changedFields: { managerSettledAPI, hasDiscrepancy, managerNote? }, actorUid, actorRole: <manager role>, agentId: <policy.agentId>, unitId: <policy.unitId>, at: serverTimestamp }`

### Agent notification (only on discrepancy) — match the existing `notifications` schema
`{ userId: policy.agentId, tenantId, type: 'policy_discrepancy', title, body (names the policy + the manager-confirmed vs agent value), link, read: false, createdAt: serverTimestamp }`

### `src/services/policiesService.js`
- New export `confirmPolicy(tenantId, managerProfile, policyId, policy, managerSettledAPI, managerNote)`:
  - `parseFloat(managerSettledAPI)`, require `> 0`.
  - `hasDiscrepancy = managerSettledAPI !== policy.settledAPI`.
  - One `writeBatch`: `update` the policy (the 6 confirmation fields) + `set` a manager `history` doc + (if `hasDiscrepancy`) `set` a notification doc. Commit atomically.
- Reconciliation read: REUSE `getPoliciesForManager`; client-filter to `status === 'settled' && !confirmedAt && dateIssued` in the selected month. No new service query, no new index.
- Leave all existing exports unchanged.

### UI — `ManagerDashboard` + new `PolicyReconciliationPanel.jsx`
- New tab (e.g. "Policy Reconciliation"), visibility gated like `SettlementPanel`'s `canAccess` (BM / tenant_admin / platform_admin / `canConfirmSettlements`).
- Month selector. Flat list of in-scope settled-unconfirmed policies. Per policy: show the agent's `settledAPI`; manager inputs `managerSettledAPI` + `managerNote`; Confirm → `confirmPolicy`. Post-confirm: "Confirmed by [Name]" + a discrepancy badge if flagged.
- Single-policy confirm only (no bulk, no grouped side-by-side — that's H2b). Handle loading / error / empty. Nexus tokens, 44px, no inline styles, `parseFloat` on the input.

---

## Phases (Windows PowerShell — one command per line, never `&&`)

### Phase 0 — branch
```
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/track-h-h2a-manager-confirmation
```

### Phase 1 — read before writing (Rule 17)
Read fully: the `match /policies` block + read helpers + the settlements block in `firestore.rules`; `src/services/policiesService.js`; `src/services/settlementService.js` + `SettlementPanel.jsx` (confirm-flow model + `canAccess`); `ManagerDashboard.jsx` (tab wiring + component path); `notificationService.js` (notification schema); `tests/rules/policies.rules.test.mjs` + `policiesService.test.js`. Pair grep with `git ls-files`.

### Phase 2 — build
Rewrite the policies update rule (Arm B per-target tightening + new Arm C) and the `history` create rule (parent-ownership on the agent arm + new manager arm); add `confirmPolicy` to `policiesService.js`; create `PolicyReconciliationPanel.jsx`; wire the tab into `ManagerDashboard.jsx`.

### Phase 3 — tests / lint / build
- Emulator (`policies.rules.test.mjs`), every DENY via `assertFails`:
  - Arm C ALLOW: BM confirms in-scope settled policy (writes the 6 fields). canConfirmSettlements-UM confirms own-unit settled policy.
  - Arm C DENY: plain agent writes manager fields; UM without the flag; UM confirming another unit's policy; confirming a non-settled policy; an `affectedKeys` set including `status` or an agent field; `confirmedByUid != uid`.
  - Arm B (tightened): settled-only field on an `ntu` transition now DENY.
  - History: manager arm ALLOW in-scope; DENY out-of-scope; agent-arm orphan-history under another agent's policy now DENY (loosening #2).
- Unit (`policiesService.test.js`): `confirmPolicy` — `hasDiscrepancy` true/false, `parseFloat`, single batch writes policy + history (+ notification only when discrepancy).
- `npx vitest run` · `npm run lint` · `npm run build` — all green.

### Phase 4 — docs (`#TBD` placeholders)
- `docs/CONTEXT.md`: recently-shipped row for H2a.
- `docs/FOLLOW_UPS.md`: mark banked loosenings **#1 (Arm B per-target)** and **#2 (history-create ownership)** RESOLVED. Leave the history-display-UI FU (incl. loosening #3 / `getPolicyHistory`) OPEN.
- PRD §7 file: note manager confirmation (H2a) shipped; §7.8 bulk/grouped polish + Lapsed still pending.

### Phase 5 — push + PR (Rule 18; STOP at PR open — no merge, no deploy)
```
git add -A
git commit -m "feat(policy-ledger): H2a manager confirmation arm + reconciliation panel"
git push -u origin feat/track-h-h2a-manager-confirmation
git rev-parse HEAD
git rev-parse origin/feat/track-h-h2a-manager-confirmation
gh pr create --title "feat(policy-ledger): Track H H2a — manager confirmation + reconciliation" --body "<summary + checklist; Smoke box UNCHECKED — rules deploy is post-merge>"
```
Paste both SHAs verbatim (must match). Smoke box unchecked.

### Phase 6 — POST-merge (separate dispatch, after Kyron merges; Rule 19)
1. Sync main, capture squash SHA, fill `#TBD`, push direct to main, Rule 15 verify.
2. `firebase deploy --only firestore:rules` (no indexes expected). Paste output verbatim.
3. Two-actor smoke: as the **test agent**, create a policy and transition it to Settled (known `settledAPI`); then as the **tenant_admin** (in the confirm gate), open Policy Reconciliation → confirm that policy with a `managerSettledAPI` that DIFFERS from the agent's → reload → assert the confirmation fields persist, a manager `history` doc exists, `hasDiscrepancy == true`, and an agent notification was written. Capture the policy doc path. Report; STOP (admin cleanup separate — needs `-r` for the history subcollection, plus deletion of the notification doc).

---

## Expected file set (scope check — `gh pr diff <n> --name-only` must equal this exactly)
- `firestore.rules`
- `src/services/policiesService.js`
- `src/components/manager/PolicyReconciliationPanel.jsx` (new)
- `src/components/dashboard/ManagerDashboard.jsx` (tab wiring — confirm exact path in Phase 1)
- `tests/rules/policies.rules.test.mjs`
- `src/services/__tests__/policiesService.test.js`
- `docs/CONTEXT.md`, `docs/FOLLOW_UPS.md`, the PRD §7 file
- **NO** `firestore.indexes.json` (flag if a composite turns out necessary). **NO** submissions/settlements/awards/CF/notificationService files.

## Acceptance criteria
- Arm C lets BM/admin/`canConfirmSettlements` confirm in-scope settled policies and nothing else; every illegal case denied via `assertFails`; manager cannot write `status` or agent fields.
- `confirmPolicy` writes the 6 fields + a manager history doc + (only on discrepancy) a notification, all in one batch; `parseFloat`; exact `hasDiscrepancy`.
- Banked loosenings #1 and #2 closed; #3 untouched.
- Reconciliation tab gated to confirmers, shows in-scope settled-unconfirmed for the month, single-policy confirm; Nexus + 44px + loading/error/empty.
- No new index; awards engine untouched; settlements untouched.

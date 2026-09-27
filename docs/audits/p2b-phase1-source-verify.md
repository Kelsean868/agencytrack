# P2b branch scoping — Phase 1 source-verify

Brief: `docs/briefs/p2b-branch-scoping.md`. Source read at `662e7b4` (main, 2026-09-27). Built from code
paths and `scripts/audit/branch-unit-integrity-probe.mjs`. Production was not read.

## Table

| # | Collection / CF | Current check | `branchId` on doc today? | Who reads / writes it (component → query) |
|---|---|---|---|---|
| 1 | `users` update, manager edit arm (`firestore.rules` `match /users/{userId}` `allow update`) | `canManage(tenantId)` + field allowlist. UM limited to `callerUnitId == resource.data.unitId`. **BM, SM and TA can edit any user in the tenant.** | **yes.** `createUser` always stamps it, falling back to `'tatil_south'` when the caller has none. The probe reports legacy or seeded users with no `branchId` as informational. | `EditUserDrawer` → `userService.updateUserFields` (`updateDoc`). Its list comes from `UserManagementPanel` → `managerService.getTenantUsers`: BM `where('branchId','==',claims.branchId)`, UM `where('unitId','==',uid)`. |
| 2 | `deactivateUser` CF (`functions/index.js`) | Signed in, not self, target in caller's tenant, `CREATION_MATRIX[callerRole]` includes the target role. **No branch or unit check.** | target user doc: **yes** | `agentManagementService` `httpsCallable('deactivateUser')` ← `UserManagementPanel` |
| 3 | `updateUser` CF (`functions/index.js`) | Signed in, not self, same tenant, two-sided `CREATION_MATRIX` (old and new role). Branch *reassignment* is limited to `CROSS_BRANCH_ROLES`. **A BM can change the role of a user in another branch** (the audit exploit). No unit check. | target user doc: **yes** | `userService` `httpsCallable('updateUser')` ← `EditUserDrawer` |
| 4 | `policies` get | own (`canAccessOwn`) · `canManage`: non-UM any, UM `resource.data.unitId == uid` · `cro` tenant-wide. **BM can read any branch.** | **some.** `createPolicy` stamps `agentProfile.branchId ?? null`. The OIPA import (script, and in-app CF via `buildImportPlan`) stamps it on **create only**, also `?? null`. | Single-doc gets happen only inside write batches. See row 5 for list reads. |
| 5 | `policies` list | same as get | some (as row 4) | **BM, SM, PA** `PolicyReconciliationPanel`, `useStrategicPlan` → `getPoliciesForManager`: BM `where tenantId, where branchId==scope.branchId, orderBy createdAt` (already filtered); UM `where unitId==uid`; SM/PA unfiltered. **BM, SM, PA** `FinancingProrationPanel` and `TakeHomeWaterfallView` (via `lib/financingProjectedBonus.getProjectedBonus`) → `getOwnPolicies(otherAgentId)`: `where agentId==X, orderBy createdAt`. **This has no branch filter, so it would start failing for a BM.** Agent, UM and BM own reads use `getOwnPolicies(own uid)` (AgentDashboard, useMyProduction, PolicyLedgerPanel, PersistencyTab, AgentAwardsPanel) and pass via `canAccessOwn`. |
| 6 | `policies` Arm C (manager confirm) | `canManage` + (PA/TA · BM · `canConfirmSettlements`) + UM unit + `status=='settled'` + field allowlist. **BM: any branch.** | some | `PolicyReconciliationPanel` → `confirmPolicy` (writeBatch: policy update + history + notification) |
| 7 | `policies` Arm D (settled→lapsed) | `canManage` + role in PA/TA/BM + provenance. **BM: any branch.** | some | `PolicyReconciliationPanel` → `lapsePolicy` (writeBatch) |
| 8 | `financingTerms/{agentId}` | get: `canAccessOwn(path agentId) \|\| canManage`. **UM: whole tenant.** write: BM/SM/TA same tenant + PA. **BM: any agent.** | **no.** No write path stamps it. | `getFinancingTerms` (`getDoc`) ← `FinancingTermsSetup`, `MonthlyStatementEntry`, `FinancingProrationPanel`, `FinancingReconciliationPanel`, `FinancingRiskPanel` (BM/SM/PA, other agents); `UnitFinancingRoster` (UM, unit fan-out); `FinancingSelfView` and `getProjectedBonus` (own, or a manager's selected agent). Writes: `setFinancingTerms`, `transitionFinancingStatus` (`setDoc` merge). |
| 9 | `financing/{agentId}_{YYYY_MM}` | get/list: own `\|\| canManage` (**UM: whole tenant**). write: BM/SM/TA + PA (**BM: any agent**) | **no** | `listFinancingMonths` → `where('agentId','==',X)`, equality only, no index ← same panels as row 8, plus `UnitFinancingRoster` (UM) and `FinancingSelfView` (own). **Manager calls carry no branch or unit filter, so they would start failing.** `getFinancingMonth` has no callers. Writes: `setFinancingMonth`, `setFinancingProration`. |
| 10 | `financingReconciliation/{agentId}_{year}` | same as row 9 | **no** | `getFinancingReconciliation` (`getDoc`) ← `FinancingReconciliationPanel` (BM/SM/PA), `FinancingSelfView` (own). Write: `reconcileFinancing`. |
| 11 | `submissions` create/update, manager arm | `canManage(tenantId)`, no scope. **A UM or BM can write any submission in the tenant.** The `list` arm is already scoped: UM `unitId==uid`, BM `branchId==token.branchId`. | **yes.** Slice-2 backfill ran. `saveDraft` and `submitReport` stamp `unitId`/`branchId`. | Manager writers: `unlockService.unlockSubmission` (`updateDoc`, status→draft) from the review screens, plus a producing manager's own `saveDraft`/`submitReport`. |

## Write paths that leave docs without `branchId`

1. **All of `financingTerms`, `financing` and `financingReconciliation`.** None of `setFinancingTerms`, `transitionFinancingStatus`, `setFinancingMonth`, `setFinancingProration` or `reconcileFinancing` writes `branchId` or `unitId`. No doc in these three collections carries them today. The fixture seeders do not stamp them either (`scripts/staging/seed-fixtures.mjs`, `scripts/verification/seed-financing-*.mjs`).
2. **`policies` in two cases:**
   - When the agent's user doc has no `branchId` at write time, because `createPolicy` and `buildImportPlan` write `?? null`.
   - Docs created before the H1 stamp. The OIPA import's **update** path never re-stamps `branchId`/`unitId`, so it cannot repair an older doc.
3. **`users`: legacy or seeded docs only.** `createUser` always stamps `branchId`. The probe's "no branchId" list is the set of users whose docs the backfill would report as *cannot resolve*.
4. **`unitId` is legitimately absent for BM, SM and TA owners.** A BM's own policy or financing doc has no unit. A UM's unit is their own uid (`buildDocFields`: `doc.unitId = newUid`). Staging seeds a BM policy with `unitId: '__branch_direct__'`.

## STOP check

1. **No doc type lacks a derivation — not triggered.** Every in-scope doc carries `agentId` (for `financingTerms` the doc ID *is* the agentId). The agent's user doc is where `branchId`/`unitId` live, and `createUser` always writes `branchId`. Any production residue (a user with no `branchId`) is caught by the backfill's `cannot resolve` list, which gates `--apply` in the deploy order.
   - Owners with no unit (BM, SM, TA) are set branch-only and reported under their own heading, not as cannot-resolve.
2. **A needed index can't be added — not triggered.** Scoping `getOwnPolicies(otherAgent)` for a manager needs `policies (agentId, branchId, createdAt desc)`, plus `(agentId, unitId, createdAt desc)` for the UM form. Both can be added in `firestore.indexes.json`. The financing lists stay equality-only, so they need no composite.

## Interpretations the build will follow

1. **UM identity.** A UM's own unit is `request.auth.uid`, matching the existing `policies`/`submissions`/`users` list arms. The client filters with `where('unitId','==',uid)`.
2. **BM identity.**
   - `policies`, `financing*` and `users` use `callerBranchId(tenantId)` (the user doc), as the brief says.
   - `submissions` uses `request.auth.token.branchId`, to "match the existing list arm".
3. **UM on financing: reads narrowed to own unit, writes stay excluded** (contract 5.3). I read the brief's "read + write … UM own unit only" as a ceiling, not a new write grant.
4. **Missing financing docs.** A manager `getDoc` on a doc that doesn't exist yet ("no terms yet") keeps working through an explicit `resource == null` arm. That reveals nothing.
5. **Manager-side client reads get a `scope` argument.** It is shaped like `getPoliciesForManager`'s `{role, uid, branchId}`, on `getOwnPolicies`, `listFinancingMonths` and `getProjectedBonus`. BM adds `where('branchId','==',…)`, UM adds `where('unitId','==',uid)`, SM and PA add nothing.

## Adjacent findings — flagged, not fixed (outside the brief's list)

1. The `policies/{id}/history` manager read and manager create arms are still tenant-wide for a BM.
2. The `policies` create rule does not pin `request.resource.data.branchId` to the caller's own branch.
3. `getPoliciesForManager`'s fallback arm is unfiltered. This is correct for SM/PA and unchanged.

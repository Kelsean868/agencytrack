# Brief — Audit Phase 2c: financing integrity + P2b leftovers

**Model:** Opus 5.5 · **Effort:** high · **Runs as:** Claude Code cloud session
**Type:** rules + src (+ functions only if you move a write behind a callable) → human-merge. Kyron merges; deploys are run on Kyron's PC. Claude Code never merges, deploys or writes production data.
**Source:** `docs/audits/agencytrack-audit-2026-09-24.md` § SEC-09 and § BUG-07. Read both. Line numbers are from 24 Sep and moved in P2b (#987); find code by name.
**Builds on:** P2b (#987, `0e78089b`) — keep `managerDocInScope` / `bmFinancingWriteInScope` and every branch/unit scope it added. Do not widen any P2b scope.

One PR. Five parts.

## Part 1 — SEC-09: financing rules validate money and status

Collections: `financingTerms`, `financing` (monthly ledger), `financingReconciliation`.
1. `hasOnly` key allowlists on create and update for all three. Build each list from every field the services write today (grep the services and the import/seed scripts). A field you are unsure about goes in the list and in the Phase 0 table.
2. Bound `adjustmentPct` to `-1 <= x <= 1`. Keep amounts typed and `>= 0` where they are today.
3. `runningBalance`: type number; state in the PR what bound (if any) is safe, from the service code.
4. `financingStatus`: encode the legal transitions in rules, the same way `isLegalAgentTransition` does for policies. Mirror the transition table the service uses — one source of truth: if a constants file holds it, the rules comment names that file.
5. Keep P2b's scope checks on every arm.

## Part 2 — BUG-07: financing writes are atomic

File: `src/services/financingService.js`.
1. Status transition (`getDoc` → `isLegalFinancingTransition` → `setDoc`): wrap in one `runTransaction`. Re-check legality inside the transaction.
2. `reconcileFinancing`: the reconciliation doc write and the status transition happen in one transaction (or one batch if no read is needed). No second separate write.
3. Keep the P2b `branchId` / `unitId` stamping inside the transaction.
4. Tests: concurrent transition → one wins, the other gets a clear error; reconcile failure mid-way → neither doc changes.

## Part 3 — P2b leftovers (branch scoping)

1. Policy history (`policies/{policyId}/history/{historyId}`): a BM reads history only for policies in their own branch; UM own unit; SM/TA/PA tenant; agent own policies. Use the parent policy's `branchId`/`unitId` (a `get()` on the parent is fine).
2. Policy create: `request.resource.data.branchId` must equal the creator's own `branchId` (user doc), and `unitId` must match too where the creator has one. The OIPA import path already stamps these — confirm it still passes.

## Part 4 — Agent Production Report: no tenant-wide user read

File: `src/components/productionReport/AgentProductionView.jsx` calls `getTenantUsers(tenantId)`. The users `list` rule allows managers only, so an agent session logs `Missing or insufficient permissions`.
1. Find what the view uses the user list for. Replace it with a read the agent is allowed to make (own user doc, or data already on the agent's own docs), or drop it if unused.
2. Do NOT widen the users `list` rule.
3. Test: agent session renders the Production Report with no permission error; the numbers it shows are unchanged.

## Part 5 — Sales manager can use Policy Reconciliation

Ruling (Kyron, 27 Sep 2026): `sales_manager` must be able to see Policy Reconciliation. Today `src/components/manager/PolicyReconciliationPanel.jsx` shows "You do not have access to Policy Reconciliation." for SM (its role lists hold branch_manager, tenant_admin, platform_admin).
1. Add `sales_manager` to the view gate. SM scope is tenant-wide (all branches), same as tenant admin.
2. The panel has a second role list (actions). Give SM the actions only if the current rules already allow SM those writes; otherwise leave SM view-only and say so in the PR. Do not widen write rules for this.
3. Check the nav item shows for SM and the panel loads with no permission errors.

## Phase 0 — Source-verify (PR comment before code)

One table: part · file / rule block · what it does today · what changes. Plus the full `hasOnly` field list per financing collection with where each field is written.
STOP and report if: a field is written by a path you can't find in the repo, or the service's transition table disagrees with the constants/UI.

## Tests

1. Rules tests (emulator): for each financing collection — unknown key denied; `adjustmentPct` 1.5 denied; illegal status transition denied; legal transition allowed; P2b scope cases still pass. Policy history: BM own branch allowed, other branch denied. Policy create with another branch's `branchId` denied.
2. Service tests for Part 2 (transaction behaviour) and Part 4.
3. Component test for Part 5: SM sees the panel.
4. Paste counts: lint, root tests, functions tests (if touched), rules tests, build.
5. Prove the new deny tests bite: run them against `main`'s rules and list which fail there.

## Out of scope

Kiosk (SEC-04), App Check (SEC-11), BUG-01/02/04 (that is P2d), the 40-applications company minimum, any UI redesign.

## Deliverables

1. One PR, with the Phase 0 table posted as a comment before code.
2. PR body section "Deploy for Kyron": the exact `firebase deploy --only …` command for what changed (rules; indexes if any; functions only if touched). Say if any existing financing doc would fail the new `hasOnly` / transition rules on its next update — the dry-run count from a read-only query script, if one is needed, with the command to run it.
3. Post-deploy smoke walk (in the PR body), read-only:
   1. Sales manager: open Policy Reconciliation → loads, no "no access" message.
   2. Branch manager: Financing (all tabs) and Policy Ledger load; a policy's history opens.
   3. Agent: Production Report loads with no permission error in the console.
   4. Functions / Firestore logs: no new permission-denied spike in the first hour.

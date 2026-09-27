# Brief — Audit Phase 2b: branch scoping (SEC-05, SEC-08 + `branchId` backfill)

**Model:** Opus 5.5 · **Effort:** high · **Runs as:** Claude Code cloud session
**Type:** rules + functions + backfill script → human-merge. Kyron runs the backfill and the deploy. Claude Code never merges, deploys or writes production data.
**Source:** `docs/audits/agencytrack-audit-2026-09-24.md` § SEC-05 and § SEC-08. Read both before you start. Line numbers are from 24 Sep; find code by name if it moved.

One PR.

## The rule we are enforcing

| Role | Can see / change |
|---|---|
| agent | own docs only (unchanged) |
| unit_manager | own unit only |
| branch_manager | own branch only |
| sales_manager, tenant_admin, platform_admin | whole tenant (unchanged — do not narrow these) |
| kiosk | unchanged by this PR |

## Phase 1 — Source-verify (report before coding)

Post one PR comment with a table: collection or CF · current check · has `branchId` on the doc today? (yes / some / no) · who reads it (component + query).
Cover: `users` rule manager arm; `deactivateUser`; `updateUser`; `policies` (get, list, Arm C confirm, Arm D settled→lapsed); `financingTerms`; `financing`; `financingReconciliation`; `submissions` create/update manager arm.
Also state which write paths leave docs without `branchId` — from code paths and `scripts/audit/branch-unit-integrity-probe.mjs`, not by reading production.

STOP and report if either is true:
1. A doc type has no reliable way to derive `branchId` (for example an agent with no `branchId` on their user doc).
2. A client query would need a new composite index that you cannot add in `firestore.indexes.json`.

## Phase 2 — Stamp `branchId` on new writes

1. Policies: stamp `branchId` (and `unitId`) from the agent's user doc on create, in the policy service and in `scripts/ops/import-oipa-portfolio.mjs`.
2. Financing, financingTerms, financingReconciliation: same, from the agent's user doc.
3. All writes stay in service files. No inline Firestore calls in components.

## Phase 3 — Backfill script

File: `scripts/maintenance/backfill-branchid-p2b.mjs`. Copy the pattern of `scripts/maintenance/backfill-submission-branchid.mjs`.
1. Dry-run by default. `--apply` to write. `--tenant <id>` required.
2. For each doc missing `branchId` (or `unitId`): read the agent's user doc, set both. Batched, idempotent, safe to re-run.
3. Print a summary: scanned · already OK · would update · cannot resolve (list doc IDs + reason).
4. Never overwrite an existing `branchId` that differs. List it under "conflicts" instead.

## Phase 4 — Rules (SEC-08)

1. `policies` get/list: BM arm adds `resource.data.branchId == callerBranchId(tenantId)`. UM arm stays unit-scoped.
2. `policies` Arm C (confirm) and Arm D (settled→lapsed): BM own branch only.
3. `financingTerms`, `financing`, `financingReconciliation` read + write: BM own branch; UM own unit only; SM/TA tenant.
4. `submissions` create/update manager arm: UM own unit, BM own branch (match the existing `list` arm).
5. Update every client query the Phase 1 table found so it carries the matching `where('branchId', '==', …)` or `where('unitId', '==', …)`. No screen may start failing for a BM or UM.

## Phase 5 — Functions (SEC-05)

1. `deactivateUser` and `updateUser`: for a `branch_manager` caller, require `target.branchId === caller.branchId`; for a `unit_manager`, require `target.unitId === caller.unitId`. Else throw `permission-denied`.
2. `updateUser`: a BM may not change the role of a user outside their branch (the audit's exploit).
3. `users` rule, manager edit arm: BM path adds `resource.data.branchId == callerBranchId(tenantId)`.

## Tests

1. Rules tests (emulator): for each collection in Phase 4 — BM own branch allowed; BM other branch denied; UM own unit allowed; UM other unit denied; SM any branch allowed. Include the audit exploits: BM lapses another branch's policy → denied; UM reads another unit's financing → denied.
2. Functions tests: `deactivateUser` and `updateUser` — BM own branch OK; BM other branch `permission-denied`; UM other unit denied; SM/TA any branch OK.
3. Backfill script: unit test on fixtures — missing field set; existing same value skipped; conflicting value reported, not written; unresolvable agent reported.
4. Paste counts for root tests, functions tests, rules tests and lint in the PR.
5. Cloud session note: if the Firestore emulator cannot start here (no Java), say so in the PR under "Not run here" and list the exact command Kyron runs on his PC. Do not skip writing the rules tests.

## Out of scope

Financing money validation (SEC-09, that is P2c). Kiosk (SEC-04). App Check. Persistency (already scoped in S1). Company-minimum 40-apps floor. Any UI redesign.

## Deliverables

1. One PR with Phases 2–5 and their tests.
2. The Phase 1 table as a PR comment, posted before code.
3. PR body section "Deploy order for Kyron" — exactly this order, because rules deployed before the backfill would hide branchless docs from managers:
   1. Merge.
   2. `node scripts/maintenance/backfill-branchid-p2b.mjs --tenant tatillife_south` (dry run) → paste the summary back to Claude.
   3. If "cannot resolve" and "conflicts" are 0: re-run with `--apply`.
   4. `firebase deploy --only firestore:rules,firestore:indexes,functions --project agencytrack-2a610`
   Name the functions that changed. Warn if the deploy deletes or renames any function.
4. Post-deploy smoke walk for Kyron (in the PR body, read-only apart from normal use):
   1. As yourself (tenant admin): Policy Ledger, Financing and Team pages load with all branches.
   2. As the branch manager: own branch's policies, financing and agents load; no empty screens that were full before.
   3. As an agent: Home, Campaign and Policy Ledger still load own data.
   4. Firebase Console → Firestore → Rules → usage: no spike in denied reads in the first hour.
   5. Functions logs: no new errors from `deactivateUser` / `updateUser`.

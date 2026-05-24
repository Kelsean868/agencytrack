# Track H — H1 Policy Ledger (Walking Skeleton) — Build Lock / Dispatch

**Type:** Feature — first slice of the Track H (Policy Ledger) arc.
**Branch:** `feat/track-h-h1-policy-ledger`
**Phase 1 verify:** complete (against current main). Key findings baked in below.
**Scope class:** NEW Firestore collection + rules + indexes + agent UI + tests. No submissions/settlements/awards changes.
**Environment:** Windows PowerShell. One command per line — never `&&`. All blocks from repo root `C:\Projects\AgencyTrack`.

---

## What H1 is (and is NOT)

H1 is the **walking skeleton**: an agent can **create** a policy-ledger entry and see their **own list**. Nothing else. It proves the collection, rules, indexes, and the locked schema end-to-end on a real foundation before any lifecycle complexity layers on.

**IN H1:** new `policies` collection; complete locked schema (all four workshop fields *defined*); rules (agent create/edit-own + managers-in-scope read) + emulator tests; the composite indexes H1's queries need; agent create form; agent own-list view; PRD §7.4/§9 doc update.

**NOT in H1 (deferred — do not build):**
- Lifecycle state machine / status transitions (Submitted → Rated/NTU/Settled) and the two-arm manager-confirmation update rule → **H1.2**
- `history` subcollection → H1.2
- Manager reconciliation UI → **H2**
- Awards-engine integration via `usesPolicyLedger` → **H3** (Track-D-dependent)
- Plan config (`config/policyPlans`) → **H4**
- Settlement retirement → **H5** (post-pilot)
- **No changes to submissions, settlements, or the awards engine.** The ledger is parallel (soft-migration). Touch none of them.

## Verify findings that constrain this build

- No `policies` collection exists today — build from scratch.
- `agentType` enum was pre-empted by `isBdoDso: boolean` — **do not add `agentType`** (PH7-8-Q5 closes in docs).
- Source-of-Prospect reuses `PROSPECTING_SOURCES` / `PROSPECTING_SOURCE_LABELS` from `src/services/prospectInfoService.js` — **import from there, do not duplicate** (the file even comments that it feeds Track H).
- Rules pattern = the **submissions** collection (flat, agent owns own, managers read in-scope, UM needs `unitId` denorm + query filter). Model the new block on it.
- PRD §7.4 (schema) and §9 (out-of-scope) are pre-workshop and stale — update them this PR (per the workshop directive).

## Decisions (do not re-litigate)

- Collection: `/tenants/{tenantId}/policies/{policyId}` — flat, tenant-level (mirror submissions).
- **Doc shape = the PRD §7.4 creation fields (read §7.4 for the exact base list) PLUS the four locked §3.3 fields:**
  - `sourceOfProspect` — enum value from `PROSPECTING_SOURCES` (imported).
  - `cashWithApp: { collected: boolean, amount: number | null }` — `parseFloat` the amount.
  - `dateIssued` — schema-defined but **unpopulated in H1** (set on the Settled transition, deferred).
  - `policyDeliveryDate` — schema-defined but **unpopulated in H1** (Settled-state milestone, deferred).
  - Plus denormalized `unitId` + `branchId` (for UM/BM read filtering — mirror submissions' `unitId` denorm).
  - `status` — `'submitted'` is the only value written in H1.
  - `parseFloat` on `proposedAPI` and `cashWithApp.amount`.
- Everything flows through a new `policiesService.js` — no direct Firestore in components.

## Phase 0 — Branch

```powershell
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/track-h-h1-policy-ledger
```

## Phase 2 — Code

### `firestore.rules` — new `policies` block (model on the submissions block)
- **get:** `agentId == request.auth.uid` OR managers-in-scope (BM = `canManage` in-tenant; UM where `resource.data.unitId == request.auth.uid`).
- **list:** same; UM list queries must be constrained `where('unitId','==',uid)` — rule enforces, mirroring submissions.
- **create:** agent-only (`agentId == request.auth.uid`), `tenantId` match, `status == 'submitted'`, `sourceOfProspect` in the `PROSPECTING_SOURCES` allowlist (copy the enum list as the rule already does for `prospectInfo.create`), `dateWritten` not in the future, `proposedAPI > 0`.
- **update:** agent edits OWN policy **only while `status == 'submitted'`**, via a `hasOnly([...])` allowlist of editable body fields. (The two-arm manager-confirmation update is DEFERRED to H1.2 — do not add it.)
- **delete:** `if false`.

### `firestore.indexes.json` — H1 query indexes only
- `(agentId ASC, createdAt DESC)` — agent own-list
- `(tenantId ASC, unitId ASC, createdAt DESC)` — UM view
- `(tenantId ASC, branchId ASC, createdAt DESC)` — BM view

(The status-filter indexes are DEFERRED with the state machine.)

### `src/services/policiesService.js`
- `createPolicy(tenantId, data)` — validates, `parseFloat`s numerics, sets `status: 'submitted'`, denorms `unitId`/`branchId`, writes the doc.
- `getOwnPolicies(tenantId, agentId)` and `getPoliciesForManager(tenantId, scope)` (or equivalent) — the two read paths.

### UI (Nexus tokens, no inline styles, 44px targets)
- **Agent create form** — the creation fields incl. `sourceOfProspect` (select from `PROSPECTING_SOURCE_LABELS`), `cashWithApp` (toggle + conditional amount), `proposedAPI`, `dateWritten`, `policyType`. Submits via `policiesService.createPolicy`.
- **Agent own-list view** — a "Policy Ledger" tab/section listing the agent's policies (label, `proposedAPI`, `sourceOfProspect`, `cashWithApp`, `dateWritten`, `status`). Handles loading/empty/error states.

## Phase 3 — Tests, lint, build

**Emulator rules tests** (new test file; model on the existing rules suite) — each deny case uses `assertFails`:
- agent create OWN → ALLOW; agent create as another `agentId` → DENY
- agent list OWN (`where agentId==uid`) → ALLOW; agent list others → DENY
- UM list own-unit (`where unitId==uid`) → ALLOW; UM list other-unit → DENY
- BM list in-tenant → ALLOW; cross-tenant read → DENY
- create with `sourceOfProspect` outside the enum → DENY; create with future `dateWritten` or `proposedAPI <= 0` → DENY

**Unit tests** for `policiesService` (validation, `parseFloat`, `status:'submitted'` default, denorm).

```powershell
npm run test
npm run lint
npm run build
```

All green before proceeding.

## Phase 4 — Docs (placeholders, filled post-merge)

- **`docs/CONTEXT.md`** — top table + recently-shipped row `Track H H1 — Policy Ledger walking skeleton (policies collection, agent create + own-list) — #TBD`.
- **`docs/FOLLOW_UPS.md`** — close **PH7-8-Q5** (RESOLVED: `agentType` pre-empted by `isBdoDso: boolean`); add **LOW** — `isBdoDso`/`monthsInIndustry`/`monthsAtTatil` not settable via any UI (admin-only direct Firestore).
- **PRD** (`docs/phase7-8-PRD.md`) — §7.4: add `sourceOfProspect`, `cashWithApp`, `policyDeliveryDate` to the schema (`dateIssued` already present). §9: reflect Need-Covered routed to the joint-call log and the held-out demographics. (Per the workshop directive that these update at Track H design time.)

## Phase 5 — Commit, push, verify, PR (STOP after)

```powershell
git add -A
git status
git commit -m "feat(policy-ledger): Track H H1 — policies collection + agent create + own-list"
git push -u origin feat/track-h-h1-policy-ledger
```

Rule 15 verify (full SHAs, HEAD == origin/branch):

```powershell
git fetch origin
git log origin/feat/track-h-h1-policy-ledger --oneline -1
git rev-parse HEAD
git rev-parse origin/feat/track-h-h1-policy-ledger
```

Open the PR — fill the checklist per Rule 18 (emulator/tests/lint/build/docs/scope checked; **smoke box unchecked** — it's a post-deploy check, see Phase 6). Report PR number, Rule 15 SHAs, `gh pr diff <n> --name-only`. Then **STOP and wait for the dispatcher. Do NOT merge.**

## Phase 6 — POST-merge-and-deploy (only after dispatcher confirms merge)

This collection's **rules + indexes must be deployed before the UI smoke can run** — rules/indexes are project-global, not preview-scoped (the §6 lesson). So the create/read smoke is a *post-merge* check, never pre-merge.

```powershell
git fetch origin
git checkout main
git pull --ff-only origin main
firebase deploy --only firestore:rules,firestore:indexes
```

Wait for the composite indexes to finish building (check the Firebase console / CLI), then run the UI smoke (browser MCP + `setupBypassSession`, assert rendered/persisted state):
1. As the test agent, open the Policy Ledger tab, **create** a policy (fill `sourceOfProspect`, `cashWithApp` + amount, `proposedAPI`, `dateWritten`, `policyType`) → save → it appears in the agent's own list with the right values.
2. Reload → it persists (write-read-verify).
3. As a manager in-scope (BM/UM), confirm the policy is visible in their read path; confirm an out-of-scope manager does not see it.
4. **Cleanup** — delete the seeded policy (Admin SDK), leave the collection as found.

Report per-leg results, then run the standard post-merge fill (`#TBD` → squash SHA, Rule 15). **Do NOT merge or deploy without explicit dispatcher confirmation** (Rule 19).

---

**Hard stops:** end every phase boundary with "STOP and wait for the dispatcher." Per Rule 19, CC never merges and never deploys without an explicit dispatched instruction.

# Session: 2026-05-27 — F3.1 Prospect Prefill + Track F Polish + Suite Hardening + Forward Recon

**Started:** 2026-05-27
**Model:** claude-sonnet-4-6
**Scope:** F3.1 new-policy prefill from prospect-info; Track F polish (isPinned, peer-BM scope, F2.2 joint-call archive); suite hardening (weak-waitFor audit, policy lifecycle tests, a11y warn→error); forward recon (Phase 9, H4, H3 parity)

## Anchor (Phase 0)

- Main HEAD: `a4a6e79` (post-merge fill — PR #358 CI stabilization complete)
- Suite: 1521/1521 green (101 test files)
- CI arc: confirmed closed (#355–#358 all merged; 48/48 smoke sweep)
- CONTEXT.md: current, no drift detected

## Phase 1 — F3.1 Verify Finding

**Task:** prospect-info → New Policy form prefill

**Source: prospectInfo doc fields**
| Field | Type | Values |
|---|---|---|
| `clientName` | string (max 120) | free text |
| `clientAge` | numeric | float |
| `clientOccupation` | string (max 120) | free text |
| `prospectingSource` | enum | PROSPECTING_SOURCES (11 values; same as policy `sourceOfProspect`) |
| `appointmentType` | enum | '2nd-interview' \| 'closing-interview' |
| `objections` | multi-select enum | 4 values |
| `policyType` | string (POLICY_TYPES) | 8 Tatil product categories |
| `intendedAppointmentDate` | date string | ISO date |

**Destination: New Policy create form (EMPTY_FORM)**
`ownerName`, `insuredName`, `policyNumber`, `productLine`, `newBusinessType`, `policyClass`, `planName`, `planId`, `proposedPremium`, `proposedFrequency`, `proposedAPI`, `proposedCoverage`, `dateWritten`, `dateSubmitted`, `notes`, `isSelfOrFamily`, `replacedPolicyAPI`, `sourceOfProspect`, `cashWithApp`

**Safe 1:1 mappings (obvious, no product decision):**
1. `clientName` → `ownerName` — prospect becomes policy owner; natural CTA
2. `prospectingSource` → `sourceOfProspect` — EXACT SAME ENUM; zero translation needed

**Deferred — require dispatcher product decision:**
- `policyType` (POLICY_TYPES: 8 Tatil categories) → `policyClass` (POLICY_CLASSES: 5 different categories) — different taxonomies
- `clientName` → `insuredName` — sameAsOwner checkbox handles this
- `intendedAppointmentDate` → `dateWritten` — appointment date ≠ policy write date

**Rules/schema change needed:** NONE — pure frontend state passing

## Phase 2 — Track F Polish

### 2a — isPinned coaching notes

- **Finding:** `isPinned` NOT in `hasOnly` allowlist (line 666 firestore.rules) → PR-OPEN required
- **Changes:** `firestore.rules` + `coachingNotesService.js` + `CoachingNotesModal.jsx`
- **PR:** [#361](https://github.com/Kelsean868/agencytrack/pull/361) — **OPEN, awaiting merge**

### 2b — Peer-BM read surface

- **Finding (no-op):** MasterSheet notes button has no role gate. CoachingNotesModal passes `callerRole`. BMs can already open coaching notes for any agent they can see in MasterSheet. Remaining gap = branch-scoped exclusion (peer-BM seeing another branch's agent notes) — requires `agentBranchId` denormalization, heavier work, tracked in FOLLOW_UPS.md.
- **PR:** None — no change needed

### 2c — Joint-call soft-archive (F2.2)

- **Finding:** `archived` NOT in `hasOnly` allowlist (lines 833-839 firestore.rules) → PR-OPEN required
- **Changes:** `firestore.rules` + `jointCallsService.js` + `JointCallsTab.jsx`
- **PR:** [#362](https://github.com/Kelsean868/agencytrack/pull/362) — **OPEN, awaiting merge**

## Phase 3 — Suite Hardening

### 3a — Weak-waitFor audit

2 genuine race-window patterns found and fixed:
1. `ProspectInfoPanel.test.jsx:92` — waitFor on `prospect-info-list` container → now waits for `'Jane Smith'` data text
2. `PolicyReconciliationPanel.test.jsx:121` — waitFor on `policy-groups` container → now waits for `'Alice Agent'` + `'Bob Agent'` agent names

### 3b — Policy lifecycle transition engine backfill

+7 tests added to `policiesService.test.js`:
- `rated → settled` (valid; fromStatus recorded in history)
- `rated → ntu` (valid; no required fields)
- `postponed → denied` (valid; optional reason field)
- `it.each` terminal-state rejection: `settled/denied/ntu → any` all throw "Illegal status transition"

### 3c — a11y warn→error

No-op — all jsx-a11y rules already at `error` level. Zero warnings on lint run.

- **PR:** [#363](https://github.com/Kelsean868/agencytrack/pull/363) — **OPEN, awaiting merge**

## Phase 4 — Forward Recon (read-only)

### Phase 9 — Sales Manager Target (5th goals layer)

**Status: NOT IMPLEMENTED — full plumbing needed**

Current `getGoalHierarchy()` returns 4 keys: `{ companyFloor, branchTarget, unitTarget, personal }`.

Gap: No `getSalesManagerGoals()` / `setSalesManagerGoals()` in `goalsService.js`. No Firestore path like `tenants/{tid}/salesManagerGoals/{managerId}_{year}`. `GapAnalysisPanel.jsx` has hardcoded 4-item `LAYER_CONFIG`. `gapAnalysis.js` computes only 4 layers.

**Full change surface for Phase 9 SM Target:**
1. `goalsService.js` — add `getSalesManagerGoals` / `setSalesManagerGoals` (mirror unit/branch pattern)
2. `goalsService.js:getGoalHierarchy()` — add SM Goals fetch, include `salesManagerTarget` in return
3. `gapAnalysis.js` — destructure `salesManagerTarget`, compute gap/pct in the per-metric object
4. `GapAnalysisPanel.jsx` — add 5th `LAYER_CONFIG` entry (key + pctKey + gapKey + label + barClass)
5. Firestore rules — new match block for `salesManagerGoals/{managerId}_{year}`
6. Sales Manager UI — form to set target (mirrors GoalsPanel for BM/UM)

### H4 — plan-config editor scope (clarification)

**H4 is the agent policy-entry form**, not a plan-config editor. `policyPlans` config editor (H2, §7.5) is the Tenant Admin surface that manages the curated plan list with `isActive` flag. H4 writes to `/tenants/{tid}/policies/{policyId}` only.

### H3 — flip-gate parity

**Status: FULLY IMPLEMENTED — no parity gap at engine level**

- `settlementShapeFromPolicies` output: `{ periodKey: 'YYYY-MM', settledAPI, settledApps, persistency: 0 }`
- Flip-gate in `AgentAwardsPanel.jsx` (lines 226–242): `usesPolicyLedger` flag on user doc gates the path
- When `usesPolicyLedger: true`: fetch policies → `settlementShapeFromPolicies` → backfill `persistency` from confirmedSettlements by `periodKey` → feed awards engine
- Engine receives identical shape either way. Persistency cannot be derived from policy records (it's BM-owned); backfill from settlements is correct by design.
- `periodKey` format: `YYYY-MM` (from policy `dateIssued.toDate()`)

## PR Log

| PR | SHA | Description | Status |
|---|---|---|---|
| #359 | `c1362e3` | docs(briefs): F3.1 prospect prefill kickoff | ✅ MERGED (Rule 10) |
| #360 | TBD | feat(prospect-info): Log Policy CTA + PolicyLedgerPanel prefill (F3.1) | 🟡 OPEN |
| #361 | TBD | feat(coaching): isPinned pin/unpin toggle (F2.1a) | 🟡 OPEN |
| #362 | TBD | feat(joint-calls): soft-archive (F2.2) | 🟡 OPEN |
| #363 | TBD | test(hardening): Phase 3 suite hardening | 🟡 OPEN |

## Phase Completion

| Phase | Status | Notes |
|---|---|---|
| Phase 0 (Anchor) | ✅ Complete | 1521/1521; CI arc closed |
| Phase 1 (F3.1 verify + build) | ✅ PR-OPEN (#360) | Brief #359 merged; feature PR awaiting dispatcher merge |
| Phase 2a (isPinned) | ✅ PR-OPEN (#361) | rules change; awaiting merge + rules deploy |
| Phase 2b (peer-BM scope) | ✅ No-op | BM read already works; branch exclusion = separate heavier FU |
| Phase 2c (joint-call archive) | ✅ PR-OPEN (#362) | rules change; awaiting merge + rules deploy |
| Phase 3 (Suite hardening) | ✅ PR-OPEN (#363) | +7 tests; 1528/1528 green |
| Phase 4 (Forward recon) | ✅ Complete | Findings documented above |

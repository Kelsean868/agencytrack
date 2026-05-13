# PR-F — Phase 1 Discovery Notes

**Date:** 2026-05-13  
**Status:** Complete — surfaces wrap-vs-extend decision. Gate requires Kyron acknowledgement before Phase 2.

---

## 1. `synthetic-weekly-reports.mjs` Inventory

### Top-of-file docstring summary

Generates realistic V1-shape weekly reports for `tatillife_south` so the E1 migration script can be validated. Runs in dry-run by default; writes only with `--apply --confirm-tenant=tatillife_south`.

### argv handling and accepted parameters

| Flag | Effect |
|---|---|
| *(no flags)* | Dry-run: generates and prints sample; no writes |
| `--apply` | Enable Firestore writes |
| `--confirm-tenant=<id>` | Required with `--apply`; safety gate |
| `--agent-ids=uid1,uid2,...` | Override synthetic IDs with real UIDs |

### Doc shape it writes

- **Collection path:** `tenants/{tenantId}/submissions/{agentId}_{weekStarting}`
- **Schema version:** V1 flat (single `apiSold` field — the field that the E1 migration exists to split)
- **Key fields written:** `agentId, userId, agentName, tenantId, weekStarting, status: 'submitted', applicationsSold, apiSold, estimatedCommissions, referralCalls, coldCalls, followUpCalls, qualifiedApproaches, ffisScheduled, ffiConducted, ciConducted, newCIBooked, officeHours, fieldHours, rating* fields, targetAPI, targetAppsSold, submittedAt, updatedAt`
- **Migration testing markers:** `_synthetic: true`, `_syntheticMeta: { weekType, unrecodedPPP, unrecodedLMPS }`
- **`tenantId` handling:** accepted as param from `--confirm-tenant`; stamped on every doc
- **Week dates:** hardcoded starting from 2026-03-01, 8 weeks forward

### Decision: WRAP

Write `seed-test-submissions.mjs` as a **fresh file**. Do NOT modify `synthetic-weekly-reports.mjs`.

**Rationale:**

1. **Schema mismatch.** Production submissions are now V2 (confirmed probe, `version: 2`). `extractFields.js` reads `applicationsSold` and `apiSold` from `newBusiness.apps` and `newBusiness.api` when `version === 2`. The existing script generates V1 flat docs (`apiSold` only) which will render as zero production on the V2-reading dashboard surfaces.

2. **Date range incompatibility.** The new seeder needs the 4 most-recent Sundays computed at runtime. The existing script hardcodes `getSundayDates(8, '2026-03-01')` and always starts from that fixed date — not parameterisable without breaking its E1-testing contract.

3. **Purpose conflict.** The existing script's stated purpose (docstring) is to generate V1 docs for E1 migration testing. Mixing in a `testDataBatchId` parameter alongside V1-specific `_syntheticMeta` fields would conflate two unrelated purposes.

4. **No additive-only path.** The `--agent-ids` flag allows scoping to real UIDs, but the V1 schema and fixed date range cannot be addressed with additive parameters alone.

5. **`synthetic-weekly-reports.mjs` is untouched.** Git diff will show empty for this file — confirms the brief's locked constraint.

---

## 2. Doc Shape Confirmations

All shapes confirmed by live Firestore probe against `tatillife_south` (2026-05-13). PII redacted.

### `/tenants/{tid}/users/{uid}`

```json
{
  "uid": "<uid>",
  "tenantId": "tatillife_south",
  "role": "agent",
  "name": "[REDACTED]",
  "email": "[REDACTED]",
  "branchId": "ljbBHP1g7lbZXvHlpcDn",
  "active": true,
  "provisioning": true,
  "createdAt": "<timestamp>",
  "createdBy": "<uid>",
  "csvImportBatchId": "<uuid>",
  "importedFromCsv": true,
  "agentNumber": "[REDACTED]",
  "unitId": "<uid>",
  "contractStartDate": "2026-01-01",
  "hasSeenWelcome": false
}
```

Notes:
- `provisioning: true` is set on create; `doCreateUser` removes it in saga step D.
- `ownedBranchIds: string[]` is present on manager-role docs (absent on agents).
- `unitId` on `unit_manager` docs = the manager's own UID (per CLAUDE.md).
- Cleanup: doc path is `tenants/{tid}/users/{uid}`; deleted by UID lookup from email-pattern Auth sweep.

### `/tenants/{tid}/submissions/{agentId}_{weekStarting}`

Confirmed V2 shape (version: 2, post-E1-migration):

```json
{
  "agentId": "[REDACTED]",
  "userId": "[REDACTED]",
  "agentName": "[REDACTED]",
  "weekStarting": "YYYY-MM-DD",
  "status": "submitted",
  "version": 2,
  "newBusiness": { "apps": 0, "api": 0 },
  "pppIncreases": { "apps": 0, "apiIncrease": 0 },
  "lumpsums": { "grossAmount": 0, "apiCredit": 0, "commission": 0 },
  "totalProductionCredit": 0,
  "totalCommission": 0,
  "applicationsSold": 0,
  "apiSold": 0,
  "referralCalls": 0,
  "coldCalls": 0,
  "followUpCalls": 0,
  "ffiConducted": 0,
  "ciConducted": 0,
  "submittedAt": "<timestamp>",
  "updatedAt": "<timestamp>",
  "migrationMeta": { "migratedAt": "...", "migratedBy": "script", "sourceVersion": 1 }
}
```

Notes:
- Seeder will write `version: 2` docs with `newBusiness.apps` and `newBusiness.api` non-zero. `extractFields.js:89-91` reads V2 via these sub-object fields.
- Seeder docs will NOT include `migrationMeta` (they are natively V2, not migrated).
- Doc ID format: `{agentId}_{weekStarting}` (e.g. `uid001_2026-05-04`).
- `tenantId` is NOT present in the probed live submission doc but will be stamped by the seeder for consistency.

### `/tenants/{tid}/persistency/{agentId}_{YYYY_MM}`

Confirmed E3 shape:

```json
{
  "agentId": "[REDACTED]",
  "tenantId": "tatillife_south",
  "year": 2026,
  "month": 5,
  "monthKey": "2026-05",
  "reportPeriodStart": "2025-06-01",
  "reportPeriodEnd": "2026-05-31",
  "businessPlaced": 1,
  "notTakens": 0,
  "incPPPs": 0,
  "lumpsums100": 0,
  "lapses": 0,
  "reinstatements": 0,
  "grossSettled": 1,
  "netSettled": 1,
  "persistency": 1.0,
  "meetsAwardGate": true,
  "enteredAt": "<timestamp>",
  "enteredBy": "<uid>",
  "enteredByRole": "branch_manager",
  "lastEditedAt": "<timestamp>",
  "lastEditedBy": "<uid>",
  "lastEditedByRole": "branch_manager"
}
```

Notes:
- Doc ID format: `{agentId}_{YYYY_MM}` — note the **underscore** between year and month (not hyphen). Confirmed from probe (`J0j4uBqzTPcfm1IlGCPyDzo27RP2_2026_05`). Matches `persistencyDocId()` which calls `.replace('-', '_')`.
- `isE3Doc()` checks all 6 `E3_FIELDS` are present and non-null — seeder must include all 6.
- Seeder months: Jan (`2026-01` → doc id `uid_2026_01`), Feb (`2026-02` → `uid_2026_02`), Mar (`2026-03` → `uid_2026_03`).
- `enteredBy` = test BM's UID; `enteredByRole` = `'branch_manager'`.
- Derived fields (`grossSettled`, `netSettled`, `persistency`, `meetsAwardGate`) must be computed by seeder — same formula as `deriveAll()` in `src/lib/persistency/calculations.js`.

### `/tenants/{tid}/goals/{agentId}`

```json
{
  "agentId": "[REDACTED]",
  "tenantId": "tatillife_south",
  "setBy": "<uid>",
  "setByName": "...",
  "updatedAt": "<timestamp>",
  "targetAnnualAPI": 250000,
  "targetAnnualApps": 0,
  "targetAnnualPersistency": 0,
  "targetWeeklyAPI": 0,
  "targetWeeklyApps": 0,
  "targetWeeklyDials": 0,
  "targetWeeklyFFI": 0,
  "notes": "",
  "personalAnnualAPI": 250000,
  "personalAnnualApps": 50
}
```

Notes:
- Doc ID = `agentId` (the agent's UID). Path: `tenants/{tid}/goals/{agentId}`.
- `csvImportBatchId` and `importedFromCsv` are present on CSV-imported docs.
- Smoke seeder writes goals directly via Admin SDK, so it stamps `testDataBatchId` directly.
- Manual runbook imports goals via C3 modal → only `csvImportBatchId` is stamped (via `setGoals()`).
- Cleanup for goals uses UID-derived path lookup (not `testDataBatchId`) — see §5 below.

### `/tenants/{tid}/campaigns/{campaignId}`

Empty collection in production — no real docs exist yet. Shape inferred from `campaignService.js:createCampaign()`:

```json
{
  "tenantId": "tatillife_south",
  "name": "Test Campaign Q2",
  "status": "active",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "prize": "...",
  "scope": { "type": "agent", "agentIds": ["uid1", ..., "uid7"] },
  "targets": [{ "metric": "apiSold", "threshold": 10000 }],
  "createdBy": "<uid>",
  "createdByName": "...",
  "createdByRole": "branch_manager",
  "createdAt": "<timestamp>"
}
```

Notes:
- Cleanup: full doc delete (no participant-array surgery per brief).

### `/tenants/{tid}/notifications/{id}`

```json
{
  "userId": "[REDACTED]",
  "tenantId": "tatillife_south",
  "type": "submission_reminder",
  "title": "...",
  "body": "[REDACTED]",
  "link": null,
  "read": false,
  "createdAt": "<timestamp>"
}
```

Notes:
- `createCampaign()` triggers notification fan-out when `status === 'active'`. The campaign seeder sets `status: 'active'`, which will create notifications for the 7 test agents. These are seeded docs and must be cleaned up.
- Cleanup: query `where('userId', 'in', testAgentUids)` to find and delete.

### `/tenants/{tid}/settlements/{id}`

Empty collection in production. Shape inferred from `settlementService.js` (based on doc ID pattern `{agentId}_{year}_{periodKey}` in CLAUDE.md):
- `agentId, tenantId, year, periodKey, ...` — confirmed as empty, no cleanup needed for PR-F scope.

### `/tenants/{tid}/leaderboard/{uid}`

```json
{
  "uid": "<uid>",
  "userId": "<uid>",
  "tenantId": "tatillife_south",
  "agentName": "...",
  "name": "...",
  "badges": [],
  "weeklyStreak": 0,
  "level": 1,
  "levelTitle": "Associate",
  "points": 0,
  "updatedAt": "<timestamp>"
}
```

Notes:
- Doc ID = agent UID. Cleanup: delete by UID (path `tenants/{tid}/leaderboard/{uid}`).
- Leaderboard entries may be created by `awardsEngine` when agents submit reports. Cleanup sweeps this collection by UID even if no entries exist yet.

### Daily entries — `tenants/{tid}/users/{agentId}/dailyActivity`

**Subcollection** under each user doc (NOT a top-level collection). No real docs found in probe (no agents using `loggingMode: 'daily'` yet). Shape inferred from aggregator:

- Path: `tenants/{tenantId}/users/{agentId}/dailyActivity/{autoId}`
- Fields include: `weekStarting`, per-activity numeric fields
- Cleanup: collection-group delete under the user doc. Must be cleaned before the user doc is deleted (leaves-first ordering in brief is correct).

### `/auditAdminCreations/{id}`

Empty collection in production (probe confirmed). Written only for `tenant_admin` and `platform_admin` creation — test agents are `branch_manager`, `unit_manager`, `agent`, so no audit entries are expected. Cleanup sweep queries by `createdUid` match but will always return 0 results for PR-F test data.

---

## 3. Tenant + Branch Confirmation

| Field | Value |
|---|---|
| Tenant ID | `tatillife_south` |
| Branch collection path | `tenants/tatillife_south/branches/{branchId}` |
| Active branches | **1** |
| Pilot branch ID | **`ljbBHP1g7lbZXvHlpcDn`** |
| Branch name | Cyril Murray Branch |
| `managerId` | `null` (not yet linked to a BM) |

Notes:
- CONTEXT.md references `meta/branches` (pre-C1 design). The actual implementation (Track C C1, `branchService.js`) stores branches at `tenants/{tenantId}/branches/{branchId}`. This is a CONTEXT.md staleness issue, not a code issue — `branchService.js` is authoritative.
- All 10 test users will be assigned `branchId: 'ljbBHP1g7lbZXvHlpcDn'`.

### Agent distribution across units (CC decision: 4 + 3)

- **Unit 001** (UM-001): agents 001–004 (4 agents)
- **Unit 002** (UM-002): agents 005–007 (3 agents)

The `unitId` for an agent is the UID of their unit manager. UIDs are Firebase-assigned at creation time. The roster module holds email→role/unit mapping; actual UIDs are resolved at seed time and stored in memory for the seeding session.

---

## 4. `bulkImportUsers` Callable Input Schema

**Callable name:** `bulkImportUsers`  
**Caller requirements:** `tenant_admin` or `platform_admin` (platform_admin path throws `unimplemented`)

### Payload shape

```json
{
  "csvImportBatchId": "<uuid-v4>",
  "users": [
    {
      "email": "agent@example.com",
      "name": "Agent Name",
      "role": "agent",
      "branchId": "<branch-id>",
      "agentNumber": "A001",
      "unitId": "<unit-manager-uid>",
      "contractStartDate": "2026-01-01",
      "phone": "868-555-0100",
      "bio": "",
      "careerLevel": "Associate"
    }
  ]
}
```

### Required per-row fields (server re-validation)

- `email` — valid email format
- `role` — one of `agent`, `unit_manager`, `branch_manager`, `sales_manager`
- `branchId` — must be in the tenant's active branch Set
- `unitId` — required for `agent` role (passes through to doCreateUser)
- `agentNumber` — required for `agent` role (validated client-side; server passes through)

### Optional per-row fields

- `contractStartDate`, `phone`, `bio`, `careerLevel`

### Fields NOT accepted by the Callable

- **`testDataBatchId`** — not in the Callable's field whitelist. Passed rows do not include it; `buildDocFields()` does not read it. See §5 for why this is by design.
- The Callable stamps `csvImportBatchId` (from the top-level payload) and `importedFromCsv: true` on every user doc via `buildDocFields()`.

---

## 5. `setGoals()` Passthrough Fields and `testDataBatchId` Strategy

### What `setGoals()` passes through

From `src/services/goalsService.js:52-57`:

```js
if (typeof data.csvImportBatchId === 'string' && data.csvImportBatchId) {
  payload.csvImportBatchId = data.csvImportBatchId;
}
if (data.importedFromCsv === true) {
  payload.importedFromCsv = true;
}
```

`testDataBatchId` is **not** in the passthrough list. Only `csvImportBatchId` and `importedFromCsv` are passed through.

### PR-F decision: do NOT add `testDataBatchId` to `setGoals()`

Two code paths create goals in the PR-F lifecycle:

1. **Smoke test (all-Admin SDK path):** goals are written directly to Firestore via Admin SDK (bypassing `setGoals()`). The seeder stamps `testDataBatchId` directly on the doc. No change to `setGoals()` required.

2. **Manual runbook path:** goals are imported via the BulkImportGoalsModal → `goalsImportService.runImport()` → `setGoals()`. These docs get `csvImportBatchId` only. Cleanup for these docs uses UID-derived path lookup:
   - Identify test agents by email pattern (`*@agencytrack.test`) via Auth sweep.
   - Derive their UIDs.
   - Delete `tenants/{tid}/goals/{uid}` by UID.
   - No `testDataBatchId` match needed — UID lookup is sufficient.

**Result:** `setGoals()` is untouched. No changes to production client-side code in PR-F.

### Same logic applies to `bulkImportUsers`

User docs created via the Callable in the manual runbook get `csvImportBatchId` only. Cleanup finds them via the email-pattern Auth sweep → UID → `tenants/{tid}/users/{uid}`. `testDataBatchId` match is not needed for user doc cleanup.

---

## 6. Persistency Calculations Dependency

The persistency seeder needs to compute derived fields (`grossSettled`, `netSettled`, `persistency`, `meetsAwardGate`). The canonical computation is in `src/lib/persistency/calculations.js` (client-side ESM). Since the seeder is CJS/Admin SDK context, it will inline the same formula rather than importing the ESM module:

```
grossSettled = businessPlaced - notTakens - incPPPs - lumpsums100
netSettled   = grossSettled - lapses + reinstatements
persistency  = netSettled / businessPlaced  (0 if businessPlaced === 0)
meetsAwardGate = persistency >= 0.90
```

---

## 7. Service Account Key Path

All PR-F scripts at `scripts/seed/` and `scripts/cleanup/` use the service account key at:

```
functions/service-account-key.json
```

Relative require from `scripts/seed/` (1-deep under `scripts/`):

```js
const KEY_PATH = resolve(__dirname, '../../functions/service-account-key.json');
const admin = require('../../functions/node_modules/firebase-admin');
```

Key confirmed present at `C:\Projects\AgencyTrack\functions\service-account-key.json`.

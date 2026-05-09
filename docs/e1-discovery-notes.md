# E1 Schema Split — Discovery Notes

> Discovery run: 2026-05-09. Worktree: feat/e1-schema-split-foundation.
> Purpose: confirm spec assumptions before writing schema utilities and migration.

---

## Files touched in discovery

| File | Role |
|------|------|
| `src/services/submissionService.js` | Canonical write path — `sanitize()` defines the schema |
| `src/utils/extractFields.js` | Canonical read path — single source of truth for field extraction |
| `src/components/wizard/WizardForm.jsx` | INITIAL_DATA shape, wizard state |
| `src/components/wizard/steps/Step4ClosingSales.jsx` | UI for production capture |
| `functions/index.js` | `onSubmissionWrite` trigger — reads `apiSold` for points + YTD aggregation |
| `src/utils/awardsEngine.js` | Reads `apiSold` from submissions (with fallback) |
| `src/components/profile/AgentReportDocument.jsx` | Reads `apiSold` from submissions for PDF |
| `src/components/dashboard/AgentDashboard.jsx` | Accumulates `apiSold` for YTD KPIs |
| `src/components/gamification/BadgeGrid.jsx` | Reads `apiSold` for badge eligibility |
| `src/services/goalsService.js` | Reads `api` from *goals* docs (not submissions) |
| `src/components/manager/GoalsPanel.jsx` | Reads `api` from *goals* docs (not submissions) |
| `src/components/manager/SettlementPanel.jsx` | Uses `api` as a local variable during settlement upload |
| `src/components/profile/CareerPortal.jsx` | Reads `api` from *goals* docs (not submissions) |
| `src/services/settlementService.js` | Writes `settledAPI` (separate schema, not submissions) |

---

## Key findings

### 1. Actual submission collection path

Firestore path: `tenants/{tenantId}/submissions/{subId}` — NOT `weeklyReports`.
The spec's "weeklyReport" is the domain concept; the Firestore collection is `submissions`.

### 2. Actual V1 field names (verified against extractFields.js)

| V1 field | Priority | Alias(es) | Source |
|---|---|---|---|
| API (Annual Premium Income) | `apiSold` | `api`, `annualPremium` | `extractFields.js:91` |
| Applications sold | `applicationsSold` | `appsSold` | `extractFields.js:89` |
| Agent commission rate | `commissionRate` | — | User doc; stored as percentage (35 = 35%) |

Full fallback chains in `extractFields.js`:
- API:  `d.apiSold \|\| d.api \|\| d.annualPremium`
- Apps: `d.applicationsSold \|\| d.appsSold`

**Bug fixed in migration script (commit appended to PR #68):**
The original migration used `p(docData.apps)` as an alias for applications. `apps` is NOT
a V1 alias per `extractFields.js`. Correct alias is `appsSold`. Fixed by extracting
`readV1Api` / `readV1Apps` pure functions (in `weeklyReport.computations.js`) that mirror
the exact `extractFields.js` priority order, then calling those from the migration.

**Schema irregularity noted:** `telContacts` is not saved directly to Firestore in the flat
schema; `qualifiedApproaches` is the best available proxy (`extractFields.js:80`). Not
relevant to E1 production fields but documented for completeness.

### 2b. V2 naming decision

**Chosen: clean-break naming** — `newBusiness.api`, `newBusiness.apps` (not `newBusiness.apiSold`).

Rationale: the `extractFields.js` abstraction layer already exists to translate raw Firestore
field names to normalised output. V2 uses clean internal names (`api`, `apps`) within the
nested sub-objects; `extractFields.js` gets a Slice 2 update to read from `newBusiness.api`
when `version === 2`. The "Sold" suffix is redundant inside a sub-object already named
`newBusiness`. Consistent with PPP (`apiIncrease`) and LMPS (`grossAmount`) naming patterns.

### 3. `.api` access count: 30 references in 9 files

Below the 15-file STOP threshold. Breakdown by context:

**From submission/`apiSold`** (5 files — these are Slice 2 API audit targets):
- `utils/extractFields.js` — canonical read, handles migration via `apiSold || api || annualPremium`
- `utils/awardsEngine.js` — sums `apiSold` for YTD and monthly aggregation
- `components/profile/AgentReportDocument.jsx` — sums `apiSold` for PDF generation
- `components/dashboard/AgentDashboard.jsx` — accumulates `apiSold` for KPI cards
- `components/gamification/BadgeGrid.jsx` — reads `apiSold` for badge eligibility

**From goals docs** (3 files — NOT submission schema, not affected by E1):
- `services/goalsService.js` — flat `api` field on unitGoal/branchGoal docs
- `components/manager/GoalsPanel.jsx` — same
- `components/profile/CareerPortal.jsx` — same

**Settlement intermediate variable** (1 file — maps to `settledAPI`, not affected):
- `components/manager/SettlementPanel.jsx` — local `row.api` variable only

### 4. Cloud Function — `onSubmissionWrite` (functions/index.js:725–878)

Reads `apiSold` directly for:
- Leaderboard points calculation: `Math.floor(api / 1000)` (1 pt per $1K API)
- YTD API aggregation for MDRT badge: sums `apiSold` across submissions in year

**E1 impact:** After migration, new submissions will write `newBusiness.api` instead of (or in addition to) `apiSold`. The Cloud Function must be updated in Slice 2 to read `newBusiness.api` (or `totalProductionCredit`) for correct aggregation. This is pre-anticipated by the spec's "API audit follow-up" section.

**Safe for Slice 1:** The function falls back gracefully — if `apiSold` is missing it defaults to 0. Existing migrated docs will retain their original `apiSold` value (migration script preserves all fields).

### 5. `extractFields.js` backward-compatibility

The fallback chain `apiSold || api || annualPremium` means existing reads continue working post-migration:
- V1 docs (not yet migrated): `apiSold` is present → reads correctly
- V2 docs (migrated): `apiSold` is preserved by migration script → reads correctly
- Future new submissions (Slice 2 wizard update): will write `newBusiness.api`; `extractFields` will need a Slice 2 update to also read `newBusiness.api`

### 6. No existing schema/type files

`src/lib/`, `src/types/`, `src/schemas/`, `src/models/` — none exist. This PR introduces the first schema definition layer.

### 7. Current wizard production capture shape (Step 4)

```javascript
// WizardForm.jsx INITIAL_DATA (production-relevant fields)
apiSold:             0,   // current single production metric
applicationsSold:    0,
estimatedCommissions: 0,
```

Wizard has a single "API Sold (TTD)" CurrencyField at `Step4ClosingSales.jsx`. Slice 2 will split this into 3 sub-sections (NB / PPP / LMPS).

---

## Stop condition check

| Condition | Status |
|---|---|
| Schema diverges from spec assumptions | ⚠️ **Retroactive correction** — `apiSold`/`applicationsSold`/`appsSold` divergence was a real schema-read bug in the original migration (used `apps`, not `appsSold`). Fixed in follow-up commit. See § 2 above. |
| More than 15 files reference weeklyReport.api directly | ✅ Clear — 9 files, 5 from submissions, 4 from goals/settlements (different schema) |
| Cloud Functions do complex aggregation needing schema-aware migration | ✅ Clear — `onSubmissionWrite` reads `apiSold` simply; migration preserves it |

No stop conditions triggered. Proceeding to Phase 3.

---

## Slice 2 follow-ups (not in this PR)

- `functions/index.js` `onSubmissionWrite`: update to read `newBusiness.api` / `totalProductionCredit`
- `src/utils/extractFields.js`: add `newBusiness.api` branch for V2 docs
- `src/utils/awardsEngine.js`: update aggregation to use `totalProductionCredit`
- `src/components/profile/AgentReportDocument.jsx`: API column → production credit column
- `src/components/wizard/steps/Step4ClosingSales.jsx`: split into NB / PPP / LMPS sub-sections
- `src/components/dashboard/AgentDashboard.jsx`: KPI card update

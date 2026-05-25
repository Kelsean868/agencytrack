# Track E (b) — Weekly Activity Floors In-App Editor — Kickoff Brief

**Date:** 2026-05-25  
**Track:** E (b) — weeklyActivityFloors quick-win  
**Size:** S (3 source files + 1 test file + docs)

---

## Background

PR #238 shipped the `weeklyActivityFloors` schema in `config/companyMinimums` and
the `WeeklyStandardCard` that surfaces "Expected vs Actual" on AgentDashboard.
Floors are currently seeded via a one-time `seed-companyMinimums.cjs` script.
The FU item asks for a tenant_admin in-app editor so floors can be adjusted
without re-running the seed script.

---

## Source-verified state (Rule 17)

- `EditConfigModal.jsx` — single `annualAPI` field; passes `{ annualAPI }` to service
- `setCompanyMinimums` in `goalsService.js` — validates annualAPI, writes with `merge: true`
  — comment says "Only annualAPI is editable in B5"; floors preserved via merge (never written)
- Existing test at `goalsService.test.js:186` explicitly asserts `weeklyActivityFloors` NOT in payload
- `CompanyConfigPanel.jsx` — passes `currentAnnualAPI={annualAPI}` and `currentUid` to modal
- `WEEKLY_ACTIVITY_FLOOR_ROWS` (10 rows) already in `src/utils/weeklyActivityFloors.js`
- `DEFAULT_WEEKLY_ACTIVITY_FLOORS` has all 10 keys with canonical defaults

---

## Decisions locked

1. **`setCompanyMinimums` extension** — when `data.weeklyActivityFloors` is present in the call,
   validate each value and write the block; absent = no-op (existing merge preserves existing floors).
   Backward-compat: calling without floors (existing callers) is unchanged.

2. **Validation rules:**
   - All floor values: `parseFloat` → must be non-negative (`>= 0`). Integer enforcement on
     non-api fields via `Number.isInteger(parseFloat(v))` check.
   - `api` floor: positive number (decimals OK). Must be `> 0`.
   - No upper-bound cap on floors (managers' discretion).

3. **EditConfigModal UI:**
   - Below existing Annual API field, add a "Weekly Activity Floors" labelled section.
   - 10 rows from `WEEKLY_ACTIVITY_FLOOR_ROWS`; each row: label + numeric input.
   - Modal body gets `max-h-[80vh] overflow-y-auto` to handle scroll on small screens.
   - Per-row validation error shown inline below the input.
   - No cross-field warning ("floors below agreed minimum") — deferred as too complex for quick-win.

4. **Modal props added:** `currentFloors` (object, from `config.weeklyActivityFloors`).
   Existing props unchanged (`tenantId`, `currentAnnualAPI`, `currentUid`, `onClose`, `onSaved`).

5. **CompanyConfigPanel changes:**
   - Pass `currentFloors={config?.weeklyActivityFloors}` to `EditConfigModal`.
   - Button label: "Edit company config" (was "Edit company minimum").
   - Subtitle: "Company minimum API and weekly activity floors are editable."
   - No new tiles in the tile grid (floors have their own section in the modal).

6. **Tests:** Update `goalsService.test.js` — keep the existing "no floors in payload" test;
   add new tests: "writes floors block when provided", "rejects non-integer floor value",
   "rejects negative floor value", "accepts decimal api floor".

7. **No rules change needed** — `config/companyMinimums` write rule already exists and covers
   the `weeklyActivityFloors` block (same path, same write helper).

---

## File set

| File | Change |
|---|---|
| `src/services/goalsService.js` | Extend `setCompanyMinimums` to accept + validate `weeklyActivityFloors` |
| `src/components/admin/EditConfigModal.jsx` | Add floors editor section (10 rows) |
| `src/components/admin/CompanyConfigPanel.jsx` | Pass floors prop; update button/subtitle text |
| `src/services/__tests__/goalsService.test.js` | Add/update setCompanyMinimums floor tests |
| `docs/FOLLOW_UPS.md` | Close floors editor FU item |
| `docs/CONTEXT.md` | Phase 4 docs update |

---

## Phase 1 verification commands

```powershell
# Confirm WEEKLY_ACTIVITY_FLOOR_ROWS has 10 entries
node -e "const { WEEKLY_ACTIVITY_FLOOR_ROWS } = require('./src/utils/weeklyActivityFloors.js'); console.log(WEEKLY_ACTIVITY_FLOOR_ROWS.length)"

# Confirm setCompanyMinimums signature
grep -n "export async function setCompanyMinimums" src/services/goalsService.js

# Confirm EditConfigModal prop list
grep -n "currentAnnualAPI\|currentFloors\|currentUid" src/components/admin/EditConfigModal.jsx

# Confirm no existing Firestore rules gap
grep -n "companyMinimums" firestore.rules
```

---

## Smoke gate

Tenant_admin flow: open CompanyConfigPanel → click "Edit company config" → change one floor
value → save → reload page → verify floor value persists via `getCompanyMinimums`.
Preview smoke using `setupBypassSession` + tenant_admin login.

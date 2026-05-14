# Pre-Pilot Shakedown Findings — 2026-05-14

## Executive summary

- **Total tests run:** 134
- **Pass:** 124 / **Fail:** 10 / **Inconclusive (skipped):** 4
- **Bugs found:** 6 (Blocker: 1, Major: 2, Minor: 2, Polish: 1)
- **A11y violations:** Critical: 1 | Serious: 17 | Moderate: 0 | Minor: 0
- **Screenshots captured:** 79 (target ≥80)
- **Runtime:** 0.16h (budget: ≤10h)
- **Seed batch ID:** `0d8a2964-5122-4dc4-9690-951143174f36`
- **Recommendation:** **FIX-THEN-SHIP**

---

## SHAKEDOWN-001 + SHAKEDOWN-002 regression verification

| Test | Label | Run 1 (pre-fix) | Run 2 (pre-fix) | Run 3 (this run) | Verdict |
|---|---|---|---|---|---|
| T1.01 | BM login — claims propagate on first login | n/a | n/a | **PASS** | ✅ SHAKEDOWN-001 fix confirmed |
| T2B.02 | Team tab — unit-scoped agents | FAIL | FAIL | **PASS** | ✅ SHAKEDOWN-002 Team tab fix confirmed |
| T2B.03 | Master Sheet — unit-scoped agents | FAIL | FAIL | **FAIL** | ❌ Master Sheet still leaking (see Bug 002) |

**T1.01:** `cat01-auth` went 10/10 — SHAKEDOWN-001 (manager first-login claims propagation, PR #141) is confirmed clean.

**T2B.02:** Team tab transitioned FAIL → FAIL → **PASS**. PR #142's `getAllUsers` unit-scoping fix is confirmed.

**T2B.03:** Master Sheet transitioned FAIL → FAIL → **FAIL**. Root cause analysis below shows the fix was incomplete — the Master Sheet has a second unscoped data path not addressed by PR #142.

---

## Bug inventory

### Bug 001 — Wizard — screen 5 (summary) not detected

- **Severity:** Major
- **Category:** agent
- **Test ID:** T2A.03
- **Error:** `Wizard screen 5 (summary) not detected`
- **Pre-existing:** Yes — failed in all 3 shakedown runs. Cat02-agent ran in all 3; T2A.03 was FAIL each time.
- **Root cause hypothesis:** The test navigates through 4 Next/Continue button clicks and expects `summary|review|submit|total` text on screen 5. Likely a mismatch between the test's button-text regex and the actual wizard's navigation control label, OR the wizard's screen 5 summary panel uses different terminology than the regex expects. Requires manual wizard walk + screenshot comparison to confirm.
- **Fix area:** `cat02-role-agent.mjs:T2A.03` (test regex adjustment) OR `src/components/wizard/WizardForm.jsx` if the summary screen is actually missing expected text.
- **Effort estimate:** S — inspect the wizard screen 5 screenshot captured by the shakedown (`shakedown-screenshots-2026-05-14T08-18-31/cat02-agent/wizard/screen5.png`) and align test regex.

### Bug 002 — Master Sheet — cross-unit data leak (getWeeklySubmissions unscoped)

- **Severity:** Major
- **Category:** unit manager
- **Test ID:** T2B.03
- **Error:** `UM Master Sheet shows UM_002 agents — cross-unit data leak`
- **Pre-existing:** Yes — failed in runs 1+2 also. Root cause partially shifts post-PR #142.
- **Root cause (post-PR #142):** `MasterSheet.jsx` uses two data paths:
  1. `getTenantUsers(tenantId)` — builds the name map. **Correctly scoped by PR #142.** ✅
  2. `getWeeklySubmissions(tenantId, selectedWeek)` — fetches submission rows. **Still unscoped.** ❌
  Submissions from agents 005–007 (UM_002's unit) contain `agentName: 'Test Agent 005'` etc. directly in the document. These rows are fetched and rendered even though `getTenantUsers` no longer returns UM_002's agents — the fix was applied to the wrong data path for the Master Sheet rows.
- **Fix area:** `src/services/managerService.js:getWeeklySubmissions`. Apply the same role-aware `where('unitId', '==', callerUid)` pattern already used in `getTenantUsers` and `getAllUsers`. Add a join on `agentId` field of submissions matching the caller's unit agents' UIDs, OR add a `where('unitId', '==', callerUid)` filter to the submissions query if submissions carry a `unitId` field.
  - **If submissions carry `unitId`:** add `where('unitId', '==', callerUid)` directly to `getWeeklySubmissions` for UM callers (same pattern as other two functions).
  - **If submissions do NOT carry `unitId`:** fetch the UM's agent UIDs from `getTenantUsers`, then filter submissions client-side to only those whose `agentId` is in the set. Check `extractFields.js` to determine which field name is used.
- **Effort estimate:** S — verify which approach applies by checking a seeded submission doc's fields, then implement.

### Bug 003 — Wizard — non-Sunday date validation timeout

- **Severity:** Minor
- **Category:** form validation
- **Test ID:** T4.02
- **Error:** `page.waitForFunction: Timeout 30000ms exceeded`
- **Pre-existing:** Unknown — `cat04-form-validation` threw an infrastructure error in runs 1+2, so T4.02 never ran. First shakedown run where this test executed.
- **Root cause hypothesis:** The test enters a non-Sunday date and waits for a validation error indicator. Either the wizard doesn't surface a visible error element matching the test's locator, or `validateSundayDate()` silently prevents date entry without a visible error message. Manual wizard test with a non-Sunday date will confirm.
- **Effort estimate:** S — manual verification pass + either fix the validation UI feedback or adjust test locator.

### Bug 004 — Wizard numeric field — text input not rejected

- **Severity:** Minor
- **Category:** form validation
- **Test ID:** T4.03
- **Error:** `page.waitForFunction: Timeout 30000ms exceeded`
- **Pre-existing:** Unknown — same as T4.02 (category threw in runs 1+2).
- **Root cause hypothesis:** The test types text into a numeric field and waits for rejection feedback. The numeric fields (`NumericField.jsx`) may filter non-numeric input silently (no error message), which is valid UX but doesn't match the test's wait condition.
- **Effort estimate:** S — manual verification + test adjustment if silent filtering is the intended behavior.

### Bug 005 — A11y: Master Sheet `select-name` CRITICAL violation

- **Severity:** Blocker
- **Category:** a11y
- **Test ID:** T7.11
- **Error:** `1 CRITICAL a11y violation(s): select-name`
- **Pre-existing:** Unknown — `cat07-a11y` threw an infrastructure error in runs 1+2, so T7.11 never ran. First shakedown run where this test executed.
- **Root cause:** A `<select>` element on the Master Sheet page lacks an accessible name (no associated `<label>`, `aria-label`, or `aria-labelledby`). Most likely the week-picker dropdown (`<select>` for `selectedWeek`). Axe rule: `select-name`.
- **Fix area:** `src/components/manager/MasterSheet.jsx` — add `<label htmlFor="week-select">Week</label>` + matching `id="week-select"` on the `<select>`, or add `aria-label="Week"` directly to the select element.
- **Effort estimate:** XS — one-line aria-label or label element addition.

### Bug 006 — Screenshot dossier — 79 captures (target ≥80)

- **Severity:** Polish
- **Category:** screenshot dossier
- **Test ID:** T8.ALL
- **Error:** `assertion failed` (79 < 80)
- **Root cause:** One screenshot expected by the dossier count was not captured — likely a downstream effect of a test that exited early (T2A.03 wizard walk, or a skipped platform-admin screenshot). Not a functional regression.
- **Effort estimate:** XS — adjust dossier count target or fix upstream test that exits before taking its screenshot.

---

## Test coverage report

| Category | Tests | Pass | Fail | Notes |
|---|---|---|---|---|
| cat01-auth | 10 | 10 | 0 | All 10 pass — includes T1.01 SHAKEDOWN-001 verification |
| cat02-agent | 14 | 13 | 1 | T2A.03 wizard screen 5 — pre-existing across all 3 runs |
| cat02-unit-manager | 10 | 9 | 1 | T2B.02 now PASS; T2B.03 still FAIL (incomplete fix) |
| cat02-branch-manager | 14 | 14 | 0 | |
| cat02-tenant-admin | 10 | 10 | 0 | |
| cat02-platform-admin | 4 | 2 | 2 | T2E.01–02 skipped — no PA creds in test env (expected) |
| cat03-permission-matrix | 17 | 17 | 0 | |
| cat04-form-validation | 12 | 8 | 4 | T4.02 + T4.03 fail (first run to reach them); T4.08–09 skipped |
| cat05-edge-cases | 10 | 10 | 0 | |
| cat06-cross-role-flows | 8 | 8 | 0 | |
| cat07-a11y | 18 | 17 | 1 | T7.11 Master Sheet select-name CRITICAL — first run to reach it |
| cat08-screenshot-dossier | 1 | 0 | 1 | 79/80 captures |
| cat10-email-infra | 6 | 6 | 0 | |

---

## Cross-run comparison (3 shakedown runs)

| Run | Date | Pass/Total | Notes |
|---|---|---|---|
| Run 1 | 2026-05-13T22-48-09 | ~71 / ~106 | Pre-fix baseline; cat04 + cat07 threw infra errors |
| Run 2 | 2026-05-13T23-12-38 | ~75 / ~106 | Partial progress; cat04 + cat07 still throwing |
| **Run 3** | **2026-05-14T08-18-31** | **124 / 134** | Post PR #141 + #142; cat04 + cat07 now running |

Run 3 reached 134 tests (up from ~106) because the infrastructure errors in cat04-form-validation and cat07-a11y were resolved in the PR-F seeder update, allowing those categories to run for the first time.

---

## Performance observations

- Run time: 0.16h total (budget: ≤10h)
- Seed: 10 users, 28 submissions, 21 persistency docs, 1 campaign — all clean
- Cleanup: 10 Auth users + 142 Firestore docs deleted; 0 `*@agencytrack.test` users remaining

---

## A11y violations summary

| Severity | Count |
|---|---|
| Critical | 1 |
| Serious  | 17 |
| Moderate | 0 |
| Minor    | 0 |

Full per-surface breakdown in `verification/shakedown-screenshots-2026-05-14T08-18-31/cat07-a11y/a11y-violations-report.json`.

The 17 Serious violations are split across multiple surfaces — review the JSON for per-surface breakdown. The 1 Critical (`select-name` on Master Sheet week picker) is tracked as Bug 005.

---

## Required before pilot ship

Priority order for fixing before demo:

1. **Bug 002** (Major) — `getWeeklySubmissions` unit scoping. Completes the SHAKEDOWN-002 Master Sheet fix. UM cannot see other units' submission data in the Master Sheet. Security-relevant.
2. **Bug 005** (Blocker severity per a11y rubric) — `select-name` on Master Sheet week picker. XS effort, blocks a11y gate.
3. **Bug 001** (Major) — Wizard screen 5 navigation. Manual verification pass required to confirm if this is test fragility or real regression.

Bugs 003, 004, 006 are Minor/Polish — do not block pilot demo but should be tracked.

---

## Open questions for Kyron

- Platform Admin T2E.01–02 skipped — is the PA UI planned before pilot? Brief §2E advises banking as a follow-up.
- T4.02/T4.03: confirm whether the wizard silently filters invalid input (no error message) or shows a validation error. If silent, tests need adjustment; if error should show, it's a UI gap.
- 17 Serious a11y violations — review breakdown in per-surface JSON for any pilot-blocking items.

---

*Shakedown run: `2026-05-14T08-18-31` | Batch: `0d8a2964-5122-4dc4-9690-951143174f36` | Tool: pre-pilot shakedown suite v1*

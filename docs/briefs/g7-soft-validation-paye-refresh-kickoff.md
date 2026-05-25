# Track G G7 — Soft Validation + PAYE Refresh Kickoff Brief

## Slice
**G7 — Soft Validation + PAYE Refresh** (auto-merge eligible)

## Goal
Two independent improvements to Money Needs:

1. **NUDGE dialog** — when an agent saves their personal commitment (API goal in CareerPortal)
   below their `firstYearCommissionsRequired`, show a soft "are you sure?" dialog (not a block).

2. **PAYE refresh banner** — when the saved `payeBracketsVersionId` on the worksheet differs
   from the current `PAYE_BRACKETS_VERSION`, show a hard banner + "Refresh PAYE Calculation"
   button that recomputes and saves the rollup.

## Methodology requirement
CC must surface (STOP and wait for dispatcher) before any decision not in "Decisions locked."

## Rule 17 source verification (completed pre-brief)

### Personal-commitment save path
- `CareerPortal.jsx:100` — `handleSave()` calls `setGoals(tenantId, uid, { personalAnnualAPI, ... })`
- CareerPortal loads `goals` on mount (line ~86) but does NOT load money needs.
- No existing nudge, confirmation, or cross-check logic.
- **Plan:** load `firstYearCommissionsRequired` from the money needs doc on CareerPortal mount;
  check before `setGoals` in `handleSave`; show inline dialog if under threshold.

### PAYE refresh
- `moneyNeedsService.js` exports `PAYE_BRACKETS_VERSION = 'default-2026'` and stamps it on every
  `updateExpenseGroup` / `updateSubCalculator` / `updateCommissionTargets` call.
- `worksheet.payeBracketsVersionId` is stored on the Firestore doc.
- Mismatch condition: `worksheet.payeBracketsVersionId !== PAYE_BRACKETS_VERSION`.
- **Plan:** show banner in `MoneyNeedsPanel`; "Refresh PAYE Calculation" button calls a new
  `refreshPAYECalculation(tenantId, uid, year, expenseGroups)` service function.

## G7a — NUDGE dialog

### CareerPortal.jsx changes
1. Import `getMoneyNeeds` from `moneyNeedsService`.
2. `useState(null)` for `moneyNeedsRequired` — loaded on mount alongside `goals`.
3. `useState(false)` for `showNudge` — controls dialog visibility.
4. `useState(null)` for `pendingGoalPayload` — stash the payload while dialog is open.
5. In `useEffect` mount: alongside `getGoals`, call `getMoneyNeeds(tenantId, uid, currentYear)`.
   Set `moneyNeedsRequired = doc?.firstYearCommissionsRequired ?? 0`.
6. In `handleSave`:
   - After validation passes (setGoals handles floor enforcement), check:
     `if (moneyNeedsRequired > 0 && parseFloat(draft.personalAnnualAPI) < moneyNeedsRequired)`
   - If true: stash payload in `pendingGoalPayload`, set `showNudge = true`, **return early**.
   - Normal save path continues unchanged when threshold not triggered.
7. `handleNudgeConfirm()`: proceeds with the stashed save, clears nudge state.
8. `handleNudgeDismiss()`: clears nudge state, does NOT save.
9. Nudge dialog: inline overlay (not a portal) with two buttons:
   - "Yes, continue" → `handleNudgeConfirm()`
   - "Cancel" → `handleNudgeDismiss()`
   - Message: "Your commitment (TTD X) is below your Money Needs requirement (TTD Y). Save anyway?"

### `currentYear` in CareerPortal
`const CURRENT_YEAR = new Date().getFullYear()` — same pattern as MoneyNeedsPanel.

## G7b — PAYE refresh banner

### `refreshPAYECalculation(tenantId, uid, year, expenseGroups)` (new in moneyNeedsService.js)
- Calls `computeWorksheetRollup(expenseGroups)`
- Single `updateDoc` patch:
  - `totalAnnualAfterTax`, `totalAnnualPreTax`, `computedPAYE` from rollup
  - `payeBracketsVersionId: PAYE_BRACKETS_VERSION`
  - `updatedAt: serverTimestamp()`, `updatedBy: uid`
- Returns rollup
- Throws for invalid year

### MoneyNeedsPanel.jsx changes
- Add `PAYERefreshBanner` sub-component: renders when
  `worksheet && worksheet.payeBracketsVersionId && worksheet.payeBracketsVersionId !== PAYE_BRACKETS_VERSION`
- Banner shows: "Your PAYE calculation is based on an older tax bracket version. [Refresh PAYE Calculation]"
- "Refresh PAYE Calculation" button calls `refreshPAYECalculation`; on success, merges rollup into worksheet state; banner hides
- Import `refreshPAYECalculation` and `PAYE_BRACKETS_VERSION` from moneyNeedsService
- Render banner at top of worksheet section (above expense groups)

## Test changes (`moneyNeedsService.test.js`)

New suite: `refreshPAYECalculation` (5 tests)
- calls updateDoc (not setDoc)
- patches totalAnnualAfterTax, totalAnnualPreTax, computedPAYE from rollup
- stamps payeBracketsVersionId = PAYE_BRACKETS_VERSION
- stamps updatedAt serverTimestamp + updatedBy uid
- throws for invalid year

## Decisions locked
- Nudge is SOFT (not a block) — saving below threshold is allowed after confirmation
- `moneyNeedsRequired` is loaded for `currentYear` only (same year as the worksheet default)
- PAYE banner is conditional on `payeBracketsVersionId` being set AND not matching current version
  (new worksheets start null — no banner shown until first sub-calc/group save stamps the version)
- `refreshPAYECalculation` uses `expenseGroups` from current worksheet state (no re-fetch)
- Nudge dialog is inline (not a portal/modal) to avoid z-index complexity
- `pendingGoalPayload` stashes the full draft object; `handleNudgeConfirm` uses it directly

## File inventory
- `src/services/moneyNeedsService.js` — add `refreshPAYECalculation`
- `src/services/__tests__/moneyNeedsService.test.js` — add 5 tests
- `src/components/profile/CareerPortal.jsx` — nudge dialog + money needs load
- `src/components/agent/MoneyNeedsPanel.jsx` — PAYERefreshBanner + import refresh fn

## Verification
- `npm run lint && npm test && npm run build` — all pass
- Preview smoke: CareerPortal edits panel visible; MoneyNeedsPanel banner not shown (version matches)
- Class proof: all new tests pass

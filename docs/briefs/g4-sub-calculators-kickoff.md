# Track G G4 — Sub-Calculators Kickoff Brief

## Slice
**G4 — Sub-Calculators** (auto-merge eligible)

## Goal
Add three sub-calculator panels to the Money Needs Worksheet that compute specialized expense
subtotals and roll them into the correct expense groups via `subCalculatorRefs`. On every save,
patch `subCalculators.{key}` AND recompute affected parent groups + grand totals.

## Methodology requirement
CC must surface (STOP and wait for dispatcher) before any decision not in "Decisions locked."

## Three calculators

### (a) InsuranceIndustry
- Line items: `{id, label, amount, frequency, annualizedAmount, isCustom}`
- Computes `annualTotal = sum(annualizedAmounts)`
- Rolls into **businessExpenses** via `subCalculatorRefs`

### (b) CarExpenses
- Line items: same shape
- Two modes: `withLoan: false` (default) | `withLoan: true`
  - withLoan=false: raw line items annualized → split 1/3 personal, 2/3 business
  - withLoan=true: same split (loan payments are already the expense)
- `personalSharePct = 33`, `businessSharePct = 67` (constants, not user-editable in G4)
- `annualTotalPersonal` → rolls into **livingExpenses**
- `annualTotalBusiness` → rolls into **businessExpenses**
- Both contributions land in their respective group's `subCalculatorRefs`

### (c) LoansDebt
- Line items: same shape
- Computes `annualTotal`
- **NOT rolled into any expense group** — standalone total only

## Service changes (`moneyNeedsService.js`)

### `mergeSubCalcRef(group, key, annualTotal)`
Pure helper: returns a new group object with `subCalculatorRefs` array updated
(upsert by `key`, replace if exists). Recomputes `groupAnnualTotal`.

### `updateSubCalculator(tenantId, uid, year, calcKey, calcData, worksheetDoc)`
- Patches `subCalculators.{calcKey}` with `calcData`
- For InsuranceIndustry: calls `mergeSubCalcRef` on businessExpenses group
- For CarExpenses: calls `mergeSubCalcRef` on livingExpenses (personal) AND businessExpenses (business)
- For LoansDebt: no group merge (standalone)
- Recomputes full rollup via `computeWorksheetRollup` on updated expense groups
- Single `updateDoc` patch:
  - `subCalculators.{calcKey}`: calcData
  - `expenseGroups.{affectedKey}`: updated group(s) (only affected groups, not all)
  - rollup fields: `totalAnnualAfterTax`, `totalAnnualPreTax`, `computedPAYE`
  - `payeBracketsVersionId: PAYE_BRACKETS_VERSION`
  - `updatedAt: serverTimestamp()`
  - `updatedBy: uid`
- Returns `{ rollup, updatedGroups }` for optimistic UI update

## UI changes (`MoneyNeedsPanel.jsx`)

Three new accordion-style panels below the expense group accordions:

1. **InsuranceIndustryCalc** — same LineItemRow pattern as expense groups; header shows annualTotal; on save rolls into businessExpenses
2. **CarExpensesCalc** — same LineItemRow pattern + withLoan toggle (toggle label: "Includes loan payments"); header shows personal/business split; on save rolls into livingExpenses + businessExpenses
3. **LoansDebtCalc** — same LineItemRow pattern; header shows annualTotal; standalone (no group roll-in)

A "Sub-Calculators" section header separates the sub-calc panels from the 5 expense group panels.

`MoneyNeedsPanel.handleSubCalcSaved(calcKey, calcData, { rollup, updatedGroups })`:
- Merges `updatedGroups` into `worksheet.expenseGroups`
- Merges rollup into worksheet
- Updates `worksheet.subCalculators[calcKey]` to `calcData`

## Test changes (`moneyNeedsService.test.js`)

New suite: `mergeSubCalcRef` (4 tests)
- inserts new ref when key absent
- updates existing ref by key
- recomputes groupAnnualTotal including subCalcTotal
- handles missing subCalculatorRefs gracefully

New suite: `updateSubCalculator` (8 tests, grouped by calcKey)
- InsuranceIndustry: patches subCalculators.insuranceIndustry, merges into businessExpenses, returns rollup
- CarExpenses: patches subCalculators.carExpenses, merges personal into livingExpenses, merges business into businessExpenses, returns rollup
- LoansDebt: patches subCalculators.loansDebt, does NOT write any expenseGroups key, returns rollup

## Decisions locked
- `personalSharePct = 33`, `businessSharePct = 67` are hardcoded constants (G4 scope)
- `withLoan` toggle is user-controlled boolean
- LoansDebt does NOT roll into any expense group
- `updateDoc` single-call patch (not multiple updateDoc calls)
- Only affected expense groups are written (InsuranceIndustry writes businessExpenses only; CarExpenses writes both living + business; LoansDebt writes neither)
- `mergeSubCalcRef` is a pure function (exported, testable)
- CarExpenses stores `annualTotalPersonal` and `annualTotalBusiness` separately in the Firestore doc

## File inventory
- `src/services/moneyNeedsService.js` — add `mergeSubCalcRef`, `updateSubCalculator`
- `src/services/__tests__/moneyNeedsService.test.js` — add 12 new tests
- `src/components/agent/MoneyNeedsPanel.jsx` — add 3 sub-calc panels + `handleSubCalcSaved`

## Verification
- `npm run lint && npm test && npm run build` — all pass
- Preview smoke: open each sub-calc panel, add a line item, verify rollup updates in PAYE Summary
- Class proof: all new tests pass; expense groups show updated subCalcRef totals after sub-calc save

## Phase 1 — Source verify
- Verify `moneyNeedsService.js` current exports and `BLANK_SCAFFOLD` sub-calculator shapes
- Verify `MoneyNeedsPanel.jsx` has `handleGroupSaved` optimistic merge pattern to adapt for sub-calcs
- Verify `computeGroupTotal` already handles `subCalculatorRefs` (confirmed in G3: yes it does)

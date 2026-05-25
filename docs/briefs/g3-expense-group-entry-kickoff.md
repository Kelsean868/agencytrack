# G3 — Expense Group Entry Kickoff Brief

**Track G, Slice 3.** Auto-merge authorized per Track G autonomous run.

## What ships

Line-item add/edit/delete across the 5 expense groups in `MoneyNeedsPanel.jsx`. PAYE summary section wired live via `grossFromNet`. Recomputed rollups on every save.

## Decisions locked

- Line item shape: `{ id, label, amount, frequency, annualizedAmount, isCustom }`.
- Frequency codes A/S/Q/M → ×1/×2/×4/×12 respectively.
- Each group save patches `expenseGroups.{groupKey}` only (not the whole doc) via `updateDoc` field-path.
- Rollup recomputed on every save: `groupAnnualTotal` per group, `totalAnnualAfterTax` (sum of groups), `totalAnnualPreTax = grossFromNet(totalAnnualAfterTax, DEFAULT_PAYE_CONFIG)`, `computedPAYE`.
- `payeBracketsVersionId: 'default-2026'` stamped on every save (G7 refresh-banner key).
- `subCalculatorRefs` field on groups is initialized `[]` and preserved unchanged in G3 (G4 writes to it).
- G3 does NOT change firestore.rules (existing `allow update: if canAccessOwn` covers the patch).
- PAYE summary shown below all 5 accordion groups: after-tax need → required gross → estimated PAYE.
- Save happens on: add row, delete row, blur of amount/label/frequency-change.
- No rules deploy needed (rules live from G1 PR #343).

## Files

**Modified:**
- `src/services/moneyNeedsService.js` — add `updateDoc` import; export `FREQUENCY_MULTIPLIERS`, `PAYE_BRACKETS_VERSION`, `annualizeAmount()`, `computeGroupTotal()`, `computeWorksheetRollup()`, `updateExpenseGroup()`.
- `src/components/agent/MoneyNeedsPanel.jsx` — replace `AccordionGroup` shell with `ExpenseGroupAccordion` (line-item loop, add/delete/edit, per-group save state); add `PAYESummary` section.
- `src/services/__tests__/moneyNeedsService.test.js` — add tests for new exports.

**No new files.**

## Acceptance criteria

- Line items add/edit/delete across all 5 groups.
- Frequency selector updates annualized amount live.
- Group total and grand total recompute on every save.
- PAYE section reflects saved totals.
- Reload persists all line items.
- Vitest 0 failures; lint 0; build clean.
- Preview smoke: enter lines → totals + PAYE update → reload persists → cleanup.

## Phase 1 source-verify commands

```powershell
# Verify moneyNeedsService current exports
Select-String -Path src/services/moneyNeedsService.js -Pattern "^export"
# Verify MoneyNeedsPanel AccordionGroup placeholder
Select-String -Path src/components/agent/MoneyNeedsPanel.jsx -Pattern "coming in G3"
# Verify updateDoc not yet imported
Select-String -Path src/services/moneyNeedsService.js -Pattern "updateDoc"
# Verify rules moneyNeeds arm (no change needed)
Select-String -Path firestore.rules -Pattern "moneyNeeds" -Context 2
```

# Track G G6 — Commission Targets + Send to Playground Kickoff Brief

## Slice
**G6 — Commission Targets + Send to Playground** (auto-merge eligible)

## Goal
Compute `firstYearCommissionsRequired` from PAYE rollup and renewal income, split into
per-product-line targets, and wire a "Send to Playground" button that seeds CommissionPlayground's
`incomeGoal` via localStorage.

## Methodology requirement
CC must surface (STOP and wait for dispatcher) before any decision not in "Decisions locked."

## Rule 17 source verification (completed pre-brief)
- `GoalDecompositionTab` uses `useState(DEFAULT_INPUTS)` with `incomeGoal: 300000` hardcoded.
- No existing external seeding mechanism (no prop, no localStorage read, no useEffect for incomeGoal).
- Props accepted: `submissions`, `agentId`, `tenantId` — no `initialIncomeGoal`.
- Only external `useEffect` mutates `ciToSaleRatio` / `dialsToCIRatio` — not `incomeGoal`.
- **Confirmed: localStorage bridge is the correct approach.**

## Commission targets logic (MoneyNeedsPanel / moneyNeedsService)

### `computeCommissionTargets(worksheet)`
Pure function:
```js
firstYearCommissionsRequired = totalAnnualPreTax - estimatedRenewalIncome.total
firstYearCommissionsTargets = {
  life:     worksheet.firstYearCommissionsTargets?.life     ?? 0,
  ah:       worksheet.firstYearCommissionsTargets?.ah       ?? 0,
  property: worksheet.firstYearCommissionsTargets?.property ?? 0,
  motor:    worksheet.firstYearCommissionsTargets?.motor    ?? 0,
  total:    (life + ah + property + motor)   // recomputed from line values
}
```
`firstYearCommissionsRequired` is computed (not user-editable). Product-line splits are user-editable.

### `updateCommissionTargets(tenantId, uid, year, targets, worksheet)`
- `targets`: `{ life, ah, property, motor }` from UI
- Computes `total = life + ah + property + motor`
- Single `updateDoc` patch:
  - `firstYearCommissionsRequired`: `totalAnnualPreTax - estimatedRenewalIncome.total`
  - `firstYearCommissionsTargets`: `{ life, ah, property, motor, total }`
  - `updatedAt: serverTimestamp()`
  - `updatedBy: uid`
- Returns `{ firstYearCommissionsRequired, firstYearCommissionsTargets }`

## UI changes

### CommissionTargetsPanel (new sub-component in MoneyNeedsPanel.jsx)
- Renders below sub-calculator section
- Shows computed `firstYearCommissionsRequired` (read-only, prominent)
- Four numeric fields: Life, A&H, Property, Motor (editable, saves on blur)
- Shows running `total` of the four fields
- AGENT-ONLY: hide entirely for manager views (MoneyNeedsPanel is already agent-only)

### "Send to Playground" button
- Appears below CommissionTargetsPanel (AGENT-ONLY guard already handled by panel placement)
- On click: `localStorage.setItem('agencytrack-playground-income-goal', JSON.stringify(firstYearCommissionsRequired))`
- Shows a brief "Sent!" confirmation state (1.5s)

### GoalDecompositionTab seed on mount
- At top of component, after `useState(DEFAULT_INPUTS)`:
  ```js
  useEffect(() => {
    const stored = localStorage.getItem('agencytrack-playground-income-goal');
    if (stored) {
      const val = parseFloat(JSON.parse(stored));
      if (val > 0) setInputs((prev) => ({ ...prev, incomeGoal: val }));
    }
  }, []);
  ```
- Runs once on mount; does not clear the localStorage value (idempotent re-visits)

## Renewal income display
- `estimatedRenewalIncome` already scaffolded in `BLANK_SCAFFOLD`
- In CommissionTargetsPanel, show read-only renewal total: `worksheet.estimatedRenewalIncome?.total ?? 0`
- No editing UI for renewal income in G6 (dispatcher to confirm if needed — current scope: read-only display)

## Test changes (`moneyNeedsService.test.js`)

New suite: `updateCommissionTargets` (6 tests)
- calls updateDoc with firstYearCommissionsRequired = totalAnnualPreTax - renewalTotal
- patches firstYearCommissionsTargets with { life, ah, property, motor, total }
- total = sum of four product lines
- stamps updatedAt serverTimestamp + updatedBy uid
- returns firstYearCommissionsRequired and firstYearCommissionsTargets
- throws for invalid year

## Decisions locked
- `firstYearCommissionsRequired = totalAnnualPreTax - estimatedRenewalIncome.total` (computed, not stored as editable)
- Product-line targets are user-editable fields, saved on blur
- localStorage key: `'agencytrack-playground-income-goal'`
- `GoalDecompositionTab` reads localStorage once on mount, does not clear it
- Renewal income display is read-only in G6 (no editing UI)
- "Send to Playground" only sends `firstYearCommissionsRequired` (life sub-target per run spec)
- CommissionTargetsPanel is within the existing agent-only MoneyNeedsPanel (no role guard needed)

## File inventory
- `src/services/moneyNeedsService.js` — add `updateCommissionTargets`
- `src/services/__tests__/moneyNeedsService.test.js` — add 6 tests
- `src/components/agent/MoneyNeedsPanel.jsx` — add `CommissionTargetsPanel` component + Send button
- `src/components/goals/CommissionPlayground/tabs/GoalDecompositionTab.jsx` — add mount useEffect for localStorage seed

## Verification
- `npm run lint && npm test && npm run build` — all pass
- Preview smoke: verify `firstYearCommissionsRequired` field appears, "Send to Playground" button present, navigating to CommissionPlayground shows seeded income goal
- Class proof: all new tests pass

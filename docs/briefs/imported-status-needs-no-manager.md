> Model: **Sonnet 5**, effort **medium**. The change is small and fully specified below. The care is in the scoping, not the code.

# Brief — a head-office status needs no manager confirmation

## The bug, in one line

229 imported policies show "Awaiting manager" on the agent ledger, and the 117 settled ones sit in the manager's "To reconcile" worklist, because the UI asks `confirmedAt` — which the import never sets — instead of asking where the status came from.

## Evidence (live, read-only, 19 Sep 2026)

`tenants/tatillife_south/policies`, 229 docs, all `importSource: 'oipa_import'`:

| status | total | confirmedAt set | confirmedAt null |
|---|---|---|---|
| settled | 117 | 0 | 117 |
| lapsed | 87 | 0 | 87 |
| ntu | 22 | 0 | 22 |
| denied | 3 | 0 | 3 |

One settled imported doc:

```
status               "settled"
statusSource         "oipa_import"
statusSetBy          "import"
statusAsOf           "2026-09-15"
confirmedAt          null
confirmedByManager   null
```

The data is correct. P4e already stamped provenance on all 229. Only the read side is wrong.

## The rule being encoded

A policy whose status came from the OIPA head-office export **does not need a manager to confirm it**. Head office is the authority for that status. A policy whose status a person typed still does.

## Changes — exactly these three files

### 1. `src/lib/policyStatusTokens.js` — one new helper

Add, next to `isConfirmed`:

```js
import { STATUS_SOURCE_IMPORT } from './portfolioImport/oipaImportConfig';

/**
 * Does this policy still need a manager to confirm its status?
 *
 * No, when the status came from the OIPA head-office export: head office is the
 * authority there, and no manager step was ever part of that path. Yes for
 * everything else, including every policy an agent or manager keyed by hand.
 *
 * Reads `statusSource` — the field that records who set the status — not
 * `importSource`, which only records how the document arrived. A policy that was
 * imported and then had its status changed by a person has statusSource 'agent'
 * or 'manager', and correctly still needs the manager.
 */
export function needsManagerConfirmation(policy) {
  return policy?.statusSource !== STATUS_SOURCE_IMPORT;
}
```

**Do not change `isConfirmed`. Do not change `policyRole`.** An imported settled policy keeps the green `settled` role. It must **not** become the gold `confirmed` role — no manager confirmed it, and the colour would say one did.

### 2. `src/components/agent/policyLedger/PolicyCard.jsx` — the card hint

In `actionHint`, replace the settled branch:

```js
if (policy.status === 'settled') {
  return needsManagerConfirmation(policy) ? 'Awaiting manager' : null;
}
```

An imported settled policy gets **no hint** — there is no action for the agent to take. The provenance line already lives in the drill drawer (`PolicyDrillDrawer.jsx`, `importedStatusNote`). Do not add a second copy of it to the card.

### 3. `src/components/manager/PolicyReconciliationPanel.jsx` — the worklist

```js
const toReconcile = periodSettled.filter((p) => !p.confirmedAt && needsManagerConfirmation(p));
```

`flaggedSet` and `confirmedClean` need no change — both already require `confirmedAt`, which no imported policy has. `pendingValue` follows `toReconcile` and needs no separate edit.

## Out of scope — do not touch

- **No data writes.** No backfill, no script, no `confirmedAt` values. The fix is read-side only. Writing a confirmation that never happened is the thing this brief exists to avoid.
- **`getDeliverablePolicies` in `src/services/policiesService.js` is already correct** — it filters imported policies out of the CRO Delivery Register. Leave it alone.
- No deploy. Kyron deploys after merge.
- No changes to `firestore.rules`, the import functions, or `oipaImportConfig.js` beyond importing the existing constant.

## Tests

Add to the existing suites — do not rewrite them:

1. `src/lib/__tests__/` for `policyStatusTokens` — `needsManagerConfirmation` is `false` for `statusSource: 'oipa_import'`, `true` for `'agent'`, `'manager'`, and for a policy with no `statusSource` at all.
2. `src/components/agent/__tests__/PolicyLedgerPanel.test.jsx` — a settled policy with `statusSource: 'oipa_import'` and `confirmedAt: null` shows **no** "Awaiting manager". The existing test at line 195 (settled, no `statusSource`, still shows "Awaiting manager") must keep passing unchanged — that is the guard that this did not silence the hint for everyone.
3. `PolicyReconciliationPanel` — an imported settled policy in the selected period is absent from the "To reconcile" count and worklist; a hand-keyed settled policy in the same period is still present.

## Deliverables

1. A PR titled `fix(ledger): imported statuses need no manager confirmation`.
2. **Evidence paste-back** in the PR body: the final `Test Files` / `Tests` summary lines from `npm test`, exactly as printed.
3. One line in the PR body naming the three changed source files and confirming no script or data file was added.

## Baseline

`npm test` on this tree right now: **392 test files passed, 6561 tests passed.** After the change the totals go up by the new tests and nothing turns red. A failure elsewhere means the helper was wired somewhere it should not be — stop and report rather than adjusting the other test.

## Not your call

Whether the card should say something instead of nothing for imported policies is Kyron's to judge on screen after this ships. Build it as specified — no hint — and leave that open.

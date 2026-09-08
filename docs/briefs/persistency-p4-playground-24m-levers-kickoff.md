# Persistency P4 — the What-If Playground catches up with the 24-month model

**Written 7 September 2026.** Follows `docs/briefs/persistency-24-month-model-brief.md` (P1, PR #937), P1b, and P2 (PR #939), all merged.

**Model: Sonnet 5, medium effort.** Two new optional parameters, two new levers, one header line. No change to any stored number.

**Target repo:** this one only. One branch, one PR.

---

## 1. The problem

The playground's arithmetic is **correct today**. It reads `currentRecord.grossSettled` — the value `savePersistency` already derived through `deriveAll`, which subtracts `decreases` on a September-onward month. So it starts from a true 24-month Net Gross Settled and everything downstream follows.

What it cannot do is model the new model.

1. **No decreases lever.** A decrease lowers gross, and net falls with it, so persistency drops. From September that is one of the main ways an agent loses ground, and the planner offers no way to see it or plan against it.
2. **`goodBusinessFallingOff` is hardcoded to `0`** at both call sites. It is the lever for business rolling out of the window — and the window just went from 12 months to 24, which changes how much rolls off and when. Invisible.
3. **Nothing on screen names the model.** The denominator is now roughly twice the size it was in August, so the new business needed to move the number is roughly double. An agent planning on last month's instinct will under-shoot and not know why. **This is the one that actually misleads.**

---

## 2. What makes this a small slice

`projectPersistency` already computes `projectedNet` from `projectedGross`:

```
projectedGross = current + newBusiness + newOrphans − goodBusinessFallingOff
projectedNet   = projectedGross − projectedLapses + projectedReinstatements
```

So anything that reduces gross reduces net by the same amount automatically. **A decrease and business-falling-off are arithmetically the same shape** — both subtract from gross, and net follows. No new maths is required, only a second named subtractor so the two read differently to the agent.

`calculateShortfall` needs the same one-line change: its `baseline` subtracts `goodBusinessFallingOff` and must also subtract the new term. The algebra in its docblock is unchanged — the baseline simply gets smaller.

### The safety fact that sizes this slice

`projectPersistency` and `calculateShortfall` are imported by **`PersistencyPlayground.jsx` and their own tests, and nothing else**. `src/lib/strategicPlan/assembleModel.js:168` names `projectPersistency` in a comment specifically to say it is a what-if and is deliberately not used there. No award gate, no financing gate, no stored money field, no export reads either function.

So this is a planning surface only. It cannot move a number anyone is paid on. That is why it is Sonnet 5 and not Opus 5, unlike P1.

---

## 3. What to build

### 3.1 `calculations.js` — two optional parameters

`projectPersistency` gains `decreasesAnticipated`, defaulting to `0` through the existing `num()`:

```js
const projectedGross = num(currentGrossSettled)
  + num(newBusinessPlanned)
  + num(newOrphansAdopted)
  - num(goodBusinessFallingOff)
  - num(decreasesAnticipated);
```

`calculateShortfall` gains the same parameter:

```js
const baseline = num(currentGrossSettled)
  - num(goodBusinessFallingOff)
  - num(decreasesAnticipated);
```

Every existing call site omits both and derives exactly what it does today. **Pin that with a test:** the current `projectPersistency` and `calculateShortfall` fixtures in `calculations.test.js` must produce identical output with the new parameter absent.

Docblocks: say plainly that a decrease reduces the denominator and the numerator falls with it, so persistency drops — and that this is the memo's `Decreases` term modelled forward, not the stored input.

### 3.2 `PersistencyPlayground.jsx` — the two levers

Add to the `LEVERS` array and `ZERO_LEVERS`:

| id | label | sublabel |
|---|---|---|
| `decreasesAnticipated` | Decreases Expected | premium reductions on in-force policies (TTD) |
| `goodBusinessFallingOff` | Business Rolling Off | good business leaving the window (TTD) |

Wire both through to `projectPersistency` and `calculateShortfall` in place of the hardcoded `0`s at lines 81, 85 and 93. Both default to `0`, so an untouched playground behaves exactly as it does now.

**Effective-dating:** show `decreasesAnticipated` **only on a 24-month-model month**. `currentRecord.monthKey` is already on the record — `persistencyService` reads `d.monthKey` — so derive the model with `persistencyModelFor(currentRecord.monthKey)`. No new prop. On a legacy month the doc has no `decreases` input at all, so offering the lever would invite a plan against a term that month does not have.

Guard the monthKey the way `PersistencyEntryForm.jsx:32-37` already does: `persistencyModelFor` throws on a malformed key, deliberately, and a modal must not take a whole tab down. Reuse that pattern rather than inventing a second one.

`goodBusinessFallingOff` shows on **both** models — it was always meant to be there.

### 3.3 The header line

Under `What-If Playground · My data / Coaching`, add the model and window from `persistencyModelFor(...)`:

```
24-month model · September 2026 onwards
```
and for a legacy month:
```
12-month model · through August 2026
```

Take the words from the model object rather than writing two literals. This is the change that stops an agent planning on the wrong basis.

### 3.4 Empty and error states

The playground already renders a `!currentRecord` branch. A record with an unusable `monthKey` must fall back to hiding the decreases lever and showing no model line — never a crash, never a guessed model.

---

## 4. Out of scope

- Any change to `deriveAll`, `calculateGrossSettled`, `calculateNetSettled`, or `calculatePersistency`. The stored numbers are correct and are not touched.
- `PERS_GATE`, `PERS_FLOOR`, and every `persistGate` in the awards ruleset — P-D7 stands.
- `firestore.rules`, `firestore.indexes.json`, `functions/`. Plain merge, no `firebase deploy`.
- Slice P3, still gated on Tatil's process document.
- The `persistencyV2` allowlist item now banked in FOLLOW_UPS — do not fold it in here, it needs a rules change.

---

## 5. Deliverables — paste these in the PR body

1. **The unchanged-behaviour proof:** the existing `projectPersistency` and `calculateShortfall` fixtures, output before and after, identical with the new parameter absent.
2. **The decreases proof:** one worked example showing that adding a decrease lowers projected persistency — starting gross, decrease applied, projected persistency before and after, with the arithmetic spelled out.
3. **Two screenshots:** the playground on a **2026-08** record (six-input month — no decreases lever, "12-month model" line) beside a **2026-09** record (seven-input month — decreases lever present, "24-month model" line).
4. **The shortfall cross-check:** feed `nbNeeded` back into `projectPersistency` with a non-zero decreases value and show it lands on `PERS_GATE`. The existing test at `calculations.test.js:419-422` already does this for the zero case — extend it rather than writing a parallel one.

Post-merge fill on this brief and on `docs/CONTEXT.md` after Kyron merges.

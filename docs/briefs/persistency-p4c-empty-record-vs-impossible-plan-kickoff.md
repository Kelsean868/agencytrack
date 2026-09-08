# Persistency P4c — tell "no data yet" apart from "this plan is impossible"

**Written 7 September 2026.** Amends PR #940 **before it merges**. Corrects a defect introduced by the P4b brief, not by the P4b build — P4b implemented the specified condition and wording exactly, and flagged this in its own report.

**Model: Sonnet 5, low effort.** One condition split, one neutral message, one card-copy fix.

**Branch: commit onto the existing `persistency-p4-playground-24m-levers`.** No new branch, no second PR.

---

## 1. What is wrong

P4b guards on `projectedGross <= 0` and renders:

> This plan drives Net Gross Settled to zero or below — lower Decreases Expected or Business Rolling Off.

An agent with **no persistency record for the month** has `grossSettled = 0`. The guard therefore fires **at rest**, before any lever is touched, and blames the agent for two sliders they never moved.

This is not an edge case right now. September persistency has not been entered anywhere yet, so most agents currently have no record. The first thing they would see on a coaching screen is a red warning about a plan they never made.

The condition should not be "is the projection at or below zero". It should be **"did the plan drive it there"**.

---

## 2. The two states, kept apart

| State | Condition | What renders |
|---|---|---|
| Nothing to plan from | `current.grossSettled <= 0` | a neutral line, no danger styling, no projected figure, no shortfall cards |
| The plan is impossible | `current.grossSettled > 0` **and** `projectedGross <= 0` | the P4b danger message, exactly as built today |
| Normal | `current.grossSettled > 0` and `projectedGross > 0` | unchanged |

The second row is already correct and must keep its wording, its `data-testid` and its tests. This slice only stops it firing in the first row.

---

## 3. What to build

### 3.1 The empty state

When `current.grossSettled <= 0`, render in the muted style — **not** the danger style — with its own `data-testid`:

```
No settled business recorded for this month yet — there is nothing to project from.
```

Suppress the projected percentage and the shortfall cards in this state. The playground already has a `!currentRecord` branch; this is the neighbouring case where a record exists but carries no settled business, and it should read the same way to the agent.

### 3.2 The guard condition

Fire the P4b danger message only when `current.grossSettled > 0`. Nothing else about it changes.

### 3.3 The shortfall cards

`formatShortfall` returns *"Already at or above target"* for any value at or below zero, and `calculateShortfall` returns zeros whenever `baseline <= 0`. So during an impossible plan the cards congratulate the agent on hitting the target. That is a false statement on a coaching screen, not a cosmetic oddity.

When `baseline <= 0`, the cards must say something honest — for example `—` with the danger message already carrying the explanation. Do not invent a second warning sentence; one message is enough.

---

## 4. Out of scope

- **The `-1499900.0%` at a gross of +1.** It is arithmetically true — lapses exceed gross, so net really is negative — and it is obviously broken rather than convincingly plausible. Leave it. Do not add code to hide a number nobody reaches.
- **Clamping at 100%.** Still forbidden, for the reason P4b records: an agent who adopts an orphan and reinstates it is legitimately above 100%.
- `calculations.js`. This is entirely a rendering-state fix.
- `firestore.rules`, `firestore.indexes.json`, `functions/`. Plain merge, no `firebase deploy`.

---

## 5. Deliverables — paste in the PR body

1. **The three states, side by side:** `grossSettled = 0` with no levers touched (neutral line, no warning), `grossSettled = 500000` with levers driving it below zero (danger message), and `grossSettled = 500000` untouched (normal projection).
2. **The regression proof:** the P4b tests still pass unchanged — the danger message still fires for a real plan that breaks a real denominator.
3. The shortfall-card text in the impossible-plan state, before and after.
4. The updated preview smoke result. P4b's smoke asserts the zero-baseline account trips the guard; that assertion is now inverted and must be updated, not deleted.

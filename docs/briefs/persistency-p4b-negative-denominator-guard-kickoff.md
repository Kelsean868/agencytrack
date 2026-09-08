# Persistency P4b — guard the negative projected denominator (and never clamp at 100%)

**Written 7 September 2026.** Amends PR #940 (slice P4) **before it merges**.

**Model: Sonnet 5, low effort.** One guard, one message, one test, one copy fix.

**Branch: commit onto the existing `persistency-p4-playground-24m-levers`.** Do not open a new branch or a second PR — this closes a hole P4 itself opened.

---

## 1. What P4 made reachable

P4 gave the agent two subtractive levers. Drag either far enough and `projectedGross` goes negative. `projectedNet` then goes more negative still, because lapses exceed reinstatements — and a negative divided by a negative is a positive ratio above 1.

Gross −100 with 113 of lapses gives −213 ÷ −100 = **213%**.

`projectPersistency` guards only the exact-zero case:

```js
const projectedPersistency = projectedGross === 0 ? 0 : projectedNet / projectedGross;
```

Negative sails through. `calculateShortfall` is already safe — `if (baseline <= 0) return { nbNeeded: 0, nrNeeded: 0, noNeeded: 0 }` — so the shortfall cards are fine and only the projected headline lies.

Before P4, `goodBusinessFallingOff` was hardcoded to `0` at both call sites, so nobody could reach this. P4 is what makes a latent defect live, on a screen managers use for coaching.

---

## 2. The rule that must not be broken

**Do not clamp the projection at 100%. Do not cap the sliders. Persistency above 100% is real.**

The denominator, Net Gross Settled, is built from the **writing** agent's business. When an agent adopts an orphan whose policy is under 24 months and reinstates it, the reinstatement lands in her numerator as in-force business — but that policy was never in her denominator, because she did not write it. Net exceeds gross and she is legitimately above 100%.

Worked: Candice writes 100,000 of her own business, no lapses. She adopts a lapsed orphan policy of 10,000 API and reinstates it. Gross stays 100,000, net becomes 110,000, persistency is **110%** — and that is correct, not an error.

A clamp would erase real performance from a real agent. `calculateShortfall`'s own docblock already half-knows this: it says persistency can equal 1 only when net equals gross, "which forces NR specifically".

**The condition to guard is `projectedGross <= 0`, never `persistency > 1`.**

---

## 3. What to build

### 3.1 The guard

In `PersistencyPlayground.jsx`, mirror the pattern `PersistencyEntryForm.jsx` already uses at lines 115-121 and 249-251 — derive, then check in the component. Do not change `calculations.js`; its tests are pinned and its arithmetic is right.

When `projection.projectedGrossSettled <= 0`:

1. Suppress the projected-persistency figure. Do not render a number.
2. Render, in the danger style the entry form uses, with its own `data-testid`:
   ```
   This plan drives Net Gross Settled to zero or below — lower Decreases Expected or Business Rolling Off.
   ```
   The entry form's wording is about a transcription error. This one is about an impossible plan, so the words differ on purpose. The *rule* is shared (P-D10), not the sentence.
3. Leave the shortfall cards alone. They already return zeros for this case.

### 3.2 The copy fix

The "Open Playground" blurb still says *"new business, reinstatements, and orphan adoptions"* and never mentions the two levers P4 added. It sits outside the P4 brief's file list, which is why P4 correctly left it. Fix it here: name all four levers, or drop the enumeration entirely rather than list a stale three.

---

## 4. Deliverables — paste in the PR body

1. **The guard proof:** the projected figure and message at `projectedGross` of `+1`, `0`, and `−1`, showing the number is suppressed at zero and below and shown above it.
2. **The non-clamp proof:** one case with a positive gross and reinstatements exceeding lapses, showing the projection renders **above 100%** and is not clipped. Use the Candice numbers from §2.
3. The updated blurb text, before and after.

Post-merge fill on the P4 brief covers this slice too — it ships in the same PR.

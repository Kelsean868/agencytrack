# Brief: Monthly Plan — recovery-pace readout + absorb-shortfall + disabled hints

**Feedback origin:** #9 thread (auto-distribute clarity → catch-up planning)
**Tier:** B (frontend, product-visible) → **BUILD-AND-HOLD.** Open PR and STOP. Do NOT auto-merge.
**Size:** S–M
**Write surface:** none new. The absorb action transforms the in-modal `targets`
state only (same as Auto-distribute / Reset to even); persistence stays on the
existing **Save draft** path. No new collection, no rules, no functions, no indexes, no deploy.

---

## What we're building (operator-confirmed design — "option a")

Three things on the Game Plan Step-3 Monthly Plan modal:

1. **Recovery-pace readout** — a read-only card: "to still hit your annual, each
   remaining month now needs ~$X." Pure display; writes nothing.
2. **Absorb-shortfall button** — re-bases each *settled* month to what was
   actually produced, then re-spreads the rest across the remaining months so
   the plan still sums to the annual and the balance pill stays green.
3. **Disabled-state hints** — Auto-distribute and the new Absorb button must
   explain *why* they're disabled when they are, so they stop reading as broken
   (the defect that started this thread).

---

## Phase 0 — Recon (verify before building)

Source-verified by dispatcher (Rule 17) against the repomix — re-confirm at HEAD:

- `src/lib/monthlyPlanMath.js` exports `seedEvenSplit`, `balanceDelta`,
  `autoDistributeRemainder`, `monthEditable`, `bucketActualsByMonth`, `ytdDelta`.
  The new functions go in this file.
- `src/lib/__tests__/monthlyPlanMath.test.js` exists — extend it.
- `src/components/agent/MonthlyPlanModal.jsx` is the modal.

CC must establish (not assumed by dispatcher — repomix collapses the JSX):
- The in-component `targets` state variable + the setter, and exactly how
  **Auto-distribute** updates it (mirror that pattern for Absorb — local state,
  not a Firestore write).
- Where `currentMonthIndex` comes from in scope (the `autoDistributeRemainder`
  call already passes it — reuse the same source).
- Whether the per-month **actuals array** (`bucketActualsByMonth(...)`) is already
  in scope (the "Act: TTD 0" lines and the YTD-vs-pace readout imply it is). If
  it is, reuse it; if not, derive it once via `bucketActualsByMonth(submissions, year)`.
- The exact JSX anchors for (a) the readouts row (where To-finish / YTD-delta
  cards live) and (b) the footer assists row (where Auto-distribute / Reset-to-even
  live).

If any of these differ from the above, **STOP and report the drift** before building.

## Phase 1 — New pure math (`monthlyPlanMath.js`)

Add two pure functions. Definitions (0-based indices; `currentMonthIndex` = current month):

**`recoveryPace(anchorAPI, actualByMonth, currentMonthIndex)`** → object:
- `completed` = indices `0 .. currentMonthIndex-1` (settled months).
- `settledToDate` = Σ `actualByMonth[i]` over `completed`.
- `remainingCount` = `12 - currentMonthIndex` (current + future).
- `stillNeeded` = `anchorAPI - settledToDate`.
- `pacePerMonth` = `remainingCount > 0 ? stillNeeded / remainingCount : 0`.
- `originalPerMonth` = `anchorAPI / 12`.
- `isStretch` = `pacePerMonth > originalPerMonth * RECOVERY_STRETCH_MULTIPLE`
  (define `RECOVERY_STRETCH_MULTIPLE = 1.5` as a named constant — tunable).
- Returns `{ settledToDate, stillNeeded, remainingCount, pacePerMonth, originalPerMonth, isStretch }`.

**`absorbShortfall(targets, anchorAPI, actualByMonth, currentMonthIndex)`** → `number[12]`:
- Copy `targets` → `next`.
- For each `i` in `completed`: `next[i] = actualByMonth[i]` (re-base settled month to actual).
- For each `i` in remaining (`currentMonthIndex .. 11`): `next[i] = pacePerMonth` (from the same recovery math).
- **Rounding absorption:** set the LAST remaining month exactly so `Σ next === anchorAPI`
  (mirror the existing `seedEvenSplit` / `autoDistributeRemainder` convention).
- Past months that are not in `completed` (there are none below index 0) — n/a.
- Return `next`.

**Design note — current month is included in "remaining"** (it is not settled, so
it carries part of the catch-up; this gives lower, more achievable per-month
figures and keeps the readout and button consistent). This *does* overwrite a
hand-set current-month value on absorb — acceptable for a deliberate re-plan
action, and reversible via Reset-to-even. **Minor reviewer gate:** if the
operator prefers to preserve the hand-set current month and load the catch-up
onto future months only, flip "remaining" to `currentMonthIndex+1 .. 11`. Default
as written = include current.

## Phase 2 — Readout card (`MonthlyPlanModal.jsx`)

- Add a card in the readouts row (next to To-finish / YTD-vs-pace) driven by
  `recoveryPace(...)`. Headline = `pacePerMonth` formatted TTD; subline = e.g.
  "needed across N remaining months to hit annual."
- Feasibility cue: when `isStretch`, render the card in the amber/warning token
  with a one-line note ("This is a stretch — consider resetting your annual.").
  Otherwise neutral. Use existing Nexus tokens; AA contrast; no new colors.
- Honest edge states: no completed months (January) → shows the plain even-split
  pace, no warning. Ahead of plan → `pacePerMonth` comes out below original; show
  it plainly (the readout never fabricates a shortfall).

## Phase 3 — Absorb button + disabled hints (footer assists row)

- Add **"Absorb shortfall"** next to Auto-distribute / Reset-to-even. On click,
  `setTargets(absorbShortfall(...))` — local state only, exactly like Auto-distribute.
- **Enable only when behind plan on settled months:**
  `Σ(completed actuals) < Σ(completed targets) − epsilon` AND `completed.length > 0`.
  On/ahead of plan or no settled months → disabled (v1 does not re-spread a surplus down).
- **Disabled-state hints** (the UX fix — `title` attr + `aria-disabled`, muted
  styling, `cursor-not-allowed`, keep 44px target):
  - Auto-distribute disabled (already balanced): "Already balanced — nothing to distribute."
  - Absorb disabled, no settled months: "No settled months yet."
  - Absorb disabled, on/ahead of pace: "You're on or ahead of pace — nothing to absorb."

## Tests (pure functions — unit-tested; no UI-click leg needed)

Extend `monthlyPlanMath.test.js`:
- `recoveryPace`: no completed months → `pacePerMonth === anchor/12`; behind (5
  completed, actuals < targets) → pace > original, exact value asserted; ahead →
  pace < original; `currentMonthIndex === 11` → `remainingCount === 1`, pace ===
  `anchor − settledToDate`; `isStretch` flips correctly across the 1.5× threshold.
- `absorbShortfall`: completed months re-based to actuals (`next[i] === actualByMonth[i]`);
  remaining months === `pacePerMonth` (within rounding); `Σ next === anchorAPI`
  exactly (rounding invariant); a settled month with actual 0 re-bases to 0; the
  screenshot scenario (5 completed @ 0 actual, anchor ≈ 1,185,714) yields sensible
  Jun–Dec figures summing to anchor.
- Keep the existing modal render smoke green.

## Phase 4 — Docs (with placeholders)

- CONTEXT.md, FOLLOW_UPS.md. Note: recovery-pace + absorb shipped; "preserve
  hand-set current month on absorb" left as an open flip-option; "absorb a surplus
  downward when ahead" explicitly out of v1 scope (don't silently close it).

## Phase 5 — Commit / push / PR

- Commit, push, open PR. **HOLD** — product-visible; operator reviews in preview.
- Poll + disposition Gemini (Rule 21); on a late fix, re-run the unit suite and
  confirm CI green before reporting review-ready.
- Rule 22 self-critique: enumerate ≥1 known gap (expected: "no UI-click smoke —
  button behavior verified via math unit tests + render smoke only").
- Rule 20: name the feature-branch HEAD SHA in the PR-ready report.

## Phase 6 — Report and STOP

Report PR number, HEAD SHA, Gemini disposition, the self-critique gap, and a
worked before/after example (the screenshot's 5-months-behind case: what each
remaining month becomes after absorb, and the recovery-pace figure shown). Then
STOP and wait for dispatcher.

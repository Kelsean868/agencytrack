# Brief: Game Plan "THE PLAN SO FAR" — step 3 shows the per-month figure (not the annual)

## Context
On the Game Plan page, the "THE PLAN SO FAR" summary stacks the four steps. Step 2 (Year Plan) and
step 3 (Monthly Plan) currently both show the **same** annual API figure (e.g., TTD 1,185,714.29),
so step 3 reads as a duplicate of step 2 at a glance. Step 3 should show the **monthly** figure, which
is the granularity that step actually represents.

This is the Game Plan **page** summary card — NOT `MonthlyPlanModal.jsx` (the modal that #671 touched).
Separate component, separate change.

## Objective
In the step 3 (Monthly Plan) card of "THE PLAN SO FAR", change the bold figure from the annual total
to the per-month figure (annual API ÷ 12), and relabel the subtitle so the figure and label agree.
Leave the red "… behind" indicator and the step 2 figure unchanged.

## Decision (locked with operator)
- **Step 3 bold figure = annual API ÷ 12** — the per-month average. Equals each month's target for an
  even split, and the average for an uneven plan; always a single well-defined number.
  (For the 494k-behind account: 1,185,714.29 ÷ 12 ≈ TTD 98,809.52.)
- **Subtitle:** change "Annual target split into 12 months" → **"Per-month target"** (the figure is an
  average, so "Average per month" is also acceptable — pick whichever reads cleaner in the card; small
  wording detail).
- **"… behind" red line:** unchanged.
- **Step 2 (Year Plan) figure:** unchanged (stays the annual).

## Scope
- The Game Plan page "THE PLAN SO FAR" summary component only.
- Display-only: compute annual ÷ 12 for the step-3 figure + update the subtitle string.

## Out of scope
- `MonthlyPlanModal.jsx` (the modal — untouched).
- The "behind" indicator logic.
- Step 2's figure / any other card.
- Any data-model, write, rules, or CF change.

## Procedure note
Branch at **Phase 0, before any code** (create the feature branch first; do not commit to main and
re-branch). PowerShell — no `&&` chaining.

## Phase 1 — recon (report before building)
1. Locate the "THE PLAN SO FAR" summary component and the step 3 card (likely the Game Plan page /
   summary component; confirm the exact file with `git grep`).
2. Confirm step 3's bold figure currently sources the annual API (same source as step 2), and that the
   annual value is in scope in that component to divide by 12 (it is — it's already rendered there).
3. Report, then proceed.

## Phase 2-3 — build
- Step 3 figure = annual API ÷ 12, formatted as TTD with the **same decimal/format convention** as the
  other cards (2 decimals, thousands separators).
- Subtitle → "Per-month target" (or as decided).
- Leave the behind line and step 2 untouched.

## Verification (smoke)
On the preview, Game Plan page, on a plan with a non-zero annual (the 494k-behind account is ideal):
- Step 3's bold figure shows the per-month value (annual ÷ 12), **visibly different from step 2's
  annual** — confirms the duplicate-number confusion is gone.
- Subtitle matches the monthly figure (no "annual" wording over a monthly number).
- The "… behind" red line still shows.
- Both themes render cleanly (no contrast/overflow regression vs main baseline).
- PASS/FAIL each leg.

## Phase 4-5
- Docs with placeholders (CONTEXT.md, FOLLOW_UPS.md). Commit on the feature branch, push, open PR.
  **HOLD for human review.**

## Acceptance
- Step 3 bold figure = annual ÷ 12; visibly distinct from step 2.
- Subtitle agrees with the monthly figure.
- "… behind" line and step 2 unchanged.
- Both themes clean.

## Risks
- Low — display-only change to one card. The one thing to get right is the format: the divided figure
  must match the decimal/separator convention of the other cards so the decimals look consistent.

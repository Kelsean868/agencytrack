# Monthly Plan — Hub Wiring Slice (Game Plan Step 3, Slice 3 of 3)

## Context
Slices 1–2 shipped the `monthlyPlan` foundation + the pacer panel (modal/chart/save).
This slice wires the **saved monthly plan into the hub's three surfaces** — exactly as
the Year Plan Slice 3 did for Step 2 — so Step 3 reads live and the cascade gains a real
Monthly rung. Pure display wiring, **no new math** (every figure from the Slice-1
helpers); gated behind `VITE_YEAR_PLAN_ENABLED` so it's inert until the un-gate.

This is the last Monthly build piece. Structural template: the **Year Plan Slice 3**
implementation (`StepRail.jsx` Step-2 status, the `PlanCascade` live Year Plan rung, the
`PlanAnchorStrip` completeness derivation in `GamePlanV2/index.jsx`). Mirror it for
Step 3 / Monthly.

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**Read path.** Load the agent's `monthlyPlan/{year}` via `getMonthlyPlan` in
GamePlanScreen, the SAME way Slice-3-Year-Plan added the `getYearPlan` load — parallel,
`.catch(()=>null)` degradation. Compute the YTD pace from the foundation: `ytdDelta(
bucketActualsByMonth(submissions, year), monthlyPlan.targets, currentMonthIndex)` over
the **already-loaded** submissions (no refetch). Thread plan + ytd into StepRail,
PlanCascade, PlanAnchorStrip.

**StepRail Step 3 — live status (gated), mirroring Step 2.**
- Flag OFF → unchanged (coming / non-interactive).
- Flag ON → Step 3 reflects the monthly plan exactly as Step 2 reflects the year plan:
  **done** when a `monthlyPlan` with `Σ targets > 0` exists; otherwise **current / next**
  per the rail's existing sequencing helper (Step 3 should read *current* only once it's
  the first-incomplete step — i.e. Year Plan done, Monthly not — else *next/coming*, so
  the rail never shows two *current* steps). Clickable → opens the modal (Slice 2 already
  wired `onOpenMonthlyPlan`). **Mirror Step 2's exact done-predicate + sequencing — do
  not invent new status logic.** The "do Year Plan first" guidance lives in the modal's
  empty state (Slice 2), not a separate locked status here.

**PlanCascade Monthly rung (gated).**
- Flag OFF → `ComingRung` (unchanged).
- Flag ON → a **live rung** built from the Year Plan live-rung pattern, showing the
  monthly plan **total** (the anchor) **plus a YTD pace badge** from `ytdDelta` — "+TTD X
  ahead" / "on pace" / "−TTD Y behind", coloured by the existing variance-band tokens.
  This badge is the one element beyond the Year Plan rung pattern (which showed total
  only). Honest empty ("Set in your plan") when no monthly plan. The **Commit rung stays
  `ComingRung`.**

**PlanAnchorStrip completeness (gated).**
- Flag OFF → unchanged.
- Flag ON → completeness counts Monthly: a saved monthly plan makes it **3 of 4 = 75%**
  (Money Needs + Year Plan + Monthly). Mirror the Year Plan 50% derivation in `index.jsx`.
- The **API Commitment chip stays on `goals.personalAnnualAPI`** — unchanged, same as
  Year Plan Slice 3. The monthly plan is a draft; Commit (Step 4) is what writes Goals.

**Honest-data.** The monthly plan is a draft until Step 4; the cascade rung reads as a
plan-in-progress with its pace badge, not a commitment; unset → "Set in your plan"; the
Commit step stays honest "coming."

**Gating.** All three surfaces behind `VITE_YEAR_PLAN_ENABLED`. Flag-off render is
byte-identical to today — inert on merge.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
Mirror the Year Plan Slice 3 patterns; **only stop if a finding contradicts a locked
decision.**
1. **Year Plan Slice 3 wiring** — how Step 2's done/current status is computed in
   `StepRail.jsx`, the live Year Plan rung in `PlanCascade.jsx`, and the completeness
   derivation in `GamePlanV2/index.jsx`. Mirror each for Step 3 / Monthly / 75%.
2. **The rail's current/next sequencing** — confirm how the rail decides which step is
   *current* vs *next*, so Step 3 reads *current* only when it's first-incomplete.
3. **`getMonthlyPlan`, `bucketActualsByMonth`, `ytdDelta`** (Slice 1) — confirm signatures
   for the load + the YTD badge.
4. **The cascade rung** — confirm where a pace/YTD badge can sit on the rung (the Year
   Plan rung had no badge slot — add a small one in the rung pattern, tokens only).
5. **The hub submissions + yearPlan loads** — already on GamePlanScreen (reuse; the
   monthly plan's anchor isn't needed for this slice, only the plan + actuals).

## Phase 2 — load + thread
- Add the `getMonthlyPlan` load to GamePlanScreen (mirror the `getYearPlan` load);
  compute `ytdDelta` from it + the loaded submissions; thread plan + ytd + a
  `monthlyPlanFilled` boolean into StepRail / PlanCascade / PlanAnchorStrip.

## Phase 3 — the three surfaces (all gated behind `VITE_YEAR_PLAN_ENABLED`)
- StepRail Step 3 live status (done/current/next per locked decision, mirroring Step 2).
- PlanCascade live Monthly rung (total + YTD pace badge; Commit stays ComingRung).
- PlanAnchorStrip completeness → 75% when filled; chip stays on Goals.
- Flag-off path byte-identical to today (verify).

### Tests (RTL, mirror the Year Plan Slice 3 harness)
- Flag OFF → Step 3 coming, cascade ComingRung, completeness unchanged.
- Flag ON + saved monthly plan → Step 3 done, cascade rung shows total + YTD badge,
  completeness 75%, commitment chip still reads the Goals value.
- Flag ON + no monthly plan → Step 3 current/next (per sequencing), rung honest-empty.

## Phase 4 — docs (with placeholders)
- PR-table row (placeholder SHA); cross-reference the Monthly foundation + panel briefs.
- Note this completes the Monthly build; remaining Monthly-adjacent work before un-gate:
  the accumulated loop smoke (rides the un-gate PR) and Step 4 (Commit), which needs its
  own design + brief.
- CONTEXT.md: gated wiring — does not advance Current main HEAD per Rule 16(b); update
  the Active track row only.

## Phase 5 — commit / push / PR
- Branch `feat/monthly-plan-slice-3`.
- `feat(monthly-plan): slice 3 — hub wiring (Step 3 status, Monthly cascade rung, completeness)`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA in the report.

## Smoke
Gated → no production surface until un-gate. Verification is the RTL coverage (flag-on
and flag-off paths). The production render smoke — hub with the flag on showing the live
Step 3 + Monthly rung — rides the **un-gate PR** with the rest of the loop. A flag-on
preview render check is a bonus, not required.

## Merge posture
Gated wiring, largely pattern-reuse — but the **YTD pace badge** on the rung is a small
net-new visual element, so **human-merge** per the standing rule, same as Year Plan
Slice 3. Hold the PR; eyeball the Monthly rung + badge in a flag-on preview, then merge.
No deploy (gated; rules already live from Slice 1).

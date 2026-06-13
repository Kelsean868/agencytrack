# Review & Commit — Hub Wiring (Game Plan Step 4, Slice 4 of 4)

## Context
Slices 1–3 shipped the commit logic, the apps floor, and the commit panel. This slice
wires the **committed plan into the hub's three surfaces** — the same way the Monthly
Slice 3 did for Step 3 — so Step 4 reads live, the Commit rung lights as the loop's
capstone, and completeness reaches 100%. Pure display wiring, no new logic; gated behind
`VITE_YEAR_PLAN_ENABLED`, inert until the un-gate.

This is the **last build piece of the loop.** The 100% it produces is the trigger
condition for the un-gate — but un-gating itself is the separate release PR (focus traps,
flag rename, end-to-end smoke), **not this slice.** Structural template: the Monthly
Slice 3 wiring (`StepRail.jsx` Step-3 status, the `PlanCascade` live Monthly rung, the
`PlanAnchorStrip` completeness derivation in `GamePlanV2/index.jsx`).

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**Read path.** "Committed" is read from the plan status the commit transaction flips —
`monthlyPlan.status === 'committed'` (yearPlan flips with it, so either is authoritative;
use the one already loaded). `committedAt` (for the seal) comes off the same doc. Both are
already loaded on GamePlanScreen (Monthly Slice 3 added the `getMonthlyPlan` load) — reuse,
no refetch. Derive a `committed` boolean + `committedAt` and thread into StepRail,
PlanCascade, PlanAnchorStrip.

**StepRail Step 4 — live status (gated), mirroring Step 3.**
- Flag OFF → unchanged (coming / non-interactive).
- Flag ON → **done** when `committed`; otherwise **current / next** per the rail's existing
  sequencing (current only once it's first-incomplete — Monthly drafted, not yet committed).
  Clickable → opens the modal (Slice 3 wired `onOpenReviewCommit`). Mirror Step 3's exact
  predicate + sequencing; don't invent new status logic.

**PlanCascade Commit rung (gated) — the capstone.**
- Flag OFF → `ComingRung` (unchanged).
- Flag ON + `committed` → the rung lights **committed/green** with a **dated seal**
  ("Committed · {committedAt} TT") — the loop's visual completion. Use the committed
  statusToken role (the terminal state, first real use beyond the panel).
- Flag ON + not committed → honest ready/coming (not a false green).

**PlanAnchorStrip completeness (gated).**
- Flag OFF → unchanged.
- Flag ON → `committed` makes the loop **4 of 4 = 100%** (Money Needs + Year Plan + Monthly
  + Commit). Mirror the 75% derivation in `index.jsx`.
- The API Commitment chip is **unchanged** — it already reads `goals.personalAnnualAPI`,
  which the commit wrote, so it reflects the committed target naturally with no new wiring.

**The 100% is the un-gate trigger, not the un-gate.** This slice produces the 100% state
behind the flag. It does NOT flip the flag, rename it, add focus traps, or run the loop
smoke — those are the un-gate release PR. Ship this gated and inert.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
Mirror the Monthly Slice 3 patterns; **only stop if a finding contradicts a locked decision.**
1. **Monthly Slice 3 wiring** — Step 3's done/current status in `StepRail.jsx`, the live
   Monthly rung in `PlanCascade.jsx`, the completeness derivation in `GamePlanV2/index.jsx`.
   Mirror each for Step 4 / Commit / 100%.
2. **The committed-status source** — confirm `monthlyPlan.status` / `yearPlan.status` flip
   to `'committed'` together (Slice 1) and `committedAt` is on the doc, for the boolean + seal.
3. **The rail's current/next sequencing** — so Step 4 reads *current* only when first-incomplete.
4. **The statusToken committed/terminal role** — confirm the token + the seal/green treatment
   available for the rung (Slice 3's `CommittedDone` used it; reuse the same role here).

## Phase 2 — load + thread
- Derive `committed` + `committedAt` on GamePlanScreen from the already-loaded plan; thread
  `committed`, `committedAt`, and the updated completeness into StepRail / PlanCascade /
  PlanAnchorStrip.

## Phase 3 — the three surfaces (all gated)
- StepRail Step 4 live status (done/current/next, mirroring Step 3).
- PlanCascade Commit rung (committed/green + dated seal when committed; honest otherwise).
- PlanAnchorStrip completeness → 100% when committed; chip unchanged.
- Flag-off path byte-identical to today (verify).

### Tests (RTL, mirror the Monthly Slice 3 harness)
- Flag OFF → Step 4 coming, Commit ComingRung, completeness unchanged.
- Flag ON + committed → Step 4 done, Commit rung green + dated seal, completeness 100%,
  chip still reads the Goals value.
- Flag ON + not committed → Step 4 current/next (per sequencing), Commit rung honest (no
  false green).

## Phase 4 — docs (with placeholders)
- PR row; cross-reference Slices 1–3.
- **Note this completes the Monthly→Commit loop build.** The remaining work is the single
  **un-gate release PR**, which bundles: flip/rename `VITE_YEAR_PLAN_ENABLED` → a loop-level
  flag; focus traps + Escape on all the planning modals (the banked a11y item); the
  accumulated end-to-end loop smoke (Money Needs → Year Plan → Monthly → Commit round-trip);
  + the flag flip itself. List these in FOLLOW_UPS as the un-gate checklist.
- CONTEXT.md: gated wiring — does not advance Current main HEAD per Rule 16(b); update the
  Active track row only.

## Phase 5 — commit / push / PR
- Branch `feat/commit-hub-wiring`.
- `feat(commit): step 4 slice 4 — hub wiring (Step 4 status, Commit rung, 100%)`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA.

## Smoke
Gated → no production surface until un-gate. Verification is the RTL coverage (flag-on and
flag-off). The full flag-on hub render rides the **un-gate release PR** with the rest of
the loop. A flag-on preview render check is a bonus, not required.

## Merge posture
Gated wiring, largely pattern-reuse — but the **committed/green Commit rung + dated seal**
is a small net-new visual, so **human-merge** per the standing rule, same as Monthly
Slice 3. Eyeball the lit Commit rung in a flag-on preview, then merge. No deploy.

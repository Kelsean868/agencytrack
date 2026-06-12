# Year Plan — Slice 3: hub wiring (Game Plan Step 2)

## Context
Slice 3 is the wiring slice — it makes the **Game Plan hub reflect the saved
`yearPlan`**. Slice 1 built the hub with a LIVE Money Needs rung in `PlanCascade`
and a live/clickable Money Needs step in `StepRail`, plus honest `ComingRung` /
"next/coming" placeholders for the forward steps. Slice 2a added the
`YEAR_PLAN_ENABLED` flag, `onOpenYearPlan`, and the modal mount. Slice 2b added
the award strip + manager-override. This slice flips the Year Plan **placeholders
to live**, reusing the exact patterns Slice 1 established for Money Needs — no new
visual design, just data threaded into existing components.

After this slice the agent loop's first half is structurally complete: Money Needs
(Step 1) + Year Plan (Step 2) read as a working two-step flow on the hub, with
Monthly (Step 3) and Commit (Step 4) still honestly "coming." Everything stays
**gated behind `VITE_YEAR_PLAN_ENABLED`** (inert on merge) until the loop un-gate.

Touch target: `src/components/dashboard/GamePlanV2/` — `StepRail.jsx`,
`PlanCascade.jsx`, `PlanAnchorStrip.jsx`, `index.jsx` (GamePlanScreen), plus the
data-load site (likely `AgentDashboard`, confirmed in Phase 1). Mirror pattern for
every live-state below: **how the Money Needs rung/step already renders live.**

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**Read path.** Load the agent's `yearPlan/{year}` via `getYearPlan` the SAME way
the hub already loads `moneyNeeds` for its live Money Needs rung — same site, same
threading, same loading/error degradation. Do NOT invent a second load pattern.

**StepRail Step 2 — live state (gated).**
- Flag OFF → unchanged ("coming"/non-interactive, as today).
- Flag ON → Step 2 reflects the plan: a **saved plan** (a `yearPlan` doc with any
  line `targetAPI > 0`) reads **done/settled** — the same state Money Needs uses
  when its worksheet is filled (per-step completion, NOT loop-commit; the plan's
  `status: 'draft'` is about the Step-4 loop commit, not Step-2 completion). **No
  saved plan** reads **current/in-flight** — the active next step. Either way it's
  clickable → opens the modal (already wired in 2a).
- *(Lean — confirm at Phase 1 against `statusToken` roles: done→settled ·
  current→in-flight. If Money Needs uses a different "filled = done" predicate,
  mirror it exactly for parity.)*

**PlanCascade — Year Plan rung (gated).**
- Flag OFF → `ComingRung` (unchanged).
- Flag ON → a **live rung** built from the Money Needs live-rung pattern, showing
  the **`yearPlan` total API** (the planned annual production — sum of enabled-line
  `targetAPI`). Honest empty ("Set in your plan") when no plan exists yet. The
  **Monthly rung stays `ComingRung`.**
- The rung shows the **planned total**, labelled as a plan — it is NOT a
  commitment (see the chip rule below).

**PlanAnchorStrip — completeness + commitment chip (gated).**
- Flag OFF → completeness unchanged (Money Needs filled = 1 of 4 = 25%).
- Flag ON → completeness counts Year Plan: a saved plan makes it **2 of 4 = 50%**.
- **The API Commitment chip STAYS on `goals.personalAnnualAPI`** (the committed
  value) — it does NOT switch to the draft `yearPlan` total. A draft plan is not a
  commitment; Commit (Step 4) is what writes the plan's API into Goals. Showing the
  draft total as "your commitment" would violate honest-data. The plan's planned
  total lives in the cascade rung; the commitment chip stays on the committed
  Goals figure (honest "Set in your plan" when unset, as today).

**Honest-data doctrine.** The `yearPlan` is a draft until Step 4. The cascade rung
reads as a plan, not a commitment; the commitment chip stays on Goals; unset values
read "Set in your plan", never a fabricated zero; the forward steps (Monthly,
Commit) stay honestly "coming."

**Gating.** All three live surfaces sit behind `VITE_YEAR_PLAN_ENABLED`. With the
flag off (production today), the hub is byte-identical to its current behaviour —
**inert on merge.** The un-gate PR flips the flag and reveals all of it at once.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
Read and report the items below in your build report, but do NOT hard-stop for a
ruling. This slice is pure pattern-reuse over Slice 1's existing Money Needs
rung/step — for each finding, mirror whatever the Money Needs path already does.
**Only stop and report if a finding contradicts a locked decision above** (e.g. the
completeness % can't be made to count Year Plan, the commitment chip can't stay on
Goals, or the load path can't mirror `moneyNeeds`). Routine structural differences
are not a stop — just follow the established pattern.
1. **`StepRail.jsx`** — the step-object/array structure, the `statusToken`/`variant`
   mechanism, exactly how the Money Needs step renders as live + done + clickable,
   how `onOpenYearPlan` was wired in 2a, and how the flag currently gates Step 2's
   clickability. Report the predicate Money Needs uses for "done" (filled).
2. **`PlanCascade.jsx`** — the LIVE Money Needs rung vs `ComingRung` + `CascadeArrow`;
   what the Money Needs rung reads and how it's shaped, so the Year Plan live rung
   mirrors it.
3. **`PlanAnchorStrip.jsx`** — the completeness % derivation (where `planBuiltPct` /
   `stepsBuilt` / `25%` comes from) and the API Commitment chip source
   (`committedAnnualAPI` ← `goals.personalAnnualAPI`), so completeness counts Year
   Plan and the chip is left on Goals.
4. **`index.jsx` (GamePlanScreen) + the data-load site** — where `moneyNeeds` is
   loaded and threaded into the hub for the live rung (AgentDashboard? the screen
   itself?), and the current GamePlanScreen prop signature, to mirror the `yearPlan`
   load + thread.
5. **`getYearPlan`** signature (from the foundation) + the **`VITE_YEAR_PLAN_ENABLED`
   read pattern** (`import.meta.env.…`) as 2a uses it.
6. **`statusToken` roles** — confirm done→settled · current→in-flight · coming→closed,
   so the Step 2 live state uses the right role.

## Phase 2 — data load + thread
- Load `yearPlan/{year}` at the SAME site `moneyNeeds` is loaded for the hub, with
  matching loading/error degradation (a failed load degrades to the "coming"/empty
  state — never blocks the hub). Thread the plan (or its derived total + a
  has-allocation boolean) into `StepRail`, `PlanCascade`, `PlanAnchorStrip` through
  GamePlanScreen, mirroring how `moneyNeeds` is threaded.

## Phase 3 — the three live surfaces (all gated behind `VITE_YEAR_PLAN_ENABLED`)
- **StepRail Step 2** — flag-on live state per the locked decision (done when a plan
  with allocated API exists; current otherwise; clickable → modal).
- **PlanCascade Year Plan rung** — flag-on live rung (Money Needs rung pattern)
  showing the plan total API; honest empty when no plan; Monthly stays `ComingRung`.
- **PlanAnchorStrip** — flag-on completeness counts Year Plan (→ 50%); the API
  Commitment chip stays on `goals.personalAnnualAPI`.
- Flag-off path for all three is unchanged from today (verify byte-identical render
  with the flag false).

### Tests
- Component/RTL (matching the hub's existing harness): **flag OFF** → Year Plan step
  reads "coming", cascade shows `ComingRung`, completeness 25% (no behaviour change).
  **Flag ON + saved plan** → Step 2 done + clickable, cascade rung shows the plan
  total, completeness 50%, commitment chip still reads the Goals value (not the plan
  total). **Flag ON + no plan** → Step 2 current, cascade rung honest-empty,
  completeness 25%.

## Phase 4 — docs (with placeholders)
- PR-table row (placeholder SHA).
- Cross-reference the 2a/2b briefs + `docs/design/year-plan-scoping-notes.md`.
- Note that this completes the Year Plan track's build surface; the only remaining
  Year Plan work before un-gate is the accumulated end-to-end loop smoke (rides the
  un-gate PR) and the downstream Monthly (Step 3) + Commit (Step 4) slices, which
  need design first.
- CONTEXT.md: this is gated feature wiring — does not advance "Current main HEAD"
  framing (Rule 16(b)); leave untouched unless the data-model section tracks the
  hub read.

## Phase 5 — commit / push / PR
- Branch `feat/year-plan-slice-3`.
- Conventional commit: `feat(year-plan): slice 3 — hub wiring (StepRail step, cascade rung, completeness)`.
- Push; open PR; **Rule 21** Gemini poll + disposition; **Rule 20** report names the
  feature-branch HEAD SHA, no silent post-report pushes.

## Merge posture
Gated → **inert on merge.** Reuses the Slice-1 live-rung/live-step patterns with no
new visual treatment, so it's auto-merge eligible under the standard gate. BUT if
the build introduces ANY new visual design for the live Year Plan rung/step (beyond
parameterising the existing Money Needs pattern), that's an aesthetic judgment →
**human-merge** per the standing CLAUDE.md rule (overrides "gated = auto"). Default
to PR-open if in doubt.

## Smoke
Gated → no production surface exercises the wiring until un-gate. Verification is
the component/RTL coverage above (flag-on and flag-off render paths). The production
render smoke — hub with the flag on showing the live Step 2 + cascade rung — rides
the **un-gate PR** alongside the accumulated foundation/2a/2b/Monthly/Commit
round-trips, same posture as the rest of the gated track. If Year Plan is reachable
in the preview with the flag forced on, a render-only smoke (hub renders, Step 2 +
rung live, both themes, axe NO-NEW, no console errors) is a bonus — not required.

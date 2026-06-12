# Monthly Plan — Panel Slice (Game Plan Step 3, Slice 2 of 3)

## Context
Slice 1 shipped the headless foundation: the `monthlyPlan/{year}` store, its service,
its rules, and all the pure math in `src/lib/monthlyPlanMath.js` (seed/balance/
auto-distribute/editable + bucketActualsByMonth/monthlyPace/ytdDelta). **This slice is
the UI over that foundation** — the modal the agent opens from Step 3 to split their
annual target into 12 months, see actual-vs-target by month, and save a draft. Pure
presentation + wiring; **no new math** (every number comes from the foundation helpers).

Design source: CD's annotation `Monthly Plan Panel — Step 3 Build`. Structural template:
`YearPlanModal.jsx` (Slice 2a) for the modal chrome and the Step-open wiring; the
codebase's existing inline progress-bar idiom for the chart bars. Gated behind the same
flag as the Year Plan steps so the whole loop reveals together at the un-gate.

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**Gate.** Reuse **`VITE_YEAR_PLAN_ENABLED`** — the de-facto planning-loop flag the Year
Plan steps already sit behind. Flipping it at un-gate reveals Year Plan + Monthly
together (the intended all-at-once reveal), and a single flag prevents a partial
un-gate. The misleading name (it gates more than Year Plan) is **banked as a standalone
rename chore** — `VITE_YEAR_PLAN_ENABLED` → a loop-level name — to run before the
un-gate; do NOT rename in this slice (scope).

**The modal — `MonthlyPlanModal.jsx` (new, `src/components/agent/`).** Clone the
`YearPlanModal` chrome (scrim, panel, header, footer, close, focus-trap, ≥44px). Body
top-to-bottom: anchor/granularity strip → `MonthChart` → readouts (to-finish + YTD) →
editable month-target grid → draft footer (Save gated on balance). Opens from Step 3.

**Open wiring (mirror 2a's Step-2 wiring exactly).** Add `onOpenMonthlyPlan` to
`StepRail.jsx`, gate Step 3's clickability behind `VITE_YEAR_PLAN_ENABLED`, and mount
`MonthlyPlanModal` in `GamePlanV2/index.jsx` (GamePlanScreen) the same way
`YearPlanModal` is mounted. (Step 3's *status* token + the cascade Monthly rung are
**Slice 3**, not here — this slice only makes Step 3 *open the modal*.)

**Data load + lifecycle.**
- Resolve the **anchor** from the already-loaded `yearPlan` (sum of enabled-line
  `targetAPI`). No yearPlan / zero total ⇒ the **"do Year Plan first" empty state**
  (annotation's "no Year Plan yet"); the modal does not create a plan.
- On open with an anchor: `getMonthlyPlan(...)`; if none, `createMonthlyPlan(tenantId,
  uid, year, anchorAPI)` (foundation — seeds the even split). Load into local edit state.
- **Actuals**: `bucketActualsByMonth(submissions, year)` over the **already-loaded**
  submissions (reuse the hub's existing submissions load — no refetch, as Slice 3a did).
- All derived figures from the foundation: `monthlyPace`, `ytdDelta`, `balanceDelta`.
- **Stale anchor:** if `monthlyPlan.anchorAPI !== currentYearPlanTotal` (agent
  re-allocated their Year Plan after saving the monthly plan), show a quiet re-sync
  prompt ("Your annual target changed — reset to the new TTD X?") that reseeds the even
  split to the new anchor on tap. Don't silently overwrite the agent's custom split.

**`MonthChart.jsx` (new) — the centerpiece.** 12 columns. Per the annotation: ghost
target bar behind, solid actual in front (`--gold`/over-target when actual ≥ target),
the **current month** striped/partial with a **pace tick** at `monthlyPace.expectedToDate`
and a **NOW line** at today, **future** months target-only outlines, **past** months
solid actual vs ghost target. Bar geometry is data-driven inline positioning (the
codebase's progress-bar idiom); colours are tokens only. No charting lib unless one is
already a hub dependency (confirm in Phase 1) — otherwise hand-rolled bars like the
existing pace rows.

**`MonthTargetField.jsx` (new) — editable target, per month.** ≥44px. `monthEditable`
(foundation) decides: **past months locked** (read-only, actual shown), current + future
editable. `parseFloat` on input; TTD; edits flip `split` to `'custom'` and recompute
`balanceDelta`.

**`BalanceInvariant` (the balance pill + Save gate).** Live `Σ months vs annual` pill
from `balanceDelta`: `= TTD X ✓` when zero, `+/− TTD Y to place` otherwise. **Save is
disabled until `balanceDelta === 0`.** Two assists: **auto-distribute remainder**
(calls `autoDistributeRemainder` — spreads the delta across untouched future months) and
**reset to even** (calls `seedEvenSplit`, sets `split: 'even'`). On Save:
`saveMonthlyPlan(tenantId, uid, year, targets, split)` → `status: 'draft'`.

**Readouts.** `ToFinishReadout` (current month, from `monthlyPace`): "to finish
{month}" API + apps left + ahead/on-track/behind. YTD readout (from `ytdDelta`): "+/−
TTD X vs pace" over completed months. Display-only; no new math.

**Honest-data.** Unset → "Set in your plan"; no-yearPlan and no-submissions are **drawn
states**, never error-shaped or a row of zeros (annotation's three states). Current month
honest-partial (striped, not a false "done"). Nothing computed here is stored beyond the
12 targets + split + status.

**The "ahead" semantic — confirm here (the Slice-1 flag).** The foundation pins
`monthlyPace` "ahead" to `actual ≥ target` (planVariance's "Ahead ≥ plan" band), so
over-pace-but-under-target reads "on-track." Confirm that reads right in the live chart
+ readout. If the pace UX wants "ahead = ahead of the pace tick" instead, that's a small
`monthlyPace` band tweak in the foundation module — surface it, don't silently change it.

### Deferred OUT of this slice
- Step 3 *status* token (done/current) + the PlanCascade Monthly rung + completeness
  → **Slice 3** (gated wiring).
- Commit → Goals (draft → committed) → **Step 4**.
- Per-line monthly drill / per-line targets → deferred per your call.
- The `VITE_YEAR_PLAN_ENABLED` → loop-name rename → standalone chore before un-gate.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
Mirror existing patterns; **only stop if a finding contradicts a locked decision.**
1. **`YearPlanModal.jsx`** — the modal chrome to clone (scrim/panel/header/footer/focus
   trap), and how it reads `VITE_YEAR_PLAN_ENABLED`.
2. **2a's Step-2 wiring** — `onOpenYearPlan` in `StepRail.jsx`, the clickability gate,
   and the `YearPlanModal` mount in `GamePlanV2/index.jsx` — to mirror for Step 3.
3. **The hub submissions load** — confirm submissions are already loaded in
   GamePlanScreen (reuse them for `bucketActualsByMonth`; no refetch).
4. **The yearPlan load on the hub** — to resolve the anchor (Slice 3 added a `getYearPlan`
   load to GamePlanScreen — reuse it; report the shape available).
5. **Chart idiom** — is any charting lib already a hub dependency, or are bars hand-rolled
   (the pace-row inline-positioning idiom)? Build the chart the same way the hub already does.
6. **`monthlyPlanService` + `monthlyPlanMath`** (Slice 1) — confirm the exported
   signatures the modal will call.

## Phase 2 — modal shell, mount, open wiring
- `MonthlyPlanModal.jsx` cloned from YearPlanModal chrome; the empty/loading/no-yearPlan
  states; local edit state seeded from `getMonthlyPlan`/`createMonthlyPlan`.
- `StepRail.jsx`: `onOpenMonthlyPlan` + Step-3 clickability gated on the flag.
- `GamePlanV2/index.jsx`: mount the modal, pass the loaded yearPlan/submissions, wire open.

## Phase 3 — chart, fields, balance, readouts
- `MonthChart.jsx`, `MonthTargetField.jsx`, the balance pill + assists, the two readouts —
  all driven by the foundation helpers. Both light + dark themes; tokens only (no hex).

### Tests (RTL + the foundation already unit-covers the math)
- Modal: no-yearPlan → "do Year Plan first" state; with anchor + no plan → creates an
  even split (12 fields summing to the anchor); existing plan → loads it.
- Edit: editing a future month flips the balance pill off-zero and **disables Save**;
  auto-distribute and reset-to-even return it to balanced + re-enable Save; a past month
  is read-only.
- Chart: renders 12 columns; current month striped with a pace tick; future target-only.
- Readouts: to-finish + YTD render from the foundation helpers (mock submissions).
- Flag OFF: Step 3 is not clickable / modal unreachable (gate holds).

## Phase 4 — docs (with placeholders)
- PR-table row (placeholder SHA); cross-reference the foundation brief + CD annotation.
- Bank: Step-3 status + cascade rung → Slice 3; the loop-flag rename → standalone chore;
  the stale-anchor re-sync behaviour shipped here (note it).
- CONTEXT.md: gated UI — does not advance Current main HEAD framing per Rule 16(b) (same
  as the Year Plan panel slices); leave the HEAD field, update the Active track row only.

## Phase 5 — commit / push / PR
- Branch `feat/monthly-plan-panel`.
- `feat(monthly-plan): slice 2 — pacer panel (modal, chart, balance, readouts)`.
- Push; PR; **Rule 21** Gemini; **Rule 20** HEAD SHA in the report.

## Smoke
Gated → the production write-read smoke (login → flag on → open Monthly → edit + save →
reload → assert the `monthlyPlan/{year}` doc persisted with balanced targets) is the
real verification for this slice, but the preview build is flag-off, so it **ENV_GATEs**
unless the flag is forced on. Posture, same as the Year Plan panels: ship the RTL
coverage; run the live write-read smoke with `VITE_YEAR_PLAN_ENABLED=true` set in the
Vercel **preview** scope, or let it ride the un-gate PR. Because Slice-1's rules are now
deployed, a flag-on-preview save will actually persist — so a preview write-read smoke is
worth running here if convenient (it's the first end-to-end exercise of the store).

## Merge posture
New hub UI — modal + chart carry real aesthetic judgment — so **human-merge** per the
standing CLAUDE.md rule (overrides "gated = auto"), same as every Year Plan panel slice.
Hold the PR for review; eyeball the chart + balance behaviour in a flag-on preview before
merge. No deploy at merge (gated; rules already deployed in Slice 1).

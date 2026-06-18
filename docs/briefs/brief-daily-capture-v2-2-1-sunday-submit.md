# Brief — Daily Capture v2 · Phase 2.1: Sunday "Review & submit" deep-link

**Track:** Daily Capture v2 · **Phase:** 2.1 (polish on #686). **Size:** S.
**Merge:** HUMAN-MERGE — agent-facing UI, deploys to live agents on merge.
**Stacks on:** `main` (Phase 2 / #686 merged — `d9bf269`).

## Goal
Restore the Option B one-tap Sunday confirm: add a **"Review & submit"** button to the DCv2 read-only `SundayConfirmView` that **deep-links** the agent into the pre-filled weekly wizard at the ratings step, so they complete ratings/targets and submit there. No inline submit; no duplicated ratings/targets in DCv2.

## Why
#686 shipped the Sunday view as read-only — which is *correct*: ratings/targets and the submit live in the wizard per the field map. But it has no connective button, so an agent's Sunday flow is "review in DCv2 → navigate to the wizard manually." This adds the missing tap so Sunday is a one-tap confirm, not a hop between two surfaces.

## Recon anchors (CC RE-CONFIRMS Phase 0, Rule 17)
- `SundayConfirmView` lives in `src/components/.../DailyCaptureV2.jsx` (~L603–619, the `isTodaySunday` gate).
- `AgentDashboard.jsx` mounts `DailyCaptureV2` (L22) — and the weekly wizard; find the wizard-open trigger.
- `WizardForm.jsx` — the 12-step weekly wizard; reads the draft `tenants/{tid}/submissions/{uid}_{weekStarting}` (which the 1b aggregation pre-fills).

## Scope
- Add a **"Review & submit"** button to `SundayConfirmView`, shown when `isTodaySunday`.
- On tap: open the weekly wizard for the **current week**, pre-filled from the draft, at the **ratings step (10)** *if* the wizard supports opening at a step; else open default/resume.
- **Reuse the existing wizard-open mechanism** (modal/route/state — whatever `AgentDashboard` already uses). Do NOT build a new wizard entry point.
- If the week is already `submitted`, the button reflects that (disabled / "Submitted") rather than re-opening for edit.

## Decisions Locked (do not deviate)
1. **DEEP-LINK only** — the button routes to the wizard; it does NOT submit inline and does NOT capture ratings/targets in DCv2 (those stay in the wizard, per the field map).
2. **Label:** "Review & submit" (copy is adjustable — note it in the PR for Kyron).
3. **Target step:** ratings (step 10) if the wizard supports step-entry; else default/resume — Phase 0 determines which, report it. Do NOT fake step-entry if unsupported.
4. **Sunday-only** (`isTodaySunday` gate), consistent with `SundayConfirmView`.

## NON-scope
- Inline submit / ratings / targets capture in DCv2.
- Any change to the wizard's submit path or the aggregation.
- pace / working-days (Phase 3).

## Phase 0 — source re-verify
1. How `AgentDashboard` opens `WizardForm` (modal / route / state) — the trigger to reuse.
2. Whether the wizard can open at a specific step (deep-link to ratings) — report yes/no + the mechanism.
3. Confirm the wizard loads the **current week's draft** (aggregation-prefilled), not a fresh form.
4. Report before building if any of these differ from the assumptions above.

## Phase 1 — implement
Button + wire to the existing wizard-open. No new wizard entry, no submit logic.

## Phase 2 — static verify
Lint/build/full suite + a component test: button renders on Sunday (forced `getTodayTT`); click invokes the wizard-open with the current week (and the ratings step if supported); already-submitted state reflected.

## Phase 3 — smoke
PREFER a forced-date live leg (Playwright `addInitScript` Date → Sunday; confirm `getTodayTT` resolves Sunday): Sunday view shows → tap "Review & submit" → assert the wizard opens **pre-filled with the aggregated week** (at ratings if supported). Both themes, axe NO-NEW vs main. If the browser date-force is intractable, the component test is the bar — STOP and report so we do a manual Sunday check before the 21st.

## Phase 4 — docs placeholders (CONTEXT, FOLLOW_UPS).
## Phase 5 — branch `feat/daily-capture-v2-2-1-sunday-submit` off `main`; PR; Rule 20 SHA; HOLD.
## Phase 6 — Gemini disposition.

## Self-critique (Rule 22)
The slickness depends on the wizard supporting step-entry; if it doesn't, the agent lands at the wizard's default/resume step and navigates to ratings — acceptable, just less seamless. Phase 0 settles it; don't fabricate step-entry. Second gap: like the rest of the Sunday path, this is only naturally reachable on a Sunday, so the forced-date smoke is the only pre-21st live proof — flag clearly if it can't be made to run.

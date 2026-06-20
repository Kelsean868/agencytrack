# Brief — Wizard v3 Fast-Path · Phase 1: Mount the Confirm screen as the fast-path entry

**Status:** authored, source-verified against `689af70` (current `main`).
**Dispatch gate:** HOLD until the 2026-06-21 TT Sunday confirm check passes (Phase 1 rewires the deep-link entry the Sunday check exercises). Read-only Phase 0 may run anytime.
**Merge class:** HUMAN-MERGE (agent-facing wizard surface, Rule 19). Single branch off `main`, PR-open, STOP.

---

## Why
Reconcile finding: there is **no Confirm screen** in the wizard. The fast path today is `initialStep=10` (`AgentDashboard.jsx:426`), which lands the agent on `StepRateYourWeek` (`WizardForm.jsx:97`) — the ratings step — with no confirmation of the daily-aggregated week first. `WeekConfirmView` (#696) is a complete standalone component but is **mounted nowhere** and exposes only `onEditField` — no Confirm/Next callback. Phase 1 mounts it as the fast-path entry so daily/hybrid agents confirm their aggregated week before Rate → Goals → Submit.

## Scope
**IN (Phase 1):** `screen='confirm'`; real-draft `resolvePath` (Q4 FU); deep-link lands Confirm; mount `WeekConfirmView` with `formData`-derived sections; `onConfirm`/`onEditField` wiring; the three carried #696 FUs; Confirm "Next" → step 10.

**OUT (later phases):** fast-path skip-navigation model (if needed — see Phase 0.1); `useSeededTargets` `dials→coldCalls` fix (`FOLLOW_UPS.md:33-46`); WeekSoFar points/floor strip on Confirm (compose from `DailyCaptureV2.helpers.js` pure helpers); back-nav from step 10 → Confirm.

---

## Phase 0 — verify before building (Rule 17), READ-ONLY

- **0.1 — STEPS 10/11/12 identity** (`WizardForm.jsx:84-105`). Expected: 10=`StepRateYourWeek`, 11=`StepTargetsNextWeek` (Goals), 12=Review&submit. **Report actual.** This decides the phase boundary:
  - If 11 = Goals → fast path = Confirm + existing 10→11→12, **no skip-model needed**; Phase 2 is polish only.
  - If 11 ≠ Goals → Phase 2 must add a path-aware skip. Either way Phase 1 is unchanged (Confirm "Next" → step 10).
- **0.2 — `formData` is draft-seeded on open.** Confirm `getDraft` → `formData` seeding exists so Confirm edits + downstream steps + submit all operate on the aggregated data. Cite path:line. If `formData` is NOT seeded from the draft on a fast-path open, flag it — Phase 1 must seed it.
- **0.3 — loggingMode source at the `resolvePath` call** (`AgentDashboard.jsx:425`). Confirm whether it passes the real `userProfile?.loggingMode ?? 'hybrid'` or a hardcoded `'hybrid'`. If hardcoded, fold the real read into Ruling 2.

---

## Phase 1 — build

1. **screen domain.** Add `'confirm'` to the screen-domain comment (`WizardForm.jsx:196`); destructure a new `initialScreen` prop (`:201`); use it: `useState(initialScreen ?? (initialWeek ? 'step' : 'date'))` (`:205`).

2. **Real draft → resolvePath (Q4 FU).** At `AgentDashboard.jsx:473-478` (`onReviewSubmit`), replace the synthetic `{ aggregatedFromDaily: true, daysWorked: 1 }` with the real `currentWeekSub` (read at `:184`/`:195`). `openWizardForWeek(week, currentWeekSub)` → `resolvePath(loggingMode, currentWeekSub)` (`:425`). When `path === 'fast'`, set `wizardInitialScreen = 'confirm'` and pass it as `initialScreen` to `<WizardForm>` (`:463`). Also fix the second call site (`:539`) to pass `currentWeekSub` so a genuinely daily-aggregated current week resolves `'fast'` from that CTA too.

3. **Mount WeekConfirmView.** In the render, add a `screen === 'confirm'` branch before the step branches (near `:569`):
   `<WeekConfirmView draft={draftForConfirm} sections={deriveSections(formData)} onEditField={handleConfirmEdit} onConfirm={handleConfirmNext} variant={variant} />`.
   `sections` derived from `formData` (so inline edits reflect live). Add a `confirm` case to the header/title selectors (`:465-478`).

4. **Confirm callbacks.**
   - `handleConfirmNext` → `setScreen('step'); setStep(10)`.
   - `handleConfirmEdit(key, nextValue)` → `setFormData(d => ({ ...d, [key]: parseFloat(nextValue) || 0 }))` (domain rule: `parseFloat`, never string) → existing autosave persists to the weekly draft, merge-preserved.

5. **WeekConfirmView contract addition** (`WeekConfirmView.jsx:238`). Add `onConfirm` to the prop signature; render a primary footer button ("Looks good →") that calls `onConfirm`. Keep `onEditField` unchanged.

6. **Three carried #696 FUs.**
   - **(a) keystroke coercion.** `IntStepper.onChange` (`:27-30`), `DecimalStepper.onChange` (`:64-67`), `MoneyInput.onChange` (`:95-98`) currently `parseInt`/`parseFloat` every keystroke, holding no intermediate string → partial/decimal entry is blocked. Hold local string state while focused; commit the parsed number on blur/Enter; allow transient empty/partial values.
   - **(b) social headline.** `WeekConfirmView.helpers.js:43-58` (the flat 8-row social section incl. 4 platform rows). Restructure to one "Social media" headline (the aggregate) with the four platform-breakdown rows under an expandable; render the expand/collapse in `WeekConfirmView.jsx` (the `SectionCard` social render). Matches the locked ruling: four separate keys, one expandable headline on Confirm.
   - **(c) edit-button active-state.** Per-section Edit button (`WeekConfirmView.jsx:166-185`) currently signals active only via `aria-pressed` + Pencil↔Check swap. Add a distinct active visual (accent background/border) when `isEditing`.

---

## Phase 2 — tests (Vitest, co-located)

- Confirm renders from a fast-path draft: `sections` present, seeded non-zero fields surface (e.g. coldCalls, ffiConducted).
- Deep-link path: `onReviewSubmit` with a real `aggregatedFromDaily` draft → wizard opens at `screen='confirm'` (assert via `initialScreen`).
- `onConfirm` → `screen='step'`, `step===10`.
- `onEditField` updates `formData[key]` as a float.
- FU regressions: (a) typing a partial decimal ("1." / "") holds without coercion-snap; (b) social section collapses/expands; (c) edit button carries the active class when editing.
- Full-path unaffected: a weekly-mode / no-draft open still starts `screen='date'` (or `step=1`), no Confirm.

## Phase 3 — gates
lint 0/0 · full vitest suite green · build clean. **No rules/functions/money/auth touched → no emulator suite, no deploy.** Confirm scope == wizard files only.

## Phase 4 — docs (placeholders, committed in-PR)
- `CONTEXT.md`: post-merge fill placeholder (HEAD → this PR; Active track → "Wizard v3 fast-path Phase 1 (Confirm mounted) shipped").
- `FOLLOW_UPS.md`: bank anything deferred surfaced during the build (e.g. if Phase 0.1 shows step 11 ≠ Goals → bank the skip-model as Phase 2 scope).

## Phase 5 — commit / push / PR-open / STOP
Single branch off `main`; PR-open; **HOLD for human-merge** (Rule 19, agent-facing). Rule 21: poll Gemini, disposition every comment before reporting PR-ready. Rule 22: enumerate ≥1 known gap. Rule 20: report HEAD SHA; re-report on any further push.

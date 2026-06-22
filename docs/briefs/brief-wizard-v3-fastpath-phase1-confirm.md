# Brief — Wizard v3 Fast-Path · Phase 1: Mount the Confirm screen (v2, build-ready)

**Baseline:** source-verified at `be59d1a` (re-verify pass post-#717/#719).
**Dispatch gate:** CLEAR — 2026-06-21 Sunday confirm check passed 4/4 (week-targeting → completed week 2026-06-14, data rendered, deep-link prefilled, 0 console errors).
**Merge class:** HUMAN-MERGE (agent-facing wizard surface, Rule 19). Single branch off `main`, PR-open, STOP.
**Model:** Opus/Fable (architectural, multi-file wizard state machine).

---

## Why
The fast path today is `initialStep=10` (`AgentDashboard.jsx:427`) — it drops a daily agent onto `StepRateYourWeek` (the ratings step) with no chance to confirm their aggregated week first. `WeekConfirmView` (#696) is complete but mounted nowhere and exposes only `onEditField` — no Confirm/Next callback. Phase 1 mounts it as the fast-path entry so daily/hybrid agents confirm before Rate → Goals → Submit.

## Phase 0 — already verified (do NOT re-run; informational)
Confirmed at `be59d1a` by the re-verify pass:
- All brief anchors hold; `AgentDashboard.jsx` citations are +1 line vs the old 689af70 baseline (call at :426, onReviewSubmit :474-479, second call site :540, getDraft :185/:196, loggingMode :351). Structure unchanged — CC re-locates fresh at build time.
- **STEPS 10/11/12 = Rate / `StepTargetsNextWeek` (Goals) / Review** → fast path = Confirm → 10 → 11 → 12, **no skip-model. Phase 2 is polish-only.**
- `formData` is already draft-seeded on wizard open (`WizardForm.jsx:259-279`, seed at :275) → no seeding step needed.
- `loggingMode` is already the real read (`AgentDashboard.jsx:351`) → Ruling 2's real-read fold is unnecessary.
- Producing managers (UM/BM) do **not** reach the fast path (all ManagerDashboard wizard entries mount with no `initialWeek`/`initialStep`) → **Phase 1 stays agent-scoped.** Extending the fast path to managers later is just an `openWizardForWeek`-style dispatch in ManagerDashboard — banked as a post-Phase-1 FU.

## Phase 1 — build

1. **screen domain.** Add `'confirm'` to the screen-domain comment (`WizardForm.jsx:196`); destructure a new `initialScreen` prop (:201); use it: `useState(initialScreen ?? (initialWeek ? 'step' : 'date'))` (:205).

2. **Real draft → resolvePath (Q4 FU).** At `AgentDashboard.jsx` `onReviewSubmit` (~:474-479), replace the synthetic `{ aggregatedFromDaily: true, daysWorked: 1 }` with the real `currentWeekSub` (read at :185/:196). When `resolvePath` returns `'fast'`, set `wizardInitialScreen = 'confirm'` and pass it as `initialScreen` to `<WizardForm>` (~:463). Also fix the second call site (~:540) to pass `currentWeekSub` so a genuinely daily-aggregated current week resolves `'fast'` from that CTA too. (loggingMode is already real — no change there.)

3. **Mount WeekConfirmView.** Add a `screen === 'confirm'` branch before the step branches (near :569):
   `<WeekConfirmView draft={draftForConfirm} sections={deriveSections(formData)} onEditField={handleConfirmEdit} onConfirm={handleConfirmNext} variant={variant} />`.
   `sections` derived from `formData` (so inline edits reflect live). Add a `confirm` case to the header/title selectors (~:464-479).

4. **Confirm callbacks.**
   - `handleConfirmNext` → `setScreen('step'); setStep(10)`.
   - `handleConfirmEdit(key, nextValue)` → `setFormData(d => ({ ...d, [key]: parseFloat(nextValue) || 0 }))` (domain rule: `parseFloat`, never string) → existing autosave persists to the weekly draft, merge-preserved.

5. **WeekConfirmView contract addition** (`WeekConfirmView.jsx:238`). Add `onConfirm` to the prop signature; render a primary footer button ("Looks good →") that calls `onConfirm`. Keep `onEditField` unchanged.

6. **Three carried #696 FUs** (all confirmed still live at `be59d1a`).
   - **(a) keystroke coercion.** `IntStepper.onChange` (:27-29), `DecimalStepper.onChange` (:64-66), `MoneyInput.onChange` (:95-97) coerce to a number every keystroke → partial/decimal entry blocked. Hold local string state while focused; commit the parsed number on blur/Enter; allow transient empty/partial values.
   - **(b) social headline.** `WeekConfirmView.helpers.js:43-57` (flat 8-row social section incl. 4 platform rows). Restructure to one "Social media" headline (aggregate) with the four platform rows under an expandable; render the expand/collapse in the social `SectionCard`. Locked ruling: four separate keys, one expandable headline.
   - **(c) edit-button active-state.** Per-section Edit button (`WeekConfirmView.jsx:165-185`) signals active only via `aria-pressed` + icon swap. Add a distinct active visual (accent background/border) when `isEditing`.

## Phase 2 — tests (Vitest, co-located)
- Confirm renders from a fast-path draft: `sections` present, seeded non-zero fields surface (coldCalls, ffiConducted).
- Deep-link: `onReviewSubmit` with a real `aggregatedFromDaily` draft → wizard opens at `screen='confirm'`.
- `onConfirm` → `screen='step'`, `step===10`.
- `onEditField` updates `formData[key]` as a float.
- FU regressions: (a) partial decimal ("1." / "") holds without coercion-snap; (b) social section collapses/expands; (c) edit button carries the active class when editing.
- Full-path unaffected: weekly-mode / no-draft open still starts `screen='date'`, no Confirm.

## Phase 3 — gates
lint 0/0 · full vitest suite green · build clean. **No rules/functions/money/auth touched → no emulator suite, no deploy.** Scope == wizard files only.

## Phase 4 — docs (placeholders, committed in-PR)
- `CONTEXT.md`: post-merge fill placeholder (HEAD → this PR; Active track → "Wizard v3 fast-path Phase 1 — Confirm mounted").
- `FOLLOW_UPS.md`: **bank the producing-manager FU** — "Extend the fast-path Confirm entry to UM/BM (My Production wizard); `resolvePath` is role-agnostic, needs an `openWizardForWeek`-style dispatch in ManagerDashboard." Plus anything else surfaced.

## Phase 5 — commit / push / PR-open / STOP
Single branch off `main`; PR-open; **HOLD for human-merge** (Rule 19). Rule 21: poll Gemini, disposition every comment before reporting. Rule 22: ≥1 known gap. Rule 20: report HEAD SHA; re-report on any further push.

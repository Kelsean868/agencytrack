# Brief — Wizard v3 Fast-Path · Phase 2: polish (single PR)

**Baseline:** recon-verified at `0db7a69` (post-#722). CC re-confirms anchors at Phase 0 (main moves).
**Merge class:** HUMAN-MERGE (agent-facing wizard, Rule 19). Single branch off `main`, PR-open, STOP.
**Model:** Opus/Fable (wizard nav-state + render reasoning).

## Why
Phase 1 mounted the Confirm screen (#722). Phase 2 finishes the fast-path to coherence: correct Goals seeding, coherent back-navigation, an end-of-week context readout, and the missing stepper test. No skip-model (step 11 is already Goals).

## Phase 0 — re-confirm at current HEAD (Rule 17)
The recon located all anchors at `0db7a69`; re-confirm they hold (main may have moved). Specifically: `useSeededTargets` read site + dep array; `WizardForm` `handleBack` / `handleConfirmNext` / the `screen`/`step` state; the `screen === 'confirm'` render branch; `WeekConfirmView` `IntStepper`/`DecimalStepper` `base()`/`bump()`. Report any structural drift before editing.

## Phase 1 — build (4 items)

**1. `useSeededTargets` seeding fix.**
- `src/hooks/useSeededTargets.js`: change the dials read from `parseFloat(data?.dials) || 0` to `parseFloat(data?.dials ?? data?.coldCalls) || 0`. Add `data?.coldCalls` to the dependency array alongside `data?.dials`.
- Rationale: the daily-aggregated draft carries `dials` (fast path works today); weekly `INITIAL_DATA` uses `coldCalls` (full path reads `undefined` → floor). `??` fixes the full path without regressing the fast path. Respects the canonical daily-`dials` ↔ weekly-`coldCalls` mapping.
- Update `src/hooks/__tests__/useSeededTargets.test.js`: add a full-path case (formData with `coldCalls`, no `dials`) asserting `targetDials` seeds from `coldCalls`; keep the existing fast-path `dials` case green.
- **Banked product Q (non-blocking):** whether "Target Dials" should mean cold-calls-only (current) or total calls (sum of all call subtypes). Out of scope for this fix; note in FOLLOW_UPS.

**2. Fast-path back-navigation (Confirm → 10 → 11 → 12).**
- Add a `cameFromConfirm` boolean state to `WizardForm`, default false.
- Set it true in `handleConfirmNext` (alongside `setScreen('step'); setStep(10)`).
- In `handleBack`: when `step === 10 && cameFromConfirm`, `setScreen('confirm')` (and clear `cameFromConfirm`) instead of decrementing to step 9. All other back transitions unchanged (11→10, 12→11, and full-path 10→9 when `!cameFromConfirm`).
- Tests: fast-path back from step 10 → `screen === 'confirm'`; full-path back from step 10 → `step === 9` (regression guard).

**3. Static points-earned-vs-floor readout on the Confirm screen.**
- In the `screen === 'confirm'` render branch, add a compact readout: earned `computePoints(sanitize(formData, commissionRate))` vs floor `mapFloorToPoints(floors)` (= 399 for south defaults) → e.g. "`{earned} / {floor} pts`" with a "floor met ✓" affordance when `earned >= floor`. Both helpers are pure and already importable; `formData`/`commissionRate`/`floors` are all in scope at Confirm (draftLoaded === true).
- **Do NOT** use `computeWeekToDatePoints`/`computePaceState` — they are intra-week (elapsed-days cursor) and require a daily-docs fetch WizardForm lacks; pace is meaningless at end-of-week confirmation.
- **Dispatcher ruling — scope it lean:** points/floor readout only. Do NOT add `WeekSoFarPanel` here — its API/apps/calls totals duplicate WeekConfirmView's production section. (If field feedback later wants the API/est-commission hero, that's a follow-up.)
- Test: Confirm renders the readout with the earned/floor values from a seeded draft; "floor met" affordance toggles at the boundary.

**4. Stepper type-then-click test (banked coverage FU).**
- `src/components/wizard/__tests__/WeekConfirmView.test.jsx`, extend Suite E (FU-a): open edit mode → fire `change` on the input (sets the local `draft`) → fire `click` on the `+` button (`{fieldLabel} increase`) → assert `onEditField` called with `parsedTypedValue + 1` (proves `bump`'s `base()` consumes the live typed draft). Add the symmetric `-` case.

## Phase 2 — gates
lint 0/0 · full vitest suite green · build clean. **No rules/functions/money/auth touched → no emulator, no deploy.** Scope == wizard files + the two test files.

## Phase 3 — docs
- `CONTEXT.md`: **do not pre-write a Recently-shipped row** — `/post-merge` owns that surface (lesson from #722). Leave it; the fill adds the row post-merge.
- `FOLLOW_UPS.md`: clear the `useSeededTargets dials→coldCalls` FU (resolved here). Bank the "Target Dials = cold-only vs total" product Q.

## Phase 4 — commit / push / PR-open / STOP
Single branch off `main`; PR-open; **HOLD for human merge** (Rule 19). Rule 21 Gemini poll + disposition; Rule 22 ≥1 gap; Rule 20 report HEAD SHA, re-report on any push. Confirm `git branch --show-current` before every commit (worktree-collision guard).

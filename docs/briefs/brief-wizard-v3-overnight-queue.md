# Brief — Wizard v3 · Overnight Night-Queue (merge-independent)

**Program:** Weekly Wizard v3 · unattended build window.
**Dispatcher away ~10h.** CC works Q1→Q5 sequentially. Every item builds off `main`
(or, for Q4, off `main` *after* Q1 merges). No item depends on a prior **human** merge.

## Program rules (read first)
- **Merge policy:** Q1 only is **green-channel auto-merge** — and ONLY if EVERY gate
  self-passes (lint 0 · full suite · build · hex-grep · §7 self-review · §6 Gemini
  triage · CI poll SUCCESS). Smoke is **waived for Q1** (test-only, non-user-visible —
  justification recorded in the PR). Two consecutive auto-reverts HALT the channel.
- **Q2, Q3, Q4, Q5 are PR-OPEN + STOP. No merge, no deploy, no exceptions.** They touch
  scoring, functions, and agent-facing surfaces (Rule 19). Leave them as open PRs for the
  dispatcher to merge on return.
- **No `firebase deploy` at any point.** Q2 changes a CJS cron twin; the deploy is a
  dispatcher action on return.
- **Hard-stop on ambiguity.** Any Phase-0 finding that contradicts a locked decision →
  STOP and report; do not improvise. Rule 17 (grep + `git ls-files`, cite `path:line`),
  Rule 22 (≥1 known gap per report), Rule 23 (state falsifier before banking).
- **Sequencing:** Q1 → (Q2, Q3, Q4, Q5 in order). Q4 branches off `main` AFTER Q1's
  squash lands so it carries the characterization tests. Q2/Q3/Q5 branch off `main`.
- **Closing report:** one consolidated report listing every PR (number + branch HEAD SHA),
  gate status, and known gaps. Rule 16(c) consolidated fill commit covers ONLY the
  auto-merged Q1.

---

## Q1 — Characterization tests for WizardForm (test-only, AUTO-MERGE-eligible)
**Size:** M · **Stacks on:** `main` (HEAD `cc7963d`) · **Merge:** green-channel auto-merge.

### Goal
Lock the current v2 weekly-wizard behavior in tests BEFORE the v3 shell refactors it. These
become the safety net Q4 must keep green.

### Phase 0 — source re-verify (STOP triggers)
1. Confirm `WizardForm.jsx` step order (12 steps, `useState(1)` start) and the `INITIAL_DATA`
   flat payload still match the reconcile (A1, A5). If drifted → report, don't guess.
2. Confirm submit calls `computePoints(sanitize(formData, commissionRate))` at the submit
   path; confirm `mapFloorToPoints(DEFAULT_WEEKLY_ACTIVITY_FLOORS) === 399`.

### Scope (assert, don't change behavior)
- Step machine: opens at step 1; `handleDotClick` allows backward nav only; step 12 mounts
  `ReviewSubmit`.
- Draft prefill: with `initialWeek`, `getDraft(...)` is read and non-submitted fields spread
  into `formData` before step 1 renders; a `submitted` draft does not re-open for edit.
- Payload identity: the persisted submission contains exactly the `INITIAL_DATA` flat key set
  (enumerate from source); no key added/removed/renamed by the wizard at submit.
- Scoring: `computePoints` of a known fixture submission returns a stable expected integer;
  the weekly floor equals **399**.
- Autosave: 1500ms debounce + retry escalation + no save to a `submitted` doc (`draftStatus`
  guard).

### NON-scope
Any production-source change. New behavior. UI/token changes. If a test cannot be written
without touching source, STOP and report (do not refactor to make it testable).

### Decisions locked
- Tests live under `src/components/wizard/__tests__/` alongside the existing v2 suites.
- Fixtures are inline; no Firestore. Mock `getDraft`/save service boundaries.
- These are **characterization** tests — they encode current behavior as-is, including any
  quirks. Do not "fix" behavior; if something looks wrong, note it as a gap, assert the
  current behavior, and move on.

### Phases
1. Implement the suites above. 2. Static verify: lint 0 · full suite green · build.
3. Smoke: **WAIVED** — test-only, non-user-visible; record justification in PR body.
4. Docs: none (test-only; no CONTEXT fill needed beyond the 16(c) program fill).
5. Auto-merge ONLY if the full gate battery self-passes; else PR-open + report.
6. Report: PR #, branch HEAD SHA, gate results, ≥1 gap.

---

## Q2 — M3 points-fix: aggregator writes `coldCalls = Σ dials`
**Size:** S · **Stacks on:** `main` · **Merge:** PR-OPEN + STOP (scoring-adjacent; human-merge;
CJS twin needs `firebase deploy --only functions` on return).

### Goal
A fast-path submission is built from the aggregated draft, which carries `dials` (total) but
not the four call-breakdown fields `computePoints` reads → 0 call points. Mirror what
`computeDayPoints` already does (`coldCalls = dials`; other three call types 0) so the
aggregated draft is points-correct for any future fast-path submit.

### Phase 0 — source re-verify (STOP triggers)
1. Confirm `computeDayPoints` (DailyCaptureV2.helpers.js:L52–69) maps `entry.dials →
   coldCalls` and zeroes `referralCalls/followUpCalls/seminarTradeshowCalls`.
2. Confirm the ESM aggregator (`src/lib/schema/dailyActivity.aggregator.js`) writes `dials`
   and does NOT write `coldCalls` today; confirm the CJS twin
   (`functions/.../dailyToWeekly.js`) mirrors it.
3. Confirm the full wizard path is unaffected: `StepCallsF2F` persists the four breakdown
   fields and never sets `dials` (so a weekly-only draft never collides).

### Scope
- ESM + CJS aggregator twins: in addition to `dials`, write `coldCalls = <the summed dials
  total>` (the canonical mapping). Leave `referralCalls/followUpCalls/seminarTradeshowCalls`
  unset (0) so they don't double-count.
- Extend the ESM↔CJS cross-check test to assert `coldCalls` parity and that
  `computePoints(aggregatedDraft)` now includes call points.

### NON-scope
Changing `computePoints` itself. Touching `dials`. Any UI. The full-wizard call fields.

### Decisions locked
- Mapping is **`coldCalls = dials` only** (mirror `computeDayPoints`). Do NOT split across
  the four call types.
- Keep writing `dials` too (back-compat for `SundayConfirmView` and any reader).
- Twins MUST stay byte-identical in output shape (existing CJS-sync invariant).

### Phases
1. Implement both twins + cross-check test. 2. Static verify (lint/build/suite + emulator
   if the cross-check needs it). 3. Smoke: WAIVED (no user-visible change; aggregation
   covered by unit/cross-check) — justify in PR. 4. Docs: CONTEXT `{TBD}` placeholders for
   the dispatcher fill. 5. **PR-OPEN. STOP.** Note in the PR: "requires `firebase deploy
   --only functions` after merge." 6. Report: branch HEAD SHA, ≥1 gap.

---

## Q3 — v3 Confirm screen (standalone, prop-contract, not routed)
**Size:** M/L · **Stacks on:** `main` · **Merge:** PR-OPEN + STOP (agent-facing component).

### Goal
Build the editable "Confirm your week" screen the fast path will mount — as a self-contained,
prop-driven component with its own tests. NOT wired into the wizard yet (the shell, Q4, and
the later fast-path PR route it).

### Phase 0 — source re-verify (STOP triggers)
1. Confirm the aggregated draft shape (keys the aggregator writes, B1) so the section
   renderer reads real fields. Confirm `aggregatedFromDaily`/`daysWorked` markers exist on
   the draft.
2. Confirm the daily form's card groupings (DailyCaptureV2 GroupCards) to mirror as the
   confirm sections (ruling: per-daily-card, not the mockup's 2 mega-sections).
3. Confirm Nexus tokens + the `frontend-design` skill constraints before any styling.

### Scope — LOCKED prop contract (do not deviate)
```
<WeekConfirmView
  draft            // aggregated weekly draft object (read-only source of truth)
  sections         // derived: array of { id, label, provenanceCount, rows:[{key,label,value,unit}] }
  onEditField      // (key, nextValue) => void  — writes to the weekly draft (merge-preserve)
  variant          // 'desktop' | 'mobile'
/>
```
- Render per-daily-card collapsible sections; each section header shows `✓ from daily ×N`
  (N = `provenanceCount`, from `draft.daysWorked` or section provenance).
- Inline edit: an "Edit" affordance expands the section to ± steppers / inputs in place
  (reuse the daily's field atoms / `CardStack` atoms where possible); editing calls
  `onEditField` — it does NOT rewrite day docs (ruling 10). No jump-back through steps.
- Ratings and next-week goals are NOT shown here (they're later steps).
- Both themes via Nexus tokens; lifted teal in dark. Use the live **399** floor / real
  numbers in any sample, never the mockup's 550.

### NON-scope
Routing into the wizard. Path-select. Submit. The Rate/Goals/Submit screens. Any aggregator
or scoring change.

### Decisions locked
- `SundayConfirmView` is NOT reused — this is a fresh component reading the aggregated draft
  (reconcile E1 fork verdict).
- Section granularity = per-daily-card (ruling E2).
- Social shows one "Social & content" headline that expands to the breakdown on edit
  (ruling B2).

### Phases
1. Build component + tests (render with a mock draft prop; assert sections, provenance,
   inline-edit → `onEditField`). 2. Static verify (lint/build/suite + axe on the isolated
   component). 3. Smoke: WAIVED if not routed (justify: component not reachable in the app
   yet); if CC mounts a dev harness route, smoke that route. 4. Docs `{TBD}`. 5. **PR-OPEN.
   STOP.** 6. Report: branch HEAD SHA, both-theme screenshots, ≥1 gap.

---

## Q4 — v3 shell: step-entry + resolvePath (off main, AFTER Q1)
**Size:** M · **Stacks on:** `main` **after Q1 merges** · **Merge:** PR-OPEN + STOP (wizard core,
agent-facing).

### Goal
Give the wizard the foundation both paths need: open-at-step-N and mode-based path selection.
Immediate win: the #687 "Review & submit" deep-link lands at the ratings step instead of
step 1. No new screens; full-mode flow unchanged.

### Phase 0 — source re-verify (STOP triggers)
1. Re-confirm `useState(1)` start and that no step-entry exists (A1/A2).
2. Confirm the draft carries `aggregatedFromDaily: true` and/or `daysWorked` so `resolvePath`
   can detect "came from daily." If absent → STOP (the fast condition needs a signal).
3. Confirm the Q1 characterization suite is present on `main` and green (this PR must keep it
   green).

### Scope
- Replace the hard `const [step, setStep] = useState(1)` with `useState(initialStep ?? 1)`;
  accept an `initialStep` prop on `WizardForm`. Backward-nav rule unchanged.
- Add `resolvePath(loggingMode, draft)`: `weekly` → `'full'`; `daily|hybrid` AND
  `draft?.aggregatedFromDaily === true` (or `daysWorked >= 1`) → `'fast'`; else `'full'`
  (empty-draft fallback).
- Wire `AgentDashboard`'s `onReviewSubmit` deep-link to open the wizard at the **ratings
  step (10)** when `resolvePath` returns `'fast'` (retires the step-1 fallback). Full-mode and
  all other entry points unchanged (still step 1).
- Document the **v3 revert boundary** in the `WizardForm` header (revert THIS shell commit;
  the stale "legacy Step1–Step9 on disk" comment is wrong — those files are gone, confirmed
  by `git ls-files src/components/wizard/steps/` returning empty).

### NON-scope
The Confirm/Rate/Goals fast-path screens (later PR composes Q3). Re-pagination. Aggregator.
Scoring. Payload shape (LOCKED — must not change). Autosave behavior (LOCKED). Submit path
(LOCKED except the entry step).

### Decisions locked
- `resolvePath` is a thin pure helper (no Firestore); `loggingMode` source is
  `userProfile?.loggingMode ?? 'hybrid'` (no `effectiveLoggingMode` function exists — do not
  invent one).
- Fast-mode landing this PR = ratings step (10). The real Confirm-first flow arrives in the
  post-merge fast-path PR once Q3 is merged.
- Q1 tests MUST stay green; if the refactor breaks a characterization test, STOP — that means
  behavior drifted.

### Phases
1. Implement. 2. Static verify: lint 0 · **Q1 suite + full suite green** · build · hex-grep ·
   axe no-new vs main. 3. Smoke (RUN — agent-facing): both-themes; daily/hybrid agent with a
   populated draft → deep-link lands at ratings; weekly agent → step 1; payload-identity spot
   check at submit. 4. Docs `{TBD}`. 5. **PR-OPEN. STOP.** 6. Report: branch HEAD SHA,
   smoke screenshots, ≥1 gap.

---

## Q5 — (droppable) goal-seeding util + SuggestedField wiring
**Size:** S/M · **Stacks on:** `main` · **Merge:** PR-OPEN + STOP.

### Goal
Make next-week targets seed from pace instead of starting blank — reusable ahead of the fast
path's Goals step.

### Scope
- `useSeededTargets(...)` hook: composes `decomposeFromAPI` (`src/utils/goalDecomposition.js`)
  + the 399-class weekly floor to return suggested targets (calls/FFI/CI/API), honest-blank
  when no annual goal is set.
- Swap `NumericField`→`SuggestedField` in `StepTargetsNextWeek` (step 11), passing
  `suggestion={seeded[...]}` and a "seeded from pace" note. `SuggestedField` already exists
  in `CardStack.jsx` (F1) and is unused in step 11 today.

### NON-scope
Fast-path Goals screen (later). Changing submit. Any annual-goal data model change.

### Decisions locked
- Seed = `max(floor, thisWeekActual)` per metric; API seeds from `decomposeFromAPI` if an
  annual goal exists, else blank with a prompt.
- Display-only suggestion — the agent's adjusted value is what persists.

### Phases
1. Implement hook + wire step 11. 2. Static verify. 3. Smoke (RUN): step 11 shows seeded
   suggestions; adjust persists; blank when no annual goal. 4. Docs `{TBD}`. 5. **PR-OPEN.
   STOP.** 6. Report: branch HEAD SHA, ≥1 gap.

---

## On return (NOT in this queue — needs the shell merged)
1. Merge Q1 (auto, if it landed) → review/merge Q2, Q3, Q4, Q5 in order → `firebase deploy
   --only functions` for Q2.
2. Dispatch **fast-path wiring**: compose Q3's `WeekConfirmView` as fast-mode step 1, retarget
   the deep-link from ratings → Confirm, add Rate/Goals/Submit + celebration-on-points.
3. Then **full-path re-pagination** (12 → 4 collapsible phase screens).

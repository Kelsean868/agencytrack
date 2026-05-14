# Wizard R2-R5 polish — kickoff brief

**Scope:** four banked polish items from post-PR #88 wizard hardening surface analysis.
**Severity:** all low; none were pilot-blockers when pilot was active. Project is now in refinement mode (pilot postponed, May 14 2026).
**Size:** single PR, single component touched (`src/components/wizard/WizardForm.jsx` + its tests). Estimated diff < 80 LOC source + tests.

---

## Goal

Close the four deferred wizard polish items tracked in `docs/FOLLOW_UPS.md` under **"Wizard polish (post-pilot)"**:

- **R2** — Nested `role="alert"` inside `role="status"` container. Some screen readers ignore nested live regions per ARIA spec. Fix: split into two sibling regions (outer polite + separate assertive).
- **R3** — `animate-pulse` at `WizardForm.jsx:553` (line approximate — verify in Phase 1) missing `motion-reduce:animate-none` guard. Add the guard.
- **R4** — Retry button has no throttle; rapid taps could double-increment the failure counter. Add 2s throttle.
- **R5** — Intermittent-failure visibility: brief failures get erased by subsequent successful saves, masking flaky patterns. **DECISION LOCKED: sticky failure window — failure indicator stays visible minimum 8s before any subsequent "saved" state can replace it.** Do NOT surface R5 alternatives in Phase 1; just implement.

---

## Strike rules

- Two-strike rule applies. Session opens at **0/2**. Project carry-in is **0/2**.
- Strike triggers: token leak in any artifact, source-code change outside `WizardForm.jsx` + its tests, scope creep beyond R2-R5, push directly to main on a feature branch (docs-direct-to-main exception applies only to Phase 7 post-merge docs fills).

---

## Out of scope

- Any change to save service, AuthContext, or autosave logic outside the indicator rendering
- Any other wizard step files
- Any other component using `role="status"` or `animate-pulse` (Polish-2 sweep is a separate future PR)
- Updates to `WizardFormSaveStatus.test.jsx` beyond the items below
- Visual/copy redesign of the indicator (states + microcopy stay identical)

---

## Hard stops (STOP and surface before continuing)

- Phase 1 finds that R2's nested `role="alert"` doesn't actually exist (e.g., it was already restructured outside the FOLLOW_UPS bank) → STOP, surface, await direction
- Phase 1 finds line 553 is not the `animate-pulse` location → SURFACE the correct line(s), continue if behavior is identical
- Phase 1 finds Retry button is already throttled (disabled-while-saving covers R4 in practice) → SURFACE, ask whether to skip R4 or add explicit 2s throttle anyway
- Implementation requires touching any file other than `WizardForm.jsx` + its test file → STOP
- Any test regression in `WizardFormSaveStatus.test.jsx` or any other suite → STOP and fix before continuing
- Lint or build fails → STOP and fix
- Strike count hits 2 → STOP

---

## Phase 1 — Audit + scope confirm

### 1a — Locate the four targets in `src/components/wizard/WizardForm.jsx`

1. Find the `SaveStatusIndicator` sub-component (per PR #88, it lives at the bottom of `WizardForm.jsx`).
2. Locate:
   - **R2 target:** outer container with `role="status"` and an inner element with `role="alert"` (or `aria-live="assertive"`) nested inside it.
   - **R3 target:** the `animate-pulse` Tailwind class (around line 553).
   - **R4 target:** the Retry button rendered in the failed-state branch (uses `RotateCcw` icon per PR #88 review).
   - **R5 target:** the state-transition path from `failed` → `saved` (where the failed indicator gets replaced by the saved indicator).

### 1b — Confirm baseline before edits

- Run `npm test -- --run WizardFormSaveStatus` and capture passing count (expected ~12-14 tests per PR #88 review).
- Capture the exact line numbers + current code for each target. Surface them in a short Phase 1 summary before implementing.

### Phase 1 surface format

```
PHASE 1 — WIZARD R2-R5 AUDIT

File: src/components/wizard/WizardForm.jsx

R2 — Nested live regions:
  Outer:  line <N>  role="status" aria-live="polite"
  Inner:  line <N>  role="alert"  (or aria-live="assertive")
  Current structure: <one-line description>

R3 — animate-pulse location:
  Line <N>: <code snippet>
  Tailwind classes: <list>

R4 — Retry button:
  Line <N>: <button JSX>
  onClick handler: <function ref>
  Currently disabled when: <condition or "no disabled prop">

R5 — failed → saved transition:
  State machine path: <describe>
  Where the swap happens: <component branch + line>

Baseline tests: <N> passing in WizardFormSaveStatus.test.jsx

PROCEEDING TO PHASE 2.
```

If anything in the four targets is materially different from the brief's description, STOP and surface before Phase 2.

---

## Phase 2 — Implementation

Implement R2 → R3 → R4 → R5 in order, with one commit per item (or one combined commit titled `feat(wizard): R2-R5 polish` if changes are tightly intertwined — CC's call, just be coherent).

### R2 — Split nested live regions

- Restructure so the polite region (`role="status" aria-live="polite" aria-atomic="true"`) and the assertive region (`role="alert"` — no redundant `aria-live="assertive"` since `role="alert"` implies it) are **siblings**, not nested.
- Polite region renders idle / saving / saved states.
- Assertive region renders failed / offline / escalated states.
- Both can be rendered simultaneously but only one carries content at a time (the other is empty / hidden via `hidden` attribute or empty string).
- Preserve existing microcopy verbatim.

### R3 — Motion-reduce guard

- At every `animate-pulse` occurrence in the indicator, add `motion-reduce:animate-none`.
- If `animate-pulse` is used elsewhere outside the indicator in `WizardForm.jsx`, leave those untouched (R3 scope is the indicator only per FOLLOW_UPS bank).

### R4 — Retry button throttle

- Add a 2-second throttle on the Retry button's `onClick` handler.
- Implementation pattern (suggested, CC may adapt): a `useRef` storing `lastRetryAt`, and the click handler short-circuits if `Date.now() - lastRetryAt.current < 2000`.
- Keep the existing `disabled-while-saving` behavior (don't remove or weaken it; the throttle is layered protection for the rapid-tap case where `saving` hasn't toggled yet).
- Throttle should be silent (no toast / no error) — just a no-op on rapid re-clicks.

### R5 — Sticky failure window (DECISION LOCKED — do not re-surface)

- Track `failedShownAt` (timestamp, in state or ref).
- When entering `failed` state, set `failedShownAt = Date.now()`.
- When a subsequent `saved` state would transition the indicator, check if `Date.now() - failedShownAt < 8000`. If yes, defer the transition (either via setTimeout to complete the swap at the 8s mark, or via a derived render state that holds "failed" visually until 8s elapses).
- After 8s elapses (or if `saving` re-fires, which legitimately replaces the failed indicator), normal state machine resumes.
- The 8s constant should be a named const at the top of the file (e.g., `FAILURE_STICKY_MS = 8000`) for clarity.
- This applies ONLY to the auto-clear path (`failed` → `saved`). Manual Retry that succeeds should also respect the sticky window (the user gets confirmation that retry worked, but it shouldn't visually flash from failed → saved → failed-was-real if they then disconnect again).

### Tests to add / update in `WizardFormSaveStatus.test.jsx`

- **R2:** new test asserts polite + assertive regions are siblings (not nested). Use a DOM query that confirms neither region is a descendant of the other.
- **R3:** new test asserts `motion-reduce:animate-none` is present on every element that has `animate-pulse` in the indicator.
- **R4:** new test fires two rapid clicks on Retry within 100ms with fake timers; asserts `saveDraft` is called only once. Then advances timers past 2s and asserts a third click works.
- **R5:** new test simulates `failed` state, then advances timers 1s, then dispatches a `saved` state; asserts the indicator still shows failed UI. Then advances timers to 8.1s and asserts the swap completes.

Aim for ~4 new test cases (one per R-item). Final test count should be **~673 + ~4 = ~677**.

---

## Phase 3 — Verification

- `npm run lint` → 0 errors (pre-existing warnings in unrelated files are fine; do not "fix" them)
- `npm test -- --run` → all pass (expected ~677)
- `npm run build` → green, no new warnings
- Capture all three output summaries for the PR description.

---

## Phase 4 — Docs with placeholders (REQUIRED — per Memory 26)

Update both docs files **with placeholders** so Phase 7 just fills them in. Do not author fresh content in Phase 7.

### `docs/CONTEXT.md`

1. **Top table:** update the HEAD SHA + active/next track lines to `<sha>` placeholder + this PR scope.
2. **Recently-shipped table:** prepend a new row:
   ```
   #<pr#> | <sha> | feat(wizard): R2-R5 polish — nested live regions split, motion-reduce guard, retry throttle, sticky failure window
   ```
3. **Drop the oldest row** from the recently-shipped table (cap is 5).
4. **"Where we left off":** rewrite the paragraph to describe R2-R5 closure and what's next in the queue.

### `docs/FOLLOW_UPS.md`

1. Find the **"Wizard polish (post-pilot)"** section.
2. Mark all four R-items resolved with this format:
   ```
   - ✅ **R2** — CLOSED by PR #<pr#> (<sha>): ...
   - ✅ **R3** — CLOSED by PR #<pr#> (<sha>): ...
   - ✅ **R4** — CLOSED by PR #<pr#> (<sha>): ...
   - ✅ **R5** — CLOSED by PR #<pr#> (<sha>): ... (sticky failure window, 8s)
   ```
3. The entire "Wizard polish (post-pilot)" section can be collapsed under one ✅ block if cleaner — CC's call.

---

## Phase 5 — Commit, push, PR

1. Feature branch: `feat/wizard-r2-r5-polish`.
2. Commit organization:
   - Source: `feat(wizard): R2-R5 polish — split live regions, motion-reduce, retry throttle, sticky failure window` (or split per R-item if cleaner).
   - Tests: `test(wizard): R2-R5 polish coverage (~4 new cases)`
   - Docs: `docs: bank PR-<pr#> placeholders (CONTEXT + FOLLOW_UPS)`
3. Push the feature branch (NOT main).
4. Open PR titled: `feat(wizard): R2-R5 polish (nested live regions, motion-reduce, retry throttle, sticky failure window)`
5. PR description must include:
   - **Summary:** all four R-items, one line each, with before/after for the ARIA tree (R2) and a code snippet for the sticky window logic (R5).
   - **Closes:** "Wizard polish (post-pilot) R2-R5 from docs/FOLLOW_UPS.md".
   - **Decision lock:** note that R5 = sticky window (8s) was pre-locked in the brief; failure-count badge approach explicitly NOT taken.
   - **Tests delta:** added count, file, what each new case asserts.
   - **Verification:** lint / test / build output summaries.
   - **Smoke note:** RTL tests cover the indicator's full state machine; no production-smoke walk is required for this PR since the changes are pure rendering / a11y / timing with no Firestore write path touched. If Kyron wants a quick manual sanity check, it's: trigger autosave in the wizard, force-disconnect to provoke `failed`, reconnect to provoke `saved`, observe the failure indicator persists ≥ 8s before swapping.

---

## Phase 6 — STOP

DO NOT MERGE. Kyron reviews, approves, and merges via GitHub UI (squash). Once Kyron messages **"PR #<N> merged"** or equivalent, CC executes Phase 7.

---

## Phase 7 — Post-merge cleanup (wait for Kyron's merge confirmation)

Execute **only after** Kyron confirms the merge:

1. `git checkout main && git fetch origin --prune && git pull origin main`
2. `git log origin/main --oneline -1` — capture squash SHA
3. Fill `docs/CONTEXT.md` SHA + PR# placeholders (top table, recently-shipped row, "where we left off" if it referenced a placeholder)
4. Fill `docs/FOLLOW_UPS.md` SHA + PR# placeholders for all four R-items
5. Commit: `docs: fill #<N> squash SHA + PR# placeholders`
6. `git push origin main` (docs-direct-to-main exception per Memory 21)
7. Remove worktree: `git worktree remove <path>`
8. Delete branch: `git branch -D feat/wizard-r2-r5-polish`
9. Surface in chat: `Phase 7 complete. #<N> placeholders filled at <sha>. Worktree + branch cleaned.`

---

## What success looks like

After this PR merges:

1. Screen readers reliably announce both polite and assertive wizard save states (R2)
2. Users with `prefers-reduced-motion` no longer see the indicator pulse (R3)
3. Rapid-tapping Retry can no longer double-fire saves or double-increment failure counters (R4)
4. Brief intermittent save failures stay visible for at least 8 seconds, surfacing flaky patterns the user can act on (R5)
5. `docs/FOLLOW_UPS.md` "Wizard polish (post-pilot)" section is fully closed
6. Tier 2 refinement queue advances; next item up per FOLLOW_UPS.md becomes the natural next dispatch

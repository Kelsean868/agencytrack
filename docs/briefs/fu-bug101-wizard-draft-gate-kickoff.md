# FU BUG-101 — Wizard step screen loses input before draft loads

## Problem (source-confirmed by prior audit, anchor to re-verify)
The multi-step wizard's step screen is interactive BEFORE the async draft check
resolves. A user can type a value that commits, then sees it silently revert
~2s later when the late draft merge lands. On an already-submitted week, the
step screen accepts input for ~1s before the "Already submitted" interstitial
discards it. On field agents' mobile connections this is multi-second data loss
on every wizard open.

Root cause (per audit): the step screen is ungated while the Confirm screen
already has a `draftLoaded` gate. Reported anchor: WizardForm.jsx around line
297 (late draft merge). The step screen needs the same gate the Confirm screen
already uses.

## Phase 0 — Falsification gate (confirm before building)
1. grep the wizard component(s) for the draft-load/merge logic and the existing
   `draftLoaded` (or equivalently-named) gate on the Confirm screen. Confirm the
   exact file path, the current line, and the gate variable's real name.
2. Confirm the STEP screen renders/accepts input without waiting on that same
   gate. If the step screen already gates on it, STOP and report — the bug is
   elsewhere and the fix below is wrong.
3. Reproduce: open the wizard on a fresh week, type into a step field, observe
   whether the value survives the draft merge. Then repeat on an already-
   submitted week. Capture the before-state. (Note: the prior audit's harness
   had a step-filler selector bug and could not persist real text — so this
   repro is the first true confirmation. If you cannot reproduce the loss,
   STOP and report; do not apply a fix to an unconfirmed bug.)

## Build
4. Apply the SAME gate the Confirm screen uses to the step screen: do not render
   the editable step inputs (or block their commit) until the draft check has
   resolved. Match the existing pattern exactly — do not invent a new mechanism.
   Prefer a loading state on the step screen while the draft resolves, consistent
   with the app's existing loading treatment, over a blank/frozen screen.
5. Ensure the already-submitted path shows its interstitial WITHOUT a window of
   accept-then-discard: the user should never be able to type into a screen
   whose input will be thrown away.

## Phase 4 — Docs
6. Update CONTEXT.md and FOLLOW_UPS.md per the size-capped convention (close
   BUG-101). Leave a one-line note on the fix location for audit trail.

## Phase 5 — Commit / push / PR
7. Single branch, one PR. git fetch origin before branching off main.
   Branch: fix/bug101-wizard-draft-gate
   Commit: "fix: gate wizard step input on draft load (BUG-101)"
   Push, open PR, poll for CodeRabbit + Gemini, disposition all comments in a
   table before reporting PR-ready. Do NOT merge or deploy.

## Smoke (non-waivable, subject signed in)
- Fresh week: open wizard, type into a step field, confirm the value SURVIVES
  the draft merge (no revert).
- Already-submitted week: confirm the interstitial appears with no type-then-
  lose window.
- Both themes; desktop + 380px mobile.
- Confirm no regression to the Confirm screen's existing gate behavior.

## Scope guard
Wizard draft-gating only. Do NOT touch the week-number divergence, the day-strip
wrap, or any other audit finding — those are separate briefs. Strike count 0/2.

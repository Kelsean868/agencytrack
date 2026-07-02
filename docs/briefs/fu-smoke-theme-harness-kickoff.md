# FU - Smoke Theme Harness Fix (dark-leg trust repair)

run_model: claude-opus-4-8
size: S (harness change) + an audit whose outcome is unknown - see STOP condition
track: cross-cutting (Track K smokes; harness helper shared repo-wide)
depends_on: none. Triggered by the K10a #769 CodeRabbit finding (setTheme after goto).
rules_change: NONE
data_model_change: NONE
deploy_required: NO

---

## Intent

The smoke harness applies theme via `setTheme` AFTER `page.goto()`. `setTheme` registers an
`addInitScript`, which only takes effect on the NEXT navigation - so the current document
stays on the default (light) theme. Every "axe clean both themes" dark leg in the affected
smokes has therefore been asserting against a LIGHT DOM. This is a HARNESS defect, not a
component defect. It also means we do not currently KNOW whether the dark legs of prior
Track K smokes (K9 #767, K10a #769, and any earlier smokes using the pattern) ever validated.

This FU (1) fixes the helper centrally so theme is applied BEFORE assertions/axe, and
(2) re-runs the affected smokes against PRODUCTION to establish the truth. It is a
trust-repair, not just cleanup.

## STOP condition (read first)

This brief fixes the harness. It does NOT fix component a11y. If a re-run dark leg FAILS
after the harness is corrected, that is a REAL a11y regression on already-merged code -
CC STOPS, reports the failing surface + the axe violation verbatim, and does NOT attempt to
fix the component here. A component a11y fix is a separate dispatch. Keep this PR to the
harness change + the re-run evidence.

---

## Phase 0 - Falsification (verify the defect before fixing)

0.1 Locate the shared helper. From #769's report the harness is
  `scripts/verification/walk-helpers.mjs` with a `setTheme` (or equivalent) helper and a
  `waitForLoaded` contract (`[data-testid][data-loading="false"]`). Confirm path + the exact
  `setTheme` implementation. Cite the line where it registers `addInitScript`.
0.2 Confirm the ordering defect concretely: grep the affected smokes for the call sequence
  and show at least one where `setTheme(...)` is called AFTER `page.goto(...)` / after the
  first navigation - i.e. the dark assertion runs on a document that navigated while still
  light. Cite file:line for each affected smoke.
0.3 Enumerate the affected smokes: every smoke that (a) imports the theme helper AND (b)
  claims a dark/both-themes axe leg. At minimum K9 (`smoke-financing-selfview-k9.mjs`) and
  K10a (`smoke-unit-financing-k10a.mjs`); grep for others using the same helper +
  theme-leg pattern across `scripts/verification/`. Produce the full list before fixing -
  the re-run set is defined by this list.
0.4 Confirm how theme is actually represented in the DOM (a `data-theme` attr / a `dark`
  class on `<html>` / a localStorage key read pre-mount in `main.jsx`). The fix must assert
  the ACTUAL applied state, not merely that a script was registered. Cite the mechanism.

Paste evidence for 0.1-0.4 before changing anything.

---

## Phase 1 - The harness fix

Two acceptable shapes - pick the one that fits the helper's structure and say which:
(a) Apply theme BEFORE navigation so the init-script is in place when the document loads
    (move the `setTheme` registration ahead of `goto`, or re-navigate after registering).
(b) After setting theme, ASSERT the applied DOM state took effect (wait for the
    `data-theme`/`dark` signal from 0.4) BEFORE running axe/assertions - so a mis-timed
    theme can never silently pass again.
Prefer doing BOTH: apply-before-nav AND a post-apply assert-the-attribute guard, so the
helper is self-verifying. The guard is the durable protection - it converts a future
mis-ordering from a silent light-DOM pass into a hard failure.

Do NOT change any component. Do NOT change assertion values. This is helper-only, plus the
per-smoke call-site reordering if shape (a) requires touching each smoke's sequence.

---

## Phase 2 - Re-run the affected smokes against PRODUCTION

For EACH smoke in the 0.3 list, run it against the production URL (not a preview - these are
merged surfaces) with the corrected harness. Seed via the existing Admin-SDK fixtures to
`tatillife_smoke` (never `_south`); clean up after (0 orphans, verified).

Report, per smoke, a truth table:
  smoke | light leg (pass/fail) | dark leg NOW (pass/fail) | axe violations if any (verbatim)

Expected outcomes and required handling:
- Dark leg PASSES now -> the surface was fine; the harness was hiding a real pass. Record it.
- Dark leg FAILS now -> STOP condition. Record the surface + verbatim axe violation. Do NOT
  fix the component. This becomes a separate dispatch; note it in the report and bank a
  FOLLOW_UPS entry.

The point of this phase is to convert "we don't know" into a per-surface known state.

---

## Phase 3 - Docs
Update the smoke/verification README or the harness header comment (whichever documents the
theme helper) to state the invariant: theme is applied before nav AND asserted before axe.
Bank any dark-leg failures found in Phase 2 to FOLLOW_UPS.md (one entry per failing surface,
with the axe violation), flagged as merged-code a11y regressions needing their own PR.

---

## Phase 5 - Verification
- Full suite + lint + build green (harness change shouldn't touch unit tests, but confirm).
- The Phase 2 truth table IS the smoke evidence for this PR (Rule 18): attach it to the PR
  body. A harness PR whose own re-runs weren't executed is not PR-ready.
- If shape (a) touched multiple smoke call-sites, confirm each still passes its light leg too
  (reordering must not break the light path).

## Standing reminders
- Rule 19: no rules/functions/money touched -> not the hard human-merge gate, but this
  changes how EVERY future smoke validates, so still HOLD for human review at PR-open.
- Rule 22: >=1 known gap before PR-ready.
- Rule 21: poll Gemini + GLM; disposition each.
- Rule 23 falsifier: the harness guard must be capable of FAILING - demonstrate it (e.g. a
  deliberately mis-ordered call now throws/red-flags instead of silently passing). If you
  can't show the guard failing on a bad input, it isn't a guard.
- Strike 0/2. Build to PR-open and HOLD.

## Self-critique seed (carry into Rule 22)
- If the 0.3 enumeration misses a smoke that uses a DIFFERENT theme mechanism, the trust
  repair is incomplete - state how exhaustively you grepped.
- If a dark leg fails (STOP), the harness PR ships with a known-open a11y regression banked
  but unfixed - make that unmissable in the report, not a footnote.

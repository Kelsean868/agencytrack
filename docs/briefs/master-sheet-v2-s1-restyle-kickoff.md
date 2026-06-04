# Kickoff — Master Sheet v2 S1: reality bar + table chrome (TRUE-RESTYLE)

**Size:** S · **Type:** TRUE-RESTYLE (chrome only — zero data, composition, flow, or
schema change) · **Merge:** GREEN-CHANNEL — auto-merge ONLY if ALL standing gates
self-pass (scope-lock · lint 0 · suite · build · hex-grep · axe NO-NEW vs main · both
themes + §2 screenshot review · §7 self-review · §6 Gemini triage · CI SUCCESS ·
prod-smoke + AUTO-REVERT). Any gate unmet or any doubt → flip to HUMAN-MERGE and hold.
**Branch:** `feat/master-sheet-v2-s1-restyle`
**Layout authority:** the v2 mockup in `design_handoff_v2_app/` (Master Sheet screen).
**Program context:** first daytime re-entry from the Track-J redesign reclassification
(scoping notes item 7; "S1 alone may qualify as a green-channel TRUE-RESTYLE"). This
slice exists to prove the re-entry pipeline on the lightest case.

## Scope — S1 ONLY
IN: the compact reality bar (week · scope · team API / on-pace / exceptions — ALL values
derived from data the shipped table already computes) + the table CHROME restyle (status
pills, mini API bars, spacing, headers, row treatment) per the mockup.
OUT (the mockup shows them; they MUST NOT leak in): column presets · "Show only
exceptions" toggle · the 5-tab coaching drawer · any column add/remove/reorder · any
derivation change · any new client state beyond pure presentation.

## Phase 0 — DIFF-LOCK (Rule 17; the slice's reason to exist)
1. Open the mockup file and the shipped `manager/MasterSheet.jsx`. Enumerate the FULL
   mockup-vs-shipped delta in a table (the scoping-notes claim to verify: 23 columns,
   order, derivations, sticky behavior, horizontal scroll are data-identical).
2. Classify every delta row: CHROME (in scope) vs COMPOSITION/FLOW/DATA (out of scope —
   listed under OUT above or newly discovered).
3. LOCK: if achieving the S1 chrome requires ANY composition/flow/data change beyond the
   reality bar's read-only derives — including new fetches, new props threading new data,
   or touching shared components other surfaces consume — STOP and wait for dispatcher.
   The reality bar derives ONLY from values already computed in/for the table.
4. Verify the smoke credential path: which env key drives the established manager smokes
   (manager-war-smoke / upline-war-browse-smoke pattern) and that Master Sheet is
   reachable for it. If no credential reaches the surface, STOP — do not smoke as the
   wrong role.
5. Shipped-component test baseline: enumerate existing MasterSheet tests; they must stay
   green untouched (chrome-only means testids/data contracts survive; if a test encodes
   chrome being replaced, that's a conscious evolution to flag in the PR, not silent).

## Phase 2 — build
Reality bar + chrome per the mockup · Nexus tokens only (hex-grep enforced) ·
text-ink-muted never text-ink-faint (D5 doctrine) · ≥44px touch targets · both themes ·
stable testids preserved · no inline styles beyond the established dynamic-value
precedent (widths/positions only).

## Phase 3 — gates
Lint 0 · full suite (MasterSheet baseline untouched-green or consciously-evolved with
rationale) · build · hex-grep clean · static-CSS check on any new utilities.

## Smoke (E3, manager credential, both themes)
Login via the Phase-0-verified manager credential → navigate to Master Sheet → assert
reality-bar values CONSISTENT with the table they summarize (compute the same aggregate
from the rendered rows; bar == table-derived value) → column count/order/sticky/scroll
identical to main baseline (assert column headers set matches) → axe NO-NEW
serious/critical vs main · 0 console errors · §2 screenshots both themes reviewed →
read-only surface: no writes, no cleanup beyond session.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: note S1 shipped; S2 (presets) / S3 (exceptions
toggle) / S4 (coaching drawer) remain per the scoping notes, each needing its own brief.

## Auto-merge / auto-revert (green channel)
If ALL gates self-pass: merge per the standing channel, run the prod smoke, AUTO-REVERT
on prod-smoke failure, report either way with Rule 20 SHAs for both the squash and (if
any) the revert. If ANY gate is unmet, ambiguous, or the diff-lock fired: open the PR,
flip to HUMAN-MERGE, report, and hold (Rule 19).

## Acceptance
Diff-lock table in the PR body with every delta classified · zero out-of-scope leakage ·
reality-bar values provably consistent with the table · column set/order/derivations
byte-identical to main · both themes + axe NO-NEW · manager-credential smoke PASS ·
green-channel protocol followed exactly · Rules 12/15/17/18/19/20.

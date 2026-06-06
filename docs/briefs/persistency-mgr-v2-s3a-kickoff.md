# Kickoff — Persistency Manager v2 Slice 3a: What-If Playground (v2 — rewritten on the Item-C findings)

**Version: v2 (2026-06-06) — supersedes any prior S3a text; the dispatch asserts this stamp.**
**Size:** S–M · **Type:** REDESIGN slice, CLIENT-SIDE ONLY — no writes, no rules, no CF
· **Merge:** HUMAN-MERGE + dispatcher pre-review.
**Branch:** `feat/persistency-mgr-v2-s3a`
**Layout authority:** `docs/design/persistency-mgr-v2-s1.html` — the what-if playground
section. Share-as-recommendation (the nudge write + CF allowlist extension) is S3b —
the share affordance is ABSENT here.

## The engine already exists (Item C, 2026-06-06)
`projectPersistency()` (calculations.js:105–133) accepts forward-looking levers on top
of current inputs; `calculateShortfall()` (:155–188) solves per-lever algebraically.
This slice builds UI over that engine — ZERO new math, zero engine edits (the
calculations suite stays untouched-green).

## Locked decisions
- D1 — Reachability: the playground drawer opens from ANY roster row (at-risk rows
  emphasize it) — smokeable in any data state.
- D2 — Levers: the annotation's two primary levers map onto projectPersistency's
  documented params (policies-saved/month → the anticipated-lapse-side param; clean
  API/quarter → the new-business-side param). Phase 0 cites each param's semantics and
  units from the source + its tests; the mapping is whatever the engine documents, never
  an invented transform. The engine's remaining levers are OUT this slice (no advanced
  section, no dead controls).
- D3 — Readout: current vs projected % on the two-tick band (80 floor / 90 gate),
  per the annotation; reset affordance; honest provenance line naming the engine inputs.
- D4 — At-risk policy list takes the DEGRADED ARM (Item C final verdict: 'lapsed'-only,
  no sub-states): a "view her lapsed policies" link to the Policy Ledger. This requires
  adding an `initialFilter` prop to PolicyLedgerPanel (Item C: filter state is internal,
  :99) defaulting to current behavior — additive, cited, with an RTL case proving the
  default path unchanged. The rich sub-state arm is recorded as schema-blocked, not
  stubbed.
- D5 — Optional shortfall hint: IF calculateShortfall drops in cleanly, show the
  per-lever "needed to reach 90" line per the annotation's spirit; if its integration
  exceeds a thin call, ship without it and bank an FU — say which.

## Phase 0 — source-verify (Rule 17)
projectPersistency + calculateShortfall signatures, param semantics, units, and their
existing tests (cite per lever) · the drawer/roster-row wiring point on the S1/S2
surface · PolicyLedgerPanel filter internals for the initialFilter addition · testids ·
data state for the smoke arms.

## Gates
Lint 0 · suite (new RTL: lever-adjustment → displayed projection equals a direct
projectPersistency call on the same inputs, across fixtures; reset; the
PolicyLedgerPanel default-unchanged case; calculations suite untouched-green) · build ·
hex-grep.

## Smoke (E3 — BM credential, both themes, source-aware)
Open playground from a roster row · adjust both levers · the == leg: displayed
projected % equals an independent recompute via the engine on the adjusted inputs
(bearer-token helper from walk-helpers) · the Ledger link lands with the lapsed filter
applied · reset returns to current · axe NO-NEW vs bell badge · 0 console errors ·
screenshots. Read-only.

## Phase 4 — docs
Standard placeholders · FOLLOW_UPS: S3b queued (nudge type 'persistency.recommendation'
slots as a third NUDGE_CONFIG entry per Item C; template vars decision flagged for the
dispatcher) · D5 disposition recorded.

## Acceptance
Projection provably equals the existing engine (RTL + smoke ==) · zero engine/rules/CF/
write changes · initialFilter additive with the default-unchanged proof · annotation-
true drawer both themes · Rules 12/15/17/18/19/20.

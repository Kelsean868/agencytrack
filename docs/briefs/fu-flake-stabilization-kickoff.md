# FU - CI Flake Stabilization (PolicyLedgerPanel F3.1 + CompliancePanel #543)

run_model: claude-fable-5
size: S
track: test hygiene (banked FUs)
rules_change: NONE | data_model_change: NONE | deploy_required: NO
auto_merge_eligible: YES (test-only, under the one-window rubric)

## Intent
Two known async-state race flakes fail CI intermittently on unrelated PRs:
1. PolicyLedgerPanel.test.jsx:504 "F3.1 prefill with planId" - expected '' to be
   'plan-001'; ~2/3 CI failure rate under load, passes locally (banked at #779).
2. The CompliancePanel flake tracked by open PR/FU #543 - same family. Phase 0 must
   read #543's current state: if an open PR already fixes it, do NOT duplicate -
   rebase/adopt or drop it from scope and say so.

## Phase 0
0.1 Reproduce each flake locally under contention (run the file in a loop and/or with
  the full suite + a concurrent build, the条 condition that triggered it at #779). A fix
  for a flake you cannot reproduce is a guess - if irreproducible after honest effort,
  fix by inspection of the async pattern but say so explicitly.
0.2 Read the failing assertions + the component's async state flow. Classify the race:
  missing await/waitFor, un-awaited effect, fake-timer misuse, or fixture race.
0.3 Check #543's PR state (gh) - adopt/dedupe per Intent.

## Phase 2
Fix the TESTS (waitFor/findBy, proper async assertions), not the components - unless the
race reveals a genuine component bug, in which case STOP and surface (a component bug on
the Policy Ledger is money-adjacent and out of this test-only scope).

## Phase 5
Prove stability: run each fixed file 10x consecutively green locally, plus the full suite
once. CI green on the PR. No smoke needed (test-only).

## Standing
Auto-merge permitted under the window rubric ONLY while the diff stays test-files-only.
The moment a src/ component edit becomes necessary -> HOLD. Rule 21 poll + disposition.
Rule 22 >=1 gap. Strike 0/2.

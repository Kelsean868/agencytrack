# FU - Verification-Script Hygiene Batch

run_model: claude-opus-4-8
size: S
track: verification hygiene (banked FUs from #780/#784 backstops + #785 gap)
rules_change: NONE | data_model_change: NONE | deploy_required: NO
channel: HOLD at PR-open (scripts + docs only, but this window runs zero merges)

## Intent
Batch-close the banked verification-script debt in one PR. All items are on
scripts/verification/ files or CLAUDE.md docs - no src/, no runtime code.

ITEM 1 (priority) - #780 backstop: the K10b write-read smoke's cleanup false-positive
  masking (the :192 finding - cleanup can report success while a failed-earlier leg
  left docs behind). Fix so cleanup verification is independent of leg outcomes.
ITEM 2 - #780 backstop: the other 3 Gemini hardening findings on that smoke (read the
  banked FU for the list; implement each or DISAGREE with cited evidence).
ITEM 3 - #784 backstop: the K10c post-deploy smoke pair - (a) the where('email','in')
  query optimization (implement if trivial, else DISAGREE-with-rationale is
  pre-approved given the small-tenant context); (b) the explicit return after leg 2's
  failure (implement - cheap clarity, the banked disposition already accepts it).
ITEM 4 - #785 gap: document the preview-URL 63-char DNS label failure mode in
  CLAUDE.md's preview-URL guidance (branch-alias hostnames over 63 chars do not
  resolve; fall back to the immutable deployment URL from the GitHub deployment
  status). Docs only - do NOT build a walk-helpers auto-fallback here (bank it if
  the doc note feels insufficient).

## Phase 0
0.1 Read each banked FU entry verbatim (FOLLOW_UPS.md) - they carry the finding
  details and prior dispositions. Cite each before fixing.
0.2 Confirm the two smokes' current state on main (they may have drifted since the
  findings were banked).

## Phase 2 + 5
Apply fixes. Verification: lint; re-run BOTH affected smokes end-to-end against
production (tatillife_smoke, seed->run->cleanup, 0 orphans) - a hardening change to a
production-verification script is only proven by the script passing; paste both run
tables. Mark each FU RESOLVED in FOLLOW_UPS.md within this PR (the fix and the
ledger close ride together - these are script FUs, not work-PR fills).

## Standing
Rule 21 poll + disposition. Rule 22 >=1 gap. Rule 23: the ITEM 1 fix must be shown
to FAIL correctly (simulate a leftover doc; cleanup verification must report it).
Strike 0/2. Build to PR-open and HOLD.

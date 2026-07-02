# FU - Financing Display Polish (K10a chip/format + K9 recon-year)

run_model: claude-opus-4-8
size: S
track: K polish (banked FUs from #769 backstop + #767 known gaps)
rules_change: NONE | data_model_change: NONE | deploy_required: NO

## Intent
Three banked display/error-posture fixes across the two financing surfaces, one PR:

FIX 1 - formatAdjustmentPct "-0%" edge (from #769 Rule-21 backstop, CodeRabbit-verified).
  Guard the negative-zero render in src/utils/formatters.js (or wherever the helper landed)
  so an adjustment that rounds to zero never displays "-0%".

FIX 2 - Roster month-chip 1-based alignment (from #769 backstop). The K10a term chip's
  computeMonthsFromDate usage is 0-indexed against the shipped 1-based convention (K9
  self-view + recon panel). Fix the ROSTER to match the shipped convention - do NOT change
  computeMonthsFromDate itself or the K9 consumers. Cross-check: after the fix, a seeded
  agent must show the SAME "month N" on the K10a roster chip and their K9 self-view.

FIX 3 - K9 single recon year (from #767 known gaps). FinancingSelfView probes candidate
  reconciliation years (e.g. 2027/2028), emitting benign console permission-denied on every
  financed-agent load, and leans on a blanket .catch(() => null) that also swallows GENUINE
  read failures as "no recon". Derive the single reconciliation year from effectiveDate
  (mirror how the manager FinancingReconciliationPanel derives it), then narrow the .catch
  to the expected-absent case only. CRITICAL CONTEXT: that .catch is LOAD-BEARING - an
  absent-year GET returns permission-denied under canAccessOwn with a null resource (the
  #767 CodeRabbit DISAGREE). Keep (or add) the inline "do not remove" comment; the narrowing
  must preserve the absent-doc tolerance while no longer masking real failures.

## Phase 0 - Verify (STOP on any miss)
0.1 Locate formatAdjustmentPct + reproduce the -0% case in a unit test first.
0.2 Cite the 1-based convention in shipped code (K9 wind-down clock / recon panel usage of
    computeMonthsFromDate) and the roster's 0-indexed divergence, path:line both.
0.3 Cite the K9 recon-year probe loop + the .catch + the manager panel's year derivation.
0.4 Confirm the existing smokes to reuse: smoke-financing-selfview-k9.mjs and
    smoke-unit-financing-k10a.mjs both exist post-#771 (theme-correct).

## Phase 2 - Build
Apply the three fixes. Unit tests: -0% case; a month-chip fixture asserting roster == K9
convention for the same effectiveDate; a recon-year derivation case (correct year chosen,
absent-doc still tolerated, real error no longer swallowed - assert the distinction).

## Phase 5 - Smoke (reuse, NON-WAIVABLE)
Re-run BOTH existing smokes against the preview:
5.1 K9 smoke green - and assert the console no longer emits recon permission-denied noise
    on the financed-agent load (this is the observable win of FIX 3).
5.2 K10a smoke green - and assert the seeded agent's month chip value matches the 1-based
    expectation (value-level, same seed month as the K9 leg where feasible).
Seed tatillife_smoke, cleanup, 0 orphans.

## Standing
HOLD at PR-open (Rule 19; financing surfaces). Rule 21 poll + disposition. Rule 22 >=1 gap.
Rule 23: the narrowed .catch must be shown to REJECT a non-permission error (falsifier).
Strike 0/2.

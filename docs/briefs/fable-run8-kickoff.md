# Fable Run 8 — Kickoff Brief (~18h unattended, STAGING)

Operator brief, received 2026-07-15 (TT). Orchestrator: Fable 5. Operator ASLEEP — no pings.
LONG window (~18h). Ambiguity → bank to DECISIONS-NEEDED, continue. E1/E2 reserve (last 75 min) mandatory.
Work on `staging` in the `at-fable-staging` worktree; push per item so staging Vercel rebuilds for live smokes.

## Hard constraints

Never touch prod (`agencytrack-2a610`; hygiene legs assert zero prod requests) · never merge to main · seeder always `--env-file=.env.staging` · smokes value-level as owning subject, write-read-verify for mutations, console-clean everywhere · staging Firebase deploys ONLY via `deploy-staging.ps1` · rules changes emulator-first, staging-only, autonomous.

## ABSOLUTE STOPS (do not build, bank if tempted)

- **Policy Reconciliation 8-flag taxonomy** — money-adjacent (manager confirms settled figures vs carrier circular). Operator-locked: ATTENDED only.
- **Any payout-release / owed / paid write path** (campaigns HARD STOP).
- **Anything touching functions/ runtime or the firebase-functions SDK** (Node 20 migration is its own attended window).
- **Any NEW cross-tenant / multi-tenancy security change without emulator proof** (the SEC-9b isolation audit is a separate scoped job — do not freelance it).

## Run plan

**0.1** These docs. **0.2** Baseline: re-seed (env-file) + full VH suite (~44 legs; the t1-compliance-scope SKIP is expected per the documented seed gap). Non-flake failure → investigate; unresolved after 60 min → restrict to Tier A only. First run after the week-rollover seeder residue fix (Run 7) — if a baseline failure looks date/rollover-related, check the residue sweep ran before deep-diving.

### PHASE 0 — SELECT FROM THE CURRENT BUILD MAP (Opus floor; NEVER DROPPED)

Active build map: `docs/audits/design-conformance-2026-07-12.md` (validity `e65fe143` + correction `23e6c67e`) + the RANKED NEXT-LIST in `docs/fable-run7-progress.md`. Read BOTH. Re-verify candidate items against current HEAD before selecting (Rule 17 — grep-confirm each pick still STILL-VALID).

SELECT the highest-value items that: (a) need NO operator ruling, (b) are not on ABSOLUTE STOPS, (c) touch no money/payout path, (d) buildable AND live-smokable within the window with the reserve intact. Priority: reliability/correctness > user-visible capability > cosmetic. Explicitly SKIP anything whose scope cannot be bounded confidently unattended.

Write the selection — with reasoning and rejections — into the progress doc BEFORE building. This is the run's central judgment call; reviewable at E2.

### TIER A — selected build items (per Phase 0)

Build in stated priority order, per-item live-smoke, per-item commit. Bank anything unboundable. Rules-change items: emulator-first, deploy-staging.ps1, autonomous.

### TIER B — seed-model hardening (Sonnet; natural-gap fill)

t1-compliance-scope SKIPs because staging seeds one unit_manager per branch. If taken: add the 2nd-UM fixture AND update every affected leg's expectations in the SAME change, re-run the FULL suite, treat the newly-activated t1-compliance-scope full path as a shakedown. Cannot do it cleanly → DO NOT half-seed; bank and leave the SKIP.

### Routing

Opus 4.8 floor: Phase-0 selection, any rules change, any correctness-critical build. Sonnet 4.6 elsewhere. No Haiku. Two-strike escalation one tier up, noted in telemetry. Per-part model choice in the E2 table.

### Run end (last 75 min, mandatory)

**E1** re-seed + full VH suite (all legs + new). NO-REGRESSIONS GATE: every pre-existing leg green (documented SKIP expected). Regression → REVERT the offending item (revert-over-debug in the reserve). **E2** progress doc: final smoke table, per-part telemetry, SHAs, Phase-0 rationale, DECISIONS-NEEDED, ranked next-list, morning handoff; commit + push; verbatim `git log origin/staging --oneline -1` in the run-close report. **E3** HOLD.

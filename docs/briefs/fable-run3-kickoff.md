# Fable Run 3 — Overnight Autonomous Staging Run (2026-07-09 → 2026-07-10)

Orchestrator: Fable 5. 12-hour window, operator asleep, zero operator gates.
Workspace: `C:\Projects\at-fable-staging` (branch `staging`, start HEAD `ef5e97c3`).
Staging Vercel auto-deploys on push; bypass via `VERCEL_BYPASS_TOKEN` in `.env.staging`.

## Hard constraints (violation = stop item, bank, continue)

1. **NEVER touch prod** (`agencytrack-2a610`): no deploys, no writes. Hygiene legs assert ZERO prod requests. Staging Firebase deploys ONLY via `scripts/staging/deploy-staging.ps1`.
2. **NEVER merge to main.** R1 ends at PR-open-and-HOLD.
3. **NEVER build payout-release logic** (campaigns HARD STOP).
4. **Goals v3 OUT OF SCOPE** (operator gate not cleared: persistency agent-hero thread + recommend-vs-lock unlanded). Bank observations only.
5. Every seeder invocation uses `--env-file=.env.staging` (H1 hardens the foot-gun).
6. Smokes: value-level assertions as owning subject; write-read-verify for mutations; console-clean + zero-prod-requests every leg.
7. Ambiguous design/product decision → bank to DECISIONS-NEEDED, skip, continue. No guessing.

## Run plan

- **0.1** Commit this brief + `docs/fable-run3-progress.md` to staging.
- **0.2** H1 FIRST (Sonnet): seed-fixtures.mjs env-guard — exit nonzero naming the var + `--env-file` requirement BEFORE any mutation. Red-verify both directions.
- **0.3** Baseline: re-seed (env-file) + full VH suite. Expect 33/33 (single `t2-financing-k9-k7` first-paint flake tolerated — H2 fixes it). Any OTHER failure: investigate ≤60 min; unresolved → restrict night to Tier H + R1.

### Tier H (Sonnet) — never dropped
- **H2** Harden `t2-financing-k9-k7`: await K7 roster row (not first paint); attach page to throws so FAILs screenshot. 3× consecutive pass.
- **H3** MasterSheet.jsx: collapse contactsMade + personsReached display columns → one "Persons Reached" column (operator-approved). Display-only. Tests updated.
- **H4** jointCalls index reconcile: find `(authorUid ASC, appointmentDate ASC)` query in src/; if live, additive composite in firestore.indexes.json. Staging deploy via deploy-staging.ps1 only if staging lacks it. No prod deploy.
- **H5** `out/` gitignore coverage. *(Recon: already covered at .gitignore:147 — verify + bank.)*

### Tier R (Opus) — never dropped
- **R1** Rebase `chore/tier0-smoke` onto origin/main (3 real commits; ~264 phantom conflicts). Conflict rule: file not genuinely modified by branch → keep main. GATE: `git diff origin/main...HEAD` shows ONLY smoke file + fixes + one SMOKES.md row. Gate fail → ONE cherry-pick fallback onto fresh branch, same gate. Both fail → abort, bank, no push. Pass → push --force-with-lease, open PR to main "test(verification): Tier-0 staging smoke (rebased)", **HOLD**.

### Tier F (Opus subagents, deepest-recon-first)
Design authority: docs/design-system tokens/rules + redesign-addendum; screens-v2 mockups for intent. No gradient buttons, 44px targets, loading/error/empty, writes via services, parseFloat on numeric writes. Per-item live smoke on staging deploy.
- **F1–F7** [C3/C4 outrank; heroes individually droppable]: 7 MISSING heroes per `docs/audits/hero-card-conformance-2026-07-09.md` — conform to shipped hero pattern (count-up, reduced-motion snap, presentation tokens on always-dark surfaces).
- **F8** [droppable]: pinned-tab de-emphasis — reduce SIZE and CONTRAST of star/pin icon on pinned tabs only; AA floor both themes; smoke asserts reduced treatment + unpinned unchanged.
- **F9** [protected, C3]: WAR reviewStatus pill (+reviewer name, note affordance) on owner's my-war view. Read-only surface of existing fields; no rules change. Extend WAR VH leg.
- **F10** [protected, C4]: streak milestones — thresholds from banked ruling/existing celebrations code, else operator defaults 5/10/25/52 weeks. Via celebrations/celebrationPrefs; one-time fire; prefers-reduced-motion. Smoke: fires at threshold, absent below, absent on reload.
- **F11** [Planner spine, bounded]:
  - **F11a** [protected] RECON read-only, line-cited → `docs/audits/planner-spine-recon-2026-07-10.md`.
  - **F11b** [droppable] CONTRACT slice 1 only, AGENT-SIDE vertical (recurrence/edit on own appointments). Rules/index: emulator tests first, deploy-staging.ps1, live verify. Ambiguity → DECISIONS-NEEDED, stop tier.
  - **F11c** [droppable] Slice 1 build + smoke ONLY if F11a/b unambiguous AND 2+ h before reserve.

### Run end (mandatory reserve, last 60–90 min)
- **E1** Re-seed + full VH suite (incl. legs extended tonight). Every pre-existing leg green; regression → REVERT offending item's commits (operator-locked).
- **E2** Update progress doc: final smoke table, per-item telemetry + SHAs, DECISIONS-NEEDED, morning handoff. Commit + push staging; verbatim `git log origin/staging --oneline -1` in the doc.
- **E3** HOLD. No merges, no prod, nothing further.

Depth-first: fewer items fully built + value-level smoked beats many items rough.

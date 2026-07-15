# Fable Run 7 — Kickoff Brief (~5h unattended, STAGING)

Operator brief, received 2026-07-12 (TT). Orchestrator: Fable 5. Operator ASLEEP — no pings.
SHORT window. Ambiguity → bank to DECISIONS-NEEDED, continue. E1/E2 reserve (last 45 min) mandatory.
Work on `staging` in the `at-fable-staging` worktree; push per item for staging Vercel rebuilds.

## Hard constraints

Never touch prod (`agencytrack-2a610`; hygiene legs assert zero prod requests) · never merge to main · seeder always `--env-file=.env.staging` · smokes value-level as owning subject, write-read-verify for mutations, console-clean · staging Firebase deploys ONLY via `deploy-staging.ps1` · rules changes emulator-first, staging-only, autonomous.

## ABSOLUTE STOPS (bank if tempted)

- **Policy Reconciliation 8-flag taxonomy** — money-adjacent; operator-locked to an attended session.
- **Any payout-release / owed / paid write path** (campaigns HARD STOP stands).
- **Anything touching functions/ runtime or the firebase-functions SDK** (Node 20 migration = its own attended window).

## Run plan

**0.1** These docs. **0.2** Baseline: re-seed + full VH suite (44 legs; 1 expected SKIP `t1-compliance-scope`). Non-flake failure unresolved after 45 min → restrict run to TIER A only.

### TIER A — operator rulings on Run 6 DECISIONS-NEEDED (locked; NEVER DROPPED)

- **A1 (Opus floor — data integrity):** `WizardForm.jsx:301` draft-load swallow → SURFACE. Operator's model: Firestore getDoc only THROWS on real failure (absent doc = `.exists()===false`, already handled), so the catch can only fire on genuine failure — a FAILURE swallow. **Rule 17: CONFIRM the actual code path first** (a service wrapper may already convert throws to null); if the shape differs, bank, do NOT build blind. If confirmed: absent → fresh wizard (unchanged); FAILURE → "Couldn't load your saved draft — Retry" and BLOCK the path that would overwrite the unread draft. Tests: absent→fresh/no error; throw→error+Retry+submit guarded; retry success→draft loads.
- **A2 (same file, folded into A1 dispatch):** `WizardForm.jsx:342` opaque `.catch(()=>{})` — IDENTIFY what it guards, then FAILURE→surface / absent-means-X→keep. Unidentifiable → KEEP + bank. Report which it was.
- **A3 (Sonnet):** `KioskShell.jsx:69` INITIAL-load failure → minimal quiet "reconnecting" indicator (broadcast surface — NOT a full error card). Refresh-failure behavior unchanged (stale-beats-error stands).
- **A4 (Sonnet):** `JointCallsTab.jsx:343` → align with sibling `:332` (sets state). Drift, not design.
- **A5 (Sonnet):** CompliancePanel CBTT section — operator OVERRULES "leave unscoped": either EXTEND the ScopeSwitch filter to CBTT, or if it is genuinely tenant-level, label it "(all units)" explicitly. Never silently ignore the scope. Report the choice + why.
- Ruled NO-WORK: `DailyCaptureV2.jsx:644` KEEP as-is · §5 RankedLeaderboard ruling CONFIRMED.

### TIER B — next slice of the active build map (`docs/audits/design-conformance-2026-07-12.md`)

B1 select from the ~24 STILL-VALID findings: no-ruling-needed, not on STOPS, no money path, buildable + live-smokable within window with reserve intact. Reliability/correctness > user-visible capability > cosmetic. B2 write selection + rejections to progress doc BEFORE building. B3 build, per-item smoke, per-item commit. Bank the rest + ranked next-list.

### Drop order

Tier A never dropped → Tier B in stated priority order (bottom-up) → E1/E2 reserve never dropped.

### Routing

Opus 4.8 floor: A1, Tier B selection, any rules change. Sonnet 4.6 elsewhere. No Haiku. Two-strike escalation one tier up, in telemetry.

### Run end (last 45 min)

**E1** re-seed + full suite (44 + new legs); no-regressions gate (1 documented SKIP expected); regression → REVERT offending item. **E2** final doc: table, telemetry, SHAs, A1/A2/A5 code-vs-operator-model findings, DECISIONS-NEEDED, ranked next-list, handoff; commit + push; verbatim origin line in run-close report. **E3** HOLD.

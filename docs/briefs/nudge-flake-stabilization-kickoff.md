# Brief: CompliancePanel.nudge flake — diagnose, then stabilize (attempt 2)

## Problem

`src/components/manager/__tests__/CompliancePanel.nudge.test.jsx` fails intermittently
in CI: `TestingLibraryElementError` on `[data-testid="compliance-cooldown-chip"]` after
the single-Nudge CF call. 5 recorded CI occurrences; latest 2026-06-07 on PR #538
(config-only diff). A prior test-only fix (Cleanup Duo brief, ITEM 1, auto-merged)
did not hold — CONTEXT.md records RE-OPENED, stabilization incomplete. Blind fixing
has already failed once; this attempt is evidence-first.

## Scope

- **IN:** the test file; test setup/utilities it uses; `CompliancePanel.jsx` ONLY if
  diagnosis proves a genuine component race or non-injectable clock (behavior-identical
  change, flagged explicitly in the report)
- **OUT (hard line, findings-only):** `sendComplianceNudge` CF, `firestore.rules`,
  notifications/nudges schema, `NUDGE_CONFIG` values

## Decisions locked

- Evidence-first: Phase 1 is DIAGNOSIS ONLY — no fixes until verdict is reported and
  dispatcher clears Phase 2
- NOT-REPRODUCED after the full ladder → no code change; hold for dispatcher
- NOT auto-merge eligible regardless of CI result — human merge required per brief

## Phase 1 — DIAGNOSIS ONLY, then HARD STOP

No fixes in this phase. Produce evidence for a verdict.

**P1.1 — Prior-attempt autopsy:** locate the Cleanup Duo brief + its PR/squash SHA.
Summarize exactly what the previous fix changed and the assumption it encoded.
The new fix must address why that assumption failed.

**P1.2 — Source read:** in the current test + `CompliancePanel.jsx`, map the full
render path of the cooldown chip — what state/data gates it (CF mock resolution?
a nudges/notifications doc timestamp? cooldown window computed from
`Date.now`/`NUDGE_CONFIG`?). Enumerate every async boundary, timer, and date
computation on that path. Capture whether the test uses `getBy` vs `findBy`/
`waitFor`, fake vs real timers, and how the CF is mocked.

**P1.3 — CI forensics:** via `gh`, pull the 5 failing runs — UTC timestamps, runner,
whether the failing assertion is identical each time. Explicitly test the
clustering hypothesis: do failures fall in 00:00–04:00 UTC (the TT prior-day window)?
Table in the report.

**P1.4 — Local reproduction ladder** (PowerShell loops, no `&&`; record run counts):
- (a) Isolated: 200× the single test file, `--runInBand`
- (b) Pollution check: 20× full suite (flake may need neighbors)
- (c) CI parity: repeat (a) with `TZ=UTC` set for the process — the local box
  runs `America/Port_of_Spain`; CI runs UTC
- (d) CI flags parity: match the workflow's worker/ci flags

**P1.5 — Verdict** — one of:

| Verdict | Meaning |
|---|---|
| `TIMING-RACE` | Async/microtask ordering race in the test's render cycle |
| `TIMEZONE-BOUNDARY` | Cooldown window or date computation crosses TT/UTC midnight boundary |
| `TEST-POLLUTION` | Neighbor test leaves shared state that causes this test to fail |
| `ENV-PARITY` | CI worker constraint (thread count / memory / env var) not matched locally |
| `NOT-REPRODUCED` | Full ladder ran; no failure observed |

Verdict must include supporting evidence inline (run counts, timestamps, stack trace
excerpts, the specific line that races or fails).

**HARD STOP after P1.5.** Report verdict to dispatcher; wait for clearance before Phase 2.

## Phase 2 — Fix (after dispatcher clearance, per verdict)

- Prefer test-only: `findBy`/`waitFor` discipline (PR #210 pattern), deterministic
  clock injection, properly awaited CF mock, isolation of polluted state.
- `TIMEZONE-BOUNDARY` verdict → the fix must pin the test clock to BOTH a safe time
  AND a hostile time (inside the UTC/TT boundary window) and pass at both.
- Component change only per Scope, behavior-identical, explicitly flagged.
- `NOT-REPRODUCED` after the full ladder → no code change; report and hold — do not
  ship a speculative fix.

## Phase 3 — Proof of stability

- 200× isolated green, 20× full-suite green, both under `TZ=UTC`
- If timezone verdict: hostile-window clock run green
- CI green on the PR branch
- If `CompliancePanel.jsx` was touched: standard preview smoke of the nudge flow
  with the test agent, write-surface discipline (capture/write/verify/restore;
  Admin SDK restore for created notification docs)

## Phase 4 — Docs

CONTEXT.md + FOLLOW_UPS.md with `#TBD` placeholders. FOLLOW_UPS flake entry: do
**NOT** close — mark "stabilized (attempt 2, PR #TBD) — PROBATION: close after 14
days or next 10 CI runs green, whichever later." Commit, push, PR.

## Phase 5

NOT auto-merge eligible. HOLD for dispatcher review of the Phase 1 verdict trail
in the PR description, then Kyron merge.

## Acceptance criteria

- Phase 1 report present with verdict + evidence (including the prior-attempt
  autopsy and the UTC-clustering table)
- Fix demonstrably tied to the verdict, not adjacent to it
- Full Phase 3 proof matrix green (200× isolated + 20× full-suite + both `TZ=UTC`)
- CF / rules / schema untouched
- Probation entry recorded in FOLLOW_UPS.md, not closure

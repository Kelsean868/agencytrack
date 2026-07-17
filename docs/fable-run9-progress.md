# Fable Run 9 — progress (Planner/Scheduler v2 enhancements, staging)

| Field | Value |
|---|---|
| Run | 9 (unattended, staging) |
| Kickoff brief | `docs/briefs/fable-run9-kickoff.md` |
| Start HEAD | `d5158968` |
| Current phase | **A2 keyboard shortcuts** |

## Item table

| Item | Status | Commit | Live smoke | Notes |
|---|---|---|---|---|
| 0.1 run docs | DONE | `19ffeef6` | n/a | |
| 0.2 baseline | DONE | n/a | **44 PASS / 0 FAIL / 0 SKIP** | seed 93 docs; kiosk now PASS |
| A1 undo/redo | DONE | `4aab6bef` | 4/4 PASS (`smoke-run9-a1-undo.mjs`) | emulator 33/33; rules deployed (-Only rules); toast + hard-delete + prior-value restore verified live |
| A2 keyboard shortcuts | pending | — | — | |
| A3 conflict detection | pending | — | — | |
| A4 templates | pending | — | — | new collection + rules arm |
| A5 bulk operations | pending | — | — | |
| F3a seriesId at creation | pending | — | — | ALREADY SHIPPED — verify+smoke only (see brief §Rule-17) |
| F3b reschedule update-in-place | pending | — | — | current = rebook+tombstone, not delete+create (see brief) |
| F3c composite index | pending | — | — | verify query shape first |
| F3d propagation UI + batch | pending | — | — | |
| F3e series smoke | pending | — | — | |
| E1 regression gate | pending | — | — | reserve, mandatory |
| E2 final doc | pending | — | — | |

## DECISIONS-NEEDED (banked for operator)

1. **Design-source gap:** the six features are NOT in `docs/design-system/proposals/planner-scheduler-v2/` mockups (those specify a different five: multi-day views, drag-drop, running-late, notes, rail adaptation). Run built to the run-prompt specs. If the five-feature package is also wanted, it needs its own run.
2. **R4 premise correction:** shipped reschedule was rebook+tombstone (`postponeWithRebook`), not delete+create. Implemented R4's intent: Reschedule = update-in-place same doc; Postpone unchanged (tombstone grammar is its designed meaning). Confirm Postpone staying rebook-style is intended.
3. **R5 premise correction:** no single hard-delete existed at HEAD (`allow delete: if false`). Hard delete introduced ONLY as A1's undo-create inverse, owner-scoped rules arm. Flag at promotion review.
4. **Series propagation excludes `date`:** propagating a date edit would collapse all instances onto one day. "This and future"/"all" propagate startTime/durationMin/type/note/prospectId/freeBlockLabel/apiAmount; date edits are this-only (Reschedule handles moves). (Follows from R1/R2's "standard calendar semantics" but not explicitly ruled.)

## Telemetry

| Part | Model | Start | End | Duration | Outcome |
|---|---|---|---|---|---|
| recon + docs | fable (orchestrator) | 2026-07-16 | — | — | — |

## Log

- **2026-07-16:** Run 9 start. Staging worktree `C:/Projects/at-fable-staging` verified (branch `staging`, HEAD `d5158968`, `.env.staging` present, staging SA key path per vh/admin-read). Rule-17 premise sweep done (4 corrections banked, see brief). Task list created.

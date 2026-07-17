# Fable Run 9 — progress (Planner/Scheduler v2 enhancements, staging)

| Field | Value |
|---|---|
| Run | 9 (unattended, staging) |
| Kickoff brief | `docs/briefs/fable-run9-kickoff.md` |
| Start HEAD | `d5158968` |
| Current phase | **E1 run-end regression gate** |

## Item table

| Item | Status | Commit | Live smoke | Notes |
|---|---|---|---|---|
| 0.1 run docs | DONE | `19ffeef6` | n/a | |
| 0.2 baseline | DONE | n/a | **44 PASS / 0 FAIL / 0 SKIP** | seed 93 docs; kiosk now PASS |
| A1 undo/redo | DONE | `4aab6bef` | 4/4 PASS (`smoke-run9-a1-undo.mjs`) | emulator 33/33; rules deployed (-Only rules); toast + hard-delete + prior-value restore verified live |
| A2 keyboard shortcuts | DONE | `28d4a432` | 9/9 PASS (`smoke-run9-a2-shortcuts.mjs`) | map: n/?/arrows/e + reference sheet; A1 handler extended, no ⌘K collision |
| A3 conflict detection | DONE | `0b2d70bd` | 8/8 PASS (`smoke-run9-a3-conflicts.mjs`) | client-only; R7 warn-never-block verified live (save enabled with warning showing) |
| A4 templates | DONE | `c8c3f553`+`7d88092f` | 9/9 PASS (`smoke-run9-a4-templates.mjs`) | emulator 24/24 (incl. orchestrator hijack-fence fix on update arm) + appointments 33/33 regression; rules deployed; owner-only isolation verified live as agent2 |
| A5 bulk operations | DONE | `74553eb1` | 7/7 PASS (`smoke-run9-a5-bulk.mjs`) | admin-read value-level: soft-delete R5 + undo-restore + move-in-place verified in Firestore; R6 chunking unit-proven (400/450 split, partial-failure throw) |
| F3a seriesId at creation | DONE (verify) | `0041a66e` | covered by F3e | stamping + rules cites confirmed; NO backfill anywhere (R3); existing test covers shared seriesId |
| F3b reschedule update-in-place | DONE | `0041a66e` | 3/3 planner VH legs PASS post-deploy | reschedule split from postpone; same-doc update, series metadata survives via allowlist; postpone byte-for-byte unchanged |
| F3c composite index | DONE | `045434ef` | leg0 PASS (index serves) | (agentId ASC, seriesId ASC, date ASC) additive; deployed -Only indexes |
| F3d propagation UI + batch | DONE | `045434ef` | see F3e | 3-way chooser live; scheduled/confirmed-only targets; date never propagates; bulk-undo integrated |
| F3e series smoke | DONE | (this commit) | **14/14 PASS** (`smoke-run9-f3e-series.mjs`) | R1+R2+R4 proven value-level vs cross-week admin-seeded series; undo of reschedule verified |
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

- **2026-07-16 (cont.):** A3 smoke surfaced two staging-data traps, both banked: (1) `seed-fixtures --apply` does NOT sweep non-fixture appointment residue — added `scripts/staging/sweep-nonfixture-appointments.mjs` (dual staging guard, dry-run default); (2) sheet default durationMin=30, so :00/:30 pairs only TOUCH under half-open semantics — overlap smokes must offset <30min. Neither was a product defect.

- **2026-07-17:** Tier A COMPLETE (A1-A5 all live-verified). A5 builder hit one transient API ENOTFOUND mid-read (no edits lost; resumed clean — infrastructure note, not a strike against the build). A5 flagged a pre-existing A2 stale-closure flake risk in the panel keydown handler under test load — banked as follow-up, watch in E1. Entering F3 (fenced): dispatch order F3a+F3b (verify + reschedule-in-place), then F3c+F3d (index + propagation), F3e smoke last.

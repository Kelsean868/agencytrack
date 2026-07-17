# Fable Run 9 — Planner/Scheduler v2 enhancements (staging, unattended)

**Run start:** 2026-07-16 · **Branch:** `staging` · **Start HEAD:** `d5158968` · **Orchestrator:** Fable 5 · **Operator:** asleep (no pings; ambiguity banks to DECISIONS-NEEDED and continues, EXCEPT feature-3 semantics pre-ruled below).

## Scope — six features on the shipped appointments Planner

| # | Item | Model | Firestore surface |
|---|------|-------|-------------------|
| A1 | Undo/Redo (20-step, Cmd+Z/Y, toast per action, real service-call inverses) | Sonnet | possible NEW `allow delete` owner arm (undo-create inverse) |
| A2 | Keyboard shortcuts (N new, arrows navigate, ? sheet; no ⌘K collision) | Sonnet | none |
| A3 | Conflict detection (overlap warn-badge + sheet warning; R7 warn-only) | Sonnet | none |
| A4 | Templates (`appointmentTemplates`, save/apply) | Opus (rules) + Sonnet (UI) | NEW collection + rules arm |
| A5 | Bulk operations (multi-select move/reschedule/soft-delete) | Opus | existing CRUD only |
| F3 | Series edit propagation (this / this-and-future / all) | Opus 4.8, LAST, fenced | batch updates + composite index |

## OPERATOR-LOCKED RULINGS (2026-07-13 — build to these, do not re-open)

> R1. "Edit all" = current + future instances ONLY. Past instances are historical record, never rewritten.
> R2. "All" overwrites prior per-instance edits; "this-and-future" preserves earlier instances. Standard calendar semantics.
> R3. NO seriesId backfill. Existing unlinked recurring docs stay single-instance-editable. seriesId applies to newly created series only.
> R4. Reschedule MUST become update-in-place (the current DELETE+CREATE anti-pattern destroys doc identity and would break series linkage — recon §7-b). This is a REQUIRED feature-3 sub-item and it modifies a live shipped path: regression-test the existing single-appointment reschedule thoroughly.
> R5. Bulk delete = soft-delete (status='cancelled'). Single-delete stays HARD delete this run — do not ripple the delete model app-wide.
> R6. Bulk across multiple series: chunk batches ≤500 writes transparently; if a bulk op exceeds 200 appointments, warn + require confirmation. NEVER silently partial-apply.
> R7. Conflict detection WARNS, never blocks. Double-booking is sometimes intentional; surface it, let the agent proceed.

## Rule-17 premise verification at start HEAD (`d5158968`) — corrections, not re-litigations

1. **F3a is ALREADY SHIPPED.** `createRecurringAppointments` (`src/services/plannerService.js:148-176`) mints `seriesId` and stamps `seriesId/repeatRule/seriesPos/seriesTotal` on every instance in one `writeBatch`. The run brief's "the create path never set it" is stale (it described the pre-Run-4 state). F3a executes as **verify + smoke** only.
2. **R4's mechanism description is stale but its intent is implementable.** Current reschedule is NOT delete+create — it is `postponeWithRebook` (`plannerService.js:217-224`): create NEW doc, flip original to `status:'postponed'` + `rescheduledToId`. No delete exists anywhere (`firestore.rules` appointments arm ends `allow delete: if false`). The functional problem R4 names is real: the appointment's identity migrates to a new doc and the rebooked instance detaches from its series (`AgentPlannerPanel.jsx:268-270` — "series metadata is intentionally not carried forward"). **Implementation of R4's intent:** churn **Reschedule** becomes `updateAppointment` on the SAME doc (identity + series link preserved); **Postpone** keeps the rebook+tombstone grammar (that's its designed meaning).
3. **R5's "single-delete stays HARD delete" premise:** no single-delete path exists at HEAD (rules `allow delete: if false`; no service delete). This run introduces hard delete ONLY as A1's undo-create inverse (owner-scoped rules arm, emulator-first). No delete affordance is added to the UI outside undo.
4. **Edit-in-place + series scope sheet are shipped.** ChurnDialog has an Edit action; `SeriesEditChoice.jsx` ships with "this only" live and "this and all future" disabled, its docstring naming the exact banked composite-index dependency this run closes.
5. **The proposals folder (`docs/design-system/proposals/planner-scheduler-v2/`) does NOT contain these six features** — its README/mockups specify a different five (desktop multi-day views, drag-drop, running-late cascade, notes thread, rail adaptation). Grep-verified: no undo/template/conflict/bulk/shortcut content in any mockup jsx. **The run prompt's per-item specs are the acceptance criteria for this run.** Banked to DECISIONS-NEEDED (design-source gap, not a blocker).
6. **Recurrence controls exist in create mode only** — no cadence edit anywhere (consistent with the no-delete model); F3d propagates FIELD edits, never cadence.

## Constraints (standing)

- Never touch prod (`agencytrack-2a610`) — hygiene legs assert zero prod requests. Never merge to main.
- Seeder always `--env-file=.env.staging`. Smokes value-level as owning subject; write-read-verify for mutations; console-clean everywhere.
- Staging deploys ONLY via `scripts/staging/deploy-staging.ps1` (`-Only rules` / `-Only indexes`); never functions. Emulator tests FIRST for rules/index changes, then staging deploy, then live verify.
- No `functions/` runtime changes. No payout paths.

## Build order & drop order

Build: 0.1 docs → 0.2 baseline (seed + full VH suite) → A1 → A2 → A3 → A4 → A5 → F3a-e → E1 regression gate → E2 final doc → E3 HOLD.
Drop (bottom-first): F3d/e → F3a-c → A5 → A4 → A3 → never A1/A2 or the reserve. If F3 dropped, ship F3a+F3b alone if built.

## Subagent routing

Opus floor: A4 rules arm, A5, all F3. Sonnet: A1/A2/A3, UI shells, tests. No Haiku. Two-strike escalation; per-part telemetry in the progress doc.

# Fable Run 9 — FINAL (Planner/Scheduler v2 enhancements, staging)

| Field | Value |
|---|---|
| Run | 9 (unattended, staging) |
| Kickoff brief | `docs/briefs/fable-run9-kickoff.md` |
| Start HEAD | `d5158968` · Final HEAD: see § Handoff |
| Status | **RUN COMPLETE — all 6 features built + live-verified. E1 gate: 44/44 VH + 6/6 item smokes, zero regressions. HOLDING (E3).** |

## Final item table

| Item | Status | Commit(s) | Live smoke | Notes |
|---|---|---|---|---|
| 0.1 run docs | DONE | `19ffeef6` | n/a | |
| 0.2 baseline | DONE | n/a | 44/44 PASS | seed 93 docs |
| A1 undo/redo | DONE | `4aab6bef` | 4/4 (`smoke-run9-a1-undo.mjs`) | 20-step history; service-call inverses; NEW owner-delete rules arm (emulator 33/33, deployed); hard-delete persistence + prior-value restore proven live |
| A2 keyboard shortcuts | DONE | `28d4a432` | 9/9 (`smoke-run9-a2-shortcuts.mjs`) | n / ? / ←→ views / ↑↓ roving / e edit + reference sheet; no ⌘K collision; form-field + dialog guards |
| A3 conflict detection | DONE | `0b2d70bd` | 8/8 (`smoke-run9-a3-conflicts.mjs`) | client-only; R7 warn-never-block proven live (save enabled while warning showed) |
| A4 templates | DONE | `c8c3f553` + `7d88092f` | 9/9 (`smoke-run9-a4-templates.mjs`) | NEW `appointmentTemplates` collection + owner-scoped hasOnly rules arm; emulator 24/24 incl. orchestrator hijack-fence fix; owner-isolation proven live as agent2 |
| A5 bulk operations | DONE | `74553eb1` | 7/7 (`smoke-run9-a5-bulk.mjs`) | multi-select + shift-range; bulk move/cancel; R5 soft-delete + R6 400-chunk/200-cap proven (unit) + Firestore value-level soft-delete/undo/move-in-place proven live (admin-read) |
| F3a seriesId at creation | DONE (verify) | `0041a66e` | via VH `t3-appt-recurrence` | ALREADY SHIPPED pre-run (brief §Rule-17 #1); stamping+rules cited; NO backfill anywhere (R3) |
| F3b reschedule update-in-place | DONE | `0041a66e` | planner VH legs 3/3 + F3e leg4 | reschedule split from postpone; same-doc update; series metadata survives via patch allowlist; postpone byte-for-byte unchanged (R4 intent; mechanism premise corrected — see DECISIONS #2) |
| F3c composite index | DONE | `045434ef` | F3e leg0 | (agentId ASC, seriesId ASC, date ASC) additive; deployed `-Only indexes` |
| F3d propagation UI + batch | DONE | `045434ef` | via F3e | 3-way chooser (this / this-and-future / all); scheduled+confirmed-only targets; date never propagates; changed-fields-only diff (normalizer, see DECISIONS #5); bulk-undo integrated |
| F3e series smoke | DONE | `44ee432c` | **14/14** (`smoke-run9-f3e-series.mjs`) | R1 past-fence proven vs admin-seeded cross-week series; R2 overwrite + preserve-earlier proven; R4 same-doc proven; undo of reschedule proven |
| E1 regression gate | DONE | n/a | **44/44 VH + 6/6 item smokes, 0 FAIL** | full suite on final deploy; staging left pristine (sweep + fresh 94-doc seed) |
| E2 final doc | DONE | (this commit) | n/a | |

Local gates at final build commit (`045434ef`): lint 0/0 · vitest **5571/5571** (356 files) · build clean. Emulator: appointments 33/33 · appointmentTemplates 24/24.

## Firestore surface changes (promotion flag-review list)

1. **rules — appointments `allow delete`** (was `if false`): owner-scoped (signed-in + tenant + `resource.data.agentId == request.auth.uid`). Exists solely as A1's undo-create inverse; no UI delete affordance. `4aab6bef`.
2. **rules — NEW `appointmentTemplates` block**: owner-only CRUD, hasOnly 11-key lock, update requires existing-doc ownership (hijack fence `7d88092f`). `c8c3f553`.
3. **indexes — NEW appointments composite** `(agentId ASC, seriesId ASC, date ASC)`. `045434ef`.
Both rules deploys + the index deploy ran via `deploy-staging.ps1` (staging-only guards passed); NO functions changes anywhere.

## DECISIONS-NEEDED (operator)

1. **Design-source gap:** the six features are NOT in `docs/design-system/proposals/planner-scheduler-v2/` (its README/mockups specify a different five: desktop multi-day views, drag-drop, running-late cascade, notes thread, rail adaptation — none built this run). Run built to the run-prompt specs. The five-feature package remains unbuilt — wants its own run decision.
2. **R4 premise correction (implemented intent, confirm):** shipped reschedule was rebook+tombstone (`postponeWithRebook`), never delete+create. Implemented: churn **Reschedule** = update-in-place same doc; **Postpone** unchanged (tombstone grammar). Confirm postpone staying rebook-style is intended.
3. **R5 premise correction (confirm the new delete arm):** no single-delete existed at HEAD (`allow delete: if false`). Hard delete introduced ONLY as A1's undo-create inverse, owner-scoped. If unwanted, revert is 1 rules line + service fn removal (undo-create degrades to soft-cancel).
4. **A2 shortcut map is orchestrator-locked, not designed:** n/?/arrows/e chosen as defensible defaults (mockups carry no map). Review before promotion.
5. **Propagation semantics extensions (consistent with R1/R2 but not explicitly ruled):** (a) date NEVER propagates (would collapse the series onto one day) — date edits are this-only/Reschedule; (b) propagation targets only `scheduled`/`confirmed` instances — retired/completed are records (R1 spirit); skipped counts named in the toast; (c) changed-fields-only diff uses value normalization (string/number + ''/null/undefined) to avoid phantom whole-series writes.
6. **Follow-up (pre-existing, surfaced by A5's flake hunt):** the panel keydown handler's stale-closure exposure under rapid state churn (A2-era) — recommend ref-based latest-state reads if it resurfaces. Not observed live; E1 clean.
7. **Template cap is client-side only** (20; read-then-write, not transactional). Rules-level count enforcement was not specified.

## Telemetry

| Part | Model | Duration | Outcome |
|---|---|---|---|
| recon + run docs + baseline | fable (orchestrator) | ~50 min | 44/44 baseline |
| A1 build | sonnet | 30.1 min | clean, 1 dispatch |
| A2 build | sonnet | 15.2 min | clean, 1 dispatch |
| A3 build | sonnet | 24.5 min total | 1 mid-run nudge (agent idled on its own bg test task) |
| A4 build | opus | 29.8 min total | 1 mid-run nudge (same idiom); orchestrator added rules hijack fence post-review |
| A5 build | opus | 49.8 min total | 1 transient API ENOTFOUND kill mid-read → resumed clean (infrastructure, not build) |
| F3a+F3b build | opus | 16.0 min | clean, 1 dispatch |
| F3c+F3d build | opus | 17.7 min | clean, 1 dispatch; 1 banked deviation (normalizer) |
| per-item smokes + emulator + deploys + E1 | fable (orchestrator) | interleaved | all green; 3 smoke-authoring bugs fixed (all env/assumption, 0 product defects) |

Strikes: **0** (the ENOTFOUND kill and two idle-agent nudges are infrastructure notes, not strikes; no data-safety events; zero prod requests asserted on every leg of every smoke).

## Handoff

- Staging is **pristine**: fresh 94-doc fixture seed; all non-fixture appointment residue swept (`scripts/staging/sweep-nonfixture-appointments.mjs` — new tool, committed).
- Staging Firebase: rules + indexes deployed match `staging` HEAD. NO functions deploys.
- Prod untouched (hygiene legs asserted zero `agencytrack-2a610` requests throughout).
- Nothing merged to main. E3: HOLDING for operator review.
- Six new standing smokes: `scripts/verification/smoke-run9-{a1-undo,a2-shortcuts,a3-conflicts,a4-templates,a5-bulk,f3e-series}.mjs` (register in SMOKES.md at promotion).

## Log (append-final)

- **2026-07-16:** Run start; Rule-17 premise sweep (4 corrections banked in kickoff brief); baseline 44/44.
- **2026-07-16/17:** A1→A5 built + live-verified sequentially (details in table). A3 smoke banked two staging-data traps (non-fixture residue not swept by seeder → new sweeper tool; durationMin default 30 → overlap-smoke offsets <30min).
- **2026-07-17:** F3 (fenced) — F3a verified already-shipped; F3b reschedule-in-place with postpone unchanged, 3/3 planner VH legs post-deploy; F3c index deployed; F3d propagation; F3e 14/14. E1: 44/44 + 6/6, zero regressions. Staging pristine. HOLD.

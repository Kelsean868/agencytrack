# Orchestrator — 10h Mixed Run: functions/ cluster (HOLD) + frontend sweep (auto-merge) + recon

> RUN ON: Opus (/model opus) as orchestrator and executor (Fable exhausted).
> ~10-hour window. THREE lanes, deliberately non-colliding:
>  - LANE 1 (functions/ cluster): build to HELD PRs — human-merge + Kyron deploys.
>    EFF-004 (YTD correctness bug) is the PRIORITY and goes first.
>  - LANE 2 (small frontend sweep): AUTO-MERGE + auto-revert, frontend-only, Low-risk.
>  - LANE 3 (recon, read-only): pre-scope the remaining backlog for the next window.
> GOVERNING RULES below are non-negotiable.

## GOVERNING RULES
1. LANE 1 IS HOLD-ONLY. Every EFF-004/006/015 item touches functions/ and/or
   firestore.rules → build to PR-open and STOP. NEVER merge. NEVER run firebase
   deploy. Kyron merges each and runs the deploy manually. Each Lane-1 PR body
   states it's a functions/rules change needing human merge + the exact deploy
   command. Gemini on-demand review on each (rules/functions convention).
2. LANE 2 AUTO-MERGE is FRONTEND-ONLY (src/ only) + auto-revert. If any Lane-2
   item's diff touches functions/, rules, indexes, or config → STOP, convert it
   to a held PR, do not merge. After each auto-merge, run the item's production
   smoke as owning subject; on smoke fail, git revert the squash SHA, push,
   confirm clean, flag AUTO-REVERTED, continue.
3. SINGLE-FILE MERGE LANE for Lane 2: one PR merged, post-merged, settled on main
   before the next. No stacking. Serialize ALL main-touching operations across
   both merging paths (Lane 2 merges; Lane 1 never merges so only its held
   branches exist).
4. LANES MUST NOT SHARE FILES. If two items would edit the same file, serialize
   them or bank the second. A correctness fix (EFF-004) must not race a perf
   edit on the same reducer/service.
5. TRUST CONTEXT.md / FOLLOW_UPS.md over this brief and over the audit's line
   anchors (audit is 2026-07-05, many merges old). Re-verify every anchor by grep
   (Rule 17). If an item is already resolved per the docs, skip it and note so.
6. HALT-ITEM-NOT-LANE. On two-strike friction, ambiguous recon, un-resolvable
   CI failure, or a scope surprise (e.g. a fix needs a data-model change) → PARK
   that item with a flag and CONTINUE the queue.
7. NO SCOPE EXPANSION. Build exactly each item's fix. Bank scope-expanding bot
   nitpicks. A finding that turns out to need architecture (new pattern, data
   model, build-config) → HOLD and surface, do not implement autonomously.
8. RE-POLL BOTS FRESH before any Lane-2 merge; CI green on the exact HEAD.
9. EMULATOR for any rules/functions verification runs on Firestore port 9090 /
   Auth 9099 (this repo's non-default ports). @firebase/rules-unit-testing is
   available.

## Step 0 — Ground truth
1. git fetch origin; checkout main; pull. Read CONTEXT.md + FOLLOW_UPS.md and the
   efficiency audit (docs/audits/webapp-ux/agencytrack-efficiency-audit-2026-07-05.md)
   IN FULL — especially the EFF-004, EFF-006, EFF-015 finding bodies (I do not
   have 006/015 detail; the audit is authoritative for their fix shape).
2. Confirm nothing in the queue is already resolved (EFF-002/011/001/005/007/009/
   018 and the FinancingRiskPanel flake are DONE — do not redo).
3. Create docs/audits/mixed-run-<date>/RUN-LOG.md. Post the plan: Lane-1 queue
   (EFF-004 first), Lane-2 queue (only confirmed frontend-only Low-risk items),
   Lane-3 recon targets. Then run Lane 3 in parallel from the start; run Lane 1
   serial (held); interleave Lane 2 merges only in gaps, serialized on main.

---

## LANE 1 — functions/ cluster (build to HELD PRs)

### L1-1 — EFF-004: YTD reducer ignores v2 newBusiness.api shape (CORRECTNESS — PRIORITY)
This is a CORRECTNESS bug, not just perf: the YTD reducer/aggregation ignores the
v2 `newBusiness.api` submission shape, so tenured agents on the v2 shape get WRONG
YTD API numbers on their badges/goals. Wrong production figures on a performance
tool = trust issue. Fix correctness first; any perf refactor in the same finding is
secondary and must not compromise the correctness fix.

Phase 0 — Recon & falsification (REPORT before fixing):
1. Locate the YTD reducer/aggregation (audit points into functions/; grep for the
   reducer and both submission shapes — legacy vs v2 `newBusiness.api`).
2. Determine EXACTLY which submissions use the v2 shape vs legacy, and how the
   reducer currently reads API. Confirm the miscount: build a concrete example
   (a v2-shape submission whose api the reducer drops or misreads) and state the
   wrong-vs-correct YTD number.
3. Determine BLAST RADIUS: which surfaces show this YTD figure (agent badges,
   goals pace, MDRT/awards, manager rollups)? Does the same reducer feed any
   write (a persisted aggregate) or only reads? If it feeds a persisted value,
   note whether existing stored aggregates are already wrong (a backfill
   question — bank as a separate FU, do NOT backfill autonomously).
4. If the correct v2 shape is ambiguous (multiple candidate fields), STOP and
   surface — do not guess money math.

Build (only after recon confirms the shape + miscount):
5. Fix the reducer to correctly read API from BOTH the legacy and v2
   `newBusiness.api` shapes. Match the shape the rest of the codebase treats as
   canonical (grep how other correct readers handle v2). parseFloat discipline;
   TTD; no rounding changes beyond the fix.

Verify:
6. Functions unit tests (the functions-tests job): add a test proving the reducer
   now counts a v2-shape submission's api correctly, and that legacy still works.
   If an emulator functions test is the right vehicle, use it (port 9090).
7. If any client surface renders the corrected number, a read-only smoke that a
   known v2 agent's YTD now matches hand-computed truth (value-level assertion).

HOLD: functions/ change → build to PR-open, Gemini on-demand review, disposition
bots, STOP. PR body: the miscount example, the fix, the affected surfaces, the
backfill question (if stored aggregates are stale), and the deploy command
`firebase deploy --only functions`. Do NOT merge, do NOT deploy.

### L1-2 — EFF-006 (recon from audit, then build to HELD PR)
Read the EFF-006 finding body from the audit (I don't have its detail). Recon-first:
confirm the anchor and mechanism, report the fix shape, then build to a held PR if
it's a clean functions/ change. If it needs a data-model/architecture change →
HOLD and surface, park. functions/ → human-merge + deploy. If EFF-006 turns out
to touch the SAME reducer/file as EFF-004, SERIALIZE (do it after EFF-004's PR is
open) or bank it to avoid a same-file tangle.

### L1-3 — EFF-015 (recon from audit, then build to HELD PR)
Same pattern as L1-2: read the finding, recon, report fix shape, build to held PR
if clean functions/ work, else park. Serialize against EFF-004/006 if same-file.

---

## LANE 2 — Small frontend sweep (AUTO-MERGE + auto-revert)

Pull ONLY genuinely frontend-only, Low-risk, mutually-independent items that do
NOT touch App.jsx / the dashboards / any file a Lane-1 item touches. Candidate
pool: remaining UX-audit findings not yet shipped, and any small efficiency items
that are frontend-only + Low-risk (NOT EFF-002 Phase 2 — that needs manualChunks,
out of scope). Build each Step-0-confirmed item, one PR at a time, auto-merge on
green with the full ritual (fresh bot re-poll, CI green on HEAD, frontend-only
diff check, squash, post-merge fill, production smoke, auto-revert on fail).

If, after Step 0, there are FEWER than ~2 genuinely-safe Lane-2 items, do NOT pad
the lane with borderline work — report "Lane 2 thin, N items" and put the window's
weight on Lanes 1 and 3. An empty Lane 2 is an acceptable outcome; a risky
auto-merge to fill time is not.

---

## LANE 3 — Recon (read-only, parallel, no merge gate)

Pre-scope the remaining backlog so the NEXT window's briefs are ready:
1. EFF-002 Phase 2 (manager-tab splitting + manualChunks): recon a concrete
   Rollup manualChunks grouping strategy (vendor/icons/recharts) that would let
   per-tab splitting land WITHOUT the tiny-chunk sprawl. Output a proposed config
   + the tabs worth splitting. Read-only; produce a plan, touch nothing.
2. The remaining efficiency findings NOT in Lane 1 (EFF-003, 008, 010, 012-014,
   016, 017 — whatever's still open): triage each into frontend-auto-mergeable /
   functions-held / needs-decision, with the file anchors re-verified. Output a
   ready-to-brief backlog table.
3. Any still-open items from the 2026-07-04 UX audits + the security delta
   (beyond SEC-012, now shipped): list what's left, severity, and merge lane.
Output all recon to docs/audits/mixed-run-<date>/NEXT-WINDOW-BACKLOG.md.

---

## WAKE-UP REPORT (docs/audits/mixed-run-<date>/RUN-LOG.md, kept current)
1. Lane 1: each item → HELD PR # (with deploy command) / PARKED-reason. For
   EFF-004: the miscount example, affected surfaces, and the backfill question.
2. Lane 2: each item → MERGED SHA / AUTO-REVERTED-reason / skipped. If thin, say so.
3. Lane 3: pointer to NEXT-WINDOW-BACKLOG.md + headline of what's ready to brief.
4. Self-critique (Rule 22): ≥1 known gap.
5. Recommended next, ordered — especially the merge+deploy order for the held
   Lane-1 PRs (EFF-004 first) and anything needing a Kyron decision.

## Start
Step 0. Post the plan. Run Lane 3 parallel from the start, Lane 1 serial (held,
EFF-004 first), Lane 2 interleaved in gaps (serialized on main). Never merge
functions/rules. Never deploy. Halt-item-not-lane on trouble.

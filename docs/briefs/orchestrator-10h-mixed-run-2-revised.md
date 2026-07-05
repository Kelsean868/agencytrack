# Orchestrator — 10h Mixed Run #2 (revised): 4 held Lane-1 items + sweep + recon

> RUN ON: Opus (/model opus) as orchestrator and executor (Fable exhausted).
> ~10-hour window. Lanes:
>  - LANE 1 (serial, HELD, in order): (1) MDRT threshold + 5-year floor marker,
>    (2) year-attribution money-math fix, (3) EFF-006 event-driven cron,
>    (4) EFF-002 Phase 2 manager-tab splitting. Kyron merges each; the three
>    functions items also need Kyron's `firebase deploy --only functions`.
>  - LANE 2 (serial, AUTO-MERGE + auto-revert): frontend-only Low-risk sweep, if any.
>  - LANE 3 (parallel, read-only): recon the next window.
> GOVERNING RULES are non-negotiable.

## THROUGHPUT NOTE (set expectations)
Lane 1 items 1-3 all touch functions/ (items 1 and 2 touch the SAME reducer/badge
region of functions/index.js). They MUST serialize — no parallel building on that
file. A 4-item serial Lane 1 is most of the window; it is ACCEPTABLE to finish 2-3
held PRs and leave item 4 (EFF-002 Phase 2, frontend) queued or partial. Do items
in order; do not sacrifice correctness-fix quality to reach item 4.

## HARD PRECONDITION — DO NOT START LANE 1 UNTIL THIS PASSES
EFF-004 (PR #805) must be merged AND its fix present on main (items 1 and 2 build
on the same reducer). In Step 0, grep the reducer for the EFF-004 canonical
extractTotalProductionCredit usage. If NOT present, HALT Lane 1 entirely and run
only Lane 3 (recon) — surface that EFF-004 isn't on main. Do not build badge/reducer
logic against pre-EFF-004 code.

## GOVERNING RULES
1. LANE 1 IS HELD. Items 1-3 touch functions/ → build to PR-open, STOP,
   human-merge + Kyron deploys. Item 4 (EFF-002 Phase 2) is frontend but a
   LOAD-PATH change → also HELD for human merge (Kyron eyeballs load path +
   screenshots). NEVER merge any Lane-1 PR. NEVER run firebase deploy. Each
   functions PR: Gemini on-demand review + exact deploy command in the body.
2. LANE 2 AUTO-MERGE is FRONTEND-ONLY (src/) + auto-revert. Any diff touching
   functions/rules/indexes/config → STOP, convert to held, don't merge. Post-merge
   production smoke; auto-revert the squash SHA on smoke fail.
3. SINGLE-FILE MERGE LANE for Lane 2; serialize ALL main-touching operations.
4. LANES MUST NOT SHARE FILES. Lane 1 is serial (items 1-2 share functions/index.js
   — strictly one PR open and settled before the next starts). No Lane-2 item may
   touch a Lane-1 file.
5. TRUST CONTEXT.md / FOLLOW_UPS.md over this brief and any audit line anchors
   (re-verify by grep, Rule 17). Skip anything already resolved.
6. HALT-ITEM-NOT-LANE on two-strike friction, ambiguous recon, un-resolvable CI, or
   a scope surprise (needs architecture/data-model/index/product-decision) → PARK
   with a ready-to-brief surface, continue the queue.
7. NO SCOPE EXPANSION. Bank scope-expanding bot nitpicks. Architecture/new-pattern
   → HOLD and surface, don't implement autonomously.
8. RE-POLL BOTS FRESH before any Lane-2 merge; CI green on exact HEAD.
9. Emulator (if needed) on Firestore 9090 / Auth 9099.

## Step 0 — Ground truth
1. git fetch; checkout main; pull. Read CONTEXT.md + FOLLOW_UPS.md + the efficiency
   audit + docs/audits/mixed-run-2026-07-05/NEXT-WINDOW-BACKLOG.md (prior Lane 3
   scoped EFF-006 + the EFF-002 Phase-2 manualChunks config — authoritative for
   those two items).
2. Run the HARD PRECONDITION check (EFF-004 on main). Record result.
3. Create docs/audits/mixed-run-2-<date>/RUN-LOG.md. Post the plan. Run Lane 3
   parallel from the start; Lane 1 serial (held, in order); Lane 2 in gaps.

---

## LANE 1 — four held items, IN ORDER

### L1-1 — MDRT threshold fix + 5-year floor marker (functions/, HELD) — CORRECTNESS, FIRST
Two DISTINCT markers (owner-confirmed business rules — different goals, not one number):
- `mdrt_qualified` = MDRT qualification, API >= 688,800 TTD (2026 T&T MDRT premium
  requirement). Currently fires at >= 500,000 (smoke-confirmed) — WRONG, qualifies
  agents 188,800 short. FIX.
- NEW floor marker = Tatil tenured-agent floor: API >= 500,000 TTD AND agent is
  >= 5 years from CONTRACT DATE, tenure measured AS OF TODAY / current status
  (owner-confirmed: once an agent passes 5 years from contract date, they're held
  to the floor; all their qualifying production counts — NOT a per-week test).
The 500,000 is a legitimate Tatil floor, NOT a stale MDRT constant — it moves from
(wrongly) gating MDRT to (correctly) gating the new floor marker.

Phase 0 — Recon (REPORT before editing):
1. Grep every functions/ site comparing production to an MDRT threshold and/or
   writing mdrt_qualified (and mdrt_pace). Confirm BOTH onSubmissionWrite AND the
   leaderboardAggregate/rankingLogic recompute path write these badges (prior
   EFF-004 finding). List each site file:line + the exact constant used.
2. Canonical constant: frontend has MDRT_THRESHOLDS_2026.mdrt = 688,800 (src/,
   PR #792). functions/ CANNOT import from src/. Determine whether a functions-side
   MDRT constant exists; if not, ADD one (functions/utils/ or a functions constants
   file) = 688,800, and FLAG the duplication risk (two 688,800 constants can drift).
   Use a NAMED constant at comparison sites, never an inline 688,800.
3. Contract date: locate the agent contract-date field (owner confirms it's saved
   for every agent). Confirm the function can READ it (doc already loaded, or new
   read). Report safe years-of-service computation AS OF TODAY (UTC-4 permanent;
   if YYYY-MM-DD string, compute whole years without a Date-parse that shifts across
   UTC-4). Owner-confirmed convention = current-date; if existing code implements
   tenure per-weekStarting instead, REPORT the inconsistency but proceed with
   current-date (do not stop — owner has ruled).
4. Floor marker placement: owner says it "can be in the goals." Locate the goals/
   badge structure; propose where the floor marker belongs + a proposed KEY name.
5. REPORT before editing. If contract date is NOT reachable, or placement needs a
   data-model decision → BUILD Commit 1 (MDRT fix) anyway, PARK Commit 2, surface.

Commit 1 — MDRT threshold fix:
6. At EVERY mdrt_qualified gating site (onSubmissionWrite AND recompute path),
   change 500,000 → the 688,800 named constant. Do NOT touch mdrt_pace unless
   Phase 0 proves it also wrongly uses 500k for MDRT (if it's a separate internal
   pace target, LEAVE IT — surface, don't touch).
   Commit: "fix: correct mdrt_qualified threshold to 688,800 (was 500k floor)".

Commit 2 — 5-year floor marker:
7. Add the floor marker: API >= 500,000 (named 500k floor constant, reusing the
   value previously mislabeled as MDRT) AND years-from-contract-date >= 5 (as of
   today). Write at the same site(s) as other badges (onSubmissionWrite + recompute
   path, consistently). Use the Phase-0.4 KEY.
8. Commit: "feat: add 5-year tenure floor marker (API >= 500k, >= 5yr from contract)".

Verify:
9. Functions unit tests for BOTH: mdrt_qualified now requires >= 688,800 (a 540,554
   agent does NOT qualify; a >= 688,800 agent does; legacy+v2 shapes counted via the
   EFF-004 reader); floor marker earned by a 5+yr agent >= 500k, NOT by a <5yr agent
   at same API, NOT by a 5+yr agent < 500k. Derive test years dynamically.
10. functions jest + root lint + vitest + build all green (both CI jobs gate the
    merge). If a client surface renders these, a read-only value-level smoke.

HOLD: functions PR, Gemini on-demand, disposition bots, STOP. PR body: Phase-0
findings (every threshold site + canonical-constant decision + contract-date field +
tenure note), mdrt before/after, the floor marker + its proposed KEY with an
EXPLICIT "confirm key name before merge" ask (permanent production data), the
backfill note (below), and `firebase deploy --only functions`. Do NOT merge/deploy.
Backfill (bank, do NOT do): both markers self-heal on next submission/recompute;
existing docs may show old wrong mdrt_qualified until then — bank an FU "run a
leaderboard recompute before pilot reactivation."

### L1-2 — Year-attribution fix (functions/, HELD) — money-math correctness
SERIALIZE strictly after L1-1 (same functions/index.js reducer region).
BUSINESS RULE (owner-confirmed): MDRT/annual production attributes to the year of
the submission's weekStarting (the Sunday the week begins), regardless of entry
date. A year-straddle week (weekStarting 2025-12-29) attributes ENTIRELY to 2025.
Bug (Gemini HIGH on #805): the YTD scan derives year from new Date().getFullYear()
(~index.js:1493/:1503, RE-VERIFY) — wrong for prior-year weeks entered in January.
Phase 0: grep every site deriving the YTD/MDRT year; confirm weekStarting shape
(YYYY-MM-DD) and safe year extraction (leading 4 chars — NOT a Date-parse that
shifts across UTC-4); confirm blast radius + any persisted-aggregate backfill
question (bank, don't backfill).
Build: derive the attribution year from each submission's weekStarting year.
Verify: unit tests — a Dec-weekStarting sub entered in January counts to the Dec
year; a straddle week attributes fully to the weekStarting year; normal cases hold;
dynamic test years. functions jest + root gates green.
HOLD: functions PR, Gemini on-demand, deploy command in body. Do NOT merge/deploy.

### L1-3 — EFF-006 event-driven leaderboard cron (functions/, HELD)
Use NEXT-WINDOW-BACKLOG.md's scoped design + re-verify anchors. Build IF it's a
clean functions-only change (dirty-flag doc + gated recompute); include any new
composite index in firestore.indexes.json in the same PR (still human-merge). If it
needs a data-model decision beyond the backlog design → PARK and surface. If it
touches the same functions/index.js region as L1-1/L1-2, serialize after them.
HOLD: functions PR, Gemini on-demand, deploy command in body.

### L1-4 — EFF-002 Phase 2: manager-tab splitting (frontend, HELD)
Use the manualChunks config from NEXT-WINDOW-BACKLOG.md. React.lazy the heavy
manager tabs at their conditional-mount boundaries behind Suspense, wrapped in the
EXISTING ChunkLoadErrorBoundary (#804) so a failed tab chunk shows the reload
fallback, not a white screen. Add the Rollup manualChunks grouping (vendor/icons/
recharts) so per-tab splitting does NOT create tiny-chunk sprawl (sprawl = fail
condition; compare chunk COUNT to the prior reverted attempt). Verify: lint + suite
+ build; re-run the EFF-002 adversarial smoke (agent never fetches manager chunk;
every manager tab resolves; chunk-failure leg shows the boundary; slow-3G fallbacks
resolve; both themes) + screenshots. If sprawl persists or a tab misbehaves, HALT,
keep reverted, report. HELD: frontend load-path change → build to PR-open, STOP for
human merge (Kyron eyeballs load path + screenshots). Do NOT merge.

---

## LANE 2 — frontend auto-merge sweep (if any genuinely-safe items exist)
Frontend-only, Low-risk, independent items NOT touching any Lane-1 file (not
App.jsx, not manager dashboard/tabs, not Vite config, not functions/). Full ritual
per merge (fresh bot re-poll, CI green on HEAD, frontend-only diff check, squash,
post-merge fill, production smoke, auto-revert on fail). If <2 safe items, report
"Lane 2 thin" — do NOT pad with risky work.

## LANE 3 — recon (read-only, parallel)
Refresh NEXT-WINDOW-BACKLOG into docs/audits/mixed-run-2-<date>/
NEXT-WINDOW-BACKLOG.md: what remains after this window (remaining efficiency
findings, open security/PRIV beyond SEC-012, open UX findings, the Node 20
runtime-decommission migration due before 2026-10-30), each triaged into
frontend-auto / functions-held / needs-decision with re-verified anchors + one-line
fix shape.

## WAKE-UP REPORT (RUN-LOG.md, kept current)
1. HARD PRECONDITION result and its effect on Lane 1.
2. Lane 1: each item → HELD PR # (+ deploy command) / PARKED-reason / QUEUED (if the
   window closed before it). For L1-1: threshold sites, the floor-marker KEY awaiting
   confirmation, backfill note. For L1-2: attribution + straddle handling. For L1-4:
   chunk count before/after + sprawl avoided?
3. Lane 2: MERGED SHA / AUTO-REVERTED / thin.
4. Lane 3: pointer to refreshed backlog (incl. Node 20 migration deadline).
5. Self-critique (Rule 22): >= 1 gap.
6. Recommended merge+deploy order for the held PRs (correctness first: L1-1, L1-2),
   and any Kyron decisions (esp. the floor-marker KEY name).

## Start
Step 0 (incl. HARD PRECONDITION). Post plan. Lane 3 parallel; Lane 1 serial held IN
ORDER (MDRT+floor → year-attribution → EFF-006 → EFF-002 Phase 2); Lane 2 in gaps.
Never merge Lane-1. Never deploy. Halt-item-not-lane on trouble.

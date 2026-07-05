# Orchestrator — EFF-002 Code-Splitting (HOLD) + FinancingRiskPanel flake fix (auto-merge)

> RUN ON: Opus (/model opus) as orchestrator. Fable usage is exhausted — Opus
> orchestrates and Opus executes. This is a ~10-hour window.
>
> TWO LANES, deliberately non-colliding:
>  - LANE 1 (EFF-002): the big load-path change → BUILD TO PR-OPEN AND HOLD.
>    Owns App.jsx + both dashboards + manager tabs. NO auto-merge — human-merge.
>  - LANE 2 (flake fix): FinancingRiskPanel test timeout → AUTO-MERGE + auto-revert.
>    Touches ONLY the test file. Cannot collide with Lane 1's files.
>
> GOVERNING RULES below are non-negotiable.

## GOVERNING RULES
1. LANE 1 IS HOLD-ONLY. EFF-002 is a Med-change-risk architectural change to the
   app's load path. Build it to PR-open and STOP. Do NOT auto-merge it — Kyron
   reviews and merges. Reason: code-split failures (Suspense flash, chunk 404 on
   a route, loading state that never resolves on slow networks) can pass all
   gates and still white-screen a real user. A human glance on the load path is
   required.
2. LANE 2 AUTO-MERGE IS FRONTEND-ONLY + auto-revert. The flake fix touches only
   FinancingRiskPanel.test.jsx. Auto-merge on green; if the post-merge prod smoke
   fails, git revert the squash SHA, push, confirm clean, flag AUTO-REVERTED.
3. NEVER run firebase deploy. Neither lane touches rules/functions.
4. LANES MUST NOT SHARE FILES. Lane 1 owns App.jsx + dashboards + manager tabs.
   Lane 2 owns only the one test file. If Lane 2 work is somehow found to touch
   any Lane-1 file, STOP Lane 2 and surface — do not create a cross-lane tangle.
5. TRUST CONTEXT.md / FOLLOW_UPS.md on main over the audit's line anchors (they
   are from 2026-07-05, before six merges — lines have shifted). Re-verify every
   anchor by grep before editing (Rule 17).
6. NO SCOPE EXPANSION. Lane 1 = code-splitting only (lazy + Suspense). Do NOT
   re-split the PDF engine (EFF-011 already did that in #802 — check and skip it).
   Do NOT refactor components while splitting them. Bank scope-expanding bot
   nitpicks.
7. RE-POLL BOTS FRESH before Lane 2's merge; CI green on the exact HEAD.

## Step 0 — Ground truth
1. git fetch origin; checkout main; pull. Read CONTEXT.md + FOLLOW_UPS.md and the
   efficiency audit (docs/audits/webapp-ux/agencytrack-efficiency-audit-2026-07-05.md).
2. Confirm what #802 (EFF-011) already made lazy — the PDF engine is already
   dynamic-imported; EFF-002 must NOT touch that split.
3. Create docs/audits/eff002-run/RUN-LOG.md. Post the plan, then run Lane 1
   (foreground, phased) and Lane 2 (the small auto-merge) — do Lane 2's build on
   its own branch but MERGE it only when it will not race a Lane-1 push (serialize
   the actual main-touching operations).

---

## LANE 1 — EFF-002 code-splitting (HOLD for human merge)

### Phase 0 — Recon & split plan (REPORT before editing)
1. Read App.jsx: confirm both dashboards are eager-imported; identify the exact
   import + render sites.
2. Read ManagerDashboard.jsx: find the real `activeTab ===` conditional-mount
   boundaries (audit said ~445-624 — RE-VERIFY current lines). These are the
   tab-level split candidates. Identify which tabs pull the heaviest deps
   (Recharts-bearing tabs, manager-only panels).
3. Read AgentDashboard.jsx similarly for any heavy agent-only tab worth splitting.
4. Confirm Recharts' three import sites (KPICard, PersistencyTab, CashFlowChart)
   — note that KPICard is on the agent default view (EFF-013 territory); do NOT
   fix EFF-013 here, but note whether Recharts can leave the agent entry chunk
   once manager tabs are lazy.
5. Produce a SPLIT PLAN in RUN-LOG.md: ordered list of boundaries to add, each
   with the file, the mount point, and the expected chunk it creates. Then build.

### Phase 1 — Dashboard split (the big win, lowest risk) — CHECKPOINT
1. React.lazy the two dashboards in App.jsx behind a single <Suspense> with a
   proper themed fallback (not a bare spinner — a fallback consistent with the
   app's existing loading treatment; must render correctly in BOTH themes).
2. Ensure the fallback handles the agent-never-loads-manager-code goal: an agent
   session must not fetch the manager chunk.
3. VERIFY THIS CHECKPOINT before proceeding:
   - lint + full vitest + build all green.
   - Chunk report: capture entry-chunk gzip before/after (build main for the
     honest before-number). Record in RUN-LOG.
   - Adversarial smoke (see Smoke spec) on the dashboard split only.
   - Screenshots of the Suspense fallback in both themes, both roles.
   If this checkpoint is clean, the majority of the bundle win is already banked
   — proceed to Phase 2. If Phase 2 later gets hairy, this is the safe ship point.

### Phase 2 — Manager tab splits — INCREMENTAL, each verified
1. React.lazy the heavy manager tabs at their existing conditional-mount
   boundaries, one logical group at a time, each behind Suspense with a themed
   fallback. Prefer the Recharts-bearing and heaviest panels first.
2. After EACH group: lint + build + chunk report + smoke that tab's route.
   If any tab's split produces a broken/again-eager chunk, a fallback that
   flashes wrong, or a route that fails to load its chunk — STOP that split,
   revert just that boundary, bank it as an FU, and continue with the rest.
3. Do NOT split so aggressively that you create dozens of tiny chunks with
   waterfall loading — group sensibly.

### Smoke spec (ADVERSARIAL — this is the point of a load-path change)
Write a committed smoke (scripts/verification/) that, against the preview:
1. Loads as AGENT: confirm the dashboard paints, and confirm via network trace
   that the MANAGER chunk is NOT fetched on the agent path (the core EFF-002
   goal). Navigate every agent tab; each lazy chunk loads and the view renders.
2. Loads as BRANCH_MANAGER: navigate EVERY manager tab; each lazy chunk resolves,
   each Suspense fallback appears then resolves to real content (no infinite
   fallback, no flash-of-wrong-theme).
3. SLOW NETWORK: with CDP network throttling (Slow 3G-class), repeat a
   representative subset — confirm fallbacks show gracefully and resolve, no
   white screen, no unhandled chunk-load error in console.
4. Direct-route load: navigate straight to a lazy manager route (not via
   in-app nav) to confirm the chunk loads on a cold entry, not just on client
   nav (catches chunk-path/base-URL bugs).
5. Both themes. 0 unhandled console errors (a chunk-load error is a FAIL).
Every leg must be capable of failing — value/network-level assertions, not
selector-only.

### Screenshots (loading states — the thing a smoke can't fully judge)
Capture and save to docs/audits/eff002-run/screenshots/:
- Each distinct Suspense fallback, in BOTH themes (light + dark), desktop.
- At least the dashboard-level fallback and one manager-tab fallback under the
  slow-network condition (so Kyron can eyeball that the fallback looks
  intentional, not a raw spinner or an unstyled flash).
- An INDEX.md naming each shot and what boundary/state it shows.

### Phase 4 — Docs
Mark EFF-002 addressed in the efficiency audit with the measured before/after
entry-chunk gzip. Update CONTEXT.md + FOLLOW_UPS.md (size-capped); note the PR
is HELD for human merge. Bank any Phase-2 tab splits that were skipped as FUs.

### Phase 5 — Commit / push / PR — THEN STOP (HOLD)
Single branch: perf/eff002-code-splitting. Phase 1 (dashboard split) as its own
commit, then Phase 2 tab-split groups as subsequent commits (so the dashboard
split is independently revertable if a tab split is the problem). Push, open PR.
PR body: the split plan, before/after chunk numbers, the adversarial smoke
result, a screenshot index, and any banked/skipped splits. Poll CodeRabbit +
Gemini, disposition in a table. HOLD — do NOT merge, do NOT run Phase 6.
Report PR-ready for Kyron's review.

---

## LANE 2 — FinancingRiskPanel test flake (AUTO-MERGE + auto-revert)

Context: FinancingRiskPanel.test.jsx has hit a 5000ms CI timeout 3× (banked
FOLLOW_UPS ~line 204). Not a product bug — a test that's too slow / racy under CI.

1. Read the test. Root-cause the timeout: an unmocked slow async, a real timer,
   a missing await, or a genuinely heavy setup. Fix the TEST (mock the slow path,
   fake timers, or raise the timeout if the work is legitimately heavy) — do NOT
   change FinancingRiskPanel source (that's out of scope; if the test reveals a
   real component perf bug, bank it, don't fix it here).
2. Run the file locally several times to confirm the flake is gone (stable green
   across repeated runs, not one lucky pass).
3. Full suite + lint green.
4. Branch: fix/financingrisk-test-flake. One commit. Push, open PR. Frontend/
   test-only → AUTO-MERGE authorized.
5. Before merge: re-poll bots fresh on HEAD, CI green, confirm diff is ONLY the
   test file. Squash-merge. Post-merge: sync, fill placeholders, push, Rule 15.
6. Post-merge prod smoke: a test-only change has no runtime surface, so the
   "smoke" is confirming CI is green on main post-merge and the app still builds/
   loads clean. If main's CI goes red post-merge, auto-revert.
7. SERIALIZE vs Lane 1: do not push Lane 2 to main while a Lane-1 push is in
   flight. Lane 2 is small — merge it early (before Lane 1's long build) or in a
   gap, whichever avoids racing main.

---

## WAKE-UP REPORT (docs/audits/eff002-run/RUN-LOG.md, kept current)
1. Lane 1 status: split plan, phases completed, before/after entry-chunk gzip,
   smoke result, screenshot index, PR # (HELD), any skipped/banked tab splits.
2. Lane 2 status: MERGED SHA / AUTO-REVERTED-reason.
3. Self-critique (Rule 22): ≥1 known gap (e.g. which failure modes the smoke
   could still miss).
4. Recommended next: for Kyron's review of the held EFF-002 PR, the exact
   before/after numbers and what to eyeball in the screenshots.

## Start
Step 0. Post the plan. Run Lane 1 phased (HOLD) + Lane 2 (auto-merge, serialized
against main). Never merge EFF-002. Never deploy. Halt-item-not-lane on trouble.

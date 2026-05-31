# Track J — P7: AgentProductionView rank pill + around-me, wired to the aggregate

**Sized:** M
**Branch:** `redesign/agent-production-rank-from-aggregate` (off main)
**Type:** Bug-fix + restore on a **live** surface (`AgentProductionView`). Reads the **existing** `leaderboards/{branchId}` aggregate; reuses `useLeaderboard` + `aroundMeLogic`. **No backend change. Human-merge + dispatcher pre-review.**

## Outcome

`AgentProductionView`'s hero rank pill shows the agent's **real** rank from the aggregate (fixing the always-#1 bug), and the around-me panel deferred in PR #397 is restored, reading the aggregate.

## Context (baked in)

- The bug: the rank pill used a **self-only** client ranking — an agent can only read their own submissions under Firestore rules, so the ranking was always "rank 1 of 1." PR #397 dropped the pill **and** the around-me panel pending a shared ranking. That shared ranking is now the P1 aggregate (`leaderboards/{branchId}`), agent-readable and proven live (P1b/P3/P4). P7 restores both, reading the aggregate.
- **Reuse:** `useLeaderboard` (reads `leaderboards/{viewerBranchId}`), `aroundMeLogic` (viewer + neighbor computation). Reuse `AroundMeCluster` only if the `AgentProductionView` around-me design matches the leaderboard cluster; otherwise a view-specific presentation that consumes `aroundMeLogic`'s neighbor math — decide in Phase 1 from the mockup.
- **Rank semantic:** the aggregate is branch-scoped, so the pill shows **branch rank** ("N of M-in-branch"). Confirm the mockup's pill means branch rank; if it implies company/other scope, that's a mismatch — surface it.
- **Period mapping:** `AgentProductionView` has its own period context; the pill shows the agent's rank for the report's active period. Map the report period → the aggregate's WK/MTD/QTD/YTD in Phase 1.

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-p7-agent-production-rank-kickoff.md`; branch `redesign/agent-production-rank-from-aggregate`; commit as commit 1.
3. Failure/drift → STOP and wait for dispatcher.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read `/mnt/skills/public/frontend-design/SKILL.md`.
2. Source-verify `AgentProductionView.jsx`: where the dropped rank pill + around-me were (PR #397), its period model, and the production-report mockup's rank-pill + around-me presentation.
3. Confirm `useLeaderboard` + `aroundMeLogic` reuse; **decide** `AroundMeCluster` reuse vs a view-specific around-me (the AgentProductionView panel is likely always-on "your standing," not the conditional below-set cluster — pick the cleanest reuse of `aroundMeLogic`'s neighbor math).
4. Confirm viewer identity (`uid === entry.agentId`) + `branchId` availability; map report-period → aggregate-period; confirm the pill's branch-rank semantic against the mockup.
5. Drift/conflict → STOP and surface.

## Phase 2 — build

- Restore the hero rank pill: read the viewer's entry from the aggregate for the active period; show **rank-of-total** ("N of M"). Remove the self-only ranking path entirely.
- Restore the around-me panel: reuse `aroundMeLogic`'s neighbor computation; reuse `AroundMeCluster` or a view-specific presentation per Phase 1.
- Nexus tokens only; no raw hex; no backend/aggregate change.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** `AgentProductionView` edits + any view-specific around-me component + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/` edits, no unrelated `src/`.
- **3c lint / test / build** green (verbatim).
- **3d axe baseline-delta** both themes; NO-NEW serious/critical (Rule 9 carve-out only; gold FU-tracked).
- **3e UNIT/COMPONENT tests (PRIMARY — these prove the fix):**
  - **Rank pill reflects the aggregate:** mock aggregate with the viewer at rank 14 → pill renders "14" (or "14 of M"); viewer at rank 1 → "1 of M". This is the assertion that proves the always-#1 bug is gone — the pill reads the aggregate, not a hardcoded/self-only 1.
  - Rank-of-total ("N of M") correct.
  - Around-me panel renders the viewer + neighbors from the mock aggregate.
  - Viewer-not-in-aggregate (unranked) state renders honestly.
- **3f LIVE smoke (visible case):** test agent → `AgentProductionView` → the pill shows the agent's **real** rank-of-total from the live aggregate (test agent = "1 of 6", sourced from the aggregate — NOT hardcoded); around-me renders; both themes; 0 console errors. Preview; prod in Phase 6.

  Note: the test agent is rank 1, so the live pill reads "1" — which is why the component test (rank 14 → "14") is the real proof of the fix, not the live smoke.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`).
- **Resolve the PR #397 deferred-rank/around-me FU** (mark resolved with this PR's placeholder).

## Phase 5 — PR + STOP for pre-review

Open PR; paste gate results. STOP. I pre-review: the rank-pill-reflects-aggregate test (the proof), the period mapping, and the around-me reuse-vs-bespoke decision.

## Phase 6 — post-merge

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke (visible case, both themes) verbatim.

## Acceptance criteria

- Rank pill reflects the aggregate rank for the active period (component-tested at ranks 1 and 14, proving the fix); around-me restored from the aggregate; rank-of-total; unranked state; reuse of `useLeaderboard`/`aroundMeLogic`; no backend change; the #397 deferred FU resolved; gates green.

## Out of scope

Role-scope toggle (P5). Nav swap + points retirement (P6). The coaching "Agent Report View" RUN-record version (still blocked on the coaching data model). `previousRank`/movement-chip (deferred CF phase).

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17.

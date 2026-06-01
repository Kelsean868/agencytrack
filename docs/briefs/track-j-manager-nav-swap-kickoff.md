# Track J — P5 manager nav swap (UM/BM)

**Sized:** M
**Branch:** `redesign/leaderboard-manager-nav-swap` (off main, includes #406/#407/#408)
**Type:** Client-only UI. Role-conditional swap of `ManagerDashboard`'s Leaderboard tab to `ProductionLeaderboardSurface` for UM/BM, scoped to their branch. **No backend, no deploy.** **Human-merge + dispatcher pre-review.**

## Outcome

UM and BM reach the production leaderboard from their dashboard nav, scoped to their own branch, with P5a's scope control active (and finally live-verifiable). SM is unchanged — keeps the points board until P5b ships the all-branches picker. Agents unchanged. The points board is not orphaned.

## Decisions baked in (do not re-litigate)

- **UM/BM:** the `ManagerDashboard` Leaderboard tab mounts `ProductionLeaderboardSurface`, scoped to the manager's own `branchId`. P5a's scope control then applies (UM → My Unit / My Branch; BM → My Branch + unit-picker).
- **SM:** **unchanged** — still mounts the points board (`gamification/Leaderboard`). An SM has `ownedBranchIds: ['*']` (all branches, confirmed by head of sales) and therefore no single default branch, so the SM experience needs the all-branches picker = **P5b**. The swap is role-conditional, not blanket.
- **Points board NOT orphaned** — SM still renders it, so the import stays in `ManagerDashboard` (mirrors how P6 left it intact for the manager dashboard). Guard with a regression test.
- **Agent unchanged** — P6 already did the agent swap; this PR touches `ManagerDashboard` only.
- No aggregate/CF/rules change — the manager already has read access to any branch leaderboard (P1b rules), and `ProductionLeaderboardSurface` already reads the viewer's branch.

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-manager-nav-swap-kickoff.md`; branch `redesign/leaderboard-manager-nav-swap`; commit as commit 1.
3. Failure/drift → STOP.

## Phase 1 — source-verify (read frontend SKILL first)

1. Read the frontend SKILL (or repo Nexus conventions).
2. Locate `ManagerDashboard`'s Leaderboard tab wiring and how it currently mounts `gamification/Leaderboard`.
3. Confirm how a manager's `branchId` resolves (user doc field / auth claim) and that `ProductionLeaderboardSurface` reads the viewer's branch correctly for a UM/BM (not just an agent).
4. Confirm the points board's other consumers — verify SM (and any other role) still mounts it so removing it from the UM/BM path does not orphan the import.
5. Confirm the `A11Y_UNIT_MANAGER_*` and `A11Y_BRANCH_MANAGER_*` accounts' branch/unit setup (which branch, which unit) so the live smoke knows what to assert.
6. Drift/conflict (e.g., SM and BM share a code path that can't be cleanly forked) → STOP and surface.

## Phase 2 — build

- Role-conditional Leaderboard tab in `ManagerDashboard`: UM/BM → `<ProductionLeaderboardSurface>` scoped to their `branchId`; SM (and others) → unchanged points board.
- Wire the manager `branchId` resolution into the surface mount.
- No backend, no surface-internal change beyond passing the manager's branch, no raw hex.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (FINAL diff, terminal):** `ManagerDashboard` + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no rules, no surface-internal redesign, no unrelated `src/`.
- **3c lint / test / build** green (verbatim).
- **3d axe baseline-delta** both themes; NO-NEW serious/critical.
- **3e regression + component tests:** points board still mounts for SM (not orphaned); UM/BM Leaderboard tab → `ProductionLeaderboardSurface` with the correct branch; agent path untouched.
- **3f LIVE smoke (both themes) — this closes P5a's deferred manager-scope verification:**
  - **UM** (`A11Y_UNIT_MANAGER_*`): reach the surface from manager nav; assert the scope control shows My Unit / My Branch; toggle **My Unit** → surface re-scopes to the unit (fewer agents, re-ranked by `rankWithinUnit`, subtitle shows the unit + count). This is the live proof P5a deferred.
  - **BM** (`A11Y_BRANCH_MANAGER_*`): reach the surface; assert My Branch + unit-picker; pick a unit → re-scopes.
  - **SM**: assert still on the points board (regression).
  - **Agent** (test agent): unchanged, no scope control (regression).
  - Credentials by boolean-presence only (Rule 4); never echo values.

## Phase 4 — docs + FUs

- CONTEXT.md row (`#{TBD}`/`{TBD}`).
- Resolve the P5 manager-nav-swap FU AND the P5a deferred manager-scope-verification FU (now live-verified here).
- Note: SM leaderboard experience → P5b (all-branches picker), blocked only on an SM credential.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gates + the manager live-smoke results. STOP. I pre-review the role-conditional swap (**SM must NOT break — keeps the points board**), the manager `branchId` resolution (correct branch), and the now-live UM/BM scope verification.

## Phase 6 — post-merge (no deploy)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke verbatim — and have it cover the **full leaderboard set on main** in one pass (manager reaches surface + scope works; agent movement-chip even-state; banner empty-render), sweeping up the #406/#407 post-merge prod confirmation. Frontend-only; Vercel auto-deploys on merge.

## Acceptance criteria

- UM/BM Leaderboard tab mounts `ProductionLeaderboardSurface` scoped to their branch, with P5a's scope control active and **live-verified** (UM My Unit toggle + BM unit-picker); SM unchanged (points board, → P5b); points board not orphaned; agent unchanged; gates green.

## Out of scope

SM leaderboard experience (P5b — all-branches picker). Any aggregate/CF/rules change. Surface-internal redesign.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17, 19.

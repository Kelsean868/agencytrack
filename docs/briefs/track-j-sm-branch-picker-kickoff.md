# Track J — P5b SM branch picker

**Sized:** M
**Branch:** `redesign/leaderboard-sm-branch-picker` (off main, after the seed)
**Type:** Client-only UI. SM all-branches picker on `ProductionLeaderboardSurface`; retires the SM points board. **No backend, no deploy.** **Human-merge + dispatcher pre-review.**

## Outcome

A Sales Manager reaches the production leaderboard from their dashboard nav, picks any branch in the tenant, and sees that branch's leaderboard with unit-scoping within it (BM-style). The SM points board retires. Built on the SM account + rich data the seed provisions.

## Decisions baked in (do not re-litigate)

- **An SM oversees ALL branches** (head of sales, 2026-05-31). The existing `ownedBranchIds: ['*']` model is correct — no region/subset ownership model. The picker lists **every tenant branch**.
- **SM control = a branch picker (all branches) + the P5a unit-picker within the chosen branch** (i.e., SM behaves like a BM once a branch is selected, with a branch selector on top).
- **Default branch:** persist the SM's last-picked branch (mirror the P5a per-UID localStorage pattern); on first use, default to the first branch. No forced "select a branch" dead-end.
- **Retire the SM points board** from the SM path. Do NOT orphan-remove the component if TA/PA still mount it — leave the import if any role still uses it; a full points-board removal is a separate cleanup FU once no role references it.
- Reuse `ProductionLeaderboardSurface` + the P5a scope machinery; the only new piece is the branch selector + reading `leaderboards/{pickedBranchId}`. Managers already have rules read-access to any branch (P1b).

## Phase 0 — pre-flight

1. `git fetch origin`; sync main (must include the seed run); `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/track-j-sm-branch-picker-kickoff.md`; branch; commit as commit 1.

## Phase 1 — source-verify

1. How to enumerate all tenant branches for the picker (a `branches` collection, the `leaderboards` collection's doc IDs, or a tenant config) — pick the authoritative source.
2. The SM nav wiring in `ManagerDashboard` (the role-conditional slot P5 left for SM).
3. **Confirm a usable SM credential** (provisioned by the seed). If the seed hasn't run / no SM login, build + component-test and SURFACE it — live smoke gates on it, build does not.
4. Confirm the second branch has data (the seed populated `ljbBHP1g7lbZXvHlpcDn`) so the picker shows a real cross-branch difference.
5. The branch-label source for the picker (branchName vs branchId).
6. Drift → STOP.

## Phase 2 — build

- SM branch picker (all tenant branches) wired into the SM nav slot → `ProductionLeaderboardSurface` reading `leaderboards/{pickedBranchId}`.
- Within the picked branch, the P5a unit-picker applies (BM-style scope control).
- Persist last-picked branch per UID; default to first branch on first use.
- Retire the SM points-board mount (leave the import if TA/PA still use it).
- Nexus tokens; no raw hex; no backend.

## Phase 3 — gates

- **3a hex-grep** empty.
- **3b scope (terminal):** the picker + SM nav slot + `ManagerDashboard` + tests + brief + CONTEXT + FOLLOW_UPS (+ smoke). No `functions/`, no rules, no unrelated `src/`.
- **3c lint / test / build** green.
- **3d axe baseline-delta** both themes; NO-NEW serious/critical.
- **3e logic + component tests:** branch enumeration → all tenant branches; picking branch X → surface reads `leaderboards/X`; persistence per-UID round-trip; SM sees branch-picker (other roles unaffected — UM/BM/agent paths untouched).
- **3f LIVE smoke (both themes), gated on the SM credential:** SM logs in → reaches surface → picks branch A (6 agents) → picks branch B (3 agents) → assert the leaderboard re-reads per branch; unit-picker works within a picked branch; last-picked persists across reload; SM points board no longer mounts. If no SM credential → component-only + surface. Regression: UM/BM/agent unchanged.

## Phase 4 — docs + FUs

- CONTEXT.md row; resolve the P5b FU. Record canonically: SM = all-branches (head of sales 2026-05-31), `ownedBranchIds: ['*']` model correct.
- Bank a cleanup FU: full points-board removal once confirmed no role (incl TA/PA) mounts it.

## Phase 5 — PR + STOP for pre-review

Open PR; paste gates + the SM live-smoke (or the credential-gap surface). STOP. I pre-review the branch enumeration (all branches), the cross-branch read (picking re-reads the right doc), the persistence, and that the SM points-board retirement doesn't orphan/regress other roles.

## Phase 6 — post-merge (no deploy)

Sync, fill, push direct to main, Rule 15 verbatim; prod smoke verbatim. Frontend-only.

## Acceptance criteria

- SM reaches the production leaderboard, picks any tenant branch (all branches listed), surface reads that branch's leaderboard with unit-scoping within; last-picked persists per UID; SM points board retired without orphaning other roles; logic + component tested; live-smoked across both branches if an SM credential exists (else component-only + flagged); UM/BM/agent unchanged; gates green.

## Out of scope

Full points-board component removal (separate cleanup FU). Any ownership/region model (not needed — SM = all branches). Backend/CF/rules change.

## Rule references

Rule 9, 10, 11, 12, 15, 16, 17, 19.

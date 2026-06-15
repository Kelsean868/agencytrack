# Producing-Manager Slice 2.1b — BM branch-direct routing + roll-up

Build-and-hold. Frontend + client-service (like 2.1a) → auto-deploys on merge; post-merge smoke,
no `firebase deploy`. Slices 2.0 + 2.1a are LIVE. This is the greenfield slice: BM personal
production through the agent wizard, rolling into the BRANCH total directly (above units).

## Locked decisions (Phase 2 recon review + the shipped 2.1a pattern)
- **Entry-gate: add BM.** 2.1a gated the agent-wizard trigger to UM only. Extend to **UM + BM**
  (SM/TA still blocked). The gate lives in BOTH the ManagerDashboard handler and the
  ManagerOverviewTab button render — update both (the button silently no-ops otherwise).
- **BM submission: sentinel unitId.** A BM has no unit (`userProfile.unitId === null`). In the
  wizard submit path where `unitId` is resolved (`userProfile?.unitId ?? null`), write
  `unitId = '__branch_direct__'` (a named constant) when `role === 'branch_manager'`. UM/agent
  paths unchanged. The sentinel is an explicit "branch-direct, no unit" marker — it never matches
  a real unitId (so it's excluded from unit totals) and avoids null-bucket edge cases.
- **Branch roll-up via getBranchProducerIds.** Extend `getBranchProducerIds` (added in 2.1a:
  agents + UMs) to **agents + UMs + BMs** — same pattern. The BM's submission is then returned by
  the BM-path of `getAllYTDSubmissions` and summed into `teamYTDAPI` (branch production total).
  The sentinel keeps it out of unit totals; getBranchProducerIds puts it in the branch total —
  once.
- **Exclude the sentinel from per-unit grouping.** Any aggregation/display that groups or filters
  submissions by `unitId` must skip `'__branch_direct__'` so it never renders as a phantom unit.
- **Production ONLY — not compliance.** BMs are OPTIONAL filers (never mandatory), so they do NOT
  enter the compliance denominator. Compliance stays agents-only (Phase 3 adds UMs only).
- **Leaderboard is already handled** — a BM appears only if opted-in (`appearOnLeaderboard`,
  Phase 1) and the 2.0 gate enforces it on `onSubmissionWrite`. 2.1b does NOT touch the leaderboard.

## Phase 1 — confirm sites (report inline, then PROCEED; stop only if a site needs real rewiring)
1. The wizard submit path — confirm where `unitId` is resolved (`userProfile?.unitId ?? null`) so
   the BM branch can write the sentinel. Confirm UM/agent resolution is unaffected.
2. grep for per-unit grouping/aggregation that groups or filters by `unitId` and would treat the
   sentinel as a unit — list them (these need the exclusion).
3. Confirm `getBranchProducerIds` + its use in the `getAllYTDSubmissions` BM path (from 2.1a).

## Phase 2 — build
- **Entry-gate:** extend the agent-wizard trigger gate to `role === 'unit_manager' || role ===
  'branch_manager'`. SM/TA blocked. Both the handler and the ManagerOverviewTab button.
- **Sentinel write:** in the submit path, write `unitId = '__branch_direct__'` (named constant)
  when `role === 'branch_manager'`. UM/agent paths unchanged.
- **Branch scope:** extend `getBranchProducerIds` to agents + UMs + BMs. Verify the BM-path of
  `getAllYTDSubmissions` now returns the BM's submission.
- **Sentinel exclusion:** in every per-unit grouping site from Phase 1, skip `'__branch_direct__'`.

## Phase 3 — tests
- Entry-gate: a BM sees/triggers the wizard; SM/TA do not; UM still does.
- BM submission: a BM personal submission counts in `teamYTDAPI` (branch total) and is absent from
  every unit total and from per-unit grouping.
- Compliance: a BM is NOT in the compliance denominator.
- Keep the suite green.

## Phase 4/5 — docs + PR
- CONTEXT.md per Rule 16 (live UI + roll-up change → advances HEAD); FOLLOW_UPS. Branch
  `feat/producing-mgr-2-1b-bm-branch-direct`. Rule 21 / 20.

## Smoke
**Post-merge (frontend + client-service auto-deploy; no `firebase deploy`).** Write-read-verify:
as a BM, open the wizard, file a personal submission → it rolls into the BRANCH production total
(`teamYTDAPI`) and appears in NO unit total / NO phantom unit. Confirm UM/agent still work and
SM/TA still can't open the wizard.

## Merge posture
Build-and-hold — human-merge (greenfield roll-up + a behavior change to the branch total).
Frontend + client-service → Vercel auto-deploys on merge; no CF/rules deploy.

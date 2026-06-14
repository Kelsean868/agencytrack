# Producing-Manager — Phase 1: leaderboard-visibility model (foundation)

## Context
Phase 1 of the producing-manager personal-production feature (spec:
`producing-manager-personal-production-spec.md`). Before any manager can file an agent WAR
without polluting the agent leaderboard, the leaderboard must filter on a **visibility flag,
not role**. This phase builds that model. **RISKY PR — Cloud Function + Firestore rules + a new
user-doc flag → Phase-1 HARD-STOP, then build-and-hold (no deploy).**

## Locked decisions (from the source chat — surface any deviation)
- `hiddenFromLeaderboard` boolean on the user doc; default **false** for agents and UMs.
- `leaderboardAggregate` filters on `hiddenFromLeaderboard`, **NOT on role** (this reverses the
  banked non-agent-UID filter premise — UMs must remain on the board by default).
- The flag is settable on **self** only by role ≥ branch_manager; on **others** only within the
  setter's **branch** scope (branch-bounded).

## Phase 1 — HARD-STOP recon (report findings, then STOP and wait for dispatcher review)
This is a rules/CF/new-flag change — do NOT build past recon without sign-off.
1. `leaderboardAggregate` (functions/) — exactly how does it currently include/exclude entries?
   Confirm whether it filters by role today, and where a `hiddenFromLeaderboard` check would slot
   in. Quote the relevant lines.
2. The two banked FUs — the `leaderboardAggregate` non-agent-UID filter and the ManagerDashboard
   WizardForm path. Quote their current state / banked notes so the re-scope (visibility-not-role)
   is precise and neither silently strips UMs.
3. User-doc schema + the rules for user-doc writes — where the flag lives, and the current rules
   governing who can write another user's doc fields (for the branch-bounded set).
4. How "the setter's branch" is resolvable in rules (is branch derivable from the auth token /
   user doc for a branch-bounded write check?).
5. Whether the agent leaderboard has any existing visibility/exclusion mechanism (e.g. the BM's
   own unit being excluded as a reporting/training unit) to reconcile with, not duplicate.
**Then STOP.** Paste the recon back. The build proceeds only after dispatcher review.

## Phase 2 — build (only after recon sign-off)
- Add `hiddenFromLeaderboard` to the user-doc schema (default false).
- Re-scope `leaderboardAggregate` to filter on the flag, not role.
- Firestore rules: allow setting the flag on self for role ≥ branch_manager, and on others only
  within the setter's branch.
- Hide-toggle UI: a BM+ can toggle their own visibility and that of individuals in their branch.
- Reconcile (not duplicate) any existing leaderboard-exclusion mechanism.

## Phase 3 — tests
- `leaderboardAggregate`: a UM (flag false) is included; anyone with the flag true is excluded;
  role no longer drives inclusion.
- Rules: a BM can set the flag within-branch; cannot cross-branch; an agent/UM cannot self-hide.
- The toggle writes the flag correctly.

## Phase 4/5 — docs + PR
- CONTEXT.md per Rule 16(b). Branch `feat/producing-mgr-leaderboard-visibility`. Rule 21 / 20.

## Smoke
**Post-deploy** (CF + rules) — so it runs after Kyron deploys, not pre-merge. Verify a UM stays
on the leaderboard, a BM-hidden individual drops off, and a cross-branch hide is rejected.

## Merge posture
**Build-and-hold — human-merge, and the CF + rules DEPLOY is Kyron's.** Do not merge, do not
`firebase deploy`. Open the PR, report, hold. This is correctness-critical (public competitive
data) and security-relevant (cross-branch writes) — it gets human eyes and a deliberate deploy.

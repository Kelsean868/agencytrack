# PROMOTION RUNBOOK — Nexus v2 Redesign: staging -> production (2026-07)

Scope: promotes Fable Run 1 (redesign build) + Run 2 (verification/hardening fixes)
from the staging branch to main/production. Operator-executed. Nothing here is
autonomous; every deploy is a manual command by the operator.

CORE ORDERING PRINCIPLE: backend first, frontend second. All rules/indexes/
functions changes are ADDITIVE (new arms, new collections, new role, one key
rename in a block nothing in prod exercises yet) — deploying them under the OLD
frontend is harmless. Merging the frontend FIRST would create a window where new
surfaces hit missing rules/indexes. So: deploy backend to prod -> verify old prod
still healthy -> merge staging->main (Vercel ships the new frontend into an
environment already prepared for it).

---

## PHASE 0 — PRECONDITIONS (all must be true before anything deploys)

0.1 Flag review complete. Read each diff on the staging branch (deepest first):
    F1 cro role        - firestore.rules arms + Arm E + functions CREATION_MATRIX
    F2 appointments    - rules block + 3 composite indexes
    F3 recruitingCandidates - rules block
    F4 WAR reviewer arm - upline review writes + self-approval ban
    F5 weeklyPlans key fix - contactsMade -> telContacts in validPlanWrite
    F6 prospect index flip - intendedAppointmentDate desc -> asc composite
0.2 Staging eyeball done (seeded environment click-through: campaigns numbers,
    kiosk rotation incl. podium, Meeting Mode deck, Game Plan, Master Sheet).
0.3 VH suite green at the promoting SHA (33/33; re-run if staging moved since).
0.4 State capture (from C:\Projects\at-fable-staging):
      git fetch origin
      git status                      -> clean, HEAD == origin/staging
      git rev-parse HEAD              -> record PROMOTE_SHA
    And from C:\Projects\AgencyTrack (main):
      git rev-parse origin/main       -> record PREPROMOTION_MAIN_SHA
    (PREPROMOTION_MAIN_SHA is the rollback anchor for rules/functions.)
0.5 Pick a quiet window. Pilot is postponed so prod traffic is minimal, but do
    not run this mid-demo.

---

## PHASE 1 — BACKEND TO PROD (from the staging worktree; files = PROMOTE_SHA)

Run from C:\Projects\at-fable-staging. Use EXPLICIT --project on every command.
Do NOT use deploy-staging.ps1 (its guard is staging-only by design; these are
the manual prod deploys your workflow reserves for the operator).

1.1 Indexes FIRST (they build asynchronously; start them early):
      firebase deploy --only firestore:indexes --project agencytrack-2a610
    IMPORTANT: if the CLI asks to DELETE indexes not in firestore.indexes.json
    (it will list the old prospect DESC composite), ANSWER NO / decline all
    deletions. The old frontend still queries DESC until Phase 2 merges; deleting
    now breaks live prospect lists. Stale-index cleanup is Phase 4.
    Verify: Firebase console -> Firestore -> Indexes -> new composites show
    Building/Enabled. Wait for Enabled before Phase 2 (small prod collections;
    typically minutes).

1.2 Rules:
      firebase deploy --only firestore:rules --project agencytrack-2a610
    Wait the 2-5 minute propagation window (standing rule) before judging any
    behavior.

1.3 Functions (redeploys ALL functions from PROMOTE_SHA; the only logic change
    is CREATION_MATRIX + cro, but treat it as a full functions release):
      firebase deploy --only functions --project agencytrack-2a610
    First deploy may take several minutes (Cloud Build).

1.4 Prod kiosk IAM grant (the staging-discovered requirement, twin command):
      gcloud projects add-iam-policy-binding agencytrack-2a610 --member="serviceAccount:agencytrack-2a610@appspot.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator"
    Confirm the printed policy contains ONLY agencytrack-2a610 principals.

1.5 OLD-FRONTEND HEALTH CHECK (the gate between phases): log into production
    (real account) and click through 3-4 screens (dashboard, prospect list,
    policy ledger, weekly report). Everything must behave exactly as before —
    the backend changes are additive and invisible to the old frontend. Any
    breakage here = STOP and execute Phase 5 rollback (backend only, frontend
    untouched, blast radius minimal).

---

## PHASE 2 — FRONTEND: MERGE staging -> main

2.1 Open a PR: base main, compare staging. Title: "Promote Nexus v2 redesign
    (Fable Runs 1+2)". The diff is large (~60 commits); the flag review in 0.1
    already covered the sensitive parts.
2.2 CI must be green (functions-tests + lint-and-build required checks;
    CodeRabbit will be noisy on a diff this size — read its summary, don't chase
    nits; Gemini-hang rule applies).
2.3 MERGE STRATEGY: use "Create a merge commit" — NOT squash. Squashing ~60
    commits destroys the per-item history, telemetry, and red-verified fix
    commits that the checklists reference. This is the one PR where a merge
    commit is correct. (If the repo's merge-commit option is disabled, enable it
    in Settings -> General -> Pull Requests for this merge, then re-disable.)
2.4 Merge. Vercel auto-deploys main -> production frontend.
2.5 Verify: git checkout main; git pull; git log origin/main --oneline -3
    (merge commit on top). Vercel dashboard -> production deployment building
    from the merge SHA.

---

## PHASE 3 — POST-MERGE PROD VERIFICATION (manual; do NOT run the VH suite
against prod — it MUTATES data and its seeded accounts do not exist there)

3.1 Feature flags stay OFF in prod: the three shells (persistencyV2,
    policyLedgerCampaignLens, awardsProvenance) fail closed when
    config/settings.featureFlags is absent. Verify prod config/settings has no
    featureFlags field, and the shells do NOT render. Do not add the field.
3.2 Click-through as your real agent test account: dashboard -> Game Plan
    (instant, no pop) -> prospect list (SOONEST FIRST — the flip, live) ->
    Cmd-K palette (navigate + one create action) -> a dialog (Escape/focus
    return) -> dark mode toggle.
3.3 As tenant-admin: Users/Branches tables, admin quick-add, drag-reorder
    persists across reload.
3.4 Console clean on every screen visited (F12 -> no uncaught errors).
3.5 Motion: scripts/verification/motion-verifier.mjs --runs 5 against prod
    dashboard->game-plan (read-only, safe): expect ~0 pop.
3.6 CRO role: do NOT create a prod CRO user yet — the role works (staging-
    proven) but real CRO onboarding is a business decision post-promotion.

---

## PHASE 4 — CLEANUP + RECORD

4.1 Stale index: Firebase console -> Firestore -> Indexes -> delete the old
    prospect DESC composite (now unused by the merged frontend).
4.2 Merge the held chore/tier0-smoke branch (PR -> main; trivial SMOKES.md
    conflict possible — keep both rows).
4.3 Post-merge sync dispatch (Sonnet): CONTEXT.md (Runs 1+2 promoted; prod at
    merge SHA), FOLLOW_UPS.md (bank: C3 WAR-status-to-owner, C4 streak
    milestones, manager loggingMode override + provenance fields, noticeboard,
    kiosk per-slide config, prospect callbackDueAt, plan-review banner, mobile
    presenter remote, density substrate, tunable-constants surface, prod kiosk
    rotation eyeball on a real TV).
4.4 Prune: at-fable-staging worktree STAYS (staging is the standing environment
    now); delete merged docs/* brief branches; git fetch --prune.
4.5 Staging re-baseline: in at-fable-staging, merge main back into staging
    (post-merge they should be identical or trivially so) so the branches do
    not drift.

---

## PHASE 5 — ROLLBACK POSTURE (per component; know these BEFORE starting)

FRONTEND (fastest lever, use first): Vercel dashboard -> Deployments ->
  previous production deployment -> "Instant Rollback". Prod frontend reverts in
  seconds; backend additive changes are harmless underneath it.
RULES: from any worktree:
      git show PREPROMOTION_MAIN_SHA:firestore.rules > rollback.rules
  swap into place and deploy --only firestore:rules --project agencytrack-2a610.
  (Or: git checkout PREPROMOTION_MAIN_SHA -- firestore.rules; deploy; restore.)
FUNCTIONS: same pattern from PREPROMOTION_MAIN_SHA (functions/ directory),
  deploy --only functions.
INDEXES: additive ones are harmless to leave; nothing to roll back (the old DESC
  index was retained in 1.1 precisely so old code keeps working).
GIT: avoid reverting the merge commit (git revert -m 1 poisons future re-merges
  of staging). Prefer Vercel rollback + backend redeploy. Full git revert only
  if abandoning the promotion entirely — and talk to the architect first.

---

## ABORT CRITERIA
- Phase 1.5 old-frontend breakage -> rollback backend, investigate in staging.
- Phase 2 CI red on the promotion PR -> fix on staging, re-run VH, retry.
- Phase 3 any new-surface correctness failure -> Vercel instant rollback
  (backend stays; it is additive), fix in staging, re-verify, re-merge.

# Functions Day — kickoff: leaderboardAggregate crash fix + S3b persistency-nudge recon

## Context
The banked Functions items (Task #7). **RISKY — touches `functions/**` → Phase-1 HARD-STOP
recon, build-and-hold, NO `firebase deploy`.** The deploy is a deliberate Functions-day window
Kyron runs. Two items, different readiness:
- **leaderboardAggregate crash fix** — tractable: recon the crash, fix it, hold.
- **S3b persistency-nudge CF** — NO behavior spec exists yet → recon + propose only; do NOT
  build it until the design is confirmed.

## Phase 1 — HARD-STOP recon (report, then STOP for dispatcher)
1. **leaderboardAggregate crash:** find the CF, identify the crash (stack/condition — null
   field, missing doc, bad aggregation?). Quote the failing path. Note: the producing-manager
   feature will later re-scope this same CF to a visibility flag — flag any overlap so the fix
   doesn't collide with that re-scope.
2. **S3b persistency-nudge:** recon the existing nudge/notification patterns (how other nudge
   CFs fire, the notification write shape), the persistency floor (90%), and where a
   below-floor agent is identifiable. Report what a persistency-nudge CF *would* need — do NOT
   design or build it yet.
**Then STOP.** Paste the recon back.

## Phase 2 — build (only after recon sign-off)
- **leaderboardAggregate crash fix ONLY** — apply the minimal fix for the identified crash,
  with a test reproducing the crash condition. Build-and-hold.
- **S3b: do NOT build.** Hold for the dispatcher to spec it from the recon.

## Phase 3 — tests
- A functions-test reproducing the leaderboardAggregate crash → passing after the fix.

## Phase 4/5 — docs + PR
- CONTEXT.md per Rule 16. Branch `fix/leaderboard-aggregate-crash`. Rule 21 / 20.

## Smoke
**Post-deploy only** (CF) — runs after Kyron's Functions-day deploy, not pre-merge. Verify
leaderboardAggregate runs without the crash on the live data path.

## Merge posture
**Build-and-hold — human-merge, and the CF DEPLOY is Kyron's Functions day.** Do NOT merge,
do NOT `firebase deploy`. The crash fix overlaps the producing-manager leaderboardAggregate
re-scope on the same file — note it so Kyron sequences the merges (crash fix first).

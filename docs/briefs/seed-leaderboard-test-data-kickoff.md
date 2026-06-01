# Track J — Test-data provisioning + leaderboard seed

**Sized:** M
**Branch:** `chore/seed-leaderboard-test-data` (off main)
**Type:** Verification/demo **data infrastructure**, not a user-facing feature. Provisions an SM test account and seeds two weeks of submissions for the test tenant, then recomputes the aggregate and verifies. **Writes to the prod Firebase project (test tenant only).** **Two-gate lifecycle: dry-run → dispatcher pre-review → authorized live run.**

## Why

Half our live verification currently reads "even/empty" because `tatillife_south` has no real production: the WEEK podium is suppressed (all $0), movement shows only "even," the around-me below-set states are unreachable, and the champions banner is honest-empty. This seed lights all of it up and doubles as a demo dataset. It also provisions the SM account P5b needs.

## ⚠️ Prod-write safety (non-negotiable)

- **Confined to the test tenant `tatillife_south`**, which has no real users (pilot postponed; all accounts are test accounts). Phase 1 must re-confirm this before any write.
- **Idempotent:** deterministic doc IDs (`{agentId}_{weekStarting}` for submissions) so re-running overwrites rather than duplicates.
- **Marked:** every seeded doc carries a `seededTestData: true` field.
- **Reversible:** the runbook documents an exact cleanup (delete by the deterministic IDs / the marker field).
- **SM account via the canonical path:** if provisioning a `sales_manager` account, tenantId MUST be written to BOTH the user doc AND the Firebase Auth custom claim in a single transactional path (the standing account-creation acceptance criterion). Use the existing account-creation service, not a hand-rolled write.

## Data design (the thing I pre-review at the dry-run)

- **Two weeks:** the prior completed week and the current WAR week.
- **Deliberately different rankings across the two weeks** so movement chips render real ▲/▼ — e.g., agent A leads the prior week then drops, agent B climbs to lead the current week. Include at least one ranked-$0 agent (keeps the ranked-$0 coverage live).
- **Both branches:** seed `tatil_south` (6 agents) and the second branch (`ljbBHP1g7lbZXvHlpcDn`, 3 agents) so P5b's cross-branch picker has rich data on both sides.
- Values realistic for TTD API + apps + the activity fields the ranking reads.

## Phase 0 — pre-flight

1. `git fetch origin`; sync main; `git log origin/main --oneline -1` verbatim.
2. Move brief → `docs/briefs/seed-leaderboard-test-data-kickoff.md`; branch `chore/seed-leaderboard-test-data`; commit as commit 1.

## Phase 1 — source-verify

1. The submission doc schema — exactly which fields the aggregate ranking reads (agentId, weekStarting, API, apps, the activity fields), and how branchId joins via the user doc.
2. The test agents' UIDs + their unit/branch assignments (so seeded rankings are sensible per unit/branch).
3. The recompute callable (`recomputeLeaderboardOnDemand`, TA-only) and how to invoke it post-seed.
4. The canonical account-creation service for the SM provision (transactional tenantId → doc + claim).
5. **Re-confirm `tatillife_south` has no real (non-test) users** before authorizing any write.
6. Any existing seed-script pattern in the repo to mirror.
7. Drift/anything making prod-write unsafe → STOP and surface.

## Phase 2 — build (NO live writes yet)

- Write the provision+seed script: provisions the SM account (canonical path) if absent; generates the two-week submissions per the data design; deterministic IDs; `seededTestData` marker.
- The script MUST support a **dry-run mode** that logs every account + doc it WOULD write, with NO actual writes.
- Write the cleanup path (delete seeded docs by deterministic ID / marker) into the runbook.

## Phase 3 — DRY-RUN + gates

- Lint clean.
- Run the script in **dry-run**: capture the full log of what it would provision + write (the SM account spec, every submission doc with its ranking, both branches).
- hex-grep n/a (no UI); scope check (script + runbook + brief + docs only).

## Phase 4 — docs

- Runbook `docs/runbooks/seed-leaderboard-test-data.md`: how to dry-run, how to run live, how to clean up.
- CONTEXT/FOLLOW_UPS rows (`#{TBD}`/`{TBD}`); note this resolves the thin-test-data FU and provisions the SM account for P5b.

## Phase 5 — PR + STOP for pre-review (BEFORE any live write)

Open PR with the script + runbook + **the dry-run output**. STOP. I pre-review the data design (rankings producing the intended ▲/▼, the ranked-$0 inclusion, both-branch coverage), the idempotency, the SM-account spec, and the cleanup path — *before* anything is written.

## Phase 6 — authorized live run (separate dispatcher action)

After I pre-review and you merge the script PR AND explicitly authorize the live run:
1. Run the script LIVE against `tatillife_south` (provision SM + seed both weeks/both branches).
2. Invoke `recomputeLeaderboardOnDemand` to rebuild the aggregate + champions.
3. **Verify:** read back the aggregate — assert a populated current-week podium, WEEK `previousRank` producing real ▲/▼ vs the prior week, both branches populated, and `weeklyChampions/{prevSunday}` now non-null. Report verbatim.
Rule 15 on any direct-to-main doc push.

## Acceptance criteria

- SM test account exists (canonical transactional path); two weeks of submissions seeded across both branches with rankings that yield real movement; recompute run; verification confirms populated podium + real ▲/▼ + populated champions; idempotent; marked; cleanup documented. No real-user data touched.

## Out of scope

P5b UI. Any production-tenant (non-test) data. Schema/CF changes.

## Rule references

Rule 10, 11, 12, 15, 17, 19. Account-creation transactional acceptance criterion.

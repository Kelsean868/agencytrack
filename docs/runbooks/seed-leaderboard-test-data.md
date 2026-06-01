# Runbook — seed-leaderboard-test-data

**Owner:** dispatcher (Kyron). **Status:** dry-run script in place; live run is a SEPARATE authorized dispatcher action.

## What this seeds

- Provisions an SM (`sales_manager`) test account in `tatillife_south` via the canonical transactional saga (Auth.createUser → setCustomUserClaims → Firestore user doc; compensating delete on failure) — **only if absent**. Reads the SM email/password from `A11Y_SALES_MANAGER_*` env vars.
- Two weeks of submissions across both branches with **deliberately different rankings** so the live leaderboard surfaces show real ▲/▼ movement, a populated podium, and non-null `weeklyChampions/{prevSunday}`. Includes at least one ranked-$0 agent per branch.
- All seeded docs carry `seededTestData: true` for reversibility.
- Idempotent: deterministic submission IDs `{agentId}_{weekStarting}` mean re-running OVERWRITES rather than duplicates.

## Pre-conditions

1. Working in a freshly-synced main branch checkout.
2. `functions/service-account-key.json` present (gitignored; not in the repo).
3. `.env.local` populated with `A11Y_SALES_MANAGER_EMAIL` + `A11Y_SALES_MANAGER_PASSWORD` (if SM provisioning is desired).
4. Tenant `tatillife_south` has NO real (non-test) users. The script re-checks at runtime and hard-stops if any non-test email appears (allowlist: `@agencytrack.test`, `@tatillife.com`, `kelsean+...@gmail.com`, `kelsean@gmail.com`).
5. Dispatcher has reviewed the dry-run output and authorized the live run.

## Dry-run (safe; logs only — NO writes)

```
cd functions
node scripts/seed-leaderboard-test-data.cjs --dry-run
```

The dry-run logs:
- The tenant safety check (lists user count + confirms no non-test emails)
- The agents resolved per branch (with UIDs)
- The SM provision spec (or "already exists" — skipped)
- Both weeks (prior + current) with the full submission write list (truncated to 6 examples for readability)
- A movement-preview table per branch — prior-rank → current-rank → ▲/▼/– with magnitudes

Dispatcher pre-reviews this output BEFORE authorizing the live run.

## Live run (authorized dispatcher action)

```
cd functions
node scripts/seed-leaderboard-test-data.cjs --execute --i-confirm-prod-write
```

`--execute` REQUIRES `--i-confirm-prod-write` (defense-in-depth typo guard).

What the live run does, in order:
1. Re-checks the tenant safety lock (hard-stops on any non-test email).
2. Resolves agents per branch.
3. If SM doesn't exist: provisions via transactional saga (Auth → claims → Firestore; compensating delete on any failure).
4. Writes all submission docs in a single Firestore batch (well under the 500-op limit).
5. Reports the batch summary.

After the script returns, the dispatcher invokes the recompute callable to rebuild the aggregate + champions:

```
# As tenant_admin via Firebase JS SDK (e.g., from an authenticated browser console or test harness)
# functionsClient.httpsCallable('recomputeLeaderboardOnDemand')({})
```

Expected response shape (post-seed):
```js
{
  ok: true,
  tenantId: 'tatillife_south',
  branchCount: 2,                  // both branches now have data
  totalSubmissions: <≥ 13 + existing>,
  totalUsers: <existing>,
  priorWeekStarting: '<YYYY-MM-DD>',
  championsPriorWeekAgents: <≥ existing + seeded>,
}
```

## Verification (Phase 6 post-recompute)

Read back the aggregate to confirm:
- `leaderboards/tatil_south` and `leaderboards/{ljbBHP1g7lbZXvHlpcDn}` both written with populated current-week podium (rank 1 ≠ 0, multiple agents with positive API).
- WEEK entries carry `previousRank` ≠ rank for the climbers + droppers (real ▲/▼).
- `weeklyChampions/{priorWeekStarting}` doc has non-null `topAPI`, `topApps`, `topActivity`.

A purpose-built verification script may be added later; for the initial run, the existing `scripts/verification/aggregate-enrichment-prod-smoke.mjs` covers the leaderboard read path.

## Cleanup

To remove all data this script seeded:

1. **Submission docs** — delete every doc in `tenants/tatillife_south/submissions` where `seededTestData == true`:

   ```
   # Pseudo — adapt for your runner. Admin SDK only.
   const snap = await db.collection('tenants/tatillife_south/submissions')
     .where('seededTestData', '==', true).get();
   const batch = db.batch();
   snap.docs.forEach(d => batch.delete(d.ref));
   await batch.commit();
   ```

2. **SM account** — only if THIS script provisioned it (check the user doc's `seededTestData == true` flag):

   ```
   const userDoc = await db.doc('tenants/tatillife_south/users/{SM_UID}').get();
   if (userDoc.exists && userDoc.data().seededTestData === true) {
     await admin.auth().deleteUser(SM_UID);
     await userDoc.ref.delete();
   }
   ```

3. **Re-recompute** the aggregate after cleanup so the leaderboard reflects the post-cleanup state:

   ```
   functionsClient.httpsCallable('recomputeLeaderboardOnDemand')({});
   ```

## Safety notes

- The script CANNOT be redirected to a different tenant — `tatillife_south` is hardcoded.
- `--execute` REQUIRES `--i-confirm-prod-write` — single-flag typos cannot trigger a live write.
- All seeded user docs (the SM, if any) carry `seededTestData: true`; cleanup never touches an account this script didn't create.
- Idempotent: re-running `--execute` overwrites the same submission docs (deterministic IDs) without creating duplicates.

## References

- Brief: `docs/briefs/seed-leaderboard-test-data-kickoff.md`
- Canonical SM-account pattern: `functions/scripts/seed-first-tenant-admin.cjs` (the saga template)
- Submission schema fields the aggregate reads: `functions/leaderboard/leaderboardAggregate.js` (`extractTotalProductionCredit`, `extractApplicationsSold`, `extractFFIConducted`, `extractCIConducted`, `extractActivity`)
- Recompute callable: `recomputeLeaderboardOnDemand` (tenant_admin / platform_admin only)

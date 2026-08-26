# Kickoff brief — Daily Capture call fields: the type split, `serviceCalls`, `referralsObtained`

**Drafted:** 26 August 2026 · **Merge channel:** HUMAN-MERGE (schema version bump + new write path)
**Model:** Opus 5 · **Effort:** high
**repomix:** pack FULL. This brief touches `functions/` — scoped packs are forbidden there (CLAUDE.md, Rule 17).
**Deploy gate:** `aggregateDailyToWeekly` lives in `functions/`. Merging does NOT ship it.
`firebase deploy --only functions` is a named deliverable below, not an afterthought.

---

## Why this exists

KQM Calls (`calls.kqminsurance.com`, Supabase) is to feed AgencyTrack call KPIs through a new
ingest endpoint. It holds two facts the daily schema cannot: **which campaign a call belonged
to** (cold list vs follow-up vs referral vs own portfolio) and **whether a referral came out of
it**. Today both are dropped on the floor between the daily doc and the weekly report.

This slice widens the daily schema so that detail survives. It does NOT build the endpoint.

---

## Phase 0 — audit findings (completed 26 Aug 2026, quoted from current source)

| # | Finding |
|---|---|
| **F1** | `createEmptyDailyEntry` holds a single `dials` integer and no call-type split. `src/lib/schema/dailyActivity.js` |
| **F2** | Both aggregator twins set `coldCalls = Σdials` and hard-zero `referralCalls` / `followUpCalls` / `seminarTradeshowCalls`. `functions/aggregators/dailyToWeekly.js`, `src/lib/schema/dailyActivity.aggregator.js` |
| **F3** | Neither aggregator writes `serviceCalls` at all — but `computeDayPoints` maps `serviceContacts → serviceCalls` (`src/components/daily/DailyCaptureV2.helpers.js:78`). **The daily pace badge and the aggregated weekly draft therefore score the same week differently.** This is a live defect, independent of this brief's original purpose; ruling D-SC below closes it. |
| **F4** | `referralsObtained` is a weekly field scored at **3pt** (`src/lib/gamificationConfig.js:12`), and is absent from both `createEmptyDailyEntry` and `normalizeDailyEntry`. A referral cannot be recorded on a daily entry at all. |
| **F5** | **Splitting `dials` is points-neutral.** `src/lib/computePoints.js:20-24` sums the four dial types and floors **once**; all daily values are integers via `pi()`. Preserve the sum, preserve the score. |
| **F6** | Two call totals already exist and both must stay correct: `extractFields.totalTelAttempts` is the **4-sum** (`src/utils/extractFields.js:122`); `planVariance` deliberately uses the **5-sum including `serviceCalls`** to match the wizard's Step-2 total. |
| **F7** | `src/hooks/useSeededTargets.js:33` seeds Target Dials from `data?.dials ?? data?.coldCalls` — cold bucket only on the full path. Ruling D-TD below changes this. |

---

## Decisions locked

1. **`dials` stays the authoritative total.** The split is **additive**: a new
   `dialsByType: { cold, referral, followUp, seminarTradeshow }` object on the daily entry.
   F5's sum-preservation guarantee only holds while the total remains authoritative, and every
   existing daily doc keeps working with no migration.
2. **The invariant is property-tested:** `dials === cold + referral + followUp + seminarTradeshow`
   whenever any breakdown value is non-zero. When all four are zero the aggregator falls back to
   today's behaviour (`coldCalls = Σdials`, siblings 0). **Pre-v2 docs therefore aggregate to
   byte-identical weekly numbers.**
3. `referralsObtained` is added to `createEmptyDailyEntry`, `normalizeDailyEntry` and both
   aggregators, summed with `sumInt`.
4. `DAILY_ACTIVITY_VERSION` 1 → 2. `weeklyReportVersion` unchanged.
5. **Both aggregator twins change in the same commit.** They are not byte-identical today —
   the ESM copy imports from `weeklyReport.computations.js` and uses optional chaining; the CJS
   copy inlines the helpers and uses explicit `&&`. "In sync" means behaviour, not bytes.
6. **No dials-split UI in this slice.** `DailyCaptureV2` keeps its single "Dials (total calls)"
   stepper (`DailyCaptureV2.jsx:969`). The breakdown is written only by the ingest endpoint,
   because an agent typing at the end of the day cannot know the split and the calling app can.

### D-SC — `serviceCalls` (dispatcher ruling, 26 Aug 2026)

7. **The aggregators WILL write `serviceCalls`**, closing the F3 points disagreement.
   **It is sourced from a NEW daily `serviceCalls` field — NOT from `serviceContacts`.**
   Reusing `serviceContacts` would make an attempt and a contact the same number, the exact
   conflation `src/lib/schema/callRecord.js` exists to prevent.
   Consequences the implementation must honour:
   - `serviceCalls` is added to `createEmptyDailyEntry` and `normalizeDailyEntry` (integer).
   - `computeDayPoints` stops mapping `serviceContacts → serviceCalls` and reads the real field.
     **This changes existing daily pace-badge scores** where `serviceContacts > 0`: those days
     currently earn 1pt per service contact and will earn 0 until the new field is populated.
     Say so in the PR description — it is a deliberate correction, not a regression.
   - `serviceCalls` stays **excluded from every funnel sum** (`src/utils/funnelModel.js:84`).
     This ruling does not reopen that; servicing is still not new-business activity.
   - The FOLLOW_UPS item asking whether converted service calls should count as Tel Contacts
     is **untouched and still open**. Do not infer an answer from this ruling.

### D-TD — "Target Dials" means the 4-sum (dispatcher ruling, 26 Aug 2026)

8. `useSeededTargets.js:33` changes from `data?.dials ?? data?.coldCalls` to: `dials` when
   present (fast path unchanged), otherwise the **sum of `coldCalls + referralCalls +
   followUpCalls + seminarTradeshowCalls`**. This matches `extractFields.totalTelAttempts`
   (F6) — read that helper rather than re-summing inline, so a fifth call type can never
   create a third definition of the same total. `serviceCalls` is NOT in this sum.
   Update the dependency array at `useSeededTargets.js:58-59` accordingly, and close the
   FOLLOW_UPS "Target Dials" open question in Phase 4.

---

## File inventory (scope-lock)

```
src/lib/schema/dailyActivity.js              schema + normalize + version bump + serviceCalls + referralsObtained
src/lib/schema/dailyActivity.aggregator.js   ESM twin
functions/aggregators/dailyToWeekly.js       CJS twin
functions/aggregators/sundayDailyToWeekly.js read-only check: confirm no drift
src/components/daily/DailyCaptureV2.helpers.js  computeDayPoints — D-SC only
src/hooks/useSeededTargets.js                D-TD only
src/lib/schema/dailyActivity.test.js         property + fallback tests
src/hooks/__tests__/useSeededTargets.test.js D-TD coverage
src/components/daily/__tests__/DailyCaptureV2.test.jsx  D-SC coverage
docs/CONTEXT.md                              Phase 4 only
docs/FOLLOW_UPS.md                           Phase 4 only, append per Rule 7(b)
```

Anything outside this list is a Rule 9 surface.

---

## Phases

1. **Discovery gate.** Re-read the source files against F1–F7 and confirm each still holds.
   Quote current source for any that has moved. STOP and wait for dispatcher if F5 no longer
   holds — the whole additive design rests on it.
2. **Schema.** Locked decisions 1, 3, 4, and the new `serviceCalls` field from D-SC.
   No aggregator changes yet.
3. **Aggregators + tests.** Both twins, the fallback path, the property test, D-SC's
   `computeDayPoints` repoint, D-TD's seed change.
4. **Docs.** CONTEXT.md row. FOLLOW_UPS: close the Target Dials question, leave the
   service-calls-as-Tel-Contacts question open and say explicitly that D-SC did not answer it.

---

## Named deliverables

- **Property test** in `src/lib/schema/dailyActivity.test.js` using `fast-check`, `numRuns` 200,
  seed `20260826`: the split invariant, and conservation of `computePoints` across split-vs-total
  for the same week.
- **Evidence paste-back** in the PR description: aggregator output for one pre-v2 daily doc and
  one v2 doc with a breakdown, side by side, showing the weekly call numbers are unchanged for the
  pre-v2 case. Plus a second pair showing the F3 points disagreement before and after D-SC.
- **Smoke walk** on the Vercel preview, both themes: open Daily Capture, save a day with dials
  and service calls, confirm the pace badge total and the aggregated weekly draft agree.
  Read-only against the preview — never a mutating smoke on a feature-branch preview.
- **`firebase deploy --only functions`** with the output captured in the PR description. The cron
  aggregator does not ship on merge.
- **Post-merge fill:** CONTEXT.md `Recently shipped` row carrying the **squash** SHA from
  `git log origin/main --oneline -1`.

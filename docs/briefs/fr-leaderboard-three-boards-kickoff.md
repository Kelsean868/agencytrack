# FR Leaderboard — three boards (Activity · API · Apps) — kickoff brief

**Author:** Claude (architect), 1 Oct 2026 · **Dispatcher:** Kyron
**Design (canonical):** canvas "AgencyTrack — Free Redesign", boards `D3-Leaderboard` (desktop) and `M3-Leaderboard` (phone), version 43. Approved by Kyron 1 Oct 2026.
**Merge channel:** every slice is **human-merge** (functions code, product judgement, kiosk data).
**Model:** L-1 → Opus 5.5, effort **high** (server money math, ranking). L-2 → Opus 5.5, effort **medium**. L-3 → Sonnet 5.5, effort **medium**.
Delegate searches, test runs and log reads to Haiku 4.5 subagents; never delegate ledger credit math, ranking or rules (CLAUDE.md § Subagent delegation).

---

## 0. Why

The FR Leaderboard ranks **weekly-report API**. Agents no longer fill that step, so every agent shows **TTD 0** while the ledger holds real settled business (`docs/FOLLOW_UPS.md` ~L5085, UPDATE 2026-09-30). Kyron's ruling (30 Sep 2026): the Leaderboard offers **three boards like the kiosk — Activity (points), API, Apps** — because the app exists to drive activity. It opens on **Activity**.

## 1. Audit findings (verified 1 Oct 2026 against `cc629ce` — re-verify in Phase 1, Rule 17)

| # | Fact | Where |
|---|---|---|
| A1 | `leaderboards/{branchId}` is written by `leaderboardAggregate.js` (hourly `0 * * * *` + admin callable `recomputeLeaderboardOnDemand`). `loadInputs` reads only `submissions` (`status=='submitted'`) + `users`. It never reads `policies`. | `functions/leaderboard/leaderboardAggregate.js:66-74`, `:439-493` |
| A2 | Entry fields today: `agentId, name, unitId, unitName, periodApi, apps, rank, rankWithinUnit, previousRank` (week only). No points. `apps` = weekly `nb.apps + ppp.apps`. | `leaderboardAggregate.js:357-367`, `rankingLogic.js:161`, `:171-177` |
| A3 | Rules already let a branch agent, managers in scope **and the kiosk** read `leaderboards/{branchId}`. Writes are CF-only. **No rules change is needed if we keep this doc.** | `firestore.rules:1365-1378` |
| A4 | Agents cannot read peers' `policies` (`canAccessOwn`) or peers' `dailyActivity` (owner-only). The kiosk has no arm on `policies`. **A server aggregate is mandatory.** | `firestore.rules:388-420`, `:302-306` |
| A5 | Ledger credit: `productionCredit(policy)` → `creditFor` with `GENERAL_CREDIT_TABLE` (Life only; nb 1 app; inc_ppp 1 app only if ≥ TTD 2,400; replacement net API, 0 apps; spia 0/0; lumpsum 10% API, 0 apps; platinum_edge 1 app, 0 API; unclassified abstains). Value `managerSettledAPI ?? settledAPI ?? proposedAPI`. | `src/lib/ledgerProduction.js:60-75`, `src/lib/policyCampaignLens.js:53-148`, `src/lib/policyLedgerDerivation.js:23-31` |
| A6 | Settled = `status=='settled'` OR `confirmedAt` set. Settled production is dated by **`dateIssued`**; no readable `dateIssued` → dropped. Head-office imports (`statusSource==='oipa_import'`) count; origin never decides eligibility (R5). | `ledgerProduction.js:85-89`, `:166-175`, `:22-23`; `src/lib/settledProvenance.js` |
| A7 | Points: `computePoints(fields)` scores one weekly submission (includes `applicationsSold ×25` and `floor(api/1000)`; letters capped at 20 per call). CJS twin exists with a cross-check test. `computeDayPoints` / `computeWeekToDatePoints` exist **client-side only** (Daily Capture pace badge sums day points). | `src/lib/computePoints.js:14-69`, `functions/lib/computePoints.js`, `src/components/daily/DailyCaptureV2.helpers.js:66-91`, `:224-230` |
| A8 | `leaderboard/{uid}.points` is **lifetime only**, awarded on weekly submit. No per-period points exist anywhere. Daily docs store no points. | `functions/index.js:1411-1652` |
| A9 | The Sunday cron writes a **draft** weekly submission (`submissions/{agentId}_{weekStarting}`, `status:'draft'`) from dailies; it never overwrites a submitted one. | `functions/aggregators/sundayDailyToWeekly.js:72-136` |
| A10 | `FrLeaderboardView` hard-codes `periodApi` + `formatCurrency` in podium, rows, you-block, to-pass, rank-per-period bars and share donut. Model helpers (`rankColumns`, `toPass`, `shareOfScope`, `arenaStanding`) read `periodApi`/`api`. | `src/components/fr/compete/FrLeaderboardView.jsx:151-207`, `src/lib/fr/leaderboardModel.js`, `src/lib/fr/competeModel.js:260-284` |
| A11 | Champions strip reads `weeklyChampions/{prevSunday}`; `topActivity` is a COUNT (FFI+CI+apps), not points. | `leaderboardAggregate.js:158-209`, `leaderboardModel.js:86-91` |
| A12 | Kiosk ranked panels (`RankedLeaderboardPanel` via ytd/qtd/mtd/week wrappers) rank **weekly-report API**; `WeeklyActivityPanel` ranks raw counts. Both read submissions directly, not the aggregate. Comment "Ranked by settled API" is false. | `src/components/kiosk/panels/RankedLeaderboardPanel.jsx:20`, `:118-140`; `WeeklyActivityPanel.jsx:133-177` |
| A13 | Ranking ignores `users.active === false` (banked MEDIUM). | `docs/FOLLOW_UPS.md` ~L3940 |
| A14 | Footer copy says "Ranked by the API on submitted weekly reports". `arenaTiles` note "settled API puts you there" is false today. | `FrLeaderboardView.jsx:392-396`, `competeModel.js:297` |

## 2. Decisions locked

**D1 — One aggregate doc, three metrics.** Keep `tenants/{tid}/leaderboards/{branchId}` and its period arrays (`week`, `mtd`, `qtd`, `ytd`). Each entry gains `points` and keeps `periodApi` + `apps`, whose **source changes to the ledger**. Doc-level adds `sources: { api: 'ledger', apps: 'ledger', points: 'activity' }`. No new collection, no rules change, no index (Admin SDK reads).

**D2 — API board = settled API from the ledger.** Per agent, per period: sum of `productionCredit(policy).api` over settled policies whose `dateIssued` (TT, `YYYY-MM-DD`) falls in the period. Counts head-office, manager-confirmed **and agent-confirmed** settled policies (Kyron, Sep 2026). Imports are NOT excluded. Life only (as `creditFor`).

**D3 — Apps board = applications from the ledger.** Same policies and dates as D2, counting `productionCredit(policy).apps`. The weekly-report `nb.apps + ppp.apps` is no longer used by the board.

**D4 — Self/family policies are left out** of both API and Apps (`isSelfOrFamily === true` → skip). Same rule as awards and campaigns. (Kyron, 1 Oct 2026.)

**D5 — Activity board = ALL points** (`POINTS_WEIGHTS` as-is, sales points included). (Kyron, 1 Oct 2026.) Per agent, per Sunday-week:
- a week **before** the current week → `computePoints(submission)` using that week's submission doc, **submitted or draft** (the Sunday cron's draft carries the dailies);
- the **current** week → sum of `computeDayPoints(day)` over the agent's `dailyActivity` docs dated this week — the same number the Daily Capture pace badge shows (`computeWeekToDatePoints`).
- A week is placed in periods by its `weekStarting` (the existing rule — weeks are not split).
Reads stay bounded: YTD submissions (any status) + current-week dailies only.

**D6 — Port, don't fork.** The server needs `productionCredit`/`creditFor`/`GENERAL_CREDIT_TABLE`/`policyValue` and `computeDayPoints`. Add CJS twins under `functions/lib/` and a **cross-check test per twin** that runs the client and server versions over the same fixtures and asserts equal output (pattern: `src/lib/__tests__/gamificationConfig.cross-check.test.js`). No copy without its guard.

**D7 — Ranks are derived on the client.** The aggregate stores metrics. The client ranks each board by its own metric (desc), then the other two metrics (desc), then name. Unit scope uses the same ranker within the unit. The aggregator keeps writing today's `rank` / `rankWithinUnit` (now ledger-API based) so the Nexus `ProductionLeaderboardSurface` keeps working. For movement notes the week entry gains `previousRanks: { activity, api, apps }` (week only); the old `previousRank` stays = `previousRanks.api`.

**D8 — Participants.** Same filters as today (`isTestAccount !== true`, `provisioning !== true`, has `branchId`, agent / UM / BM with `appearOnLeaderboard`) **plus** `active !== false` (closes A13).

**D9 — Champions strip** (`weeklyChampions/{prevSunday}`): `topAPI` and `topApps` from the ledger (last week, D2–D4), `topActivity` = most points last week (D5). Values: API in TTD, apps count, points. Update `leaderboardModel` formatters (`'312 points'`).

**D10 — Opens on Activity.** Board switch order: **Activity · API · Apps**, a radiogroup like the canvas. The choice is NOT persisted (each visit opens on Activity). Period choice keeps today's behaviour.

**D11 — Copy (verbatim — Copy is design).**

| Board | Switch label | Column | Second column | Title | Footer | Empty title | Empty line |
|---|---|---|---|---|---|---|---|
| activity | Activity | Points | Apps | Who's putting in the work {period}. | Activity: ranked by points from everything you log in your branch — calls, appointments, fact finds, closing interviews and sales. | No activity logged {period} yet | The board fills in as agents log their calls and meetings. |
| api | API | Settled API | Apps | Who's leading on API {period}. | API: ranked by settled API from the policy ledger in your branch. | No settled business {period} yet | The board fills in as policies settle in the ledger. |
| apps | Apps | Applications | Settled API | Who's writing the most {period}. | Apps: ranked by applications from the policy ledger in your branch. | No applications {period} yet | The board fills in as applications reach the ledger. |

Every footer ends with: `Own and family policies are left out. Test accounts are left out. Updated {time}.` (activity footer: drop "Own and family…"). Share donut title: `Your share of branch {points | settled API | applications}`.

**D12 — Room for a fourth board.** Boards come from one config object (`LEADERBOARD_BOARDS`) keyed by id with `{label, metric, format, copy}`. Adding Rest Assured later = one entry + one aggregate field. No `if (board === …)` chains in views.

**D13 — Kiosk keeps its look.** L-3 swaps data only: the four ranked panels read the aggregate (D2/D3), and `WeeklyActivityPanel` ranks **points** (D5) — same frame, same timing, same rotation.

## 3. Slices

### L-1 — Aggregate: ledger API/Apps + period points (functions · human-merge · deploy-gated)
1. Phase 1 (STOP and wait for dispatcher with the findings): re-verify A1–A14; confirm the cron draft shape (A9) holds for at least 2 recent weeks on **staging** (read-only Admin script); confirm `dateIssued` format on staging policies (string vs Timestamp) and how `toDateStr` handles both; list every consumer of `leaderboards/{branchId}` fields (`git grep`).
2. Twins + cross-check tests (D6).
3. Extend `loadInputs` (policies, YTD + previous week; all-status submissions; current-week dailies for participants). Compute D2–D5, D7 `previousRanks`, D8, D9. Keep the existing doc keys.
4. Tests (`functions/` suite, `fakeFirestore`): one per decision — D2 date bucketing at TT week/month/quarter edges; D3 inc_ppp 2,399 vs 2,400; D4 self/family skipped; D5 submitted vs draft vs current-week dailies; D8 inactive excluded; **monotonicity** (v3 non-negotiable 3): adding a settled policy or a logged day never lowers that agent's metric.
5. Phase 3 real invocation (Rule 5): a **dry-run** Admin script against **staging** that computes the doc and prints a per-agent table for the staging fixture agents — **no write**. Paste the table.
6. Deploy is a dispatcher action (Rule 19). Pre-merge additive deploy is NOT allowed: existing callers read the changed fields.

### L-2 — FR Leaderboard: three boards (client · human-merge)
Starts after L-1 is merged **and deployed**.
1. `LEADERBOARD_BOARDS` config (D12); metric-aware `leaderboardModel` (`rankColumns`, `toPass`, `shareOfScope`, `boardRows`, `arenaStanding`, champions formatters) and `FrLeaderboardView` (podium, rows, you-block, to-pass, rank-per-period bars, donut).
2. Board switch per canvas (D10, D11), both themes, 44px targets, radiogroup with arrow keys.
3. Fix stale copy: footer (D11), `arenaTiles` note at `competeModel.js:297`.
4. Harness: `LeaderboardScene` gets a `board` variant per board; `leaderboard-states` covers each empty state. Width sweep (`--sweep`) on the new scenes: no new findings vs main.
5. Tests: model unit tests per board (ranking tie-break, to-pass, share); view test per board; keep the Nexus parity test passing for the API board.
6. Smoke: harness walk + **real-app width sweep on staging** (Kyron runs the sign-in command) + read-only production click-through after merge.

### L-3 — Kiosk boards read the aggregate (client · human-merge)
1. `RankedLeaderboardPanel` (ytd/qtd/mtd/week) reads `leaderboards/{branchId}` (one `getDoc` per poll), ranks by `periodApi`, shows ledger `apps`. Fix the false header comment (A12).
2. `WeeklyActivityPanel` ranks the week by `points`. Same layout; the two raw-count columns become one points column + apps.
3. Remove dead `PeriodLeaderboardsPanel.jsx` and `TVRankedLeaderboard.jsx` only if `git grep` shows no importer outside each other.
4. Other kiosk panels (branch overview, running totals, awards watch, last-week recap) stay on submissions — bank one FU listing them (Rule 7(b), append at end).

## 4. Persona review

| Lens | Check |
|---|---|
| Tenant isolation | Aggregator reads one tenant at a time; doc path unchanged; no cross-tenant read. Scheduled run stays `tatillife_south` (existing FU, not widened here). |
| Role / permissions | No rules change. Agents still see only their branch doc; kiosk still reads only its branch. Peers' policies and dailies stay unreadable to clients. |
| Money correctness | D2/D3 reuse the ledger credit rule through twins guarded by cross-check tests; one rule, two runtimes. Monotonicity test. |
| Operator legibility | Footer names each source; "Own and family policies are left out" is stated, not hidden. |
| A11y / contrast | Radiogroup semantics, arrow keys, focus ring; ink on `--teal` checked in both themes (v3 rule 6). |
| Pilot ops / reversibility | L-1 revert = redeploy previous functions; L-2/L-3 revert = `git revert`. The doc keeps old keys, so a partial rollout never blanks the Nexus surface. |
| Maintainability | One board config; no hard-coded metric in views; fourth board = one entry. |

## 5. Stops

- **STOP and wait for dispatcher:** end of every Phase 1; any decision not in § 2; any twin whose cross-check cannot pass without changing the client rule; any staging read showing drafts missing for whole weeks (D5 premise); any need for a new collection, rules change or index.
- **STOP IMMEDIATELY:** any write to production Firebase; any script pointed at `agencytrack-2a610`; any cross-tenant read.

## 6. Deliverables per slice (named rituals)

PR-ready report with feature-branch HEAD SHA (Rule 20) · CodeRabbit disposition table (Rule 21) · ≥1 named gap (Rule 22) · L-1 dry-run table paste-back · L-2 before/after harness sweep + Kyron's staging sweep command · post-merge fill per Rule 16 after each merge.

## 7. Out of scope (bank as FUs if touched)

Rest Assured board · manager/SM leaderboard surfaces · lifetime `leaderboard/{uid}.points` model (FOLLOW_UPS ~L2994) · multi-tenant schedule · other kiosk panels (L-3 item 4) · agent "My insight" (its own brief, next).

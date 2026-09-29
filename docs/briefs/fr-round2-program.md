# FR round 2 — agent feedback program (kickoff brief)

**Status:** ready for dispatch · **Author:** Claude-web (architect) · **Date:** 29-09-2026
**Source:** Kyron's walk-through feedback (28-09-2026) + the queue left after #1011.
**Channel:** every slice is `human-merge`. One slice = one branch = one PR, each cut fresh from `origin/main` (`git fetch origin && git pull origin main`). Slices do not stack.
**Delegation (CLAUDE.md):** the pinned model keeps design, money logic, rules and review. Haiku 4.5 for searches, log reading and test-count runs; Sonnet 5.5 for edits the main model has specified exactly. Never delegate `firestore.rules`, money math or the gate verdict.

## 0. Rulings (Kyron, 28–29-09-2026) — locked, do not re-litigate

- **R-a Persistency display rule:** percent rounded to **2 decimals, half up**; the gate verdict uses that same rounded value (89.996 → 90.00%, passes). Shared helper already on main: `src/lib/persistency/persistencyRounding.js` (`roundPersistencyPct`, `formatPersistencyPct`). Applies to **agent AND manager** screens.
- **R-b FR-6 Option A approved** exactly as written in `docs/audits/fr-6-mark-reinstated-recon.md` § 3 Option A. The existing monthly agent-typed `reinstatements` input stays as it is (ruling 28-09-2026). Declarations are shown **beside** evidenced figures, never inside them, and never feed money (awards, financing, commission).
- **R-c Career badges merge into the Trophy room.** Career stops rendering its own badge grid.
- **R-d Career and Leaderboard redesigns wait for canvas designs** (Claude-web draws them first). Not in this program.
- **R-e Money calculators** (Commission playground, Game plan, Money needs) get the full FR visual port from the existing canvases `docs/design-system/screens-fr/D3M-*.dc.html` / `M3-*.dc.html`, **every function kept**, logic untouched.

## 1. Slices — run in this order

| # | Slice | Model / effort |
|---|---|---|
| R2-1 | Persistency 2-dp rule on every screen | Opus 5.5 / medium |
| R2-2 | Persistency tab: bars for the monthly trend + visible annuity switch | Sonnet 5.5 / medium |
| R2-3 | Income goal period + the dropped settlement-rate save | Opus 5.5 / medium |
| R2-4 | Campaign: the policies it counts, with status changes | Opus 5.5 / high |
| R2-5 | Career badge merge + Trophy room charts | Sonnet 5.5 / medium |
| R2-6 | FR-6 Mark reinstated (Option A) — rules change | Opus 5.5 / high |
| R2-7 | Commission playground FR port | Opus 5.5 / medium |
| R2-8 | Game plan FR port | Opus 5.5 / medium |
| R2-9 | Money needs FR port | Opus 5.5 / medium |

### R2-1 — Persistency 2-dp rule everywhere
- **Scope:** every agent- and manager-facing persistency percentage and every gate verdict. The file list is in `docs/FOLLOW_UPS.md` (the MEDIUM "apply the same rounding everywhere" entry, banked in #1011). Re-verify it in Phase 1 with `git grep -n "persistency" -- src | grep -i "toFixed\|formatOutlookPct\|PERS_GATE\|< 90\|>= 90\|\* 100"` and list every hit in the PR body as migrated / not a display / out of scope with a reason.
- **Decisions:** all display goes through `formatPersistencyPct`; every verdict compares `roundPersistencyPct(x) >= PERS_GATE_PCT` (or the campaign's own threshold). No second rounding helper. Charts' axes may keep whole-number ticks; their tooltips and labels use the helper. `AgentReportDocument.jsx` (PDF) uses the helper too (hex-only styling rule unchanged).
- **Tests:** one table test per migrated verdict site at 89.994 / 89.995 / 89.996 / 90; a parity test that Today, the Persistency screen and the campaign card print the same string for one fixture.
- **Close:** the MEDIUM follow-up (RESOLVED note, Rule 7).

### R2-2 — Persistency tab visuals
- **Monthly trend:** replace the Recharts `LineChart` in `src/components/agent/PersistencyTab.jsx` (`data-testid="persistency-trend-chart"`) with bars and the 90% gate line — reuse the FR `GateBars` or `Columns` from `src/components/fr/charts` when the FR look is on, and a Recharts `BarChart` with the same data and `ReferenceLine` at 90 for the Nexus look. Values via the R2-1 helper (if R2-1 has not merged yet, use `formatPersistencyPct` directly — it is already on main).
- **Annuity switch:** `AnnuityRuleSwitch` currently renders inside the folded assumptions block of `src/components/persistency/PersistencyOutlookHero.jsx` (~line 193). Move it to sit directly under the headline figure, always visible, same component, same `onAnnuityRuleChange` state (no persistence change). Keep the "Rule:" line in the assumptions block.
- **Tests:** chart renders bars (not a line) with the gate line; switch is visible without expanding anything and still changes the figure.

### R2-3 — Income goal period (+ settlement-rate save bug)
- **Finding:** `GoalDecompositionTab.jsx` "Income Goal (TTD)" (~line 379) has no period; the value is always treated as annual, and the `PERIODS` chips (~line 20: monthly divisor **10**, weekly `WEEKLY_DIVISOR`, daily `DAILY_DIVISOR = 258`) only divide it for display. Typing a one-month goal is read as a year.
- **Decisions:**
  1. Add a period select beside the income goal input, options from the same `PERIODS` table (Annual / Semi / Quarter / Month / Week / Day). The stored and computed `incomeGoal` stays **annual** (every reader unchanged): `incomeGoal = enteredAmount × divisor(period)`.
  2. Show the conversion in words under the field, e.g. `TTD 50,000 a month × 10 selling months = TTD 500,000 a year`. The 10-selling-month model is existing app policy — do not change it.
  3. Default period `annual`; old saved scenarios and saved assumptions with no period load as annual (no migration).
  4. Persist the period as `playgroundIncomeGoalPeriod` (string) through `setGoals` in `src/services/goalsService.js` (~line 230, `pgKeys` parses with `parseFloat` — add a separate string branch with an allowlist of the six keys). Phase 1: check `firestore.rules` for the goals doc; if the rules would reject the new key, **STOP and wait for dispatcher**.
  5. **Bug fix in the same PR:** `handleSaveAssumptions` sends `playgroundSettlementRate`, but `pgKeys` omits it, so it is silently dropped. Add it to `pgKeys` and add a test that a saved-then-reloaded settlement rate round-trips.
- **Tests:** 50,000 monthly → annual 500,000 and the Month chip shows 50,000; weekly/daily round-trip; reload keeps the period; the settlement-rate round-trip.

### R2-4 — Campaign: counted policies with status changes
- **Scope:** on the Campaign screen (FR `src/components/fr/compete/FrCampaign*` and the Nexus campaign screen), add a "Policies in this campaign" list built from `derivePolicyLens` (`src/lib/policyCampaignLens.js:482`): groups **Counting**, **Waiting** (pending), **Not counting** (excluded, with the reason the lens gives). Each row: client, policy number, status, API, date. Totals per group equal the campaign's own API/apps figures (parity test).
- **Status changes:** reuse the Policy ledger's existing path only — `transitionPolicyStatus` (`src/services/policiesService.js:184`) and the ledger's status drawer from `src/components/agent/PolicyLedgerPanel.jsx`. If that drawer is separable, mount the same component; if not, the row's "Change status" deep-links to the Policy ledger with that policy's drawer open. **No new write path, no rules change**; head-office (`oipa_import`) statuses stay locked exactly as in the ledger. After a change, the campaign list and the ledger both reflect it (they read the same docs).
- **Tests:** group membership per lens outcome; totals parity; a head-office row offers no status change; a change made from the campaign row calls the same service with the same arguments as the ledger.

### R2-5 — Career badge merge + Trophy room charts
- **Career:** remove `<BadgeGrid submissions={submissions} />` from `src/components/profile/CareerPortal.jsx` (~line 871). Put a card in its place: "Your badges and trophies" with the earned count from the engine (`useMyLeaderboardEntry` + `trophyRoom()` as FR-5 does) and a button to the Trophy room. Do **not** delete `BadgeGrid.jsx` — other screens import it.
- **Bank a follow-up (Rule 7b):** `computeEarnedBadges` in `BadgeGrid.jsx` still uses the old MDRT threshold (TTD 500,000 vs 688,800) and feeds `ActivityFeed`, `RecentCompact`, `TeamMedalsPanel`, `useBranchOverview` and `AgentDashboard`.
- **Trophy room:** "Your level" becomes a `Donut` (points toward the next level, centre = level name); add a hero row of 2–3 `ChartCard`s mixing chart types (e.g. award progress `MeterList`, badges earned vs total `Donut`), in the Campaign screen's mix-of-visuals style. FR kit components only; data from the existing `trophyRoom()` model — no new reads.

### R2-6 — FR-6 Mark reinstated (Option A)
- **Spec:** `docs/audits/fr-6-mark-reinstated-recon.md` § 3 Option A — data fields, Arm G rules sketch, the history-arm branch, readers, test plan, deploy sequence. Build exactly that. Phase 1: re-verify every file:line the recon quotes (Rule 11); if any moved, correct it in the PR body.
- **UI:** "Mark reinstated" / "Withdraw" on an own **lapsed** policy in the Policy ledger drawer and on the FR-3 reinstatement planner rows; the persistency figure shows "with your declared reinstatements X%" beside the evidenced figure (R2-1 helper).
- **Rules:** additive arm only — no existing arm edited. Full `firestore-rules-tests` coverage: agent own lapsed ✓, not own ✗, not lapsed ✗, money field touched ✗, status touched ✗, manager ✗ (unless the recon says otherwise), note > 200 chars ✗.
- **Deploy:** CC does NOT deploy (Rule 19). The PR body states the exact `firebase deploy --only firestore:rules` step for Kyron, post-merge.

### R2-7 / R2-8 / R2-9 — Money calculators FR port
- Port the visual layer of the Commission playground, Game plan and Money needs to their canvases (`D3M-Commission` / `M3-Commission`, `D3M-GamePlan` / `M3-GamePlan`, `D3M-MoneyNeeds` / `M3-MoneyNeeds`), FR look only; the Nexus look is unchanged.
- **Commit 1 of each slice: characterization tests** pinning today's computed outputs for representative inputs (all tabs, all period chips, saved scenarios). They must pass **unchanged** after the port. Any assertion edit → **STOP and wait for dispatcher**.
- Every input, tab, saved scenario and save action stays. No change under `src/utils/goalDecomposition*`, `src/lib/` money modules or services.
- R2-7 carries R2-3's period select into the new layout (R2-7 starts after R2-3 merges; if R2-3 is not merged, skip R2-7 and go to R2-8).

## 2. Named rituals (every slice)
1. Phase 1 verification commands and their output in the PR body (Rule 17).
2. Local gates: `npm run lint` 0 · full `npm test` · `npm run build`.
3. FR harness walk for the touched slice(s) (`scripts/verification/fr-harness-walk.mjs`), both themes, desktop / tablet / phone; review the screenshots. Add or update scenes as needed.
4. Mutation check on every new rule/verdict test; paste the result.
5. CI green (one re-run allowed for a named known flake). CodeRabbit `@coderabbitai review` once per PR (it is rate-limited — space requests), Rule 21 table.
6. PR-ready report with HEAD SHA (Rule 20) and gaps (Rule 22). Close or bank follow-ups in the same PR (Rule 7 / 7b).

## 3. Stops
- Any new Firestore collection, index or rules change outside R2-6: **STOP and wait for dispatcher**.
- Any change to money math, the award engine, the persistency outlook model or the 10-selling-month model: **STOP and wait for dispatcher**.
- A characterization or parity test that needs its assertion changed: **STOP and wait for dispatcher**.
- Anything that would touch production data, deploy, or merge: **STOP IMMEDIATELY**.

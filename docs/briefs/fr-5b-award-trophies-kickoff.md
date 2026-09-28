# FR-5b — award calculation shared helper + award trophies — kickoff brief

**Status:** ready for dispatch · **Author:** Claude-web (architect) · **Date:** 28-09-2026
**Model:** Opus 5.5, effort high (Tier-C: moves award logic; the main model keeps all award judgment and final review). Delegation per CLAUDE.md § Subagent delegation: Haiku 4.5 for searches and test-count runs, Sonnet 5 for fixture updates the main model has specified exactly. Award logic itself is never delegated.
**Merge channel:** `human-merge` (touches award logic).
**Source:** `docs/FOLLOW_UPS.md` § FR-5b: award calculation shared helper. Kyron ruling 28-09-2026: characterization tests first, then the move, then the trophies; separate PR.

## 1. What this is

FR-5 (#1004) shipped the Trophy room with badges and levels from the points engine. The award trophies (Advisor of the Month API/Apps, Quarterly API/Apps, Persistency Silver/Gold, Rookie of the Year, New Business Advisor, Centurion, Agent of the Year, MDRT) were left out because their inputs are built inside `src/components/awards/AgentAwardsPanel.jsx`. This slice moves that derivation into a pure shared helper, proves the Awards tab is unchanged, then lights the award trophies from the same helper.

## 2. Audit findings (verified 28-09-2026 on main `8e355cab`, Rule 11/17)

- `AgentAwardsPanel.jsx` (464 lines) builds award inputs in three places, all to move:
  1. `readsLedger = usesPolicyLedger || (ledgerPolicies?.length ?? 0) > 0` (H2 item 2).
  2. `activeConfirmedData` — `confirmedSettlements` when not reading the ledger; otherwise `awardRowsFromLedger(ledgerPolicies)` with persistency merged in by `periodKey` from `confirmedSettlements`.
  3. `computation` — `computeAgentAwards(...)` then, per award, `getPeriodCtx`, `computeAtRiskStatus`, `isPersistencyOnlyBlock`, `nextTierDistance` (club only), `computeAwardPace`; plus `computeRatioTrends(submissions)`; `try/catch` → `{ awards: {}, ratioTrends: null, error: 'Failed to compute awards.' }`.
- The panel fetches its own ledger with `getOwnPolicies(tenantId, agentProfile.uid)` and deliberately does **not** call `excludeImported` (the long "AWARDS ARE EARNED BY DATE, NOT BY ORIGIN" comment, R5). It is on the `ALLOW_UNFILTERED` list in `src/lib/portfolioImport/__tests__/excludeImported.test.js`.
- `AgentDashboard.jsx` already holds the same unfiltered response as `policiesAll` (plus `policiesError`), and holds `settlements`, `allSubmissions`, `userProfile`, `awardsRuleset`, `activeCampaigns`. The Trophy room today is `<FrTrophyRoom tenantId uid />` and reads only the leaderboard doc.
- Engine award ids (`src/utils/awardsEngine.js` `computeAgentAwards`): `advisor_month_api`, `advisor_month_apps`, `quarterly_api`, `quarterly_apps`, `persistency_silver`, `persistency_gold`, `rookie_of_year` (only created when the agent is within the rookie window), `new_bs_award` (conditional), `centurion`, `agent_of_year`, `mdrt`, plus club tiers. Trophy kinds exist for all of them in `src/components/fr/trophies/trophyKinds.js` (`aotm-api`, `aotm-apps`, `quarterly-api`, `quarterly-apps`, `persistency-silver`, `persistency-gold`, `rookie-year`, `new-business`, `centurion`, `agent-year`, `mdrt`).
- `award.eligible` is the engine's "criteria met for the current period" flag. Nothing records past-period winners, and monthly/quarterly/annual awards are finally decided at period end.

## 3. Persona review

- **Tenant isolation / data integrity:** no new reads, no writes. The Trophy room receives data the dashboard already fetched.
- **Role / permissions:** agent-only surface, behind the FR opt-in, as in FR-5.
- **Money-correctness:** award prizes are money-adjacent. The Awards tab's output must not change for any input (characterization tests are the proof). Trophies show qualification, never "won" or a prize amount.
- **Operator legibility:** each award trophy says what period it is measured over and how close the agent is.
- **A11y / contrast:** as FR-5 — 44px targets, both themes, axe clean in the harness walk.
- **Pilot ops / reversibility:** pure refactor + additive view; one revert undoes it.
- **Maintainability:** one helper, two callers (Awards tab, Trophy room). No twin derivation.

## 4. Decisions locked — do not re-litigate

- **D1 — Helper location and shape.** New pure module `src/lib/awards/agentAwardModel.js` (no React, no Firebase imports) exporting:
  - `awardInputs({ ledgerPolicies, confirmedSettlements, usesPolicyLedger })` → `{ readsLedger, rows }` — an exact move of items 1–2 above, including `ledgerPolicies === null` handling.
  - `agentAwardsView({ rows, submissions, agentProfile, now, ruleset, activeCampaigns })` → `{ awards, ratioTrends, error }` — an exact move of item 3, including the `try/catch` and `console.error`.
  AgentAwardsPanel keeps its fetch, its state, its `yearSettled`, its drawer and all rendering; it only replaces the moved code with calls to these two functions inside the same `useMemo`s.
- **D2 — Commit order (ruling).** Commit 1: characterization tests only, no source change, pinning AgentAwardsPanel's output. Commit 2: the move. Commit 3: helper unit tests. Commit 4+: trophies. The commit-1 tests must pass **unchanged** at commit 2 — no edits to their assertions or fixtures.
- **D3 — What the characterization tests pin.** Render `AgentAwardsPanel` with `getOwnPolicies` mocked, `currentDate` fixed, and the 2026 default ruleset, for at least these cases: (a) settlements only, no ledger; (b) ledger only (not flagged, has policies); (c) ledger + settlements with persistency present for some periods; (d) flagged `usesPolicyLedger` with an empty ledger; (e) a rookie profile (so `rookie_of_year` exists); (f) ledger load failure (error card + Retry). For each rendered award, assert its group (Qualified / Almost there / Making progress / Just starting), each criterion's current figure as displayed, and the pace/at-risk text where shown. Assert through what the user sees, not internal state.
- **D4 — Trophy lit rule.** An award trophy is **lit** when `award.eligible === true`, captioned **"Qualified — {period}"** where period is `Sep 2026` (monthly), `Q3 2026` (quarterly) or `2026` (annual), taken from the award's own period context. Never the word "won", never a prize amount. An unlit award trophy shows progress from its first criterion (`current / target`, capped at 99%) and a `left` line in the same style as FR-5 badges (e.g. "TTD 12,400 to go", "3 more apps"). A criterion in `%` (persistency) shows the current % and the gate, not a money figure.
- **D5 — Which awards appear.** Exactly the engine ids listed in § 2, mapped to their existing trophy kinds, and only when the engine returned that award for this agent (so `rookie_of_year` / `new_bs_award` appear only when the engine creates them). Club tiers, Christmas champion/tier and any kind with no engine award are **not** shown (FR-5 rule: a trophy that can never light is a fake). One mapping table, frozen, next to the existing `BADGE_TROPHY_KIND` in `src/lib/fr/competeModel.js`; an unmapped engine id logs in development (non-negotiable 11).
- **D6 — Data path.** No new Firestore read. `AgentDashboard.jsx` passes `policiesAll`, `policiesError`, `settlements`, `allSubmissions`, `userProfile`, `awardsRuleset`, `activeCampaigns` and `now` to `FrTrophyRoom`. `FrTrophyRoom` calls `awardInputs` + `agentAwardsView` in `useMemo` and passes the result to a pure model function (extend `trophyRoom(entry, awardsView)` or add `awardTrophies(awardsView, now)` — CC's choice, pure and unit-tested). While `policiesAll === null && !policiesError`: the award group shows a skeleton; on `policiesError`: an inline error with the dashboard's existing retry path; badges/levels keep their own loading/error as today.
- **D7 — excludeImported guard.** `FrTrophyRoom` now receives the unfiltered `policiesAll`. Register it in `src/lib/portfolioImport/__tests__/excludeImported.test.js` the same way the FR-2 `FrToday` `campaignPolicies` hand-off was registered, with the reason "awards are earned by date, not origin (R5, same as AgentAwardsPanel)". Do not weaken the guard.
- **D8 — Layout.** A new "Awards" group in the Trophy room after Levels, same Trophy component, same card rhythm, `aria-label` on the section, h2 heading. "Closest to unlocking" may include award trophies with measured progress. Counts in the room header (`earnedCount` / `total`) include award trophies.
- **D9 — Harness.** Extend the `trophy-room` scene (slice `FR-5`) with award fixtures: variant A some qualified, variant B none qualified plus a rookie. No harness-only code paths in production components.

## 5. Phase 1 — verify before editing (Rule 17)

```
git grep -n "const readsLedger" -- src/components/awards/AgentAwardsPanel.jsx
git grep -n "const activeConfirmedData" -- src/components/awards/AgentAwardsPanel.jsx
git grep -n "computeAgentAwards(activeConfirmedData" -- src/components/awards/AgentAwardsPanel.jsx
git grep -n "ALLOW_UNFILTERED" -- src/lib/portfolioImport/__tests__/excludeImported.test.js
git grep -n "setPoliciesAll(" -- src/components/dashboard/AgentDashboard.jsx
git grep -n "<FrTrophyRoom" -- src/components/dashboard/AgentDashboard.jsx
git grep -n "id: '" -- src/utils/awardsEngine.js
```
Confirm `setPoliciesAll` receives the raw `getOwnPolicies` response with no `excludeImported` (read the lines around it). If it is filtered, **STOP and wait for dispatcher** — D6 would give the Trophy room different numbers from the Awards tab.

## 6. Named rituals (deliverables)

1. **Characterization proof, pasted into the PR body:** the commit-1 test file's name and count; `git diff <commit1> <commit2> -- <that test file>` output (must be empty); the test run at commit 2.
2. **Parity test:** one test renders the same fixture through AgentAwardsPanel and through the Trophy room model and asserts each shared award's `eligible` and first-criterion `current` match.
3. **Mutation checks:** flip `eligible` handling in the trophy model (lit when not eligible) → trophy tests fail; drop the persistency merge in `awardInputs` → case (c) characterization fails. Paste results.
4. Local gates: `npm run lint` 0, full `npm test`, `npm run build`.
5. FR harness walk `--slice FR-5`: all rows pass (axe, 44px, no sideways scroll at 390px, glide, reduced motion, swipe, console). Review screenshots at desktop 1440 / tablet 900 / phone 390, both themes.
6. CI green; one re-run allowed for a named known flake.
7. CodeRabbit: `@coderabbitai review` once, up to 10 min, Rule 21 table.
8. PR-ready report: HEAD SHA (Rule 20), gaps (Rule 22), and the list of award trophies that appear for each harness variant.

## 7. Stops

- Any commit-1 characterization assertion or fixture needs editing after the move: **STOP and wait for dispatcher**.
- The Awards tab renders anything differently for any pinned case: **STOP and wait for dispatcher**.
- Any design that needs a new Firestore read, a write, a rules change or an index: **STOP and wait for dispatcher**.
- Any change to `src/utils/awardsEngine.js` or the ruleset config: **STOP and wait for dispatcher**.

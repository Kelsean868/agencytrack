# FR-3 planner nits — kickoff brief

**Status:** ready for dispatch · **Author:** Claude-web (architect) · **Date:** 28-09-2026
**Model:** Sonnet 5, effort medium (Tier-A: test + copy only).
**Merge channel:** `human-merge` for this run. The change itself would be green-channel eligible, but the green channel needs a both-themes preview smoke, and previews are bound to production Firebase where CC cannot sign in. So CC opens the PR and stops.
**Source:** `docs/FOLLOW_UPS.md` § FR-3 planner nits (SOON_MONTHS copy + boundary test), items a, b and c. Kyron ruled all three in on 28-09-2026.

## 1. What this is

Three small fixes left over from FR-3 (#1002) and FR-4 (#1003). No behaviour change for users except one footnote reading its number from a constant.

## 2. Decisions locked

- **a. Footnote copy.** In `src/components/fr/money/ReinstatementPlanner.jsx`, the footnote sentence that says "leaves the window within two months" must take its number from `SOON_MONTHS` (imported from `src/lib/fr/moneyModel.js`). Write the number as a word when it is 1–9 ("two"), through a tiny local helper or a lookup; a digit is also acceptable if a word helper would be the only such helper in the file. Singular/plural must read correctly for `SOON_MONTHS = 1`.
- **b. Boundary test.** In `src/lib/fr/__tests__/moneyModel.test.js`, add a test that builds a lapse whose `countsThrough` is exactly `SOON_MONTHS` months after the planned month (flagged `agesOutSoon: true`) and one at `SOON_MONTHS + 1` (not flagged). Build the fixture from `SOON_MONTHS`, not from a hard-coded 2.
- **c. FR-4 opt-out test.** In `src/components/dashboard/__tests__/AgentDashboardFrNav.test.jsx`, the test "without the opt-in: no FR-4 surface…" asserts the Numbers and Ledger FR headers are absent without first opening those tabs. Fix it the way #1004 fixed the FR-5 headers: navigate to `production-report` and `policy-ledger` through the Nexus shell (`captured.setActiveTab`) before asserting.
- No other file changes. No source change except item a.

## 3. Phase 1 — verify before editing (Rule 17)

```
git grep -n "within two months" -- src/components/fr/money/ReinstatementPlanner.jsx
git grep -n "SOON_MONTHS" -- src/lib/fr/moneyModel.js
git grep -n "agesOutSoon" -- src/lib/fr/moneyModel.js
git grep -n "no FR-4 surface" -- src/components/dashboard/__tests__/AgentDashboardFrNav.test.jsx
git grep -n "captured.setActiveTab" -- src/components/dashboard/__tests__/AgentDashboardFrNav.test.jsx
```
If any of these returns nothing, the source has moved: **STOP and wait for dispatcher**.

## 4. Named rituals (deliverables)

1. **Mutation checks, pasted into the PR body:**
   - b: change `<= SOON_MONTHS` to `< SOON_MONTHS` in `agesOutSoon` → the new test fails. Restore.
   - c: remove the `fr &&` gate from the Numbers header, then separately from the Ledger header → the fixed test fails each time. Restore.
   - a: set `SOON_MONTHS = 3` locally → the footnote reads "three"; restore.
2. Local gates: `npm run lint` 0 problems, full `npm test`, `npm run build`.
3. FR harness walk for the planner scene: `node scripts/verification/fr-harness-walk.mjs --slice FR-3 --out <scratch dir>`. All rows pass. Review the planner screenshots in both themes.
4. CI green (`lint-and-build`, `functions-tests` polled to SUCCESS). One re-run of failed jobs is allowed for a known flake; name the flaking test in the PR.
5. CodeRabbit: comment `@coderabbitai review` once, wait up to 10 min, disposition table (Rule 21).
6. PR-ready report with HEAD SHA (Rule 20) and at least one stated gap (Rule 22).

## 5. Stops

- Any need to touch a file outside the three named: **STOP and wait for dispatcher**.
- Any change to what `agesOutSoon` returns for existing fixtures: **STOP and wait for dispatcher**.

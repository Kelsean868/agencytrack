# Overnight run — 26 Sep 2026 — morning report

**Result:** 1 merged (R1 Home), 1 held (P2a), 1 parked (R2 Campaign). No deploys. No auto-reverts. No production data writes.

| Item | Status | PR | SHA |
|---|---|---|---|
| Step 0 — land briefs + mockups | DONE | — | `9ac7ec10` on `main` (Rule 15 verified) |
| R1 Home | **MERGED** | [#977](https://github.com/Kelsean868/agencytrack/pull/977) | merge `3228802f` · post-merge fill `1aa2198f` |
| P2a Server integrity | **HELD** | [#978](https://github.com/Kelsean868/agencytrack/pull/978) | head `16d2a106` |
| R2 Campaign | **PARKED** | [#979](https://github.com/Kelsean868/agencytrack/pull/979) | head `15e67a3c` |

---

## R1 Home — MERGED

- All gates passed on head `785b0b3d`: CI green (lint-and-build, functions-tests, rules tests, a11y), lint 0, tests 411 files / 6,922, build OK, CodeRabbit summary only (0 findings), scope `src/` + `docs/` only.
- Production smoke after the Vercel deploy: PASS at 390 and 1440 (light). Same screen as the preview. No console errors. No side scroll. No revert.
- Post-merge fill `1aa2198f` pushed and verified.

**Design check (preview, A11Y test agent):**

| Block | Matches mockup | Note |
|---|---|---|
| 56 px header (avatar · Home · date · bell) | yes | Desktop: title + date + Submit + bell |
| Hero donut + big number + sub-line | yes | MDRT tick drawn |
| Hero row of 3 | yes | |
| Provenance line | not shown | Test agent has 0 settled policies. Unit-tested |
| Reconciliation note | yes | |
| Submit button | yes | Outline style kept (contrast) |
| Campaign card | not shown | Test agent has no campaign. Unit-tested |
| Do next | yes | |
| This week (4 tiles) | yes | |
| Desktop grid 7 / 5 | yes | Hero is full width when there is no campaign card |

Screenshots: `docs/reports/screenshots/overnight-2026-09-26/r1-home/`

**Visible change to know:** an agent with no personal goal now sees "of 688,800 MDRT" on the hero. Before, it said "of 200,000 goal" (the company floor).

## P2a Server integrity — HELD

- All 4 fixes built with tests: SEC-06 (branch manager locked to own branch), BUG-08 (leaderboard points in a transaction; resubmit adds only the difference; stored as `awardedBySubmission` map on the leaderboard doc), BUG-09 (Sunday cron check + write in one transaction), SEC-16.
- `functions/` audit: **before** 16 (1 low, 9 moderate, 5 high, 1 critical) → **after** 9 moderate. Left: one `uuid` chain; the only fix is the forbidden `--force` exceljs downgrade.
- CI audit step added for root and `functions/` (high/critical level). No `continue-on-error` needed.
- Tests: root 6,922 pass; functions 734 pass. CI green. CodeRabbit was rate-limited and gave no review.
- No function is added, removed or renamed. Changed: `onSubmissionWrite`, `setAgentOfMonth`, `getAgentOfMonthCandidates`, `aggregateDailyToWeeklyCron`.

## R2 Campaign — PARKED

- Built. CI green on every push. Tests 413 files / 6,945.
- **Why parked:** the test agent is in no campaign. On the preview the Awards tab shows no Campaign screen, so the required design check cannot see any of the 6 blocks. The production smoke would be blind too, so an auto-revert could not protect production. Rule 7: no safe default → park.
- I rendered the screen locally with the test data instead. That found 6 defects; 2 fix rounds fixed all of them (a raw number `86.0377446303493`, a dark-mode contrast fill, a missing month row in the gate card, stacked blocks on desktop, wrapping cash values, stretched gate labels). All 6 blocks now match the mockups in both themes and both widths.

| Block | Local render | Preview |
|---|---|---|
| Progress (3 donuts) | yes | not shown |
| What it takes | yes | not shown |
| Persistency gate + month row | yes | not shown |
| Tier ladder | yes | not shown |
| What if slider | yes | not shown |
| Footer | yes | not shown |

Screenshots: `docs/reports/screenshots/overnight-2026-09-26/r2-campaign/` (on the PR branch).

## Banked in FOLLOW_UPS

- On `main`: **A11Y test agent has no campaign** (MEDIUM). This is what blocked R2.
- On the R2 branch (lands when #979 merges): `smoke-campaign-hero-h3.mjs` targets testids from the retired card variant (LOW).

## What Kyron does next

1. **P2a (#978):** review → merge → run `firebase deploy --only functions --project agencytrack-2a610` → do the smoke walk in the PR (Agent of the Month loads for your branch; Functions logs clean for an hour; Monday leaderboard has no double points).
2. **R2 (#979):** open the preview signed in as yourself (you are in the Christmas campaign). Look at the Awards tab. This is read-only, but the preview uses production data. If it looks right, merge. Or first give the test agent a test campaign (the FOLLOW_UPS item), then rerun the check.
3. **Cleanup:** the R1 worktree `.claude/worktrees/agent-a99677d93d5610c91` could not be removed; this session held its lock. It is clean. Remove it with the junction-safe steps in `/post-merge`.

## Known gaps

- The R1 campaign card and provenance line were never seen live. Unit tests only.
- CodeRabbit gave only summaries or rate-limit notices tonight. No line-level review ran on any PR.
- One preview login failed once and passed on retry. I did not find the cause.

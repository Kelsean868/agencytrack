# Resume Run — 2026-05-25

Cold-session resume after crash. Continuing the H2c-first queue.

| Item | PR# | Squash SHA | Status |
|---|---|---|---|
| H2c — BM-only lapsed status + agent notification + H11 lapse chip | [#321](https://github.com/Kelsean868/agencytrack/pull/321) | `900a473` | ✅ MERGED — emulator 57/57, smoke 13/13, rules deployed, post-merge fill done |
| E(d) — DailyEntryModal a11y: PPP id collision + role=status + inputMode=decimal | [#322](https://github.com/Kelsean868/agencytrack/pull/322) | `75c0e33` | ✅ MERGED — CI green, no smoke needed (pure a11y attrs), post-merge fill done |
| H3 — usesPolicyLedger flag + settlementShapeFromPolicies + parity tests | [#323](https://github.com/Kelsean868/agencytrack/pull/323) | — | 🔓 PR-OPEN — DO NOT MERGE (money-adjacent flag flip, dispatcher decision required); 1345/1345 tests, lint+build clean |
| H12 — A&H / non-life 'does not count toward awards' cue (form + card) | [#324](https://github.com/Kelsean868/agencytrack/pull/324) | `a62d9c3` | ✅ MERGED — CI green (flaky rerun), smoke 7/7 pass |
| J2 — trailing 2-year average API for career-level qualification | [#325](https://github.com/Kelsean868/agencytrack/pull/325) | `77d2317` | ✅ MERGED — CI green, smoke 4/4 pass |
| Rules test — persistency collection (18 cases: list/get/null-resource/create-update/delete) | [#326](https://github.com/Kelsean868/agencytrack/pull/326) | `d8298b6` | ✅ MERGED — CI green, no smoke (test-only) |
| Hygiene — getPeriodCtx dedup (BmAtRiskPanel → engine export) + close J2 FU | [#327](https://github.com/Kelsean868/agencytrack/pull/327) | `7529d3a` | ✅ MERGED — CI green, no smoke (pure refactor) |
| CI doc drift — CLAUDE.md lint+build → lint+tests+build (Lint Policy + Session Protocol) | [#328](https://github.com/Kelsean868/agencytrack/pull/328) | `7b3769f` | ✅ MERGED — CI green (flaky rerun on DailyEntryModal), no smoke (docs-only) |
| Hygiene — clear stale provisional signals for tenure bands (tenureFloors.js comment + seed flag) | [#329](https://github.com/Kelsean868/agencytrack/pull/329) | `9e527fe` | ✅ MERGED — CI green, no smoke (comment + ops-only seed script) |
| UX — surface submissions query error in AgentDashboard (role=alert banner + submissionsError state) | [#330](https://github.com/Kelsean868/agencytrack/pull/330) | `e3f66ae` | ✅ MERGED — CI green (rebase), smoke 4/4 pass, post-merge fill done |
| Smoke harness — selectReactOption + domTextCount helpers; bank PR #248 lessons (LESSONS 6–8) | [#332](https://github.com/Kelsean868/agencytrack/pull/332) | `89fd201` | ✅ MERGED — CI green, no smoke (helpers-only), post-merge fill done |
| Smoke harness — captureConsoleAndNetwork + formatCaptureReport; LESSON 9 | [#333](https://github.com/Kelsean868/agencytrack/pull/333) | `3d76d9a` | ✅ MERGED — CI green, no smoke (helpers-only), post-merge fill done |
| A11y — sidebar-collapse-btn touch target 32×32 → 44×44 | [#334](https://github.com/Kelsean868/agencytrack/pull/334) | `5ba57cd` | ✅ MERGED — CI green, no smoke (CSS-only), post-merge fill done |
| A11y — AgentDashboard KPI + Goals fake headings → h3 + section[aria-labelledby] | [#335](https://github.com/Kelsean868/agencytrack/pull/335) | `f4b679b` | ✅ MERGED — CI green, no smoke (semantic-only), post-merge fill done |
| Refactor — KioskShell + KioskRoute hex literals → presentation token family | [#336](https://github.com/Kelsean868/agencytrack/pull/336) | `f0a5857` | ✅ MERGED — CI green, no smoke (CSS token swap, static bundle verification), post-merge fill done |

| Refactor — CampaignCard + GapAnalysisPanel bg-[#hex] → Tailwind palette utilities | [#337](https://github.com/Kelsean868/agencytrack/pull/337) | `ab2aa81` | ✅ MERGED — CI green, no smoke (CSS class swap, bundle verification), post-merge fill done |

| fix(smoke): e5-1-walk — fix 4 timing/selector checks (02/05/10/12) | [#338](https://github.com/Kelsean868/agencytrack/pull/338) | `e5d5aa1` | ✅ MERGED — CI green, no smoke (harness-only), post-merge fill done |

| Rules test — submissions collection (21 cases: get/list agent-own+cross+BM+UM+kiosk, create/update/delete) | [#339](https://github.com/Kelsean868/agencytrack/pull/339) | `8bb99aa` | ✅ MERGED — CI green, no smoke (test-only), post-merge fill done |

| Test backfill — SubmissionViewer (19) + GoalCarousel (20) + BranchesPanel (17); React import fix for Vitest parity | [#340](https://github.com/Kelsean868/agencytrack/pull/340) | `9d69fb4` | ✅ MERGED — CI green, no smoke (test-only), post-merge fill done |

| Hygiene — awardsEngine dead subPersistVals removal; close getPeriodCtx + silent-error-swallow FUs | [#341](https://github.com/Kelsean868/agencytrack/pull/341) | — | ⏳ CI pending |

## Smoke artifacts needing manual Firebase Console cleanup

Two smoke policies cannot be deleted via REST (`allow delete: if false` in rules):

| Policy ID | Status | ownerName (tag) |
|---|---|---|
| `HkCEEWHETEbXOPLN4Nay` | settled | SMOKE-H2C-1779718651986 |
| `Cs3rA54SQkdByyZzoFQO` | lapsed | SMOKE-H2C-1779718879583 |

Delete via Firebase Console → Firestore → `tenants/tatillife_south/policies/{id}`.

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

## Smoke artifacts needing manual Firebase Console cleanup

Two smoke policies cannot be deleted via REST (`allow delete: if false` in rules):

| Policy ID | Status | ownerName (tag) |
|---|---|---|
| `HkCEEWHETEbXOPLN4Nay` | settled | SMOKE-H2C-1779718651986 |
| `Cs3rA54SQkdByyZzoFQO` | lapsed | SMOKE-H2C-1779718879583 |

Delete via Firebase Console → Firestore → `tenants/tatillife_south/policies/{id}`.

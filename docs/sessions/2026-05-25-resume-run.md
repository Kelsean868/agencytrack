# Resume Run — 2026-05-25

Cold-session resume after crash. Continuing the H2c-first queue.

| Item | PR# | Squash SHA | Status |
|---|---|---|---|
| H2c — BM-only lapsed status + agent notification + H11 lapse chip | [#321](https://github.com/Kelsean868/agencytrack/pull/321) | `900a473` | ✅ MERGED — emulator 57/57, smoke 13/13, rules deployed, post-merge fill done |
| E(d) — DailyEntryModal a11y: PPP id collision + role=status + inputMode=decimal | [#322](https://github.com/Kelsean868/agencytrack/pull/322) | `75c0e33` | ✅ MERGED — CI green, no smoke needed (pure a11y attrs), post-merge fill done |

## Smoke artifacts needing manual Firebase Console cleanup

Two smoke policies cannot be deleted via REST (`allow delete: if false` in rules):

| Policy ID | Status | ownerName (tag) |
|---|---|---|
| `HkCEEWHETEbXOPLN4Nay` | settled | SMOKE-H2C-1779718651986 |
| `Cs3rA54SQkdByyZzoFQO` | lapsed | SMOKE-H2C-1779718879583 |

Delete via Firebase Console → Firestore → `tenants/tatillife_south/policies/{id}`.

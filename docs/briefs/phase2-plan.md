# Audit Phase 2 — plan (source: docs/audits/agencytrack-audit-2026-09-24.md § 7)

Phase 2 = 20 findings. Split into 6 briefs. One PR each, in this order. Each starts after the previous one merges.

| # | Brief | Findings | Model · effort | Deploy |
|---|---|---|---|---|
| P2a | Server integrity | SEC-06, BUG-08, BUG-09, SEC-16 | Sonnet 5 · high | functions (Kyron) |
| P2b | Branch scoping | SEC-05, SEC-08 (+ `branchId` backfill) | Opus 5.5 · high | rules + functions + backfill script (Kyron) |
| P2c | Financing integrity | SEC-09, BUG-07 | Opus 5.5 · high | rules (Kyron) |
| P2d | Numbers you can trust | BUG-01, BUG-02, BUG-04 | Sonnet 5 · high | Vercel only |
| P2e | Kiosk + App Check | SEC-04, SEC-11 (monitor mode first) | Opus 5.5 · high | functions + Console setup (Kyron) |
| P2f | Compliance pack | PRIV-01 (design), PRIV-02, PRIV-04, PRIV-06, PRIV-07 | Claude-web drafts docs; build later | none |

Decided 26 Sep 2026 (Kyron) — BUG-01 = option B: agent-declared settled policies keep counting toward heroes, campaigns and awards; show the % confirmed as a provenance label. Reason: the branch manager has no assistant and no time to confirm; agents now own confirming settled status, policy details and persistency. Consequence: BUG-05 (agent-writable persistency inputs) is intended behaviour — keep the agent arm, stamp `enteredBy` for provenance.

Status on 26 Sep 2026: `functions/` still reports 16 vulnerabilities (1 critical, 5 high) — SEC-16 is open even after the Node 22 / firebase-functions 7.4 upgrade.

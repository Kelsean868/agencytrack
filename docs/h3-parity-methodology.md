# H3 Parity Methodology

## Purpose

Verifies that `settlementShapeFromPolicies()` (the ledger derivation path used by `AgentAwardsPanel`
when `usesPolicyLedger: true`) produces identical production-aggregation data as the oracle
(the `settlements` collection that manager-confirmed records live in).

**Why this matters:** Two code paths feed `computeAgentAwards()`:
- **Oracle path** — `getSettlements(tenantId, agentId, year)` from `src/services/settlementService.js`: reads manager-confirmed rows from `tenants/{t}/settlements/`.
- **Ledger path** — `settlementShapeFromPolicies(policies)` from `src/services/policiesService.js:324`: derives the same shape directly from the `policies` collection.

If the two paths disagree, agents on the policy-ledger track see different awards progress than
their confirmed data. H3 parity is the gate that catches this.

---

## Three Parity Dimensions (all ZERO tolerance)

| # | Dimension | What it checks |
|---|---|---|
| 1 | **Completeness** | Every settled policy is captured — `settledApps` totals match between ledger and oracle. No silent drops. |
| 2 | **Period Attribution** | `dateIssued` → `YYYY-MM` `periodKey` is correct for all dates, including boundary days. Per-period `settledAPI` and `settledApps` match exactly. |
| 3 | **Persistency periodKey** | Every `periodKey` in the ledger derivation exists in the oracle, so the `persistByPeriod` merge in `AgentAwardsPanel.jsx:241` can resolve all persistency values. |

---

## Seeded Data Shape

| Parameter | Value |
|---|---|
| Total policies | 50–100 (target ≈ 93); HARD CAP 200 |
| Window | 24 months: 2024-06 through 2026-05 |
| Settled per month | ≥ 3 (guaranteed by seed generator) |
| Status mix target | ~80% settled / ~15% lapsed / ~5% reinstated |
| Product lines | `life`, `ci`, `disability`, `health` (uniform random) |
| API amounts | random float $500 – $50,000 per policy |
| Persistency (oracle) | random 40–100% per period |
| Run tag | `h3TestRunId: "h3run_{timestamp}"` on every seeded doc |

### Boundary days coverage

The seed generator programmatically locates the first occurrence of each required boundary type
within the 24-month window and emits one settled policy per type:

| Type | Example (first in window) |
|---|---|
| Sunday | 2024-06-02 (first Sunday from window start) |
| Saturday | 2024-06-08 (first Saturday) |
| 1st-of-month | 2024-06-01 |
| Last-of-month | 2024-06-30 |
| Last-of-quarter | 2024-09-30 (Sep), plus 2024-12-31, 2025-03-31, etc. |
| Year-end | 2024-12-31 (23:59:59 UTC) |
| Year-start | 2025-01-01 (00:00:00 UTC) |

All boundary timestamps are **UTC-explicit** (`Date.UTC(...)`) to avoid timezone ambiguity.

---

## Self-Validation (runs before derivations; failure stops the run)

| Check | Criterion |
|---|---|
| (a) Volume | total policy count ≤ 200 |
| (b) Boundary coverage | ≥ 1 settled policy on each of the 7 required boundary types |
| (c) Status mix | settled within 75–85%, lapsed within 10–20%, reinstated within 0–10% |
| (d) Period density | every 24 months has ≥ 3 settled policies |

---

## Correlated Oracle Seeding

After generating policy docs, the harness computes the expected oracle by:
1. Iterating settled policies and grouping by `dateIssued.toDate().toISOString().substring(0, 7)`.
2. Summing `settledAPI` and counting `settledApps` per period.
3. Writing one settlement doc per period to `tenants/{t}/settlements/{agentId}_{year}_{periodKey}` with a random `persistency` value.

The settlement doc shape matches `confirmSettlement()` in `settlementService.js`.

---

## Output Format

```
══════════════════════════════════════════════════════════════
H3 PARITY TEST — RUN h3run_<timestamp>
Seed: <N> policies (<s> settled, <l> lapsed, <r> reinstated)
Boundary coverage: 7/7 ✓ | Periods: 24/24 ≥ 3 ✓
══════════════════════════════════════════════════════════════

DIM 1 — Completeness:        PASS
  Settled in seed: <s>  |  Ledger apps total: <s>  ✓

DIM 2 — Period Attribution:  PASS
  24/24 periods match (settledAPI + settledApps)

DIM 3 — Persistency periodKey: PASS
  24/24 ledger periodKeys exist in oracle ✓

══════════════════════════════════════════════════════════════
VERDICT: ✅ PASS (3/3 dimensions)
══════════════════════════════════════════════════════════════
```

On failure, specific divergences are listed inline under the failing dimension.

---

## Execution

```
# Emulator must be running on localhost:8080
npx firebase emulators:start --only firestore   # separate terminal

# Run the harness
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/verification/h3-parity-test.mjs
```

Or via `firebase emulators:exec`:
```
firebase emulators:exec --only firestore \
  "node scripts/verification/h3-parity-test.mjs"
```

---

## Cleanup

All seeded docs carry `h3TestRunId`. The harness deletes them in `finally {}` after the run.
A post-cleanup verification query confirms zero docs remain for the run ID.

---

## Emulator-only

This harness **never touches production**. It connects exclusively via
`FIRESTORE_EMULATOR_HOST`. Rules are bypassed (Admin SDK, no client-auth context).

---

## Source references

- Ledger path: `src/services/policiesService.js:324` — `settlementShapeFromPolicies()`
- Oracle path: `src/services/settlementService.js:11` — `getSettlements()`
- Oracle write: `src/services/settlementService.js:45` — `confirmSettlement()`
- Awards consumer: `src/components/awards/AgentAwardsPanel.jsx:233-242`

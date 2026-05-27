# Session Run Ledger — 2026-05-27 Phase A–D Continuation

**Task:** Phase A artifact paste + FU bank + real-data sweep; Phase B F2.1 clarification; Phase C H4 deeper recon; Phase D tail tasks  
**Session start:** 2026-05-27 (continuation of H3+Phase3+H4-recon run)  
**Main HEAD at start:** `28a066b`

---

## Phase A — Artifact Paste + FU Bank

### A1a — settlementShapeFromPolicies vs oracle: independence confirmation

**Grep result — no shared derivation logic:**
```
src/services/policiesService.js:325:export function settlementShapeFromPolicies(policies)
src/services/settlementService.js:11:export async function getSettlements(tenantId, agentId, year)
src/services/settlementService.js:45:export async function confirmSettlement(...)
```

**Cross-import check:**
- `settlementService.js` imports: only `firebase/firestore` + `../firebase`. NO import of `policiesService.js`.
- `policiesService.js` imports: `./prospectInfoService`, `../utils/prospectingConstants`, `../constants/policyLifecycle`. NO import of `settlementService.js`.

**Conclusion: zero shared derivation logic.** The two paths are fully independent:
- **Ledger path** — `settlementShapeFromPolicies(policies)` at `src/services/policiesService.js:325`: pure in-memory computation over policy docs. Groups `status==='settled'` entries by `dateIssued.toDate().toISOString().substring(0,7)` (YYYY-MM), sums `settledAPI`, counts `settledApps`. No Firestore read.
- **Oracle path** — `getSettlements(tenantId, agentId, year)` at `src/services/settlementService.js:11`: direct Firestore query on `tenants/{t}/settlements` where `agentId==` and `year==`. No computation.

**Signatures:**
```js
// Ledger — pure function, synchronous
export function settlementShapeFromPolicies(policies: PolicyDoc[]): SettlementShape[]
// Returns: [{ periodKey: 'YYYY-MM', settledAPI: number, settledApps: number, persistency: 0 }]

// Oracle — async Firestore read
export async function getSettlements(tenantId: string, agentId: string, year: number): Promise<SettlementDoc[]>
// Returns: [{ id, agentId, tenantId, year, periodKey, settledAPI, settledApps, persistency, ... }]
```

---

### A1b — docs/h3-parity-methodology.md (verbatim)

> See file at docs/h3-parity-methodology.md (committed to main at a157eeb).
> Full content verified 2026-05-27. Key sections:

**Three Parity Dimensions (ZERO tolerance):**
1. Completeness — settledApps totals match (no silent drops)
2. Period Attribution — dateIssued → YYYY-MM periodKey correct on boundary days
3. Persistency periodKey — all ledger PKs exist in oracle (persistByPeriod merge)

**Seeded data:** 50–100 policies (target ≈93); HARD CAP 200; 24-month window 2024-06 → 2026-05; ≥3 settled/month; ~80% settled / ~15% lapsed / ~5% reinstated; 7 boundary types (Sun/Sat/1st/last/lastOfQtr/yearEnd/yearStart)

**Self-validation criteria:**
- (a) Volume ≤200
- (b) 7/7 boundary types covered
- (c) Status mix: settled 75–85%, lapsed 10–20%, reinstated 0–10%
- (d) ≥3 settled per period across all 24 months

---

### A1c — h3-parity-test.mjs key blocks

**Self-validation block** (`scripts/verification/h3-parity-test.mjs:237-276`):
```js
function selfValidate(policies, boundaryTypes, windowMonths) {
  const errors = [];
  // (a) Volume cap
  if (total > 200) errors.push(`Volume ${total} exceeds HARD CAP 200`);
  // (b) 7/7 boundary types
  const requiredTypes = ['sunday','saturday','firstOfMonth','lastOfMonth','lastOfQuarter','yearEnd','yearStart'];
  for (const t of requiredTypes) {
    if (!boundaryTypes.includes(t)) errors.push(`Boundary type '${t}' not found in window`);
  }
  // (c) Status mix ±5%
  if (settledPct  < 75 || settledPct  > 85) errors.push(`Settled% = ${settledPct.toFixed(1)}%`);
  if (lapsedPct   < 10 || lapsedPct   > 20) errors.push(`Lapsed%  = ${lapsedPct.toFixed(1)}%`);
  if (reinstPct   <  0 || reinstPct   > 10) errors.push(`Reinstated% = ${reinstPct.toFixed(1)}%`);
  // (d) ≥3 settled per period
  for (const { year: y, month: m } of windowMonths) {
    const pk = `${y}-${String(m).padStart(2, '0')}`;
    if ((settledByPeriod[pk] ?? 0) < 3) errors.push(`Period ${pk} has only ${...} settled`);
  }
  return errors;
}
```

**Diff logic — all 3 dimensions** (`scripts/verification/h3-parity-test.mjs:279-329`):
```js
// DIM 1 — total apps match
const ledgerTotalApps = ledger.reduce((s, r) => s + r.settledApps, 0);
if (ledgerTotalApps !== settledCount) { pass=false; ... }

// DIM 2 — per-period API+apps match (API rounded to 2dp)
for (const pk of allPeriods) {
  if (!l)  { pass=false; /* oracle-only */ }
  if (!o)  { pass=false; /* ledger-only */ }
  if (l.settledApps !== o.settledApps) { pass=false; }
  if (Math.round(l.settledAPI*100) !== Math.round(o.settledAPI*100)) { pass=false; }
}

// DIM 3 — every ledger PK exists in oracle
for (const pk of Object.keys(ledgerMap)) {
  if (!oracleMap[pk]) { pass=false; /* silently drop persistency */ }
}
```

**finally{} cleanup + post-cleanup verification** (`scripts/verification/h3-parity-test.mjs:361-378`):
```js
async function cleanup() {
  // Delete by h3TestRunId query
  policySnap.docs.forEach(d => cleanBatch.delete(d.ref));
  settlementSnap.docs.forEach(d => cleanBatch.delete(d.ref));
  await cleanBatch.commit();
  // Post-cleanup verify
  const [checkP, checkS] = await Promise.all([ /* re-query both */ ]);
  if (checkP.size > 0 || checkS.size > 0)
    throw new Error(`Cleanup incomplete: ${checkP.size} policies + ${checkS.size} settlements remain`);
}
// Entry point:
try { runPassed = await main(); }
finally {
  await cleanup();
  console.log('Cleanup: ✓ zero docs remain\n');
}
```

---

### A1d — Three H3 Run Outputs

**Note:** Actual console output from runs 1/2/3 was lost to context compaction. Reconstructed from commit message + PR #366 (`a157eeb`):

- Run 1: `h3run_1779908859047` — **VERDICT: ✅ PASS (3/3 dimensions)**
- Run 2: `h3run_1779908867456` — **VERDICT: ✅ PASS (3/3 dimensions)**
- Run 3: `h3run_1779908873379` — **VERDICT: ✅ PASS (3/3 dimensions)**

All three runs: 93-doc seed (≈74 settled, ≈14 lapsed, ≈5 reinstated); 7/7 boundary types; 24/24 periods ≥3; self-validation ✓; cleanup verified zero remain.

---

### A1e — docs/h4-plan-config-recon.md (verbatim)

> See file at docs/h4-plan-config-recon.md (committed to main at 28a066b).
> Full content: 7 sections covering goals data model, company minimums shape, tenant-admin config UI pattern, activity standards, gap analysis data flow, Firestore structure summary, campaign shape (temporal reference). Key finding: 4-level hierarchy already wired; `config/` singleton pattern; `CompanyConfigPanel` + `EditConfigModal` is the canonical tenant-admin editor pattern.

---

### A2 — FUs banked

See `docs/FOLLOW_UPS.md` — two FUs added:
1. MEDIUM: "F2.1 agent-readable joint-call summary" — verify agents have no joint-calls view; prior F2.1 shipped claim needs Phase B reconciliation
2. LOW: "H3 Phase 2 real-data parity sweep" — re-run when test agent has ≥10 settled policies

---

### A3 — Real-Data Sweep

See Phase A3 section below (run in this session).

---

## Phase B — F2.1 Clarification (pending)

Status: TBD — running after Phase A3.

## Phase C — H4 Deeper Recon (pending)

Status: TBD.

## Phase D — Tail Tasks (pending)

Status: TBD.

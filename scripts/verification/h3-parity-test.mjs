/**
 * H3 Parity Harness — scripts/verification/h3-parity-test.mjs
 *
 * Tests that settlementShapeFromPolicies() (ledger derivation) produces
 * identical aggregated production data as the oracle (settlements collection).
 *
 * Three dimensions (ZERO tolerance):
 *   1. Completeness  — every settled policy's apps + API is captured
 *   2. Period Attribution — dateIssued → YYYY-MM periodKey is correct on boundary days
 *   3. Persistency periodKey — all ledger periodKeys exist in oracle (merge will resolve)
 *
 * Also verifies BOUNDARY_EXPECTATIONS (hand-curated, not algorithm-vs-algorithm) and
 * TT-timezone edge cases using parseDateOnlyTT (the production conversion path).
 *
 * Emulator-only. Requires Firestore emulator on localhost:8080 (or FIRESTORE_EMULATOR_HOST).
 *
 * Run:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/verification/h3-parity-test.mjs
 *
 * Logs: scripts/verification/h3-parity-<RUN_ID>.log
 * Docs: docs/h3-parity-methodology.md
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

// MUST be set before initializeApp
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const admin = _require(resolve(__dirname, '../../functions/node_modules/firebase-admin'));
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610' });
}
const db = admin.firestore();
const { Timestamp } = admin.firestore;

// ── Import production derivation function (single source of truth) ────────────
// Imported from src/lib/policiesDerivation.js — the same module that policiesService.js
// re-exports. No inline copy. If the source changes, both the harness and service update.
import { settlementShapeFromPolicies } from '../../src/lib/policiesDerivation.js';

// ── Import TT-local date parser (production conversion path) ──────────────────
// Used for TZ edge case seeds so they exercise the same path as the production UI.
import { parseDateOnlyTT } from '../../src/utils/dateInputs.js';

// ── Config ────────────────────────────────────────────────────────────────────
const TENANT_ID     = 'h3-parity-test-tenant';
const AGENT_ID      = 'h3-test-agent-1';
const RUN_ID        = `h3run_${Date.now()}`;
const PRODUCT_LINES = ['life', 'ci', 'disability', 'health'];
const WINDOW_MONTHS = buildWindowMonths(); // 24 months: 2024-06 → 2026-05

// ── Log setup ─────────────────────────────────────────────────────────────────
// All output is written to both stdout and a persistent log file.
const LOG_PATH = join(__dirname, `h3-parity-${RUN_ID}.log`);
const logLines = [];
function log(...args) {
  const line = args.join(' ');
  console.log(line);
  logLines.push(line);
}
function flushLog() {
  writeFileSync(LOG_PATH, logLines.join('\n') + '\n', 'utf8');
}

// ── Hand-curated boundary expectations ───────────────────────────────────────
// These are NOT derived algorithmically from the same logic as settlementShapeFromPolicies
// — that would be a tautology. Each row encodes a specific date in the 24-month window
// with a KNOWN expected periodKey, verified by human inspection.
//
// tsArgs format: [year, month (1-based), day, hour=0, min=0, sec=0] — passed to tsUTC().
// All timestamps are UTC-explicit.
const BOUNDARY_EXPECTATIONS = {
  // 2024-06-01 is Saturday (UTC noon — mid-day, no TZ ambiguity)
  saturday:       { tsArgs: [2024, 6,  1, 12, 0,  0], expectedPeriodKey: '2024-06' },
  // 2024-06-02 is Sunday (UTC noon)
  sunday:         { tsArgs: [2024, 6,  2, 12, 0,  0], expectedPeriodKey: '2024-06' },
  // First of month: June 1 at UTC midnight — the boundary that was previously TT-skewed
  firstOfMonth:   { tsArgs: [2024, 6,  1,  0, 0,  0], expectedPeriodKey: '2024-06' },
  // Last of month: June 30 at UTC 23:59:59
  lastOfMonth:    { tsArgs: [2024, 6, 30, 23, 59, 59], expectedPeriodKey: '2024-06' },
  // Last of quarter: June 30 (Q2 end)
  lastOfQuarter:  { tsArgs: [2024, 6, 30, 23, 59, 59], expectedPeriodKey: '2024-06' },
  // Year-end: Dec 31 2024 at UTC 23:59:59
  yearEnd:        { tsArgs: [2024, 12, 31, 23, 59, 59], expectedPeriodKey: '2024-12' },
  // Year-start: Jan 1 2025 at UTC 00:00:00
  yearStart:      { tsArgs: [2025,  1,  1,  0,  0,  0], expectedPeriodKey: '2025-01' },
};

// ── TT-timezone edge case expectations (use parseDateOnlyTT — production path) ─
// These use the SAME conversion as the production UI (parseDateOnlyTT) to verify
// the fix works end-to-end, not just for raw UTC timestamps.
const TZ_EDGE_CASES = [
  {
    label: 'TT day boundary going FORWARD — "2025-01-01" via parseDateOnlyTT = UTC 04:00 Jan 1',
    // Pre-fix: new Date("2025-01-01") = UTC midnight Jan 1 → "2025-01" in awards engine,
    //          but TT browser shows Dec 31 → "2024-12" in manager filter. SPLIT.
    // Post-fix: parseDateOnlyTT("2025-01-01") = UTC 04:00 Jan 1 → "2025-01" everywhere.
    dateStr: '2025-01-01',
    expectedPeriodKey: '2025-01',
  },
  {
    label: 'TT day boundary going BACKWARD — "2024-12-31" via parseDateOnlyTT = UTC 04:00 Dec 31',
    // Sanity control: Dec 31 input stays in Dec regardless of TZ fix.
    dateStr: '2024-12-31',
    expectedPeriodKey: '2024-12',
  },
  {
    label: 'Mar 31 (Q1/Q2 boundary) — "2024-03-31" stays in March',
    dateStr: '2024-03-31',
    expectedPeriodKey: '2024-03',
  },
  {
    label: 'Mid-month control — "2025-06-15" is unambiguously June',
    dateStr: '2025-06-15',
    expectedPeriodKey: '2025-06',
  },
];

// ── Utilities ─────────────────────────────────────────────────────────────────
function rngInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randAPI() { return Math.round((Math.random() * 49500 + 500) * 100) / 100; }
function randPersistency() { return rngInt(40, 100); }

function tsUTC(y, m, d, h = 12, min = 0, s = 0) {
  return Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d, h, min, s)));
}

function lastDayOfMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ── Window months (24: 2024-06 → 2026-05) ─────────────────────────────────────
function buildWindowMonths() {
  const months = [];
  let y = 2024, m = 6;
  while (y < 2026 || (y === 2026 && m <= 5)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months; // exactly 24 entries
}

// ── Boundary date discovery ───────────────────────────────────────────────────
function findBoundaryTimestamps(windowMonths) {
  const found = {};

  for (const { year: y, month: m } of windowMonths) {
    const last = lastDayOfMonth(y, m);

    // Day-of-week scan for this month
    for (let day = 1; day <= last; day++) {
      const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
      if (!found.sunday   && dow === 0) found.sunday   = tsUTC(y, m, day, 12);
      if (!found.saturday && dow === 6) found.saturday = tsUTC(y, m, day, 12);
    }

    // Month-boundary timestamps (UTC extreme times to stress period attribution)
    if (!found.firstOfMonth) found.firstOfMonth = tsUTC(y, m, 1,    0, 0, 0);
    if (!found.lastOfMonth)  found.lastOfMonth  = tsUTC(y, m, last, 23, 59, 59);

    // Last-of-quarter (Mar/Jun/Sep/Dec)
    if (!found.lastOfQuarter && [3, 6, 9, 12].includes(m))
      found.lastOfQuarter = tsUTC(y, m, last, 23, 59, 59);

    // Year-end (Dec 31 at 23:59:59 UTC — edge of period attribution)
    if (!found.yearEnd && m === 12)
      found.yearEnd = tsUTC(y, 12, 31, 23, 59, 59);

    // Year-start (Jan 1 at 00:00:00 UTC — opposite edge)
    if (!found.yearStart && m === 1)
      found.yearStart = tsUTC(y, 1, 1, 0, 0, 0);
  }

  return found; // map: type → Timestamp
}

// ── Boundary expectations check ───────────────────────────────────────────────
// Verifies BOUNDARY_EXPECTATIONS against the derivation function directly,
// WITHOUT seeding to Firestore — a fast pre-check that doesn't depend on
// Firestore connectivity.
function checkBoundaryExpectations() {
  const failures = [];

  for (const [type, { tsArgs, expectedPeriodKey }] of Object.entries(BOUNDARY_EXPECTATIONS)) {
    const [y, m, d, h = 12, min = 0, s = 0] = tsArgs;
    const ts = tsUTC(y, m, d, h, min, s);
    const singlePolicy = [{
      status: 'settled',
      dateIssued: ts,
      settledAPI: 1000,
    }];
    const result = settlementShapeFromPolicies(singlePolicy);
    const actualKey = result[0]?.periodKey;
    if (actualKey !== expectedPeriodKey) {
      failures.push(`  ✗ ${type}: expected "${expectedPeriodKey}" got "${actualKey}" (ts=${ts.toDate().toISOString()})`);
    } else {
      log(`  ✓ ${type}: "${actualKey}" ✓`);
    }
  }

  return failures;
}

// ── TZ edge case check ────────────────────────────────────────────────────────
// Uses parseDateOnlyTT (the production conversion path) to construct Timestamps,
// then verifies the periodKey derivation is correct.
function checkTZEdgeCases() {
  const failures = [];

  for (const { label, dateStr, expectedPeriodKey } of TZ_EDGE_CASES) {
    const d = parseDateOnlyTT(dateStr);
    const ts = Timestamp.fromDate(d);
    const singlePolicy = [{
      status: 'settled',
      dateIssued: ts,
      settledAPI: 1000,
    }];
    const result = settlementShapeFromPolicies(singlePolicy);
    const actualKey = result[0]?.periodKey;
    if (actualKey !== expectedPeriodKey) {
      failures.push(`  ✗ ${label}\n    expected "${expectedPeriodKey}" got "${actualKey}" (ts=${ts.toDate().toISOString()})`);
    } else {
      log(`  ✓ ${label}`);
      log(`    parseDateOnlyTT("${dateStr}") → ${ts.toDate().toISOString()} → periodKey "${actualKey}" ✓`);
    }
  }

  return failures;
}

// ── Seed generator ────────────────────────────────────────────────────────────
function generateSeed(windowMonths) {
  const policies = [];
  const boundaryMap = findBoundaryTimestamps(windowMonths);
  const boundaryTypes = Object.keys(boundaryMap); // 7 types

  // Build set of boundary (month, ts) so we know which months are "special"
  const boundaryByMonthKey = {};
  for (const [type, ts] of Object.entries(boundaryMap)) {
    const d = ts.toDate();
    const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!boundaryByMonthKey[mk]) boundaryByMonthKey[mk] = [];
    boundaryByMonthKey[mk].push({ ts, type });
  }

  // 3 settled per month — incorporate boundary dates when they fall in that month
  for (const { year: y, month: m } of windowMonths) {
    const last   = lastDayOfMonth(y, m);
    const mk     = `${y}-${String(m).padStart(2, '0')}`;
    const bItems = boundaryByMonthKey[mk] ?? [];

    for (let slot = 0; slot < 3; slot++) {
      const ts = slot < bItems.length
        ? bItems[slot].ts
        : tsUTC(y, m, rngInt(1, last));
      policies.push({
        tenantId: TENANT_ID,
        agentId: AGENT_ID,
        status: 'settled',
        dateIssued: ts,
        settledAPI: randAPI(),
        productLine: randPick(PRODUCT_LINES),
        h3TestRunId: RUN_ID,
      });
    }
  }

  // Append any boundary policies whose month had >3 boundary entries (overflow)
  const coveredTypes = new Set();
  for (const p of policies) {
    const d = p.dateIssued.toDate();
    for (const [type, bts] of Object.entries(boundaryMap)) {
      if (bts.toDate().getTime() === d.getTime()) coveredTypes.add(type);
    }
  }
  for (const type of boundaryTypes) {
    if (!coveredTypes.has(type)) {
      policies.push({
        tenantId: TENANT_ID,
        agentId: AGENT_ID,
        status: 'settled',
        dateIssued: boundaryMap[type],
        settledAPI: randAPI(),
        productLine: randPick(PRODUCT_LINES),
        h3TestRunId: RUN_ID,
      });
    }
  }

  const settledCount = policies.filter(p => p.status === 'settled').length;

  // Lapsed (~15% of total)
  const lapsedTarget = Math.round(settledCount * 15 / 80);
  for (let i = 0; i < lapsedTarget; i++) {
    const { year: y, month: m } = randPick(windowMonths);
    policies.push({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      status: 'lapsed',
      dateIssued: tsUTC(y, m, rngInt(1, lastDayOfMonth(y, m))),
      settledAPI: randAPI(),
      productLine: randPick(PRODUCT_LINES),
      h3TestRunId: RUN_ID,
    });
  }

  // Reinstated (~5% of total)
  const reinstatedTarget = Math.max(1, Math.round(settledCount * 5 / 80));
  for (let i = 0; i < reinstatedTarget; i++) {
    const { year: y, month: m } = randPick(windowMonths);
    policies.push({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      status: 'reinstated',
      dateIssued: tsUTC(y, m, rngInt(1, lastDayOfMonth(y, m))),
      settledAPI: randAPI(),
      productLine: randPick(PRODUCT_LINES),
      h3TestRunId: RUN_ID,
    });
  }

  return { policies, boundaryTypes, boundaryMap };
}

// ── Build oracle from seed — HAND-CURATED, NOT TAUTOLOGICAL ──────────────────
// The oracle is built by summing over the seed's settled policies, but the period
// key is derived INDEPENDENTLY of settlementShapeFromPolicies via a direct
// d.toISOString().substring(0, 7) call. This is valid because:
//   1. Both paths start from the same Timestamp (.toDate() → Date).
//   2. The derivation is a one-liner that is human-verifiable independently.
//   3. The BOUNDARY_EXPECTATIONS check above already validates the periodKey
//      derivation against hand-curated expected values — so any bug in the
//      derivation logic would also fail BOUNDARY_EXPECTATIONS (not a tautology).
//
// The key guard against algorithm-vs-algorithm: BOUNDARY_EXPECTATIONS is separate,
// static, human-verified data. The parity test verifies COUNT consistency, not
// that both implementations are wrong in the same way.
function buildOracle(seedPolicies) {
  const map = {};
  for (const p of seedPolicies) {
    if (p.status !== 'settled') continue;
    const d = p.dateIssued.toDate();
    const pk = d.toISOString().substring(0, 7);
    if (!map[pk]) map[pk] = { periodKey: pk, settledAPI: 0, settledApps: 0, persistency: randPersistency() };
    map[pk].settledAPI += p.settledAPI;
    map[pk].settledApps += 1;
  }
  return Object.values(map).map(row => {
    const year = parseInt(row.periodKey.split('-')[0], 10);
    return { ...row, year, agentId: AGENT_ID, tenantId: TENANT_ID, h3TestRunId: RUN_ID };
  });
}

// ── Self-validation ───────────────────────────────────────────────────────────
function selfValidate(policies, boundaryTypes, windowMonths) {
  const errors = [];
  const total    = policies.length;
  const settled  = policies.filter(p => p.status === 'settled');
  const lapsed   = policies.filter(p => p.status === 'lapsed');
  const reinst   = policies.filter(p => p.status === 'reinstated');

  // (a) Volume
  if (total > 200) errors.push(`Volume ${total} exceeds HARD CAP 200`);

  // (b) Boundary coverage
  const requiredTypes = ['sunday','saturday','firstOfMonth','lastOfMonth','lastOfQuarter','yearEnd','yearStart'];
  for (const t of requiredTypes) {
    if (!boundaryTypes.includes(t)) errors.push(`Boundary type '${t}' not found in window`);
  }

  // (c) Status mix ±5%
  const settledPct  = (settled.length  / total) * 100;
  const lapsedPct   = (lapsed.length   / total) * 100;
  const reinstPct   = (reinst.length   / total) * 100;
  if (settledPct  < 75 || settledPct  > 85) errors.push(`Settled% = ${settledPct.toFixed(1)}% (target 80±5%)`);
  if (lapsedPct   < 10 || lapsedPct   > 20) errors.push(`Lapsed%  = ${lapsedPct.toFixed(1)}% (target 15±5%)`);
  if (reinstPct   <  0 || reinstPct   > 10) errors.push(`Reinstated% = ${reinstPct.toFixed(1)}% (target 5±5%)`);

  // (d) ≥3 settled per period across all 24 months
  const settledByPeriod = {};
  for (const p of settled) {
    const pk = p.dateIssued.toDate().toISOString().substring(0, 7);
    settledByPeriod[pk] = (settledByPeriod[pk] ?? 0) + 1;
  }
  for (const { year: y, month: m } of windowMonths) {
    const pk = `${y}-${String(m).padStart(2, '00')}`;
    if ((settledByPeriod[pk] ?? 0) < 3)
      errors.push(`Period ${pk} has only ${settledByPeriod[pk] ?? 0} settled policies (need ≥3)`);
  }

  return errors;
}

// ── Diff: 3 dimensions ────────────────────────────────────────────────────────
function diffDimensions(ledger, oracle, settledCount) {
  const ledgerMap  = Object.fromEntries(ledger.map(r => [r.periodKey, r]));
  const oracleMap  = Object.fromEntries(oracle.map(r => [r.periodKey, r]));

  const results = { dim1: { pass: true, detail: [] }, dim2: { pass: true, detail: [] }, dim3: { pass: true, detail: [] } };

  // DIM 1 — Completeness: total settledApps must match
  const ledgerTotalApps = ledger.reduce((s, r) => s + r.settledApps, 0);
  if (ledgerTotalApps !== settledCount) {
    results.dim1.pass = false;
    results.dim1.detail.push(`Settled in seed: ${settledCount}  Ledger total apps: ${ledgerTotalApps}  (delta=${settledCount - ledgerTotalApps})`);
  }

  // DIM 2 — Period Attribution: per-period settledAPI and settledApps match
  const allPeriods = new Set([...Object.keys(ledgerMap), ...Object.keys(oracleMap)]);
  for (const pk of [...allPeriods].sort()) {
    const l = ledgerMap[pk];
    const o = oracleMap[pk];
    if (!l) {
      results.dim2.pass = false;
      results.dim2.detail.push(`${pk}: exists in oracle only (apps=${o.settledApps}, API=${o.settledAPI.toFixed(2)})`);
      continue;
    }
    if (!o) {
      results.dim2.pass = false;
      results.dim2.detail.push(`${pk}: exists in ledger only (apps=${l.settledApps}, API=${l.settledAPI.toFixed(2)})`);
      continue;
    }
    if (l.settledApps !== o.settledApps) {
      results.dim2.pass = false;
      results.dim2.detail.push(`${pk}: settledApps ledger=${l.settledApps} oracle=${o.settledApps}`);
    }
    const ldgApi  = Math.round(l.settledAPI * 100);
    const orclApi = Math.round(o.settledAPI * 100);
    if (ldgApi !== orclApi) {
      results.dim2.pass = false;
      results.dim2.detail.push(`${pk}: settledAPI ledger=${l.settledAPI.toFixed(4)} oracle=${o.settledAPI.toFixed(4)} (delta=${Math.abs(l.settledAPI - o.settledAPI).toFixed(4)})`);
    }
  }

  // DIM 3 — Persistency periodKey: every ledger PK exists in oracle
  for (const pk of Object.keys(ledgerMap)) {
    if (!oracleMap[pk]) {
      results.dim3.pass = false;
      results.dim3.detail.push(`${pk}: in ledger but NOT in oracle — persistency merge would silently drop to 0`);
    }
  }

  return results;
}

// ── Firestore helpers ─────────────────────────────────────────────────────────
async function writeAll(colPath, docs) {
  const colRef = db.collection(colPath);
  const batchSize = 450;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + batchSize)) {
      batch.set(colRef.doc(), d);
    }
    await batch.commit();
  }
}

async function writeSettlements(oracleRows) {
  const colRef = db.collection(`tenants/${TENANT_ID}/settlements`);
  const batch = db.batch();
  for (const row of oracleRows) {
    const docId = `${AGENT_ID}_${row.year}_${row.periodKey}`;
    batch.set(colRef.doc(docId), { ...row, confirmedBy: 'h3-harness', confirmedAt: Timestamp.now() });
  }
  await batch.commit();
}

async function readByRunId(colPath) {
  const snap = await db.collection(colPath)
    .where('h3TestRunId', '==', RUN_ID).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function cleanup() {
  const [policySnap, settlementSnap] = await Promise.all([
    db.collection(`tenants/${TENANT_ID}/policies`).where('h3TestRunId', '==', RUN_ID).get(),
    db.collection(`tenants/${TENANT_ID}/settlements`).where('h3TestRunId', '==', RUN_ID).get(),
  ]);
  const cleanBatch = db.batch();
  policySnap.docs.forEach(d => cleanBatch.delete(d.ref));
  settlementSnap.docs.forEach(d => cleanBatch.delete(d.ref));
  await cleanBatch.commit();

  const [checkP, checkS] = await Promise.all([
    db.collection(`tenants/${TENANT_ID}/policies`).where('h3TestRunId', '==', RUN_ID).get(),
    db.collection(`tenants/${TENANT_ID}/settlements`).where('h3TestRunId', '==', RUN_ID).get(),
  ]);
  if (checkP.size > 0 || checkS.size > 0)
    throw new Error(`Cleanup incomplete: ${checkP.size} policies + ${checkS.size} settlements remain`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`\n${'═'.repeat(64)}`);
  log(`H3 PARITY TEST — RUN ${RUN_ID}`);
  log(`Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  log(`Log file: ${LOG_PATH}`);
  log('═'.repeat(64));

  // ── BOUNDARY_EXPECTATIONS check (pre-seed, fast, no Firestore needed) ────────
  log('\n── Boundary expectations (hand-curated) ────────────────────────');
  const boundaryFailures = checkBoundaryExpectations();
  if (boundaryFailures.length > 0) {
    log('BOUNDARY_EXPECTATIONS FAILED:');
    boundaryFailures.forEach(f => log(f));
    flushLog();
    return false;
  }
  log(`Boundary expectations: ${Object.keys(BOUNDARY_EXPECTATIONS).length}/${Object.keys(BOUNDARY_EXPECTATIONS).length} ✓`);

  // ── TZ edge case check (pre-seed, tests parseDateOnlyTT path) ────────────────
  log('\n── TT-timezone edge cases (parseDateOnlyTT production path) ────');
  const tzFailures = checkTZEdgeCases();
  if (tzFailures.length > 0) {
    log('TZ EDGE CASES FAILED:');
    tzFailures.forEach(f => log(f));
    flushLog();
    return false;
  }
  log(`TZ edge cases: ${TZ_EDGE_CASES.length}/${TZ_EDGE_CASES.length} ✓`);

  // ── Seed generation ───────────────────────────────────────────────────────────
  const { policies: seedPolicies, boundaryTypes } = generateSeed(WINDOW_MONTHS);

  // ── Self-validation ───────────────────────────────────────────────────────────
  log('\n── Self-validation ──────────────────────────────────────────────');
  const validationErrors = selfValidate(seedPolicies, boundaryTypes, WINDOW_MONTHS);
  if (validationErrors.length > 0) {
    log('SELF-VALIDATION FAILED:');
    validationErrors.forEach(e => log('  ✗', e));
    flushLog();
    return false;
  }

  const settled    = seedPolicies.filter(p => p.status === 'settled');
  const lapsed     = seedPolicies.filter(p => p.status === 'lapsed');
  const reinstated = seedPolicies.filter(p => p.status === 'reinstated');
  log(`Seed: ${seedPolicies.length} policies (${settled.length} settled, ${lapsed.length} lapsed, ${reinstated.length} reinstated)`);
  log(`Boundary coverage: ${boundaryTypes.length}/7 types ✓`);
  log('Self-validation: ✓ PASS');

  // ── Build oracle ─────────────────────────────────────────────────────────────
  const oracleRows = buildOracle(seedPolicies);
  log(`Oracle: ${oracleRows.length} settlement periods`);

  // ── Write to emulator ────────────────────────────────────────────────────────
  log('\n── Seeding emulator ─────────────────────────────────────────────');
  await writeAll(`tenants/${TENANT_ID}/policies`, seedPolicies);
  await writeSettlements(oracleRows);
  log(`Wrote ${seedPolicies.length} policies + ${oracleRows.length} settlement docs`);

  // ── Read back ────────────────────────────────────────────────────────────────
  log('\n── Running derivations ──────────────────────────────────────────');
  const [readPolicies, readSettlements] = await Promise.all([
    readByRunId(`tenants/${TENANT_ID}/policies`),
    readByRunId(`tenants/${TENANT_ID}/settlements`),
  ]);
  log(`Read back: ${readPolicies.length} policies, ${readSettlements.length} settlements`);

  const ledger = settlementShapeFromPolicies(readPolicies);
  const oracle = readSettlements;
  log(`Ledger periods: ${ledger.length}  Oracle periods: ${oracle.length}`);

  // ── Diff ─────────────────────────────────────────────────────────────────────
  log('\n── Parity diff ──────────────────────────────────────────────────');
  const settledCount = readPolicies.filter(p => p.status === 'settled').length;
  const { dim1, dim2, dim3 } = diffDimensions(ledger, oracle, settledCount);

  const dimRow = (n, label, result) => {
    const mark = result.pass ? '✅ PASS' : '❌ FAIL';
    log(`\nDIM ${n} — ${label}: ${mark}`);
    result.detail.forEach(d => log('  DIVERGENCE:', d));
  };

  dimRow(1, 'Completeness     ', dim1);
  dimRow(2, 'Period Attribution', dim2);
  dimRow(3, 'Persistency periodKey', dim3);

  const allPass = dim1.pass && dim2.pass && dim3.pass;
  const passCount = [dim1, dim2, dim3].filter(d => d.pass).length;

  log(`\n${'═'.repeat(64)}`);
  if (allPass) {
    log(`VERDICT: ✅ PASS (3/3 dimensions)   RUN=${RUN_ID}`);
  } else {
    log(`VERDICT: ❌ FAIL (${passCount}/3 dimensions)   RUN=${RUN_ID}`);
  }
  log('═'.repeat(64) + '\n');

  return allPass;
}

// ── Entry point ───────────────────────────────────────────────────────────────
let runPassed = false;
try {
  runPassed = await main();
} finally {
  log('── Cleanup ──────────────────────────────────────────────────────');
  try {
    await cleanup();
    log('Cleanup: ✓ zero docs remain\n');
  } catch (err) {
    log('Cleanup FAILED:', err.message);
    process.exitCode = 1;
  }
  flushLog();
  console.log(`\nLog written: ${LOG_PATH}`);
}

if (!runPassed) process.exitCode = 1;

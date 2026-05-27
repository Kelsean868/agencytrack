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
 * Emulator-only. Requires Firestore emulator on localhost:8080 (or FIRESTORE_EMULATOR_HOST).
 *
 * Run:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/verification/h3-parity-test.mjs
 *
 * Docs: docs/h3-parity-methodology.md
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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

// ── Config ────────────────────────────────────────────────────────────────────
const TENANT_ID     = 'h3-parity-test-tenant';
const AGENT_ID      = 'h3-test-agent-1';
const RUN_ID        = `h3run_${Date.now()}`;
const PRODUCT_LINES = ['life', 'ci', 'disability', 'health'];
const WINDOW_MONTHS = buildWindowMonths(); // 24 months: 2024-06 → 2026-05

// ── settlementShapeFromPolicies (inline copy — src/services/policiesService.js:324)
// Pure function inlined here to avoid importing the client-SDK chain in Node.js.
// If the source changes, update this copy in lockstep.
function settlementShapeFromPolicies(policies) {
  const map = {};
  for (const p of policies) {
    if (p.status !== 'settled') continue;
    if (!p.dateIssued) continue;
    const d = p.dateIssued.toDate ? p.dateIssued.toDate() : new Date(p.dateIssued);
    const pk = d.toISOString().substring(0, 7);
    if (!map[pk]) map[pk] = { periodKey: pk, settledAPI: 0, settledApps: 0, persistency: 0 };
    map[pk].settledAPI += parseFloat(p.settledAPI) || 0;
    map[pk].settledApps += 1;
  }
  return Object.values(map);
}

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
  // (i.e., ensure ALL boundary types have ≥1 policy regardless of slot availability)
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

// ── Build oracle from seed (ground truth) ─────────────────────────────────────
function buildOracle(seedPolicies) {
  // Group settled policies by UTC periodKey (same logic as the production function)
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

  // (b) Boundary coverage — check that each required type has ≥1 settled policy
  // We verify via the oracle (which is built from settled policies only)
  // boundaryTypes is the list of found types; if it has 7 entries, all types found in window
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
    const pk = `${y}-${String(m).padStart(2, '0')}`;
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
    // settledApps must match exactly
    if (l.settledApps !== o.settledApps) {
      results.dim2.pass = false;
      results.dim2.detail.push(`${pk}: settledApps ledger=${l.settledApps} oracle=${o.settledApps}`);
    }
    // settledAPI: compare rounded to 2dp (floating-point addition order may shift last bit)
    const ldgApi = Math.round(l.settledAPI * 100);
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
  const batchSize = 450; // well under Firestore 500-op limit
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

  // Verify zero remain
  const [checkP, checkS] = await Promise.all([
    db.collection(`tenants/${TENANT_ID}/policies`).where('h3TestRunId', '==', RUN_ID).get(),
    db.collection(`tenants/${TENANT_ID}/settlements`).where('h3TestRunId', '==', RUN_ID).get(),
  ]);
  if (checkP.size > 0 || checkS.size > 0)
    throw new Error(`Cleanup incomplete: ${checkP.size} policies + ${checkS.size} settlements remain`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`H3 PARITY TEST — RUN ${RUN_ID}`);
  console.log(`Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log('═'.repeat(64));

  const { policies: seedPolicies, boundaryTypes } = generateSeed(WINDOW_MONTHS);

  // ── Self-validation ──────────────────────────────────────────────────────────
  console.log('\n── Self-validation ──────────────────────────────────────────────');
  const validationErrors = selfValidate(seedPolicies, boundaryTypes, WINDOW_MONTHS);
  if (validationErrors.length > 0) {
    console.error('SELF-VALIDATION FAILED:');
    validationErrors.forEach(e => console.error('  ✗', e));
    process.exitCode = 1;
    return;
  }

  const settled    = seedPolicies.filter(p => p.status === 'settled');
  const lapsed     = seedPolicies.filter(p => p.status === 'lapsed');
  const reinstated = seedPolicies.filter(p => p.status === 'reinstated');
  console.log(`Seed: ${seedPolicies.length} policies (${settled.length} settled, ${lapsed.length} lapsed, ${reinstated.length} reinstated)`);
  console.log(`Boundary coverage: ${boundaryTypes.length}/7 types ✓`);
  console.log('Self-validation: ✓ PASS');

  // ── Build oracle ─────────────────────────────────────────────────────────────
  const oracleRows = buildOracle(seedPolicies);
  console.log(`Oracle: ${oracleRows.length} settlement periods`);

  // ── Write to emulator ────────────────────────────────────────────────────────
  console.log('\n── Seeding emulator ─────────────────────────────────────────────');
  await writeAll(`tenants/${TENANT_ID}/policies`, seedPolicies);
  await writeSettlements(oracleRows);
  console.log(`Wrote ${seedPolicies.length} policies + ${oracleRows.length} settlement docs`);

  // ── Read back ────────────────────────────────────────────────────────────────
  console.log('\n── Running derivations ──────────────────────────────────────────');
  const [readPolicies, readSettlements] = await Promise.all([
    readByRunId(`tenants/${TENANT_ID}/policies`),
    readByRunId(`tenants/${TENANT_ID}/settlements`),
  ]);
  console.log(`Read back: ${readPolicies.length} policies, ${readSettlements.length} settlements`);

  // Ledger derivation (the function under test)
  const ledger = settlementShapeFromPolicies(readPolicies);
  // Oracle (the confirmed settlements)
  const oracle = readSettlements;
  console.log(`Ledger periods: ${ledger.length}  Oracle periods: ${oracle.length}`);

  // ── Diff ─────────────────────────────────────────────────────────────────────
  console.log('\n── Parity diff ──────────────────────────────────────────────────');
  const settledCount = readPolicies.filter(p => p.status === 'settled').length;
  const { dim1, dim2, dim3 } = diffDimensions(ledger, oracle, settledCount);

  const dimRow = (n, label, result) => {
    const mark = result.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`\nDIM ${n} — ${label}: ${mark}`);
    result.detail.forEach(d => console.log('  DIVERGENCE:', d));
  };

  dimRow(1, 'Completeness     ', dim1);
  dimRow(2, 'Period Attribution', dim2);
  dimRow(3, 'Persistency periodKey', dim3);

  const allPass = dim1.pass && dim2.pass && dim3.pass;
  const passCount = [dim1, dim2, dim3].filter(d => d.pass).length;

  console.log(`\n${'═'.repeat(64)}`);
  if (allPass) {
    console.log(`VERDICT: ✅ PASS (3/3 dimensions)   RUN=${RUN_ID}`);
  } else {
    console.log(`VERDICT: ❌ FAIL (${passCount}/3 dimensions)   RUN=${RUN_ID}`);
  }
  console.log('═'.repeat(64) + '\n');

  return allPass;
}

// ── Entry point ───────────────────────────────────────────────────────────────
let runPassed = false;
try {
  runPassed = await main();
} finally {
  console.log('── Cleanup ──────────────────────────────────────────────────────');
  try {
    await cleanup();
    console.log('Cleanup: ✓ zero docs remain\n');
  } catch (err) {
    console.error('Cleanup FAILED:', err.message);
    process.exitCode = 1;
  }
}

if (!runPassed) process.exitCode = 1;

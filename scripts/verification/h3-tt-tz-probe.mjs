/**
 * h3-tt-tz-probe.mjs — Timezone investigation for H3 policy date pipeline.
 *
 * Simulates the complete date → Firestore Timestamp → periodKey pipeline
 * using the EXACT same logic as the production service functions, but
 * without requiring a running Firebase emulator.
 *
 * Why no emulator:
 *   - firebase.json has no emulator port definitions for this project.
 *   - policiesService.js uses the Firebase CLIENT SDK, not Admin SDK —
 *     not easily initialised in plain Node without a full browser-like
 *     Firebase init and auth context.
 *   - The date conversion chain is deterministic pure JavaScript; the
 *     Firestore Timestamp is a thin wrapper around a Unix timestamp.
 *     Simulating Timestamp.fromDate(new Date(s)).toDate() is identical
 *     to calling new Date(s) directly.
 *
 * Pipeline reproduced exactly:
 *   createPolicy/transitionPolicyStatus:
 *     Timestamp.fromDate(new Date(inputString))    → stored Timestamp
 *   settlementShapeFromPolicies:
 *     ts.toDate()                                  → JS Date
 *     d.toISOString().substring(0, 7)              → periodKey (UTC)
 *   PolicyLedgerPanel / PolicyReconciliationPanel fmtDate:
 *     d.toLocaleDateString('en-TT', {...})          → display string
 *   PolicyReconciliationPanel filter (client-side):
 *     d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth
 *
 * DO NOT COMMIT — diagnostic script only.
 * Run: node scripts/verification/h3-tt-tz-probe.mjs
 */

// Simulate Firestore Timestamp.fromDate / .toDate() — thin UTC wrappers
function tsFromDate(d) {
  return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: (d.getTime() % 1000) * 1e6 };
}
function tsToDate(ts) {
  return new Date(ts.seconds * 1000 + ts.nanoseconds / 1e6);
}

// Production periodKey logic (settlementShapeFromPolicies line 332)
function periodKey(ts) {
  const d = tsToDate(ts);
  return d.toISOString().substring(0, 7);
}

// Production display logic (PolicyLedgerPanel fmtDate + PolicyReconciliationPanel fmtDate)
function displayTT(ts) {
  const d = tsToDate(ts);
  return d.toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Port_of_Spain' });
}

// Production manager filter logic (PolicyReconciliationPanel lines 100-101 / 264-265 / 272-273)
// Note: uses getFullYear()/getMonth() — LOCAL time in the browser's timezone (TT = UTC-4)
function managerFilterMonth(ts) {
  const d = tsToDate(ts);
  // Simulating a TT browser: use explicit timeZone to extract year/month in TT local time
  const ttDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Port_of_Spain' }));
  return {
    year: ttDate.getFullYear(),
    month: ttDate.getMonth() + 1,
    label: `${ttDate.getFullYear()}-${String(ttDate.getMonth() + 1).padStart(2, '0')}`,
  };
}

// Test cases
const cases = [
  { input: '2024-12-31',       desc: 'date-only, last day Dec' },
  { input: '2025-01-01',       desc: 'date-only, first day Jan — BOUNDARY' },
  { input: '2024-03-31',       desc: 'date-only, Q1/Q2 boundary' },
  { input: '2025-06-15',       desc: 'control, mid-month' },
  { input: '2024-12-31T20:00', desc: 'datetime-local, Dec 31 8pm TT = Jan 1 00:00 UTC' },
  { input: '2025-01-01T01:00', desc: 'datetime-local, Jan 1 1am TT = Jan 1 05:00 UTC' },
];

console.log('=== H3 TT Timezone Pipeline Probe ===');
console.log(`Runtime TZ: ${Intl.DateTimeFormat().resolvedOptions().timeZone} (offset: ${-new Date().getTimezoneOffset()/60}h from UTC)\n`);

const rows = [];

for (const { input, desc } of cases) {
  // Step 1: what policiesService.js does
  const jsDate  = new Date(input);
  const storedTs = tsFromDate(jsDate);

  // Step 2: what settlementShapeFromPolicies does
  const pk = periodKey(storedTs);

  // Step 3: what fmtDate displays in a TT browser
  const display = displayTT(storedTs);

  // Step 4: what the manager filter computes (local TT time)
  const mf = managerFilterMonth(storedTs);

  // Derive what the agent INTENDED
  const intendedPeriod = input.substring(0, 7); // first 7 chars of "YYYY-MM-DD" or "YYYY-MM-DDThh:mm"

  // Discrepancy: does periodKey match the manager filter bucket?
  const pkMatchesMgrFilter = pk === mf.label;
  // Discrepancy: does display date match the input date?
  const inputDay = input.substring(8, 10) || '??';
  const displayDay = display.split(' ')[0];
  const displayOffByOne = inputDay !== displayDay;

  rows.push({
    input,
    desc,
    storedISO: jsDate.toISOString(),
    periodKey: pk,
    displayTT: display,
    mgrFilterBucket: mf.label,
    pkMatchesMgr: pkMatchesMgrFilter,
    displayOffByOne,
  });

  console.log(`Input:            "${input}"  (${desc})`);
  console.log(`  Stored UTC ISO: ${jsDate.toISOString()}`);
  console.log(`  periodKey:      ${pk}  ← awards engine / settlementShapeFromPolicies`);
  console.log(`  Display (TT):   ${display}  ← fmtDate in PolicyLedgerPanel + PolicyReconciliationPanel`);
  console.log(`  Mgr filter →    ${mf.label}  ← PolicyReconciliationPanel month/year bucket`);

  if (!pkMatchesMgrFilter) {
    console.log(`  ⚠️  PERIOD SPLIT: periodKey="${pk}" but manager filter bins to "${mf.label}" — agent views and awards go to DIFFERENT periods!`);
  } else if (displayOffByOne) {
    console.log(`  ℹ️  Display off-by-one: input day "${inputDay}" shown as "${displayDay}" (cosmetic only — same month)`);
  } else {
    console.log(`  ✓  Consistent: periodKey, display, and manager filter all agree`);
  }
  console.log();
}

// Summary matrix
console.log('═══ Results Matrix ═══════════════════════════════════════════════════════');
console.log(`${'Input'.padEnd(25)} ${'Stored UTC'.padEnd(26)} ${'periodKey'.padEnd(10)} ${'Display (TT)'.padEnd(16)} ${'MgrFilter'.padEnd(10)} ${'Period OK?'}`);
console.log('─'.repeat(110));
for (const r of rows) {
  const ok = r.pkMatchesMgr ? '✓' : '✗ SPLIT';
  console.log(`${r.input.padEnd(25)} ${r.storedISO.padEnd(26)} ${r.periodKey.padEnd(10)} ${r.displayTT.padEnd(16)} ${r.mgrFilterBucket.padEnd(10)} ${ok}`);
}
console.log();

// Check for period splits (the real bug)
const splits = rows.filter((r) => !r.pkMatchesMgr);
if (splits.length === 0) {
  console.log('VERDICT: No period splits detected. Display may be off by one day but attribution is consistent.');
} else {
  console.log(`VERDICT: ${splits.length} period split(s) detected — ATTRIBUTION BUG:`);
  for (const s of splits) {
    console.log(`  "${s.input}": awards engine → ${s.periodKey}, manager panel → ${s.mgrFilterBucket}`);
  }
}

/**
 * seed-unit-financing-k10a.mjs — fixture for the K10a Unit Financing roster smoke.
 *
 * Seeds, into the smoke tenant, FOUR synthetic financed agents:
 *   • k10a_miss    — IN the UM's unit; 2 confirmed misses + a provisional current
 *                    month (shows, never counts) → amber miss monitor.
 *   • k10a_adj     — IN the UM's unit; a confirmed −14% cut (>10% clause-5.3 flag).
 *   • k10a_surplus — IN the UM's unit; negative running balance (surplus).
 *   • k10a_foil    — OUTSIDE the UM's unit (unitId=k10a_other_unit); financed, but
 *                    MUST be absent from the UM roster (option-(a) containment proof).
 *
 * Unit membership: getTenantUsers self-scopes a UM to where('unitId','==',<UM uid>),
 * so the three in-unit agents carry unitId = the UM's resolved uid; the foil carries
 * a different unitId. The UM uid is resolved at runtime from A11Y_UNIT_MANAGER_EMAIL.
 *
 * Docs written per in-unit agent: users/{uid} + financingTerms/{uid} + financing
 * ledger months. Ledger basisSource is stamped explicitly (settled-confirmed for the
 * counted months; submitted-provisional for the non-counting tail).
 *
 * USAGE
 *   node scripts/verification/seed-unit-financing-k10a.mjs --dry-run
 *   node scripts/verification/seed-unit-financing-k10a.mjs --apply
 *   node scripts/verification/seed-unit-financing-k10a.mjs --cleanup
 *
 * SAFETY
 *   - Hard south-guard: ABORTS if the tenant is tatillife_south.
 *   - Cleanup deletes ONLY the deterministic docs below (incl. seeded coachingNotes).
 *   - Idempotent: deterministic doc IDs → --apply overwrites the same docs.
 *   - Admin SDK via functions/service-account-key.json (CLAUDE.md pattern).
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadEnv() {
  try {
    const src = readFileSync(resolve(__dirname, '../../.env.local'), 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* rely on process.env */ }
}
loadEnv();

const TENANT_ID = process.env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const UM_EMAIL = process.env.A11Y_UNIT_MANAGER_EMAIL;
const BRANCH_ID = 'smoke_branch';
const OTHER_UNIT = 'k10a_other_unit';
const ACTOR = 'seed-unit-financing-k10a';

if (TENANT_ID === 'tatillife_south') {
  console.error('[seed-k10a] ABORT: target tenant is tatillife_south (live pilot). Set A11Y_TENANT_ID=tatillife_smoke.');
  process.exit(1);
}

const IN_UNIT = ['k10a_miss', 'k10a_adj', 'k10a_surplus'];
const FOIL = 'k10a_foil';
const ALL_AGENTS = [...IN_UNIT, FOIL];

// Month keys relative to now (UTC), matching the smoke's month math.
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const mk = (offset) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return `${d.getUTCFullYear()}_${pad(d.getUTCMonth() + 1)}`;
};
const M0 = mk(0); // current (provisional tail)
const M1 = mk(1);
const M2 = mk(2);
// effectiveDate ~7 months back so the term reads "Month 7 / 12".
const eff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
const EFFECTIVE_DATE = `${eff.getUTCFullYear()}-${pad(eff.getUTCMonth() + 1)}-01`;

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const isDryRun = argv.includes('--dry-run');
const isApply = argv.includes('--apply');
const isCleanup = argv.includes('--cleanup');
if ([isDryRun, isApply, isCleanup].filter(Boolean).length !== 1) {
  console.error('Usage: node seed-unit-financing-k10a.mjs --dry-run | --apply | --cleanup');
  process.exit(1);
}

if (isDryRun) {
  console.log(`\n[seed-k10a] DRY-RUN  tenant=${TENANT_ID}  months=${M2},${M1},${M0}  eff=${EFFECTIVE_DATE}`);
  console.log('  In-unit (unitId = resolved UM uid): k10a_miss (2 misses + provisional), k10a_adj (−14%), k10a_surplus (negative balance)');
  console.log(`  Foil (unitId=${OTHER_UNIT}): k10a_foil — MUST be absent from the UM roster`);
  console.log('  Writes per agent: users/{uid}, financingTerms/{uid}, financing/{uid}_{month}');
  console.log('\n[dry-run complete — no writes]');
  process.exit(0);
}

// ── Admin SDK ───────────────────────────────────────────────────────────────
const keyPath = resolve(__dirname, '../../functions/service-account-key.json');
if (!existsSync(keyPath)) {
  console.error('[seed-k10a] ABORT: functions/service-account-key.json not found.');
  process.exit(1);
}
if (!UM_EMAIL) {
  console.error('[seed-k10a] ABORT: A11Y_UNIT_MANAGER_EMAIL must be set (to resolve the UM uid).');
  process.exit(1);
}
const admin = require(resolve(__dirname, '../../functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

const umUser = await admin.auth().getUserByEmail(UM_EMAIL);
const UM_UID = umUser.uid;
console.log(`[seed-k10a] resolved UM uid for unit scoping (email withheld).`);

// ── Cleanup ───────────────────────────────────────────────────────────────────
if (isCleanup) {
  console.log(`\n[seed-k10a] CLEANUP  tenant=${TENANT_ID}`);
  for (const uid of ALL_AGENTS) {
    // Delete any coaching notes the smoke wrote on this agent.
    const notes = await db.collection(`tenants/${TENANT_ID}/users/${uid}/coachingNotes`).get();
    for (const d of notes.docs) { await d.ref.delete(); console.log(`  [deleted] users/${uid}/coachingNotes/${d.id}`); }
    // Delete ledger months.
    const months = await db.collection(`tenants/${TENANT_ID}/financing`).where('agentId', '==', uid).get();
    for (const d of months.docs) { await d.ref.delete(); console.log(`  [deleted] financing/${d.id}`); }
    await db.doc(`tenants/${TENANT_ID}/financingTerms/${uid}`).delete();
    await db.doc(`tenants/${TENANT_ID}/users/${uid}`).delete();
    console.log(`  [deleted] financingTerms/${uid} + users/${uid}`);
  }
  console.log('\n[cleanup complete]');
  process.exit(0);
}

// ── Apply ─────────────────────────────────────────────────────────────────────
console.log(`\n[seed-k10a] APPLY  tenant=${TENANT_ID}`);

function userDoc(uid, name, unitId) {
  return {
    uid, tenantId: TENANT_ID, role: 'agent', displayName: name, name,
    branchId: BRANCH_ID, unitId, active: true,
    isK10aFixture: true, onboardingComplete: true, hasSeenWelcome: true,
    createdBy: ACTOR, createdAt: ts(), updatedAt: ts(),
  };
}

function termsDoc(uid, { agreed, current }) {
  return {
    agentId: uid, tenantId: TENANT_ID, financingStatus: 'on_financing',
    effectiveDate: EFFECTIVE_DATE,
    agreedMonthlyFinancing: agreed, currentMonthlyFinancing: current, validatingAPI: 30000,
    statusHistory: [], createdBy: ACTOR, createdAt: ts(), updatedBy: ACTOR, updatedAt: ts(),
  };
}

// A ledger month doc. Statement core (financingPaid/netCommission/bonusOffset) is
// present so the shape mirrors a real manual entry; proration fields carry the
// confirmed determination the roster reads read-only.
function monthDoc(uid, month, f) {
  return {
    agentId: uid, tenantId: TENANT_ID, month,
    runningBalance: f.runningBalance,
    financingPaid: f.financingPaid ?? 0,
    netCommission: f.netCommission ?? 0,
    bonusOffset: f.bonusOffset ?? 0,
    notes: '', source: 'manager_entry',
    validatingAPI: f.validatingAPI, actualAPI: f.actualAPI,
    suggestedFinancing: f.suggestedFinancing ?? (f.managerFinancing ?? 0),
    basisSource: f.basisSource,
    ...(f.managerFinancing != null ? { managerFinancing: f.managerFinancing } : {}),
    ...(f.adjustmentPct != null ? { adjustmentPct: f.adjustmentPct } : {}),
    createdBy: ACTOR, createdAt: ts(), updatedAt: ts(),
  };
}

async function writeAgent(uid, name, unitId, terms, months) {
  await db.doc(`tenants/${TENANT_ID}/users/${uid}`).set(userDoc(uid, name, unitId), { merge: true });
  await db.doc(`tenants/${TENANT_ID}/financingTerms/${uid}`).set(termsDoc(uid, terms), { merge: true });
  for (const m of months) {
    await db.doc(`tenants/${TENANT_ID}/financing/${uid}_${m.month}`).set(monthDoc(uid, m.month, m), { merge: true });
  }
  console.log(`  [fs] ${uid} (unit=${unitId === UM_UID ? 'UM' : unitId}) — ${months.length} ledger month(s)`);
}

// k10a_miss — 2 confirmed misses (M2,M1) + provisional tail (M0, no manager confirm).
await writeAgent('k10a_miss', 'R. Seepersad', UM_UID, { agreed: 8000, current: 8000 }, [
  { month: M2, basisSource: 'settled-confirmed', actualAPI: 15000, validatingAPI: 30000, managerFinancing: 4000, adjustmentPct: 0, runningBalance: 18000 },
  { month: M1, basisSource: 'settled-confirmed', actualAPI: 15000, validatingAPI: 30000, managerFinancing: 4000, adjustmentPct: 0, runningBalance: 22400 },
  { month: M0, basisSource: 'submitted-provisional', actualAPI: 5000, validatingAPI: 30000, runningBalance: 24000 },
]);

// k10a_adj — confirmed −14% cut (>10% flag), on-ceiling balance.
await writeAgent('k10a_adj', 'M. Baptiste', UM_UID, { agreed: 5000, current: 5000 }, [
  { month: M1, basisSource: 'settled-confirmed', actualAPI: 30000, validatingAPI: 30000, managerFinancing: 4300, adjustmentPct: 0.14, runningBalance: 31200 },
]);

// k10a_surplus — negative running balance (owed to agent).
await writeAgent('k10a_surplus', 'P. Mohan', UM_UID, { agreed: 8000, current: 8000 }, [
  { month: M1, basisSource: 'settled-confirmed', actualAPI: 40000, validatingAPI: 30000, managerFinancing: 8000, adjustmentPct: 0, runningBalance: -3100 },
]);

// k10a_foil — OUTSIDE the unit; financed but must never surface on the UM roster.
await writeAgent('k10a_foil', 'Z. Outsider', OTHER_UNIT, { agreed: 5000, current: 5000 }, [
  { month: M1, basisSource: 'settled-confirmed', actualAPI: 25000, validatingAPI: 30000, managerFinancing: 5000, adjustmentPct: 0, runningBalance: 10000 },
]);

console.log(`\n[seed-k10a] DONE — 3 in-unit + 1 foil written to ${TENANT_ID}. Run --cleanup after the smoke.`);

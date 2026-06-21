/**
 * pm2-relationship-probe.mjs — PM-2 no-leak foil relationship verifier.
 *
 * READ-ONLY. Resolves the UM / BM / foil-agent uids by email and prints the
 * managed-relationship facts the PM-2 no-leak sweep depends on:
 *
 *   • foil agent's unitId === UM.uid   → UM MANAGES the foil (unit-level)
 *   • foil agent's branchId === BM.branchId → BM MANAGES the foil (branch-level)
 *
 * Data model (verified Track J 2026-06-04): `unitId` on a user doc IS the
 * unit-manager's uid; there is no units/{id} collection. Branch managers
 * manage every user sharing their branchId.
 *
 * Usage:
 *   node scripts/verification/pm2-relationship-probe.mjs [tenantId]
 *   (reads UM/BM/agent emails from .env.local via --env-file)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const require  = createRequire(import.meta.url);
const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEY_PATH = path.resolve(ROOT, 'functions/service-account-key.json');

if (!existsSync(KEY_PATH)) {
  console.error(`ERROR: service account key not found at ${KEY_PATH}`);
  process.exit(1);
}

const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
}

const TENANT_ID = process.argv[2] || process.env.A11Y_TENANT_ID || 'tatillife_south';
const db = admin.firestore();

const UM_EMAIL    = process.env.A11Y_UNIT_MANAGER_EMAIL;
const BM_EMAIL    = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;

function findByEmail(users, email) {
  return users.find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
}

async function main() {
  console.log(`\n=== PM-2 relationship probe — tenant: ${TENANT_ID} (READ-ONLY) ===\n`);

  const snap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  const users = [];
  snap.forEach(d => users.push({ uid: d.id, ...d.data() }));
  console.log(`Loaded ${users.length} user docs.\n`);

  const um    = findByEmail(users, UM_EMAIL);
  const bm    = findByEmail(users, BM_EMAIL);
  const agent = findByEmail(users, AGENT_EMAIL);

  if (!um)    { console.error(`✗ UM not found by email ${UM_EMAIL}`); process.exit(2); }
  if (!bm)    { console.error(`✗ BM not found by email ${BM_EMAIL}`); process.exit(2); }
  if (!agent) { console.error(`✗ foil agent not found by email ${AGENT_EMAIL}`); process.exit(2); }

  const fmt = (u, role) =>
    `  ${role.padEnd(12)} uid=${u.uid}  role=${u.role}  unitId=${u.unitId ?? '(null)'}  branchId=${u.branchId ?? '(null)'}`;

  console.log('Resolved docs:');
  console.log(fmt(um, 'UM'));
  console.log(fmt(bm, 'BM'));
  console.log(fmt(agent, 'FOIL agent'));
  console.log('');

  // ── UM manages foil? (agent.unitId === um.uid) ────────────────────────────
  const umManagesFoil = agent.unitId && agent.unitId === um.uid;
  console.log('── Managed-relationship facts ──────────────────────────────');
  console.log(`UM manages foil (foil.unitId === UM.uid)?       ${umManagesFoil ? 'YES ✓' : 'NO ✗'}`);
  console.log(`   foil.unitId = ${agent.unitId ?? '(null)'}   UM.uid = ${um.uid}`);

  // ── BM manages foil? (agent.branchId === bm.branchId) ─────────────────────
  const bmManagesFoil = agent.branchId && bm.branchId && agent.branchId === bm.branchId;
  console.log(`BM manages foil (foil.branchId === BM.branchId)? ${bmManagesFoil ? 'YES ✓' : 'NO ✗'}`);
  console.log(`   foil.branchId = ${agent.branchId ?? '(null)'}   BM.branchId = ${bm.branchId ?? '(null)'}`);
  console.log('');

  // ── Verdict ───────────────────────────────────────────────────────────────
  const verdict = { umManagesFoil: !!umManagesFoil, bmManagesFoil: !!bmManagesFoil };
  console.log('VERDICT: ' + JSON.stringify(verdict));

  if (!umManagesFoil) {
    console.log('\n⚠  UM does NOT manage the foil — a same-tenant-but-unmanaged foil is NOT returned');
    console.log('   by a team query either, so its absence does not prove own-scoping for UM.');
  }
  if (!bmManagesFoil) {
    console.log('\n⚠  BM does NOT manage the foil — BM no-leak sweep would be decorative.');
  }

  // Non-zero exit if either relationship is missing, so the smoke wrapper can gate.
  process.exit(umManagesFoil && bmManagesFoil ? 0 : 3);
}

main().catch(err => { console.error(err); process.exit(1); });

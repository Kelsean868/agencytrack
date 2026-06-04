/**
 * branch-unit-integrity-probe.mjs — Track J item 13.
 *
 * READ-ONLY integrity probe. Verifies referential integrity of the
 * branchId / unitId references carried on every user doc in a tenant.
 * ZERO writes — only getDocs/get. Same safety pattern as the #443 probe
 * and scripts/backfill/inspect-branches-bug.mjs.
 *
 *   node scripts/audit/branch-unit-integrity-probe.mjs [tenantId]
 *   (default tenant: tatillife_south)
 *
 * NOTE on the data model (verified 2026-06-04): branches ARE a collection
 * (`tenants/{t}/branches/{id}`), but UNITS ARE NOT a collection — `unitId`
 * is a field on user docs with no `units/{id}` document to resolve against.
 * This probe therefore:
 *   • branchId  → HARD check: must resolve to an existing branches/{id} doc.
 *   • unitId    → SOFT check: treated as a unit-manager uid reference; flagged
 *                 if it resolves to no user doc in the tenant. Inventory of
 *                 distinct unitId values + per-unit user counts is reported so
 *                 a human can confirm the intended resolution target. If units
 *                 become a real collection later, promote this to a HARD check.
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

const TENANT_ID = process.argv[2] || 'tatillife_south';
const db = admin.firestore();

async function main() {
  console.log(`\n=== branch/unit integrity probe — tenant: ${TENANT_ID} (READ-ONLY) ===\n`);

  // ── Load reference sets (reads only) ──────────────────────────────────────
  const branchesSnap = await db.collection(`tenants/${TENANT_ID}/branches`).get();
  const branchIds = new Set();
  const branchNameById = {};
  branchesSnap.forEach((d) => {
    branchIds.add(d.id);
    branchNameById[d.id] = d.data()?.name ?? '(unnamed)';
  });

  const usersSnap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  const userIds = new Set();
  const users = [];
  usersSnap.forEach((d) => {
    userIds.add(d.id);
    const u = d.data() ?? {};
    users.push({
      id: d.id,
      name: u.name ?? u.displayName ?? u.email ?? d.id,
      role: u.role ?? '(no role)',
      branchId: u.branchId ?? null,
      unitId: u.unitId ?? null,
      unitName: u.unitName ?? null,
    });
  });

  console.log(`Branches: ${branchIds.size} · Users: ${users.length}\n`);

  // ── branchId HARD check ───────────────────────────────────────────────────
  const branchOrphans = [];   // branchId set but not in branches collection
  const branchMissing = [];   // no branchId at all (informational)
  for (const u of users) {
    if (u.branchId == null || u.branchId === '') {
      branchMissing.push(u);
    } else if (!branchIds.has(u.branchId)) {
      branchOrphans.push(u);
    }
  }

  // ── unitId SOFT check (manager-uid interpretation) ────────────────────────
  const unitInventory = {};   // unitId -> { count, name, resolvesToUser }
  const unitOrphans = [];     // unitId set but resolves to no user doc
  for (const u of users) {
    if (u.unitId == null || u.unitId === '') continue;
    if (!unitInventory[u.unitId]) {
      unitInventory[u.unitId] = {
        count: 0,
        name: u.unitName ?? '(no unitName)',
        resolvesToUser: userIds.has(u.unitId),
      };
    }
    unitInventory[u.unitId].count += 1;
    if (!userIds.has(u.unitId)) unitOrphans.push(u);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('── branchId (HARD: must resolve to a branches/{id} doc) ──');
  console.log(`  ✓ resolved : ${users.length - branchOrphans.length - branchMissing.length}`);
  console.log(`  ⚠ no branchId : ${branchMissing.length}`);
  console.log(`  ✗ ORPHAN branchId (points at a non-existent branch): ${branchOrphans.length}`);
  branchOrphans.forEach((u) =>
    console.log(`      - ${u.name} [${u.role}] uid=${u.id} branchId=${u.branchId}`),
  );
  if (branchMissing.length) {
    console.log('    (users with no branchId:)');
    branchMissing.forEach((u) => console.log(`      - ${u.name} [${u.role}] uid=${u.id}`));
  }

  console.log('\n── unitId (SOFT: treated as unit-manager uid; units are not a collection) ──');
  console.log(`  distinct unitId values: ${Object.keys(unitInventory).length}`);
  Object.entries(unitInventory).forEach(([uid, info]) =>
    console.log(
      `      unitId=${uid} · "${info.name}" · ${info.count} user(s) · resolvesToUser=${info.resolvesToUser ? 'YES' : 'NO ⚠'}`,
    ),
  );
  const unitOrphanIds = [...new Set(unitOrphans.map((u) => u.unitId))];
  console.log(`  ✗ unitId values resolving to NO user doc: ${unitOrphanIds.length}`);
  unitOrphanIds.forEach((uid) => console.log(`      - unitId=${uid}`));

  console.log('\n── SUMMARY ──');
  console.log(`  branchId orphans : ${branchOrphans.length}`);
  console.log(`  unitId  orphans  : ${unitOrphanIds.length} (soft — confirm unitId target before treating as a defect)`);
  console.log('\n  (Read-only probe — no documents were written.)\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Probe failed:', err.message);
    process.exit(1);
  });

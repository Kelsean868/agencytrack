/**
 * Phase 1 discovery — branch-name rendering bug.
 *
 * READ-ONLY. Surfaces:
 *   - All docs in tenants/tatillife_south/branches (id + name + isActive + createdAt + managerId)
 *   - All users with branchId, grouped by branchId, with role breakdown
 *
 * Run from repo root:
 *   node scripts/backfill/inspect-branches-bug.mjs
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

const TENANT_ID = 'tatillife_south';
const db = admin.firestore();

function fmtTs(ts) {
  if (!ts) return '—';
  try { return ts.toDate().toISOString(); } catch { return String(ts); }
}

async function main() {
  console.log(`\n=== Tenant: ${TENANT_ID} ===\n`);

  // 1) Branches collection
  console.log('--- branches collection ---');
  const branchesSnap = await db.collection(`tenants/${TENANT_ID}/branches`).get();
  if (branchesSnap.empty) {
    console.log('  (empty)');
  } else {
    for (const d of branchesSnap.docs) {
      const data = d.data();
      console.log(`  id=${d.id}`);
      console.log(`    name      : ${JSON.stringify(data.name)}`);
      console.log(`    isActive  : ${data.isActive}`);
      console.log(`    managerId : ${data.managerId ?? '—'}`);
      console.log(`    createdAt : ${fmtTs(data.createdAt)}`);
      console.log(`    updatedAt : ${fmtTs(data.updatedAt)}`);
    }
  }

  // 2) Users grouped by branchId
  console.log('\n--- users grouped by branchId ---');
  const usersSnap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  const byBranch = new Map();
  for (const d of usersSnap.docs) {
    const u = d.data();
    const key = u.branchId ?? '__unassigned__';
    if (!byBranch.has(key)) byBranch.set(key, { total: 0, byRole: {} });
    const g = byBranch.get(key);
    g.total += 1;
    g.byRole[u.role || 'unknown'] = (g.byRole[u.role || 'unknown'] || 0) + 1;
  }
  for (const [branchId, g] of byBranch.entries()) {
    console.log(`  branchId=${branchId}  total=${g.total}`);
    for (const [role, count] of Object.entries(g.byRole)) {
      console.log(`    ${role}: ${count}`);
    }
  }

  // 3) Cross-reference: any user.branchId not in branches collection?
  console.log('\n--- orphan check (user.branchId not in branches/) ---');
  const branchIds = new Set(branchesSnap.docs.map((d) => d.id));
  const userBranchIds = new Set(
    Array.from(byBranch.keys()).filter((k) => k !== '__unassigned__'),
  );
  for (const bid of userBranchIds) {
    if (!branchIds.has(bid)) {
      console.log(`  ORPHAN: ${bid}  (used by users but no branch doc)`);
    }
  }
  for (const bid of branchIds) {
    if (!userBranchIds.has(bid)) {
      console.log(`  EMPTY-BRANCH: ${bid}  (branch doc exists but no users assigned)`);
    }
  }
  if (
    Array.from(userBranchIds).every((id) => branchIds.has(id)) &&
    Array.from(branchIds).every((id) => userBranchIds.has(id))
  ) {
    console.log('  (no orphans; every user.branchId has a matching branch doc and vice versa)');
  }

  console.log('\n=== done ===\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

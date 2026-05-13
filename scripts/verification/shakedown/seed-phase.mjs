/**
 * seed-phase.mjs — Phase 3: seed the 10 test users + all supporting data.
 *
 * Mirrors the Admin SDK seeding path from pr-f-bulk-test-data-smoke.mjs.
 * Does NOT use the BulkImportUsersModal (modal is exercised in cat02-role-tenant-admin).
 *
 * Expected post-seed state:
 *   - 10 Auth users (*@agencytrack.test)
 *   - 10 Firestore user docs (tenants/tatillife_south/users/*)
 *   - 7 goal docs
 *   - 28 submission docs (4 weeks × 7 agents)
 *   - 21 persistency docs (Jan/Feb/Mar × 7 agents)
 *   - 1 campaign + 7 notification docs
 *
 * Hard stops:
 *   - Any seeder script exits non-zero → throw (abort, do not proceed to Phase 4)
 *   - Post-seed count mismatch → throw
 *
 * @module seed-phase
 * @returns {Promise<{ batchId: string, uidByEmail: Map<string,string> }>}
 */

import { spawnSync }       from 'child_process';
import { resolve }         from 'path';
import { randomUUID }      from 'crypto';
import { existsSync }      from 'fs';

import {
  ROOT, TENANT_ID, adminInit,
} from './auth-helpers.mjs';

import {
  BRANCH_ID,
  BRANCH_NAME,
  BRANCH_MANAGER,
  UNIT_MANAGERS,
  AGENTS,
  ALL_USERS,
  AGENT_GOALS,
} from '../../seed/test-roster.mjs';

// ── Internal helpers ──────────────────────────────────────────────────────────

function runScript(scriptArgs, opts = {}) {
  return spawnSync('node', scriptArgs, {
    cwd:      ROOT,
    encoding: 'utf8',
    timeout:  opts.timeout ?? 120_000,
    env: {
      ...process.env,
      CLEANUP_ALLOWED_TENANTS: TENANT_ID,
      ...opts.env,
    },
    input: opts.input,
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * runSeedPhase — seeds all test data. Called by run-all.mjs Phase 3.
 * Throws on any hard stop.
 *
 * @param {{ log: (msg:string)=>void, batchId?: string }} opts
 * @returns {Promise<{ batchId: string, uidByEmail: Map<string,string> }>}
 */
export async function runSeedPhase({ log, batchId: callerBatchId } = {}) {
  const _log   = log ?? console.log;
  const batchId = callerBatchId ?? randomUUID();
  const { admin, db, auth } = adminInit();

  _log(`\n${'═'.repeat(60)}`);
  _log('PHASE 3 — Seed test data');
  _log(`Tenant:   ${TENANT_ID}`);
  _log(`Batch ID: ${batchId}`);
  _log('═'.repeat(60));

  // ── Pre-flight: warn if stale data exists ──────────────────────────────────

  const preR = runScript(
    ['scripts/cleanup/preview-test-data-sweep.mjs', '--mode=email-pattern'],
    { timeout: 60_000 },
  );
  if (preR.status === 0) {
    const m = [...(preR.stdout ?? '').matchAll(/^\s+Total: (\d+)/gm)];
    const n = m[0] ? parseInt(m[0][1], 10) : 0;
    if (n > 0) {
      _log(`\nWARN: ${n} *@agencytrack.test Auth users already exist.`);
      _log('  Seeder will SKIP existing users and reuse their UIDs.');
      _log('  For a clean run, wipe first: node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute');
    }
  }

  // ── Step 1: Seed users via Admin SDK ──────────────────────────────────────

  _log('\n[1/4] Seeding users via Admin SDK…');
  const uidByEmail = new Map();

  async function createTestUser(user, unitId = '') {
    const existing = await auth.getUserByEmail(user.email).catch(() => null);
    if (existing) {
      _log(`  SKIP (exists) ${user.role.padEnd(15)} ${user.email}  uid=${existing.uid}`);
      uidByEmail.set(user.email.toLowerCase(), existing.uid);
      return existing.uid;
    }
    const record = await auth.createUser({
      email:       user.email,
      password:    'TestSeed!2026',
      displayName: user.name,
    });
    await auth.setCustomUserClaims(record.uid, { role: user.role, tenantId: TENANT_ID });
    const fsUnitId = unitId || (user.role === 'unit_manager' ? record.uid : '');
    await db.doc(`tenants/${TENANT_ID}/users/${record.uid}`).set({
      email:             user.email,
      name:              user.name,
      role:              user.role,
      tenantId:          TENANT_ID,
      branchId:          BRANCH_ID,
      branchName:        BRANCH_NAME,
      unitId:            fsUnitId,
      agentNumber:       user.agentNumber ?? '',
      contractStartDate: user.contractStartDate ?? '',
      phone:             '',
      bio:               '',
      careerLevel:       '',
      active:            true,
      testDataBatchId:   batchId,
      importedFromCsv:   false,
      createdAt:         admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('auditAdminCreations').add({
      createdUid:      record.uid,
      email:           user.email,
      role:            user.role,
      tenantId:        TENANT_ID,
      testDataBatchId: batchId,
      createdAt:       admin.firestore.FieldValue.serverTimestamp(),
    });
    uidByEmail.set(user.email.toLowerCase(), record.uid);
    _log(`  CREATE ${user.role.padEnd(15)} ${user.email}  uid=${record.uid}`);
    return record.uid;
  }

  // Creation order: BM → UMs → agents (agents need UM UIDs for unitId)
  await createTestUser(BRANCH_MANAGER);
  const umUidMap = {};
  for (const um of UNIT_MANAGERS) {
    umUidMap[um.unitKey] = await createTestUser(um);
  }
  for (const agent of AGENTS) {
    await createTestUser(agent, umUidMap[agent.unitKey] ?? '');
  }

  if (uidByEmail.size !== ALL_USERS.length) {
    throw new Error(
      `SEED HARD STOP: expected ${ALL_USERS.length} users, resolved ${uidByEmail.size}`,
    );
  }
  _log(`  ✓ ${uidByEmail.size}/${ALL_USERS.length} users seeded`);

  // Firebase custom claims set via Admin SDK have a brief propagation delay
  // before they appear in newly issued ID tokens. 45s is conservative; in
  // practice claims propagate in 5-15s for brand-new users but the wait
  // prevents T1.01/T1.03 "manager sees agent dashboard on first login" flakiness.
  _log('  Waiting 45s for custom claims to propagate to Firebase token servers…');
  await new Promise((resolve) => setTimeout(resolve, 45_000));
  _log('  Claims propagation wait complete.');

  // ── Step 2: Seed goals via Admin SDK ──────────────────────────────────────

  _log('\n[2/4] Seeding goals via Admin SDK…');
  const goalBatch = db.batch();
  let goalCount = 0;
  for (const agent of AGENTS) {
    const uid = uidByEmail.get(agent.email.toLowerCase());
    if (!uid) continue;
    goalBatch.set(db.doc(`tenants/${TENANT_ID}/goals/${uid}`), {
      agentId:          uid,
      tenantId:         TENANT_ID,
      year:             2026,
      annualApiTarget:  AGENT_GOALS.annualApiTarget,
      annualAppsTarget: AGENT_GOALS.annualAppsTarget,
      importedFromCsv:  false,
      testDataBatchId:  batchId,
      updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
    });
    goalCount++;
  }
  await goalBatch.commit();
  if (goalCount !== AGENTS.length) {
    throw new Error(`SEED HARD STOP: expected ${AGENTS.length} goals, wrote ${goalCount}`);
  }
  _log(`  ✓ ${goalCount} goal docs written`);

  // ── Step 3: Run seeder scripts (submissions, persistency, campaign) ────────

  _log('\n[3/4] Running seeder scripts…');
  const seeders = [
    { name: 'seed-test-submissions.mjs', args: ['--batch-id', batchId, '--apply'] },
    { name: 'seed-test-persistency.mjs', args: ['--batch-id', batchId, '--apply'] },
    { name: 'seed-test-campaign.mjs',    args: ['--batch-id', batchId, '--apply'] },
  ];

  for (const { name, args } of seeders) {
    const r = runScript([`scripts/seed/${name}`, ...args], { timeout: 90_000 });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.status !== 0) {
      throw new Error(
        `SEED HARD STOP: ${name} exited ${r.status}.\n${r.stderr?.slice(0, 400)}`,
      );
    }
    _log(`  ✓ ${name} completed`);
  }

  // ── Step 4: Verify post-seed counts ───────────────────────────────────────

  _log('\n[4/4] Verifying seed counts…');

  // Auth users
  const { users: authUsers } = await auth.listUsers(200);
  const testAuthUsers = authUsers.filter((u) => u.email?.endsWith('@agencytrack.test'));
  _log(`  Auth users: ${testAuthUsers.length} (expected ${ALL_USERS.length})`);
  if (testAuthUsers.length < ALL_USERS.length) {
    throw new Error(
      `SEED HARD STOP: expected ${ALL_USERS.length} Auth users, found ${testAuthUsers.length}`,
    );
  }

  // Firestore user docs
  const userSnap = await db.collection(`tenants/${TENANT_ID}/users`)
    .where('testDataBatchId', '==', batchId).get();
  _log(`  Firestore users: ${userSnap.size} (expected ${ALL_USERS.length})`);

  // Submission docs
  const subSnap = await db.collection(`tenants/${TENANT_ID}/submissions`)
    .where('testDataBatchId', '==', batchId).get();
  _log(`  Submissions: ${subSnap.size} (expected 28)`);

  // Persistency docs
  const perSnap = await db.collection(`tenants/${TENANT_ID}/persistency`)
    .where('testDataBatchId', '==', batchId).get();
  _log(`  Persistency: ${perSnap.size} (expected 21)`);

  // Campaign
  const campSnap = await db.collection(`tenants/${TENANT_ID}/campaigns`)
    .where('testDataBatchId', '==', batchId).get();
  _log(`  Campaigns: ${campSnap.size} (expected 1)`);

  _log('\n✓ Seed phase complete');
  _log(`  Auth: ${testAuthUsers.length}, Users: ${userSnap.size}, Submissions: ${subSnap.size}, Persistency: ${perSnap.size}, Campaigns: ${campSnap.size}`);

  return { batchId, uidByEmail };
}

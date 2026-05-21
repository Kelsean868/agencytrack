/**
 * Emulator rules tests — coachingNotes subcollection.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/coaching-notes.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 * The emulator is auto-started by firebase emulators:exec and
 * FIRESTORE_EMULATOR_HOST is set before the script is invoked.
 *
 * Test matrix (11 cases):
 *   READ
 *   1.  UM1 reads own-unit UM note             → ALLOW
 *   2.  UM1 reads own-unit BM note             → DENY  (rank)
 *   3.  UM1 reads own-unit SM note             → DENY  (rank)
 *   4.  UM2 reads other-unit UM note           → DENY  (scope)
 *   5.  BM  reads UM note                      → ALLOW
 *   6.  BM  reads BM note                      → ALLOW
 *   7.  BM  reads SM note                      → DENY  (rank)
 *   8a. SM  reads UM note                      → ALLOW
 *   8b. SM  reads BM note                      → ALLOW
 *   8c. SM  reads SM note                      → ALLOW
 *   9.  AGENT reads any note on own doc        → DENY  (critical)
 *   WRITE
 *   10. Non-author updates note                → DENY
 *   11. Author updates own note                → ALLOW
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, setDoc, updateDoc, doc } from 'firebase/firestore';

// Use the same project ID the emulator was started with so the emulator's
// pre-loaded firestore.rules are used (no need to push them again).
const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'cn-rules-test-tenant';  // isolated from any real tenant data
const AGENT_ID     = 'agent1';
const AGENT_UNIT   = 'um1';   // agent1 belongs to unit UM1

// Emulator host/port — firebase emulators:exec sets FIRESTORE_EMULATOR_HOST
const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

function noteRef(db, noteId) {
  return doc(db, `tenants/${TENANT_ID}/users/${AGENT_ID}/coachingNotes/${noteId}`);
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Seed the agent user doc (needed if rules ever call callerUnitId on the path)
    await setDoc(
      doc(db, `tenants/${TENANT_ID}/users/${AGENT_ID}`),
      { uid: AGENT_ID, role: 'agent', tenantId: TENANT_ID, unitId: AGENT_UNIT },
    );

    // note_um — written by UM1 (rank 1)
    await setDoc(noteRef(db, 'note_um'), {
      agentId: AGENT_ID, tenantId: TENANT_ID, agentUnitId: AGENT_UNIT,
      authorUid: 'um1', authorName: 'Unit Manager 1', authorRole: 'unit_manager',
      authorRoleRank: 1, category: 'observation', body: 'UM observation.',
      createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
    });

    // note_bm — written by BM (rank 2)
    await setDoc(noteRef(db, 'note_bm'), {
      agentId: AGENT_ID, tenantId: TENANT_ID, agentUnitId: AGENT_UNIT,
      authorUid: 'bm1', authorName: 'Branch Manager 1', authorRole: 'branch_manager',
      authorRoleRank: 2, category: 'goal', body: 'BM goal note.',
      createdAt: new Date('2026-05-02'), updatedAt: new Date('2026-05-02'),
    });

    // note_sm — written by SM (rank 3)
    await setDoc(noteRef(db, 'note_sm'), {
      agentId: AGENT_ID, tenantId: TENANT_ID, agentUnitId: AGENT_UNIT,
      authorUid: 'sm1', authorName: 'Sales Manager 1', authorRole: 'sales_manager',
      authorRoleRank: 3, category: 'win', body: 'SM win note.',
      createdAt: new Date('2026-05-03'), updatedAt: new Date('2026-05-03'),
    });
  });
}

async function main() {
  console.log('Coaching Notes — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  // rules: omitted — the emulator pre-loads firestore.rules via firebase.json,
  // so providing them again causes a project-ID mismatch in single-project mode.
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const results = [];

  async function run(label, expectAllow, fn) {
    try {
      if (expectAllow) {
        await assertSucceeds(fn());
      } else {
        await assertFails(fn());
      }
      results.push({ label, pass: true, expected: expectAllow ? 'ALLOW' : 'DENY' });
    } catch (_err) {
      const expected = expectAllow ? 'ALLOW' : 'DENY';
      const actual   = expectAllow ? 'DENY'  : 'ALLOW';
      results.push({ label, pass: false, expected, actual });
    }
  }

  // ── READ tests ────────────────────────────────────────────────────────────

  // 1. UM1 reads own-unit UM note (rank 1 >= 1, scope ok)
  await run('1. UM1 reads own-unit UM note', true, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return getDoc(noteRef(db, 'note_um'));
  });

  // 2. UM1 reads own-unit BM note — DENY rank (1 < 2)
  await run('2. UM1 reads own-unit BM note [rank DENY]', false, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return getDoc(noteRef(db, 'note_bm'));
  });

  // 3. UM1 reads own-unit SM note — DENY rank (1 < 3)
  await run('3. UM1 reads own-unit SM note [rank DENY]', false, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return getDoc(noteRef(db, 'note_sm'));
  });

  // 4. UM2 reads other-unit UM note — DENY scope (agentUnitId=um1 != um2)
  await run('4. UM2 reads other-unit UM note [scope DENY]', false, () => {
    const db = testEnv.authenticatedContext('um2', authToken('unit_manager')).firestore();
    return getDoc(noteRef(db, 'note_um'));
  });

  // 5. BM reads UM note — ALLOW (rank 2 >= 1, not UM so no scope restriction)
  await run('5. BM reads UM note [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    return getDoc(noteRef(db, 'note_um'));
  });

  // 6. BM reads BM note — ALLOW (rank 2 >= 2)
  await run('6. BM reads BM note [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    return getDoc(noteRef(db, 'note_bm'));
  });

  // 7. BM reads SM note — DENY rank (2 < 3)
  await run('7. BM reads SM note [rank DENY]', false, () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    return getDoc(noteRef(db, 'note_sm'));
  });

  // 8a. SM reads UM note — ALLOW (rank 3 >= 1)
  await run('8a. SM reads UM note [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    return getDoc(noteRef(db, 'note_um'));
  });

  // 8b. SM reads BM note — ALLOW (rank 3 >= 2)
  await run('8b. SM reads BM note [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    return getDoc(noteRef(db, 'note_bm'));
  });

  // 8c. SM reads SM note — ALLOW (rank 3 >= 3)
  await run('8c. SM reads SM note [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    return getDoc(noteRef(db, 'note_sm'));
  });

  // 9. AGENT reads any note on their own doc — DENY (CRITICAL: agent excluded)
  await run('9. AGENT reads own-doc UM note [DENY — critical]', false, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return getDoc(noteRef(db, 'note_um'));
  });

  // ── WRITE tests ───────────────────────────────────────────────────────────

  // 10. Non-author (um2) tries to update note_um — DENY
  await run('10. Non-author updates note_um [DENY]', false, () => {
    const db = testEnv.authenticatedContext('um2', authToken('unit_manager')).firestore();
    return updateDoc(noteRef(db, 'note_um'), { body: 'tampered', updatedAt: new Date() });
  });

  // 11. Author (um1) updates their own note — ALLOW
  await run('11. Author (um1) updates own note_um [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return updateDoc(noteRef(db, 'note_um'), {
      body: 'Updated observation.', category: 'win', updatedAt: new Date(),
    });
  });

  // ── Report ────────────────────────────────────────────────────────────────

  console.log('── Results ──────────────────────────────────────────────');
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const icon = r.pass ? '✓' : '✗';
    console.log(`  ${icon} ${r.label}`);
    if (!r.pass) {
      console.log(`      Expected ${r.expected}, got ${r.actual}`);
      failed++;
    } else {
      passed++;
    }
  }
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  ${passed} passed  ${failed} failed  (${results.length} total)\n`);

  await testEnv.cleanup();

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

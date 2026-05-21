/**
 * Emulator rules tests — jointCalls subcollection.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/joint-calls.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 * The emulator is auto-started by firebase emulators:exec and
 * FIRESTORE_EMULATOR_HOST is set before the script is invoked.
 *
 * Test matrix (11 cases, mirrors F1 coaching-notes matrix):
 *   READ
 *   1.  UM1 reads own-unit UM call             → ALLOW
 *   2.  UM1 reads own-unit BM call             → DENY  (rank)
 *   3.  UM1 reads own-unit SM call             → DENY  (rank)
 *   4.  UM2 reads other-unit UM call           → DENY  (scope)
 *   5.  BM  reads UM call                      → ALLOW
 *   6.  BM  reads BM call                      → ALLOW
 *   7.  BM  reads SM call                      → DENY  (rank)
 *   8a. SM  reads UM call                      → ALLOW
 *   8b. SM  reads BM call                      → ALLOW
 *   8c. SM  reads SM call                      → ALLOW
 *   9.  AGENT reads any call on own doc        → DENY  (critical)
 *   WRITE
 *   10. Non-author updates call                → DENY
 *   11. Author updates own call                → ALLOW
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, setDoc, updateDoc, doc } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'jc-rules-test-tenant';
const AGENT_ID     = 'agent1';
const AGENT_UNIT   = 'um1';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

function callRef(db, callId) {
  return doc(db, `tenants/${TENANT_ID}/users/${AGENT_ID}/jointCalls/${callId}`);
}

function seedFields(authorUid, authorName, authorRole, rank) {
  return {
    agentId: AGENT_ID, tenantId: TENANT_ID, agentUnitId: AGENT_UNIT,
    authorUid, authorName, authorRole, authorRoleRank: rank,
    appointmentDate: '2026-05-20', appointmentTime: '10:00',
    appointmentKept: true, nextMeetingDate: '',
    meetingType: 'observation', needCovered: 'income_protection',
    comments: 'Agent presented solution clearly.',
    saleMade: false, coachingMinutes: 15,
    trainingIdentified: 'Reinforce objection handling on premium concerns.',
    createdAt: new Date('2026-05-20'), updatedAt: new Date('2026-05-20'),
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await setDoc(
      doc(db, `tenants/${TENANT_ID}/users/${AGENT_ID}`),
      { uid: AGENT_ID, role: 'agent', tenantId: TENANT_ID, unitId: AGENT_UNIT },
    );

    await setDoc(callRef(db, 'call_um'), seedFields('um1', 'Unit Manager 1', 'unit_manager', 1));
    await setDoc(callRef(db, 'call_bm'), seedFields('bm1', 'Branch Manager 1', 'branch_manager', 2));
    await setDoc(callRef(db, 'call_sm'), seedFields('sm1', 'Sales Manager 1', 'sales_manager', 3));
  });
}

async function main() {
  console.log('Joint Calls — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

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

  await run('1. UM1 reads own-unit UM call', true, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return getDoc(callRef(db, 'call_um'));
  });

  await run('2. UM1 reads own-unit BM call [rank DENY]', false, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return getDoc(callRef(db, 'call_bm'));
  });

  await run('3. UM1 reads own-unit SM call [rank DENY]', false, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return getDoc(callRef(db, 'call_sm'));
  });

  await run('4. UM2 reads other-unit UM call [scope DENY]', false, () => {
    const db = testEnv.authenticatedContext('um2', authToken('unit_manager')).firestore();
    return getDoc(callRef(db, 'call_um'));
  });

  await run('5. BM reads UM call [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    return getDoc(callRef(db, 'call_um'));
  });

  await run('6. BM reads BM call [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    return getDoc(callRef(db, 'call_bm'));
  });

  await run('7. BM reads SM call [rank DENY]', false, () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    return getDoc(callRef(db, 'call_sm'));
  });

  await run('8a. SM reads UM call [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    return getDoc(callRef(db, 'call_um'));
  });

  await run('8b. SM reads BM call [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    return getDoc(callRef(db, 'call_bm'));
  });

  await run('8c. SM reads SM call [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    return getDoc(callRef(db, 'call_sm'));
  });

  // 9. AGENT reads any call on own doc — DENY (CRITICAL: agent excluded)
  await run('9. AGENT reads own-doc UM call [DENY — critical]', false, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return getDoc(callRef(db, 'call_um'));
  });

  // ── WRITE tests ───────────────────────────────────────────────────────────

  // 10. Non-author (um2) tries to update call_um — DENY
  await run('10. Non-author updates call_um [DENY]', false, () => {
    const db = testEnv.authenticatedContext('um2', authToken('unit_manager')).firestore();
    return updateDoc(callRef(db, 'call_um'), { comments: 'tampered', updatedAt: new Date() });
  });

  // 11. Author (um1) updates their own call — ALLOW
  await run('11. Author (um1) updates own call_um [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return updateDoc(callRef(db, 'call_um'), {
      comments: 'Updated observation.',
      meetingType: 'collaboration',
      updatedAt: new Date(),
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

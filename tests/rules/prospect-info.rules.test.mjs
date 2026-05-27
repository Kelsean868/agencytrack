/**
 * Emulator rules tests — prospectInfo subcollection (F3).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/prospect-info.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 * The emulator is auto-started by firebase emulators:exec and
 * FIRESTORE_EMULATOR_HOST is set before the script is invoked.
 *
 * Test matrix — SUBMISSIONS-style (NOT F1/F2 exclusion):
 *   READ
 *   1.  AGENT reads OWN prep                       → ALLOW
 *   2.  AGENT reads ANOTHER agent's prep           → DENY  (cross-agent boundary)
 *   3.  UM1 reads own-unit agent's prep            → ALLOW
 *   4.  UM2 reads other-unit agent's prep          → DENY  (scope)
 *   5.  BM  reads any in-tenant agent's prep       → ALLOW
 *   6.  SM  reads any in-tenant agent's prep       → ALLOW
 *   7.  TA  reads any in-tenant agent's prep       → ALLOW
 *
 *   WRITE
 *   8.  AGENT creates OWN prep                     → ALLOW
 *   8a. AGENT creates OWN prep w/ bank-referral    → ALLOW (post-2026-05-21 enum addition)
 *   8b. AGENT creates OWN prep w/ legacy BOA       → ALLOW (kept for transition)
 *   9.  AGENT creates on ANOTHER agent's path      → DENY  (agentId mismatch)
 *   10. UM creates prep (manager write)            → DENY  (manager-write blocked)
 *   11. BM creates prep (manager write)            → DENY  (manager-write blocked)
 *   12. AGENT updates OWN prep                     → ALLOW
 *   13. AGENT updates ANOTHER agent's prep         → DENY
 *   14. UM updates a prep (manager write)          → DENY
 *   15. AGENT deletes OWN prep                     → DENY  (no deletes allowed)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, setDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const PROJECT_ID    = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID     = 'pi-rules-test-tenant';
const AGENT_ID      = 'agentA';
const AGENT_UNIT    = 'um1';
const OTHER_AGENT   = 'agentB';
const OTHER_UNIT    = 'um2';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

function prospectRef(db, agentId, prospectId) {
  return doc(db, `tenants/${TENANT_ID}/users/${agentId}/prospectInfo/${prospectId}`);
}

function seedFields(agentId, agentUnitId) {
  return {
    agentId,
    tenantId: TENANT_ID,
    agentUnitId,
    createdBy: agentId,
    clientName: 'Test Prospect',
    clientAge: 35,
    clientOccupation: 'Accountant',
    prospectingSource: 'referral',
    appointmentType: '2nd-interview',
    objections: ['no-money', 'no-hurry'],
    policyType: 'Whole Life',
    intendedAppointmentDate: '2026-06-01',
    createdAt: new Date('2026-05-21'),
    updatedAt: new Date('2026-05-21'),
  };
}

function newDocFields(agentId, agentUnitId) {
  // For create-path tests — same shape but createdBy must match the caller uid.
  return seedFields(agentId, agentUnitId);
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Seed agent user docs (used by manager scope checks if any rule needs them)
    await setDoc(
      doc(db, `tenants/${TENANT_ID}/users/${AGENT_ID}`),
      { uid: AGENT_ID, role: 'agent', tenantId: TENANT_ID, unitId: AGENT_UNIT },
    );
    await setDoc(
      doc(db, `tenants/${TENANT_ID}/users/${OTHER_AGENT}`),
      { uid: OTHER_AGENT, role: 'agent', tenantId: TENANT_ID, unitId: OTHER_UNIT },
    );

    // Seed prep docs
    await setDoc(prospectRef(db, AGENT_ID,    'prep_A1'), seedFields(AGENT_ID,    AGENT_UNIT));
    await setDoc(prospectRef(db, OTHER_AGENT, 'prep_B1'), seedFields(OTHER_AGENT, OTHER_UNIT));
  });
}

async function main() {
  console.log('Prospect Info (F3) — Firestore emulator rules tests');
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

  await run('1. AGENT reads OWN prep [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return getDoc(prospectRef(db, AGENT_ID, 'prep_A1'));
  });

  await run('2. AGENT reads ANOTHER agent prep [DENY — cross-agent]', false, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return getDoc(prospectRef(db, OTHER_AGENT, 'prep_B1'));
  });

  await run('3. UM1 reads own-unit agent prep [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return getDoc(prospectRef(db, AGENT_ID, 'prep_A1'));
  });

  await run('4. UM2 reads other-unit agent prep [DENY — scope]', false, () => {
    const db = testEnv.authenticatedContext('um2', authToken('unit_manager')).firestore();
    return getDoc(prospectRef(db, AGENT_ID, 'prep_A1'));
  });

  await run('5. BM reads in-tenant prep [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    return getDoc(prospectRef(db, AGENT_ID, 'prep_A1'));
  });

  await run('6. SM reads in-tenant prep [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('sm1', authToken('sales_manager')).firestore();
    return getDoc(prospectRef(db, AGENT_ID, 'prep_A1'));
  });

  await run('7. TA reads in-tenant prep [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext('ta1', authToken('tenant_admin')).firestore();
    return getDoc(prospectRef(db, AGENT_ID, 'prep_A1'));
  });

  // ── WRITE tests ───────────────────────────────────────────────────────────

  await run('8. AGENT creates OWN prep [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return setDoc(prospectRef(db, AGENT_ID, 'prep_A2'), newDocFields(AGENT_ID, AGENT_UNIT));
  });

  await run('8a. AGENT creates OWN prep w/ bank-referral source [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return setDoc(
      prospectRef(db, AGENT_ID, 'prep_A2a'),
      { ...newDocFields(AGENT_ID, AGENT_UNIT), prospectingSource: 'bank-referral' },
    );
  });

  await run('8b. AGENT creates OWN prep w/ legacy BOA source [ALLOW — transition]', true, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return setDoc(
      prospectRef(db, AGENT_ID, 'prep_A2b'),
      { ...newDocFields(AGENT_ID, AGENT_UNIT), prospectingSource: 'BOA' },
    );
  });

  await run('9. AGENT creates on ANOTHER agent path [DENY]', false, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    // Tries to write under OTHER_AGENT's subcollection — agentId path mismatch with caller uid.
    return setDoc(prospectRef(db, OTHER_AGENT, 'prep_B2'), newDocFields(OTHER_AGENT, OTHER_UNIT));
  });

  await run('10. UM creates prep [DENY — manager write blocked]', false, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return setDoc(prospectRef(db, AGENT_ID, 'prep_A3'), { ...newDocFields(AGENT_ID, AGENT_UNIT), createdBy: 'um1' });
  });

  await run('11. BM creates prep [DENY — manager write blocked]', false, () => {
    const db = testEnv.authenticatedContext('bm1', authToken('branch_manager')).firestore();
    return setDoc(prospectRef(db, AGENT_ID, 'prep_A4'), { ...newDocFields(AGENT_ID, AGENT_UNIT), createdBy: 'bm1' });
  });

  await run('12. AGENT updates OWN prep [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return updateDoc(prospectRef(db, AGENT_ID, 'prep_A1'), {
      clientName: 'Updated Prospect',
      updatedAt: new Date(),
    });
  });

  await run('13. AGENT updates ANOTHER agent prep [DENY]', false, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return updateDoc(prospectRef(db, OTHER_AGENT, 'prep_B1'), {
      clientName: 'Tampered',
      updatedAt: new Date(),
    });
  });

  await run('14. UM updates prep [DENY — manager write blocked]', false, () => {
    const db = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
    return updateDoc(prospectRef(db, AGENT_ID, 'prep_A1'), {
      clientName: 'Manager tampered',
      updatedAt: new Date(),
    });
  });

  await run('15. AGENT deletes OWN prep [DENY — no deletes]', false, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return deleteDoc(prospectRef(db, AGENT_ID, 'prep_A1'));
  });

  // ── socialPlatform field (PR #319) ────────────────────────────────────────

  await run('16. AGENT creates OWN prep w/ socialPlatform (social-media source) [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return setDoc(
      prospectRef(db, AGENT_ID, 'prep_A_social'),
      {
        ...newDocFields(AGENT_ID, AGENT_UNIT),
        prospectingSource: 'social-media',
        socialPlatform:    'instagram',
      },
    );
  });

  await run('17. AGENT updates OWN prep w/ socialPlatform in affectedKeys [ALLOW]', true, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    return updateDoc(prospectRef(db, AGENT_ID, 'prep_A1'), {
      prospectingSource: 'social-media',
      socialPlatform:    'whatsapp',
      updatedAt:         new Date(),
    });
  });

  await run('18. AGENT update w/ socialPlatform + disallowed agentId [DENY — hasOnly violation]', false, () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    // diff() only flags keys whose values actually change; use a different agentId
    // value so it appears in affectedKeys and triggers the hasOnly denial.
    return updateDoc(prospectRef(db, AGENT_ID, 'prep_A1'), {
      socialPlatform: 'facebook',
      agentId:        'tampered-id',  // different value → appears in diff → hasOnly denies
      updatedAt:      new Date(),
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

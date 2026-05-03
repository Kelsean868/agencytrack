/**
 * Emulator test for SEC-10: agents can mark their own notifications read.
 *
 * Prerequisites:
 *   1. Java JRE installed (Firestore emulator dependency)
 *   2. npm i -D @firebase/rules-unit-testing
 *   3. In one terminal: firebase emulators:start --only firestore --project=demo-test
 *   4. In another terminal: node scripts/test-sec10-rule.js
 *
 * What this verifies:
 *   - Agent CAN update read=true on their own notification
 *   - Agent CANNOT update another agent's notification (different recipient)
 *   - Agent CANNOT mutate fields beyond read/readAt (defense in depth)
 *   - Manager CAN update any notification (existing behaviour preserved)
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, setLogLevel } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

setLogLevel('error');

const PROJECT_ID = 'demo-test';
const TENANT = 'tatillife_south';
const AGENT_A = 'agent-uid-1';
const AGENT_B = 'agent-uid-2';
const MANAGER = 'manager-uid-1';
const NOTIF_ID = 'notif-1';
const notifPath = `tenants/${TENANT}/notifications/${NOTIF_ID}`;

const agentToken = (uid) => ({ role: 'agent', tenantId: TENANT, sub: uid, user_id: uid });
const managerToken = { role: 'branch_manager', tenantId: TENANT, sub: MANAGER, user_id: MANAGER };

let pass = 0;
let fail = 0;
const log = (label, ok, err) => {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else    { fail++; console.error(`  FAIL  ${label}${err ? ` — ${err.message || err}` : ''}`); }
};

async function main() {
  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  // Seed: notification owned by AGENT_A
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), notifPath), {
      userId: AGENT_A,
      tenantId: TENANT,
      type: 'system',
      title: 'Test',
      body: 'Test body',
      link: null,
      read: false,
      createdAt: new Date(),
    });
  });

  // 1. Agent A updates read=true on own notification — should succeed
  {
    const ctx = env.authenticatedContext(AGENT_A, agentToken(AGENT_A));
    try {
      await assertSucceeds(updateDoc(doc(ctx.firestore(), notifPath), { read: true }));
      log('Agent A can mark own notification read', true);
    } catch (e) { log('Agent A can mark own notification read', false, e); }
  }

  // 2. Agent B (different recipient) tries to update — should fail
  {
    const ctx = env.authenticatedContext(AGENT_B, agentToken(AGENT_B));
    try {
      await assertFails(updateDoc(doc(ctx.firestore(), notifPath), { read: true }));
      log('Agent B cannot mark another agent\'s notification read', true);
    } catch (e) { log('Agent B cannot mark another agent\'s notification read', false, e); }
  }

  // 3. Agent A tries to mutate body (not read/readAt) — should fail
  {
    const ctx = env.authenticatedContext(AGENT_A, agentToken(AGENT_A));
    try {
      await assertFails(updateDoc(doc(ctx.firestore(), notifPath), { body: 'tampered' }));
      log('Agent A cannot mutate fields beyond read/readAt', true);
    } catch (e) { log('Agent A cannot mutate fields beyond read/readAt', false, e); }
  }

  // 4. Agent A includes userId in update — should fail (hasOnly excludes it)
  {
    const ctx = env.authenticatedContext(AGENT_A, agentToken(AGENT_A));
    try {
      await assertFails(updateDoc(doc(ctx.firestore(), notifPath), { read: true, userId: AGENT_B }));
      log('Agent A cannot smuggle userId reassignment into a read update', true);
    } catch (e) { log('Agent A cannot smuggle userId reassignment into a read update', false, e); }
  }

  // 5. Manager updates any field — should succeed (canManage path)
  {
    const ctx = env.authenticatedContext(MANAGER, managerToken);
    try {
      await assertSucceeds(updateDoc(doc(ctx.firestore(), notifPath), { body: 'updated by manager' }));
      log('Manager can update any field on a notification', true);
    } catch (e) { log('Manager can update any field on a notification', false, e); }
  }

  await env.cleanup();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});

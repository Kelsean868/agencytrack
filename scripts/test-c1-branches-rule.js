/**
 * Emulator test for the C1 branches collection rule.
 *
 * Prerequisites:
 *   1. Java JRE installed (Firestore emulator dependency — JDK 21 per CLAUDE.md)
 *   2. npm i -D @firebase/rules-unit-testing  (already in devDependencies)
 *   3. In one terminal: firebase emulators:start --only firestore --project=demo-test
 *   4. In another terminal: node scripts/test-c1-branches-rule.js
 *
 * What this verifies (firestore.rules `match /branches/{branchId}`):
 *   - tenant_admin in tenant X CAN write tenant X branches
 *   - tenant_admin in tenant X CANNOT write tenant Y branches (cross-tenant gate)
 *   - platform_admin CAN write any tenant's branches (cross-tenant by design)
 *   - branch_manager / unit_manager / sales_manager / agent CANNOT write
 *   - any signed-in user in tenant X CAN read tenant X branches (dropdowns)
 *   - agent in tenant X CANNOT read tenant Y branches (cross-tenant scoped)
 *   - unauthenticated users CANNOT read or write
 *
 * Mirrors scripts/test-b5-config-rule.js. The security gates this exists
 * for: cross-tenant write rejection + non-admin role rejection.
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, addDoc, collection, setLogLevel } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

setLogLevel('error');

const PROJECT_ID = 'demo-test';
const TENANT_X = 'tatillife_south';
const TENANT_Y = 'other_tenant';
const BRANCH_X_ID = 'seed-x-branch';
const BRANCH_Y_ID = 'seed-y-branch';
const BRANCH_PATH_X = `tenants/${TENANT_X}/branches/${BRANCH_X_ID}`;
const BRANCH_PATH_Y = `tenants/${TENANT_Y}/branches/${BRANCH_Y_ID}`;
const BRANCHES_COLL_X = `tenants/${TENANT_X}/branches`;

const tokenFor = (uid, role, tenantId) => ({
  role, tenantId, sub: uid, user_id: uid,
});

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

  // Seed: existing branch docs in both tenants (so writes can be updates).
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), BRANCH_PATH_X), {
      name: 'Seed Branch X', managerId: null, isActive: true,
    });
    await setDoc(doc(ctx.firestore(), BRANCH_PATH_Y), {
      name: 'Seed Branch Y', managerId: null, isActive: true,
    });
  });

  // 1. tenant_admin in tenant X writes tenant X branch — should succeed.
  {
    const ctx = env.authenticatedContext('admin-x', tokenFor('admin-x', 'tenant_admin', TENANT_X));
    try {
      await assertSucceeds(setDoc(
        doc(ctx.firestore(), BRANCH_PATH_X),
        { name: 'Renamed by admin-x', updatedBy: 'admin-x' },
        { merge: true }
      ));
      log('tenant_admin can write own-tenant branch (update)', true);
    } catch (e) { log('tenant_admin can write own-tenant branch (update)', false, e); }

    try {
      await assertSucceeds(addDoc(
        collection(ctx.firestore(), BRANCHES_COLL_X),
        { name: 'New Branch X', managerId: null, isActive: true, updatedBy: 'admin-x' }
      ));
      log('tenant_admin can create own-tenant branch', true);
    } catch (e) { log('tenant_admin can create own-tenant branch', false, e); }
  }

  // 2. tenant_admin in tenant X writes tenant Y branch — MUST fail.
  //    The cross-tenant security gate.
  {
    const ctx = env.authenticatedContext('admin-x', tokenFor('admin-x', 'tenant_admin', TENANT_X));
    try {
      await assertFails(setDoc(
        doc(ctx.firestore(), BRANCH_PATH_Y),
        { name: 'Hijack attempt', updatedBy: 'admin-x' },
        { merge: true }
      ));
      log('tenant_admin CANNOT write cross-tenant branch (gate)', true);
    } catch (e) { log('tenant_admin CANNOT write cross-tenant branch (gate)', false, e); }
  }

  // 3. platform_admin writes any tenant — should succeed.
  //    platform_admin's tenantId claim is null per CLAUDE.md.
  {
    const ctx = env.authenticatedContext('platform-1', tokenFor('platform-1', 'platform_admin', null));
    try {
      await assertSucceeds(setDoc(
        doc(ctx.firestore(), BRANCH_PATH_X),
        { name: 'Platform-touched X', updatedBy: 'platform-1' },
        { merge: true }
      ));
      log('platform_admin can write tenant X branch', true);
    } catch (e) { log('platform_admin can write tenant X branch', false, e); }
    try {
      await assertSucceeds(setDoc(
        doc(ctx.firestore(), BRANCH_PATH_Y),
        { name: 'Platform-touched Y', updatedBy: 'platform-1' },
        { merge: true }
      ));
      log('platform_admin can write tenant Y branch (cross-tenant)', true);
    } catch (e) { log('platform_admin can write tenant Y branch (cross-tenant)', false, e); }
  }

  // 4. Non-admin roles cannot write — covers all manager-tier and agent.
  for (const role of ['branch_manager', 'unit_manager', 'sales_manager', 'agent']) {
    const ctx = env.authenticatedContext(`${role}-1`, tokenFor(`${role}-1`, role, TENANT_X));
    try {
      await assertFails(setDoc(
        doc(ctx.firestore(), BRANCH_PATH_X),
        { name: 'Hijack', updatedBy: `${role}-1` },
        { merge: true }
      ));
      log(`${role} CANNOT write branches`, true);
    } catch (e) { log(`${role} CANNOT write branches`, false, e); }
  }

  // 5. Same-tenant read allowed for every signed-in role (dropdowns,
  //    user-management lookups, agent surfaces).
  for (const role of ['agent', 'unit_manager', 'branch_manager', 'sales_manager', 'tenant_admin']) {
    const ctx = env.authenticatedContext(`${role}-r`, tokenFor(`${role}-r`, role, TENANT_X));
    try {
      await assertSucceeds(getDoc(doc(ctx.firestore(), BRANCH_PATH_X)));
      log(`${role} can read own-tenant branch`, true);
    } catch (e) { log(`${role} can read own-tenant branch`, false, e); }
  }

  // 6. agent in tenant X CANNOT read tenant Y branch (tenant-scoped read).
  {
    const ctx = env.authenticatedContext('agent-1', tokenFor('agent-1', 'agent', TENANT_X));
    try {
      await assertFails(getDoc(doc(ctx.firestore(), BRANCH_PATH_Y)));
      log('agent CANNOT read cross-tenant branch', true);
    } catch (e) { log('agent CANNOT read cross-tenant branch', false, e); }
  }

  // 7. Unauthenticated context: read + write both denied.
  {
    const ctx = env.unauthenticatedContext();
    try {
      await assertFails(getDoc(doc(ctx.firestore(), BRANCH_PATH_X)));
      log('unauthenticated CANNOT read branch', true);
    } catch (e) { log('unauthenticated CANNOT read branch', false, e); }

    try {
      await assertFails(setDoc(
        doc(ctx.firestore(), BRANCH_PATH_X),
        { name: 'Anonymous hijack', updatedBy: 'anon' },
        { merge: true }
      ));
      log('unauthenticated CANNOT write branch', true);
    } catch (e) { log('unauthenticated CANNOT write branch', false, e); }
  }

  await env.cleanup();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });

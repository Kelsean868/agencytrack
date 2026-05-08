/**
 * Emulator test for the B5 tenant-scope guard on config/{docId} writes.
 *
 * Prerequisites:
 *   1. Java JRE installed (Firestore emulator dependency — JDK 21 per CLAUDE.md)
 *   2. npm i -D @firebase/rules-unit-testing  (already in devDependencies)
 *   3. In one terminal: firebase emulators:start --only firestore --project=demo-test
 *   4. In another terminal: node scripts/test-b5-config-rule.js
 *
 * What this verifies (firestore.rules `match /config/{docId}`):
 *   - tenant_admin in tenant X CAN write tenant X config
 *   - tenant_admin in tenant X CANNOT write tenant Y config
 *   - platform_admin CAN write any tenant's config (cross-tenant by design)
 *   - branch_manager / unit_manager / sales_manager / agent CANNOT write
 *   - any signed-in user in tenant X CAN read tenant X config (existing
 *     read scope; goalsService.getCompanyMinimums depends on this for floor
 *     enforcement at goal-set time)
 *
 * The test the security gate exists for: cross-tenant write rejection.
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

setLogLevel('error');

const PROJECT_ID = 'demo-test';
const TENANT_X = 'tatillife_south';
const TENANT_Y = 'other_tenant';
const CONFIG_PATH_X = `tenants/${TENANT_X}/config/companyMinimums`;
const CONFIG_PATH_Y = `tenants/${TENANT_Y}/config/companyMinimums`;

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

  // Seed: existing config docs in both tenants (so writes are updates).
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), CONFIG_PATH_X), {
      annualAPI: 200000, annualApps: 42, persistency: 90,
    });
    await setDoc(doc(ctx.firestore(), CONFIG_PATH_Y), {
      annualAPI: 150000, annualApps: 36, persistency: 85,
    });
  });

  // 1. tenant_admin in tenant X writes tenant X config — should succeed.
  {
    const ctx = env.authenticatedContext('admin-x', tokenFor('admin-x', 'tenant_admin', TENANT_X));
    try {
      await assertSucceeds(setDoc(
        doc(ctx.firestore(), CONFIG_PATH_X),
        { annualAPI: 250000, updatedBy: 'admin-x' },
        { merge: true }
      ));
      log('tenant_admin can write own-tenant config', true);
    } catch (e) { log('tenant_admin can write own-tenant config', false, e); }
  }

  // 2. tenant_admin in tenant X writes tenant Y config — MUST fail.
  //    This is the security gate the B5 absorb commit added.
  {
    const ctx = env.authenticatedContext('admin-x', tokenFor('admin-x', 'tenant_admin', TENANT_X));
    try {
      await assertFails(setDoc(
        doc(ctx.firestore(), CONFIG_PATH_Y),
        { annualAPI: 999999, updatedBy: 'admin-x' },
        { merge: true }
      ));
      log('tenant_admin CANNOT write cross-tenant config (B5 gate)', true);
    } catch (e) { log('tenant_admin CANNOT write cross-tenant config (B5 gate)', false, e); }
  }

  // 3. platform_admin writes any tenant — should succeed (cross-tenant by design).
  //    platform_admin's tenantId claim is null per CLAUDE.md.
  {
    const ctx = env.authenticatedContext('platform-1', tokenFor('platform-1', 'platform_admin', null));
    try {
      await assertSucceeds(setDoc(
        doc(ctx.firestore(), CONFIG_PATH_X),
        { annualAPI: 300000, updatedBy: 'platform-1' },
        { merge: true }
      ));
      log('platform_admin can write tenant X config', true);
    } catch (e) { log('platform_admin can write tenant X config', false, e); }
    try {
      await assertSucceeds(setDoc(
        doc(ctx.firestore(), CONFIG_PATH_Y),
        { annualAPI: 175000, updatedBy: 'platform-1' },
        { merge: true }
      ));
      log('platform_admin can write tenant Y config (cross-tenant)', true);
    } catch (e) { log('platform_admin can write tenant Y config (cross-tenant)', false, e); }
  }

  // 4. branch_manager / unit_manager / sales_manager / agent cannot write — all roles.
  for (const role of ['branch_manager', 'unit_manager', 'sales_manager', 'agent']) {
    const ctx = env.authenticatedContext(`${role}-1`, tokenFor(`${role}-1`, role, TENANT_X));
    try {
      await assertFails(setDoc(
        doc(ctx.firestore(), CONFIG_PATH_X),
        { annualAPI: 1, updatedBy: `${role}-1` },
        { merge: true }
      ));
      log(`${role} CANNOT write company config`, true);
    } catch (e) { log(`${role} CANNOT write company config`, false, e); }
  }

  // 5. agent in tenant X CAN read tenant X config (goalsService floor enforcement).
  {
    const ctx = env.authenticatedContext('agent-1', tokenFor('agent-1', 'agent', TENANT_X));
    try {
      await assertSucceeds(getDoc(doc(ctx.firestore(), CONFIG_PATH_X)));
      log('agent can read own-tenant config (floor lookup)', true);
    } catch (e) { log('agent can read own-tenant config (floor lookup)', false, e); }
  }

  // 6. agent in tenant X CANNOT read tenant Y config (tenant-scoped read).
  {
    const ctx = env.authenticatedContext('agent-1', tokenFor('agent-1', 'agent', TENANT_X));
    try {
      await assertFails(getDoc(doc(ctx.firestore(), CONFIG_PATH_Y)));
      log('agent CANNOT read cross-tenant config', true);
    } catch (e) { log('agent CANNOT read cross-tenant config', false, e); }
  }

  await env.cleanup();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });

import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'policy-plans-rules-test-tenant';

// Rotted config (fixed): hardcoded port 8080 (Firebase's own default) never
// matched this repo's firebase.json, which pins the Firestore emulator to
// 9090 — every case in this file failed with ECONNREFUSED regardless of the
// rules themselves. Read FIRESTORE_EMULATOR_HOST like every sibling file in
// this directory (e.g. persistency.rules.test.mjs, user-license.rules.test.mjs).
const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

let testEnv;
const results = [];

function authToken(role) {
  return { role, tenantId: TENANT_ID };
}

async function run(label, expectAllow, fn) {
  try {
    if (expectAllow) {
      await assertSucceeds(fn());
    } else {
      await assertFails(fn());
    }
    results.push({ label, pass: true, expected: expectAllow ? 'ALLOW' : 'DENY' });
  } catch (err) {
    results.push({ label, pass: false, expected: expectAllow ? 'ALLOW' : 'DENY', error: err.message?.slice(0, 120) });
  }
}

const PLAN_DOC_PATH = `tenants/${TENANT_ID}/config/policyPlans`;

const VALID_DOC = {
  plans: [
    { id: 'plan-001', name: 'Whole Life Plus', class: 'whole_life', productLine: 'life', isActive: true },
  ],
  pendingReview: [
    { name: 'Mystery Plan', loggedByAgents: 1, firstLoggedAt: null, contributedPolicyIds: ['p1'] },
  ],
};

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: EMU_HOST,
      port: EMU_PORT,
    },
  });

  // Seed the doc using admin (bypasses rules)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, PLAN_DOC_PATH), VALID_DOC);
  });

  // ── READ tests ────────────────────────────────────────────────────────────

  await run('ALLOW agent read config/policyPlans', true, async () => {
    const ctx = testEnv.authenticatedContext('agent-1', authToken('agent'));
    return getDoc(doc(ctx.firestore(), PLAN_DOC_PATH));
  });

  await run('ALLOW unit_manager read config/policyPlans', true, async () => {
    const ctx = testEnv.authenticatedContext('um-1', authToken('unit_manager'));
    return getDoc(doc(ctx.firestore(), PLAN_DOC_PATH));
  });

  await run('ALLOW branch_manager read config/policyPlans', true, async () => {
    const ctx = testEnv.authenticatedContext('bm-1', authToken('branch_manager'));
    return getDoc(doc(ctx.firestore(), PLAN_DOC_PATH));
  });

  await run('ALLOW sales_manager read config/policyPlans', true, async () => {
    const ctx = testEnv.authenticatedContext('sm-1', authToken('sales_manager'));
    return getDoc(doc(ctx.firestore(), PLAN_DOC_PATH));
  });

  await run('ALLOW tenant_admin read config/policyPlans', true, async () => {
    const ctx = testEnv.authenticatedContext('ta-1', authToken('tenant_admin'));
    return getDoc(doc(ctx.firestore(), PLAN_DOC_PATH));
  });

  await run('DENY unauthenticated read config/policyPlans', false, async () => {
    const ctx = testEnv.unauthenticatedContext();
    return getDoc(doc(ctx.firestore(), PLAN_DOC_PATH));
  });

  await run('DENY wrong-tenant member read config/policyPlans', false, async () => {
    const ctx = testEnv.authenticatedContext('agent-other', {
      role: 'agent',
      tenantId: 'different-tenant',
    });
    return getDoc(doc(ctx.firestore(), PLAN_DOC_PATH));
  });

  // ── WRITE tests ───────────────────────────────────────────────────────────

  await run('ALLOW tenant_admin write (update) config/policyPlans', true, async () => {
    const ctx = testEnv.authenticatedContext('ta-1', authToken('tenant_admin'));
    return updateDoc(doc(ctx.firestore(), PLAN_DOC_PATH), {
      plans: [...VALID_DOC.plans, {
        id: 'plan-002', name: 'New Plan', class: 'term', productLine: 'life', isActive: true,
      }],
    });
  });

  await run('DENY agent write config/policyPlans', false, async () => {
    const ctx = testEnv.authenticatedContext('agent-1', authToken('agent'));
    return updateDoc(doc(ctx.firestore(), PLAN_DOC_PATH), {
      plans: [],
    });
  });

  await run('DENY unit_manager write config/policyPlans', false, async () => {
    const ctx = testEnv.authenticatedContext('um-1', authToken('unit_manager'));
    return updateDoc(doc(ctx.firestore(), PLAN_DOC_PATH), {
      plans: [],
    });
  });

  await run('DENY branch_manager write config/policyPlans', false, async () => {
    const ctx = testEnv.authenticatedContext('bm-1', authToken('branch_manager'));
    return updateDoc(doc(ctx.firestore(), PLAN_DOC_PATH), {
      plans: [],
    });
  });

  await run('DENY sales_manager write config/policyPlans', false, async () => {
    const ctx = testEnv.authenticatedContext('sm-1', authToken('sales_manager'));
    return updateDoc(doc(ctx.firestore(), PLAN_DOC_PATH), {
      plans: [],
    });
  });

  await run('DENY agent write pendingReview directly', false, async () => {
    const ctx = testEnv.authenticatedContext('agent-1', authToken('agent'));
    return updateDoc(doc(ctx.firestore(), PLAN_DOC_PATH), {
      pendingReview: [{ name: 'Injected', loggedByAgents: 999 }],
    });
  });

  // ── Results ───────────────────────────────────────────────────────────────

  await testEnv.cleanup();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log('\n=== policyPlans.rules.test.mjs ===');
  results.forEach((r) => {
    const icon = r.pass ? '✅' : '❌';
    const detail = r.error ? ` — ${r.error}` : '';
    console.log(`${icon} [${r.expected}] ${r.label}${detail}`);
  });
  console.log(`\n${passed}/${results.length} passed\n`);

  if (failed.length > 0) {
    console.error('FAILED:', failed.map((r) => r.label));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

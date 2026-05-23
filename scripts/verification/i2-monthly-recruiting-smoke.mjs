/**
 * i2-monthly-recruiting-smoke.mjs
 *
 * REST smoke against production Firestore — verifies the pre-deployed
 * managerMonthlyRollups rules are active.
 *
 * Run: node scripts/verification/i2-monthly-recruiting-smoke.mjs
 *
 * Legs:
 *  1. UM signs in, writes own rollup (draft) → ALLOW
 *  2. UM reads own rollup back → ALLOW (write-read-verify: persisted)
 *  3. Agent signs in, reads UM's rollup → 403 DENY (downline)
 *  4. BM signs in, reads UM's rollup → ALLOW (upline, same branch)
 *  5. SM signs in, lists rollups by monthKey → ALLOW (tenant-wide, index)
 *  6. BM lists rollups (no branchId filter) → 403 DENY (cross-branch guard)
 *
 * Cleanup: removes the test rollup doc created in leg 1.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Load .env.local
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const FIREBASE_API_KEY  = env.VITE_FIREBASE_API_KEY;
const PROJECT_ID        = env.VITE_FIREBASE_PROJECT_ID ?? 'agencytrack-2a610';
const TENANT_ID_KEY     = 'A11Y_UNIT_MANAGER_EMAIL'; // derive tenantId from UM token

if (!FIREBASE_API_KEY) {
  console.error('VITE_FIREBASE_API_KEY not found in .env.local');
  process.exit(1);
}

const MONTH_KEY     = '2026-05';  // known stable test month
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`signIn(${email}) failed: ${JSON.stringify(err)}`);
  }
  return res.json(); // { idToken, localId, ... }
}

// ── Firestore REST helpers ────────────────────────────────────────────────────

function firestoreValue(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number' && Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v === null) return { nullValue: null };
  throw new Error(`Unsupported value type: ${typeof v} (${v})`);
}

function buildDoc(fields) {
  return { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, firestoreValue(v)])) };
}

function extractDoc(doc) {
  if (!doc.fields) return null;
  return Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => {
    const val = v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? v.nullValue;
    return [k, val];
  }));
}

async function fsGet(path, token) {
  return fetch(`${FIRESTORE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function fsPatch(path, body, token) {
  return fetch(`${FIRESTORE_URL}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function fsDelete(path, token) {
  return fetch(`${FIRESTORE_URL}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function fsRunQuery(parentPath, collectionId, token, fieldFilter) {
  // runQuery URL: /documents/{parent}:runQuery
  const url = `${FIRESTORE_URL}/${parentPath}:runQuery`;
  const q = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: fieldFilter.field },
          op: 'EQUAL',
          value: firestoreValue(fieldFilter.value),
        },
      },
      limit: 10,
    },
  };
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(q),
  });
}

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function leg(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('I2 Monthly Recruiting Roll-up — REST smoke (production Firestore)\n');

  // Sign in all test users
  const umAuth  = await signIn(env.A11Y_UNIT_MANAGER_EMAIL,  env.A11Y_UNIT_MANAGER_PASSWORD);
  const bmAuth  = await signIn(env.A11Y_BRANCH_MANAGER_EMAIL, env.A11Y_BRANCH_MANAGER_PASSWORD);
  const smAuth  = await signIn(env.A11Y_SALES_MANAGER_EMAIL,  env.A11Y_SALES_MANAGER_PASSWORD);
  const agentAuth = await signIn(env.A11Y_AGENT_EMAIL,        env.A11Y_AGENT_PASSWORD);

  const umUid   = umAuth.localId;

  // Derive tenantId from UM's token (decode JWT payload)
  const tokenPayload = JSON.parse(Buffer.from(umAuth.idToken.split('.')[1], 'base64url').toString());
  const tenantId = tokenPayload.tenantId;
  if (!tenantId) throw new Error('tenantId missing from UM token — check custom claims');

  const docId       = `${umUid}_${MONTH_KEY}`;
  const docPath     = `tenants/${tenantId}/managerMonthlyRollups/${docId}`;
  const rollupMeta  = await (async () => {
    // Fetch UM's user doc to get branchId / role / unitId for the payload
    const userRes = await fsGet(`tenants/${tenantId}/users/${umUid}`, umAuth.idToken);
    if (!userRes.ok) throw new Error(`Failed to read UM user doc: ${userRes.status}`);
    const userDoc = await userRes.json();
    return extractDoc(userDoc);
  })();

  console.log(`  UM uid: ${umUid}`);
  console.log(`  tenantId: ${tenantId}`);
  console.log(`  Doc path: ${docPath}\n`);

  // ── Leg 1: UM writes own rollup ───────────────────────────────────────────
  await leg('1. UM writes own rollup (draft) → ALLOW', async () => {
    const payload = buildDoc({
      managerId:          umUid,
      managerName:        rollupMeta.name ?? 'Test UM',
      tenantId:           tenantId,
      monthKey:           MONTH_KEY,
      managerRole:        'unit_manager',
      managerRoleRank:    1,
      branchId:           rollupMeta.branchId ?? '',
      unitId:             rollupMeta.unitId   ?? null,
      candidatesAssessed: 3,
      agentsContracted:   1,
      status:             'draft',
      updatedAt:          new Date().toISOString(),
    });
    const res = await fsPatch(docPath, payload, umAuth.idToken);
    if (!res.ok) {
      const body = await res.json();
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // ── Leg 2: UM reads own rollup (write-read-verify) ────────────────────────
  await leg('2. UM reads own rollup back → ALLOW (write-read-verify: persisted)', async () => {
    const res = await fsGet(docPath, umAuth.idToken);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = await res.json();
    const data = extractDoc(doc);
    if (!data) throw new Error('Doc is empty');
    if (data.candidatesAssessed !== '3' && data.candidatesAssessed !== 3) {
      throw new Error(`candidatesAssessed mismatch: got ${JSON.stringify(data.candidatesAssessed)}`);
    }
    if (data.status !== 'draft') throw new Error(`status mismatch: ${data.status}`);
  });

  // ── Leg 3: Agent reads UM rollup → 403 (downline DENY) ───────────────────
  await leg('3. Agent reads UM rollup → 403 PERMISSION_DENIED (downline)', async () => {
    const res = await fsGet(docPath, agentAuth.idToken);
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // ── Leg 4: BM reads UM rollup → ALLOW (upline, same branch) ──────────────
  await leg('4. BM reads UM rollup → ALLOW (upline, same branch)', async () => {
    const res = await fsGet(docPath, bmAuth.idToken);
    if (!res.ok) throw new Error(`HTTP ${res.status} — may be cross-branch (BM and UM must share branchId in real data)`);
  });

  // ── Leg 5: SM lists rollups by monthKey → ALLOW (tenant-wide, index) ─────
  await leg('5. SM lists rollups by monthKey → ALLOW (tenant-wide, index)', async () => {
    const res = await fsRunQuery(
      `tenants/${tenantId}`,
      'managerMonthlyRollups',
      smAuth.idToken,
      { field: 'monthKey', value: MONTH_KEY },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    // runQuery returns array of {document: ...} entries; at least one should contain our test doc
    const docs = body.filter((r) => r.document);
    if (docs.length === 0) {
      throw new Error('runQuery returned no matching docs — index may not be ready yet or no docs for this monthKey');
    }
  });

  // ── Leg 6: BM lists rollups without branch filter → 403 (cross-branch DENY) ─
  // BM has roleRank=2; allow list requires resource.data.branchId==callerBranchId().
  // An unconstrained query (no branchId filter) could return docs from any branch,
  // so Firestore rejects it — BM cannot fan-out past their own branch.
  await leg('6. BM unconstrained list (no branchId filter) → 403 PERMISSION_DENIED', async () => {
    const res = await fsRunQuery(
      `tenants/${tenantId}`,
      'managerMonthlyRollups',
      bmAuth.idToken,
      { field: 'monthKey', value: MONTH_KEY },
    );
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // ── Cleanup note ──────────────────────────────────────────────────────────
  // No delete rule on managerMonthlyRollups (by design — submissions are permanent).
  // Delete the test doc manually from Firestore Console:
  //   tenants/tatillife_south/managerMonthlyRollups/${docId}
  console.log(`\n  Cleanup: delete doc '${docId}' manually from Firestore Console if needed.`);

  console.log(`\n${passed + failed} legs: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});

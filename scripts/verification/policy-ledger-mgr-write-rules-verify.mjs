/**
 * policy-ledger-mgr-write-rules-verify.mjs
 *
 * Live rules-layer verify for PR #652 (policy-ledger-mgr-write Slice 1).
 * Exercises the DEPLOYED Firestore rules directly via the REST API —
 * no Playwright, no emulator.
 *
 * Cases:
 *   1. BM creates own policy (agentId == uid)     → ALLOW
 *   2. BM creates policy with tampered agentId    → DENY (self-only invariant)
 *   3. UM creates own policy (agentId == uid)     → ALLOW
 *   4. cross-tenant                               → SKIP (no cross-tenant credentials)
 *
 * Run:  node scripts/verification/policy-ledger-mgr-write-rules-verify.mjs
 * Requires .env.local: VITE_FIREBASE_API_KEY, A11Y_BRANCH_MANAGER_EMAIL/PASSWORD,
 *   A11Y_UNIT_MANAGER_EMAIL/PASSWORD.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');

function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = loadEnv();

const PROJECT  = 'agencytrack-2a610';
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`;
const FS_BASE  = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const YESTERDAY = new Date(Date.now() - 86400000).toISOString();
const NOW_ISO   = new Date().toISOString();

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const resp = await fetch(AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!resp.ok) throw new Error(`signIn failed: ${resp.status}`);
  const data = await resp.json();
  return { idToken: data.idToken, uid: data.localId };
}

function extractTenantId(idToken) {
  const [, payloadB64] = idToken.split('.');
  const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
  const claims = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  return claims.tenantId || null;
}

// ── Firestore REST helpers ────────────────────────────────────────────────────

function fsString(v)  { return { stringValue:    v    }; }
function fsDouble(v)  { return { doubleValue:     v    }; }
function fsBool(v)    { return { booleanValue:    v    }; }
function fsTs(v)      { return { timestampValue:  v    }; }
function fsNull()     { return { nullValue:       null }; }
function fsMap(obj)   { return { mapValue: { fields: obj } }; }

function buildPolicyDoc(agentId, tenantId) {
  return {
    fields: {
      tenantId:           fsString(tenantId),
      agentId:            fsString(agentId),
      status:             fsString('submitted'),
      sourceOfProspect:   fsString('referral'),
      dateWritten:        fsTs(YESTERDAY),
      dateSubmitted:      fsTs(YESTERDAY),
      proposedAPI:        fsDouble(5000),
      ownerName:          fsString(`SMOKE-MGRRULE-${Date.now()}`),
      insuredName:        fsString('Smoke Test'),
      productLine:        fsString('life'),
      newBusinessType:    fsString('nb_ordinary'),
      policyClass:        fsString('whole_life'),
      proposedFrequency:  fsString('M'),
      proposedPremium:    fsDouble(416.67),
      isSelfOrFamily:     fsBool(false),
      cashWithApp:        fsMap({ collected: fsBool(false), amount: fsNull() }),
      dateIssued:         fsNull(),
      policyDeliveryDate: fsNull(),
      createdAt:          fsTs(NOW_ISO),
      createdBy:          fsString(agentId),
    },
  };
}

async function firestoreCreate(idToken, tenantId, doc) {
  const url  = `${FS_BASE}/tenants/${tenantId}/policies`;
  const resp = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body:    JSON.stringify(doc),
  });
  return resp.status;
}

// ── Result tracker ────────────────────────────────────────────────────────────

const results = [];

function pass(label)         { results.push({ label, status: 'PASS' }); console.log(`  ✓ ${label}`); }
function fail(label, detail) { results.push({ label, status: 'FAIL', detail }); console.error(`  ✗ ${label} — ${detail}`); }
function skip(label, reason) { results.push({ label, status: 'SKIP', detail: reason }); console.log(`  ~ ${label} [SKIP: ${reason}]`); }

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\n=== policy-ledger-mgr-write live rules verify ===');

try {
  // ── BM ──────────────────────────────────────────────────────────────────────
  console.log('\n[BM cases]');
  const { idToken: bmToken, uid: bmUid } = await signIn(
    E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD
  );
  const tenantId = extractTenantId(bmToken);
  if (!tenantId) throw new Error('tenantId not in BM JWT claims — aborting');

  // Case 1: BM creates own policy → ALLOW
  {
    const status = await firestoreCreate(bmToken, tenantId, buildPolicyDoc(bmUid, tenantId));
    if (status >= 200 && status < 300)
      pass('BM creates own policy (agentId == own uid) → ALLOW');
    else
      fail('BM creates own policy (agentId == own uid) → ALLOW', `HTTP ${status}`);
  }

  // Case 2: BM creates policy with tampered agentId → DENY
  {
    const status = await firestoreCreate(bmToken, tenantId, buildPolicyDoc('tampered-agent-uid', tenantId));
    if (status === 403)
      pass('BM creates policy with agentId != own uid → DENY');
    else
      fail('BM creates policy with agentId != own uid → DENY', `HTTP ${status} (expected 403)`);
  }

  // ── UM ──────────────────────────────────────────────────────────────────────
  console.log('\n[UM cases]');
  const { idToken: umToken, uid: umUid } = await signIn(
    E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD
  );

  // Case 3: UM creates own policy → ALLOW
  {
    const status = await firestoreCreate(umToken, tenantId, buildPolicyDoc(umUid, tenantId));
    if (status >= 200 && status < 300)
      pass('UM creates own policy (agentId == own uid) → ALLOW');
    else
      fail('UM creates own policy (agentId == own uid) → ALLOW', `HTTP ${status}`);
  }

  // Case 4: cross-tenant → SKIP
  skip('cross-tenant policy create → DENY', 'no A11Y_CROSS_TENANT_* credentials in .env.local');

} catch (err) {
  console.error('\nFATAL:', err.message);
  process.exit(1);
}

// ── Summary ───────────────────────────────────────────────────────────────────
const passed  = results.filter(r => r.status === 'PASS').length;
const failed  = results.filter(r => r.status === 'FAIL').length;
const skipped = results.filter(r => r.status === 'SKIP').length;

console.log('\n── results ──');
for (const r of results) {
  const icon = r.status === 'PASS' ? '✓' : r.status === 'SKIP' ? '~' : '✗';
  console.log(`  [${r.status}] ${icon} ${r.label}${r.detail ? ' — ' + r.detail : ''}`);
}
console.log(`\n${passed}/${results.length - skipped} passed (${skipped} skipped)`);

if (failed > 0) process.exit(1);

/**
 * settlements-read-scope-probe.mjs
 *
 * Focused live verification for PR #494 post-rules-deploy.
 * Read-only — no writes, no cleanup needed.
 *
 * Leg 1: agent credential → own settlements query → ALLOW (own-read still works)
 * Leg 2: agent credential → foreign-agentId settlements query → PERMISSION_DENIED
 *
 * Usage (from repo root):
 *   node scripts/verification/settlements-read-scope-probe.mjs
 */

import { resolve } from 'path';
import { loadEnv } from '../lib/loadEnv.mjs';

const env = loadEnv(resolve(process.cwd(), '.env.local'));

const API_KEY   = env.VITE_FIREBASE_API_KEY;
const PROJECT   = env.VITE_FIREBASE_PROJECT_ID || 'agencytrack-2a610';
const TENANT_ID = 'tatillife_south';

// Sentinel foreign UID — not the agent's own uid; used only to probe the deny path.
// Any non-existent UID works: the deny fires before any doc lookup.
const FOREIGN_UID = 'probe-foreign-uid-not-a-real-agent';

if (!API_KEY) {
  console.error('VITE_FIREBASE_API_KEY not found in .env.local — aborting.');
  process.exit(1);
}

const agentEmail    = env.A11Y_AGENT_EMAIL;
const agentPassword = env.A11Y_AGENT_PASSWORD;

if (!agentEmail || !agentPassword) {
  console.error('A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD not found in .env.local — aborting.');
  process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`signIn failed ${res.status}: ${body}`);
  }
  const data = await res.json();
  return { idToken: data.idToken, uid: data.localId };
}

async function runQuery(idToken, agentIdFilter) {
  const parent = `projects/${PROJECT}/databases/(default)/documents/tenants/${TENANT_ID}`;
  const url    = `https://firestore.googleapis.com/v1/${parent}:runQuery`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: 'settlements', allDescendants: false }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'agentId' },
          op:    'EQUAL',
          value: { stringValue: agentIdFilter },
        },
      },
      limit: 1,
    },
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body:    JSON.stringify(body),
  });

  return { status: res.status, body: await res.json() };
}

// ── main ─────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, detail) { console.error(`  ✗ ${label}\n    ${detail}`); failed++; }

async function main() {
  console.log('settlements-read-scope-probe — live verification (PR #494)');
  console.log(`Project: ${PROJECT} | Tenant: ${TENANT_ID}\n`);

  // Sign in as agent
  let idToken, uid;
  try {
    ({ idToken, uid } = await signIn(agentEmail, agentPassword));
    console.log(`  signed in as agent uid=${uid.slice(0, 8)}…\n`);
  } catch (e) {
    console.error(`  Fatal: agent sign-in failed — ${e.message}`);
    process.exit(1);
  }

  // ── Leg 1: own settlements query → ALLOW ───────────────────────────────────
  console.log('Leg 1 — own settlements query (where agentId == uid)');
  try {
    const { status, body } = await runQuery(idToken, uid);
    if (status === 200) {
      // runQuery returns an array; if empty [{}] = no docs (still allowed)
      const hasDocs = Array.isArray(body) && body.some(r => r.document);
      ok(`status 200 — query ALLOWED (${hasDocs ? 'docs returned' : 'empty — no settlement docs for this agent yet, but ALLOWED'})`);
    } else {
      fail('own-query allowed', `expected 200, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    }
  } catch (e) {
    fail('own-query allowed', e.message);
  }

  // ── Leg 2: foreign-agentId query → PERMISSION_DENIED ─────────────────────
  console.log('\nLeg 2 — foreign-agentId query (where agentId == FOREIGN_UID)');
  try {
    const { status, body } = await runQuery(idToken, FOREIGN_UID);
    if (status === 403) {
      const msg = body?.error?.message ?? JSON.stringify(body).slice(0, 100);
      if (/PERMISSION_DENIED/i.test(msg)) {
        ok(`status 403 PERMISSION_DENIED — foreign-read DENIED ✓`);
      } else {
        ok(`status 403 — foreign-read DENIED (msg: ${msg})`);
      }
    } else if (status === 200) {
      // If the query returns 200 with an empty array, the rule may have allowed it
      // but returned no docs (Firestore filters vs denies). Check the body.
      const hasAnyDoc = Array.isArray(body) && body.some(r => r.document);
      if (!hasAnyDoc) {
        // Empty result — rule evaluated but no matching docs (not ideal, but not a leak)
        // This can happen if the foreign UID has no settlement docs; the rule isn't
        // definitively tested. We flag this as inconclusive.
        fail('foreign-query denied', `Got 200 with empty result — inconclusive; try with a real peer UID that has settlement docs`);
      } else {
        fail('foreign-query denied', `Got 200 with DOCS — foreign-read NOT denied — rule not working!`);
      }
    } else {
      fail('foreign-query denied', `Unexpected status ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    }
  } catch (e) {
    fail('foreign-query denied', e.message);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} legs: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

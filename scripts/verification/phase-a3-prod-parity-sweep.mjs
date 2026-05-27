/**
 * Phase A3 — Read-only production parity sweep.
 * Queries tatillife_south for agents with ≥10 settled policies.
 * If found, runs settlementShapeFromPolicies derivation vs settlements read.
 * NO WRITES. Read-only.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..', '..');

function loadEnv() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const E = loadEnv();
const PROJECT_ID = E.VITE_FIREBASE_PROJECT_ID;
const API_KEY    = E.VITE_FIREBASE_API_KEY;
const TENANT_ID  = 'tatillife_south';

// Inline copy of settlementShapeFromPolicies (src/services/policiesService.js:325)
function settlementShapeFromPolicies(policies) {
  const map = {};
  for (const policy of policies) {
    if (policy.status !== 'settled') continue;
    const dateIssued = policy.dateIssued;
    if (!dateIssued) continue;
    // REST API returns dateIssued as { timestampValue: "YYYY-MM-DDTHH:mm:ssZ" }
    // or as a direct value depending on format
    let d;
    if (typeof dateIssued === 'string') {
      d = new Date(dateIssued);
    } else if (dateIssued._seconds !== undefined) {
      d = new Date(dateIssued._seconds * 1000);
    } else {
      d = new Date(dateIssued);
    }
    const periodKey = d.toISOString().substring(0, 7);
    if (!map[periodKey]) map[periodKey] = { periodKey, settledAPI: 0, settledApps: 0 };
    map[periodKey].settledAPI += parseFloat(policy.settledAPI) || 0;
    map[periodKey].settledApps += 1;
  }
  return Object.values(map);
}

function parseFirestoreValue(v) {
  if (!v) return null;
  if ('stringValue'  in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue; // ISO string
  if ('mapValue'     in v) {
    const out = {};
    for (const [k, fv] of Object.entries(v.mapValue.fields ?? {}))
      out[k] = parseFirestoreValue(fv);
    return out;
  }
  if ('arrayValue'   in v) return (v.arrayValue.values ?? []).map(parseFirestoreValue);
  if ('nullValue'    in v) return null;
  return null;
}

function docToObj(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc.fields ?? {})) {
    out[k] = parseFirestoreValue(v);
  }
  return out;
}

async function firestoreGet(idToken, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  return res.json();
}

async function firestoreQuery(idToken, colPath, where) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${colPath.replace(/^\//, '')}:runQuery`;
  // Build parent path by dropping last segment
  const parts = colPath.split('/');
  const parent = `projects/${PROJECT_ID}/databases/(default)/documents/${parts.slice(0, -1).join('/')}`;
  const colId = parts[parts.length - 1];

  const body = {
    structuredQuery: {
      from: [{ collectionId: colId }],
      where: where ?? undefined,
      limit: 1000,
    },
  };
  const res = await fetch(
    `https://firestore.googleapis.com/v1/${parent}:runQuery`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(body) }
  );
  const rows = await res.json();
  if (!Array.isArray(rows)) return { error: rows };
  return rows.filter(r => r.document).map(r => docToObj(r.document));
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('H3 PHASE A3 — Production read-only parity sweep');
  console.log(`Tenant: ${TENANT_ID}  |  Project: ${PROJECT_ID}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Auth as tenant admin
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: E.A11Y_TENANT_ADMIN_EMAIL, password: E.A11Y_TENANT_ADMIN_PASSWORD, returnSecureToken: true }),
    }
  );
  const authData = await authRes.json();
  if (!authData.idToken) {
    console.error('Auth failed:', authData.error?.message);
    process.exit(1);
  }
  const idToken = authData.idToken;
  console.log('Auth: OK (tenant admin)');

  // Query all settled policies in the tenant
  const settledPolicies = await firestoreQuery(idToken,
    `tenants/${TENANT_ID}/policies`,
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'settled' } } }
  );

  if (settledPolicies.error) {
    console.error('Query error:', JSON.stringify(settledPolicies.error).slice(0, 300));
    process.exit(1);
  }

  console.log(`Total settled policies found: ${settledPolicies.length}`);

  // Count per agentId
  const byAgent = {};
  for (const p of settledPolicies) {
    const id = p.agentId;
    if (id) byAgent[id] = (byAgent[id] || []).concat(p);
  }

  console.log('Per-agent settled counts:');
  for (const [aid, arr] of Object.entries(byAgent).sort((a,b) => b[1].length - a[1].length)) {
    console.log(`  ${aid}: ${arr.length} settled`);
  }

  const qualifiers = Object.entries(byAgent).filter(([, arr]) => arr.length >= 10);
  console.log(`\nAgents with ≥10 settled: ${qualifiers.length}`);

  if (qualifiers.length === 0) {
    console.log('SKIP: No agent qualifies. Phase A3 sweep deferred.\n');
    return;
  }

  // Run parity check for first qualifying agent
  const [agentId, agentPolicies] = qualifiers[0];
  console.log(`\nRunning parity check for agent: ${agentId} (${agentPolicies.length} settled)`);

  const year = new Date().getFullYear();

  // Ledger derivation
  const ledger = settlementShapeFromPolicies(agentPolicies);
  console.log(`Ledger derivation: ${ledger.length} periods`);

  // Oracle read
  const settlements = await firestoreQuery(idToken,
    `tenants/${TENANT_ID}/settlements`,
    {
      compositeFilter: {
        op: 'AND',
        filters: [
          { fieldFilter: { field: { fieldPath: 'agentId' }, op: 'EQUAL', value: { stringValue: agentId } } },
          { fieldFilter: { field: { fieldPath: 'year'    }, op: 'EQUAL', value: { integerValue: String(year) } } },
        ],
      },
    }
  );

  if (settlements.error) {
    console.log('Oracle read error — settlement query may need index. Logging and skipping.');
    console.error(JSON.stringify(settlements.error).slice(0, 300));
    return;
  }
  console.log(`Oracle settlements (year=${year}): ${settlements.length} docs`);

  // Diff
  const oracleMap  = Object.fromEntries(settlements.map(s => [s.periodKey, s]));
  const ledgerMap  = Object.fromEntries(ledger.map(l => [l.periodKey, l]));
  let divergences  = 0;

  console.log('\nParity diff:');
  for (const pk of [...new Set([...Object.keys(ledgerMap), ...Object.keys(oracleMap)])].sort()) {
    const l = ledgerMap[pk];
    const o = oracleMap[pk];
    if (!l) { console.log(`  ${pk}: oracle-only (apps=${o.settledApps})`); divergences++; continue; }
    if (!o) { console.log(`  ${pk}: ledger-only (apps=${l.settledApps})`); continue; /* oracle may be older year */ }
    const apiMatch  = Math.abs(l.settledAPI - (o.settledAPI || 0)) < 0.01;
    const appsMatch = l.settledApps === o.settledApps;
    if (!apiMatch || !appsMatch) {
      console.log(`  ${pk}: DIVERGE — apps l=${l.settledApps} o=${o.settledApps}  API l=${l.settledAPI.toFixed(2)} o=${(o.settledAPI||0).toFixed(2)}`);
      divergences++;
    } else {
      console.log(`  ${pk}: OK (apps=${l.settledApps}  API=${l.settledAPI.toFixed(2)})`);
    }
  }

  console.log(`\nResult: ${divergences > 0 ? '❌ DIVERGENCES' : '✅ MATCH'} (${divergences} divergent periods)`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('Sweep crashed:', e); process.exit(1); });

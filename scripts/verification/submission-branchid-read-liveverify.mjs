/**
 * submission-branchid-read-liveverify.mjs
 *
 * Post-deploy live-verify for PR #655 (Slice 2 read-rule BM isolation).
 * Confirms the branchId-gated read rule is DEPLOYED and enforced in production.
 *
 * Leg 1 — BM unconstrained list (no branchId filter) → Firestore REST → expect 403 (DENY)
 *          Proves crafted-query bypass is closed.
 * Leg 2 — BM own-branch list (branchId filter == claim) → Firestore REST → expect 200 (ALLOW)
 *          Proves branch-A query works.
 * Leg 3 — Agent self-list (agentId == uid) → Firestore REST → expect 200 (ALLOW)
 *          Agent-own path intact.
 * Leg 4 — TA unfiltered list → Firestore REST → expect 200 (ALLOW)
 *          Tenant-admin tenant-wide access intact.
 *
 * Usage:
 *   node scripts/verification/submission-branchid-read-liveverify.mjs
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  loginAs,
  installBearerTokenCapture,
  captureBearerToken,
  installGlobalTimeout,
  finishSmoke,
  stamp,
} from './lib/walk-helpers.mjs';

// ── env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var ${k}`); return v; };

const PROD_URL   = 'https://agencytrack.vercel.app';
const TOKEN      = requireEnv('VERCEL_BYPASS_TOKEN');
const BM_EMAIL   = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const BM_PASS    = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');
const AG_EMAIL   = requireEnv('A11Y_AGENT_EMAIL');
const AG_PASS    = requireEnv('A11Y_AGENT_PASSWORD');
const TA_EMAIL   = requireEnv('A11Y_TENANT_ADMIN_EMAIL');
const TA_PASS    = requireEnv('A11Y_TENANT_ADMIN_PASSWORD');
const TENANT_ID  = process.env.VITE_TENANT_ID ?? 'tatillife_south';
const PROJECT_ID = 'agencytrack-2a610';

// ── helpers ───────────────────────────────────────────────────────────────────

function decodeJwt(t) {
  return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf-8'));
}

// runQuery via Firestore REST structured query
async function fsRunQuery(authToken, structuredQuery) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tenants/${TENANT_ID}:runQuery`;
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
}

async function captureToken(browser, email, pass) {
  const context = await browser.newContext();
  await setupBypassSession(context, PROD_URL, TOKEN);
  const page = await context.newPage();
  await installBearerTokenCapture(page);
  await loginAs(page, PROD_URL, email, pass);
  await page.waitForTimeout(2500);
  const tok = await captureBearerToken(page);
  await context.close();
  return tok;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${stamp()}] submission-branchid read-rule live-verify (production)`);
  console.log(`[${stamp()}] target: ${PROD_URL}  tenant: ${TENANT_ID}\n`);

  const clear = installGlobalTimeout(300_000, () => {});
  const results = [];
  const browser = await chromium.launch();

  // ── Capture bearer tokens for all three users ──────────────────────────────
  let bmToken, agToken, taToken;
  let bmClaims, agClaims;

  console.log(`[${stamp()}] Signing in BM...`);
  bmToken = await captureToken(browser, BM_EMAIL, BM_PASS);
  if (!bmToken) { results.push({ leg: 'BM token capture', passed: false, detail: 'No bearer token from BM session' }); }
  else { bmClaims = decodeJwt(bmToken); console.log(`[${stamp()}] BM uid=${bmClaims.user_id}  branchId=${bmClaims.branchId}`); }

  console.log(`[${stamp()}] Signing in agent...`);
  agToken = await captureToken(browser, AG_EMAIL, AG_PASS);
  if (!agToken) { results.push({ leg: 'Agent token capture', passed: false, detail: 'No bearer token from agent session' }); }
  else { agClaims = decodeJwt(agToken); console.log(`[${stamp()}] Agent uid=${agClaims.user_id}`); }

  console.log(`[${stamp()}] Signing in TA...`);
  taToken = await captureToken(browser, TA_EMAIL, TA_PASS);
  if (!taToken) { results.push({ leg: 'TA token capture', passed: false, detail: 'No bearer token from TA session' }); }
  else { const tac = decodeJwt(taToken); console.log(`[${stamp()}] TA uid=${tac.user_id}`); }

  await browser.close();

  const collection = {
    collectionId: 'submissions',
    allDescendants: false,
  };

  // ── Leg 1: BM unconstrained list → DENY ───────────────────────────────────
  if (bmToken) {
    const leg = 'BM unconstrained list (no branchId filter) → DENY';
    try {
      const query = { from: [collection], limit: 1 }; // no where clause
      const resp = await fsRunQuery(bmToken, query);
      if (resp.status === 403) {
        results.push({ leg, passed: true, detail: 'HTTP 403 — unconstrained BM query denied ✓ (crafted-query bypass closed)' });
        console.log(`[${stamp()}] ${leg}: PASS (HTTP 403)`);
      } else {
        const body = await resp.text();
        results.push({ leg, passed: false, detail: `HTTP ${resp.status} — expected 403. Rule may not be deployed. Body: ${body.slice(0, 200)}` });
        console.error(`[${stamp()}] ${leg}: FAIL — HTTP ${resp.status}`);
      }
    } catch (err) {
      results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
    }
  }

  // ── Leg 2: BM own-branch list (branchId == claim) → ALLOW ─────────────────
  if (bmToken && bmClaims?.branchId) {
    const leg = `BM own-branch list (branchId == ${bmClaims.branchId}) → ALLOW`;
    try {
      const query = {
        from: [collection],
        where: {
          fieldFilter: {
            field: { fieldPath: 'branchId' },
            op: 'EQUAL',
            value: { stringValue: bmClaims.branchId },
          },
        },
        limit: 5,
      };
      const resp = await fsRunQuery(bmToken, query);
      if (resp.ok) {
        results.push({ leg, passed: true, detail: `HTTP ${resp.status} — branch-scoped BM query allowed ✓` });
        console.log(`[${stamp()}] ${leg}: PASS (HTTP ${resp.status})`);
      } else {
        const body = await resp.text();
        results.push({ leg, passed: false, detail: `HTTP ${resp.status} — expected 200. Index may not be Enabled yet. Body: ${body.slice(0, 200)}` });
        console.error(`[${stamp()}] ${leg}: FAIL — HTTP ${resp.status}`);
      }
    } catch (err) {
      results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
    }
  }

  // ── Leg 3: Agent self-list (agentId == uid) → ALLOW ───────────────────────
  if (agToken && agClaims?.user_id) {
    const leg = 'Agent self-list (agentId == uid) → ALLOW';
    try {
      const query = {
        from: [collection],
        where: {
          fieldFilter: {
            field: { fieldPath: 'agentId' },
            op: 'EQUAL',
            value: { stringValue: agClaims.user_id },
          },
        },
        limit: 5,
      };
      const resp = await fsRunQuery(agToken, query);
      if (resp.ok) {
        results.push({ leg, passed: true, detail: `HTTP ${resp.status} — agent self-list allowed ✓` });
        console.log(`[${stamp()}] ${leg}: PASS (HTTP ${resp.status})`);
      } else {
        const body = await resp.text();
        results.push({ leg, passed: false, detail: `HTTP ${resp.status} — expected 200. Body: ${body.slice(0, 200)}` });
        console.error(`[${stamp()}] ${leg}: FAIL — HTTP ${resp.status}`);
      }
    } catch (err) {
      results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
    }
  }

  // ── Leg 4: TA unfiltered list → ALLOW ─────────────────────────────────────
  if (taToken) {
    const leg = 'TA unfiltered list → ALLOW (tenant-wide access intact)';
    try {
      const query = { from: [collection], limit: 5 };
      const resp = await fsRunQuery(taToken, query);
      if (resp.ok) {
        results.push({ leg, passed: true, detail: `HTTP ${resp.status} — TA tenant-wide list allowed ✓` });
        console.log(`[${stamp()}] ${leg}: PASS (HTTP ${resp.status})`);
      } else {
        const body = await resp.text();
        results.push({ leg, passed: false, detail: `HTTP ${resp.status} — expected 200. Body: ${body.slice(0, 200)}` });
        console.error(`[${stamp()}] ${leg}: FAIL — HTTP ${resp.status}`);
      }
    } catch (err) {
      results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
    }
  }

  finishSmoke(results, { clearTimeout: clear });
}

main().catch((err) => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});

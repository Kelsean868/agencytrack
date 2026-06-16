/**
 * submission-branchid-liveverify.mjs
 *
 * Post-merge live-verify for PR #654 (Slice 1 forge-validation rule).
 * Confirms the forge-validation rule is DEPLOYED and enforced in production.
 *
 * Leg 1 — Agent writes with OWN claim branchId → Firestore REST → expect 200 (ALLOW)
 * Leg 2 — Agent writes with FORGED branchId    → Firestore REST → expect 403 (DENY)
 *
 * Both use the agent's real Firebase Auth token obtained from the browser session.
 * A forged write targets a throw-away doc (weekStarting=2099-01-07) and is cleaned
 * up whether it succeeds or fails.
 *
 * Usage:
 *   node scripts/verification/submission-branchid-liveverify.mjs
 *   (reads credentials from .env.local; targets production)
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

const PROD_URL    = 'https://agencytrack.vercel.app';
const TOKEN       = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS  = requireEnv('A11Y_AGENT_PASSWORD');
const TENANT_ID   = process.env.VITE_TENANT_ID ?? 'tatillife_south';
const PROJECT_ID  = 'agencytrack-2a610';
const FS_BASE     = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Throw-away doc IDs (far-future weekStarting; won't collide with real data)
const WEEK_ALLOW  = '2099-01-07';
const WEEK_DENY   = '2099-01-14';

// ── helpers ───────────────────────────────────────────────────────────────────

function decodeJwt(token) {
  const payload = Buffer.from(token.split('.')[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

function fsString(v) { return { stringValue: String(v) }; }

async function fsWrite(authToken, docPath, fields) {
  const url = `${FS_BASE}/${docPath}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  return resp;
}

async function fsDelete(authToken, docPath) {
  const url = `${FS_BASE}/${docPath}`;
  await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => {});
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${stamp()}] submission-branchid live-verify (production)`);
  console.log(`[${stamp()}] target: ${PROD_URL}  tenant: ${TENANT_ID}\n`);

  const clear = installGlobalTimeout(180_000, () => {});
  const results = [];
  const browser = await chromium.launch();
  const context = await browser.newContext();

  let authToken = null;
  let agentUid  = null;
  let claimBranchId = null;

  try {
    // ── Sign in as agent + capture auth token ─────────────────────────────
    await setupBypassSession(context, PROD_URL, TOKEN);
    const page = await context.newPage();
    await installBearerTokenCapture(page);
    await loginAs(page, PROD_URL, AGENT_EMAIL, AGENT_PASS);

    // Trigger a Firestore read so the bearer token capture fires
    await page.waitForTimeout(2000);
    authToken = await captureBearerToken(page);

    if (!authToken) {
      results.push({ leg: 'auth-token capture', passed: false, detail: 'No bearer token captured from session' });
      await browser.close();
      return finishSmoke(results, { clearTimeout: clear });
    }

    const claims = decodeJwt(authToken);
    agentUid     = claims.user_id ?? claims.sub;
    claimBranchId = claims.branchId ?? null;

    console.log(`[${stamp()}] agent uid=${agentUid}  claim.branchId=${claimBranchId}`);

    if (!claimBranchId) {
      results.push({ leg: 'branchId claim check', passed: false, detail: `Agent token has no branchId claim — agent may not be branch-assigned. claims: ${JSON.stringify(Object.keys(claims))}` });
      await browser.close();
      return finishSmoke(results, { clearTimeout: clear });
    }

    // ── Leg 1: ALLOW — write with OWN branchId ────────────────────────────
    {
      const leg = 'Agent write with own branchId → ALLOW';
      const docPath = `tenants/${TENANT_ID}/submissions/${agentUid}_${WEEK_ALLOW}`;
      const fields = {
        agentId:      fsString(agentUid),
        branchId:     fsString(claimBranchId),  // matches claim → should ALLOW
        weekStarting: fsString(WEEK_ALLOW),
        status:       fsString('draft'),
        tenantId:     fsString(TENANT_ID),
        apiSold:      { integerValue: '0' },
        applicationsSold: { integerValue: '0' },
      };
      try {
        const resp = await fsWrite(authToken, docPath, fields);
        const body = await resp.text();
        if (resp.ok) {
          results.push({ leg, passed: true, detail: `HTTP ${resp.status} — write allowed as expected` });
          console.log(`[${stamp()}] ${leg}: PASS (HTTP ${resp.status})`);
          // Clean up the test doc
          await fsDelete(authToken, docPath);
        } else {
          results.push({ leg, passed: false, detail: `HTTP ${resp.status} — expected 200, got deny. body: ${body.slice(0, 300)}` });
          console.error(`[${stamp()}] ${leg}: FAIL — unexpected deny HTTP ${resp.status}`);
        }
      } catch (err) {
        results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
      }
    }

    // ── Leg 2: DENY — write with FORGED branchId ─────────────────────────
    {
      const leg = 'Agent write with forged branchId → DENY';
      const forgedBranchId = 'FORGED-BRANCH-LIVEVERIFY';
      const docPath = `tenants/${TENANT_ID}/submissions/${agentUid}_${WEEK_DENY}`;
      const fields = {
        agentId:      fsString(agentUid),
        branchId:     fsString(forgedBranchId),  // forged — does NOT match claim → should DENY
        weekStarting: fsString(WEEK_DENY),
        status:       fsString('draft'),
        tenantId:     fsString(TENANT_ID),
        apiSold:      { integerValue: '0' },
        applicationsSold: { integerValue: '0' },
      };
      try {
        const resp = await fsWrite(authToken, docPath, fields);
        const body = await resp.text();
        if (resp.status === 403) {
          results.push({ leg, passed: true, detail: `HTTP 403 PERMISSION_DENIED — forge blocked as expected` });
          console.log(`[${stamp()}] ${leg}: PASS (HTTP 403 forge denied)`);
        } else if (resp.ok) {
          // Write succeeded — rule not enforced. Clean up then report failure.
          await fsDelete(authToken, docPath);
          results.push({ leg, passed: false, detail: `HTTP ${resp.status} — write ALLOWED with forged branchId. Rule not enforced in production. Check that firestore.rules was deployed.` });
          console.error(`[${stamp()}] ${leg}: FAIL — forge was allowed (rules not deployed?)`);
        } else {
          results.push({ leg, passed: false, detail: `HTTP ${resp.status} (unexpected). body: ${body.slice(0, 300)}` });
        }
      } catch (err) {
        results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
      }
    }

  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  finishSmoke(results, { clearTimeout: clear });
}

main().catch((err) => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});

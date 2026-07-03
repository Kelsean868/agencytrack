/**
 * g5-privacy-smoke.mjs — G5 Privacy + Opt-In Share post-deploy smoke.
 *
 * B1 — OWNER write-read-verify
 *   1. Agent logs in → navigates to Money Needs → toggle to 'shared' → reload → assert visibility='shared'.
 *   2. Toggle to 'private' → reload → assert visibility='private'. Cleanup done.
 *   3. Assert 0 console errors.
 *
 * B2 — MANAGER-READ leg (conditional)
 *   - Reads agent user doc for unitId + branchId.
 *   - Verifies UM/BM credential alignment.
 *   - IF aligned: with worksheet shared, UM reads → assert ALLOW.
 *   - IF NOT aligned: reports gap plainly, defers to FU.
 *
 * Run: node scripts/verification/g5-privacy-smoke.mjs
 */

import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  safeLog,
  waitForFirebaseReady,
} from './lib/walk-helpers.mjs';
import {
  loadEnv,
  loginAs,
  navigateAgentTab,
  getIdToken,
  decodeJwt,
  firestoreGet,
} from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');
const E     = loadEnv(ROOT);

const PROD_URL         = 'https://agencytrack.vercel.app';
const FIREBASE_PROJECT = 'agencytrack-2a610';
const CURRENT_YEAR     = new Date().getFullYear();

// TENANT_ID / AGENT_UID are resolved at RUNTIME from the A11Y_AGENT credential's
// token claims (see B2). Hardcoding drifted once (stale tatillife_south + uid vs
// the current tatillife_smoke fixture) and pointed a recurring smoke at a live
// tenant. Runtime resolution pins the smoke to whatever account A11Y_AGENT_* is.

const AGENT_NAV_SELECTOR = '[data-testid="agent-tab-money-needs"]';

/** Deterministic post-login/post-reload settle: wait for the agent nav to mount
 *  (condition-based, no fixed sleeps — post-#771 harness convention). */
async function waitForAgentNav(page, timeout = 30_000) {
  await page.waitForSelector(AGENT_NAV_SELECTOR, { state: 'visible', timeout });
}

// ── Firebase REST helpers ────────────────────────────────────────────────────

async function firestoreGetById(idToken, path) {
  const { ok, body } = await firestoreGet(path, idToken, FIREBASE_PROJECT);
  if (!ok) throw new Error(`Firestore GET ${path} → non-OK: ${JSON.stringify(body?.error ?? body).slice(0, 200)}`);
  return body;
}

async function firestorePatch(idToken, path, fields, fieldMasks) {
  const maskParams = fieldMasks.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}?${maskParams}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Firestore PATCH ${path} → ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json();
}

function extractField(doc, field) {
  const f = doc.fields?.[field];
  if (!f) return undefined;
  return f.stringValue ?? f.integerValue ?? f.booleanValue ?? f.timestampValue ?? null;
}

// ── Summary tracker ──────────────────────────────────────────────────────────

const results = [];
function pass(label, note = '') {
  results.push({ label, ok: true });
  console.log(`  ✅ ${label}${note ? ': ' + note : ''}`);
}
function fail(label, detail = '') {
  results.push({ label, ok: false, detail });
  console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // Env pre-check
  const required = ['VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing  = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  const browser = await chromium.launch({ headless: true });

  try {
    // ────────────────────────────────────────────────────────────────────────
    // B1 — OWNER write-read-verify
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log('B1 — OWNER write-read-verify');
    console.log('══════════════════════════════════');

    const agentCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const agentPage = await agentCtx.newPage();
    const capture   = captureConsoleAndNetwork(agentPage);

    await setupBypassSession(agentCtx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(agentPage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PROD_URL}/`);

    safeLog('[B1] waiting for agent nav, then navigating to Money Needs tab');
    await waitForAgentNav(agentPage);
    await navigateAgentTab(agentPage, 'money-needs');

    // Wait for worksheet OR "Start worksheet" CTA
    await agentPage.waitForFunction(
      () =>
        document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null ||
        document.body.textContent.includes('Start worksheet'),
      { timeout: 25_000 },
    );

    // If "Start worksheet" visible, click it
    const startBtn = agentPage.getByRole('button', { name: /start worksheet/i });
    if (await startBtn.count() > 0) {
      safeLog('[B1] clicking "Start worksheet" CTA');
      await startBtn.click();
      await agentPage.waitForFunction(
        () => document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null,
        { timeout: 25_000 },
      );
    }

    const toggleSelector = 'input[aria-label="Share with my Unit Manager and Branch Manager"]';
    const toggleCount    = await agentPage.locator(toggleSelector).count();
    if (toggleCount === 0) {
      fail('B1-a: visibility toggle in DOM', 'checkbox not found after navigation');
      const snippet = await agentPage.evaluate(() => document.body.textContent.slice(0, 400));
      console.log('[B1] page snippet:', snippet);
      await agentCtx.close();
      return;
    }

    const initialChecked = await agentPage.$eval(toggleSelector, (el) => el.checked);
    safeLog(`[B1] initial visibility: ${initialChecked ? 'shared' : 'private'}`);

    // ── Toggle → shared ───────────────────────────────────────────────────
    if (!initialChecked) {
      await agentPage.check(toggleSelector);
      await agentPage.waitForTimeout(1800);
    }
    safeLog('[B1] reloading (shared)');
    await agentPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(agentPage, 25_000);
    await waitForAgentNav(agentPage); // deterministic: agent dashboard nav mounted
    await navigateAgentTab(agentPage, 'money-needs');
    await agentPage.waitForFunction(
      () => document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null,
      { timeout: 25_000 },
    );
    const afterShared = await agentPage.$eval(toggleSelector, (el) => el.checked);
    if (afterShared) {
      pass('B1-a: worksheet reads back after reload + visibility=shared persisted');
    } else {
      fail('B1-a: visibility=shared persisted', 'checkbox not checked after reload');
    }

    // ── Toggle → private (cleanup) ────────────────────────────────────────
    await agentPage.uncheck(toggleSelector);
    await agentPage.waitForTimeout(1800);
    safeLog('[B1] reloading (private)');
    await agentPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(agentPage, 25_000);
    await waitForAgentNav(agentPage); // deterministic: agent dashboard nav mounted
    await navigateAgentTab(agentPage, 'money-needs');
    await agentPage.waitForFunction(
      () => document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null,
      { timeout: 25_000 },
    );
    const afterPrivate = await agentPage.$eval(toggleSelector, (el) => el.checked);
    if (!afterPrivate) {
      pass('B1-b: visibility=private persisted after toggle-off + reload');
    } else {
      fail('B1-b: visibility=private persisted', 'checkbox still checked after toggle-off reload');
    }

    // Console errors
    const errorCount = capture.consoleMessages.filter((m) => m.type === 'error').length;
    if (errorCount === 0) {
      pass('B1-c: 0 console errors');
    } else {
      fail('B1-c: 0 console errors', `${errorCount} error(s)`);
      console.log(formatCaptureReport(capture));
    }

    await agentCtx.close();

    // ────────────────────────────────────────────────────────────────────────
    // B2 — MANAGER-READ leg
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log('B2 — MANAGER-READ leg (conditional)');
    console.log('══════════════════════════════════');

    const agentIdToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, E.VITE_FIREBASE_API_KEY);
    const agentClaims  = decodeJwt(agentIdToken);
    const AGENT_UID    = agentClaims.user_id;
    const TENANT_ID    = agentClaims.tenantId;
    if (!AGENT_UID || !TENANT_ID) {
      throw new Error(`A11Y_AGENT token claims missing user_id/tenantId (tenantId=${TENANT_ID ?? 'undefined'})`);
    }
    safeLog(`[B2] runtime fixture: tenant=${TENANT_ID} agentUid=${AGENT_UID}`);

    const agentDoc     = await firestoreGetById(agentIdToken, `tenants/${TENANT_ID}/users/${AGENT_UID}`);
    const agentUnitId  = extractField(agentDoc, 'unitId');
    const agentBranchId = extractField(agentDoc, 'branchId');
    safeLog(`[B2] agent unitId=${agentUnitId} branchId=${agentBranchId}`);

    const worksheetPath = `tenants/${TENANT_ID}/users/${AGENT_UID}/moneyNeeds/${CURRENT_YEAR}`;

    // Set worksheet to shared for manager-read test
    await firestorePatch(
      agentIdToken, worksheetPath,
      { visibility: { stringValue: 'shared' } },
      ['visibility'],
    );
    safeLog('[B2] worksheet set to shared for manager-read test');

    // ── UM alignment check + read ─────────────────────────────────────────
    const hasUM = !!(E.A11Y_UNIT_MANAGER_EMAIL && E.A11Y_UNIT_MANAGER_PASSWORD);
    if (hasUM) {
      const umIdToken = await getIdToken(E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD, E.VITE_FIREBASE_API_KEY);
      const umClaims  = decodeJwt(umIdToken);
      const umUid     = umClaims.user_id;
      const umDoc     = await firestoreGetById(umIdToken, `tenants/${TENANT_ID}/users/${umUid}`);
      const umUnitId  = extractField(umDoc, 'unitId');
      safeLog(`[B2] UM uid=${umUid} unitId=${umUnitId}`);
      // UM is aligned if their UID is the agentUnitId (they ARE the unit manager) OR their unitId matches
      const umAligned = (umUid === agentUnitId) || (umUnitId === agentUnitId);
      safeLog(`[B2] UM aligned: ${umAligned}`);

      if (umAligned) {
        try {
          const umRead = await firestoreGetById(umIdToken, worksheetPath);
          const vis    = extractField(umRead, 'visibility');
          pass(`B2-um: UM reads agent shared worksheet`, `visibility=${vis}`);
        } catch (e) {
          fail('B2-um: UM reads agent shared worksheet', e.message);
        }
      } else {
        console.log(`\n[B2] DEFERRED: UM credential exists but not aligned to agent's unit.`);
        console.log(`  Agent unitId: ${agentUnitId} | UM uid: ${umUid} | UM unitId: ${umUnitId}`);
        console.log('  → FU banked: seed aligned UM test account in tatillife_south.');
      }
    } else {
      console.log('[B2] DEFERRED: no A11Y_UNIT_MANAGER_* credentials in .env.local.');
    }

    // ── BM alignment check + read ─────────────────────────────────────────
    const hasBM = !!(E.A11Y_BRANCH_MANAGER_EMAIL && E.A11Y_BRANCH_MANAGER_PASSWORD);
    if (hasBM) {
      const bmIdToken  = await getIdToken(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD, E.VITE_FIREBASE_API_KEY);
      const bmClaims   = decodeJwt(bmIdToken);
      const bmUid      = bmClaims.user_id;
      const bmDoc      = await firestoreGetById(bmIdToken, `tenants/${TENANT_ID}/users/${bmUid}`);
      const bmBranchId = extractField(bmDoc, 'branchId');
      safeLog(`[B2] BM uid=${bmUid} branchId=${bmBranchId}`);
      const bmAligned  = bmBranchId === agentBranchId;
      safeLog(`[B2] BM aligned: ${bmAligned}`);

      if (bmAligned) {
        try {
          const bmRead = await firestoreGetById(bmIdToken, worksheetPath);
          const vis    = extractField(bmRead, 'visibility');
          pass(`B2-bm: BM reads agent shared worksheet`, `visibility=${vis}`);
        } catch (e) {
          fail('B2-bm: BM reads agent shared worksheet', e.message);
        }
      } else {
        console.log(`\n[B2] DEFERRED: BM credential exists but branchId not aligned.`);
        console.log(`  Agent branchId: ${agentBranchId} | BM branchId: ${bmBranchId}`);
        console.log('  → FU banked: confirm BM test account branchId matches agent branchId.');
      }
    } else {
      console.log('[B2] DEFERRED: no A11Y_BRANCH_MANAGER_* credentials in .env.local.');
    }

    // Cleanup — restore to private
    await firestorePatch(
      agentIdToken, worksheetPath,
      { visibility: { stringValue: 'private' } },
      ['visibility'],
    );
    safeLog('[B2] cleanup: worksheet restored to private');

  } finally {
    await browser.close();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════');
  console.log('SMOKE SUMMARY');
  console.log('══════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ': ' + r.detail : ''}`);
  }
  console.log(`\n${passed}/${results.length} pass${failed > 0 ? ` (${failed} FAILED)` : ''}`);
  if (failed > 0) process.exit(1);
})();

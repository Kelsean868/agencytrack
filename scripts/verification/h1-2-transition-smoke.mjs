/**
 * h1-2-transition-smoke.mjs — Track H H1.2 agent status transition production smoke.
 *
 * Legs:
 *  1. Log in as test agent.
 *  2. Policy Ledger → create SMOKE-H12-<ts> policy (ownerName tag).
 *  3. "Update Status" → Settled → fill §7.4 fields → Confirm. Assert no error.
 *  4. Hard-reload. Assert status badge shows "Settled" for SMOKE entry (persistence).
 *  5. Verify ≥1 history doc in /policies/{id}/history via Firestore REST.
 *     Assert fromStatus=submitted, toStatus=settled.
 *  6. Capture policy doc path. Save report to verification/<ts>-h1-2-transition-smoke.md.
 *  7. Leave fixture (delete: if false on history — admin cleanup is a separate step). STOP.
 *
 * Run:  node scripts/verification/h1-2-transition-smoke.mjs
 *
 * Requires .env.local: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL/PASSWORD,
 *   VITE_FIREBASE_API_KEY.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  hardReloadAndAwaitReady,
  safeLog,
} from './lib/walk-helpers.mjs';

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

const PROD_URL         = 'https://agencytrack.vercel.app';
const FIREBASE_PROJECT = 'agencytrack-2a610';
const AGENT_UID        = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2'; // kelsean@gmail.com

const NOW         = new Date();
const RUN_TS      = NOW.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SMOKE_OWNER = `SMOKE-H12-${NOW.getTime()}`;

const SS_DIR      = join(__dir, `${RUN_TS}-h1-2-transition-screenshots`);
const REPORT_PATH = join(__dir, `${RUN_TS}-h1-2-transition-smoke.md`);

// Settled field values matching the brief
const SETTLED = {
  dateIssued:       NOW.toISOString().split('T')[0], // today
  settledAPI:       '5000',
  issuedCoverage:   '100000',
  initialPremium:   '416.67',
  earnedCommission: '200',
};

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1500);
}

async function navigateToPolicyLedger(page) {
  const sel = '[data-testid="agent-tab-policy-ledger"]';
  await page.waitForTimeout(800);
  const loc = page.locator(sel);
  if (await loc.first().isVisible({ timeout: 4000 }).catch(() => false)) {
    await loc.first().click({ force: true });
    await page.waitForTimeout(900);
    return;
  }
  // Mobile More drawer
  const moreBtn = page.getByRole('button', { name: /more/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    const drawerLoc = page.locator(sel);
    if (await drawerLoc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerLoc.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  // Last-resort dispatch click
  const found = await page.evaluate((s) => !!document.querySelector(s), sel);
  if (!found) throw new Error(`Policy Ledger tab not found: ${sel}`);
  await page.evaluate((s) => {
    document.querySelector(s).dispatchEvent(new Event('click', { bubbles: true }));
  }, sel);
  await page.waitForTimeout(900);
}

async function getIdToken(email, password) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!resp.ok) throw new Error(`getIdToken failed: ${resp.status}`);
  const data = await resp.json();
  return data.idToken;
}

function extractTenantId(idToken) {
  const [, payloadB64] = idToken.split('.');
  const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
  const claims = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  return claims.tenantId || null;
}

async function queryOwnPolicies(idToken, tenantId) {
  const parent = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}`;
  const url = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'policies', allDescendants: false }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'agentId' },
          op: 'EQUAL',
          value: { stringValue: AGENT_UID },
        },
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 10,
    },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Firestore policies query failed: ${resp.status} — ${text.slice(0, 200)}`);
  }
  return resp.json();
}

async function queryHistory(idToken, tenantId, policyId) {
  const parent = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}/policies/${policyId}`;
  const url = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
  // agentId filter is required so canAccessOwn can be evaluated per-doc by Firestore rules
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'history', allDescendants: false }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'agentId' },
          op: 'EQUAL',
          value: { stringValue: AGENT_UID },
        },
      },
      limit: 5,
    },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Firestore history query failed: ${resp.status} — ${text.slice(0, 200)}`);
  }
  return resp.json();
}

async function main() {
  safeLog('=== Policy Ledger H1.2 Transition Smoke ===');
  safeLog('Target:', PROD_URL);
  safeLog('Smoke tag:', SMOKE_OWNER);

  const results = [];
  mkdirSync(SS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    // ── Step 1: Login ──
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  [1] Logged in');
    results.push({ step: '1-login', pass: true, note: 'Test agent logged in to production' });

    // ── Step 2: Navigate to Policy Ledger ──
    try {
      await navigateToPolicyLedger(page);
      await page.screenshot({ path: join(SS_DIR, '01-list-view.png') });
      safeLog('  [2] Policy Ledger tab open');
      results.push({ step: '2-navigate-tab', pass: true, note: 'Policy Ledger list view visible' });
    } catch (e) {
      results.push({ step: '2-navigate-tab', pass: false, note: e.message });
      throw e;
    }

    // ── Step 3a: Open New Policy form ──
    try {
      await page.getByRole('button', { name: /new policy/i }).click();
      await page.locator('h2').filter({ hasText: 'New Policy' }).waitFor({ timeout: 8000 });
      safeLog('  [3a] Create form open');
    } catch (e) {
      results.push({ step: '3-create-policy', pass: false, note: `form open: ${e.message}` });
      throw e;
    }

    // ── Step 3b: Fill and submit new policy ──
    try {
      await page.fill('input[name="ownerName"]', SMOKE_OWNER);
      // Same as owner
      const sameBox = page.locator('label').filter({ hasText: /same as owner/i })
        .locator('input[type="checkbox"]');
      if (await sameBox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sameBox.check();
        await page.waitForTimeout(200);
      } else {
        await page.fill('input[name="insuredName"]', SMOKE_OWNER);
      }
      await page.selectOption('select[name="productLine"]',   'life');
      await page.selectOption('select[name="newBusinessType"]','nb_ordinary');
      await page.selectOption('select[name="policyClass"]',   'whole_life');
      await page.selectOption('select[name="proposedFrequency"]', 'A');
      await page.fill('input[name="proposedPremium"]', '5000');
      await page.waitForTimeout(300);
      await page.selectOption('select[name="sourceOfProspect"]', 'referral');
      await page.screenshot({ path: join(SS_DIR, '02-form-filled.png') });

      await page.getByRole('button', { name: /save policy/i }).click();
      await page.locator('h2').filter({ hasText: 'Policy Ledger' }).waitFor({ timeout: 15000 });
      await page.locator(`text=${SMOKE_OWNER}`).waitFor({ timeout: 8000 });
      await page.screenshot({ path: join(SS_DIR, '03-post-create-list.png') });
      safeLog(`  [3] Policy created — ${SMOKE_OWNER} in list ✓`);
      results.push({ step: '3-create-policy', pass: true, note: `${SMOKE_OWNER} created, visible in list` });
    } catch (e) {
      await page.screenshot({ path: join(SS_DIR, '03-create-error.png') }).catch(() => {});
      results.push({ step: '3-create-policy', pass: false, note: e.message });
      throw e;
    }

    // ── Step 4: Open "Update Status" modal for the smoke policy ──
    try {
      // Click the "Update Status" button on the SMOKE card.
      // The card contains the SMOKE_OWNER text — locate the button within that card.
      const smokeCard = page.locator('div').filter({ hasText: SMOKE_OWNER }).first();
      const updateBtn = smokeCard.getByRole('button', { name: /update status/i });
      await updateBtn.waitFor({ timeout: 8000 });
      await updateBtn.click();
      // Wait for modal h3
      await page.locator('h3').filter({ hasText: 'Update Status' }).waitFor({ timeout: 6000 });
      await page.screenshot({ path: join(SS_DIR, '04-modal-open.png') });
      safeLog('  [4] Transition modal open');
      results.push({ step: '4-open-modal', pass: true, note: 'Transition modal opened for SMOKE policy' });
    } catch (e) {
      await page.screenshot({ path: join(SS_DIR, '04-modal-error.png') }).catch(() => {});
      results.push({ step: '4-open-modal', pass: false, note: e.message });
      throw e;
    }

    // ── Step 5: Select Settled + fill §7.4 fields ──
    try {
      // The status select is inside the modal fixed overlay; no name attribute
      const modal = page.locator('div.fixed.inset-0');
      await modal.locator('select').selectOption('settled');
      await page.waitForTimeout(300); // let settled fields render

      // Fill settled fields
      await page.fill('input[name="dateIssued"]',       SETTLED.dateIssued);
      await page.fill('input[name="settledAPI"]',        SETTLED.settledAPI);
      await page.fill('input[name="issuedCoverage"]',    SETTLED.issuedCoverage);
      await page.fill('input[name="initialPremium"]',    SETTLED.initialPremium);
      await page.fill('input[name="earnedCommission"]',  SETTLED.earnedCommission);
      await page.screenshot({ path: join(SS_DIR, '05-modal-settled-filled.png') });
      safeLog('  [5] Settled fields filled');
      results.push({ step: '5-fill-settled', pass: true, note: `dateIssued=${SETTLED.dateIssued}, settledAPI=${SETTLED.settledAPI}, issuedCoverage=${SETTLED.issuedCoverage}, initialPremium=${SETTLED.initialPremium}, earnedCommission=${SETTLED.earnedCommission}` });
    } catch (e) {
      await page.screenshot({ path: join(SS_DIR, '05-fill-error.png') }).catch(() => {});
      results.push({ step: '5-fill-settled', pass: false, note: e.message });
      throw e;
    }

    // ── Step 6: Submit and assert no error ──
    try {
      await page.getByRole('button', { name: /confirm/i }).click();
      // Modal closes + list view restores (no modal h3)
      await page.locator('h3', { hasText: 'Update Status' }).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      // Assert no txError div visible
      const errDiv = await page.locator('.bg-red-50, [class*="red-950"]').filter({ hasText: /error|failed/i });
      const hasErr = await errDiv.first().isVisible({ timeout: 1000 }).catch(() => false);
      if (hasErr) {
        const errText = await errDiv.first().innerText().catch(() => '');
        throw new Error(`Transition error visible: ${errText}`);
      }
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(SS_DIR, '06-post-transition.png') });
      safeLog('  [6] Transition submitted — no error ✓');
      results.push({ step: '6-submit-transition', pass: true, note: 'Confirm clicked, modal closed, no error div' });
    } catch (e) {
      await page.screenshot({ path: join(SS_DIR, '06-submit-error.png') }).catch(() => {});
      results.push({ step: '6-submit-transition', pass: false, note: e.message });
      throw e;
    }

    // ── Step 7: Hard-reload, assert Settled status persists ──
    await hardReloadAndAwaitReady(page);
    await page.waitForTimeout(800);
    results.push({ step: '7-hard-reload', pass: true, note: 'Hard-reloaded successfully' });

    try {
      await navigateToPolicyLedger(page);
      // Assert SMOKE entry visible
      await page.locator(`text=${SMOKE_OWNER}`).waitFor({ timeout: 12000 });
      // Assert Settled badge visible near SMOKE entry
      const smokeCard = page.locator('div').filter({ hasText: SMOKE_OWNER }).first();
      const settledBadge = smokeCard.locator('text=Settled');
      const badgeVisible = await settledBadge.isVisible({ timeout: 5000 }).catch(() => false);
      await page.screenshot({ path: join(SS_DIR, '07-post-reload-list.png') });
      if (!badgeVisible) {
        // Capture what status badge we actually see
        const badgeText = await smokeCard.locator('[class*="bg-"]').first().innerText().catch(() => '(not found)');
        throw new Error(`"Settled" badge not visible after reload — found: "${badgeText}"`);
      }
      safeLog('  [7] "Settled" status persists after hard-reload ✓');
      results.push({ step: '7-post-reload-settled', pass: true, note: `${SMOKE_OWNER} shows "Settled" badge after hard reload` });
    } catch (e) {
      await page.screenshot({ path: join(SS_DIR, '07-reload-error.png') }).catch(() => {});
      results.push({ step: '7-post-reload-settled', pass: false, note: e.message });
      // Don't throw — still capture doc path + history
    }

    // Console errors
    const filteredErrors = consoleErrors.filter(
      (e) => !e.includes('GrpcConnection') && !e.includes('WebChannel') && !e.includes('long-polling'),
    );
    results.push({
      step: '8-console-errors',
      pass: filteredErrors.length === 0,
      note: filteredErrors.length === 0
        ? '0 console errors'
        : filteredErrors.join(' | ').slice(0, 300),
    });
    if (filteredErrors.length > 0) safeLog('  Console errors:', filteredErrors.join(' | '));

    await ctx.close();

    // ── Step 9: REST — capture doc path + verify history ──
    safeLog('\n── Step 9: Firestore REST — doc path + history verification ──');
    let docPath = '(not captured)';
    let historyVerified = false;
    let historyNote = '';
    let policyId = null;

    try {
      const idToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const tenantId = extractTenantId(idToken);
      safeLog('  Tenant ID from JWT claims:', tenantId);
      if (!tenantId) throw new Error('tenantId not found in JWT claims');

      // Find the smoke policy doc
      const rows = await queryOwnPolicies(idToken, tenantId);
      let smokeDoc = null;
      for (const item of rows) {
        if (!item.document) continue;
        if (item.document.fields?.ownerName?.stringValue === SMOKE_OWNER) {
          smokeDoc = item.document;
          break;
        }
      }
      if (!smokeDoc) throw new Error(`SMOKE doc "${SMOKE_OWNER}" not found in REST query`);

      // Extract doc path and policyId
      const [, relPath] = smokeDoc.name.split('/documents/');
      docPath = relPath;
      policyId = relPath.split('/').pop();
      safeLog('  Policy doc path:', docPath);
      safeLog('  Policy status in REST:', smokeDoc.fields?.status?.stringValue);
      results.push({ step: '9a-doc-path', pass: true, note: docPath });

      // Verify status is "settled" in Firestore
      const restStatus = smokeDoc.fields?.status?.stringValue;
      results.push({
        step: '9b-status-in-firestore',
        pass: restStatus === 'settled',
        note: `status=${restStatus} (expected: settled)`,
      });
      safeLog(`  Status in Firestore: ${restStatus} ${restStatus === 'settled' ? '✓' : '✗ (expected settled)'}`);

      // Query history subcollection
      safeLog('  Querying history subcollection...');
      const histRows = await queryHistory(idToken, tenantId, policyId);
      const histDocs = histRows.filter((r) => r.document);
      safeLog(`  History docs found: ${histDocs.length}`);

      if (histDocs.length === 0) {
        historyNote = 'No history docs found in subcollection';
        results.push({ step: '9c-history-exists', pass: false, note: historyNote });
      } else {
        const latestHist = histDocs[0].document;
        const fromStatus = latestHist.fields?.fromStatus?.stringValue;
        const toStatus   = latestHist.fields?.toStatus?.stringValue;
        const actorUid   = latestHist.fields?.actorUid?.stringValue;
        const [, histRelPath] = latestHist.name.split('/documents/');
        historyNote = `${histDocs.length} history doc(s); latest: fromStatus=${fromStatus}, toStatus=${toStatus}, actorUid=${actorUid}`;
        safeLog(`  History: ${historyNote}`);
        safeLog(`  History path: ${histRelPath}`);
        historyVerified = fromStatus === 'submitted' && toStatus === 'settled';
        results.push({
          step: '9c-history-exists',
          pass: historyVerified,
          note: `${historyNote} — ${historyVerified ? 'MATCH ✓' : 'MISMATCH ✗ (expected submitted→settled)'}`,
        });
        results.push({ step: '9d-history-path', pass: true, note: histRelPath });
      }
    } catch (e) {
      safeLog('  REST error:', e.message);
      results.push({ step: '9a-doc-path', pass: false, note: e.message });
    }

    // ── Report ──
    const allPass = results.every((r) => r.pass === true);
    const table = [
      '| Step | Pass | Note |',
      '|------|------|------|',
      ...results.map((r) => `| ${r.step} | ${r.pass === true ? '✓' : '✗'} | ${r.note} |`),
    ].join('\n');

    const report = [
      `# H1.2 Transition Smoke — ${RUN_TS}`,
      '',
      `**Target:** ${PROD_URL}`,
      `**Smoke tag:** \`${SMOKE_OWNER}\``,
      `**Overall:** ${allPass ? '✓ PASS' : '✗ FAIL'}`,
      `**Policy doc path:** \`${docPath}\``,
      '',
      '## Steps',
      '',
      table,
      '',
      '## Screenshots',
      '',
      `Saved to: \`${SS_DIR}\``,
      '',
      '## Fixture',
      '',
      '> Left in place per brief instructions (`delete: if false` on history — admin cleanup is a separate step).',
    ].join('\n');

    writeFileSync(REPORT_PATH, report, 'utf8');
    safeLog(`\nReport saved: ${REPORT_PATH}`);

    safeLog('\n── Results ──');
    for (const r of results) {
      safeLog(`  ${r.pass === true ? '✓' : '✗'} [${r.step}] ${r.note}`);
    }
    safeLog(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
    safeLog(`Policy doc path: ${docPath}`);
    safeLog(`History verified (submitted→settled): ${historyVerified}`);
    safeLog('\nFixture left in place. STOP.');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  safeLog('Fatal error:', e.message);
  process.exit(1);
});

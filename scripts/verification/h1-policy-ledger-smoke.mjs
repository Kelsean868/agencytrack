/**
 * h1-policy-ledger-smoke.mjs — Track H H1 Policy Ledger production smoke.
 *
 * Single leg: POSITIVE write-read-verify.
 *  1. Agent (A11Y_AGENT_EMAIL) logs in on production.
 *  2. Opens Policy Ledger tab.
 *  3. Creates a SMOKE-H1-<timestamp> policy (ownerName tag for cleanup).
 *  4. Asserts create succeeded — list view shows SMOKE-H1 entry, no error state.
 *  5. Hard-reloads the page and navigates back to Policy Ledger.
 *  6. Asserts SMOKE-H1 entry still visible — proves rule allowed write,
 *     (agentId, createdAt) index serves own-list read, persist confirmed.
 *  7. Captures full doc path via Firestore REST: tenants/<tenantId>/policies/<docId>.
 *     tenantId is extracted from the agent's JWT custom claims (no VITE_TENANT_ID needed).
 *
 * Run:  node scripts/verification/h1-policy-ledger-smoke.mjs
 *
 * Requires .env.local with: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL/PASSWORD,
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
const SMOKE_OWNER = `SMOKE-H1-${NOW.getTime()}`;

const SS_DIR      = join(__dir, `${RUN_TS}-h1-pl-screenshots`);
const REPORT_PATH = join(__dir, `${RUN_TS}-h1-policy-ledger-smoke.md`);

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
    throw new Error(`Firestore query failed: ${resp.status} — ${text.slice(0, 200)}`);
  }
  return resp.json();
}

async function main() {
  safeLog('=== Policy Ledger (H1) Production Smoke ===');
  safeLog('Target:', PROD_URL);
  safeLog('Smoke tag:', SMOKE_OWNER);

  const results = [];
  mkdirSync(SS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    safeLog('\n── LEG 1: POSITIVE (create → list → reload → persists) ──');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    // Step 1: login
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  Logged in');
    results.push({ step: '1-login', pass: true, note: 'Test agent logged in to production' });

    // Step 2: navigate to Policy Ledger tab
    try {
      await navigateToPolicyLedger(page);
      await page.screenshot({ path: join(SS_DIR, '01-list-view.png') });
      safeLog('  Policy Ledger tab open (list view)');
      results.push({ step: '2-navigate-tab', pass: true, note: 'Policy Ledger list view visible' });
    } catch (e) {
      results.push({ step: '2-navigate-tab', pass: false, note: e.message });
      throw e;
    }

    // Step 3: open New Policy form
    try {
      await page.getByRole('button', { name: /new policy/i }).click();
      await page.locator('h2').filter({ hasText: 'New Policy' }).waitFor({ timeout: 8000 });
      await page.screenshot({ path: join(SS_DIR, '02-create-form.png') });
      safeLog('  New Policy create form open');
      results.push({ step: '3-open-form', pass: true, note: 'New Policy create form visible' });
    } catch (e) {
      results.push({ step: '3-open-form', pass: false, note: e.message });
      throw e;
    }

    // Step 4: fill form
    try {
      // Owner Name (smoke tag)
      await page.fill('input[name="ownerName"]', SMOKE_OWNER);
      // Same as owner → insuredName auto-filled
      await page.locator('label').filter({ hasText: /same as owner/i })
        .locator('input[type="checkbox"]').check();
      await page.waitForTimeout(200);
      // Annual frequency (×1) so proposedAPI = proposedPremium = 1234
      await page.selectOption('select[name="proposedFrequency"]', 'A');
      await page.fill('input[name="proposedPremium"]', '1234');
      await page.waitForTimeout(300); // let handleChange compute proposedAPI
      const apiVal = await page.inputValue('input[name="proposedAPI"]');
      // Source of prospect: referral
      await page.selectOption('select[name="sourceOfProspect"]', 'referral');
      // dateWritten and dateSubmitted already default to today in EMPTY_FORM
      await page.screenshot({ path: join(SS_DIR, '03-form-filled.png') });
      safeLog(`  Form filled — freq=A, premium=1234, api=${apiVal}, source=referral`);
      results.push({ step: '4-fill-form', pass: true, note: `ownerName=${SMOKE_OWNER}, proposedAPI=${apiVal}` });
    } catch (e) {
      results.push({ step: '4-fill-form', pass: false, note: e.message });
      throw e;
    }

    // Step 5: submit and assert success
    try {
      await page.getByRole('button', { name: /save policy/i }).click();
      // Success: view switches back to list (h2 "Policy Ledger")
      await page.locator('h2').filter({ hasText: 'Policy Ledger' }).waitFor({ timeout: 15000 });
      // Confirm SMOKE entry in list
      await page.locator(`text=${SMOKE_OWNER}`).waitFor({ timeout: 8000 });
      await page.screenshot({ path: join(SS_DIR, '04-post-submit-list.png') });
      safeLog('  Create succeeded — SMOKE entry visible in list ✓');
      results.push({ step: '5-submit', pass: true, note: 'Policy created, SMOKE entry in list, no error state' });
    } catch (e) {
      await page.screenshot({ path: join(SS_DIR, '04-submit-error.png') }).catch(() => {});
      // Capture any error text
      const errText = await page.locator('[class*="red"]').first().innerText().catch(() => '');
      results.push({ step: '5-submit', pass: false, note: `${e.message}${errText ? ` | ui-error: ${errText}` : ''}` });
      throw e;
    }

    // Step 6: hard reload
    await hardReloadAndAwaitReady(page);
    safeLog('  Hard-reloaded');
    results.push({ step: '6-hard-reload', pass: true, note: 'Page hard-reloaded successfully' });

    // Step 7: navigate back to Policy Ledger and assert persistence
    try {
      await navigateToPolicyLedger(page);
      await page.locator(`text=${SMOKE_OWNER}`).waitFor({ timeout: 12000 });
      await page.screenshot({ path: join(SS_DIR, '05-post-reload-list.png') });
      safeLog('  SMOKE entry visible after reload ✓ — write persisted, index serves own-list');
      results.push({ step: '7-post-reload-verify', pass: true, note: `${SMOKE_OWNER} visible after hard reload` });
    } catch (e) {
      await page.screenshot({ path: join(SS_DIR, '05-post-reload-error.png') }).catch(() => {});
      results.push({ step: '7-post-reload-verify', pass: false, note: e.message });
      // Don't throw — still capture doc path
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
        : filteredErrors.join(' | ').slice(0, 200),
    });
    if (filteredErrors.length > 0) safeLog('  Console errors:', filteredErrors.join(' | '));

    await ctx.close();

    // Step 9: capture full doc path via Firestore REST
    safeLog('\n── Step 9: Capture doc path via Firestore REST ──');
    let docPath = '(not captured)';
    try {
      const idToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const tenantId = extractTenantId(idToken);
      safeLog('  Tenant ID extracted from JWT claims:', tenantId);
      if (!tenantId) throw new Error('tenantId not found in JWT claims');

      const rows = await queryOwnPolicies(idToken, tenantId);
      let smokeDoc = null;
      for (const item of rows) {
        if (!item.document) continue;
        if (item.document.fields?.ownerName?.stringValue === SMOKE_OWNER) {
          smokeDoc = item.document;
          break;
        }
      }
      if (smokeDoc) {
        // name: "projects/.../databases/(default)/documents/tenants/<tid>/policies/<docId>"
        const [, relPath] = smokeDoc.name.split('/documents/');
        docPath = relPath;
        safeLog('  Doc path:', docPath);
        results.push({ step: '9-doc-path', pass: true, note: docPath });
      } else {
        safeLog('  SMOKE doc not found in REST query (may not be indexed yet)');
        results.push({ step: '9-doc-path', pass: false, note: 'SMOKE doc not found in query results' });
      }
    } catch (e) {
      safeLog('  REST query error:', e.message);
      results.push({ step: '9-doc-path', pass: false, note: e.message });
    }

    // Report
    const allPass = results.every((r) => r.pass === true);
    const table = [
      '| Step | Pass | Note |',
      '|------|------|------|',
      ...results.map((r) => `| ${r.step} | ${r.pass === true ? '✓' : '✗'} | ${r.note} |`),
    ].join('\n');

    const report = [
      `# H1 Policy Ledger Smoke — ${RUN_TS}`,
      '',
      `**Target:** ${PROD_URL}`,
      `**Smoke tag:** \`${SMOKE_OWNER}\``,
      `**Overall:** ${allPass ? '✓ PASS' : '✗ FAIL'}`,
      `**Doc path:** \`${docPath}\``,
      '',
      '## Steps',
      '',
      table,
      '',
      '## Screenshots',
      '',
      `Saved to: \`${SS_DIR}\``,
    ].join('\n');

    writeFileSync(REPORT_PATH, report, 'utf8');
    safeLog(`\nReport saved: ${REPORT_PATH}`);

    safeLog('\n── Results ──');
    for (const r of results) {
      safeLog(`  ${r.pass === true ? '✓' : '✗'} [${r.step}] ${r.note}`);
    }
    safeLog(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
    safeLog(`Doc path: ${docPath}`);
    safeLog('\nFixture left in place (as instructed). STOP.');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  safeLog('Fatal error:', e.message);
  process.exit(1);
});

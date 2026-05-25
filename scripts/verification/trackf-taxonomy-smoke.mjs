/**
 * trackf-taxonomy-smoke.mjs — Track I build step 1 (PR #252) smoke.
 *
 * Verifies head-of-sales-confirmed taxonomy works end-to-end against the
 * deployed additive rule (`bank-referral` added to PROSPECTING_SOURCES
 * allowlist on /tenants/.../prospectInfo create + update):
 *
 *   AGENT (UI) — 4 legs (light + dark × desktop + mobile):
 *     1. Open Joint-Call Prep, create prep with prospectingSource =
 *        'bank-referral' + policyType = 'whole-life'. Write succeeds (the
 *        deployed rule accepts the new enum value).
 *     2. Hard reload → prep persists; card renders the
 *        "Bank Referral (BOA)" source chip + "Policy: Whole Life /
 *        Permanent" line.
 *
 *   MANAGER (REST) — single leg:
 *     3. BM signs in via REST → directly reads the agent's prospectInfo
 *        doc via Firestore REST. ALLOW means the rule's manager-read
 *        branch holds with the new enum value present. The same enum
 *        constants drive ProspectInfoTab labels (covered by unit tests).
 *
 *   0 console errors across all viewport legs.
 *
 * Run: node scripts/verification/trackf-taxonomy-smoke.mjs
 *
 * Requires .env.local with VERCEL_BYPASS_TOKEN, VITE_FIREBASE_API_KEY,
 * A11Y_AGENT_EMAIL/PASSWORD, A11Y_BRANCH_MANAGER_EMAIL/PASSWORD.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
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

const PREVIEW_HOST     = 'agencytrack-git-feat-trackf-taxonomy-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL      = `https://${PREVIEW_HOST}`;
const FIREBASE_PROJECT = 'agencytrack-2a610';
const APPT_DATE        = '2026-12-31';

function decodeJwtUid(token) {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      .toString('utf8'),
  );
  return { uid: payload.user_id || payload.sub, tenantId: payload.tenantId };
}

async function getIdTokenAndClaims(email, password) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
  const data = await resp.json();
  return { idToken: data.idToken, ...decodeJwtUid(data.idToken) };
}

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Viewport-aware. Sidebar nav is CSS-hidden at mobile; use a content-length
  // signal that proves dashboard render regardless of viewport.
  await page.waitForFunction(
    () =>
      !document.querySelector('input[type="email"]') &&
      document.body.textContent.length > 500,
    { timeout: 30000 },
  );
  await page.waitForTimeout(800);
}

async function navigateToProspectInfoTab(page) {
  const testIdSelector = '[data-testid="agent-tab-prospect-info"]';
  await page.waitForTimeout(800);
  const sidebarLoc = page.locator(testIdSelector);
  if (await sidebarLoc.first().isVisible({ timeout: 8000 }).catch(() => false)) {
    await sidebarLoc.first().click({ force: true });
    await page.waitForTimeout(900);
    return;
  }
  const moreBtn = page.getByRole('button', { name: /more/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    const drawerLoc = page.locator(testIdSelector);
    if (await drawerLoc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerLoc.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  // Last resort: dispatch click against any DOM-present element
  await page.evaluate((sel) => {
    document.querySelector(sel)?.dispatchEvent(new Event('click', { bubbles: true }));
  }, testIdSelector);
  await page.waitForTimeout(900);
}

async function createPrepWithTaxonomy(page, uniqueClient) {
  await page.click('[data-testid="prospect-info-add-btn"]');
  await page.waitForSelector('[data-testid="prospect-info-add-form"]', { timeout: 5000 });

  await page.fill('input[aria-label="Client name"]', uniqueClient);
  await page.selectOption('select[aria-label="Prospecting source"]', 'bank-referral');
  await page.selectOption('select[aria-label="Policy type"]', 'whole-life');
  await page.fill('input#prospect-appt-date', APPT_DATE);

  await page.click('[data-testid="prospect-info-save-btn"]');
  // wait for list re-render + Firestore write round-trip
  await page.waitForTimeout(2000);
}

async function textOnPage(page, text) {
  return page.evaluate((needle) => document.body.textContent.includes(needle), text);
}

async function runAgentLeg(label, theme, viewport, agentClaims) {
  safeLog(`-- ${label} | theme=${theme} | viewport=${viewport.width}x${viewport.height}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    colorScheme: theme,
    ignoreHTTPSErrors: true,
  });
  const consoleErrors = [];
  context.on('weberror', (e) => consoleErrors.push(`weberror: ${e.error().message}`));

  await setupBypassSession(context, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);

  const page = await context.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
  });

  const uniqueClient = `Taxonomy ${label} ${Date.now()}`;

  let result;
  try {
    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);

    await navigateToProspectInfoTab(page);
    await createPrepWithTaxonomy(page, uniqueClient);

    await hardReloadAndAwaitReady(page);
    await navigateToProspectInfoTab(page);
    await page.waitForTimeout(1500);

    const clientShown   = await textOnPage(page, uniqueClient);
    const sourceLabelOk = await textOnPage(page, 'Bank Referral (BOA)');
    const policyLabelOk = await textOnPage(page, 'Whole Life / Permanent');

    result = {
      label, theme, viewport,
      client: clientShown,
      source: sourceLabelOk,
      policy: policyLabelOk,
      consoleErrors: consoleErrors.length,
      errors: consoleErrors,
      uniqueClient,
    };
  } catch (err) {
    result = {
      label, theme, viewport, failure: err.message, consoleErrors: consoleErrors.length,
      errors: consoleErrors, uniqueClient,
    };
  } finally {
    await context.close();
    await browser.close();
  }
  safeLog(`   agent persist: client=${result.client} source=${result.source} policy=${result.policy} consoleErrors=${result.consoleErrors}${result.failure ? '  failure='+result.failure : ''}`);
  return result;
}

// Manager-read verification via Firestore REST. Proves the deployed rule's
// manager-read branch holds for a prep doc created with the new enum value.
// Label rendering covered by unit tests (ProspectInfoTab + ProspectInfoPanel
// share the PROSPECTING_SOURCE_LABELS + POLICY_TYPE_LABEL maps).
async function managerRestRead(agentClaims, agentUid, uniqueClient) {
  safeLog('-- manager REST read');
  const bm = await getIdTokenAndClaims(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
  const parent = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${agentClaims.tenantId}/users/${agentUid}`;
  const url    = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bm.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'prospectInfo' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'clientName' },
            op:    'EQUAL',
            value: { stringValue: uniqueClient },
          },
        },
        limit: 1,
      },
    }),
  });
  if (!resp.ok) {
    return { ok: false, status: resp.status };
  }
  const data = await resp.json();
  const doc  = Array.isArray(data) && data.find((r) => r.document)?.document;
  if (!doc) return { ok: false, reason: 'no doc returned' };
  const fields = doc.fields || {};
  return {
    ok:                true,
    status:            resp.status,
    prospectingSource: fields.prospectingSource?.stringValue,
    policyType:        fields.policyType?.stringValue,
  };
}

async function main() {
  safeLog('=== Track F Taxonomy (PR #252) Smoke ===');
  safeLog('Preview:', PREVIEW_URL);

  // Resolve agent claims once
  const agent = await getIdTokenAndClaims(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
  safeLog(`Agent UID: ${agent.uid}`);
  safeLog(`Tenant: ${agent.tenantId}`);

  const legs = [
    { label: 'light/desktop', theme: 'light', viewport: { width: 1280, height: 800 } },
    { label: 'dark/desktop',  theme: 'dark',  viewport: { width: 1280, height: 800 } },
    { label: 'light/mobile',  theme: 'light', viewport: { width: 390,  height: 844 } },
    { label: 'dark/mobile',   theme: 'dark',  viewport: { width: 390,  height: 844 } },
  ];

  const summaries = [];
  for (const cfg of legs) {
    summaries.push(await runAgentLeg(cfg.label, cfg.theme, cfg.viewport, agent));
  }

  // Pick the first successful agent leg's uniqueClient for the manager REST check
  const firstOk = summaries.find((s) => s.client && s.source && s.policy);
  let mgrResult = { ok: false, reason: 'no successful agent leg to verify' };
  if (firstOk) {
    mgrResult = await managerRestRead(agent, agent.uid, firstOk.uniqueClient);
  }

  safeLog('');
  safeLog('── Summary ────────────────────────────────────────────');
  let failed = 0;
  for (const s of summaries) {
    const pass = s.client && s.source && s.policy && s.consoleErrors === 0;
    const icon = pass ? '✓' : '✗';
    safeLog(`  ${icon} ${s.label}  client=${!!s.client} source=${!!s.source} policy=${!!s.policy} consoleErrors=${s.consoleErrors}${s.failure ? '  failure='+s.failure : ''}`);
    if (!pass) failed++;
  }
  safeLog('');
  safeLog(`  Manager REST read:  ok=${mgrResult.ok}  status=${mgrResult.status ?? 'n/a'}  source=${mgrResult.prospectingSource}  policy=${mgrResult.policyType}`);
  safeLog('───────────────────────────────────────────────────────');
  safeLog(`  ${summaries.length - failed}/${summaries.length} agent legs pass; manager REST ${mgrResult.ok ? 'ALLOW' : 'FAIL'}`);
  if (failed > 0 || !mgrResult.ok) process.exit(1);
}

main().catch((err) => {
  safeLog('FATAL', err.message);
  process.exit(1);
});

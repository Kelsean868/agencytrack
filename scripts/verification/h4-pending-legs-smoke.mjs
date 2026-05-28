/**
 * h4-pending-legs-smoke.mjs — Targeted re-run of H4 legs c/d/e/f only.
 *
 * Used to re-verify the aggregatePendingPlan CF after the Timestamp.now() hotfix.
 * Fresh planName "Smoke Pending Y-<ts>" prevents collision with prior smoke artifacts.
 *
 * Run:  node scripts/verification/h4-pending-legs-smoke.mjs
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
  selectReactOption,
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

const PROD_URL = 'https://agencytrack.vercel.app';
const TS           = Date.now();
const PENDING_NAME = `Smoke Pending Y-${TS}`;
const OWNER_C      = `Smoke-CY-${TS}`;

const results = [];
function pass(leg, note = '') { results.push({ leg, status: 'PASS', note }); safeLog(`  ✓ [${leg}] ${note}`); }
function fail(leg, note = '') { results.push({ leg, status: 'FAIL', note }); safeLog(`  ✗ [${leg}] ${note}`); }

async function loginAs(page, email, password) {
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  const emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible({ timeout: 5000 }).catch(() => false))) return;
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('input[type="email"]') === null,
    { timeout: 25000 }
  );
  await page.waitForTimeout(1200);
}

async function navToConfigTab(page) {
  const configTab = page.locator('[data-testid="nav-config"]');
  await configTab.waitFor({ state: 'visible', timeout: 15000 });
  await configTab.click();
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    { timeout: 20000 }
  );
  await page.waitForTimeout(600);
}

async function navToPolicyLedger(page) {
  const tab = page.locator('[data-testid="agent-tab-policy-ledger"]');
  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab.click();
  } else {
    await page.getByRole('button', { name: /more/i }).click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="agent-tab-policy-ledger"]').click();
  }
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    { timeout: 15000 }
  );
  await page.waitForTimeout(600);
}

async function main() {
  safeLog(`\n=== H4 Pending Legs (c/d/e/f) Targeted Smoke ===`);
  safeLog(`Target:       ${PROD_URL}`);
  safeLog(`Pending name: ${PENDING_NAME}`);
  safeLog(`Owner tag:    ${OWNER_C}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // ── Context A: Tenant Admin ───────────────────────────────────────────────
    const ctxTA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(ctxTA, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const pageTA = await ctxTA.newPage();
    await loginAs(pageTA, E.A11Y_TENANT_ADMIN_EMAIL, E.A11Y_TENANT_ADMIN_PASSWORD);
    safeLog('  TA logged in');

    // ── Context B: Agent ──────────────────────────────────────────────────────
    const ctxAgent = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(ctxAgent, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const pageAgent = await ctxAgent.newPage();
    await loginAs(pageAgent, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  Agent logged in');

    // ── LEG c: Agent "Other" path ─────────────────────────────────────────────
    safeLog('\n── Leg c: Agent enters "Other" → planName written ──');
    try {
      await navToPolicyLedger(pageAgent);
      await pageAgent.getByRole('button', { name: /new policy/i }).click();
      await pageAgent.waitForTimeout(800);

      const ownerNameInput = pageAgent.locator('#ownerName, input[name="ownerName"]');
      await ownerNameInput.waitFor({ timeout: 8000 });
      await ownerNameInput.fill(OWNER_C);

      const sameAsOwner = pageAgent.locator('label').filter({ hasText: /same as owner/i }).locator('input[type="checkbox"]');
      if (await sameAsOwner.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sameAsOwner.check();
        await pageAgent.waitForTimeout(300);
      }

      const premiumInput = pageAgent.locator('#proposedPremium');
      await premiumInput.waitFor({ timeout: 8000 });
      await premiumInput.fill('750');
      await pageAgent.waitForTimeout(400);

      await selectReactOption(pageAgent, pageAgent.locator('#sourceOfProspect'), 'referral');
      await pageAgent.waitForTimeout(200);

      const planPicker = pageAgent.locator('[data-testid="plan-picker-select"]');
      await planPicker.waitFor({ timeout: 10000 });
      await pageAgent.waitForTimeout(800);

      await selectReactOption(pageAgent, planPicker, '__other__');
      await pageAgent.waitForTimeout(400);

      const freeText = pageAgent.locator('[data-testid="plan-name-freetext"]');
      await freeText.waitFor({ timeout: 8000 });
      await freeText.fill(PENDING_NAME);

      await pageAgent.getByRole('button', { name: /save policy/i }).click();
      await pageAgent.locator('h2').filter({ hasText: /Policy Ledger/i }).waitFor({ timeout: 25000 });

      safeLog('  Policy saved. Waiting 15s for Cloud Function to run...');
      await pageAgent.waitForTimeout(15000);
      pass('c', `Policy with planName="${PENDING_NAME}" saved; CF given 15s`);
    } catch (err) {
      fail('c', err.message);
    }

    // ── LEG d: TA sees pending entry ──────────────────────────────────────────
    safeLog('\n── Leg d: TA checks Pending Review ──');
    try {
      await hardReloadAndAwaitReady(pageTA);
      await navToConfigTab(pageTA);

      const tileEl = pageTA.locator('[data-testid="plan-catalog-tile"]');
      await tileEl.waitFor({ timeout: 10000 });
      await tileEl.click();
      await pageTA.locator('[role="dialog"]').waitFor({ timeout: 10000 });
      await pageTA.waitForTimeout(400);

      const pendingTab = pageTA.getByRole('button', { name: 'Pending Review' });
      await pendingTab.waitFor({ timeout: 10000 });
      await pendingTab.click();
      await pageTA.waitForTimeout(500);

      let found = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        const row = await pageTA.locator('[data-testid^="pending-row-"]').filter({ hasText: PENDING_NAME }).count();
        if (row > 0) { found = true; break; }
        const domCheck = await pageTA.evaluate((name) => document.body.textContent.includes(name), PENDING_NAME);
        if (domCheck) { found = true; break; }
        safeLog(`  Not visible yet (attempt ${attempt + 1}/6) — waiting 5s...`);
        await pageTA.waitForTimeout(5000);
        await pendingTab.click();
        await pageTA.waitForTimeout(500);
      }

      if (found) {
        pass('d', `"${PENDING_NAME}" visible in Pending Review ✓`);
      } else {
        fail('d', `"${PENDING_NAME}" NOT found in Pending Review after retries`);
      }
    } catch (err) {
      fail('d', err.message);
    }

    // ── LEG e: TA approves ────────────────────────────────────────────────────
    safeLog('\n── Leg e: TA approves pending entry ──');
    try {
      const approveBtn = pageTA.locator(`[data-testid="approve-btn-${PENDING_NAME}"]`);
      if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await approveBtn.click();
      } else {
        const row = pageTA.locator('[data-testid^="pending-row-"]').filter({ hasText: PENDING_NAME });
        await row.getByRole('button', { name: /approve/i }).click();
      }
      await pageTA.waitForTimeout(500);

      // Promote form
      const promoteForm = pageTA.locator(`[data-testid="promote-form-${PENDING_NAME}"]`);
      if (await promoteForm.isVisible({ timeout: 5000 }).catch(() => false)) {
        const promoteSubmit = pageTA.locator(`[data-testid="promote-submit-${PENDING_NAME}"]`);
        if (await promoteSubmit.isVisible({ timeout: 5000 }).catch(() => false)) {
          await promoteSubmit.click();
        } else {
          await promoteForm.getByRole('button', { name: /approve|confirm|submit/i }).first().click();
        }
      } else {
        const row = pageTA.locator('[data-testid^="pending-row-"]').filter({ hasText: PENDING_NAME });
        await row.getByRole('button', { name: /confirm|approve|submit/i }).first().click();
      }
      await pageTA.waitForTimeout(1500);

      const stillPending = await pageTA.locator('[data-testid^="pending-row-"]')
        .filter({ hasText: PENDING_NAME }).count();

      if (stillPending === 0) {
        pass('e', `"${PENDING_NAME}" approved and removed from Pending Review ✓`);
      } else {
        fail('e', `"${PENDING_NAME}" still visible in Pending Review after approval`);
      }
    } catch (err) {
      fail('e', err.message);
    }

    // ── LEG f: Agent sees promoted plan in picker ─────────────────────────────
    safeLog('\n── Leg f: Agent sees promoted plan in picker ──');
    try {
      await hardReloadAndAwaitReady(pageAgent);
      await navToPolicyLedger(pageAgent);
      await pageAgent.getByRole('button', { name: /new policy/i }).click();
      await pageAgent.waitForTimeout(800);

      const planPicker = pageAgent.locator('[data-testid="plan-picker-select"]');
      await planPicker.waitFor({ timeout: 12000 });
      await pageAgent.waitForTimeout(1000);

      const options = await planPicker.locator('option').allInnerTexts();
      const found = options.some((o) => o.includes(PENDING_NAME));

      await pageAgent.getByRole('button', { name: /cancel|close|×/i }).first().click().catch(() => {});

      if (found) {
        pass('f', `"${PENDING_NAME}" appears in agent plan picker after promotion ✓`);
      } else {
        fail('f', `"${PENDING_NAME}" NOT in picker options: ${options.join(', ')}`);
      }
    } catch (err) {
      fail('f', err.message);
    }

    await ctxTA.close();
    await ctxAgent.close();

    // ── Summary ───────────────────────────────────────────────────────────────
    safeLog('\n══════════════════════════════════════════════════════════');
    safeLog('H4 Pending Legs (c/d/e/f) Smoke — Results');
    safeLog('══════════════════════════════════════════════════════════');
    for (const r of results) {
      safeLog(`  ${r.status === 'PASS' ? '✓' : '✗'} [${r.leg}] ${r.note}`);
    }
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    safeLog(`\nOverall: ${failed === 0 ? 'PASS' : 'FAIL'} — ${passed}/${results.length} legs passed`);
    if (failed > 0) process.exit(1);

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  safeLog('Fatal:', err.message);
  process.exit(1);
});

/**
 * h3-prod-smoke.mjs — Production smoke for H3 TZ fix (PR #375 + #377, main 32a22ce).
 *
 * Legs:
 *   1a: dateWritten + dateSubmitted defaults = today in TT
 *   1b: Agent creates policy, visible in ledger
 *   2:  Manager reconciliation panel loads for current month
 *
 * Run: node scripts/verification/h3-prod-smoke.mjs
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  safeLog,
  selectReactOption,
  captureConsoleAndNetwork,
  formatCaptureReport,
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
const TS = Date.now();

function getTodayTT() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date());
}

const TODAY_TT = getTodayTT();
const CURRENT_YEAR = parseInt(TODAY_TT.substring(0, 4), 10);
const CURRENT_MONTH_NUM = parseInt(TODAY_TT.substring(5, 7), 10);
const CURRENT_MONTH_LABEL = new Date(`${TODAY_TT.substring(0,7)}-15T12:00:00Z`)
  .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

const OWNER_NAME = `H3ProdSmoke-${TS}`;

const results = [];
function pass(leg, note = '') { results.push({ leg, status: 'PASS', note }); safeLog(`  ✓ [${leg}] ${note}`); }
function fail(leg, note = '') { results.push({ leg, status: 'FAIL', note }); safeLog(`  ✗ [${leg}] ${note}`); }

async function loginAs(page, email, password, capture) {
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  const emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible({ timeout: 8000 }).catch(() => false))) return;
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('input[type="email"]') === null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1500);
}

async function navToPolicyLedger(page) {
  const tab = page.locator('[data-testid="agent-tab-policy-ledger"]');
  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab.click();
  } else {
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(500);
    }
    await page.locator('[data-testid="agent-tab-policy-ledger"]').click();
  }
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    { timeout: 15000 }
  );
  await page.waitForTimeout(600);
}

async function main() {
  safeLog(`\n══════════════════════════════════════════════════════════`);
  safeLog(`H3 TZ Fix — Production Smoke  (${PROD_URL})`);
  safeLog(`SHA on main: 32a22ce`);
  safeLog(`Today (TT):  ${TODAY_TT}  |  Month: ${CURRENT_MONTH_LABEL} ${CURRENT_YEAR}`);
  safeLog(`══════════════════════════════════════════════════════════`);

  const browser = await chromium.launch({ headless: true });

  try {
    // ── Agent context ─────────────────────────────────────────────────────────
    const ctxAgent = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const captureAgent = captureConsoleAndNetwork(await ctxAgent.newPage());
    // Re-setup with bypass
    await ctxAgent.close();

    const ctxAgent2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(ctxAgent2, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const pageAgent = await ctxAgent2.newPage();
    const capture = captureConsoleAndNetwork(pageAgent);
    await loginAs(pageAgent, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, capture);
    safeLog('  Agent logged in ✓');

    // ── Leg 1a: date defaults ─────────────────────────────────────────────────
    safeLog(`\n── Leg 1a: Date input defaults (expect TT today = "${TODAY_TT}") ──`);
    try {
      await navToPolicyLedger(pageAgent);
      await pageAgent.getByRole('button', { name: /new policy/i }).click();
      await pageAgent.waitForTimeout(1000);

      const dateWritten   = await pageAgent.locator('#dateWritten, input[name="dateWritten"]').inputValue().catch(() => null);
      const dateSubmitted = await pageAgent.locator('#dateSubmitted, input[name="dateSubmitted"]').inputValue().catch(() => null);

      safeLog(`  dateWritten   = "${dateWritten}"  (expected "${TODAY_TT}")`);
      safeLog(`  dateSubmitted = "${dateSubmitted}"  (expected "${TODAY_TT}")`);

      const ok = dateWritten === TODAY_TT && dateSubmitted === TODAY_TT;
      if (ok) {
        pass('1a', `dateWritten="${dateWritten}" ✓  dateSubmitted="${dateSubmitted}" ✓`);
      } else {
        const d = [];
        if (dateWritten !== TODAY_TT)   d.push(`dateWritten="${dateWritten}" ≠ "${TODAY_TT}"`);
        if (dateSubmitted !== TODAY_TT) d.push(`dateSubmitted="${dateSubmitted}" ≠ "${TODAY_TT}"`);
        fail('1a', d.join('; '));
      }

      await pageAgent.getByRole('button', { name: /cancel|close/i }).first().click().catch(() => {});
      await pageAgent.waitForTimeout(400);
    } catch (err) {
      fail('1a', err.message);
    }

    // ── Leg 1b: Create policy, visible in ledger ──────────────────────────────
    safeLog(`\n── Leg 1b: Create policy "${OWNER_NAME}" ──`);
    try {
      await navToPolicyLedger(pageAgent);
      await pageAgent.getByRole('button', { name: /new policy/i }).click();
      await pageAgent.waitForTimeout(800);

      const ownerInput = pageAgent.locator('#ownerName, input[name="ownerName"]');
      await ownerInput.waitFor({ timeout: 10000 });
      await ownerInput.fill(OWNER_NAME);

      const sameAsOwner = pageAgent.locator('label').filter({ hasText: /same as owner/i }).locator('input[type="checkbox"]');
      if (await sameAsOwner.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sameAsOwner.check();
        await pageAgent.waitForTimeout(200);
      }

      const premiumInput = pageAgent.locator('#proposedPremium');
      await premiumInput.waitFor({ timeout: 8000 });
      await premiumInput.fill('1200');
      await pageAgent.waitForTimeout(300);

      await selectReactOption(pageAgent, pageAgent.locator('#sourceOfProspect'), 'referral');
      await pageAgent.waitForTimeout(300);

      const planPicker = pageAgent.locator('[data-testid="plan-picker-select"]');
      await planPicker.waitFor({ timeout: 10000 });
      await pageAgent.waitForTimeout(600);
      // Get first real plan's option VALUE attribute (text ≠ value for plan picker)
      const planOptionValue = await planPicker.evaluate((sel) => {
        const opts = [...sel.querySelectorAll('option')];
        const real = opts.find(o => o.value && o.value !== '' && o.value !== '__other__' && !o.textContent.includes('Select'));
        return real?.value ?? '__other__';
      });
      safeLog(`  Plan option value: "${planOptionValue}"`);
      await selectReactOption(pageAgent, planPicker, planOptionValue);

      await pageAgent.getByRole('button', { name: /save policy/i }).click();
      await pageAgent.locator('h2').filter({ hasText: /Policy Ledger/i }).waitFor({ timeout: 30000 });
      await pageAgent.waitForTimeout(1000);

      const visible = await pageAgent.evaluate((name) => document.body.textContent.includes(name), OWNER_NAME);
      if (visible) {
        pass('1b', `Policy "${OWNER_NAME}" visible in ledger ✓`);
      } else {
        fail('1b', `Policy "${OWNER_NAME}" not found in ledger`);
      }
    } catch (err) {
      fail('1b', err.message);
    }

    safeLog(formatCaptureReport(capture));
    await ctxAgent2.close();

    // ── Manager context ───────────────────────────────────────────────────────
    safeLog(`\n── Leg 2: Manager reconciliation panel — ${CURRENT_MONTH_LABEL} ${CURRENT_YEAR} ──`);
    const ctxMgr = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(ctxMgr, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const pageMgr = await ctxMgr.newPage();
    const captureMgr = captureConsoleAndNetwork(pageMgr);
    await loginAs(pageMgr, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD, captureMgr);
    safeLog('  Manager logged in ✓');

    try {
      // Navigate to reconciliation panel
      let reconReached = false;
      const reconTab = pageMgr.locator('[data-testid="manager-tab-reconciliation"], [data-testid*="reconciliation"]');
      if (await reconTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await reconTab.click();
        reconReached = true;
      }
      if (!reconReached) {
        const moreBtn = pageMgr.getByRole('button', { name: /^more$/i });
        if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await moreBtn.click();
          await pageMgr.waitForTimeout(500);
        }
        const reconLink = pageMgr.getByRole('button', { name: /reconcil|policy.*ledger/i }).first();
        if (await reconLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          await reconLink.click();
          reconReached = true;
        }
      }
      if (!reconReached) {
        // Last resort: URL-based nav
        await pageMgr.goto(`${PROD_URL}/#reconciliation`, { waitUntil: 'domcontentloaded' });
        await pageMgr.waitForTimeout(1000);
      }

      await pageMgr.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 15000 });
      await pageMgr.waitForTimeout(800);

      // Set year/month to current period if pickers present
      const yearSel = pageMgr.locator('select').filter({ hasText: new RegExp(String(CURRENT_YEAR)) }).first();
      if (await yearSel.isVisible({ timeout: 3000 }).catch(() => false)) {
        await yearSel.selectOption(String(CURRENT_YEAR));
        await pageMgr.waitForTimeout(300);
      }
      const monthSel = pageMgr.locator('select').filter({ hasText: CURRENT_MONTH_LABEL }).first();
      if (await monthSel.isVisible({ timeout: 3000 }).catch(() => false)) {
        await monthSel.selectOption(String(CURRENT_MONTH_NUM));
        await pageMgr.waitForTimeout(500);
      }

      await pageMgr.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 10000 });
      const bodyText = await pageMgr.evaluate(() => document.body.textContent);
      const hasMonth = bodyText.includes(CURRENT_MONTH_LABEL) || bodyText.includes(String(CURRENT_YEAR));

      if (hasMonth) {
        pass('2', `Reconciliation panel loaded for ${CURRENT_MONTH_LABEL} ${CURRENT_YEAR} ✓`);
      } else {
        fail('2', `Panel body did not include "${CURRENT_MONTH_LABEL}" or "${CURRENT_YEAR}"`);
      }
    } catch (err) {
      fail('2', err.message);
    }

    safeLog(formatCaptureReport(captureMgr));
    await ctxMgr.close();

  } finally {
    await browser.close();
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  safeLog('\n══════════════════════════════════════════════════════════');
  safeLog('H3 Prod Smoke — Results');
  safeLog('══════════════════════════════════════════════════════════');
  for (const r of results) {
    safeLog(`  ${r.status === 'PASS' ? '✓' : '✗'} [${r.leg}] ${r.note}`);
  }
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed  = results.filter(r => r.status === 'FAIL').length;
  safeLog(`\nOverall: ${failed === 0 ? '✅ PASS' : '❌ FAIL'} — ${passed}/${results.length} legs passed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  safeLog('Fatal:', err.message);
  process.exit(1);
});

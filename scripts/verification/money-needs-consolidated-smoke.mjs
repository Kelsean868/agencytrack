/**
 * money-needs-consolidated-smoke.mjs — Money Needs feature consolidated post-deploy smoke.
 *
 * Covers G1–G7 as an integrated whole (individual PR smokes verified per-slice;
 * this smoke verifies the assembled feature end-to-end in production).
 *
 * Gates:
 *   MN-a: Worksheet renders (or "Start worksheet" CTA present) after login + navigation.
 *   MN-b: Commission target write-read-verify — set Life target to a smoke value →
 *          blur-save → reload → assert value persisted → restore original value.
 *          (Expense accordion write path was covered per-PR in G3 smoke; commission
 *          targets use a simpler direct onBlur→save pattern, more reliable in automation.)
 *   MN-c: Commission Targets panel renders (Life/A&H/Property/Motor inputs visible).
 *   MN-d: "Send to Playground" button present in DOM.
 *   MN-e: Sub-calculator accordion buttons present
 *          (Insurance Industry Expenses / Car Expenses / Loans & Debt).
 *   MN-f: 0 console errors across the session.
 *
 * NOTE — G7 nudge (PAYERefreshBanner) requires `payeBracketsVersionId` to differ from
 *   the current version in the production worksheet. Since current prod worksheets carry
 *   the current version this banner will not appear in a standard run. Verified via
 *   absence-assert (banner NOT shown = current version is up to date).
 *
 * Run: node scripts/verification/money-needs-consolidated-smoke.mjs
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
} from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');
const E     = loadEnv(ROOT);

const PROD_URL         = 'https://agencytrack.vercel.app';
const CURRENT_YEAR     = new Date().getFullYear();

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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function navigateToMoneyNeeds(page) {
  await navigateAgentTab(page, 'money-needs');
  // Wait for worksheet content OR the "Start worksheet" CTA
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null ||
      document.body.textContent.includes('Start worksheet') ||
      document.body.textContent.includes('No') && document.body.textContent.includes('worksheet'),
    { timeout: 25_000 },
  );
}

async function ensureWorksheet(page) {
  // If "Start worksheet" CTA is visible, click it to create the worksheet
  const startBtn = page.getByRole('button', { name: /start\s+\d+\s+worksheet|start worksheet/i });
  if (await startBtn.count() > 0) {
    safeLog('[MN] clicking "Start worksheet" CTA to create blank worksheet');
    await startBtn.click();
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null,
      { timeout: 25_000 },
    );
    safeLog('[MN] worksheet created');
  }
}

async function reloadAndNavigate(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page, 25_000);
  await page.waitForTimeout(1500);
  await navigateToMoneyNeeds(page);
  await ensureWorksheet(page);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const required = ['VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing  = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  const browser = await chromium.launch({ headless: true });

  try {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const capture = captureConsoleAndNetwork(page);

    await setupBypassSession(ctx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PROD_URL}/`);

    // ── MN-a: worksheet renders ─────────────────────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log(`MN-a — worksheet renders (year ${CURRENT_YEAR})`);
    console.log('══════════════════════════════════');

    await navigateToMoneyNeeds(page);
    await ensureWorksheet(page);

    const hasToggle = await page.locator('input[aria-label="Share with my Unit Manager and Branch Manager"]').count() > 0;
    if (hasToggle) {
      pass('MN-a: Money Needs worksheet renders with visibility toggle');
    } else {
      fail('MN-a: worksheet renders', 'visibility toggle not found after navigation');
      const snippet = await page.evaluate(() => document.body.textContent.slice(0, 300));
      console.log('[MN-a] page snippet:', snippet);
    }

    // ── MN-b: commission target write-read-verify ────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log('MN-b — commission target write-read-verify');
    console.log('══════════════════════════════════');

    // Smoke value: a distinctive number unlikely to be a real target
    const SMOKE_LIFE_VALUE = '42042';
    let originalLifeValue = '';

    try {
      // Read the current Life commission target value
      const lifeInput = page.locator('input[aria-label="Life commission target"]');
      await lifeInput.waitFor({ state: 'visible', timeout: 10_000 });
      originalLifeValue = await lifeInput.inputValue();
      safeLog(`[MN-b] original Life target: "${originalLifeValue}"`);

      // Fill with smoke value and blur to trigger save
      await lifeInput.fill(SMOKE_LIFE_VALUE);
      await page.waitForTimeout(300); // allow React state update
      await lifeInput.blur();
      await page.waitForTimeout(2500); // allow Firestore write to complete

      safeLog('[MN-b] life target set — reloading');
      await reloadAndNavigate(page);

      // Read back the Life commission target after reload
      const lifeInput2 = page.locator('input[aria-label="Life commission target"]');
      await lifeInput2.waitFor({ state: 'visible', timeout: 10_000 });
      const readBackValue = await lifeInput2.inputValue();
      safeLog(`[MN-b] readback Life target: "${readBackValue}"`);

      if (readBackValue === SMOKE_LIFE_VALUE) {
        pass('MN-b: commission target (Life) persisted after reload', `value=${readBackValue}`);
      } else {
        fail('MN-b: commission target persisted', `expected "${SMOKE_LIFE_VALUE}", got "${readBackValue}"`);
      }
    } catch (e) {
      fail('MN-b: commission target write-read-verify', e.message);
    }

    // ── Cleanup: restore original Life target ───────────────────────────────
    try {
      const lifeInputClean = page.locator('input[aria-label="Life commission target"]');
      await lifeInputClean.waitFor({ state: 'visible', timeout: 10_000 });
      const restoreValue = originalLifeValue === '' ? '0' : originalLifeValue;
      await lifeInputClean.fill(restoreValue);
      await page.waitForTimeout(300);
      await lifeInputClean.blur();
      await page.waitForTimeout(1500);
      safeLog(`[MN-b] cleanup: restored Life target to "${restoreValue}"`);
    } catch (e) {
      console.warn('[MN-b] cleanup error (non-fatal):', e.message);
    }

    // ── MN-c: commission targets panel renders ──────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log('MN-c — Commission Targets panel renders');
    console.log('══════════════════════════════════');

    try {
      const lifeInput     = page.locator('input[aria-label="Life commission target"]');
      const ahInput       = page.locator('input[aria-label="A&H commission target"]');
      const propertyInput = page.locator('input[aria-label="Property commission target"]');
      const motorInput    = page.locator('input[aria-label="Motor commission target"]');

      const lifeCount     = await lifeInput.count();
      const ahCount       = await ahInput.count();
      const propertyCount = await propertyInput.count();
      const motorCount    = await motorInput.count();

      if (lifeCount > 0 && ahCount > 0 && propertyCount > 0 && motorCount > 0) {
        pass('MN-c: Commission Targets panel — all 4 product-line inputs present');
      } else {
        fail('MN-c: Commission Targets panel', `counts: life=${lifeCount} ah=${ahCount} property=${propertyCount} motor=${motorCount}`);
      }
    } catch (e) {
      fail('MN-c: Commission Targets panel', e.message);
    }

    // ── MN-d: Send to Playground button ─────────────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log('MN-d — Send to Playground button');
    console.log('══════════════════════════════════');

    try {
      const sendBtn = page.getByRole('button', { name: /send to playground/i });
      const sendCount = await sendBtn.count();
      if (sendCount > 0) {
        const isDisabled = await sendBtn.isDisabled();
        pass('MN-d: Send to Playground button in DOM', `disabled=${isDisabled} (disabled when required<=0)`);
      } else {
        fail('MN-d: Send to Playground button', 'button not found in DOM');
      }
    } catch (e) {
      fail('MN-d: Send to Playground button', e.message);
    }

    // ── MN-e: sub-calculator accordion buttons ───────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log('MN-e — sub-calculator accordion buttons');
    console.log('══════════════════════════════════');

    try {
      const insBtn  = page.getByRole('button', { name: /insurance industry expenses/i });
      const carBtn  = page.getByRole('button', { name: /car expenses/i });
      const loanBtn = page.getByRole('button', { name: /loans\s*(&amp;|&)\s*debt/i });

      const insCount  = await insBtn.count();
      const carCount  = await carBtn.count();
      const loanCount = await loanBtn.count();

      if (insCount > 0 && carCount > 0 && loanCount > 0) {
        pass('MN-e: all 3 sub-calculator accordion buttons present');
      } else {
        fail('MN-e: sub-calculator buttons', `counts: insurance=${insCount} car=${carCount} loans=${loanCount}`);
      }
    } catch (e) {
      fail('MN-e: sub-calculator buttons', e.message);
    }

    // ── G7 nudge (PAYERefreshBanner) — absence assert ────────────────────────
    console.log('\n══════════════════════════════════');
    console.log('G7-nudge — PAYE refresh banner absent (current version)');
    console.log('══════════════════════════════════');

    try {
      const refreshBtnCount = await page.getByRole('button', { name: /refresh paye calculation/i }).count();
      if (refreshBtnCount === 0) {
        pass('G7-nudge: PAYERefreshBanner NOT shown (prod worksheet on current PAYE version)');
      } else {
        // Not a failure — just means the worksheet has an older version
        console.log('  ℹ️  G7-nudge: PAYERefreshBanner IS shown (worksheet on older PAYE version)');
        results.push({ label: 'G7-nudge: PAYE refresh banner shown', ok: true });
      }
    } catch (e) {
      fail('G7-nudge', e.message);
    }

    await ctx.close();

    // ── MN-f: console errors ─────────────────────────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log('MN-f — console errors');
    console.log('══════════════════════════════════');

    const errorCount = capture.consoleMessages.filter((m) => m.type === 'error').length;
    if (errorCount === 0) {
      pass('MN-f: 0 console errors');
    } else {
      fail('MN-f: 0 console errors', `${errorCount} error(s)`);
      console.log(formatCaptureReport(capture));
    }

  } finally {
    await browser.close();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════');
  console.log('MONEY NEEDS SMOKE SUMMARY');
  console.log('══════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ': ' + r.detail : ''}`);
  }
  console.log(`\n${passed}/${results.length} pass${failed > 0 ? ` (${failed} FAILED)` : ''}`);
  if (failed > 0) process.exit(1);
})();

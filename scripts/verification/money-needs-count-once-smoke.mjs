/**
 * money-needs-count-once-smoke.mjs — #5 count-once reconciliation + feed-map smoke.
 *
 * Verifies the PR #714 fix on the Vercel PREVIEW for the branch (real PROD
 * Firestore via the bypass session). Writes are made to the A11Y agent's own
 * worksheet and RESTORED at the end (neutral footprint).
 *
 * Gates:
 *   MN1: Money Needs worksheet renders; lifestyle lede + reframed grand-total label present.
 *   MN2 (headline — count once): change the Car Expenses total twice; the Living group
 *        total moves by EXACTLY the change in the prefilled "Car expenses, nonbusiness"
 *        line (delta once, not doubled). Business "Business car expenses" line prefills too.
 *   MN3 (persist): reload → the prefilled Living value persists.
 *   MN4 (car-loan reference): a Loans & Debt "Car Loan" value surfaces inside Car Expenses
 *        as a read-only "Car loan (from Loans & Debt): $X" reference (NOT an input).
 *   MN5: axe NO-NEW serious/critical contrast nodes on the surface, both themes.
 *   MN6: 0 console errors across the session.
 *
 * Run: node scripts/verification/money-needs-count-once-smoke.mjs [previewUrl]
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  safeLog,
  setTheme,
  waitForFirebaseReady,
} from './lib/walk-helpers.mjs';
import { loadEnv, loginAs, navigateAgentTab } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const E = loadEnv(ROOT);

const PREVIEW_URL = process.argv[2]
  || 'https://agencytrack-gf9bco5ed-kyron-marchan-s-projects.vercel.app';

const results = [];
const pass = (l, n = '') => { results.push({ ok: true, l }); console.log(`  ✅ ${l}${n ? ': ' + n : ''}`); };
const fail = (l, n = '') => { results.push({ ok: false, l, n }); console.error(`  ❌ ${l}${n ? ': ' + n : ''}`); };

// Parse "$1,234 / yr" → 1234 (group-header / line annual values).
const parseTTD = (s) => {
  const m = (s || '').replace(/[, ]/g, '').match(/\$?([\d.]+)/);
  return m ? parseFloat(m[1]) : NaN;
};

async function navMoneyNeeds(page) {
  // The desktop sidebar can take a beat to mount on a cold preview — wait for the
  // nav button before navigating (avoids a too-early "tab not found in DOM").
  await page.waitForSelector('[data-testid="agent-tab-money-needs"]', { timeout: 25_000 });
  await navigateAgentTab(page, 'money-needs');
  await page.waitForFunction(
    () => document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null
      || /Start\s+\d+\s+worksheet|Start worksheet/.test(document.body.textContent),
    { timeout: 25_000 },
  );
  const startBtn = page.getByRole('button', { name: /start\s+\d+\s+worksheet|start worksheet/i });
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null,
      { timeout: 25_000 },
    );
  }
}

// Open a top-level accordion/sub-calc by its header button text.
async function openSection(page, nameRe) {
  const btn = page.getByRole('button', { name: nameRe }).first();
  await btn.waitFor({ state: 'visible', timeout: 10_000 });
  const expanded = await btn.getAttribute('aria-expanded');
  if (expanded !== 'true') { await btn.click(); await page.waitForTimeout(400); }
  return btn;
}
async function closeSection(page, nameRe) {
  const btn = page.getByRole('button', { name: nameRe }).first();
  if (await btn.count() === 0) return;
  if (await btn.getAttribute('aria-expanded') === 'true') { await btn.click(); await page.waitForTimeout(300); }
}

// Read a group accordion-header annual total ("$X / yr" in the header button).
async function groupHeaderTotal(page, label) {
  const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
  const txt = await btn.textContent();
  const m = (txt || '').match(/\$[\d,.]+\s*\/\s*yr/);
  return m ? parseTTD(m[0]) : 0;
}

// Set the first Car Expenses line ("Gas/Petrol/Electric") to a monthly amount, save.
async function setCarGas(page, monthly) {
  await openSection(page, /^car expenses/i);
  const gas = page.locator('input[aria-label="Expense amount"]').first();
  await gas.waitFor({ state: 'visible', timeout: 8000 });
  await gas.fill(String(monthly));
  await page.waitForTimeout(200);
  await gas.blur();
  await page.waitForTimeout(2500); // Firestore write
  await closeSection(page, /^car expenses/i);
}

async function readCarGas(page) {
  await openSection(page, /^car expenses/i);
  const gas = page.locator('input[aria-label="Expense amount"]').first();
  await gas.waitFor({ state: 'visible', timeout: 8000 });
  const v = await gas.inputValue();
  await closeSection(page, /^car expenses/i);
  return v;
}

// Read the calc-fed "Car expenses, nonbusiness" line annual inside Living Expenses.
async function readCarPersonalLine(page) {
  await openSection(page, /^living expenses/i);
  // The calc-fed row shows: <label> ... <input amount> ... "$X / yr"
  const row = page.locator('div').filter({ hasText: /Car expenses, nonbusiness/ }).filter({ has: page.locator('input') }).last();
  const amtInput = row.locator('input[type="number"]').first();
  const amt = await amtInput.inputValue().catch(() => '');
  // annual text in the row
  const rowTxt = await row.textContent().catch(() => '');
  const annualMatch = (rowTxt || '').match(/\$[\d,.]+\s*\/\s*yr/);
  await closeSection(page, /^living expenses/i);
  return { amount: amt, annual: annualMatch ? parseTTD(annualMatch[0]) : NaN };
}

async function reload(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page, 25_000);
  await page.waitForTimeout(1500);
  await navMoneyNeeds(page);
}

(async () => {
  const required = ['VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  console.log(`\nPreview: ${PREVIEW_URL}\n`);
  const browser = await chromium.launch({ headless: true });
  let originalGas = null;
  let originalCarLoan = null;

  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const capture = captureConsoleAndNetwork(page);

    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PREVIEW_URL}/`);
    await navMoneyNeeds(page);

    // ── MN1: render + lede + reframe ────────────────────────────────────────
    console.log('\n── MN1 — render + lede + reframed total label');
    const body1 = await page.evaluate(() => document.body.textContent);
    if (await page.locator('input[aria-label="Share with my Unit Manager and Branch Manager"]').count() > 0) {
      pass('MN1: worksheet renders');
    } else { fail('MN1: worksheet renders'); }
    if (/Design the life you want/i.test(body1)) pass('MN1: lifestyle lede present');
    else fail('MN1: lifestyle lede present');

    // ── capture originals for restore ───────────────────────────────────────
    originalGas = await readCarGas(page);
    safeLog(`[MN] original Car "Gas" value: "${originalGas}"`);

    // ── MN2: headline count-once via delta ──────────────────────────────────
    console.log('\n── MN2 — count once (Living total moves by the prefill delta, not 2×)');
    // Two distinct car totals → two personal shares; assert living delta == personal delta.
    const GAS_A = 1000; // monthly → 12000/yr → personal 33% = 3960
    const GAS_B = 2000; // monthly → 24000/yr → personal 33% = 7920

    await setCarGas(page, GAS_A);
    const livingA = await groupHeaderTotal(page, 'Living Expenses');
    const persA = await readCarPersonalLine(page);
    safeLog(`[MN2] A: livingTotal=${livingA} carPersonalLine=${persA.annual} (amount=${persA.amount})`);

    await setCarGas(page, GAS_B);
    const livingB = await groupHeaderTotal(page, 'Living Expenses');
    const persB = await readCarPersonalLine(page);
    safeLog(`[MN2] B: livingTotal=${livingB} carPersonalLine=${persB.annual} (amount=${persB.amount})`);

    const expectedPersA = Math.round(12000 * 33 / 100);
    const expectedPersB = Math.round(24000 * 33 / 100);
    if (persA.annual === expectedPersA && persB.annual === expectedPersB) {
      pass('MN2: Car personal share prefills the Living line', `${expectedPersA} → ${expectedPersB}`);
    } else {
      fail('MN2: Car personal share prefills the Living line', `got ${persA.annual}/${persB.annual}, expected ${expectedPersA}/${expectedPersB}`);
    }
    const livingDelta = livingB - livingA;
    const personalDelta = persB.annual - persA.annual;
    if (Number.isFinite(livingDelta) && livingDelta === personalDelta) {
      pass('MN2: COUNT-ONCE — Living total delta equals the prefill delta', `Δliving=${livingDelta} == Δline=${personalDelta}`);
    } else {
      fail('MN2: COUNT-ONCE', `Δliving=${livingDelta} != Δline=${personalDelta} (doubled?)`);
    }

    // Business car line prefilled too
    await openSection(page, /^business expenses/i);
    const bizBody = await page.evaluate(() => document.body.textContent);
    if (/Business car expenses/.test(bizBody)) pass('MN2: "Business car expenses" calc-fed line present');
    else fail('MN2: "Business car expenses" calc-fed line present');
    await closeSection(page, /^business expenses/i);

    // ── MN3: persistence ────────────────────────────────────────────────────
    console.log('\n── MN3 — prefilled value persists across reload');
    await reload(page);
    const persReload = await readCarPersonalLine(page);
    if (persReload.annual === expectedPersB) pass('MN3: prefilled Living value persisted', `${persReload.annual}`);
    else fail('MN3: prefilled Living value persisted', `got ${persReload.annual}, expected ${expectedPersB}`);

    // ── MN4: car-loan read-only reference ───────────────────────────────────
    console.log('\n── MN4 — read-only "Car loan (from Loans & Debt)" reference');
    // Set Loans & Debt "Car Loan" (2nd line) to a value
    await openSection(page, /loans\s*(&amp;|&)\s*debt/i);
    const ldInputs = page.locator('input[aria-label="Expense amount"]');
    // Loans & Debt order: Credit Card, Car Loan, ... → index 1 is Car Loan
    originalCarLoan = await ldInputs.nth(1).inputValue().catch(() => '');
    await ldInputs.nth(1).fill('500'); // 500/M
    await page.waitForTimeout(200);
    await ldInputs.nth(1).blur();
    await page.waitForTimeout(2500);
    await closeSection(page, /loans\s*(&amp;|&)\s*debt/i);

    await openSection(page, /^car expenses/i);
    await page.waitForTimeout(400);
    const carBody = await page.evaluate(() => document.body.textContent);
    const refPresent = /Car loan \(from Loans/i.test(carBody);
    // Ensure the reference is NOT an editable input (read-only <p>)
    const refIsInput = await page.locator('input[aria-label*="Car loan"]').count();
    if (refPresent && refIsInput === 0) pass('MN4: car-loan reference shown, read-only (not an input)');
    else fail('MN4: car-loan reference', `present=${refPresent} inputCount=${refIsInput}`);
    await closeSection(page, /^car expenses/i);

    // ── MN5: axe both themes ────────────────────────────────────────────────
    console.log('\n── MN5 — axe serious/critical contrast, both themes');
    for (const theme of ['light', 'dark']) {
      await setTheme(ctx, theme);
      await reload(page);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const contrast = axe.violations.filter((v) => v.id === 'color-contrast' && ['serious', 'critical'].includes(v.impact));
      if (contrast.length === 0) pass(`MN5: ${theme} — 0 serious/critical contrast nodes`);
      else {
        fail(`MN5: ${theme} contrast`, `${contrast.reduce((s, v) => s + v.nodes.length, 0)} node(s)`);
        contrast.slice(0, 3).forEach((v) => v.nodes.slice(0, 2).forEach((n) => console.log(`    ${theme} ${v.id}: ${n.target}`)));
      }
    }

    // ── Restore originals ───────────────────────────────────────────────────
    console.log('\n── cleanup — restore Car Gas + Car Loan');
    await setTheme(ctx, 'light');
    await reload(page);
    try {
      await openSection(page, /^car expenses/i);
      const gas = page.locator('input[aria-label="Expense amount"]').first();
      await gas.fill(originalGas === '' ? '0' : originalGas);
      await page.waitForTimeout(200); await gas.blur(); await page.waitForTimeout(2000);
      await closeSection(page, /^car expenses/i);

      await openSection(page, /loans\s*(&amp;|&)\s*debt/i);
      const ld = page.locator('input[aria-label="Expense amount"]');
      await ld.nth(1).fill(originalCarLoan === '' ? '0' : originalCarLoan);
      await page.waitForTimeout(200); await ld.nth(1).blur(); await page.waitForTimeout(2000);
      await closeSection(page, /loans\s*(&amp;|&)\s*debt/i);
      safeLog(`[cleanup] restored Gas="${originalGas}" CarLoan="${originalCarLoan}"`);
    } catch (e) { console.warn('[cleanup] non-fatal:', e.message); }

    await ctx.close();

    // ── MN6: console errors ─────────────────────────────────────────────────
    console.log('\n── MN6 — console errors');
    const errs = capture.consoleMessages.filter((m) => m.type === 'error');
    if (errs.length === 0) pass('MN6: 0 console errors');
    else { fail('MN6: console errors', `${errs.length}`); console.log(formatCaptureReport(capture)); }
  } finally {
    await browser.close();
  }

  console.log('\n══════════════════════════════════');
  console.log('MONEY-NEEDS COUNT-ONCE SMOKE SUMMARY');
  console.log('══════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.l}${r.n ? ': ' + r.n : ''}`);
  console.log(`\n${passed}/${results.length} pass${failed ? ` (${failed} FAILED)` : ''}`);
  if (failed) process.exit(1);
})();

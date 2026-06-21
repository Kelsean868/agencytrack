/**
 * gameplan-auto-distribute-smoke.mjs — value-asserting smoke for feedback-#9.
 *
 * Proves the reworked "Fill empty months" (auto-distribute) button on Game Plan
 * Step 3 (MonthlyPlanModal):
 *   - clearing months to 0 + clicking refills ONLY the cleared months, evenly;
 *   - every other (typed) month is preserved;
 *   - the plan reconciles to the annual anchor (balance pill shows ✓).
 *
 * This asserts the resulting month VALUES (not selector-only), per the brief.
 *
 * Target: Vercel preview via setupBypassSession (bare URLs after handshake).
 *   SMOKE_PREVIEW_URL must be the PR's preview alias.
 * Auth: A11Y_AGENT_* (dedicated smoke account; not the production tenant).
 *
 * Legs: Light desktop (core write-read-verify of the numbers) + Dark desktop
 * (render + same assertion). Each leg uses its own bypassed context.
 */

import { readFileSync } from 'fs';
import { chromium } from 'playwright';
import {
  setupBypassSession, setTheme, loginAs,
  installGlobalTimeout, finishSmoke, stamp,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const lines = readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const m = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* rely on shell env */ }
}
loadEnv();

const BASE  = process.env.SMOKE_PREVIEW_URL?.replace(/\/+$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS  = process.env.A11Y_AGENT_PASSWORD;

if (!BASE || !TOKEN || !EMAIL || !PASS) {
  console.error('✗ Missing SMOKE_PREVIEW_URL / VERCEL_BYPASS_TOKEN / A11Y_AGENT_* — aborting');
  process.exit(1);
}

const results = [];
const rec = (leg, passed, detail = '') => {
  console.log(`${stamp()} ${passed ? '✓' : '✗'} ${leg}${detail ? ` — ${detail}` : ''}`);
  results.push({ leg, passed, detail });
};

const clearTimer = installGlobalTimeout(300_000, () =>
  results.push({ leg: 'global', passed: false, detail: 'global timeout' }));

async function openGamePlan(page) {
  await page.getByTestId('agent-tab-game-plan').click();
  await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

const step3 = (page) =>
  page.getByTestId('game-plan-rail').locator('button').filter({ hasText: /Monthly Plan/i });

/** Port of the canonical ensureYearPlan flow (monthly-plan-smoke.mjs) — sets a
 *  minimal Year Plan so MonthlyPlanModal reaches the 'allocating' phase. */
async function ensureYearPlan(page) {
  const step2 = page.getByTestId('game-plan-rail').locator('button').filter({ hasText: /Year Plan/i });
  if (!await step2.isVisible().catch(() => false)) return false;
  await step2.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && d.querySelectorAll('button').length >= 2;
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);

  const composite = page.locator('[role="dialog"] button').filter({ hasText: 'Composite' });
  if (await composite.isVisible({ timeout: 1000 }).catch(() => false)) {
    await composite.click();
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')];
      const hasScratch = btns.some(b => b.textContent.trim() === 'Enter from scratch');
      const hasInput = !!document.querySelector('[role="dialog"] input[type="number"]');
      return hasScratch || hasInput;
    }, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  const scratch = page.locator('[role="dialog"] button').filter({ hasText: 'Enter from scratch' });
  if (await scratch.isVisible({ timeout: 1000 }).catch(() => false)) {
    await scratch.click(); await page.waitForTimeout(500);
  }
  const direct = page.locator('[role="dialog"] button').filter({ hasText: 'Direct $' });
  if (await direct.isVisible({ timeout: 5000 }).catch(() => false)) {
    await direct.click(); await page.waitForTimeout(400);
  }
  const firstInput = page.locator('[role="dialog"] input[type="number"]').first();
  try {
    await firstInput.waitFor({ state: 'visible', timeout: 8000 });
    await firstInput.fill('120000');
  } catch {
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }
  const save = page.locator('[role="dialog"] button').filter({ hasText: /save draft/i });
  await save.waitFor({ state: 'visible', timeout: 5000 });
  await save.click();
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
  await openGamePlan(page);
  return true;
}

/** Open Monthly Plan in the 'allocating' phase; sets up a Year Plan first if needed. */
async function openAllocating(page) {
  await step3(page).click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
  await page.waitForTimeout(2000);
  const noYearPlan = await page.locator('[data-testid="no-yearplan-state"]')
    .isVisible({ timeout: 1000 }).catch(() => false);
  if (noYearPlan) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const ok = await ensureYearPlan(page);
    if (!ok) return false;
    await step3(page).click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
    await page.waitForTimeout(2000);
  }
  // Confirm allocating: month inputs present.
  return (await page.locator('[role="dialog"] input[type="number"]').count()) > 0;
}

async function runLeg(browser, theme) {
  const tag = `Leg ${theme}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, BASE, TOKEN);
    await setTheme(ctx, theme);
    const page = await ctx.newPage();

    await loginAs(page, BASE, EMAIL, PASS);
    rec(`${tag} — login + dashboard`, true);

    await openGamePlan(page);
    const allocating = await openAllocating(page);
    if (!allocating) { rec(`${tag} — reached allocating phase`, false, 'no month inputs / year-plan setup failed'); await ctx.close(); return; }
    rec(`${tag} — Monthly Plan allocating`, true);

    const dialog = page.locator('[role="dialog"]');
    const inputs = dialog.locator('input[type="number"]');
    const pill = page.locator('[data-testid="balance-pill"]');
    const fillBtn = page.getByTestId('auto-distribute-btn');

    // Deterministic baseline: reset to an even split.
    const resetBtn = dialog.locator('button').filter({ hasText: /reset to even/i });
    await resetBtn.click();
    await page.waitForTimeout(400);

    const n = await inputs.count();
    if (n < 2) { rec(`${tag} — ≥2 editable months`, false, `found ${n}`); await ctx.close(); return; }

    const base = [];
    for (let i = 0; i < n; i++) base.push(parseFloat(await inputs.nth(i).inputValue()) || 0);

    const pillEven = (await pill.textContent()) || '';
    rec(`${tag} — even baseline balanced (✓)`, pillEven.includes('✓'), `pill "${pillEven.trim()}"`);

    // Clear the last two editable months → under-allocated (button should enable).
    await inputs.nth(n - 1).fill('0');
    await inputs.nth(n - 2).fill('0');
    await page.waitForTimeout(200);

    const pillCleared = (await pill.textContent()) || '';
    rec(`${tag} — clearing 2 months unbalances (no ✓)`, !pillCleared.includes('✓'), `pill "${pillCleared.trim()}"`);

    const btnDisabled = await fillBtn.getAttribute('disabled');
    rec(`${tag} — Fill-empty-months button enabled when unbalanced`, btnDisabled === null);

    // Click "Fill empty months" → refills ONLY the cleared months, evenly.
    await fillBtn.click();
    await page.waitForTimeout(400);

    const after = [];
    for (let i = 0; i < n; i++) after.push(parseFloat(await inputs.nth(i).inputValue()) || 0);

    const b = after[n - 2], c = after[n - 1];
    const expectedRemainder = base[n - 2] + base[n - 1];

    // (1) cleared months refilled, non-zero, even.
    rec(`${tag} — cleared months refilled evenly`,
      b > 0 && c > 0 && Math.abs(b - c) < 0.02,
      `[${b}, ${c}]`);

    // (2) refilled total reconciles to the removed amount (remainder).
    rec(`${tag} — refilled total == removed remainder`,
      Math.abs((b + c) - expectedRemainder) < 0.05,
      `${(b + c).toFixed(2)} vs ${expectedRemainder.toFixed(2)}`);

    // (3) every other (typed) month preserved exactly.
    let preserved = true; let mismatch = '';
    for (let i = 0; i < n - 2; i++) {
      if (Math.abs(after[i] - base[i]) > 0.001) { preserved = false; mismatch = `i=${i}: ${base[i]}→${after[i]}`; break; }
    }
    rec(`${tag} — typed months preserved`, preserved, mismatch);

    // (4) plan reconciles to the annual anchor again.
    const pillAfter = (await pill.textContent()) || '';
    rec(`${tag} — re-balanced to anchor (✓)`, pillAfter.includes('✓'), `pill "${pillAfter.trim()}"`);

    await ctx.close();
  } catch (e) {
    rec(`Leg ${theme} — exception`, false, (e.message || String(e)).slice(0, 160));
    await ctx.close().catch(() => {});
  }
}

const browser = await chromium.launch({ headless: true });
try {
  console.log(`\n── feedback-#9 auto-distribute smoke @ preview ──`);
  await runLeg(browser, 'light');
  await runLeg(browser, 'dark');
} finally {
  await browser.close();
}
finishSmoke(results, { clearTimeout: clearTimer });

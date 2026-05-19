/**
 * high6-ytd-smoke.mjs — Phase 2 smoke for HIGH#6 docs-only resolution PR.
 *
 * Verifies:
 *   1. Total API · YTD tile on TenantAdminDashboard renders a real currency
 *      value (not "—") after production login as tenant_admin.
 *   2. Browser console is free of failed-precondition errors.
 *
 * One-time verification script. Not added to the docs PR commit.
 *
 * Credentials: A11Y_TENANT_ADMIN_EMAIL + A11Y_TENANT_ADMIN_PASSWORD from .env.local.
 * Target: production (https://agencytrack.vercel.app) — no bypass token needed.
 */

import { join, resolve, dirname } from 'path';
import { fileURLToPath }          from 'url';
import { mkdirSync }              from 'fs';

import {
  loadEnv, setupBrowser, loginAsViaUI,
  BASE_URL,
} from './shakedown/auth-helpers.mjs';

const __dir  = dirname(fileURLToPath(import.meta.url));
const SS_DIR = resolve(__dir, '..', '..', 'verification', 'high6-smoke');

mkdirSync(SS_DIR, { recursive: true });

const results = [];
let browser;

function pass(id, label) {
  console.log(`  PASS  [${id}] ${label}`);
  results.push({ id, label, pass: true });
}
function fail(id, label, err) {
  console.error(`  FAIL  [${id}] ${label}: ${err?.message ?? err}`);
  results.push({ id, label, pass: false, err: String(err?.message ?? err) });
}

try {
  const env    = loadEnv();
  const taEmail = env.A11Y_TENANT_ADMIN_EMAIL;
  const taPass  = env.A11Y_TENANT_ADMIN_PASSWORD;

  if (!taEmail || !taPass) {
    fail('H6.00', 'Credentials present', new Error('A11Y_TENANT_ADMIN_EMAIL or PASSWORD missing from .env.local'));
    process.exit(1);
  }
  pass('H6.00', 'Credentials present in .env.local');

  const { browser: b, page } = await setupBrowser();
  browser = b;

  // Collect console errors before login (captures failed-precondition if any).
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ── H6.01 — Login as tenant_admin ─────────────────────────────────────────
  try {
    await loginAsViaUI(page, taEmail, taPass);
    pass('H6.01', 'Tenant admin login successful');
  } catch (e) {
    fail('H6.01', 'Tenant admin login', e);
    await page.screenshot({ path: join(SS_DIR, 'login-fail.png'), type: 'png' });
    throw e;
  }

  // ── H6.02 — Wait for dashboard tab to settle (YTD tile loads async) ────────
  try {
    await page.waitForFunction(
      () => {
        const tiles = [...document.querySelectorAll('[class*="card"]')];
        return tiles.some(el => el.textContent.includes('Total API'));
      },
      { timeout: 15_000 },
    );
    pass('H6.02', 'Dashboard tab with Total API · YTD tile detected');
  } catch (e) {
    fail('H6.02', 'Total API · YTD tile present in DOM', e);
    await page.screenshot({ path: join(SS_DIR, 'tile-missing.png'), type: 'png' });
    throw e;
  }

  // Wait up to 8 s for async YTD fetch to resolve (not —).
  await page.waitForFunction(
    () => {
      const allText = document.body.innerText;
      // Currency pattern: TTD format e.g. "$0.00" or "$1,234.56"
      return /\$[\d,]+(\.\d{2})?/.test(allText) || allText.includes('0.00');
    },
    { timeout: 8_000 },
  ).catch(() => {
    // Tolerate timeout — H6.03 assertion below will catch the actual — value
  });

  // ── H6.03 — YTD tile does NOT show "—" ────────────────────────────────────
  try {
    const dashText = await page.locator('body').innerText();
    // Extract the Total API · YTD tile region specifically.
    // The StatCard renders: label (TOTAL API · YTD) then value on next line.
    const ytdMatch = dashText.match(/TOTAL API[\s·•]+YTD[\s\S]{0,60}/i);
    const ytdBlock = ytdMatch ? ytdMatch[0] : dashText.slice(0, 200);

    // Fail if the block contains "—" as a standalone dash (loading state).
    const hasDash = /\s—\s|\s—$|^—/m.test(ytdBlock);
    if (hasDash) throw new Error(`YTD tile still shows — (loading fallback). Block: "${ytdBlock.replace(/\n/g, ' ')}"`);

    // Confirm a currency value exists. formatCurrency() emits "TTD X,XXX" (not "$").
    const hasCurrency = /TTD\s*[\d,]+/.test(ytdBlock) || /TTD\s*0/.test(dashText);
    if (!hasCurrency) throw new Error(`YTD tile text does not contain a TTD currency value. Block: "${ytdBlock.replace(/\n/g, ' ')}"`);

    // Extract and log the observed value (no credentials in this value).
    const valueMatch = ytdBlock.match(/TTD\s*[\d,]+(\.\d{2})?/);
    const observed   = valueMatch ? valueMatch[0] : '(value detected but not extracted)';
    pass('H6.03', `YTD tile shows real value: ${observed} (no — dash)`);
  } catch (e) {
    fail('H6.03', 'YTD tile renders real value', e);
  }

  // ── H6.04 — No failed-precondition in console ──────────────────────────────
  // Allow a brief settle period before checking (async Firebase queries resolve).
  await page.waitForTimeout(2000);
  try {
    const precondErrors = consoleErrors.filter(m => m.includes('failed-precondition'));
    if (precondErrors.length > 0) {
      throw new Error(`failed-precondition found in console (${precondErrors.length}): ${precondErrors[0].slice(0, 200)}`);
    }
    pass('H6.04', 'Console free of failed-precondition errors');
  } catch (e) {
    fail('H6.04', 'No failed-precondition in console', e);
  }

  // ── H6.05 — Screenshot ────────────────────────────────────────────────────
  const ssPath = join(SS_DIR, 'dashboard-ytd-confirmed.png');
  await page.screenshot({ path: ssPath, type: 'png', fullPage: false });
  pass('H6.05', `Screenshot saved: ${ssPath}`);

} finally {
  if (browser) await browser.close();
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n── HIGH#6 smoke summary ──');
const passed = results.filter(r => r.pass).length;
const total  = results.length;
console.log(`  ${passed}/${total} checks passed`);
results.forEach(r => {
  if (!r.pass) console.error(`  FAIL: [${r.id}] ${r.label}${r.err ? ' — ' + r.err : ''}`);
});
if (passed < total) {
  console.error('\n  HS-1: One or more checks FAILED — do not close HIGH#6 without dispatcher review.');
  process.exit(1);
} else {
  console.log('\n  HIGH#6 smoke PASSED. YTD tile confirmed rendering in production.');
  process.exit(0);
}

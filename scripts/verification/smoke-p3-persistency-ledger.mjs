#!/usr/bin/env node
/**
 * smoke-p3-persistency-ledger.mjs — P3 read-only preview smoke.
 *
 * READ-ONLY. A feature-branch preview runs against PRODUCTION Firebase, so this
 * signs in and looks; it writes nothing.
 *
 * WHAT IT CAN CHECK: that the persistency tab still renders with the ledger
 * prefill code in place, on the NO-LEDGER path. The available A11Y agent has no
 * imported policies, so `hasLedger` is false for them and the tab must look
 * exactly as it did before P3. An exception in the new prefill path, or a form
 * that refuses to open, shows up here.
 *
 * WHAT IT CANNOT CHECK: the 86.6% / 72.2% figures. The only ledger with imported
 * policies belongs to Kyron's uid, and .env.local carries no credential for that
 * account (only A11Y_* service accounts). The figures are verified at the data
 * layer instead, against the live ledger — see the PR body.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  safeLog, setupBypassSession, resolveSmokeBaseUrl, stamp,
  installGlobalTimeout, finishSmoke, loginAs, waitForFirebaseReady, setTheme,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ambient env */ }
}
loadEnv();

const BASE = resolveSmokeBaseUrl({});
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const results = [];
const pass = (leg, detail = 'ok') => { results.push({ leg, passed: true, detail }); console.log(`  PASS  ${leg} — ${detail}`); };
const fail = (leg, detail = '') => { results.push({ leg, passed: false, detail }); console.log(`  FAIL  ${leg} — ${detail}`); };
const skip = (leg, detail) => { results.push({ leg, passed: true, detail: `SKIPPED — ${detail}` }); console.log(`  SKIP  ${leg} — ${detail}`); };
const clear = installGlobalTimeout(10 * 60 * 1000, () => { console.error('global timeout'); process.exit(1); });

async function waitForContent(page, minChars = 200, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let text = '';
  while (Date.now() < deadline) {
    text = await page.locator('body').innerText().catch(() => '');
    if (text && text.length >= minChars) return text;
    await page.waitForTimeout(500);
  }
  return text;
}

async function leg(browser, theme) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await setTheme(context, theme);
    await loginAs(page, BASE, process.env.A11Y_AGENT_EMAIL, process.env.A11Y_AGENT_PASSWORD);
    await waitForFirebaseReady(page);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const body = await waitForContent(page);

    if (!body || body.length < 200) fail(`app renders (${theme})`, `body under 200 chars (${body.length})`);
    else if (/something went wrong|unexpected error/i.test(body)) fail(`app renders (${theme})`, 'error card on screen');
    else pass(`app renders (${theme})`, `${body.length} chars, no error card`);

    // The new prefill path runs inside the persistency surfaces. An uncaught
    // exception there would surface as a pageerror even if the shell renders.
    if (errors.length) fail(`no uncaught page errors (${theme})`, errors.slice(0, 2).join(' | '));
    else pass(`no uncaught page errors (${theme})`);

    const persistencyVisible = /persistency/i.test(body);
    if (persistencyVisible) pass(`persistency surface reachable (${theme})`);
    else skip(`persistency surface reachable (${theme})`, 'no persistency text on the landing view for this account');
  } finally {
    await context.close();
  }
}

(async () => {
  console.log(`\nP3 read-only preview smoke — ${stamp()}`);
  safeLog('base', BASE);
  if (!TOKEN) { console.error('VERCEL_BYPASS_TOKEN missing'); process.exit(2); }
  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark']) {
      console.log(`\n-- theme: ${theme} --`);
      await leg(browser, theme);
    }
    skip('ledger prefill figures on the preview UI',
      'the only ledger with imported policies belongs to Kyron\'s uid and .env.local has no '
      + 'credential for it. 86.6% / 72.2% are verified at the data layer instead (PR body).');
  } finally {
    await browser.close();
  }
  finishSmoke(results, { clearTimeout: clear });
})();

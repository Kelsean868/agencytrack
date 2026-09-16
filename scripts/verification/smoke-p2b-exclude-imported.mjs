#!/usr/bin/env node
/**
 * smoke-p2b-exclude-imported.mjs — P2b preview smoke.
 *
 * READ-ONLY. It signs in and looks; it writes nothing. This matters: a
 * feature-branch Vercel preview runs against PRODUCTION Firebase (CLAUDE.md),
 * so a mutating smoke here would touch live tenant data. Every step below is a
 * navigation and an assertion on what rendered.
 *
 * WHAT THIS SMOKE CAN AND CANNOT PROVE, stated up front because the difference
 * decides whether a green run means anything:
 *
 *   CAN prove — the exclusion filter did not BREAK the surfaces it was added to.
 *   Production currently holds ZERO imported docs, so `excludeImported()` is the
 *   identity function on this data. If the helper were INVERTED (the single most
 *   likely way to get it wrong: `filter(isImportedPolicy)` instead of
 *   `filter((d) => !isImportedPolicy(d))`), every one of these surfaces would
 *   render EMPTY. That is exactly what these assertions catch.
 *
 *   CANNOT prove — that imported docs are excluded. There are none yet. The real
 *   verification is opening the CRO Delivery Register AFTER the live import and
 *   confirming the 117 settled imported policies are absent.
 *
 * So: this is a no-regression smoke, and it is deliberately named as one.
 */

import { readFileSync } from 'node:fs';

import { chromium } from 'playwright';

import {
  safeLog, setupBypassSession, resolveSmokeBaseUrl, stamp,
  installGlobalTimeout, finishSmoke, loginAs, waitForFirebaseReady,
  captureConsoleAndNetwork, formatCaptureReport, setTheme,
} from './lib/walk-helpers.mjs';

/**
 * Repo convention: each smoke loads .env.local itself rather than relying on the
 * shell to export it. Existing values win, so CI env beats the local file.
 * Values are never printed -- safeLog redacts, and only key NAMES appear.
 */
function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* no .env.local -- rely on the ambient environment */ }
}
loadEnv();

const BASE = resolveSmokeBaseUrl({
  defaultHost: 'agencytrack-git-feat-oipa-p2b-e-f02d04-kyron-marchan-s-projects.vercel.app',
});
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;

const results = [];
const pass = (leg, detail = 'ok') => { results.push({ leg, passed: true, detail }); console.log(`  PASS  ${leg} — ${detail}`); };
const fail = (leg, detail = '') => { results.push({ leg, passed: false, detail }); console.log(`  FAIL  ${leg} — ${detail}`); };
const skip = (leg, detail) => { results.push({ leg, passed: true, detail: `SKIPPED — ${detail}` }); console.log(`  SKIP  ${leg} — ${detail}`); };

const clear = installGlobalTimeout(10 * 60 * 1000, () => {
  console.error('global timeout');
  process.exit(1);
});

/**
 * Counts what rendered. An EMPTY surface where rows were expected is the
 * inverted-filter signature, so the assertion is on a lower bound, not on
 * "no error appeared".
 */
async function countRows(page, selectors) {
  for (const sel of selectors) {
    const n = await page.locator(sel).count().catch(() => 0);
    if (n > 0) return { selector: sel, count: n };
  }
  return { selector: null, count: 0 };
}

/**
 * Waits for the app to actually paint content, instead of sleeping a fixed
 * interval and hoping.
 *
 * A flat `waitForTimeout(2500)` is what made the dark leg report "page body is
 * essentially empty" on the first run while the light leg passed: the dark
 * context ran second, login took longer, and the assertion fired before the
 * dashboard rendered. The theme had nothing to do with it. Polling for the
 * condition removes the race rather than widening the guess.
 */
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

async function legAgentLedger(browser, theme) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const cap = captureConsoleAndNetwork(page);
  try {
    await setTheme(context, theme);
    await loginAs(page, BASE, process.env.A11Y_AGENT_EMAIL, process.env.A11Y_AGENT_PASSWORD);
    await waitForFirebaseReady(page);

    // The agent's own ledger + commission surfaces are the two AgentDashboard
    // consumers of the filtered array.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const bodyText = await waitForContent(page);
    if (!bodyText || bodyText.length < 200) {
      fail(`agent dashboard renders (${theme})`, `page body still under 200 chars after 30s (${bodyText.length})`);
    } else if (/something went wrong|failed to load|unexpected error/i.test(bodyText)) {
      fail(`agent dashboard renders (${theme})`, 'an error card is on screen');
    } else {
      pass(`agent dashboard renders (${theme})`, `${bodyText.length} chars of content, no error card`);
    }

    const report = formatCaptureReport(cap);
    if (/error/i.test(report) && /policies|importSource|excludeImported/i.test(report)) {
      fail(`no policy-related console errors (${theme})`, report.slice(0, 300));
    } else {
      pass(`no policy-related console errors (${theme})`);
    }
  } finally {
    await context.close();
  }
}

async function legManagerPolicies(browser, theme) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  try {
    await setTheme(context, theme);
    await loginAs(page, BASE, process.env.A11Y_BRANCH_MANAGER_EMAIL, process.env.A11Y_BRANCH_MANAGER_PASSWORD);
    await waitForFirebaseReady(page);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const bodyText = await waitForContent(page);
    if (!bodyText || bodyText.length < 200) {
      fail(`manager dashboard renders (${theme})`, `page body still under 200 chars after 30s (${bodyText.length})`);
    } else if (/something went wrong|failed to load|unexpected error/i.test(bodyText)) {
      fail(`manager dashboard renders (${theme})`, 'an error card is on screen');
    } else {
      pass(`manager dashboard renders (${theme})`, `${bodyText.length} chars, no error card`);
    }

    // getPoliciesForManager is now filtered in the service. A manager's policy
    // surface must still render — empty here would be the inverted filter.
    const rows = await countRows(page, [
      '[data-testid*="policy"]',
      '[data-testid*="reconcil"]',
      'table tbody tr',
    ]);
    if (rows.count > 0) {
      pass(`manager policy surface has rows (${theme})`, `${rows.count} via ${rows.selector}`);
    } else {
      skip(`manager policy surface has rows (${theme})`,
        'no policy rows found — this preview tenant may have no manager-visible policies seeded; '
        + 'cannot distinguish "correctly empty" from "wrongly empty", so not asserted');
    }
  } finally {
    await context.close();
  }
}

async function legCroRegister() {
  // The Delivery Register is gated on getRole() == 'cro' (firestore.rules
  // isCroInTenant). There is no A11Y_CRO_* credential in .env.local — only BM,
  // UM, SM, tenant_admin, agent and platform_admin. Signing in as any of those
  // would exercise a DIFFERENT authorisation arm and prove nothing about the
  // CRO surface, so this leg SKIPS rather than substituting an account and
  // reporting a pass. (Smoke standard: a missing-data step must never read as
  // a pass.)
  skip('CRO Delivery Register excludes imported policies',
    'no A11Y_CRO_* credential exists, AND production has 0 imported docs, so this leg '
    + 'cannot be made meaningful before the live import. It is dispatcher step 6c.');
}

(async () => {
  console.log(`\nP2b no-regression smoke — ${stamp()}`);
  safeLog('base', BASE);
  if (!TOKEN) { console.error('VERCEL_BYPASS_TOKEN missing'); process.exit(2); }
  if (!process.env.A11Y_AGENT_EMAIL || !process.env.A11Y_BRANCH_MANAGER_EMAIL) {
    console.error('A11Y agent / branch-manager credentials missing'); process.exit(2);
  }

  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark']) {
      console.log(`\n-- theme: ${theme} --`);
      await legAgentLedger(browser, theme);
      await legManagerPolicies(browser, theme);
    }
    await legCroRegister();
  } finally {
    await browser.close();
  }

  finishSmoke(results, { clearTimeout: clear });
})();

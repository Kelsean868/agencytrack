/**
 * smoke-650-logo.mjs — brand-mark smoke for PR #650
 *
 * Legs:
 *   asset-200        /icons.svg serves HTTP 200 via bypass context
 *   light-sidebar    sidebar img[src="/icons.svg"] visible in light mode
 *   light-no-errors  no console errors in light mode
 *   dark-sidebar     same in dark mode
 *   dark-no-errors   no console errors in dark mode
 *
 * WelcomeScreen visual check omitted — requires Firestore reset of
 * hasSeenWelcome; asset-200 covers the brief's "asset request 200, no 404"
 * requirement for that surface.
 *
 * Run:
 *   node scripts/verification/smoke-650-logo.mjs
 *   SMOKE_BASE_URL=https://... node scripts/verification/smoke-650-logo.mjs
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import {
  setupBypassSession,
  setTheme,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  stamp,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

// ── env ───────────────────────────────────────────────────────────────────────
const envVars = loadEnv(resolve(process.cwd(), '.env.local'));
for (const [k, v] of Object.entries(envVars)) {
  if (!(k in process.env)) process.env[k] = v;
}
const req = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing required env var: ${k}`);
  return v;
};

const TOKEN  = req('VERCEL_BYPASS_TOKEN');
// Use branch manager — has completed onboarding, sees ManagerDashboard + Sidebar
const AGENT_EMAIL = req('A11Y_BRANCH_MANAGER_EMAIL');
const AGENT_PASS  = req('A11Y_BRANCH_MANAGER_PASSWORD');

const PREVIEW_HOST = 'agencytrack-git-feat-agencytrack-logo-kyron-marchan-s-projects.vercel.app';
const BASE_URL     = resolveSmokeBaseUrl({ defaultHost: PREVIEW_HOST });

// ── result tracking ──────────────────────────────────────────────────────────
const results = [];
const record = (leg, passed, detail) => {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'}  ${leg}: ${detail}`);
};

const clearGlobalTimeout = installGlobalTimeout(120_000, () => finishSmoke(results));

// ── per-theme run ─────────────────────────────────────────────────────────────
async function runTheme(browser, theme) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupBypassSession(context, BASE_URL, TOKEN);
  await setTheme(context, theme);

  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    // Login
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
    await page.fill('input[type="email"]', AGENT_EMAIL);
    await page.fill('input[type="password"]', AGENT_PASS);
    await page.click('button[type="submit"]');

    // Wait for nav — 45s to cover Firebase init + possible WelcomeScreen overlay
    const navEl = await page.waitForSelector('nav[aria-label="Primary navigation"]', {
      timeout: 45_000,
    }).catch(() => null);

    if (!navEl) {
      record(`${theme}-sidebar`, false, 'nav never appeared — login or init failed');
    } else {
      // Check sidebar brand-mark img
      const imgHandle = await page.$('.sidebar-brand-mark img[src="/icons.svg"]');
      const visible = imgHandle ? await imgHandle.isVisible() : false;
      record(`${theme}-sidebar`, visible, visible
        ? 'sidebar-brand-mark img[src="/icons.svg"] visible'
        : 'MISSING — img[src="/icons.svg"] not found in sidebar-brand-mark');
    }

    // Console errors
    const report = formatCaptureReport(capture);
    const errors = capture.consoleMessages.filter(m => m.type === 'error');
    record(`${theme}-no-errors`, errors.length === 0,
      errors.length === 0 ? 'no console errors' : `${errors.length} error(s): ${errors.map(e => e.text).slice(0, 2).join('; ')}`);
    if (report) console.log(report);
  } finally {
    await context.close();
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`smoke-650-logo  BASE_URL=${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Leg 1: asset check via bypass context (avoids 401 from Vercel protection)
    console.log(`[${stamp()}]  checking /icons.svg via browser context…`);
    const assetContext = await browser.newContext();
    await setupBypassSession(assetContext, BASE_URL, TOKEN);
    const assetPage = await assetContext.newPage();
    try {
      const response = await assetPage.goto(`${BASE_URL}/icons.svg`, { waitUntil: 'domcontentloaded' });
      record('asset-200', response.ok(), `HTTP ${response.status()} — ${response.headers()['content-type'] ?? 'no content-type'}`);
    } catch (err) {
      record('asset-200', false, `navigation failed: ${err.message.slice(0, 80)}`);
    } finally {
      await assetContext.close();
    }

    await runTheme(browser, 'light');
    await runTheme(browser, 'dark');
  } finally {
    await browser.close();
  }

  finishSmoke(results, { clearTimeout: clearGlobalTimeout });
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});

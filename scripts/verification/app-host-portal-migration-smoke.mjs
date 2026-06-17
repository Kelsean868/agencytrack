/**
 * app-host-portal-migration-smoke.mjs — PR #672 frontend smoke.
 *
 * Proves the app-host migration to portal.agencytrack.app on the live preview:
 *   1. Login (BRANCH MANAGER) succeeds — proves the authService.js + brand.js
 *      import wiring did not break the runtime bundle.
 *   2. Kiosk Mode tab — write-read-verify: click "Generate URL" (CF write to
 *      tenants/{tid}/kioskTokens) → read-back the new row from Firestore →
 *      assert the rendered kiosk URL (the Open-kiosk href) is built on the
 *      portal host (https://portal.agencytrack.app/kiosk/...). This is the
 *      direct proof of the KioskModeTab.jsx KIOSK_BASE = `${APP_URL}/kiosk`
 *      change. The displayed URL is built client-side from the constant, so it
 *      reflects the frontend change independently of the (un-deployed) CF.
 *   3. Cleanup — revoke the token we created (self-cleaning; no production
 *      artifact left behind).
 *   4. 0 console errors per theme.
 *
 * Both themes (light + dark). BM credential only (Kiosk tab is branch_manager+).
 *
 * Usage:
 *   node scripts/verification/app-host-portal-migration-smoke.mjs --url=<preview>
 *   node scripts/verification/app-host-portal-migration-smoke.mjs   # defaults to prod
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import {
  setupBypassSession,
  setTheme,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

const PORTAL_PREFIX = 'https://portal.agencytrack.app/kiosk/';
const SS_DIR = 'screenshots/app-host-portal-migration';

// ── Env ─────────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {
    /* no .env.local — rely on ambient env */
  }
}
loadEnv();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=') || true];
  }),
);
const BASE_URL = (args.url ?? 'https://agencytrack.vercel.app').replace(/\/$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!BM_EMAIL || !BM_PASSWORD) {
  console.error('FAIL — A11Y_BRANCH_MANAGER_EMAIL / _PASSWORD not set');
  process.exit(1);
}

mkdirSync(SS_DIR, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function perTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);

  // 1. Login (proves auth/bundle wiring intact)
  await loginAs(page, BASE_URL, BM_EMAIL, BM_PASSWORD);
  record(`[${theme}] login`, true, 'dashboard rendered');

  // 2. Navigate to Kiosk tab
  await page.locator('nav').getByText('Kiosk', { exact: true }).first().click();
  await page.waitForSelector('h2:has-text("Kiosk Mode")', { timeout: 15_000 });
  // wait for the tokens list to finish its initial load
  await page.waitForFunction(
    () => !document.body.textContent.includes('Loading…'),
    { timeout: 15_000 },
  ).catch(() => {});

  const openLink = page.locator('a[aria-label="Open kiosk"]');
  const beforeCount = await openLink.count();

  // 3. Write — generate a kiosk token
  await page.getByRole('button', { name: /Generate URL|Generating/ }).click();

  // 4. Read-back — wait for a new token row to appear from Firestore
  await page.waitForFunction(
    (n) => document.querySelectorAll('a[aria-label="Open kiosk"]').length > n,
    beforeCount,
    { timeout: 25_000 },
  );

  // 5. Assert the newest (first) rendered kiosk URL uses the portal host
  const newHref = await openLink.first().getAttribute('href');
  const portalOk = typeof newHref === 'string' && newHref.startsWith(PORTAL_PREFIX);
  record(`[${theme}] kiosk URL uses portal host`, portalOk, newHref ?? '(no href)');

  await page.screenshot({ path: `${SS_DIR}/${theme}-kiosk.png`, fullPage: false });

  // 6. Cleanup — revoke the token we created (newest = first row)
  await page.locator('button[aria-label="Revoke kiosk URL"]').first().click();
  await page.waitForFunction(
    (n) => document.querySelectorAll('a[aria-label="Open kiosk"]').length <= n,
    beforeCount,
    { timeout: 25_000 },
  );
  record(`[${theme}] token revoked (cleanup)`, true, `back to ${beforeCount} token(s)`);

  // 7. Console clean
  const errors = cap.consoleMessages.filter((m) => m.type === 'error');
  record(`[${theme}] 0 console errors`, errors.length === 0,
    errors.length ? errors.map((e) => e.text).join(' | ') : 'clean');
  formatCaptureReport(cap);
}

(async () => {
  console.log(`\n=== app-host-portal-migration smoke @ ${BASE_URL} ===\n`);
  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      try {
        await setupBypassSession(context, BASE_URL, TOKEN);
        await setTheme(context, theme);
        const page = await context.newPage();
        await perTheme(page, theme);
      } catch (e) {
        record(`[${theme}] run`, false, e.message ?? String(e));
        try {
          const pages = context.pages();
          if (pages[0]) await pages[0].screenshot({ path: `${SS_DIR}/${theme}-FAIL.png` });
        } catch { /* ignore */ }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== ${passed}/${results.length} checks PASS ===\n`);
  process.exit(passed === results.length ? 0 : 1);
})();

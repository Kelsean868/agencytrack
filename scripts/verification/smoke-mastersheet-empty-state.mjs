/**
 * smoke-mastersheet-empty-state.mjs
 *
 * UX-001 — MasterSheet designed empty state. Drives the deterministic
 * search-empty path (type a non-matching agent search → the roster filters to
 * zero rows → the designed empty state renders) as a branch manager, so it does
 * not depend on the week having zero real submissions. Asserts the designed
 * block (`mastersheet-empty`: icon + headline + guidance) renders instead of a
 * bare caption.
 *
 * READ-ONLY. Credentials via .env.local → process.env by NAME only (branch
 * manager tier). Desktop light + dark.
 *
 * Usage:
 *   SMOKE_PREVIEW_URL="https://<url>" \
 *     node --env-file=.env.local scripts/verification/smoke-mastersheet-empty-state.mjs
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
  stamp,
} from './lib/walk-helpers.mjs';

const BASE = (process.env.SMOKE_PREVIEW_URL || process.env.SMOKE_BASE_URL || '')
  .replace(/\/+$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const EMAIL = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const PASS = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!BASE || !TOKEN || !EMAIL || !PASS) {
  console.error('MISSING ENV: need SMOKE_PREVIEW_URL, VERCEL_BYPASS_TOKEN, A11Y_BRANCH_MANAGER_EMAIL, A11Y_BRANCH_MANAGER_PASSWORD');
  process.exit(2);
}

const results = [];
const pass = (id, msg) => { results.push({ id, ok: true, msg }); console.log(`[${stamp()}] PASS ${id} — ${msg}`); };
const fail = (id, msg) => { results.push({ id, ok: false, msg }); console.log(`[${stamp()}] FAIL ${id} — ${msg}`); };

async function runLeg(browser, { theme, viewport }) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  let capture;
  try {
    await setupBypassSession(context, BASE, TOKEN);
    const page = await context.newPage();
    capture = captureConsoleAndNetwork(page);
    await loginAs(page, BASE, EMAIL, PASS);
    if (theme === 'dark') {
      await page.evaluate(() => localStorage.setItem('agencytrack-dark', '1'));
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    // Navigate to Master Sheet via the sidebar (button title === label).
    await page.locator('nav[aria-label="Primary navigation"] button[title="Master Sheet"]').first()
      .click({ timeout: 8000 });
    const searchBox = page.locator('input[placeholder="Search agent…"]').first();
    await searchBox.waitFor({ state: 'visible', timeout: 10000 });

    // Force the roster empty via a non-matching search — deterministic regardless
    // of how many real submissions the week has.
    await searchBox.fill('zzz-no-such-agent-zzz');
    const empty = page.locator('[data-testid="mastersheet-empty"]').first();
    await empty.waitFor({ state: 'visible', timeout: 8000 });
    const text = (await empty.textContent()) || '';
    if (/No agents match your search/i.test(text)) {
      pass(`${theme}-search-empty`, `designed empty state renders headline + guidance ("${text.trim().slice(0, 60)}…")`);
    } else {
      fail(`${theme}-search-empty`, `mastersheet-empty present but copy unexpected: "${text.trim().slice(0, 80)}"`);
    }
    // The icon container is part of the designed block (not a bare caption).
    const hasIcon = await empty.locator('svg').count();
    if (hasIcon > 0) pass(`${theme}-empty-icon`, 'empty state includes an icon (designed, not bare text)');
    else fail(`${theme}-empty-icon`, 'no icon in the empty state — looks like the old bare caption');

    const errs = capture.consoleMessages.filter((m) => m.type === 'error');
    if (errs.length === 0) pass(`${theme}-console`, '0 console errors');
    else fail(`${theme}-console`, `${errs.length} console errors: ${errs.map((e) => e.text).slice(0, 3).join(' | ')}`);
  } catch (e) {
    fail(`${theme}-leg`, `unexpected error: ${e.message}`);
  } finally {
    if (capture) console.log(formatCaptureReport(capture));
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch();
  try {
    await runLeg(browser, { theme: 'light', viewport: { width: 1440, height: 900 } });
    await runLeg(browser, { theme: 'dark', viewport: { width: 1440, height: 900 } });
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log('\n════════ SUMMARY ════════');
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.id} — ${r.msg}`);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => { console.error('SMOKE CRASH:', e.message); process.exit(1); });

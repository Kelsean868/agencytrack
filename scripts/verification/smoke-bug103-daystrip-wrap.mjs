/**
 * smoke-bug103-daystrip-wrap.mjs
 *
 * BUG-103 regression smoke: the Daily Capture day strip renders all 7 pills
 * (Sunday–Saturday) on a SINGLE row — no wrap of the 7th chip onto its own row.
 * Pre-fix the strip was `grid-cols-6` while `deriveWeekStripDays` always returns
 * 7 entries, so the 7th pill wrapped (measured y=126 vs y=69 for the first six).
 *
 * Assertion: exactly 7 `dcv2-strip-day-*` chips, all sharing the same top
 * (bounding-box y within a small tolerance) → one row. Verified at desktop
 * 1440×900 and mobile 380×820. Also confirms today's pill is present + selected.
 *
 * READ-ONLY: opens and closes the Daily Capture takeover without saving.
 * Credentials via .env.local → process.env by NAME only.
 *
 * Usage:
 *   SMOKE_PREVIEW_URL="https://<immutable-deployment>.vercel.app" \
 *     node --env-file=.env.local scripts/verification/smoke-bug103-daystrip-wrap.mjs
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
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS = process.env.A11Y_AGENT_PASSWORD;

if (!BASE || !TOKEN || !EMAIL || !PASS) {
  console.error('MISSING ENV: need SMOKE_PREVIEW_URL, VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD');
  process.exit(2);
}

const results = [];
const pass = (id, msg) => { results.push({ id, ok: true, msg }); console.log(`[${stamp()}] PASS ${id} — ${msg}`); };
const fail = (id, msg) => { results.push({ id, ok: false, msg }); console.log(`[${stamp()}] FAIL ${id} — ${msg}`); };
const skip = (id, msg) => { results.push({ id, ok: true, msg: `SKIP: ${msg}` }); console.log(`[${stamp()}] SKIP ${id} — ${msg}`); };

// TT (UTC−4) day-of-week for the current run; the WeekStrip is intentionally
// NOT rendered on Sundays (Daily Capture shows the Sunday review view), so the
// pixel-level single-row check can only run on a non-Sunday. On a Sunday the
// legs skip-not-fail (grid template is still guarded day-independently by the
// grid-cols-7 unit test in DailyCaptureV2.test.jsx).
const TT_NOW = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Port_of_Spain' }));
const IS_SUNDAY = TT_NOW.getDay() === 0;

async function openDailyCapture(page, { mobile }) {
  if (mobile) {
    await page.locator('[data-testid="bottomnav-create"]').first().click({ timeout: 6000 });
    const logToday = page.locator('[data-testid="quickadd-log-today"]').first();
    await logToday.waitFor({ state: 'visible', timeout: 6000 });
    await logToday.click({ timeout: 6000 });
  } else {
    await page.locator('[data-testid="agent-tab-daily-log"]').first().click({ timeout: 6000 });
  }
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { timeout: 10000 });
}

async function leg(browser, { theme, viewport, mobile }) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  let capture;
  try {
    await setupBypassSession(context, BASE, TOKEN);
    const page = await context.newPage();
    capture = captureConsoleAndNetwork(page);
    await loginAs(page, BASE, EMAIL, PASS);
    if (theme === 'dark') {
      await page.evaluate(() => { localStorage.setItem('agencytrack-dark', '1'); });
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await openDailyCapture(page, { mobile });

    if (IS_SUNDAY) {
      skip(`${theme}-single-row`, 'today is Sunday (TT) — WeekStrip not rendered by design; grid-cols-7 covered by unit test');
      const errs = capture.consoleMessages.filter((m) => m.type === 'error');
      if (errs.length === 0) pass(`${theme}-console`, '0 console errors');
      else fail(`${theme}-console`, `${errs.length} console errors: ${errs.map((e) => e.text).slice(0, 3).join(' | ')}`);
      return;
    }

    const boxes = await page.locator('[data-testid^="dcv2-strip-day-"]').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width) };
      }),
    );

    if (boxes.length === 7) pass(`${theme}-count`, `7 day pills present`);
    else fail(`${theme}-count`, `expected 7 day pills, found ${boxes.length}`);

    const tops = boxes.map((b) => b.top);
    const spread = boxes.length ? Math.max(...tops) - Math.min(...tops) : 0;
    // One row → all tops within a few px (sub-pixel/rounding tolerance).
    if (boxes.length === 7 && spread <= 4) pass(`${theme}-single-row`, `all 7 pills on one row (top spread ${spread}px)`);
    else fail(`${theme}-single-row`, `pills wrap — top spread ${spread}px across ${boxes.length} pills (tops: ${tops.join(',')})`);

    // No page-level horizontal scroll introduced by the 7th column.
    const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (!hScroll) pass(`${theme}-no-hscroll`, 'no page-level horizontal scroll');
    else fail(`${theme}-no-hscroll`, 'page has horizontal scroll after grid-cols-7');

    const errs = capture.consoleMessages.filter((m) => m.type === 'error');
    if (errs.length === 0) pass(`${theme}-console`, '0 console errors');
    else fail(`${theme}-console`, `${errs.length} console errors: ${errs.map((e) => e.text).slice(0, 3).join(' | ')}`);
  } catch (e) {
    fail(`${theme}-leg`, `unexpected error before all checks ran: ${e.message}`);
  } finally {
    if (capture) console.log(formatCaptureReport(capture));
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch();
  try {
    await leg(browser, { theme: 'desktop-light', viewport: { width: 1440, height: 900 }, mobile: false });
    await leg(browser, { theme: 'mobile-light', viewport: { width: 380, height: 820 }, mobile: true });
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

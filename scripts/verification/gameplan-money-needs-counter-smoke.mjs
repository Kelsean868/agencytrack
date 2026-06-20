/**
 * gameplan-money-needs-counter-smoke.mjs — Item 1 (night-queue conformance polish).
 *
 * Proves the worksheet-level FILLED N/total counter (1.8) renders on the Money
 * Needs worksheet in BOTH themes:
 *
 *   1. Money Needs tab opens; worksheet present (or seeded via Start).
 *   2. money-needs-filled-counter renders with a "Filled N/M" tally.
 *   3. 0 console errors.
 *
 * If the agent has no worksheet for the year, the smoke clicks "Start worksheet"
 * (the documented first-run path) and asserts the counter shows "Filled 0/34".
 *
 * Run (against a live preview):
 *   SMOKE_PREVIEW_URL=https://<preview-host> node \
 *     scripts/verification/gameplan-money-needs-counter-smoke.mjs
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import {
  runBothThemes, loginAs, captureConsoleAndNetwork, formatCaptureReport,
  installGlobalTimeout, finishSmoke, stamp,
} from './lib/walk-helpers.mjs';
import { loadEnv } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const E = loadEnv(ROOT);
const BASE = (process.env.SMOKE_PREVIEW_URL ?? 'https://agencytrack.vercel.app').replace(/\/+$/, '');
const TOKEN = E.VERCEL_BYPASS_TOKEN ?? process.env.VERCEL_BYPASS_TOKEN;

const SS_DIR = join(ROOT, 'screenshots', 'gameplan-item1');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const COUNTER = '[data-testid="money-needs-filled-counter"]';
const results = [];

async function perTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);

  await page.click('[data-testid="agent-tab-money-needs"]');
  // Either the counter (worksheet exists) or the Start button (first-run) appears.
  await page.waitForFunction(
    (sel) =>
      document.querySelector(sel) !== null ||
      Array.from(document.querySelectorAll('button')).some((b) => /start .*worksheet/i.test(b.textContent || '')),
    COUNTER,
    { timeout: 20_000 },
  );

  let seeded = false;
  if ((await page.locator(COUNTER).count()) === 0) {
    // First-run: seed the worksheet via the documented Start path.
    await page.getByRole('button', { name: /start .*worksheet/i }).click();
    await page.waitForSelector(COUNTER, { timeout: 20_000 });
    seeded = true;
  }
  await page.waitForTimeout(1000);

  const text = (await page.locator(COUNTER).first().textContent())?.trim() ?? '';
  const match = /Filled\s+(\d+)\/(\d+)/.exec(text);
  const consoleErrors = cap.consoleMessages.filter((m) => m.type === 'error');

  await page.screenshot({ path: join(SS_DIR, `money-needs-${theme}.png`), fullPage: false });

  // Well-formed tally; filled <= total; if freshly seeded, expect 0/34.
  const wellFormed = !!match && Number(match[1]) <= Number(match[2]);
  const seedOk = !seeded || (match && match[1] === '0' && match[2] === '34');
  const pass = wellFormed && seedOk && consoleErrors.length === 0;

  results.push({
    leg: `${theme}: filled counter renders${seeded ? ' (seeded first-run)' : ''}`,
    passed: pass,
    detail: `text="${text}" seeded=${seeded} consoleErrors=${consoleErrors.length}`,
  });
  formatCaptureReport(cap);
}

async function run() {
  console.log(`[${stamp()}] Item 1 smoke — base ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  const clear = installGlobalTimeout(180_000, () => browser.close());
  try {
    await runBothThemes(browser, {
      baseUrl: BASE,
      token: TOKEN,
      viewport: { width: 1280, height: 900 },
      perTheme,
    });
  } finally {
    await browser.close();
  }
  finishSmoke(results, { clearTimeout: clear });
}

run().catch((err) => {
  console.error('Smoke crashed:', err?.message ?? String(err));
  process.exit(1);
});

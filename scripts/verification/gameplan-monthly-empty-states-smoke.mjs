/**
 * gameplan-monthly-empty-states-smoke.mjs — Item 3 (night-queue conformance polish).
 *
 * Opens the Monthly Plan modal (Game Plan Step 3) and verifies, in BOTH themes:
 *
 *   1. 3.8 copy — with no Year Plan, the modal shows the honest no-Year-Plan
 *      state reading "Nothing to split yet" (data-testid no-yearplan-state).
 *   2. 0 console errors.
 *
 * The NOW line (3.2) and the honest-empty "actuals will fill in" state (3.8
 * functional) require the allocating phase (a seeded Year Plan with positive
 * API); both are covered by MonthChart / MonthlyPlanModal unit tests rather than
 * driven live here (the agent test account has no Year Plan).
 *
 * Run (against a live preview):
 *   SMOKE_PREVIEW_URL=https://<preview-host> node \
 *     scripts/verification/gameplan-monthly-empty-states-smoke.mjs
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
const AGENT_EMAIL = E.A11Y_AGENT_EMAIL ?? process.env.A11Y_AGENT_EMAIL;
const AGENT_PASSWORD = E.A11Y_AGENT_PASSWORD ?? process.env.A11Y_AGENT_PASSWORD;

const SS_DIR = join(ROOT, 'screenshots', 'gameplan-item3');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const results = [];

async function perTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, AGENT_EMAIL, AGENT_PASSWORD);

  await page.click('[data-testid="agent-tab-game-plan"]');
  await page.waitForSelector('[data-testid="game-plan-rail"]', { timeout: 20_000 });

  // Open Monthly Plan (Step 3) from the rail.
  await page.locator('[data-testid="game-plan-rail"]').getByRole('button', { name: /monthly plan/i }).click();

  // The modal lands in one of two states depending on the account's data:
  //   - no Year Plan  → honest "Nothing to split yet" copy (3.8 copy)
  //   - allocating    → 12-month chart with the NOW line (3.2)
  // Assert whichever Item-3 feature applies.
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="no-yearplan-state"]') !== null ||
      document.querySelector('[data-testid="month-col-0"]') !== null,
    null,
    { timeout: 20_000 },
  );

  const noYearPlan = await page.locator('[data-testid="no-yearplan-state"]').count();
  let leg;
  let detail;
  let featureOk;
  if (noYearPlan) {
    const stateText = (await page.locator('[data-testid="no-yearplan-state"]').first().textContent())?.trim() ?? '';
    featureOk = /nothing to split yet/i.test(stateText);
    leg = `${theme}: no-Year-Plan honest copy (3.8)`;
    detail = `copy~"Nothing to split yet"=${featureOk}`;
  } else {
    const nowLine = await page.locator('[data-testid="now-line"]').count();
    featureOk = nowLine >= 1;
    leg = `${theme}: NOW line in allocating chart (3.2)`;
    detail = `now-line=${nowLine}`;
  }

  const consoleErrors = cap.consoleMessages.filter((m) => m.type === 'error');
  await page.screenshot({ path: join(SS_DIR, `monthly-${theme}.png`), fullPage: false });

  const pass = featureOk && consoleErrors.length === 0;
  results.push({ leg, passed: pass, detail: `${detail} consoleErrors=${consoleErrors.length}` });
  formatCaptureReport(cap);
}

async function run() {
  console.log(`[${stamp()}] Item 3 smoke — base ${BASE}`);
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

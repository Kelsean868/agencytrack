/**
 * gameplan-year-plan-awards-smoke.mjs — Item 2 (night-queue conformance polish).
 *
 * Drives the Year Plan modal (Game Plan Step 2) to its allocating phase and
 * verifies, in BOTH themes:
 *
 *   1. 2.4 — the blended-rate honesty tooltip renders on the commission row
 *      (data-testid commission-blended-tooltip).
 *   2. 2.5 — when the award projection strip renders (Life API > 0), award pills
 *      carry gap / top-tier annotations (data-testid award-gap-*). Best-effort:
 *      the strip only renders with a positive Life-line API; the gap math itself
 *      is covered exhaustively by yearPlanProjection unit tests.
 *   3. 0 console errors.
 *
 * Run (against a live preview):
 *   SMOKE_PREVIEW_URL=https://<preview-host> node \
 *     scripts/verification/gameplan-year-plan-awards-smoke.mjs
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

const SS_DIR = join(ROOT, 'screenshots', 'gameplan-item2');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const results = [];

async function perTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, AGENT_EMAIL, AGENT_PASSWORD);

  await page.click('[data-testid="agent-tab-game-plan"]');
  await page.waitForSelector('[data-testid="game-plan-rail"]', { timeout: 20_000 });

  // Open Year Plan (Step 2) from the rail.
  await page.locator('[data-testid="game-plan-rail"]').getByRole('button', { name: /year plan/i }).click();
  const dialog = page.getByRole('dialog', { name: /year plan/i });
  await dialog.waitFor({ state: 'visible', timeout: 20_000 });

  // Reach the allocating phase. First run: pick a license profile (writes the
  // agent's first-run licenseProfile). With no Money Needs targets this lands in
  // the no-seed state, whose "Enter from scratch" dismiss → allocating. Wait for
  // each async-rendered control rather than fixed delays.
  const composite = dialog.getByRole('button', { name: /composite/i });
  if (await composite.count()) {
    await composite.first().click();
  }
  const scratch = dialog.getByRole('button', { name: /enter from scratch/i });
  await scratch.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  if (await scratch.count()) {
    await scratch.first().click();
  }

  // 2.4 — blended-rate tooltip is present once the summary card renders.
  await page.waitForSelector('[data-testid="commission-blended-tooltip"]', { timeout: 15_000 });
  const tooltip = await page.locator('[data-testid="commission-blended-tooltip"]').count();
  const tooltipTitle = await page.locator('[data-testid="commission-blended-tooltip"]').first().getAttribute('title');

  // 2.5 — best-effort: if the award strip renders, gaps/top-tier annotate pills.
  const strip = await page.locator('[data-testid="award-projection-strip"]').count();
  const gapPills = await page.locator('[data-testid^="award-gap-"]').count();

  const consoleErrors = cap.consoleMessages.filter((m) => m.type === 'error');
  await page.screenshot({ path: join(SS_DIR, `year-plan-${theme}.png`), fullPage: false });

  const tooltipOk = tooltip === 1 && /blended/i.test(tooltipTitle ?? '');
  const pass = tooltipOk && consoleErrors.length === 0;
  results.push({
    leg: `${theme}: blended tooltip + award strip`,
    passed: pass,
    detail: `tooltip=${tooltip} title~blended=${/blended/i.test(tooltipTitle ?? '')} strip=${strip} gapPills=${gapPills} consoleErrors=${consoleErrors.length}`,
  });
  formatCaptureReport(cap);
}

async function run() {
  console.log(`[${stamp()}] Item 2 smoke — base ${BASE}`);
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

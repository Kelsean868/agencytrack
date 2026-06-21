/**
 * awards-ruleset-merged-accessor-smoke.mjs — render no-regression for the
 * render-only merged ruleset accessor (Option A fast-follow).
 *
 * With the real (complete) production doc, deep-merge is a no-op, so the three
 * render surfaces must render exactly as before. The crash detector is a clean
 * console — a broken ruleset wiring throws during award computation. BOTH themes:
 *
 *   Agent:   Awards tab (AgentDashboard awards) + Year Plan modal (YearPlanModal
 *            award strip) — both now load via getMergedAwardsRuleset.
 *   Manager: ManagerAwardsPanel (manager-awards-panel) — loads via the merged
 *            accessor and feeds BmAtRiskPanel.
 *
 * Coverage boundary (Rule 22): the partial-doc crash path and the raw-accessor
 * contract-lock are proven by awardsRulesetService unit tests, NOT this smoke —
 * malformed data can't be injected against the live account.
 *
 * Run:
 *   SMOKE_PREVIEW_URL=https://<preview-host> node \
 *     scripts/verification/awards-ruleset-merged-accessor-smoke.mjs
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
const BM_EMAIL = E.A11Y_BRANCH_MANAGER_EMAIL ?? process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD = E.A11Y_BRANCH_MANAGER_PASSWORD ?? process.env.A11Y_BRANCH_MANAGER_PASSWORD;

const SS_DIR = join(ROOT, 'screenshots', 'awards-ruleset-fastfollow');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const results = [];

async function agentPerTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, AGENT_EMAIL, AGENT_PASSWORD);

  // Agent Awards tab — AgentDashboard awards computed from the merged ruleset.
  await page.click('[data-testid="agent-tab-awards"]');
  await page.waitForTimeout(2500);
  const awardsRendered = (await page.evaluate(() => document.body.textContent.length)) > 300;

  // Year Plan modal — YearPlanModal loads the merged ruleset for the award strip.
  await page.click('[data-testid="agent-tab-game-plan"]');
  await page.waitForSelector('[data-testid="game-plan-rail"]', { timeout: 20_000 });
  await page.locator('[data-testid="game-plan-rail"]').getByRole('button', { name: /year plan/i }).click();
  await page.getByRole('dialog', { name: /year plan/i }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(1500);

  const consoleErrors = cap.consoleMessages.filter((m) => m.type === 'error');
  await page.screenshot({ path: join(SS_DIR, `agent-${theme}.png`), fullPage: false });

  results.push({
    leg: `agent ${theme}: Awards tab + Year Plan render`,
    passed: awardsRendered && consoleErrors.length === 0,
    detail: `awardsRendered=${awardsRendered} consoleErrors=${consoleErrors.length}`,
  });
  formatCaptureReport(cap);
}

async function managerPerTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, BM_EMAIL, BM_PASSWORD);

  await page.getByRole('button', { name: /^awards$/i }).first().click();
  // The awards surface mounts (loading skeleton or the panel), proving the
  // merged-accessor load ran without crashing.
  await page.waitForSelector(
    '[data-testid="manager-awards-panel"], [data-testid="manager-awards-loading"]',
    { timeout: 20_000 },
  );
  await page.waitForSelector('[data-testid="manager-awards-panel"]', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const panel = await page.locator('[data-testid="manager-awards-panel"]').count();
  const consoleErrors = cap.consoleMessages.filter((m) => m.type === 'error');
  await page.screenshot({ path: join(SS_DIR, `manager-${theme}.png`), fullPage: false });

  results.push({
    leg: `manager ${theme}: ManagerAwardsPanel renders`,
    passed: panel >= 1 && consoleErrors.length === 0,
    detail: `panel=${panel} consoleErrors=${consoleErrors.length}`,
  });
  formatCaptureReport(cap);
}

async function run() {
  console.log(`[${stamp()}] awards-ruleset merged-accessor smoke — base ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  const clear = installGlobalTimeout(240_000, () => browser.close());
  try {
    await runBothThemes(browser, {
      baseUrl: BASE, token: TOKEN, viewport: { width: 1280, height: 900 }, perTheme: agentPerTheme,
    });
    await runBothThemes(browser, {
      baseUrl: BASE, token: TOKEN, viewport: { width: 1280, height: 900 }, perTheme: managerPerTheme,
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

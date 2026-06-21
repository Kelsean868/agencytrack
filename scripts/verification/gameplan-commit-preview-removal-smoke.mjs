/**
 * gameplan-commit-preview-removal-smoke.mjs — Item 4 (night-queue conformance polish).
 *
 * Proves the vestigial CommitPreviewCard is GONE from the Game Plan hub while the
 * live Step 4 chrome (StepRail → ReviewCommitModal path) is intact. BOTH themes:
 *
 *   1. Game Plan hub renders (game-plan-hub present).
 *   2. Dead card removed: game-plan-commit AND game-plan-commit-btn ABSENT.
 *   3. Live rail intact: game-plan-rail present (Step 4 path unaffected).
 *   4. 0 console errors.
 *
 * Run (against a live preview):
 *   SMOKE_PREVIEW_URL=https://<preview-host> node --env-file=.env.local \
 *     scripts/verification/gameplan-commit-preview-removal-smoke.mjs
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
// Prefer .env.local; fall back to process.env so the smoke also runs where
// credentials are injected directly into the environment (Gemini #705 nit).
const AGENT_EMAIL = E.A11Y_AGENT_EMAIL ?? process.env.A11Y_AGENT_EMAIL;
const AGENT_PASSWORD = E.A11Y_AGENT_PASSWORD ?? process.env.A11Y_AGENT_PASSWORD;

const SS_DIR = join(ROOT, 'screenshots', 'gameplan-item4');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const results = [];

async function perTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, AGENT_EMAIL, AGENT_PASSWORD);

  await page.click('[data-testid="agent-tab-game-plan"]');
  // Wait deterministically for both the hub and the live rail to render (the rail
  // is asserted below) instead of a fixed settle delay (Gemini #705 nit).
  await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid="game-plan-rail"]', { timeout: 20_000 });

  const hub = await page.locator('[data-testid="game-plan-hub"]').count();
  const rail = await page.locator('[data-testid="game-plan-rail"]').count();
  const deadCard = await page.locator('[data-testid="game-plan-commit"]').count();
  const deadBtn = await page.locator('[data-testid="game-plan-commit-btn"]').count();
  const consoleErrors = cap.consoleMessages.filter((m) => m.type === 'error');

  await page.screenshot({ path: join(SS_DIR, `hub-${theme}.png`), fullPage: false });

  const pass =
    hub === 1 && rail === 1 && deadCard === 0 && deadBtn === 0 && consoleErrors.length === 0;
  results.push({
    leg: `${theme}: hub render + dead-card removed`,
    passed: pass,
    detail: `hub=${hub} rail=${rail} deadCard=${deadCard} deadBtn=${deadBtn} consoleErrors=${consoleErrors.length}`,
  });
  formatCaptureReport(cap);
}

async function run() {
  console.log(`[${stamp()}] Item 4 smoke — base ${BASE}`);
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

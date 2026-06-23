/**
 * smoke-money-needs-summary-clarity.mjs — PR #735 verification.
 *
 * Proves the income build-up reorder is live and the #734 playground fix
 * is not regressed. All display legs SKIP conditionally when the preview env
 * has no seeded PAYE worksheet (RTL covers them); the skip is explained, not
 * unconditional.
 *
 * Legs:
 *   L1 — page renders without crash (always runs).
 *   L2 — display order: After-tax → + PAYE → = Income you must earn (skips if no PAYE worksheet).
 *   L3 — L1b regression: playground income-goal reads 1,090,000 NOT 1,453,333.
 *
 * Run:
 *   SMOKE_BASE_URL=https://agencytrack.vercel.app \          ← production
 *   SMOKE_PREVIEW_URL=https://<preview-host> \               ← Vercel preview
 *   node scripts/verification/smoke-money-needs-summary-clarity.mjs
 * SMOKE_BASE_URL wins when both are set.
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import {
  runBothThemes,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
  installGlobalTimeout,
  finishSmoke,
  stamp,
} from './lib/walk-helpers.mjs';
import { loadEnv, navigateAgentTab } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const E = loadEnv(ROOT);

const BASE = (process.env.SMOKE_BASE_URL ?? process.env.SMOKE_PREVIEW_URL ?? '').replace(/\/+$/, '')
  || 'https://agencytrack-git-fix-money-needs-summary-clarity-kyron-marchan-s-projects.vercel.app';
const TOKEN = E.VERCEL_BYPASS_TOKEN;

const STORAGE_KEY = 'agencytrack-playground-income-goal';
const KNOWN_GROSS = 1_090_000;
const DOUBLE_TAX  = 1_453_333;

const SS_DIR = join(ROOT, 'screenshots', 'money-needs-summary-clarity');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const results = [];
const pass = (leg, detail = '') => { results.push({ leg, passed: true,  detail }); console.log(`  ✅ ${leg}${detail ? ': ' + detail : ''}`); };
const fail = (leg, detail = '') => { results.push({ leg, passed: false, detail }); console.error(`  ❌ ${leg}${detail ? ': ' + detail : ''}`); };
const skip = (leg, detail = '') => { results.push({ leg, passed: true,  detail: `SKIP — ${detail}` }); console.log(`  ⏭  ${leg}${detail ? ' [' + detail + ']' : ''}`); };

async function perTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);

  // ── Navigate to Money Needs ──────────────────────────────────────────────────
  console.log(`\n── [${theme}] navigating to Money Needs`);
  await navigateAgentTab(page, 'money-needs');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="money-needs-filled-counter"]') !== null
      || /start.*worksheet/i.test(document.body.textContent || ''),
    { timeout: 25_000 },
  );

  // ── L1 — page renders without crash ─────────────────────────────────────────
  console.log(`\n── [${theme}] L1 — page renders without crash`);
  const pageText = await page.evaluate(() => document.body.textContent || '');
  if (/money needs worksheet/i.test(pageText)) {
    pass(`L1-${theme}: Money Needs Worksheet rendered`);
  } else {
    fail(`L1-${theme}: page content unexpected`);
  }

  await page.screenshot({ path: join(SS_DIR, `money-needs-${theme}.png`), fullPage: false });

  // ── L2 — display order (conditional — skips if no PAYE worksheet) ────────────
  console.log(`\n── [${theme}] L2 — display order: build-up present + additive PAYE`);
  const hasPAYE = (await page.locator('text=The income your lifestyle requires').count()) > 0;

  if (!hasPAYE) {
    skip(`L2-${theme}: display order`, 'no seeded PAYE worksheet in preview — RTL asserts order/labels in MoneyNeedsPanel.test.jsx');
  } else {
    const hasAfterTax  = (await page.locator('text=After-tax take-home').count()) > 0;
    const hasAddPAYE   = (await page.locator('text=+ PAYE').count()) > 0;
    const hasGrossLine = (await page.locator('text== Income you must earn').count()) > 0;
    const hasBadSign   = (await page.locator('text=− PAYE gross-up').count()) > 0;
    const hasBadLabel  = (await page.locator('text=Income you must earn').filter({ hasNotText: '= ' }).count()) > 0;

    if (hasAfterTax)  pass(`L2-${theme}: "After-tax take-home" row present`);
    else              fail(`L2-${theme}: "After-tax take-home" row MISSING`);

    if (hasAddPAYE)   pass(`L2-${theme}: "+ PAYE" additive row present`);
    else              fail(`L2-${theme}: "+ PAYE" row MISSING`);

    if (hasGrossLine) pass(`L2-${theme}: "= Income you must earn" summation row present`);
    else              fail(`L2-${theme}: "= Income you must earn" row MISSING`);

    if (!hasBadSign)  pass(`L2-${theme}: stale "− PAYE gross-up" row gone`);
    else              fail(`L2-${theme}: stale "− PAYE gross-up" row still present`);

    if (!hasBadLabel) pass(`L2-${theme}: old bare "Income you must earn" (without "=") not present`);
    else              fail(`L2-${theme}: old bare "Income you must earn" label still present`);
  }

  // ── L3 — playground value regression (always runs) ──────────────────────────
  console.log(`\n── [${theme}] L3 — playground value regression (L1b from #734)`);
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [STORAGE_KEY, { value: KNOWN_GROSS, preTaxAlreadyApplied: true }],
  );

  const commissionTab = page.locator('[data-testid="agent-tab-commission"]').first();
  await commissionTab.scrollIntoViewIfNeeded().catch(() => {});
  await commissionTab.click({ force: true });

  const incomeInput = page.locator('#gdt-income-goal-ttd');
  try {
    await incomeInput.waitFor({ state: 'visible', timeout: 20_000 });
    // Wait until React has populated the input value (avoids empty-read on fast machines).
    await page.waitForFunction(
      (sel) => { const el = document.querySelector(sel); return el && el.value !== ''; },
      '#gdt-income-goal-ttd',
      { timeout: 10_000 },
    );
    const rawVal = await incomeInput.inputValue();
    const val    = parseFloat(rawVal);
    if (Math.abs(val - KNOWN_GROSS) < 1) {
      pass(`L3-${theme}: income goal = ${val} (correct, NOT ${DOUBLE_TAX} double-tax)`);
    } else if (Math.abs(val - DOUBLE_TAX) < 1000) {
      fail(`L3-${theme}: income goal shows DOUBLE-TAXED value`, `got=${val} expected=${KNOWN_GROSS}`);
    } else {
      fail(`L3-${theme}: income goal unexpected value`, `got=${val} expected=${KNOWN_GROSS}`);
    }
  } catch {
    fail(`L3-${theme}: Income Goal (TTD) input not visible within 20s`);
  }

  await page.screenshot({ path: join(SS_DIR, `commission-${theme}.png`), fullPage: false });
  formatCaptureReport(cap);
}

async function run() {
  const required = ['VERCEL_BYPASS_TOKEN', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  console.log(`\n[${stamp()}] PR #735 smoke — ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  const clear = installGlobalTimeout(300_000, () => browser.close());
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

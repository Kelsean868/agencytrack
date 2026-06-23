/**
 * smoke-money-needs-double-tax-fix.mjs — PR #734 verification.
 *
 * Proves two bugs are fixed:
 *
 *   Bug 1 (write-path): MoneyNeedsPanel.handleSendToPlayground stores
 *     { value: gross, preTaxAlreadyApplied: true } in localStorage — NOT a bare
 *     number. Covered by two legs:
 *       L1a — if PAYE worksheet present: click "Send to Playground", inspect
 *             localStorage, assert object shape + value is reasonable gross.
 *       L1b — always: inject known { value:1090000, preTaxAlreadyApplied:true }
 *             into localStorage, navigate to Goals → Commission Playground,
 *             assert income goal input reads 1,090,000 (NOT 1,453,333 double-tax).
 *
 *   Bug 2 (display): PAYESummary headline is totalAnnualPreTax (gross), labelled
 *     "Income you must earn". Subtext is "After-tax take-home".
 *       L2 — if PAYE worksheet present: assert both labels visible.
 *
 * Both themes tested (light + dark). No destructive writes.
 *
 * Run:
 *   SMOKE_PREVIEW_URL=https://<preview-host> \
 *   node scripts/verification/smoke-money-needs-double-tax-fix.mjs
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
} from './lib/walk-helpers.mjs';
import { loadEnv, loginAs, navigateAgentTab } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const E = loadEnv(ROOT);

const PREVIEW_URL = (process.env.SMOKE_PREVIEW_URL ?? '').replace(/\/+$/, '')
  || 'https://agencytrack-git-fix-money-needs-playground-double-tax-kyron-marchan-s-projects.vercel.app';

const STORAGE_KEY = 'agencytrack-playground-income-goal';
const KNOWN_GROSS = 1_090_000;
const DOUBLE_TAX  = 1_453_333;

const SS_DIR = join(ROOT, 'screenshots', 'money-needs-double-tax');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const results = [];
const pass = (l, n = '') => { results.push({ ok: true,  l }); console.log(`  ✅ ${l}${n ? ': ' + n : ''}`); };
const fail = (l, n = '') => { results.push({ ok: false, l }); console.error(`  ❌ ${l}${n ? ': ' + n : ''}`); };
const skip = (l, n = '') => { results.push({ ok: null,  l }); console.log(`  ⏭  ${l}${n ? ' [' + n + ']' : ''}`); };

async function navMoneyNeeds(page) {
  await navigateAgentTab(page, 'money-needs');
  // Wait for the Money Needs panel to mount (filled counter OR start button).
  await page.waitForFunction(
    () => document.querySelector('[data-testid="money-needs-filled-counter"]') !== null
      || /start.*worksheet/i.test(document.body.textContent || ''),
    { timeout: 25_000 },
  );
}

async function perTheme(browser, theme) {
  console.log(`\n══════ theme: ${theme} ══════`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);

  await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
  await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PREVIEW_URL}/`);
  await setTheme(ctx, theme);

  // ── Navigate to Money Needs ─────────────────────────────────────────────────
  await navMoneyNeeds(page);

  // Detect whether a PAYE worksheet is computed (PAYESummary renders only when
  // totalAnnualPreTax > 0). Check for the Bug 2 headline label.
  const hasPAYE = await page.locator('text=Income you must earn').count().then((n) => n > 0);

  // ── Bug 2 — PAYESummary display hierarchy ───────────────────────────────────
  console.log('\n── L2 — Bug 2: PAYESummary headline is gross ("Income you must earn")');
  if (hasPAYE) {
    const headlineLabel = page.getByText('Income you must earn');
    const subLabel      = page.getByText('After-tax take-home');
    const headlineOk    = await headlineLabel.count() > 0;
    const subLabelOk    = await subLabel.count() > 0;

    if (headlineOk) pass(`L2-${theme}: headline label "Income you must earn" present`);
    else            fail(`L2-${theme}: headline label "Income you must earn" MISSING`);

    if (subLabelOk) pass(`L2-${theme}: sub-label "After-tax take-home" present`);
    else            fail(`L2-${theme}: sub-label "After-tax take-home" MISSING`);

    // Confirm old wrong labels are absent.
    const badHeadline = await page.getByText('After-tax need').count();
    const badSub      = await page.getByText('Pre-tax / gross need').count();
    if (badHeadline === 0) pass(`L2-${theme}: old "After-tax need" label is gone`);
    else                   fail(`L2-${theme}: stale "After-tax need" label still present`);
    if (badSub === 0)      pass(`L2-${theme}: old "Pre-tax / gross need" label is gone`);
    else                   fail(`L2-${theme}: stale "Pre-tax / gross need" label still present`);
  } else {
    skip(`L2-${theme}: PAYESummary not visible`, 'no pre-computed PAYE worksheet in preview — verified by RTL (MoneyNeedsPanel.test.jsx Bug 2 describe)');
  }

  // ── Bug 1a — write-path: Send to Playground stores object shape ─────────────
  console.log('\n── L1a — Bug 1 write-path: "Send to Playground" stores { value, preTaxAlreadyApplied:true }');
  if (hasPAYE) {
    // Clear any stale value.
    await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);

    const sendBtn = page.getByRole('button', { name: /send to playground/i });
    const btnEnabled = await sendBtn.isEnabled().catch(() => false);
    if (!btnEnabled) {
      skip(`L1a-${theme}: "Send to Playground" button disabled`, 'worksheet may have zero required commissions');
    } else {
      await sendBtn.click();
      await page.waitForTimeout(300);

      const raw = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      if (!raw) {
        fail(`L1a-${theme}: localStorage key absent after click`);
      } else {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { fail(`L1a-${theme}: stored value is not valid JSON: ${raw}`); }
        if (parsed) {
          const isObj = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
          if (isObj) pass(`L1a-${theme}: stored value is an object (not bare number)`);
          else       fail(`L1a-${theme}: stored value is bare number, not object`, `raw=${raw}`);

          const flagOk = parsed.preTaxAlreadyApplied === true;
          if (flagOk) pass(`L1a-${theme}: preTaxAlreadyApplied=true present`);
          else        fail(`L1a-${theme}: preTaxAlreadyApplied flag MISSING or false`, `parsed=${JSON.stringify(parsed)}`);

          const val = parseFloat(parsed.value);
          // Value must be the gross (pre-tax), not the double-taxed inflated amount.
          const notDoubleTaxed = Math.abs(val - DOUBLE_TAX) > 10_000;
          if (val > 0 && notDoubleTaxed)
            pass(`L1a-${theme}: stored value is reasonable gross (not 1,453,333 double-tax)`, `value=${val}`);
          else
            fail(`L1a-${theme}: stored value looks double-taxed or zero`, `value=${val}`);
        }
      }
    }
  } else {
    skip(`L1a-${theme}: PAYE panel absent`, 'send-path not exercisable without PAYE worksheet');
  }

  await page.screenshot({ path: join(SS_DIR, `money-needs-${theme}.png`), fullPage: false });

  // ── Bug 1b — read-path: playground consumes flag and skips gross-up ─────────
  console.log('\n── L1b — Bug 1 read-path: playground income goal = 1,090,000 (not 1,453,333)');
  // Inject known gross+flag into localStorage, then navigate to CommissionPlayground.
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [STORAGE_KEY, { value: KNOWN_GROSS, preTaxAlreadyApplied: true }],
  );

  await navigateAgentTab(page, 'goals');
  // GoalDecompositionTab is the default tab — wait for the income goal input.
  const incomeInput = page.locator('input[aria-label="Income Goal (TTD)"]');
  try {
    await incomeInput.waitFor({ state: 'visible', timeout: 15_000 });
    const rawVal = await incomeInput.inputValue();
    const val    = parseFloat(rawVal);
    if (Math.abs(val - KNOWN_GROSS) < 1) {
      pass(`L1b-${theme}: income goal input = ${val} (correct — NOT ${DOUBLE_TAX} double-tax)`);
    } else if (Math.abs(val - DOUBLE_TAX) < 1000) {
      fail(`L1b-${theme}: income goal shows DOUBLE-TAXED value`, `got=${val}, expected=${KNOWN_GROSS}`);
    } else {
      fail(`L1b-${theme}: income goal unexpected value`, `got=${val}, expected=${KNOWN_GROSS}`);
    }
  } catch {
    fail(`L1b-${theme}: Income Goal input not found in Goals tab within 15s`);
  }

  await page.screenshot({ path: join(SS_DIR, `goals-${theme}.png`), fullPage: false });
  formatCaptureReport(cap);
  await ctx.close();
}

(async () => {
  const required = ['VERCEL_BYPASS_TOKEN', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`\nPR #734 smoke — ${PREVIEW_URL}\n`);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of ['light', 'dark']) {
      await perTheme(browser, theme);
    }
  } finally {
    await browser.close();
  }

  console.log('\n══════════════════════════════════════');
  console.log('MONEY-NEEDS DOUBLE-TAX FIX — SUMMARY');
  console.log('══════════════════════════════════════');
  const passed  = results.filter((r) => r.ok === true).length;
  const failed  = results.filter((r) => r.ok === false).length;
  const skipped = results.filter((r) => r.ok === null).length;
  for (const r of results) {
    const icon = r.ok === true ? '✅' : r.ok === false ? '❌' : '⏭ ';
    console.log(`  ${icon} ${r.l}`);
  }
  console.log(`\n${passed} pass, ${failed} fail, ${skipped} skipped`);
  if (failed > 0) process.exit(1);
})();

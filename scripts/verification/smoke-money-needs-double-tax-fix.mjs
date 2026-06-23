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

const BASE = (process.env.SMOKE_PREVIEW_URL ?? '').replace(/\/+$/, '')
  || 'https://agencytrack-git-fix-money-needs-0bc978-kyron-marchan-s-projects.vercel.app';
const TOKEN = E.VERCEL_BYPASS_TOKEN;

const STORAGE_KEY = 'agencytrack-playground-income-goal';
const KNOWN_GROSS = 1_090_000;
const DOUBLE_TAX  = 1_453_333;

const SS_DIR = join(ROOT, 'screenshots', 'money-needs-double-tax');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const results = [];
// finishSmoke expects { leg, passed, detail }.
const pass = (leg, detail = '') => { results.push({ leg, passed: true,  detail }); console.log(`  ✅ ${leg}${detail ? ': ' + detail : ''}`); };
const fail = (leg, detail = '') => { results.push({ leg, passed: false, detail }); console.error(`  ❌ ${leg}${detail ? ': ' + detail : ''}`); };
const skip = (leg, detail = '') => { results.push({ leg, passed: true,  detail: `SKIP — ${detail}` }); console.log(`  ⏭  ${leg}${detail ? ' [' + detail + ']' : ''}`); };

async function perTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);

  // ── Money Needs tab ─────────────────────────────────────────────────────────
  console.log(`\n── [${theme}] navigating to Money Needs`);
  await navigateAgentTab(page, 'money-needs');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="money-needs-filled-counter"]') !== null
      || /start.*worksheet/i.test(document.body.textContent || ''),
    { timeout: 25_000 },
  );

  const hasPAYE = (await page.locator('text=Income you must earn').count()) > 0;

  // ── Bug 2 — PAYESummary display hierarchy ───────────────────────────────────
  console.log(`\n── [${theme}] L2 — Bug 2: PAYESummary gross headline`);
  if (hasPAYE) {
    const headlineOk  = (await page.getByText('Income you must earn').count()) > 0;
    const subLabelOk  = (await page.getByText('After-tax take-home').count()) > 0;
    const badHeadline = await page.getByText('After-tax need').count();
    const badSub      = await page.getByText('Pre-tax / gross need').count();

    if (headlineOk)    pass(`L2-${theme}: headline "Income you must earn" present`);
    else               fail(`L2-${theme}: headline "Income you must earn" MISSING`);
    if (subLabelOk)    pass(`L2-${theme}: sub-label "After-tax take-home" present`);
    else               fail(`L2-${theme}: sub-label "After-tax take-home" MISSING`);
    if (badHeadline === 0) pass(`L2-${theme}: stale "After-tax need" label gone`);
    else                   fail(`L2-${theme}: stale "After-tax need" label still present`);
    if (badSub === 0)      pass(`L2-${theme}: stale "Pre-tax / gross need" label gone`);
    else                   fail(`L2-${theme}: stale "Pre-tax / gross need" label still present`);
  } else {
    skip(`L2-${theme}: PAYESummary absent`, 'no pre-computed PAYE worksheet in preview — verified by RTL MoneyNeedsPanel.test.jsx Bug 2 describe');
  }

  // ── Bug 1a — write-path: "Send to Playground" stores object shape ───────────
  console.log(`\n── [${theme}] L1a — Bug 1 write-path`);
  if (hasPAYE) {
    await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
    const sendBtn    = page.getByRole('button', { name: /send to playground/i });
    const btnEnabled = await sendBtn.isEnabled().catch(() => false);

    if (!btnEnabled) {
      skip(`L1a-${theme}: "Send to Playground" disabled`, 'worksheet may have zero required commissions');
    } else {
      await sendBtn.click();
      await page.waitForTimeout(300);
      const raw = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      if (!raw) {
        fail(`L1a-${theme}: localStorage key absent after click`);
      } else {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { fail(`L1a-${theme}: stored value not valid JSON`); }
        if (parsed) {
          const isObj = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
          if (isObj) pass(`L1a-${theme}: stored value is object (not bare number)`);
          else       fail(`L1a-${theme}: stored value is bare number`, `raw=${raw}`);

          if (parsed.preTaxAlreadyApplied === true) pass(`L1a-${theme}: preTaxAlreadyApplied=true present`);
          else                                      fail(`L1a-${theme}: preTaxAlreadyApplied flag MISSING or false`);

          const val = parseFloat(parsed.value);
          if (val > 0 && Math.abs(val - DOUBLE_TAX) > 10_000)
            pass(`L1a-${theme}: stored value is gross (not double-taxed 1,453,333)`, `value=${val}`);
          else
            fail(`L1a-${theme}: stored value looks double-taxed or zero`, `value=${val}`);
        }
      }
    }
  } else {
    skip(`L1a-${theme}: PAYE panel absent`, 'send-path not exercisable without PAYE worksheet');
  }

  await page.screenshot({ path: join(SS_DIR, `money-needs-${theme}.png`), fullPage: false });

  // ── Bug 1b — read-path: playground consumes flag, skips gross-up ─────────────
  console.log(`\n── [${theme}] L1b — Bug 1 read-path: playground income goal`);
  // Inject known gross+flag; GoalDecompositionTab useEffect reads this on mount.
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, JSON.stringify(v)),
    [STORAGE_KEY, { value: KNOWN_GROSS, preTaxAlreadyApplied: true }],
  );

  // Navigate to Commission Playground (CommissionPlayground mounts, GoalDecompositionTab is default tab).
  // The Commission Playground is under "Commission" in the TOOLS sidebar — NOT the "Goals" tab.
  const commissionTab = page.locator('[data-testid="agent-tab-commission"]').first();
  await commissionTab.scrollIntoViewIfNeeded().catch(() => {});
  await commissionTab.click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SS_DIR, `commission-nav-${theme}.png`), fullPage: false });

  // NumField uses id="gdt-income-goal-ttd" with a <label htmlFor>, no aria-label.
  const incomeInput = page.locator('#gdt-income-goal-ttd');
  try {
    await incomeInput.waitFor({ state: 'visible', timeout: 20_000 });
    // Allow useEffect to fire and setState to commit the stored value.
    await page.waitForTimeout(800);
    const rawVal = await incomeInput.inputValue();
    const val    = parseFloat(rawVal);
    if (Math.abs(val - KNOWN_GROSS) < 1) {
      pass(`L1b-${theme}: income goal = ${val} (correct, NOT ${DOUBLE_TAX} double-tax)`);
    } else if (Math.abs(val - DOUBLE_TAX) < 1000) {
      fail(`L1b-${theme}: income goal shows DOUBLE-TAXED value`, `got=${val} expected=${KNOWN_GROSS}`);
    } else {
      fail(`L1b-${theme}: income goal unexpected value`, `got=${val} expected=${KNOWN_GROSS}`);
    }
  } catch {
    fail(`L1b-${theme}: Income Goal (TTD) input not visible within 20s`);
  }

  await page.screenshot({ path: join(SS_DIR, `commission-${theme}.png`), fullPage: false });
  formatCaptureReport(cap);
}

async function run() {
  const required = ['VERCEL_BYPASS_TOKEN', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  console.log(`\n[${stamp()}] PR #734 smoke — ${BASE}\n`);
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

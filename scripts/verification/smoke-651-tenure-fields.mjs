/**
 * smoke-651-tenure-fields.mjs — write-verify smoke for PR #651
 *
 * Tests the contract date + industry tenure fields added to WizardIdentity.
 *
 * Legs:
 *   identity-light-write   Enter 2024-12-15 + Yes → assert computed months
 *                          matches independent expectation AND ≤ 18 (new side)
 *                          → save → reload → back → locked state shown
 *   identity-dark-check    Dark mode: locked state renders, no console errors
 *
 * RE-RUN NOTE: Leg 1 writes write-once tenure fields to the A11Y agent doc.
 * Subsequent re-runs will find the fields already locked (smoke will surface
 * this at the "pre-condition: contract date NOT locked" check). Reset via:
 *   node scripts/maintenance/reset-onboarding-tenure.mjs --email $A11Y_AGENT_EMAIL
 *
 * BOUNDARY NOTE: The 18-month assertion (monthsAtTatil ≤ 18) is valid while
 * 2024-12-15 is within 18 months of today (i.e., before 2026-07-15). After
 * that date the independent computation returns > 18 and the boundary assertion
 * is skipped with a note; all other assertions still run.
 *
 * Run:
 *   node scripts/verification/smoke-651-tenure-fields.mjs
 *   SMOKE_BASE_URL=https://... node scripts/verification/smoke-651-tenure-fields.mjs
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import {
  setupBypassSession,
  setTheme,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  stamp,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

// ── env ───────────────────────────────────────────────────────────────────────
const envVars = loadEnv(resolve(process.cwd(), '.env.local'));
for (const [k, v] of Object.entries(envVars)) {
  if (!(k in process.env)) process.env[k] = v;
}
const req = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing required env var: ${k}`);
  return v;
};

const TOKEN       = req('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = req('A11Y_AGENT_EMAIL');
const AGENT_PASS  = req('A11Y_AGENT_PASSWORD');

const BASE_URL = resolveSmokeBaseUrl({ defaultHost: 'agencytrack-git-feat-onboarding-tenure-fields-kyron-marchan-s-projects.vercel.app' });

// ── result tracking ──────────────────────────────────────────────────────────
const results = [];
const record = (leg, passed, detail) => {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'}  ${leg}: ${detail}`);
};

const clearGlobalTimeout = installGlobalTimeout(240_000, () => finishSmoke(results));

// ── independent month computation (does NOT call app code) ───────────────────
const CONTRACT_DATE = '2024-12-15';

function independentMonthsFromDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const nowTT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date());
  const [ty, tm, td] = nowTT.split('-').map(Number);
  let months = (ty - y) * 12 + (tm - m);
  if (td < d) months--;
  return Math.max(0, months);
}

const EXPECTED_MONTHS = independentMonthsFromDate(CONTRACT_DATE);
console.log(`[${stamp()}]  independent expected monthsAtTatil for ${CONTRACT_DATE}: ${EXPECTED_MONTHS}`);

// ── helpers ───────────────────────────────────────────────────────────────────
async function loginAsAgent(page, baseUrl, email, pass) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
}

async function waitForIdentityStep(page) {
  await page.waitForSelector('[data-testid="onboarding-wizard"]', { timeout: 45_000 });
  // If on Welcome screen, click "Get Started" to advance to Identity
  const getStartedBtn = await page.$('button:has-text("Get Started")');
  if (getStartedBtn) await getStartedBtn.click();
  // Identity step has the "Contract start date" label
  return page.waitForSelector('label[for="wizard-contract-date"]', { timeout: 20_000 }).catch(() => null);
}

// ── Leg 1: light mode — write + persisted-locked verify ──────────────────────
async function runWriteLeg(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupBypassSession(context, BASE_URL, TOKEN);
  await setTheme(context, 'light');

  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await loginAsAgent(page, BASE_URL, AGENT_EMAIL, AGENT_PASS);

    const identityLabel = await waitForIdentityStep(page);
    if (!identityLabel) {
      record('identity-light-write', false, 'identity step did not appear — agent may not be onboarding-reset');
      return;
    }

    // Pre-condition: contract date field must NOT be locked (first run only)
    const contractInput = await page.$('#wizard-contract-date');
    if (!contractInput) {
      record('identity-light-write', false,
        'PRE-CONDITION FAIL: #wizard-contract-date input not found — fields may already be locked (re-run requires tenure reset). See RE-RUN NOTE in script header.');
      return;
    }
    record('identity-light-precondition', true, 'contract date input present (not locked)');

    // Enter fixed contract date
    await page.fill('#wizard-contract-date', CONTRACT_DATE);

    // First-company question should appear
    const firstCompanyLabel = await page.waitForSelector(
      'text=Is Tatil Life your first company',
      { timeout: 5_000 },
    ).catch(() => null);
    if (!firstCompanyLabel) {
      record('identity-light-write', false, 'first-company question did not appear after entering contract date');
      return;
    }

    // Click "Yes"
    await page.click('button:has-text("Yes")');

    // Read derived months from data-testid
    const derivedEl = await page.waitForSelector('[data-testid="wizard-derived-months"]', { timeout: 5_000 }).catch(() => null);
    if (!derivedEl) {
      record('identity-light-months', false, 'wizard-derived-months element not found after clicking Yes');
    } else {
      const derivedText = await derivedEl.textContent();
      // Extract number from text like "Industry tenure derived from your contract date: 18 months."
      const match = derivedText.match(/(\d+)\s+month/);
      const appMonths = match ? parseInt(match[1], 10) : NaN;

      const monthsMatch = appMonths === EXPECTED_MONTHS;
      record('identity-light-months-match', monthsMatch,
        monthsMatch
          ? `app shows ${appMonths} months — matches independent expected ${EXPECTED_MONTHS}`
          : `MISMATCH: app shows ${appMonths}, independent expected ${EXPECTED_MONTHS}`);

      if (EXPECTED_MONTHS <= 18) {
        const onNewSide = appMonths <= 18;
        record('identity-light-boundary', onNewSide,
          onNewSide
            ? `${appMonths} ≤ 18 — correct "new agent" side of boundary`
            : `${appMonths} > 18 — WRONG SIDE of 18-month boundary`);
      } else {
        record('identity-light-boundary', true,
          `SKIPPED — ${EXPECTED_MONTHS} months elapsed from ${CONTRACT_DATE} exceeds 18-month window (smoke expiry)`);
      }
    }

    // Save
    await page.click('button[type="submit"]');

    // Wizard should advance to Money Needs
    const moneyNeedsEl = await page.waitForSelector(
      'text=take home',
      { timeout: 20_000 },
    ).catch(() => null);
    if (!moneyNeedsEl) {
      record('identity-light-save', false, 'wizard did not advance to Money Needs after save');
      return;
    }
    record('identity-light-save', true, 'wizard advanced to Money Needs — save succeeded');

    // Hard reload to force profile refetch
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for wizard (localStorage points to Money Needs)
    await page.waitForSelector('[data-testid="onboarding-wizard"]', { timeout: 45_000 });

    // Navigate back to Identity step
    const backBtn = await page.waitForSelector('button:has-text("← Back")', { timeout: 10_000 }).catch(() => null);
    if (!backBtn) {
      record('identity-light-reload', false, 'Back button not found after reload — unexpected wizard state');
      return;
    }
    await backBtn.click();

    // Identity step should now show locked contract date
    const lockedEl = await page.waitForSelector('#wizard-contract-date', { timeout: 5_000 }).catch(() => null);
    if (lockedEl) {
      record('identity-light-locked', false,
        'contract date INPUT still present after reload — expected locked display (write may have failed)');
    } else {
      // No input → should be locked display
      const lockedDisplay = await page.$(`text=${CONTRACT_DATE}`);
      record('identity-light-locked', !!lockedDisplay,
        lockedDisplay
          ? `contract date "${CONTRACT_DATE}" shown as locked ✓`
          : `locked display not found — could not confirm persistence`);
    }

    const report = formatCaptureReport(capture);
    const errors = capture.consoleMessages.filter(m => m.type === 'error');
    record('identity-light-no-errors', errors.length === 0,
      errors.length === 0 ? 'no console errors' : `${errors.length} error(s): ${errors.map(e => e.text).slice(0, 2).join('; ')}`);
    if (report) console.log(report);
  } finally {
    await context.close();
  }
}

// ── Leg 2: dark mode — locked state renders without errors ────────────────────
async function runDarkLeg(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupBypassSession(context, BASE_URL, TOKEN);
  await setTheme(context, 'dark');

  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await loginAsAgent(page, BASE_URL, AGENT_EMAIL, AGENT_PASS);
    await page.waitForSelector('[data-testid="onboarding-wizard"]', { timeout: 45_000 });

    // Navigate back to identity step (localStorage should point to Money Needs after leg 1)
    const backBtn = await page.waitForSelector('button:has-text("← Back")', { timeout: 10_000 }).catch(() => null);
    if (backBtn) {
      await backBtn.click();
      const identityLabel = await page.waitForSelector('label[for="wizard-contract-date"]', { timeout: 10_000 }).catch(() => null);
      if (!identityLabel) {
        record('identity-dark-check', false, 'identity step did not appear after back navigation in dark mode');
        return;
      }
      const contractInput = await page.$('#wizard-contract-date');
      const isLocked = !contractInput;
      record('identity-dark-locked', isLocked,
        isLocked
          ? 'contract date locked display present in dark mode'
          : 'WARNING: contract date shows as input — tenure may not have been written (run light leg first)');
    } else {
      record('identity-dark-check', false, 'Back button not found — unexpected wizard state in dark mode');
      return;
    }

    const report = formatCaptureReport(capture);
    const errors = capture.consoleMessages.filter(m => m.type === 'error');
    record('identity-dark-no-errors', errors.length === 0,
      errors.length === 0 ? 'no console errors in dark mode' : `${errors.length} error(s): ${errors.map(e => e.text).slice(0, 2).join('; ')}`);
    if (report) console.log(report);
  } finally {
    await context.close();
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`smoke-651-tenure-fields  BASE_URL=${BASE_URL}`);
  console.log(`CONTRACT_DATE=${CONTRACT_DATE}  EXPECTED_MONTHS=${EXPECTED_MONTHS}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    await runWriteLeg(browser);
    await runDarkLeg(browser);
  } finally {
    await browser.close();
  }

  finishSmoke(results, { clearTimeout: clearGlobalTimeout });
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});

/**
 * smoke-651-tenure-fields.mjs — write-verify smoke for PR #651
 *
 * Legs:
 *   floor-reject-error-msg      Enter date + No + 10 months (< floor) → error shown
 *   floor-reject-button-disabled Submit disabled while floor violated
 *   seasoned-valid-no-error      Enter date + No + 24 months (>= floor) → no error
 *   seasoned-save                Seasoned save → wizard advances to Money Needs
 *   seasoned-locked              Reload + Back → contract date locked
 *   seasoned-industry-months     Locked display shows monthsInIndustry = 24
 *   seasoned-no-errors           No console errors on seasoned path
 *   [mid-smoke reset]
 *   derived-precondition         Contract date input present (not locked) after reset
 *   derived-months-match         App computed months == independent expected
 *   derived-boundary             Computed months <= 18 (new-agent side)
 *   derived-save                 Derived save → wizard advances to Money Needs
 *   derived-locked               Reload + Back → contract date locked
 *   derived-industry-months      Locked display shows monthsInIndustry = EXPECTED (derived = Tatil)
 *   derived-no-errors            No console errors on derived path
 *   dark-locked                  Dark mode: contract date locked after derived write
 *   dark-industry-months         Dark mode: locked display shows monthsInIndustry = EXPECTED
 *   dark-no-errors               No console errors in dark mode
 *
 * RE-RUN NOTE: Fields are write-once. The smoke resets mid-run (between seasoned and
 * derived legs) and post-run leaves the derived-path data in place. On a full re-run,
 * reset the agent first:
 *   node scripts/maintenance/reset-onboarding-tenure.mjs --email $A11Y_AGENT_EMAIL --apply
 *
 * BOUNDARY NOTE: The 18-month boundary assertion (derived-boundary) is valid while
 * 2024-12-15 is within 18 months of today (before 2026-07-15). After that the
 * boundary check is skipped with a note; all other assertions still run.
 *
 * Run:
 *   node scripts/verification/smoke-651-tenure-fields.mjs
 *   SMOKE_BASE_URL=https://... node scripts/verification/smoke-651-tenure-fields.mjs
 */

import { chromium } from 'playwright';
import { createRequire } from 'module';
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

const require = createRequire(import.meta.url);

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
const API_KEY     = req('VITE_FIREBASE_API_KEY');

const BASE_URL = resolveSmokeBaseUrl({ defaultHost: 'agencytrack-git-feat-onboarding-4bee45-kyron-marchan-s-projects.vercel.app' });

// ── result tracking ──────────────────────────────────────────────────────────
const results = [];
const record = (leg, passed, detail) => {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'}  ${leg}: ${detail}`);
};

const clearGlobalTimeout = installGlobalTimeout(480_000, () => finishSmoke(results));

// ── constants ─────────────────────────────────────────────────────────────────
const CONTRACT_DATE           = '2024-12-15';
const FLOOR_VIOLATION_MONTHS  = 10; // always < computed 18 months for 2024-12-15
const SEASONED_INDUSTRY_MONTHS = 24; // clearly >= 18 floor

// ── independent month computation (does NOT call app code) ───────────────────
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

// ── Admin SDK (for mid-smoke reset) ──────────────────────────────────────────
const admin = require('../../functions/node_modules/firebase-admin');
admin.initializeApp();
const adminDb = admin.firestore();
const YEAR = new Date().getFullYear();

async function resolveAgentIds() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: AGENT_EMAIL, password: AGENT_PASS, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`Auth REST sign-in failed: ${res.status}`);
  const { idToken, localId } = await res.json();
  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
  return { uid: localId, tenantId: claims.tenantId };
}

async function resetAgent(tenantId, uid) {
  const userRef  = adminDb.doc(`tenants/${tenantId}/users/${uid}`);
  const mnRef    = adminDb.doc(`tenants/${tenantId}/users/${uid}/moneyNeeds/${YEAR}`);
  const ypRef    = adminDb.doc(`tenants/${tenantId}/users/${uid}/yearPlan/${YEAR}`);
  const goalsRef = adminDb.doc(`tenants/${tenantId}/goals/${uid}`);
  await userRef.update({
    agentNumber:        admin.firestore.FieldValue.delete(),
    dateOfBirth:        admin.firestore.FieldValue.delete(),
    contractStartDate:  admin.firestore.FieldValue.delete(),
    monthsAtTatil:      admin.firestore.FieldValue.delete(),
    monthsInIndustry:   admin.firestore.FieldValue.delete(),
    onboardingComplete: admin.firestore.FieldValue.delete(),
    phone:              admin.firestore.FieldValue.delete(),
    bio:                admin.firestore.FieldValue.delete(),
  });
  await Promise.allSettled([
    mnRef.delete(),
    ypRef.delete(),
    goalsRef.update({
      personalAnnualAPI:      admin.firestore.FieldValue.delete(),
      personalAnnualApps:     admin.firestore.FieldValue.delete(),
      gamePlanCommitted:      admin.firestore.FieldValue.delete(),
      playgroundAvgPolicyAPI: admin.firestore.FieldValue.delete(),
    }),
  ]);
  console.log(`[${stamp()}]  mid-smoke reset complete`);
}

// ── shared helpers ────────────────────────────────────────────────────────────
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
  return page.waitForSelector('label[for="wizard-contract-date"]', { timeout: 20_000 }).catch(() => null);
}

// ── Leg 0: floor-reject — UI validation only, no write ───────────────────────
async function runFloorRejectLeg(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupBypassSession(context, BASE_URL, TOKEN);
  await setTheme(context, 'light');
  const page = await context.newPage();
  captureConsoleAndNetwork(page);
  try {
    await loginAsAgent(page, BASE_URL, AGENT_EMAIL, AGENT_PASS);
    const identityLabel = await waitForIdentityStep(page);
    if (!identityLabel) {
      record('floor-reject-error-msg', false, 'identity step did not appear — agent may already be past onboarding');
      record('floor-reject-button-disabled', false, 'skipped — identity step not reached');
      return;
    }
    await page.fill('#wizard-contract-date', CONTRACT_DATE);
    const noBtn = await page.waitForSelector('button:has-text("No")', { timeout: 5_000 }).catch(() => null);
    if (!noBtn) {
      record('floor-reject-error-msg', false, 'No button did not appear after entering contract date');
      record('floor-reject-button-disabled', false, 'skipped');
      return;
    }
    await noBtn.click();
    await page.waitForSelector('#wizard-industry-months', { timeout: 5_000 });
    await page.fill('#wizard-industry-months', String(FLOOR_VIOLATION_MONTHS));
    // Error message should appear
    const errMsg = await page.waitForSelector(
      `text=can't be less than your Tatil tenure`,
      { timeout: 3_000 },
    ).catch(() => null);
    record('floor-reject-error-msg', !!errMsg,
      errMsg
        ? `error shown for ${FLOOR_VIOLATION_MONTHS} mo (floor=${EXPECTED_MONTHS} mo)`
        : `FAIL: error NOT shown for ${FLOOR_VIOLATION_MONTHS} mo < ${EXPECTED_MONTHS} mo floor`);
    // Submit button should be disabled
    const isDisabled = await page.locator('button[type="submit"]').isDisabled();
    record('floor-reject-button-disabled', isDisabled,
      isDisabled
        ? 'submit disabled when industry < Tatil tenure'
        : 'FAIL: submit enabled despite floor violation');
  } finally {
    await context.close();
  }
}

// ── Leg 1: seasoned write — No path, explicit industry months ─────────────────
async function runSeasonedWriteLeg(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupBypassSession(context, BASE_URL, TOKEN);
  await setTheme(context, 'light');
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);
  try {
    await loginAsAgent(page, BASE_URL, AGENT_EMAIL, AGENT_PASS);
    const identityLabel = await waitForIdentityStep(page);
    if (!identityLabel) {
      record('seasoned-save', false, 'identity step did not appear');
      return;
    }
    if (!(await page.$('#wizard-contract-date'))) {
      record('seasoned-save', false, 'PRE-CONDITION FAIL: contract date already locked — run reset first');
      return;
    }
    await page.fill('#wizard-contract-date', CONTRACT_DATE);
    const noBtn = await page.waitForSelector('button:has-text("No")', { timeout: 5_000 }).catch(() => null);
    if (!noBtn) {
      record('seasoned-save', false, 'No button did not appear');
      return;
    }
    await noBtn.click();
    await page.waitForSelector('#wizard-industry-months', { timeout: 5_000 });
    await page.fill('#wizard-industry-months', String(SEASONED_INDUSTRY_MONTHS));
    // Valid entry: no floor error
    const errMsg = await page.$(`text=can't be less than your Tatil tenure`);
    record('seasoned-valid-no-error', !errMsg,
      !errMsg
        ? `no floor error for ${SEASONED_INDUSTRY_MONTHS} mo (floor=${EXPECTED_MONTHS} mo)`
        : `FAIL: unexpected error for ${SEASONED_INDUSTRY_MONTHS} mo`);
    // Save
    await page.click('button[type="submit"]');
    const moneyNeedsEl = await page.waitForSelector('text=take home', { timeout: 20_000 }).catch(() => null);
    record('seasoned-save', !!moneyNeedsEl,
      moneyNeedsEl
        ? 'wizard advanced to Money Needs — seasoned save succeeded'
        : 'wizard did NOT advance after seasoned save');
    if (!moneyNeedsEl) return;
    // Reload — localStorage step=2 → wizard opens at Money Needs, Back → Identity
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="onboarding-wizard"]', { timeout: 45_000 });
    const backBtn = await page.waitForSelector('button:has-text("← Back")', { timeout: 10_000 }).catch(() => null);
    if (!backBtn) {
      record('seasoned-locked', false, 'Back button not found after reload');
      return;
    }
    await backBtn.click();
    await page.waitForSelector('label[for="wizard-contract-date"]', { timeout: 10_000 });
    // Contract date locked (no input)
    const contractInputAfter = await page.$('#wizard-contract-date');
    record('seasoned-locked', !contractInputAfter,
      !contractInputAfter
        ? `contract date locked after seasoned write`
        : 'FAIL: contract date still shows as input');
    // monthsInIndustry = SEASONED in locked display
    const industryEl = await page.$(`text=${SEASONED_INDUSTRY_MONTHS} mo in industry`);
    record('seasoned-industry-months', !!industryEl,
      industryEl
        ? `monthsInIndustry=${SEASONED_INDUSTRY_MONTHS} confirmed in locked display`
        : `FAIL: "${SEASONED_INDUSTRY_MONTHS} mo in industry" not found in locked display`);
    const errors = capture.consoleMessages.filter(m => m.type === 'error');
    record('seasoned-no-errors', errors.length === 0,
      errors.length === 0 ? 'no console errors' : `${errors.length} error(s): ${errors.map(e => e.text).slice(0, 2).join('; ')}`);
    const report = formatCaptureReport(capture);
    if (report) console.log(report);
  } finally {
    await context.close();
  }
}

// ── Leg 2: derived write — Yes path, monthsInIndustry = monthsAtTatil ─────────
async function runDerivedWriteLeg(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupBypassSession(context, BASE_URL, TOKEN);
  await setTheme(context, 'light');
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);
  try {
    await loginAsAgent(page, BASE_URL, AGENT_EMAIL, AGENT_PASS);
    const identityLabel = await waitForIdentityStep(page);
    if (!identityLabel) {
      record('derived-save', false, 'identity step did not appear');
      return;
    }
    if (!(await page.$('#wizard-contract-date'))) {
      record('derived-save', false, 'PRE-CONDITION FAIL: contract date already locked');
      return;
    }
    record('derived-precondition', true, 'contract date input present (not locked)');
    await page.fill('#wizard-contract-date', CONTRACT_DATE);
    const yesBtn = await page.waitForSelector('button:has-text("Yes")', { timeout: 5_000 }).catch(() => null);
    if (!yesBtn) {
      record('derived-save', false, 'Yes button did not appear');
      return;
    }
    await yesBtn.click();
    // Derived months hint
    const derivedEl = await page.waitForSelector('[data-testid="wizard-derived-months"]', { timeout: 5_000 }).catch(() => null);
    if (!derivedEl) {
      record('derived-months-match', false, 'wizard-derived-months element not found');
    } else {
      const derivedText = await derivedEl.textContent();
      const match = derivedText.match(/(\d+)\s+month/);
      const appMonths = match ? parseInt(match[1], 10) : NaN;
      const monthsMatch = appMonths === EXPECTED_MONTHS;
      record('derived-months-match', monthsMatch,
        monthsMatch
          ? `app shows ${appMonths} months — matches independent expected ${EXPECTED_MONTHS}`
          : `MISMATCH: app shows ${appMonths}, independent expected ${EXPECTED_MONTHS}`);
      if (EXPECTED_MONTHS <= 18) {
        record('derived-boundary', appMonths <= 18,
          appMonths <= 18
            ? `${appMonths} ≤ 18 — correct "new agent" side of boundary`
            : `${appMonths} > 18 — WRONG SIDE of 18-month boundary`);
      } else {
        record('derived-boundary', true,
          `SKIPPED — ${EXPECTED_MONTHS} months from ${CONTRACT_DATE} exceeds 18-month window`);
      }
    }
    // Save
    await page.click('button[type="submit"]');
    const moneyNeedsEl = await page.waitForSelector('text=take home', { timeout: 20_000 }).catch(() => null);
    record('derived-save', !!moneyNeedsEl,
      moneyNeedsEl
        ? 'wizard advanced to Money Needs — derived save succeeded'
        : 'wizard did NOT advance after derived save');
    if (!moneyNeedsEl) return;
    // Reload + Back
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="onboarding-wizard"]', { timeout: 45_000 });
    const backBtn = await page.waitForSelector('button:has-text("← Back")', { timeout: 10_000 }).catch(() => null);
    if (!backBtn) {
      record('derived-locked', false, 'Back button not found after reload');
      return;
    }
    await backBtn.click();
    await page.waitForSelector('label[for="wizard-contract-date"]', { timeout: 10_000 });
    const contractInputAfter = await page.$('#wizard-contract-date');
    record('derived-locked', !contractInputAfter,
      !contractInputAfter
        ? `contract date "${CONTRACT_DATE}" locked`
        : 'FAIL: contract date still shows as input');
    // monthsInIndustry = EXPECTED_MONTHS (derived == monthsAtTatil for Yes path)
    const industryEl = await page.$(`text=${EXPECTED_MONTHS} mo in industry`);
    record('derived-industry-months', !!industryEl,
      industryEl
        ? `monthsInIndustry=${EXPECTED_MONTHS} confirmed in locked display (derived = Tatil tenure)`
        : `FAIL: "${EXPECTED_MONTHS} mo in industry" not found — monthsInIndustry may not equal monthsAtTatil`);
    const errors = capture.consoleMessages.filter(m => m.type === 'error');
    record('derived-no-errors', errors.length === 0,
      errors.length === 0 ? 'no console errors' : `${errors.length} error(s): ${errors.map(e => e.text).slice(0, 2).join('; ')}`);
    const report = formatCaptureReport(capture);
    if (report) console.log(report);
  } finally {
    await context.close();
  }
}

// ── Leg 3: dark mode — locked state from derived write ────────────────────────
async function runDarkLeg(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupBypassSession(context, BASE_URL, TOKEN);
  await setTheme(context, 'dark');
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);
  try {
    await loginAsAgent(page, BASE_URL, AGENT_EMAIL, AGENT_PASS);
    // Fresh context: no localStorage, identityDone=false → wizard at Welcome
    await page.waitForSelector('[data-testid="onboarding-wizard"]', { timeout: 45_000 });
    const getStartedBtn = await page.$('button:has-text("Get Started")');
    if (getStartedBtn) await getStartedBtn.click();
    const identityLabel = await page.waitForSelector('label[for="wizard-contract-date"]', { timeout: 20_000 }).catch(() => null);
    if (!identityLabel) {
      record('dark-locked', false, 'identity step did not appear in dark mode');
      return;
    }
    // Contract date locked (from derived write in leg 2)
    const contractInput = await page.$('#wizard-contract-date');
    record('dark-locked', !contractInput,
      !contractInput
        ? 'contract date locked display present in dark mode'
        : 'WARNING: contract date shows as input — derived write may not have run');
    // monthsInIndustry present in locked display
    const industryEl = await page.$(`text=${EXPECTED_MONTHS} mo in industry`);
    record('dark-industry-months', !!industryEl,
      industryEl
        ? `monthsInIndustry=${EXPECTED_MONTHS} visible in dark mode locked display`
        : `FAIL: "${EXPECTED_MONTHS} mo in industry" not found in dark mode`);
    const report = formatCaptureReport(capture);
    const errors = capture.consoleMessages.filter(m => m.type === 'error');
    record('dark-no-errors', errors.length === 0,
      errors.length === 0 ? 'no console errors in dark mode' : `${errors.length} error(s): ${errors.map(e => e.text).slice(0, 2).join('; ')}`);
    if (report) console.log(report);
  } finally {
    await context.close();
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`smoke-651-tenure-fields  BASE_URL=${BASE_URL}`);
  console.log(`CONTRACT_DATE=${CONTRACT_DATE}  EXPECTED_MONTHS=${EXPECTED_MONTHS}`);
  console.log(`FLOOR_VIOLATION=${FLOOR_VIOLATION_MONTHS}  SEASONED=${SEASONED_INDUSTRY_MONTHS}\n`);

  // Resolve agent ids for mid-smoke reset (before launching browser)
  const { uid, tenantId } = await resolveAgentIds();
  console.log(`[${stamp()}]  agent uid=${uid}  tenantId=${tenantId}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    // Phase 1 — floor-reject (UI only, no write to Firestore)
    await runFloorRejectLeg(browser);

    // Phase 2 — seasoned write (No path, monthsInIndustry = 24)
    await runSeasonedWriteLeg(browser);

    // Phase 3 — mid-smoke reset (clear seasoned write so derived path can run)
    console.log(`\n[${stamp()}]  --- mid-smoke reset ---`);
    await resetAgent(tenantId, uid);
    console.log();

    // Phase 4 — derived write (Yes path, monthsInIndustry = monthsAtTatil = 18)
    await runDerivedWriteLeg(browser);

    // Phase 5 — dark mode (locked state from derived write)
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

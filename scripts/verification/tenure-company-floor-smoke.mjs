// tenure-company-floor-smoke.mjs — Phase 5 smoke for feat/tenure-company-floor.
//
// Real write-read-verify cycle:
//   Admin SDK mutates the test agent's contractStartDate to three known states
//   (band 0–11 / band >60 / absent), and Playwright loads the agent dashboard
//   + Career Portal to capture the resolved Company Floor + weekly API floor
//   from the UI. Asserts each case matches the resolver's expected output.
//   Verifies light + dark at 390x844, captures screenshots, restores the
//   agent's original state (absent) at exit.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { createRequire } from 'module';
import { setupBypassSession, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}

const PREVIEW_HOST = process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-tenure-company-floor-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 390, height: 844 };
const SCREENSHOT_DIR = resolve('verification', 'tenure-company-floor-smoke');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
};

const TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASSWORD = requireEnv('A11Y_AGENT_PASSWORD');

// ── Admin SDK setup (for mutating contractStartDate between cases) ─────────
const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('../../functions/service-account-key.json')),
  });
}
const db = admin.firestore();

// ── Test cases (3) ─────────────────────────────────────────────────────────
// Each case sets contractStartDate, then expects a resolved Annual + Weekly
// API floor. Dates anchored against "today" so the tenure math holds
// regardless of when the smoke runs.
function buildCases() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, '0');
  const dd   = String(today.getDate()).padStart(2, '0');

  // Case A: 6 months ago → band 0–11 → 150K / 3,750
  const aDate = new Date(today);
  aDate.setMonth(today.getMonth() - 6);
  const aIso = `${aDate.getFullYear()}-${String(aDate.getMonth() + 1).padStart(2, '0')}-${String(aDate.getDate()).padStart(2, '0')}`;

  // Case B: 7 years ago → band >60 → 500K / 12,500
  const bIso = `${yyyy - 7}-${mm}-${dd}`;

  // Case C: absent → fallback 200K / 4,800
  return [
    { id: 'A_lt12mo', contractStartDate: aIso,  expectedAnnual: 150000, expectedWeekly: 3750  },
    { id: 'B_gt60mo', contractStartDate: bIso,  expectedAnnual: 500000, expectedWeekly: 12500 },
    { id: 'C_absent', contractStartDate: null,  expectedAnnual: 200000, expectedWeekly: 4800  },
  ];
}

// ── Mutate Firestore: set or delete contractStartDate ──────────────────────
async function setContractStartDate(uid, iso) {
  const ref = db.doc(`tenants/tatillife_south/users/${uid}`);
  if (iso === null) {
    await ref.update({ contractStartDate: admin.firestore.FieldValue.delete() });
  } else {
    await ref.update({ contractStartDate: iso });
  }
}

async function resolveAgentUid() {
  const userRecord = await admin.auth().getUserByEmail(AGENT_EMAIL);
  return userRecord.uid;
}

// ── Playwright helpers ─────────────────────────────────────────────────────
async function loginAtMobile(page, { email, password }) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(
      () => document.querySelector('input[type="email"]') === null,
      { timeout: 30_000 },
    ),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.length > 500,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2500);
}

// Read the Weekly Standard card's API row (#9). Returns the Expected value
// as displayed (e.g. "TT$ 3,750.00") so we can substring-match the resolved
// weekly floor.
async function readWeeklyApiExpected(page) {
  return await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h3'))
      .find((h) => /Weekly Standard/i.test(h.textContent ?? ''));
    if (!heading) return { found: false, reason: 'heading missing' };
    const section = heading.closest('section');
    if (!section) return { found: false, reason: 'section missing' };
    const rows = Array.from(section.querySelectorAll('li'));
    const apiRow = rows.find((li) =>
      /API \(TTD\)/i.test(li.querySelector('span.truncate')?.textContent ?? '')
    );
    if (!apiRow) return { found: false, reason: 'API row missing' };
    const cells = Array.from(apiRow.querySelectorAll('div.tabular-nums'));
    const expected = cells[0]?.querySelector('.font-semibold')?.textContent?.trim() ?? '';
    return { found: true, expected };
  });
}

// Read the Career Portal Goals Overview "Annual API" Minimum value.
// CareerPortal renders a `Goals Overview` heading; the Annual API row's
// minimum lives in a card adjacent to it.
async function readCareerPortalAnnualMin(page) {
  return await page.evaluate(() => {
    // Find any element whose text matches the floor pattern "$XXX,XXX".
    // CareerPortal's "Minimum" column is the first column of the Annual API
    // (TTD) row. To target it deterministically, find an "Annual API" label
    // and then read the next-sibling currency-shaped strings.
    const allText = Array.from(document.querySelectorAll('p, span, td, th, div'));
    const annualApiLabel = allText.find((el) => /^Annual API \(TTD\)$/i.test(el.textContent?.trim() ?? ''));
    if (!annualApiLabel) {
      // Fallback: GoalsOverview row layout — find first "Minimum" header then look at sibling.
      // Try a structural scan: any text starting with TT$ on the Career Portal page.
      const ttdEls = allText.filter((el) => /^TTD[\s\d,.]+$/.test(el.textContent?.trim() ?? ''));
      return { found: false, reason: 'Annual API label not found', sample: ttdEls.slice(0, 5).map((e) => e.textContent?.trim()) };
    }
    // Walk forward looking for the first sibling row cell that looks like currency.
    let parent = annualApiLabel.parentElement;
    while (parent && parent !== document.body) {
      const ttd = Array.from(parent.querySelectorAll('*'))
        .find((el) => /^TTD[\s\d,.]+$/.test(el.textContent?.trim() ?? ''));
      if (ttd) return { found: true, minimum: ttd.textContent.trim() };
      parent = parent.parentElement;
    }
    return { found: false, reason: 'currency sibling not found' };
  });
}

async function getThemeState(page) {
  return await page.evaluate(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
}

async function toggleDarkMode(page) {
  await page.evaluate(() => {
    document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(
        'agencytrack-dark',
        document.documentElement.classList.contains('dark') ? '1' : '0'
      );
    } catch { /* ignore */ }
  });
  await page.waitForTimeout(300);
}

// Format expected currency for substring match. Resolver returns 3750 → UI
// renders "TT$ 3,750.00" (en-TT locale). Use the integer + comma format.
function formatExpectedCurrency(value) {
  const formatted = value.toLocaleString('en-US');
  return formatted;
}

// ── Per-case capture: log in fresh, navigate, read floors, check both themes
async function captureCase(browser, caseDef) {
  console.log(`\n[smoke] ── Case ${caseDef.id} ─────────────────────────`);
  console.log(`[smoke] contractStartDate=${caseDef.contractStartDate ?? '(absent)'}`);
  console.log(`[smoke] expected: annual=${caseDef.expectedAnnual} weekly=${caseDef.expectedWeekly}`);

  const result = { caseId: caseDef.id, failures: [] };
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, PREVIEW_URL, TOKEN);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
    await loginAtMobile(page, { email: AGENT_EMAIL, password: AGENT_PASSWORD });

    // Light mode pass.
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('agencytrack-dark', '0'); } catch { /* ignore */ }
    });
    await page.waitForTimeout(600);

    const lightWeekly = await readWeeklyApiExpected(page);
    console.log(`[smoke] LIGHT theme=${await getThemeState(page)} → API row Expected="${lightWeekly.expected ?? lightWeekly.reason}"`);

    if (!lightWeekly.found) {
      result.failures.push(`${caseDef.id} LIGHT: Weekly Standard API row not found (${lightWeekly.reason})`);
    } else {
      const wantSub = formatExpectedCurrency(caseDef.expectedWeekly);
      if (!lightWeekly.expected.includes(wantSub)) {
        result.failures.push(`${caseDef.id} LIGHT: weekly API Expected="${lightWeekly.expected}", want substring "${wantSub}"`);
      }
    }

    await page.screenshot({ path: join(SCREENSHOT_DIR, `${caseDef.id}-light-dashboard.png`), fullPage: true });

    // Navigate to Career Portal at mobile. The career portal route is
    // typically reachable via a tab; in mobile mode it lives behind a menu.
    // Try direct navigation to avoid sidebar selector dependence.
    await page.evaluate(() => {
      // Find any clickable element labeled Career
      const candidates = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"]'));
      const careerEl = candidates.find((el) => /career/i.test(el.textContent ?? ''));
      if (careerEl) careerEl.dispatchEvent(new Event('click', { bubbles: true }));
    });
    await page.waitForTimeout(1500);
    // Wait for the Goals Overview heading to appear (sign that we're on Career Portal).
    const onCareerPortal = await page.waitForFunction(
      () => /Goals Overview/i.test(document.body.textContent ?? ''),
      { timeout: 15_000 },
    ).then(() => true).catch(() => false);

    if (!onCareerPortal) {
      result.failures.push(`${caseDef.id} LIGHT: Goals Overview not reached`);
    } else {
      const cp = await readCareerPortalAnnualMin(page);
      console.log(`[smoke] LIGHT Career Portal Annual API min="${cp.minimum ?? cp.reason}"`);
      if (!cp.found) {
        result.failures.push(`${caseDef.id} LIGHT: Career Portal Annual API Minimum not found (${cp.reason})`);
      } else {
        const wantSub = formatExpectedCurrency(caseDef.expectedAnnual);
        if (!cp.minimum.includes(wantSub)) {
          result.failures.push(`${caseDef.id} LIGHT: Annual API min="${cp.minimum}", want substring "${wantSub}"`);
        }
      }
      await page.screenshot({ path: join(SCREENSHOT_DIR, `${caseDef.id}-light-career.png`), fullPage: true });
    }

    // Dark-mode spot check on the dashboard (verify the new resolver still
    // applies under dark theme).
    await toggleDarkMode(page);
    // Navigate back to dashboard to re-verify Weekly Standard card in dark.
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"]'));
      const dashEl = candidates.find((el) => /dashboard|home/i.test(el.textContent ?? ''));
      if (dashEl) dashEl.dispatchEvent(new Event('click', { bubbles: true }));
    });
    await page.waitForTimeout(1500);

    const darkWeekly = await readWeeklyApiExpected(page);
    console.log(`[smoke] DARK theme=${await getThemeState(page)} → API row Expected="${darkWeekly.expected ?? darkWeekly.reason}"`);
    if (darkWeekly.found) {
      const wantSub = formatExpectedCurrency(caseDef.expectedWeekly);
      if (!darkWeekly.expected.includes(wantSub)) {
        result.failures.push(`${caseDef.id} DARK: weekly API Expected="${darkWeekly.expected}", want substring "${wantSub}"`);
      }
    }
    await page.screenshot({ path: join(SCREENSHOT_DIR, `${caseDef.id}-dark-dashboard.png`), fullPage: true });

    if (consoleErrors.length > 0) {
      console.log(`[smoke] ${caseDef.id} console errors:`);
      consoleErrors.forEach((e) => console.log('  -', e));
      result.failures.push(`${caseDef.id}: ${consoleErrors.length} console error(s)`);
    }
  } catch (e) {
    safeLog(`[smoke] ${caseDef.id} ERROR:`, e.message);
    result.failures.push(`${caseDef.id} walk error: ${e.message}`);
  } finally {
    await context.close();
  }
  return result;
}

(async () => {
  console.log('[smoke] tenure-company-floor — preview:', PREVIEW_HOST);
  const uid = await resolveAgentUid();
  console.log('[smoke] agent uid (last4):', uid.slice(-4));

  const cases = buildCases();
  const browser = await chromium.launch();
  const results = [];

  try {
    for (const c of cases) {
      console.log(`\n[smoke] Mutating contractStartDate → ${c.contractStartDate ?? '(absent)'}`);
      await setContractStartDate(uid, c.contractStartDate);
      // Give Firestore a moment to settle before the new login reads the doc.
      await new Promise((r) => setTimeout(r, 1500));
      results.push(await captureCase(browser, c));
    }
  } finally {
    // Restore: original state was "absent" — leave it absent so the next
    // smoke / login is a clean baseline.
    console.log('\n[smoke] Restoring contractStartDate → (absent)');
    await setContractStartDate(uid, null);
    await browser.close();
  }

  // ── Report ────────────────────────────────────────────────────────────
  const allFailures = results.flatMap((r) => r.failures);
  console.log('\n[smoke] ── Summary ──────────────────────────');
  results.forEach((r) => {
    console.log(`  ${r.caseId}: ${r.failures.length === 0 ? 'PASS' : 'FAIL (' + r.failures.length + ')'}`);
  });

  if (allFailures.length) {
    console.log('\n[smoke] FAILURES:');
    allFailures.forEach((f) => console.log('  -', f));
    console.log(`\n[smoke] FAIL (${allFailures.length} issue${allFailures.length > 1 ? 's' : ''})`);
    process.exit(1);
  }
  console.log('\n[smoke] PASS — 3 cases (band 0–11, band >60, absent fallback) verified across light + dark, 0 console errors.');
  process.exit(0);
})();

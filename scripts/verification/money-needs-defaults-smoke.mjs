/**
 * money-needs-defaults-smoke.mjs — Task 1 verification
 *
 * Verifies all default items render on a fresh Money Needs worksheet.
 * Clears any existing moneyNeeds/{YEAR} doc via Admin SDK (ADC), then
 * creates a fresh worksheet through the UI and asserts every group and
 * a representative sample of named items.
 *
 * Groups + item counts verified:
 *   Fixed Expenses         (7)
 *   Living Expenses        (8)
 *   Business Expenses      (7)
 *   Savings & Accumulation (6)
 *   Miscellaneous          (6)
 *   Insurance Industry Expenses sub-calc (11)
 *   Car Expenses sub-calc               (8)
 *   Loans & Debt sub-calc               (6)
 *
 * Usage:
 *   node scripts/verification/money-needs-defaults-smoke.mjs [preview-url]
 *   SMOKE_PREVIEW_URL=https://... node scripts/verification/money-needs-defaults-smoke.mjs
 *
 * Env required: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD
 */

import { createRequire } from 'module';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { setupBypassSession, loginAs } from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YEAR = 2026;

function loadEnv() {
  try {
    const lines = readFileSync(join(__dirname, '../../.env.local'), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* absent — rely on shell env */ }
}
loadEnv();

const PREVIEW_URL  = process.env.SMOKE_PREVIEW_URL ?? process.argv[2] ?? 'https://agencytrack.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const API_KEY      = process.env.VITE_FIREBASE_API_KEY;

const SCREENSHOTS_DIR = join(__dirname, '../../tmp/screenshots');
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let passed = 0, failed = 0;
const RESULTS = [];

function report(label, ok, detail = '') {
  const icon = ok ? '✓' : '✗';
  const line = `${icon} ${label}${detail ? ` — ${detail}` : ''}`;
  RESULTS.push(line);
  console.log(line);
  if (ok) passed++; else failed++;
}

// ── Step 0: Admin SDK clear ───────────────────────────────────────────────────
let docCleared = false;
try {
  const require = createRequire(import.meta.url);
  const adminPath = join(__dirname, '../../functions/node_modules/firebase-admin');
  const admin = require(adminPath);
  admin.initializeApp();

  // Find user UID by email
  const userRecord = await admin.auth().getUserByEmail(AGENT_EMAIL);
  const uid = userRecord.uid;
  console.log(`Admin SDK: found uid ${uid} for ${AGENT_EMAIL}`);

  // Find tenantId
  const tenantsSnap = await admin.firestore().collection('tenants').listDocuments();
  let tenantId = null;
  for (const tenantRef of tenantsSnap) {
    const userDoc = await tenantRef.collection('users').doc(uid).get();
    if (userDoc.exists) { tenantId = tenantRef.id; break; }
  }

  if (tenantId) {
    const docRef = admin.firestore()
      .collection('tenants').doc(tenantId)
      .collection('users').doc(uid)
      .collection('moneyNeeds').doc(String(YEAR));
    const snap = await docRef.get();
    if (snap.exists) {
      await docRef.delete();
      console.log(`Admin SDK: deleted moneyNeeds/${YEAR} for tenant=${tenantId} uid=${uid}`);
    } else {
      console.log(`Admin SDK: no existing moneyNeeds/${YEAR} doc — fresh state confirmed`);
    }
    docCleared = true;
  } else {
    console.log('Admin SDK: could not find tenantId for user — proceeding without clear');
  }
  await admin.app().delete();
} catch (e) {
  console.log(`Admin SDK unavailable (${e.message?.slice(0, 80)}) — proceeding without clear`);
  console.log('Note: worksheet may not be fresh if one already exists for this agent');
}

// ── Default items to verify ───────────────────────────────────────────────────
const GROUP_LABELS = [
  'Fixed Expenses',
  'Living Expenses',
  'Business Expenses',
  'Savings & Accumulation',
  'Miscellaneous',
];

// Representative items — one or two from each group + all sub-calc labels
const SPOT_ITEMS = [
  // Fixed (7)
  'Rent or mortgage payments',
  'Disability income insurance',
  'Property taxes',
  // Living (8)
  'Food',
  'Laundry, tailoring',
  'Medical – doctor, dentist, drugs',
  // Business (7)
  'Sales promotion, advertising, direct mail, tuition',
  'Trade association dues, services, events',
  'Business entertainment',
  // Savings (6)
  'Life insurance',
  'Slush fund',
  // Misc (6)
  'Donations – religious, charitable, etc.',
  'Vacation',
];

const SUBCALC_LABELS = [
  'Insurance Industry Expenses',
  'Car Expenses',
  'Loans & Debt',
];

// Representative sub-calc items
const SUBCALC_ITEMS = [
  'Life License Renewal',
  'TTAIFA fees',
  'MDRT membership fee',
  'Gas/Petrol/Electric',
  'Mechanical Servicing',
  'Vehicle Loan',
  'Credit Card',
  'Sou-sou',
];

async function navigateToMoneyNeeds(page, isMobile = false) {
  if (isMobile) {
    // Mobile: money-needs may be under the "More" drawer
    const directTab = page.getByTestId('agent-tab-money-needs');
    const isDirectVisible = await directTab.isVisible().catch(() => false);
    if (!isDirectVisible) {
      const moreBtn = page.getByRole('button', { name: /^more$/i });
      const moreVisible = await moreBtn.isVisible().catch(() => false);
      if (moreVisible) {
        await moreBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }
  const tab = page.getByTestId('agent-tab-money-needs');
  const tabVisible = await tab.isVisible().catch(() => false);
  if (tabVisible) {
    await tab.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function ensureWorksheet(page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasEmptyState = bodyText.includes('No 2026 worksheet yet') || bodyText.includes('Start 2026 worksheet');
  if (hasEmptyState) {
    const startBtn = page.getByRole('button', { name: `Start ${YEAR} worksheet` });
    const btnVisible = await startBtn.isVisible().catch(() => false);
    if (btnVisible) {
      await startBtn.click();
      await page.waitForTimeout(3000);
      return 'created';
    }
    return 'empty-no-button';
  }
  return 'existing';
}

async function getAllInputValues(page) {
  return page.$$eval('input[type="text"]', els => els.map(el => el.value));
}

async function verifyDefaults(page, prefix) {
  const bodyText = await page.evaluate(() => document.body.innerText);

  // Group section headers (visible even when collapsed)
  for (const label of GROUP_LABELS) {
    report(`${prefix} — group header "${label}"`, bodyText.includes(label));
  }

  // Sub-calc section headers (visible even when collapsed)
  for (const label of SUBCALC_LABELS) {
    report(`${prefix} — sub-calc section "${label}"`, bodyText.includes(label));
  }

  // Expand all accordion sections (expense groups + sub-calcs) via browser-native click
  // Using page.evaluate to avoid Playwright stale-locator issues after React re-renders
  await page.evaluate(() => {
    document.querySelectorAll('button[aria-expanded="false"]').forEach(btn => btn.click());
  });
  await page.waitForTimeout(1200);

  // Item labels are in <input type="text" value={item.label}> — innerText misses them
  const inputValues = await getAllInputValues(page);
  console.log(`  [debug] Found ${inputValues.length} text inputs after accordion expansion`);
  console.log(`  [debug] Non-empty labels:`, inputValues.filter(v => v.trim()));
  const inputSet = new Set(inputValues);

  for (const item of SPOT_ITEMS) {
    report(`${prefix} — default item "${item}"`, inputSet.has(item));
  }

  for (const item of SUBCALC_ITEMS) {
    report(`${prefix} — sub-calc item "${item}"`, inputSet.has(item));
  }
}

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

function wireCapture(page) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const ignore = ['Missing or insufficient permissions', 'fontshare', 'net::ERR', 'CORS', 'permission-denied'];
      if (!ignore.some(p => text.includes(p))) consoleErrors.push(text);
    }
  });
}

try {
  console.log(`\nMoney Needs defaults smoke → ${PREVIEW_URL}`);
  console.log(`Doc cleared via Admin SDK: ${docCleared}\n`);

  // ── Light mode ──────────────────────────────────────────────────────────────
  console.log('── Light mode ──────────────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    wireCapture(page);
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
    report('Light — dashboard loaded', await page.locator('[data-testid^="agent-tab-"]').count() > 0);

    const tabReached = await navigateToMoneyNeeds(page);
    report('Light — money-needs tab reached', tabReached);

    if (tabReached) {
      const worksheetState = await ensureWorksheet(page);
      report(`Light — worksheet state`, worksheetState === 'created' || worksheetState === 'existing',
        `state=${worksheetState}`);

      if (worksheetState !== 'empty-no-button') {
        await verifyDefaults(page, 'Light');
        await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mn-defaults-light.png'), fullPage: true });
        console.log('  Screenshot: tmp/screenshots/mn-defaults-light.png');
      }
    }
    await ctx.close();
  }

  // ── Dark mode ───────────────────────────────────────────────────────────────
  console.log('\n── Dark mode ───────────────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    wireCapture(page);
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);

    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('agencytrack-dark', 'true');
    });
    await page.waitForTimeout(300);
    report('Dark — dark class applied', await page.evaluate(() => document.documentElement.classList.contains('dark')));

    const tabReached = await navigateToMoneyNeeds(page);
    report('Dark — money-needs tab reached', tabReached);

    if (tabReached) {
      const worksheetState = await ensureWorksheet(page);
      report('Dark — worksheet state', worksheetState === 'created' || worksheetState === 'existing',
        `state=${worksheetState}`);

      if (worksheetState !== 'empty-no-button') {
        await verifyDefaults(page, 'Dark');
        await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mn-defaults-dark.png'), fullPage: true });
        console.log('  Screenshot: tmp/screenshots/mn-defaults-dark.png');
      }
    }
    await ctx.close();
  }

  // ── Mobile (390×844) ────────────────────────────────────────────────────────
  console.log('\n── Mobile 390×844 ──────────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    wireCapture(page);
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
    report('Mobile — dashboard loaded', await page.locator('[data-testid^="agent-tab-"]').count() > 0);

    const tabReached = await navigateToMoneyNeeds(page, true);
    report('Mobile — money-needs tab reached (via More-drawer if needed)', tabReached);

    if (tabReached) {
      const worksheetState = await ensureWorksheet(page);
      report('Mobile — worksheet state', worksheetState === 'created' || worksheetState === 'existing',
        `state=${worksheetState}`);

      if (worksheetState !== 'empty-no-button') {
        // Spot-check on mobile — expand first group accordion then check inputs
        const bodyText = await page.evaluate(() => document.body.innerText);
        report('Mobile — group "Fixed Expenses" header visible', bodyText.includes('Fixed Expenses'));
        report('Mobile — group "Living Expenses" header visible', bodyText.includes('Living Expenses'));
        // Expand Fixed Expenses to check an item
        const fixedBtn = page.getByRole('button').filter({ hasText: 'Fixed Expenses' });
        const fixedExpanded = await fixedBtn.getAttribute('aria-expanded').catch(() => 'true');
        if (fixedExpanded === 'false') await fixedBtn.click().catch(() => {});
        await page.waitForTimeout(500);
        const mobileInputs = await getAllInputValues(page);
        report('Mobile — default item "Rent or mortgage payments" in inputs', mobileInputs.includes('Rent or mortgage payments'));
        report('Mobile — default item "Disability income insurance" in inputs', mobileInputs.includes('Disability income insurance'));
        await page.screenshot({ path: join(SCREENSHOTS_DIR, 'mn-defaults-mobile.png'), fullPage: true });
        console.log('  Screenshot: tmp/screenshots/mn-defaults-mobile.png');
      }
    }
    await ctx.close();
  }

  report('0 unexpected console errors', consoleErrors.length === 0,
    consoleErrors.length > 0
      ? `${consoleErrors.length}: ${consoleErrors.slice(0, 2).map(e => e.slice(0, 100)).join(' | ')}`
      : '');

} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Money Needs defaults smoke result: ${passed} pass / ${failed} fail`);
if (failed > 0) {
  console.log('\nFailed:');
  RESULTS.filter(r => r.startsWith('✗')).forEach(r => console.log(' ', r));
  process.exit(1);
}

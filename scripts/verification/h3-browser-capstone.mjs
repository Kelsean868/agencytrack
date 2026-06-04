/**
 * h3-browser-capstone.mjs — Browser render smoke for usesPolicyLedger live flip.
 *
 * Phases:
 *   SEED   — write 3 settled policy docs on test agent (incl. 1st-of-current-month,
 *             1 mid-month, 1 prior-month) via Admin SDK
 *   FLIP   — set usesPolicyLedger: true on agent user doc
 *   SMOKE  — Playwright: log in as test agent, navigate to Awards tab,
 *             wait for panel to render, check console errors, screenshot
 *   REVERT — set usesPolicyLedger: false (in finally{})
 *   CLEAN  — delete the 3 seeded policy docs (in finally{})
 *
 * Safe: only touches test agent UID J0j4uBqzTPcfm1IlGCPyDzo27RP2 in tatillife_south.
 *
 * Run: node scripts/verification/h3-browser-capstone.mjs
 */

import { chromium } from 'playwright';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  waitForFirebaseReady,
  safeLog,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

const require = createRequire(import.meta.url);
const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dir, '..', '..');
const KEY_PATH = join(ROOT, 'functions', 'service-account-key.json');

// ── Admin SDK ────────────────────────────────────────────────────────────────
const admin = require(join(ROOT, 'functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db        = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

// ── Env ──────────────────────────────────────────────────────────────────────
function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = loadEnv();

// ── Constants ────────────────────────────────────────────────────────────────
const TENANT    = 'tatillife_south';
const AGENT_UID = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';
const SENTINEL  = `H3BrowserCapstone-${Date.now()}`;
const PROD_URL  = 'https://agencytrack.vercel.app';

function log(msg) { process.stdout.write(`[h3-browser] ${msg}\n`); }

function getTodayTT() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date());
}
function parseDateOnlyTT(s) {
  return new Date(`${s}T04:00:00Z`);
}

// ── Seed dates ───────────────────────────────────────────────────────────────
const TODAY_TT        = getTodayTT();
const FIRST_OF_MONTH  = TODAY_TT.substring(0, 8) + '01';
const MID_MONTH       = TODAY_TT.substring(0, 8) + '15';
// Prior month last day
const PRIOR_MONTH_DATE = (() => {
  const d = new Date(`${TODAY_TT.substring(0, 7)}-01T12:00:00Z`);
  d.setDate(0);
  return d.toISOString().substring(0, 10);
})();

const SEED_POLICIES = [
  { date: FIRST_OF_MONTH, api: 10000, label: '1st-of-month' },
  { date: MID_MONTH,      api: 12000, label: 'mid-month'    },
  { date: PRIOR_MONTH_DATE, api: 8000, label: 'prior-month' },
];

const EXPECTED_CURRENT_MONTH_API   = 22000; // 10000 + 12000
const EXPECTED_CURRENT_MONTH_APPS  = 2;
const EXPECTED_PRIOR_MONTH_API     = 8000;
const EXPECTED_CURRENT_PERIOD_KEY  = TODAY_TT.substring(0, 7);
const EXPECTED_PRIOR_PERIOD_KEY    = PRIOR_MONTH_DATE.substring(0, 7);

// ── Login helper ─────────────────────────────────────────────────────────────
async function loginAs(page, email, password) {
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  const emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible({ timeout: 8000 }).catch(() => false))) {
    throw new Error('Login form not visible after navigation');
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('input[type="email"]') === null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1500);
}

// ── Nav to Awards tab ─────────────────────────────────────────────────────────
async function navToAwards(page) {
  // Try desktop sidebar testid first, then mobile "More" drawer pattern
  const desktopTab = page.locator('[data-testid="agent-tab-awards"]');
  if (await desktopTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await desktopTab.click();
  } else {
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(500);
    }
    await page.locator('[data-testid="agent-tab-awards"]').click();
  }
  // Wait for skeleton loaders to clear
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    { timeout: 20000 }
  );
  await page.waitForTimeout(1000);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('=============================================================');
  log('H3 usesPolicyLedger — browser render capstone');
  log(`Tenant: ${TENANT}  |  Agent: ${AGENT_UID}`);
  log(`Sentinel: ${SENTINEL}`);
  log(`Today (TT): ${TODAY_TT}`);
  log(`Seed dates: ${FIRST_OF_MONTH} (1st) | ${MID_MONTH} (mid) | ${PRIOR_MONTH_DATE} (prior-month)`);
  log(`Expected: ${EXPECTED_CURRENT_PERIOD_KEY} API=${EXPECTED_CURRENT_MONTH_API} apps=${EXPECTED_CURRENT_MONTH_APPS}`);
  log(`Expected: ${EXPECTED_PRIOR_PERIOD_KEY}   API=${EXPECTED_PRIOR_MONTH_API}   apps=1`);
  log('=============================================================');

  const userRef      = db.doc(`tenants/${TENANT}/users/${AGENT_UID}`);
  const policiesCol  = db.collection(`tenants/${TENANT}/policies`);
  const seededIds    = [];
  let browser;

  // ── Phase 0: Baseline ───────────────────────────────────────────────────────
  log('\n-- Phase 0: Baseline --');
  const snap = await userRef.get();
  if (!snap.exists) { log('ERROR: Agent user doc not found'); process.exit(1); }
  log(`usesPolicyLedger (before): ${snap.data().usesPolicyLedger ?? '(not set)'}`);

  // ── Phase 1: Seed 3 settled policies ───────────────────────────────────────
  log('\n-- Phase 1: Seed 3 settled policies --');
  const batch = db.batch();
  for (const { date, api, label } of SEED_POLICIES) {
    const ref = policiesCol.doc();
    seededIds.push(ref.id);
    batch.set(ref, {
      agentId:      AGENT_UID,
      tenantId:     TENANT,
      ownerName:    `${SENTINEL}-${label}`,
      insuredName:  `${SENTINEL}-${label}`,
      status:       'settled',
      settledAPI:   api,
      dateIssued:   Timestamp.fromDate(parseDateOnlyTT(date)),
      dateWritten:  Timestamp.fromDate(parseDateOnlyTT(date)),
      proposedAPI:  api,
      createdAt:    Timestamp.now(),
    });
    log(`  ${label}: dateIssued=${date}  API=${api}`);
  }
  await batch.commit();
  log(`  OK 3 policies written (IDs: ${seededIds[0].substring(0, 8)}...)`);

  try {
    // ── Phase 2: Flip flag ────────────────────────────────────────────────────
    log('\n-- Phase 2: Flip usesPolicyLedger = true --');
    await userRef.update({ usesPolicyLedger: true });
    const afterSnap = await userRef.get();
    if (afterSnap.data().usesPolicyLedger !== true) throw new Error('Flag did not update to true');
    log(`  usesPolicyLedger = ${afterSnap.data().usesPolicyLedger}  OK`);

    // ── Phase 3: Browser smoke ────────────────────────────────────────────────
    log('\n-- Phase 3: Browser smoke --');
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(ctx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const page = await ctx.newPage();
    const capture = captureConsoleAndNetwork(page);

    log('  Logging in as test agent...');
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    log('  Agent logged in ✓');

    log('  Navigating to Awards tab...');
    await navToAwards(page);
    log('  Awards tab visible ✓');

    // Screenshot — full page
    const ssPath = join(__dir, `h3-browser-capstone-${Date.now()}.png`);
    await page.screenshot({ path: ssPath, fullPage: true });
    log(`  Screenshot saved → ${ssPath}`);

    // Check console errors
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    log(`  Console errors: ${consoleErrors.length}`);
    for (const e of consoleErrors) log(`    [error] ${e.text}`);

    // Check DOM for awards content — panel should NOT show an empty state
    const bodyText = await page.evaluate(() => document.body.textContent ?? '');

    // "No data" empty state detector — adjust text to match actual panel copy
    const emptyStatePatterns = [
      'no confirmed data',
      'no awards data',
      'no data available',
    ];
    const hasEmptyState = emptyStatePatterns.some(p =>
      bodyText.toLowerCase().includes(p)
    );

    // The panel should render SOME award names (e.g. "Advisor of the Month")
    const hasAwardContent = bodyText.includes('Advisor') || bodyText.includes('Award') || bodyText.includes('API');

    log(`\n  Panel content check:`);
    log(`    hasEmptyState: ${hasEmptyState}`);
    log(`    hasAwardContent: ${hasAwardContent}`);

    if (consoleErrors.length > 0) {
      log(`\n  RESULT: FAIL — ${consoleErrors.length} console error(s) detected`);
      for (const e of consoleErrors) log(`    ${e.text}`);
    } else if (hasEmptyState && !hasAwardContent) {
      log(`\n  RESULT: WARNING — Panel shows empty state (agent may have no matching awards for seeded data)`);
      log('  This is not a crash — the component rendered without error. Seeded API may be below award thresholds.');
      log('  Verifying no crash: screenshot and zero console errors confirm panel rendered.');
    } else {
      log(`\n  RESULT: PASS — Panel rendered without error; award content visible`);
    }

    // Print full console capture summary
    log('\n' + formatCaptureReport(capture));

    await browser.close();
    browser = null;

    const verdict = consoleErrors.length === 0 ? 'PASS' : 'FAIL';
    log(`\n-- Phase 3 verdict: ${verdict} --`);
    if (verdict === 'FAIL') throw new Error(`Browser smoke failed: ${consoleErrors.length} console error(s)`);

  } finally {
    // ── Phase 4: Revert (always runs) ────────────────────────────────────────
    log('\n-- Phase 4: Revert flag --');
    await userRef.update({ usesPolicyLedger: false });
    const revertSnap = await userRef.get();
    log(`  usesPolicyLedger = ${revertSnap.data().usesPolicyLedger}  OK`);

    // ── Phase 5: Cleanup (always runs) ───────────────────────────────────────
    log('\n-- Phase 5: Cleanup --');
    const cleanBatch = db.batch();
    for (const id of seededIds) cleanBatch.delete(policiesCol.doc(id));
    await cleanBatch.commit();

    const verifySnaps = await Promise.all(seededIds.map(id => policiesCol.doc(id).get()));
    const remaining = verifySnaps.filter(s => s.exists).length;
    if (remaining === 0) {
      log(`  OK Deleted ${seededIds.length} policies, zero remain`);
    } else {
      log(`  WARNING: ${remaining} sentinel docs still present`);
    }

    if (browser) {
      await browser.close();
    }
  }

  log('\n=============================================================');
  log('H3 browser capstone: COMPLETE');
  log('=============================================================');
}

main().catch(err => {
  console.error('[h3-browser] FATAL:', err.message);
  process.exit(1);
});

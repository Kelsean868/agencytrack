/**
 * daily-capture-v2-2-1-sunday-submit-smoke.mjs
 * Daily Capture v2 Phase 2.1 — Sunday "Review & submit" deep-link smoke.
 *
 * Forces the browser clock to the most-recent Sunday (TT) via addInitScript so
 * getTodayTT() resolves a Sunday and DCv2 renders SundayConfirmView. The clock
 * is faked BACKWARD (last Sunday, not next) so Firebase Auth sees the genuine
 * freshly-issued ID token as long-valid — a forward fake triggers an immediate
 * refresh loop and breaks login. Read-only: no Firestore writes, no cleanup.
 *
 * Verifies (both themes):
 *   Leg 0 — getTodayTT() resolves the forced Sunday (Intl TT format in-page).
 *   Leg 1 — DCv2 shows SundayConfirmView (read-only summary), not the daily form.
 *   Leg 2 — Branches on the week's weekly-submission status:
 *            • not submitted → "Review & submit" present → click → wizard opens
 *              (wizard-v2-modal) ON THE STEP SCREEN (wizard-v2-step-counter),
 *              which is only reachable when initialWeek was honored = deep-link OK.
 *            • already submitted → disabled "Submitted", no "Review & submit".
 *   Leg 3 — axe NO-NEW serious/critical on the Sunday view.
 *
 * NOTE (deferred, per brief Phase 3 self-critique + Rule 13): the "wizard opens
 * PRE-FILLED with the live-aggregated week" sub-assertion needs a REAL Sunday
 * with a real cron-aggregated draft — a backward-faked week has no aggregated
 * draft, so the wizard opens empty at the correct week. The exact deep-link week
 * value is pinned by the component test (onReviewSubmit called with the Sunday);
 * the live aggregated-prefill is the manual Sunday-21st check banked in FOLLOW_UPS.
 */

import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resolvePreviewUrl, runBothThemes } from './lib/walk-helpers.mjs';

// ─── Env load ─────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');

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

const PREVIEW_URL = resolvePreviewUrl();
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = join(__dir, `${RUN_TS}-dcv2-p21-screenshots`);

// ─── Result tracking ──────────────────────────────────────────────────────

const results = [];
const pass = (s, n = '') => { results.push({ s, status: 'PASS', n }); console.log(`  ✓ ${s}${n ? ` — ${n}` : ''}`); };
const fail = (s, n = '') => { results.push({ s, status: 'FAIL', n }); console.log(`  ✗ ${s}${n ? ` — ${n}` : ''}`); };
const skip = (s, n = '') => { results.push({ s, status: 'SKIP', n }); console.log(`  ~ ${s}${n ? ` — ${n}` : ''}`); };

// ─── Date helpers ─────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

/** Most-recent Sunday at or before real today, as YYYY-MM-DD (UTC basis). */
function mostRecentSundayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// ─── Firebase Web SDK (Node) ──────────────────────────────────────────────

function initFb() {
  const fb = initializeApp({
    apiKey:            E.VITE_FIREBASE_API_KEY,
    authDomain:        E.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         E.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     E.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: E.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             E.VITE_FIREBASE_APP_ID,
  }, 'dcv2-p21-smoke');
  return { fb, auth: getAuth(fb), db: getFirestore(fb) };
}

async function resolveTenantId(authedUser) {
  const tok = await authedUser.getIdTokenResult(true);
  return tok.claims?.tenantId ?? null;
}

async function readWeeklyStatus(db, tenantId, uid, weekStarting) {
  const ref = doc(db, `tenants/${tenantId}/submissions/${uid}_${weekStarting}`);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().status ?? null) : null;
}

// ─── In-page helpers ──────────────────────────────────────────────────────

/** Fake the browser clock to noon-UTC of the forced Sunday (08:00 AST → Sunday TT). */
async function forceSunday(page, sundayISO) {
  const fakeMs = new Date(`${sundayISO}T12:00:00Z`).getTime();
  await page.addInitScript((ms) => {
    const RealDate = Date;
    const FakeDate = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(ms);
        else super(...args);
      }
      static now() { return ms; }
    };
    Date = FakeDate;
  }, fakeMs);
}

async function loginAsAgent(page) {
  await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', E.A11Y_AGENT_EMAIL);
  await page.fill('input[type="password"]', E.A11Y_AGENT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="daily-fab"]') ||
          document.querySelector('[data-testid^="agent-tab-"]'),
    { timeout: 45000 }
  );
}

async function openDailyCapture(page) {
  await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 20000 });
  await page.click('[data-testid="daily-fab"]');
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { timeout: 15000 });
}

async function shoot(page, name) {
  try {
    mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: false });
  } catch {}
}

// ─── Per-theme body ────────────────────────────────────────────────────────

async function smokeBody(page, theme, { sundayISO, weeklyStatus }) {
  console.log(`\n── theme: ${theme} ──`);
  const errors = [];
  const pageErrors = [];

  try {
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await forceSunday(page, sundayISO);
    await loginAsAgent(page);
    pass(`[${theme}] login`);

    // Leg 0 — getTodayTT()'s exact expression resolves the forced Sunday.
    const ttDate = await page.evaluate(
      () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date())
    );
    if (ttDate === sundayISO) pass(`[${theme}] getTodayTT-is-sunday`, ttDate);
    else { fail(`[${theme}] getTodayTT-is-sunday`, `expected ${sundayISO} got ${ttDate}`); return; }

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((theme === 'dark') === isDark) pass(`[${theme}] theme-applied`);
    else fail(`[${theme}] theme-applied`, `documentElement.dark=${isDark}`);

    // Leg 1 — DCv2 shows the Sunday read-only summary, not the daily form.
    await openDailyCapture(page);
    await page.waitForFunction(
      () => /your week from daily logs/i.test(document.body.textContent || ''),
      { timeout: 15000 }
    ).catch(() => {});
    await shoot(page, `${theme}-sunday-view`);

    const sundayHeading = await page.getByText(/your week from daily logs/i).count();
    if (sundayHeading > 0) pass(`[${theme}] sunday-confirm-view`);
    else fail(`[${theme}] sunday-confirm-view`, 'aggregated summary heading not found');

    const saveBtn = await page.locator('[data-testid="dcv2-save"]').count();
    if (saveBtn === 0) pass(`[${theme}] no-daily-save-on-sunday`);
    else fail(`[${theme}] no-daily-save-on-sunday`, 'daily Save button present on Sunday');

    // Leg 3 — axe NO-NEW serious/critical on the Sunday view (before navigating away).
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = (axe.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
    if (serious.length === 0) pass(`[${theme}] axe-no-serious-critical`);
    else fail(`[${theme}] axe-no-serious-critical`, serious.slice(0, 3).map((v) => `${v.id}(${v.nodes.length})`).join(', '));

    // Leg 2 — branch on weekly-submission status.
    const reviewBtn = page.getByRole('button', { name: /review & submit/i });
    const submittedBtn = page.getByRole('button', { name: /^submitted$/i });

    if (weeklyStatus === 'submitted') {
      const submittedCount = await submittedBtn.count();
      const reviewCount = await reviewBtn.count();
      if (submittedCount > 0 && reviewCount === 0) pass(`[${theme}] already-submitted-reflected`);
      else fail(`[${theme}] already-submitted-reflected`, `submitted=${submittedCount} review=${reviewCount}`);
      const disabled = submittedCount > 0 ? await submittedBtn.first().isDisabled() : false;
      if (disabled) pass(`[${theme}] submitted-button-disabled`);
      else fail(`[${theme}] submitted-button-disabled`, 'Submitted button not disabled');
    } else {
      const reviewCount = await reviewBtn.count();
      if (reviewCount > 0) pass(`[${theme}] review-submit-present`, `weeklyStatus=${weeklyStatus ?? 'none'}`);
      else { fail(`[${theme}] review-submit-present`, 'Review & submit button not found'); return; }

      await reviewBtn.first().click();
      // DCv2 detaches and the wizard mounts.
      await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 10000 }).catch(() => {});
      const wizardModal = await page.waitForSelector('[data-testid="wizard-v2-modal"]', { timeout: 15000 }).then(() => true).catch(() => false);
      if (wizardModal) pass(`[${theme}] deep-link-opens-wizard`);
      else { fail(`[${theme}] deep-link-opens-wizard`, 'wizard-v2-modal did not appear'); return; }

      // On the STEP screen (not the date picker) → initialWeek was honored.
      const onStepScreen = await page.locator('[data-testid="wizard-v2-step-counter"]').count();
      if (onStepScreen > 0) pass(`[${theme}] wizard-on-step-screen`, 'initialWeek honored (skipped date picker)');
      else fail(`[${theme}] wizard-on-step-screen`, 'step counter absent — wizard opened at date picker, not deep-linked');
      await shoot(page, `${theme}-wizard-deeplinked`);
    }

    // JS errors gate.
    const filt = (xs) => xs.filter((t) => !/ResizeObserver|favicon|net::ERR|api\.fontshare\.com/.test(t));
    if (filt(errors).length === 0 && filt(pageErrors).length === 0) {
      pass(`[${theme}] no-js-errors`);
    } else {
      fail(`[${theme}] no-js-errors`,
        `console=${filt(errors).slice(0, 2).join(' | ')} page=${filt(pageErrors).slice(0, 2).join(' | ')}`);
    }
  } catch (err) {
    fail(`[${theme}] browser-error`, String(err?.message ?? err).slice(0, 280));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== daily-capture-v2-2-1-sunday-submit-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);

  const { fb, auth, db } = initFb();
  const sundayISO = mostRecentSundayISO();
  let browser;

  try {
    const cred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    const uid = cred.user.uid;
    const tenantId = await resolveTenantId(cred.user);
    if (!tenantId) throw new Error('tenantId could not be resolved from claims');
    pass('sdk-signin', `tid=${tenantId.slice(0, 6)}… uid=${uid.slice(0, 6)}…`);

    const weeklyStatus = await readWeeklyStatus(db, tenantId, uid, sundayISO);
    console.log(`  forced Sunday=${sundayISO}  weeklyStatus=${weeklyStatus ?? 'none'}`);

    browser = await chromium.launch({ headless: true });
    await runBothThemes(browser, {
      baseUrl: PREVIEW_URL,
      token: E.VERCEL_BYPASS_TOKEN,
      viewport: { width: 390, height: 844 },
      perTheme: async (page, theme) => {
        await smokeBody(page, theme, { sundayISO, weeklyStatus });
      },
    });
  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 280));
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { await signOut(auth); } catch {}
    try { await deleteApp(fb); } catch {}
  }

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const ok = failed === 0;
  console.log(`\n=== RESULT: ${passed}/${total} passed, ${skipped} skipped, ${failed} failed — ${ok ? 'OK ✓' : 'FAILED ✗'} ===`);
  console.log(`Screenshots: ${SHOTS_DIR}\n`);
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err?.stack ?? err);
  process.exit(1);
});

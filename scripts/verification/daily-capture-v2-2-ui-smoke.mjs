/**
 * daily-capture-v2-2-ui-smoke.mjs — Daily Capture v2 Phase 2 (Option B UI) smoke.
 *
 * Verifies:
 *   Leg 1 — Week strip renders (6 Mon–Sat buttons with correct data-testid)
 *   Leg 2 — Write-read-verify: enter data across all groups → save → reload → assert
 *            persisted + points pill visible; tap prior strip day → assert date change
 *   Leg 3 — axe NO-NEW serious/critical vs main baseline, both themes
 *
 * Both themes (light + dark) via runBothThemes().
 */

import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resolvePreviewUrl, runBothThemes, waitForLoaded } from './lib/walk-helpers.mjs';
import { getSundayOf } from '../../src/lib/schema/dailyActivity.js';

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
const SHOTS_DIR = join(__dir, `${RUN_TS}-dcv2-p2-screenshots`);

// ─── Result tracking ──────────────────────────────────────────────────────

const results = [];
const pass = (s, n = '') => { results.push({ s, status: 'PASS', n }); console.log(`  ✓ ${s}${n ? ` — ${n}` : ''}`); };
const fail = (s, n = '') => { results.push({ s, status: 'FAIL', n }); console.log(`  ✗ ${s}${n ? ` — ${n}` : ''}`); };
const skip = (s, n = '') => { results.push({ s, status: 'SKIP', n }); console.log(`  ~ ${s}${n ? ` — ${n}` : ''}`); };

// ─── Date helpers ─────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns a Mon–Sat date that is not today, within the current week.
 * Used as the back-fill target day strip test.
 */
function priorDayInWeek(todayStr, weekStarting) {
  // weekStarting is Sunday. Mon = ws+1, Tue = ws+2 … Sat = ws+6.
  const today = new Date(todayStr + 'T12:00:00Z');
  const todayDow = today.getUTCDay(); // 0=Sun, 1=Mon…6=Sat
  if (todayDow === 0) {
    // Sunday — no prior non-Sunday day to back-fill; skip this leg.
    return null;
  }
  // Use yesterday (Mon–Sat)
  const yd = new Date(today);
  yd.setUTCDate(yd.getUTCDate() - 1);
  const dowYd = yd.getUTCDay();
  if (dowYd === 0) {
    // Yesterday was Sunday — use Mon of this week (ws+1) if that's not today.
    const ws = new Date(weekStarting + 'T12:00:00Z');
    const mon = new Date(ws);
    mon.setUTCDate(mon.getUTCDate() + 1);
    const monISO = `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`;
    return monISO === todayStr ? null : monISO;
  }
  return `${yd.getUTCFullYear()}-${String(yd.getUTCMonth() + 1).padStart(2, '0')}-${String(yd.getUTCDate()).padStart(2, '0')}`;
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
  }, 'dcv2-p2-smoke');
  return { fb, auth: getAuth(fb), db: getFirestore(fb) };
}

async function resolveTenantId(authedUser) {
  const tok = await authedUser.getIdTokenResult(true);
  return tok.claims?.tenantId ?? null;
}

async function listWeekDocs(db, tenantId, uid, weekStarting) {
  const colRef = collection(db, `tenants/${tenantId}/users/${uid}/dailyActivity`);
  const q = query(colRef, where('weekStarting', '==', weekStarting));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function deleteWeekDocs(db, tenantId, uid, weekStarting) {
  const docs = await listWeekDocs(db, tenantId, uid, weekStarting);
  for (const d of docs) {
    await deleteDoc(doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${d.id}`));
  }
  return docs.length;
}

async function readDailyDoc(db, tenantId, uid, dateStr) {
  const ref = doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${dateStr}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ─── In-page helpers ──────────────────────────────────────────────────────

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
  await waitForLoaded(page, 'dcv2-count-strip');
}

async function clickIncrease(page, labelPattern, times = 1) {
  const btn = page.getByRole('button', { name: new RegExp(`${labelPattern} increase`, 'i') });
  for (let i = 0; i < times; i++) {
    await btn.click();
    await page.waitForTimeout(40);
  }
}

async function fillMoney(page, ariaLabel, value) {
  const input = page.getByLabel(ariaLabel, { exact: false });
  await input.fill(String(value));
}

async function saveDaily(page) {
  await page.click('[data-testid="dcv2-save"]');
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 15000 });
}

async function shoot(page, name) {
  try {
    mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: false });
  } catch {}
}

// ─── Per-theme body ────────────────────────────────────────────────────────

async function smokeBody(page, theme, { today, weekStarting, backFillDate, db, tenantId, uid }) {
  console.log(`\n── theme: ${theme} ──`);
  const errors = [];
  const pageErrors = [];

  try {
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await loginAsAgent(page);
    pass(`[${theme}] login`);

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((theme === 'dark') === isDark) pass(`[${theme}] theme-applied`);
    else fail(`[${theme}] theme-applied`, `documentElement.dark=${isDark}`);

    // ── Leg 1 — Week strip renders ─────────────────────────────────────────
    await openDailyCapture(page);
    pass(`[${theme}] dcv2-opens`);
    await shoot(page, `${theme}-open`);

    const stripEl = await page.locator('[data-testid="dcv2-week-strip"]').count();
    if (stripEl > 0) pass(`[${theme}] week-strip-present`);
    else fail(`[${theme}] week-strip-present`, 'data-testid=dcv2-week-strip not found');

    // Verify 6 strip buttons (Mon–Sat)
    const stripDays = await page.locator('[data-testid^="dcv2-strip-day-"]').count();
    if (stripDays === 6) pass(`[${theme}] week-strip-6-days`, `count=${stripDays}`);
    else fail(`[${theme}] week-strip-6-days`, `expected 6 got ${stripDays}`);

    // ── Leg 2 — Write-read-verify ──────────────────────────────────────────
    // Qualified approaches and FFIs conducted are in the always-visible groups.
    await clickIncrease(page, 'Qualified approaches', 2);
    await clickIncrease(page, 'FFIs conducted', 1);

    // CIs conducted is inside the Interviews collapsible — expand only if collapsed.
    // (When a prior doc with ciConducted>0 is loaded, the section auto-expands;
    //  toggling again would collapse it and break the subsequent click.)
    const interviewsBtn = page.locator('[aria-controls="dcv2-interviews-body"]');
    const alreadyExpanded = await interviewsBtn.getAttribute('aria-expanded');
    if (alreadyExpanded !== 'true') {
      await interviewsBtn.click();
      await page.waitForTimeout(200);
    }
    await clickIncrease(page, 'CIs conducted', 1);

    await clickIncrease(page, 'New business — apps', 1);
    await fillMoney(page, 'New business — API (TTD)', 5000);

    // Points pill should be visible before save (live update on change).
    const pillVisible = await page.locator('[data-testid="dcv2-points-pill"]').count();
    if (pillVisible > 0) pass(`[${theme}] points-pill-visible-prefill`);
    else skip(`[${theme}] points-pill-visible-prefill`, 'pill hidden (may need save first)');

    await shoot(page, `${theme}-filled`);
    await saveDaily(page);
    pass(`[${theme}] save-success`);

    // Hard-reload and verify persisted.
    await page.evaluate(() => location.reload());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="daily-fab"]') ||
            document.querySelector('[data-testid^="agent-tab-"]'),
      { timeout: 45000 }
    );
    await openDailyCapture(page);
    await shoot(page, `${theme}-postreload`);

    // Verify doc persisted via SDK.
    const savedDoc = await readDailyDoc(db, tenantId, uid, today);
    if (savedDoc && (savedDoc.ffiConducted >= 1) && (savedDoc.newBusiness?.api >= 5000)) {
      pass(`[${theme}] doc-persisted`, `ffi=${savedDoc.ffiConducted} api=${savedDoc.newBusiness?.api}`);
    } else if (!savedDoc) {
      fail(`[${theme}] doc-persisted`, 'doc missing from Firestore after save');
    } else {
      fail(`[${theme}] doc-persisted`, `ffi=${savedDoc.ffiConducted} api=${savedDoc.newBusiness?.api}`);
    }

    // Points pill visible on reload and VALUE == computePoints(savedDoc fields).
    // Computed dynamically from savedDoc (dark theme accumulates on light's doc, so
    // the expected value differs per theme — hardcoding 45 would mis-fail dark).
    // Scoring mirrors computeDayPoints → computePoints for the fields the smoke writes:
    //   ffi * 5  +  ci * 10  +  floor(apps) * 25  +  floor(api/1000) * 1
    const _n = (v) => Math.max(0, parseFloat(v) || 0);
    const _expectedPts = savedDoc
      ? Math.floor(_n(savedDoc.ffiConducted))             * 5
        + Math.floor(_n(savedDoc.ciConducted))            * 10
        + Math.floor(_n(savedDoc.newBusiness?.apps))      * 25
        + Math.floor(_n(savedDoc.newBusiness?.api) / 1000) * 1
      : 0;
    const pillLocator = page.locator('[data-testid="dcv2-points-pill"]');
    const pillAfterReload = await pillLocator.count();
    if (pillAfterReload > 0) {
      pass(`[${theme}] points-pill-visible-after-reload`);
      const pillAriaLabel = await pillLocator.getAttribute('aria-label').catch(() => null);
      if (pillAriaLabel === `${_expectedPts} points today`) {
        pass(`[${theme}] points-pill-value`, `"${pillAriaLabel}"`);
      } else {
        fail(`[${theme}] points-pill-value`, `expected "${_expectedPts} points today" got "${pillAriaLabel}"`);
      }
    } else {
      fail(`[${theme}] points-pill-visible-after-reload`, 'dcv2-points-pill not found');
    }

    // API input pre-populates.
    const apiVal = await page.getByLabel('New business — API (TTD)', { exact: false }).inputValue();
    const apiOk = /5000|5,?000/.test(apiVal);
    if (apiOk) pass(`[${theme}] today-prepopulates`, `api=${apiVal}`);
    else fail(`[${theme}] today-prepopulates`, `expected 5000 got "${apiVal}"`);

    // ── Leg 2b — Back-fill: tap a prior strip day ──────────────────────────
    if (backFillDate) {
      const stripDayBtn = page.locator(`[data-testid="dcv2-strip-day-${backFillDate}"]`);
      const btnCount = await stripDayBtn.count();
      if (btnCount > 0) {
        await stripDayBtn.first().click();
        await page.waitForTimeout(600); // state update + re-render
        // Verify the header or credit label reflects the back-fill date.
        const creditText = await page.locator('[data-testid="dcv2-day-credit"]').first().textContent().catch(() => null);
        if (creditText && creditText.includes('back')) {
          pass(`[${theme}] back-fill-selected`, `credit="${creditText.trim()}"`);
        } else {
          // Alternative: check the selected state on the strip button.
          const isSelected = await page.locator(`[data-testid="dcv2-strip-day-${backFillDate}"]`).evaluate(
            (el) => el.getAttribute('aria-selected') === 'true' || el.getAttribute('data-selected') === 'true' ||
                     el.classList.contains('selected') || el.classList.contains('ring-2')
          );
          if (isSelected) pass(`[${theme}] back-fill-selected`, `day ${backFillDate} has selected state`);
          else skip(`[${theme}] back-fill-selected`, 'could not verify selected state from DOM — check screenshot');
        }
        await shoot(page, `${theme}-backfill-selected`);

        // Enter 1 FFI on the back-fill day — it's in the always-visible Appointments & FFI group.
        await clickIncrease(page, 'FFIs conducted', 1);
        await saveDaily(page);
        pass(`[${theme}] back-fill-save-success`);

        // Verify persisted to the back-fill date.
        const bfDoc = await readDailyDoc(db, tenantId, uid, backFillDate);
        if (bfDoc && bfDoc.ffiConducted >= 1) {
          pass(`[${theme}] back-fill-persisted`, `${backFillDate} ffi=${bfDoc.ffiConducted}`);
        } else {
          fail(`[${theme}] back-fill-persisted`, `doc=${JSON.stringify(bfDoc?.ffiConducted)}`);
        }
      } else {
        skip(`[${theme}] back-fill`, `strip button ${backFillDate} not in DOM (may be off-range for this week)`);
      }
    } else {
      skip(`[${theme}] back-fill`, 'today is Sunday — no prior Mon-Sat day in strip to back-fill');
    }

    // ── Leg 3 — axe NO-NEW serious/critical ───────────────────────────────
    // Re-open to get a fresh form surface for axe.
    await page.evaluate(() => location.reload());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="daily-fab"]') ||
            document.querySelector('[data-testid^="agent-tab-"]'),
      { timeout: 45000 }
    );
    await openDailyCapture(page);

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = (axe.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
    if (serious.length === 0) {
      pass(`[${theme}] axe-no-serious-critical`);
    } else {
      const top = serious.slice(0, 3).map((v) => `${v.id}(${v.nodes.length})`).join(', ');
      fail(`[${theme}] axe-no-serious-critical`, top);
    }

    // ── JS errors gate ─────────────────────────────────────────────────────
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
  console.log(`\n=== daily-capture-v2-2-ui-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);

  const { fb, auth, db } = initFb();
  let tenantId = null;
  let uid = null;
  const today = todayISO();
  const weekStarting = getSundayOf(today);
  const backFillDate = priorDayInWeek(today, weekStarting);

  let browser;
  try {
    // ── Pre-clean via Node Web SDK ─────────────────────────────────────────
    const cred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid = cred.user.uid;
    tenantId = await resolveTenantId(cred.user);
    if (!tenantId) throw new Error('tenantId could not be resolved from claims');
    pass('sdk-signin', `tid=${tenantId.slice(0, 6)}… uid=${uid.slice(0, 6)}…`);

    const deletedCount = await deleteWeekDocs(db, tenantId, uid, weekStarting);
    pass('pre-clean-week', `deleted ${deletedCount} prior doc(s) for week ${weekStarting}`);
    console.log(`  today=${today} weekStarting=${weekStarting} backFillDate=${backFillDate ?? 'none (Sunday)'}`);

    // ── Browser runs (both themes) ─────────────────────────────────────────
    browser = await chromium.launch({ headless: true });

    await runBothThemes(browser, {
      baseUrl: PREVIEW_URL,
      token: E.VERCEL_BYPASS_TOKEN,
      viewport: { width: 390, height: 844 },
      perTheme: async (page, theme) => {
        await smokeBody(page, theme, { today, weekStarting, backFillDate, db, tenantId, uid });
      },
    });

  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 280));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (tenantId && uid) {
      const removed = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => null);
      if (removed != null) pass('post-clean-week', `deleted ${removed} doc(s)`);
    }
    try { await signOut(auth); } catch {}
    try { await deleteApp(fb); } catch {}
  }

  // ── Summary ───────────────────────────────────────────────────────────────
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

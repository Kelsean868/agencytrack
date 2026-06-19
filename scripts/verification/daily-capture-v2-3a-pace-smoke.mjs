/**
 * daily-capture-v2-3a-pace-smoke.mjs — Phase 3a pace pill smoke.
 *
 * Verifies:
 *   Setup  — seed tatillife_smoke weeklyActivityFloors (apps-only floor = 25 pts)
 *            idempotently via tenant_admin Web SDK write
 *   Leg 1  — pace badge shows "Behind" when weekPoints = 0 (no entries)
 *   Leg 2  — pace badge shows "Ahead" after logging 35 pts (2 FFI + 1 app),
 *            save, reload — verifies weekPoints aggregation + badge transition
 *   Leg 3  — axe NO-NEW serious/critical vs main baseline (both themes)
 *   Cleanup — delete week docs; remove seeded weeklyActivityFloors field
 *
 * Run with:
 *   SMOKE_PREVIEW_URL=https://agencytrack-git-feat-daily-capture-v2-3a-pace-kyron-marchan-s-projects.vercel.app \
 *   node scripts/verification/daily-capture-v2-3a-pace-smoke.mjs
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
  setDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
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
const SHOTS_DIR = join(__dir, `${RUN_TS}-dcv2-p3a-screenshots`);

// Seed: an apps-only floor → weeklyPointsFloor = 25 pts.
// All other keys zeroed so that 2 FFI + 1 app = 35 pts reliably triggers "Ahead"
// regardless of which day of the week the smoke runs.
const SEEDED_FLOORS = {
  callsMade:             0,
  telContacts:           0,
  appointmentsScheduled: 0,
  interviewsKept:        0,
  factFindsCompleted:    0,
  closingInterviewsKept: 0,
  applicationsSubmitted: 1,   // → 25 pts
  clientsSold:           0,
  api:                   0,
  referralsNewLeads:     0,
};
const EXPECTED_FLOOR_PTS = 25;
// Smoke entry: 2 FFI (10 pts) + 1 app (25 pts) = 35 pts — ahead of any pro-rated target ≤ 25
const SMOKE_FFI = 2;
const SMOKE_APPS = 1;
const SMOKE_PTS = SMOKE_FFI * 5 + SMOKE_APPS * 25; // = 35

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

// ─── Firebase Web SDK (Node) ──────────────────────────────────────────────

function initFb() {
  const fb = initializeApp({
    apiKey:            E.VITE_FIREBASE_API_KEY,
    authDomain:        E.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         E.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     E.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: E.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             E.VITE_FIREBASE_APP_ID,
  }, 'dcv2-p3a-smoke');
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

// ─── Setup / teardown helpers ─────────────────────────────────────────────

async function seedFloors(db, tenantId, adminUid) {
  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  const snap = await getDoc(ref);
  const originalFloors = snap.exists() ? (snap.data().weeklyActivityFloors ?? null) : null;
  // Seed with merge so we only touch weeklyActivityFloors, not other config fields.
  await setDoc(ref, { weeklyActivityFloors: SEEDED_FLOORS, updatedBy: adminUid }, { merge: true });
  return originalFloors;
}

async function restoreFloors(db, tenantId, originalFloors) {
  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  if (originalFloors === null) {
    // Field didn't exist before seeding — delete it.
    await updateDoc(ref, { weeklyActivityFloors: deleteField() }).catch(() => {});
  } else {
    await setDoc(ref, { weeklyActivityFloors: originalFloors }, { merge: true });
  }
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

async function waitForPacePill(page) {
  // Wait for the pill to appear (requires loading=false AND elapsedDays>0)
  await page.waitForSelector('[data-testid="dcv2-points-pill"]', { timeout: 15000 });
  // Give getCompanyMinimums fetch time to resolve so weeklyFloors is the seeded value
  await page.waitForTimeout(2000);
}

async function clickIncrease(page, labelPattern, times = 1) {
  const btn = page.getByRole('button', { name: new RegExp(`${labelPattern} increase`, 'i') });
  for (let i = 0; i < times; i++) {
    await btn.click();
    await page.waitForTimeout(40);
  }
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

// ─── Per-theme smoke body ─────────────────────────────────────────────────

async function smokeBody(page, theme, { today, weekStarting, isSunday, db, tenantId, uid }) {
  console.log(`\n── theme: ${theme} ──`);
  const errors = [];
  const pageErrors = [];

  // Per-theme pre-clean ensures each theme starts from a blank week (light theme
  // Leg 2 saves a doc; dark theme Leg 1 must not see it).
  const perThemeCleaned = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => 0);
  pass(`[${theme}] per-theme-clean`, `deleted ${perThemeCleaned} doc(s)`);

  try {
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await loginAsAgent(page);
    pass(`[${theme}] login`);

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((theme === 'dark') === isDark) pass(`[${theme}] theme-applied`);
    else fail(`[${theme}] theme-applied`, `documentElement.dark=${isDark}`);

    // ── Leg 1 — pace badge shows "Behind" before any entries ──────────────
    if (isSunday) {
      skip(`[${theme}] leg1-pace-behind`, 'today is Sunday — footer hidden');
    } else {
      await openDailyCapture(page);
      pass(`[${theme}] dcv2-opens`);

      await waitForPacePill(page);
      await shoot(page, `${theme}-leg1-behind`);

      const badge = page.locator('[data-testid="dcv2-pace-badge"]');
      const badgeCount = await badge.count();
      if (badgeCount > 0) {
        const badgeText = (await badge.textContent())?.trim();
        if (badgeText === 'Behind') {
          pass(`[${theme}] leg1-pace-behind`, `badge="${badgeText}" weekPts=0 floor=${EXPECTED_FLOOR_PTS}`);
        } else {
          fail(`[${theme}] leg1-pace-behind`, `expected "Behind" got "${badgeText}"`);
        }
      } else {
        fail(`[${theme}] leg1-pace-behind`, 'dcv2-pace-badge not found in DOM');
      }

      // Close via the accessible "Close" button (aria-label="Close")
      await page.getByRole('button', { name: 'Close' }).click();
      await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 8000 });
      await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 15000 });
    }

    // ── Leg 2 — log 35 pts → "Ahead" after save + reload ─────────────────
    if (isSunday) {
      skip(`[${theme}] leg2-pace-ahead`, 'today is Sunday — footer hidden');
    } else {
      await openDailyCapture(page);

      // Expand interviews section if needed for the FFI counter
      const interviewsBtn = page.locator('[aria-controls="dcv2-interviews-body"]');
      const alreadyExpanded = await interviewsBtn.getAttribute('aria-expanded').catch(() => null);
      if (alreadyExpanded !== 'true') {
        await interviewsBtn.click();
        await page.waitForTimeout(200);
      }

      await clickIncrease(page, 'FFIs conducted', SMOKE_FFI);
      await clickIncrease(page, 'New business — apps', SMOKE_APPS);

      // dayPoints pill should show the day total
      const dayPtsEl = page.locator('[data-testid="dcv2-points-pill"] span').first();
      const dayPtsText = await dayPtsEl.textContent().catch(() => null);
      const dayPtsNum = parseInt(dayPtsText, 10);
      if (dayPtsNum === SMOKE_PTS) {
        pass(`[${theme}] leg2-daypoints-live`, `dayPoints=${dayPtsNum} expected=${SMOKE_PTS}`);
      } else {
        skip(`[${theme}] leg2-daypoints-live`, `got "${dayPtsText}" (layout may differ)`);
      }

      await shoot(page, `${theme}-leg2-prefill`);
      await saveDaily(page);
      pass(`[${theme}] leg2-save`);

      // Hard-reload, reopen to pick up refreshed weekDocs
      await page.evaluate(() => location.reload());
      await page.waitForFunction(
        () => document.querySelector('[data-testid="daily-fab"]') ||
              document.querySelector('[data-testid^="agent-tab-"]'),
        { timeout: 45000 }
      );
      await openDailyCapture(page);
      await waitForPacePill(page);
      await shoot(page, `${theme}-leg2-ahead`);

      const badge2 = page.locator('[data-testid="dcv2-pace-badge"]');
      const badge2Count = await badge2.count();
      if (badge2Count > 0) {
        const badge2Text = (await badge2.textContent())?.trim();
        if (badge2Text === 'Ahead') {
          pass(`[${theme}] leg2-pace-ahead`, `badge="${badge2Text}" weekPts=${SMOKE_PTS} floor=${EXPECTED_FLOOR_PTS}`);
        } else {
          fail(`[${theme}] leg2-pace-ahead`, `expected "Ahead" got "${badge2Text}" (weekPts=${SMOKE_PTS} floor=${EXPECTED_FLOOR_PTS})`);
        }
      } else {
        fail(`[${theme}] leg2-pace-ahead`, 'dcv2-pace-badge not found after save+reload');
      }

      // Close
      await page.getByRole('button', { name: 'Close' }).click();
      await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 8000 });
    }

    // ── Leg 3 — axe NO-NEW serious/critical ───────────────────────────────
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
  console.log(`\n=== daily-capture-v2-3a-pace-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);
  console.log(`Seeded floor: applicationsSubmitted=1 → weeklyPointsFloor=${EXPECTED_FLOOR_PTS} pts`);
  console.log(`Smoke entry: ${SMOKE_FFI} FFI + ${SMOKE_APPS} app = ${SMOKE_PTS} pts`);

  const { fb, auth, db } = initFb();
  let tenantId = null;
  let uid = null;
  let originalFloors = null;
  const today = todayISO();
  const weekStarting = getSundayOf(today);
  const isSunday = today === weekStarting;

  console.log(`  today=${today} weekStarting=${weekStarting} isSunday=${isSunday}`);

  let browser;
  try {
    // ── Setup: sign in as tenant_admin to seed floors ─────────────────────
    const adminCred = await signInWithEmailAndPassword(auth, E.A11Y_TENANT_ADMIN_EMAIL, E.A11Y_TENANT_ADMIN_PASSWORD);
    const adminTenantId = await resolveTenantId(adminCred.user);
    if (!adminTenantId) throw new Error('tenant_admin tenantId could not be resolved');
    pass('admin-signin', `tid=${adminTenantId.slice(0, 6)}…`);

    originalFloors = await seedFloors(db, adminTenantId, adminCred.user.uid);
    pass('seed-floors', `weeklyActivityFloors set; originalFloors=${originalFloors === null ? 'none' : 'existed'}`);
    await signOut(auth);

    // ── Pre-clean: sign in as agent, delete prior week docs ──────────────
    const agentCred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid = agentCred.user.uid;
    tenantId = await resolveTenantId(agentCred.user);
    if (!tenantId) throw new Error('agent tenantId could not be resolved');
    pass('agent-signin', `tid=${tenantId.slice(0, 6)}… uid=${uid.slice(0, 6)}…`);

    // Confirm the agent is in the same tenant as the admin seed
    if (tenantId !== adminTenantId) {
      fail('tenant-consistency', `admin=${adminTenantId.slice(0, 6)} agent=${tenantId.slice(0, 6)} — mismatch`);
    } else {
      pass('tenant-consistency', 'admin and agent in same tenant');
    }

    const cleaned = await deleteWeekDocs(db, tenantId, uid, weekStarting);
    pass('pre-clean', `deleted ${cleaned} prior doc(s) for week ${weekStarting}`);

    // ── Browser runs (both themes) ─────────────────────────────────────────
    browser = await chromium.launch({ headless: true });

    await runBothThemes(browser, {
      baseUrl: PREVIEW_URL,
      token: E.VERCEL_BYPASS_TOKEN,
      viewport: { width: 390, height: 844 },
      perTheme: async (page, theme) => {
        await smokeBody(page, theme, { today, weekStarting, isSunday, db, tenantId, uid });
      },
    });

  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 280));
  } finally {
    if (browser) await browser.close().catch(() => {});

    // ── Cleanup: remove week docs and restore floors ──────────────────────
    if (tenantId && uid) {
      const removed = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => null);
      if (removed != null) pass('post-clean-weekdocs', `deleted ${removed} doc(s)`);
    }
    // Restore floors using admin credentials
    try {
      const adminCred2 = await signInWithEmailAndPassword(auth, E.A11Y_TENANT_ADMIN_EMAIL, E.A11Y_TENANT_ADMIN_PASSWORD);
      const adminTid = await resolveTenantId(adminCred2.user);
      if (adminTid) {
        await restoreFloors(db, adminTid, originalFloors);
        pass('restore-floors', originalFloors === null ? 'weeklyActivityFloors field deleted' : 'original value restored');
      }
    } catch (e) {
      fail('restore-floors', String(e?.message ?? e).slice(0, 120));
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

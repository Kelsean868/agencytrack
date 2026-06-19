/**
 * daily-capture-v2-3b-working-days-smoke.mjs — Phase 3b working-days smoke.
 *
 * Proves the per-tenant `workingDaysPerWeek` config wires end-to-end:
 * config read → workingDays state → deriveWeekStripDays + pace denominator → DOM.
 *
 * Verifies:
 *   Setup    — seed tatillife_smoke companyMinimums.workingDaysPerWeek=6 +
 *              an apps-only floor=500 pts (wide pace band), via tenant_admin Web SDK
 *   Phase A (wd=6, both themes):
 *     Leg 1  — Saturday strip cell renders as a WORKING day (data-off="false")
 *     Leg 2  — pace badge reflects the /6 denominator: a points total that lands
 *              in a DIFFERENT badge state at /6 than it would at /5 (skipped on
 *              Sat — denominators coincide — and Sun — pill hidden)
 *     Leg 3  — axe NO-NEW serious/critical vs main baseline
 *   Phase B (default-5, field absent, both themes):
 *     Leg 4  — Saturday strip cell renders OFF (data-off="true") with the field absent
 *     Leg 5  — pace badge present (denominator falls back to 5; no divide-by-zero)
 *   Cleanup  — delete week docs; restore original workingDaysPerWeek + floors
 *
 * Run with:
 *   SMOKE_PREVIEW_URL=https://agencytrack-git-feat-daily-capture-v2-3b-working-days-kyron-marchan-s-projects.vercel.app \
 *   node scripts/verification/daily-capture-v2-3b-working-days-smoke.mjs
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
const SHOTS_DIR = join(__dir, `${RUN_TS}-dcv2-p3b-screenshots`);

// Seed: an apps-only floor → weeklyPointsFloor = 500 pts. The wide floor gives a
// wide flip band so a clean multiple-of-5 points total can always land in a
// DIFFERENT pace state at /6 than at /5 (see findFlipPoints).
const SEEDED_FLOORS = {
  callsMade:             0,
  telContacts:           0,
  appointmentsScheduled: 0,
  interviewsKept:        0,
  factFindsCompleted:    0,
  closingInterviewsKept: 0,
  applicationsSubmitted: 20,  // → 500 pts
  clientsSold:           0,
  api:                   0,
  referralsNewLeads:     0,
};
const FLOOR_PTS = 500;

// ─── Result tracking ──────────────────────────────────────────────────────

const results = [];
const pass = (s, n = '') => { results.push({ s, status: 'PASS', n }); console.log(`  ✓ ${s}${n ? ` — ${n}` : ''}`); };
const fail = (s, n = '') => { results.push({ s, status: 'FAIL', n }); console.log(`  ✗ ${s}${n ? ` — ${n}` : ''}`); };
const skip = (s, n = '') => { results.push({ s, status: 'SKIP', n }); console.log(`  ~ ${s}${n ? ` — ${n}` : ''}`); };

// ─── Date + pace helpers (mirror DailyCaptureV2.helpers.js exactly) ─────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// weekStarting + N days → 'YYYY-MM-DD' (UTC-noon anchored, matches helper math).
function addDaysISO(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function elapsedWorkingDays(today, weekStarting, wd) {
  const todayD     = new Date(today + 'T12:00:00Z');
  const weekStartD = new Date(weekStarting + 'T12:00:00Z');
  let count = 0;
  for (let i = 1; i <= wd; i++) {
    const d = new Date(weekStartD);
    d.setUTCDate(d.getUTCDate() + i);
    if (d <= todayD) count++;
  }
  return count;
}

function computePaceState(weekPoints, target) {
  if (target <= 0) return 'on-pace';
  const ratio = weekPoints / target;
  if (ratio < 0.95) return 'behind';
  if (ratio > 1.05) return 'ahead';
  return 'on-pace';
}

// Search for a points total W (multiple of 5, so reachable via apps×25 + ffi×5)
// that lands in a DIFFERENT pace state at /6 vs /5. Requires a comfortable margin
// from the ±5% thresholds to be robust against FP. Returns null on Sat/Sun where
// the two denominators coincide (no flip possible).
function findFlipPoints(today, weekStarting) {
  const e6 = elapsedWorkingDays(today, weekStarting, 6);
  const e5 = elapsedWorkingDays(today, weekStarting, 5);
  const t6 = FLOOR_PTS * (e6 / 6);
  const t5 = FLOOR_PTS * (e5 / 5);
  if (t6 === t5) return null; // Saturday: denominators coincide
  const margin = 0.03;
  for (let w = 5; w <= 4000; w += 5) {
    const s6 = computePaceState(w, t6);
    const s5 = computePaceState(w, t5);
    if (s6 === s5) continue;
    // Reject near-boundary picks on either denominator.
    const r6 = w / t6, r5 = w / t5;
    const nearEdge = (r) => Math.abs(r - 0.95) < margin || Math.abs(r - 1.05) < margin;
    if (nearEdge(r6) || nearEdge(r5)) continue;
    return { w, s6, s5, t6, t5, e6, e5 };
  }
  return null;
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
  }, 'dcv2-p3b-smoke');
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

async function seedConfig(db, tenantId, adminUid) {
  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const originalFloors = data.weeklyActivityFloors ?? null;
  const originalWd     = data.workingDaysPerWeek ?? null;
  await setDoc(ref, {
    weeklyActivityFloors: SEEDED_FLOORS,
    workingDaysPerWeek:   6,
    updatedBy:            adminUid,
  }, { merge: true });
  return { originalFloors, originalWd };
}

// Remove the workingDaysPerWeek field so the app falls back to the default (5).
async function clearWorkingDays(db, tenantId) {
  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  await updateDoc(ref, { workingDaysPerWeek: deleteField() }).catch(() => {});
}

async function restoreConfig(db, tenantId, { originalFloors, originalWd }) {
  const ref = doc(db, `tenants/${tenantId}/config/companyMinimums`);
  if (originalFloors === null) {
    await updateDoc(ref, { weeklyActivityFloors: deleteField() }).catch(() => {});
  } else {
    await setDoc(ref, { weeklyActivityFloors: originalFloors }, { merge: true });
  }
  if (originalWd === null) {
    await updateDoc(ref, { workingDaysPerWeek: deleteField() }).catch(() => {});
  } else {
    await setDoc(ref, { workingDaysPerWeek: originalWd }, { merge: true });
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
  // Give getCompanyMinimums fetch time to resolve so workingDays is the seeded value.
  await page.waitForTimeout(2000);
}

async function closeDailyCapture(page) {
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 8000 });
  await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 15000 });
}

async function readSaturdayOff(page, saturdayDate) {
  const cell = page.locator(`[data-testid="dcv2-strip-day-${saturdayDate}"]`);
  await cell.waitFor({ state: 'attached', timeout: 10000 });
  return cell.getAttribute('data-off');
}

async function clickIncrease(page, labelPattern, times = 1) {
  if (times <= 0) return;
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

async function reloadToDashboard(page) {
  await page.evaluate(() => location.reload());
  await page.waitForFunction(
    () => document.querySelector('[data-testid="daily-fab"]') ||
          document.querySelector('[data-testid^="agent-tab-"]'),
    { timeout: 45000 }
  );
}

async function shoot(page, name) {
  try {
    mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: false });
  } catch {}
}

async function runAxe(page, theme, tag) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = (axe.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
  if (serious.length === 0) {
    pass(`[${theme}] ${tag} axe-no-serious-critical`);
  } else {
    const top = serious.slice(0, 3).map((v) => `${v.id}(${v.nodes.length})`).join(', ');
    fail(`[${theme}] ${tag} axe-no-serious-critical`, top);
  }
}

// ─── Phase A — wd=6 active ──────────────────────────────────────────────────

async function smokeWd6(page, theme, ctx) {
  const { today, weekStarting, saturday, isSunday, isSaturday, flip, db, tenantId, uid } = ctx;
  console.log(`\n── Phase A (wd=6) theme: ${theme} ──`);

  const perThemeCleaned = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => 0);
  pass(`[${theme}] A per-theme-clean`, `deleted ${perThemeCleaned} doc(s)`);

  try {
    await loginAsAgent(page);
    pass(`[${theme}] A login`);

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((theme === 'dark') === isDark) pass(`[${theme}] A theme-applied`);
    else fail(`[${theme}] A theme-applied`, `documentElement.dark=${isDark}`);

    // ── Leg 1 — Saturday strip cell is a WORKING day at wd=6 ────────────────
    await openDailyCapture(page);
    await shoot(page, `${theme}-A-strip`);
    const off6 = await readSaturdayOff(page, saturday);
    if (off6 === 'false') {
      pass(`[${theme}] A leg1-saturday-working`, `data-off="false" (Sat ${saturday}, wd=6)`);
    } else {
      fail(`[${theme}] A leg1-saturday-working`, `expected data-off="false" got "${off6}"`);
    }

    // ── Leg 2 — pace badge reflects /6 denominator ──────────────────────────
    if (isSunday) {
      skip(`[${theme}] A leg2-pace-denominator`, 'today is Sunday — pace pill hidden');
      await closeDailyCapture(page);
    } else if (isSaturday || !flip) {
      skip(`[${theme}] A leg2-pace-denominator`,
        isSaturday ? 'today is Saturday — /5 and /6 denominators coincide' : 'no clean flip points for today');
      await closeDailyCapture(page);
    } else {
      // Log exactly `flip.w` points: apps (×25) then FFI (×5).
      const appsN = Math.floor(flip.w / 25);
      const ffiN  = (flip.w - appsN * 25) / 5;

      const interviewsBtn = page.locator('[aria-controls="dcv2-interviews-body"]');
      const expanded = await interviewsBtn.getAttribute('aria-expanded').catch(() => null);
      if (ffiN > 0 && expanded !== 'true') {
        await interviewsBtn.click();
        await page.waitForTimeout(200);
      }
      await clickIncrease(page, 'New business — apps', appsN);
      await clickIncrease(page, 'FFIs conducted', ffiN);
      await shoot(page, `${theme}-A-prefill`);

      await saveDaily(page);
      pass(`[${theme}] A leg2-save`, `logged ${flip.w} pts (${appsN} apps + ${ffiN} FFI)`);

      await reloadToDashboard(page);
      await openDailyCapture(page);
      await shoot(page, `${theme}-A-pace`);

      const badge = page.locator('[data-testid="dcv2-pace-badge"]');
      const badgeText = (await badge.count()) > 0 ? (await badge.textContent())?.trim() : null;
      const want = flip.s6 === 'behind' ? 'Behind' : flip.s6 === 'ahead' ? 'Ahead' : 'On-pace';
      const wouldBe5 = flip.s5 === 'behind' ? 'Behind' : flip.s5 === 'ahead' ? 'Ahead' : 'On-pace';
      if (badgeText === want) {
        pass(`[${theme}] A leg2-pace-denominator`,
          `badge="${badgeText}" (==/6); at /5 would be "${wouldBe5}". W=${flip.w} t6=${flip.t6.toFixed(1)} t5=${flip.t5.toFixed(1)}`);
      } else {
        fail(`[${theme}] A leg2-pace-denominator`,
          `expected "${want}" (/6) got "${badgeText}"; /5 would be "${wouldBe5}". W=${flip.w}`);
      }
      await closeDailyCapture(page);
    }

    // ── Leg 3 — axe ─────────────────────────────────────────────────────────
    await openDailyCapture(page);
    await runAxe(page, theme, 'A');
    await closeDailyCapture(page);

  } catch (err) {
    fail(`[${theme}] A browser-error`, String(err?.message ?? err).slice(0, 280));
  }
}

// ─── Phase B — default-5 (workingDaysPerWeek field absent) ───────────────────

async function smokeDefault5(page, theme, ctx) {
  const { weekStarting, saturday, db, tenantId, uid } = ctx;
  console.log(`\n── Phase B (default-5) theme: ${theme} ──`);

  const cleaned = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => 0);
  pass(`[${theme}] B per-theme-clean`, `deleted ${cleaned} doc(s)`);

  try {
    await loginAsAgent(page);
    pass(`[${theme}] B login`);

    await openDailyCapture(page);
    await shoot(page, `${theme}-B-strip`);

    // ── Leg 4 — Saturday strip cell is OFF when the field is absent ──────────
    const off5 = await readSaturdayOff(page, saturday);
    if (off5 === 'true') {
      pass(`[${theme}] B leg4-saturday-off`, `data-off="true" (Sat ${saturday}, field absent → default 5)`);
    } else {
      fail(`[${theme}] B leg4-saturday-off`, `expected data-off="true" got "${off5}"`);
    }

    // ── Leg 5 — pace pill present (denominator falls back to 5, no NaN) ──────
    const isSunday = ctx.isSunday;
    if (isSunday) {
      skip(`[${theme}] B leg5-pace-present`, 'today is Sunday — pace pill hidden');
    } else {
      const pill = page.locator('[data-testid="dcv2-points-pill"]');
      if ((await pill.count()) > 0) {
        const badge = page.locator('[data-testid="dcv2-pace-badge"]');
        const badgeText = (await badge.count()) > 0 ? (await badge.textContent())?.trim() : '(no badge)';
        const valid = ['Behind', 'On-pace', 'Ahead'].includes(badgeText);
        if (valid) pass(`[${theme}] B leg5-pace-present`, `badge="${badgeText}" (default-5 denominator, no divide-by-zero)`);
        else fail(`[${theme}] B leg5-pace-present`, `unexpected badge text "${badgeText}"`);
      } else {
        // Pill only shows once elapsedDays>0; on a fresh week with 0 pts it still
        // renders Behind. Absence here is a real regression on a weekday.
        fail(`[${theme}] B leg5-pace-present`, 'dcv2-points-pill not found');
      }
    }
    await closeDailyCapture(page);

  } catch (err) {
    fail(`[${theme}] B browser-error`, String(err?.message ?? err).slice(0, 280));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== daily-capture-v2-3b-working-days-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);

  const { fb, auth, db } = initFb();
  let tenantId = null;
  let uid = null;
  let original = { originalFloors: null, originalWd: null };

  const today = todayISO();
  const weekStarting = getSundayOf(today);
  const saturday = addDaysISO(weekStarting, 6);
  const isSunday = today === weekStarting;
  const isSaturday = today === saturday;
  const flip = findFlipPoints(today, weekStarting);

  console.log(`  today=${today} weekStarting=${weekStarting} saturday=${saturday}`);
  console.log(`  isSunday=${isSunday} isSaturday=${isSaturday}`);
  console.log(`  flip=${flip ? `W=${flip.w} /6→${flip.s6} /5→${flip.s5} (e6=${flip.e6} e5=${flip.e5})` : 'none (Sat/Sun)'}`);

  let browser;
  try {
    // ── Setup: tenant_admin seeds config (wd=6 + floors) ──────────────────
    const adminCred = await signInWithEmailAndPassword(auth, E.A11Y_TENANT_ADMIN_EMAIL, E.A11Y_TENANT_ADMIN_PASSWORD);
    const adminTenantId = await resolveTenantId(adminCred.user);
    if (!adminTenantId) throw new Error('tenant_admin tenantId could not be resolved');
    pass('admin-signin', `tid=${adminTenantId.slice(0, 6)}…`);

    original = await seedConfig(db, adminTenantId, adminCred.user.uid);
    pass('seed-config', `workingDaysPerWeek=6 + floor=${FLOOR_PTS}pts; origWd=${original.originalWd ?? 'none'} origFloors=${original.originalFloors === null ? 'none' : 'existed'}`);
    await signOut(auth);

    // ── Pre-clean: agent deletes prior week docs ──────────────────────────
    const agentCred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid = agentCred.user.uid;
    tenantId = await resolveTenantId(agentCred.user);
    if (!tenantId) throw new Error('agent tenantId could not be resolved');
    pass('agent-signin', `tid=${tenantId.slice(0, 6)}… uid=${uid.slice(0, 6)}…`);
    if (tenantId !== adminTenantId) {
      fail('tenant-consistency', `admin=${adminTenantId.slice(0, 6)} agent=${tenantId.slice(0, 6)} — mismatch`);
    } else {
      pass('tenant-consistency', 'admin and agent in same tenant');
    }
    const cleaned = await deleteWeekDocs(db, tenantId, uid, weekStarting);
    pass('pre-clean', `deleted ${cleaned} prior doc(s) for week ${weekStarting}`);

    const ctx = { today, weekStarting, saturday, isSunday, isSaturday, flip, db, tenantId, uid };
    browser = await chromium.launch({ headless: true });

    // ── Phase A — wd=6, both themes ────────────────────────────────────────
    await runBothThemes(browser, {
      baseUrl: PREVIEW_URL,
      token: E.VERCEL_BYPASS_TOKEN,
      viewport: { width: 390, height: 844 },
      perTheme: async (page, theme) => { await smokeWd6(page, theme, ctx); },
    });

    // ── Flip config to default-5 (field absent) ────────────────────────────
    const adminCred2 = await signInWithEmailAndPassword(auth, E.A11Y_TENANT_ADMIN_EMAIL, E.A11Y_TENANT_ADMIN_PASSWORD);
    const adminTid2 = await resolveTenantId(adminCred2.user);
    await clearWorkingDays(db, adminTid2);
    pass('clear-working-days', 'workingDaysPerWeek field deleted → app falls back to default 5');
    await signOut(auth);
    // Re-auth as agent for the harness-side cleanups inside Phase B bodies.
    await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);

    // ── Phase B — default-5, both themes ───────────────────────────────────
    await runBothThemes(browser, {
      baseUrl: PREVIEW_URL,
      token: E.VERCEL_BYPASS_TOKEN,
      viewport: { width: 390, height: 844 },
      perTheme: async (page, theme) => { await smokeDefault5(page, theme, ctx); },
    });

  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 280));
  } finally {
    if (browser) await browser.close().catch(() => {});

    if (tenantId && uid) {
      const removed = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => null);
      if (removed != null) pass('post-clean-weekdocs', `deleted ${removed} doc(s)`);
    }
    try {
      const adminCred3 = await signInWithEmailAndPassword(auth, E.A11Y_TENANT_ADMIN_EMAIL, E.A11Y_TENANT_ADMIN_PASSWORD);
      const adminTid3 = await resolveTenantId(adminCred3.user);
      if (adminTid3) {
        await restoreConfig(db, adminTid3, original);
        pass('restore-config', `floors=${original.originalFloors === null ? 'deleted' : 'restored'} wd=${original.originalWd === null ? 'deleted' : `restored(${original.originalWd})`}`);
      }
    } catch (e) {
      fail('restore-config', String(e?.message ?? e).slice(0, 120));
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

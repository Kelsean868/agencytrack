/**
 * daily-capture-v2-5-manager-days-worked-smoke.mjs — DCv2 Phase 5 smoke.
 *
 * Proves the manager sees emergent effort signals that reflect REAL daily
 * logging — not just that fields exist in Firestore. Mirrors the 1b aggregator
 * smoke's seed pattern (write daily docs → run the REAL ESM aggregator → write
 * the submission, exactly what aggregate-on-save does — NOT a hand-written
 * `{daysWorked: 3}` submission) and the Phase 4 smoke's UI/axe harness.
 *
 * Seed (SDK, as the A11Y agent):
 *   Week A (current): Thu + Fri + Sat → daysWorked=3, weekendWorked=true,
 *     weekendApi=4000 (Sat NB.api).  [positive leg]
 *   Week B (prior):   Mon + Tue       → daysWorked=2, weekendWorked=false,
 *     weekendApi=0.                    [negative leg]
 *
 * Render (UI, as the A11Y branch_manager — same branch as the agent
 * (smoke_branch), so getWeeklySubmissions's branchId filter returns the row;
 * tenant_admin uses a config-only dashboard with no Master Sheet), both themes,
 * desktop viewport:
 *   Leg 1 — SDK read-back: aggregator wrote the three fields correctly.
 *   Leg 2 — Master Sheet, Week A: days-worked cell = 3, weekend marker = yes,
 *           Wknd API reflects 4000.
 *   Leg 3 — Master Sheet, Week B: days-worked cell = 2, weekend marker = no.
 *   Leg 4 — axe NO-NEW serious/critical on the Master Sheet view.
 *
 * Run with:
 *   SMOKE_PREVIEW_URL=https://agencytrack-git-feat-dcv2-phase-33f03e-kyron-marchan-s-projects.vercel.app \
 *   node scripts/verification/daily-capture-v2-5-manager-days-worked-smoke.mjs
 */

import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore,
  collection, query, where, getDocs,
  doc, setDoc, getDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resolvePreviewUrl, runBothThemes } from './lib/walk-helpers.mjs';
import { aggregateDailyToWeekly } from '../../src/lib/schema/dailyActivity.aggregator.js';

// ─── Env ───────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');

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
const SHOTS_DIR = join(__dir, `${RUN_TS}-dcv2-p5-screenshots`);

// ─── Result tracking ──────────────────────────────────────────────────────

const results = [];
const pass = (s, n = '') => { results.push({ s, status: 'PASS', n }); console.log(`  ✓ ${s}${n ? ` — ${n}` : ''}`); };
const fail = (s, n = '') => { results.push({ s, status: 'FAIL', n }); console.log(`  ✗ ${s}${n ? ` — ${n}` : ''}`); };

// ─── Date helpers (TT-anchored, UTC-4) ──────────────────────────────────────

function currentSundayTT() {
  const ttMs = Date.now() - 4 * 3600 * 1000;
  const tt = new Date(ttMs);
  const dow = tt.getUTCDay();
  const sun = new Date(ttMs - dow * 86400000);
  const y = sun.getUTCFullYear();
  const m = String(sun.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sun.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function addDays(sunday, n) {
  const [y, mo, d] = sunday.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
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
  }, 'dcv2-p5-smoke');
  return { fb, auth: getAuth(fb), db: getFirestore(fb) };
}

function dailyDoc(date, weekStarting, uid, fields) {
  return {
    version: 1, weeklyReportVersion: 2,
    date, weekStarting, agentId: uid, agentName: 'P5 Smoke Agent',
    qualifiedApproaches: 0, appointmentsSet: 0, ffiConducted: 0, ciConducted: 0,
    newBusiness: { apps: 0, api: 0 }, pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums: { grossAmount: 0 }, newNamesAdded: 0,
    ...fields,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
}

async function listWeekDailyDocs(db, tenantId, uid, weekStarting) {
  const colRef = collection(db, `tenants/${tenantId}/users/${uid}/dailyActivity`);
  const snap = await getDocs(query(colRef, where('weekStarting', '==', weekStarting)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function deleteWeekDailyDocs(db, tenantId, uid, weekStarting) {
  const docs = await listWeekDailyDocs(db, tenantId, uid, weekStarting);
  for (const d of docs) {
    await deleteDoc(doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${d.id}`));
  }
  return docs.length;
}

/**
 * Replicate aggregateCurrentWeekDaily: write the daily docs, fetch them, run
 * the REAL ESM aggregator, write the resulting rollup to the submission path
 * with merge:true. Returns the submission data read back.
 */
async function seedWeek(db, tenantId, uid, branchId, unitId, weekStarting, dailies) {
  await deleteWeekDailyDocs(db, tenantId, uid, weekStarting);
  for (const dd of dailies) {
    await setDoc(doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${dd.date}`), dd);
  }
  const fetched = (await listWeekDailyDocs(db, tenantId, uid, weekStarting)).map(({ id, ...rest }) => rest);
  const rollup = aggregateDailyToWeekly(fetched, 0);
  const subRef = doc(db, `tenants/${tenantId}/submissions/${uid}_${weekStarting}`);
  await setDoc(subRef, {
    ...rollup,
    userId: uid, agentId: uid, agentName: 'P5 Smoke Agent',
    unitId, branchId, weekStarting, status: 'draft',
    aggregatedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });
  const snap = await getDoc(subRef);
  return snap.data();
}

// ─── Browser helpers ──────────────────────────────────────────────────────

async function shoot(page, name) {
  try { mkdirSync(SHOTS_DIR, { recursive: true }); await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: false }); } catch {}
}

async function loginAsManager(page) {
  await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', E.A11Y_BRANCH_MANAGER_EMAIL);
  await page.fill('input[type="password"]', E.A11Y_BRANCH_MANAGER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="nav-mastersheet"]', { timeout: 45000 });
}

async function openMasterSheet(page) {
  await page.click('[data-testid="nav-mastersheet"]');
  await page.waitForSelector('select[aria-label="Select week"]', { timeout: 20000 });
}

// Select a week and wait for the agent's days-worked cell to settle on `expected`.
async function selectWeekAndReadDays(page, uid, weekStarting, expected) {
  await page.locator('select[aria-label="Select week"]').selectOption(weekStarting);
  await page.waitForFunction(
    ([id, exp]) => {
      const el = document.querySelector(`[data-testid="days-worked-${id}"]`);
      return el && el.textContent.trim() === exp;
    },
    [uid, String(expected)],
    { timeout: 20000 },
  );
}

async function runAxe(page, theme, tag) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = (axe.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
  if (serious.length === 0) pass(`[${theme}] ${tag} axe-no-serious-critical`);
  else fail(`[${theme}] ${tag} axe-no-serious-critical`, serious.slice(0, 3).map((v) => `${v.id}(${v.nodes.length})`).join(', '));
}

// ─── Per-theme render leg ──────────────────────────────────────────────────

async function smokeTheme(page, theme, ctx) {
  const { uid, weekA, weekB } = ctx;
  console.log(`\n── theme: ${theme} ──`);
  try {
    await loginAsManager(page);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((theme === 'dark') === isDark) pass(`[${theme}] theme-applied`);
    else fail(`[${theme}] theme-applied`, `documentElement.dark=${isDark}`);

    await openMasterSheet(page);

    // ── Leg 2 — Week A (weekend-worked) ─────────────────────────────────────
    await selectWeekAndReadDays(page, uid, weekA, 3);
    await shoot(page, `${theme}-weekA`);
    pass(`[${theme}] leg2a-days-worked-3`, 'days-worked cell = 3 (Thu+Fri+Sat)');

    const markerA = page.locator(`[data-testid="weekend-marker-${uid}"]`);
    const stateA = await markerA.getAttribute('data-weekend');
    if (stateA === 'yes') pass(`[${theme}] leg2b-weekend-marker-present`, 'data-weekend="yes"');
    else fail(`[${theme}] leg2b-weekend-marker-present`, `expected "yes" got "${stateA}"`);
    const markerHasIcon = await markerA.locator('svg').count();
    if (markerHasIcon > 0) pass(`[${theme}] leg2c-weekend-badge-icon`, 'CalendarCheck icon rendered');
    else fail(`[${theme}] leg2c-weekend-badge-icon`, 'no icon in weekend badge');

    // Wknd API column reflects the Saturday NB.api (4000 → "$4,000" via formatCurrency)
    const wkndApiText = await page.locator(`[data-testid="days-worked-${uid}"]`)
      .evaluate((el) => {
        // walk to the row, find the cell two columns to the right (Weekend, Wknd API)
        const row = el.closest('tr');
        const cells = Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim());
        return cells.join(' | ');
      });
    if (/4[,.]?000/.test(wkndApiText)) pass(`[${theme}] leg2d-weekend-api`, `row cells include weekend API 4000 — "${wkndApiText.slice(0, 120)}…"`);
    else fail(`[${theme}] leg2d-weekend-api`, `4000 not found in row: "${wkndApiText.slice(0, 160)}"`);

    // ── Leg 3 — Week B (weekday-only, negative) ─────────────────────────────
    await selectWeekAndReadDays(page, uid, weekB, 2);
    await shoot(page, `${theme}-weekB`);
    pass(`[${theme}] leg3a-days-worked-2`, 'days-worked cell = 2 (Mon+Tue)');

    const markerB = page.locator(`[data-testid="weekend-marker-${uid}"]`);
    const stateB = await markerB.getAttribute('data-weekend');
    if (stateB === 'no') pass(`[${theme}] leg3b-weekend-marker-absent`, 'data-weekend="no"');
    else fail(`[${theme}] leg3b-weekend-marker-absent`, `expected "no" got "${stateB}"`);
    const markerBIcon = await markerB.locator('svg').count();
    if (markerBIcon === 0) pass(`[${theme}] leg3c-no-badge-icon`, 'weekday-only → no icon (em-dash)');
    else fail(`[${theme}] leg3c-no-badge-icon`, `unexpected icon present (count=${markerBIcon})`);

    // ── Leg 4 — axe NO-NEW ──────────────────────────────────────────────────
    await runAxe(page, theme, 'mastersheet');

  } catch (err) {
    fail(`[${theme}] browser-error`, String(err?.message ?? err).slice(0, 280));
    await shoot(page, `${theme}-ERROR`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== daily-capture-v2-5-manager-days-worked-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);

  const { fb, auth, db } = initFb();
  let tenantId = null, uid = null, browser = null;

  const weekA = currentSundayTT();
  const weekB = addDays(weekA, -7);
  console.log(`  weekA(current)=${weekA}  weekB(prior)=${weekB}`);

  try {
    // ── Seed as the agent ──────────────────────────────────────────────────
    const agentCred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid = agentCred.user.uid;
    const tok = await agentCred.user.getIdTokenResult(true);
    tenantId = tok.claims?.tenantId ?? null;
    const branchId = tok.claims?.branchId ?? null;
    const unitId   = tok.claims?.unitId   ?? null;
    if (!tenantId) throw new Error('agent tenantId could not be resolved');
    pass('agent-signin', `tid=${tenantId.slice(0, 8)}… uid=${uid.slice(0, 8)}… branch=${branchId}`);

    // Week A: Thu(+4) api 2000, Fri(+5) api 0, Sat(+6) api 4000 → weekend api 4000
    const subA = await seedWeek(db, tenantId, uid, branchId, unitId, weekA, [
      dailyDoc(addDays(weekA, 4), weekA, uid, { qualifiedApproaches: 3, newBusiness: { apps: 1, api: 2000 } }),
      dailyDoc(addDays(weekA, 5), weekA, uid, { qualifiedApproaches: 2 }),
      dailyDoc(addDays(weekA, 6), weekA, uid, { qualifiedApproaches: 1, newBusiness: { apps: 1, api: 4000 } }),
    ]);
    pass('seed-weekA', `Thu+Fri+Sat written + aggregated for ${weekA}`);

    // Week B: Mon(+1) api 1500, Tue(+2) api 0 → weekday-only
    const subB = await seedWeek(db, tenantId, uid, branchId, unitId, weekB, [
      dailyDoc(addDays(weekB, 1), weekB, uid, { qualifiedApproaches: 2, newBusiness: { apps: 1, api: 1500 } }),
      dailyDoc(addDays(weekB, 2), weekB, uid, { qualifiedApproaches: 1 }),
    ]);
    pass('seed-weekB', `Mon+Tue written + aggregated for ${weekB}`);

    // ── Leg 1 — SDK read-back: the REAL aggregator wrote the fields ──────────
    console.log('\n  — Leg 1: aggregator field assertions (SDK read-back) —');
    const chk = (label, actual, expected) => {
      if (actual === expected) pass(label, String(actual));
      else fail(label, `expected ${expected} got ${actual}`);
    };
    chk('weekA.daysWorked', subA.daysWorked, 3);
    chk('weekA.weekendWorked', subA.weekendWorked, true);
    chk('weekA.weekendApi', subA.weekendApi, 4000);
    chk('weekB.daysWorked', subB.daysWorked, 2);
    chk('weekB.weekendWorked', subB.weekendWorked, false);
    chk('weekB.weekendApi', subB.weekendApi, 0);

    // ── Render legs (both themes) ───────────────────────────────────────────
    const ctx = { uid, weekA, weekB };
    browser = await chromium.launch({ headless: true });
    await runBothThemes(browser, {
      baseUrl: PREVIEW_URL,
      token: E.VERCEL_BYPASS_TOKEN,
      viewport: { width: 1280, height: 900 },
      perTheme: async (page, theme) => { await smokeTheme(page, theme, ctx); },
    });

  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 280));
    console.error(err);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (tenantId && uid) {
      const a = await deleteWeekDailyDocs(db, tenantId, uid, weekA).catch(() => null);
      const b = await deleteWeekDailyDocs(db, tenantId, uid, weekB).catch(() => null);
      pass('cleanup-daily-docs', `weekA deleted ${a}, weekB deleted ${b} (submissions delete-blocked by rules — drafts left, harmless on smoke tenant)`);
    }
    try { await signOut(auth); } catch {}
    try { await deleteApp(fb); } catch {}
  }

  const total  = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const ok = failed === 0;
  console.log(`\n=== RESULT: ${passed}/${total} passed, ${failed} failed — ${ok ? 'OK ✓' : 'FAILED ✗'} ===`);
  console.log(`Screenshots: ${SHOTS_DIR}\n`);
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err?.stack ?? err);
  process.exit(1);
});

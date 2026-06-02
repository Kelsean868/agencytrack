/**
 * daily-capture-v2-smoke.mjs — Track J Daily Capture v2 (Slice 1) PR smoke.
 *
 * Phase 3.2 — LIVE write-read-verify (both themes, Vercel preview, incognito).
 * Phase 3.3 — Count-strip live read (≥2 daily docs in week → exercise list/range).
 * Phase 3.4 — Aggregation regression (doc shape stable; aggregator emits namesFromOther/oldNamesPool).
 * Phase 3.5 — axe NO-NEW serious/critical vs main baseline, both themes.
 *
 * The smoke uses the Firebase Web SDK directly from Node for:
 *   - pre-cleanup + pre-seeding of the agent's week (so chip sums are deterministic)
 *   - post-test cleanup (restore state)
 *   - direct doc read + aggregator regression invocation
 *
 * All in-app writes flow through the V2 UI → real Firebase SDK → real Firestore
 * rules. No REST writes (per the lib helpers' lesson #8).
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
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { setupBypassSession } from './lib/walk-helpers.mjs';
import { aggregateDailyToWeekly } from '../../src/lib/schema/dailyActivity.aggregator.js';
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

// Vercel truncated the long branch name with a hash suffix —
// `redesign/daily-capture-v2` → `redesign-daily-5c6e28`. Captured from the
// Vercel preview-bot comment on PR #426 (target_url decoded).
const PREVIEW_URL = process.env.SMOKE_PREVIEW_URL
  ?? 'https://agencytrack-git-redesign-daily-5c6e28-kyron-marchan-s-projects.vercel.app';
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = join(__dir, `${RUN_TS}-dcv2-screenshots`);

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

function secondDayInWeek(todayStr) {
  // Pick a "second day" in the same week as today. Yesterday by default; if today
  // is Sunday (no prior day in this week), use tomorrow instead.
  const today = new Date(todayStr + 'T12:00:00Z');
  const offset = today.getUTCDay() === 0 ? 1 : -1; // Sun → tomorrow; else → yesterday
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + offset);
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return iso;
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
  }, 'dcv2-smoke');
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

async function seedSecondDay(db, tenantId, uid, agentName, dateStr) {
  const ref = doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${dateStr}`);
  await setDoc(ref, {
    version: 1,
    weeklyReportVersion: 2,
    date: dateStr,
    weekStarting: getSundayOf(dateStr),
    agentId: uid,
    agentName,
    qualifiedApproaches: 4,
    appointmentsSet: 1,
    ffisScheduled: 1,
    ffiConducted: 1,
    solutionPresentations: 0,
    newCIBooked: 1,
    oldCIBooked: 0,
    ciConducted: 1,
    newBusiness:  { apps: 1, api: 6000 },
    pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums:     { grossAmount: 0 },
    newNamesAdded: 2,
    oldNamesWorked: 1,
    serviceContacts: 0,
    hoursWorked: null,
    wins: '',
    blockers: '',
    notes: '',
    isCatchUp: false,
    catchUpStartDate: null,
    catchUpEndDate: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─── In-page helpers ──────────────────────────────────────────────────────

async function loginAsAgent(page) {
  await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', E.A11Y_AGENT_EMAIL);
  await page.fill('input[type="password"]', E.A11Y_AGENT_PASSWORD);
  await page.click('button[type="submit"]');
  // Dashboard ready signal — daily FAB or any agent tab.
  await page.waitForFunction(
    () => document.querySelector('[data-testid="daily-fab"]') ||
          document.querySelector('[data-testid^="agent-tab-"]'),
    { timeout: 45000 }
  );
}

async function openDailyCapture(page) {
  // Wait until the FAB is enabled / clickable.
  await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 20000 });
  await page.click('[data-testid="daily-fab"]');
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { timeout: 15000 });
  // Allow week-doc read to resolve.
  await page.waitForFunction(
    () => {
      const v = document.querySelector('[data-testid="dcv2-chip-appr"]')?.textContent?.trim();
      return v != null && v !== '–';
    },
    { timeout: 15000 }
  );
}

async function readChips(page) {
  return await page.evaluate(() => {
    const get = (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return null;
      const n = el.textContent.replace(/[^0-9]/g, '');
      return n === '' ? 0 : parseInt(n, 10);
    };
    return {
      appr: get('dcv2-chip-appr'),
      ffi:  get('dcv2-chip-ffi'),
      ci:   get('dcv2-chip-ci'),
      apps: get('dcv2-chip-apps'),
    };
  });
}

async function clickStepperIncrease(page, fieldLabel, times = 1) {
  const btn = page.getByRole('button', { name: new RegExp(`${fieldLabel} increase`, 'i') });
  for (let i = 0; i < times; i++) {
    await btn.click();
    await page.waitForTimeout(50);
  }
}

async function fillMoneyRow(page, ariaLabel, value) {
  const input = page.getByLabel(ariaLabel, { exact: false });
  await input.fill(String(value));
}

async function saveDaily(page) {
  await page.click('[data-testid="dcv2-save"]');
  // Modal auto-closes ~600ms after success.
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 15000 });
}

async function setTheme(context, theme) {
  // main.jsx reads localStorage.getItem('agencytrack-dark') === '1' — not 'true'.
  await context.addInitScript((t) => {
    try {
      if (t === 'dark') localStorage.setItem('agencytrack-dark', '1');
      else localStorage.removeItem('agencytrack-dark');
    } catch {}
  }, theme);
}

async function shoot(page, name) {
  try {
    mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: false });
  } catch {}
}

// ─── Theme run ────────────────────────────────────────────────────────────

async function runTheme(browser, theme, expectedBaseChips) {
  console.log(`\n── theme: ${theme} ──`);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  let pageErrors = [];

  try {
    await setupBypassSession(context, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await setTheme(context, theme);

    const page = await context.newPage();
    const debugLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('[dcv2-debug]')) debugLogs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') errors.push(text);
    });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await loginAsAgent(page);
    pass(`[${theme}] login`);

    // Theme assertion — root class should reflect chosen mode.
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((theme === 'dark') === isDark) pass(`[${theme}] theme-applied`);
    else fail(`[${theme}] theme-applied`, `documentElement.dark=${isDark}`);

    // ── Phase 3.3 (part A) — open Daily Capture, verify chips reflect pre-seed
    await openDailyCapture(page);
    pass(`[${theme}] dcv2-opens`);
    await shoot(page, `${theme}-dcv2-open`);

    const chipsBefore = await readChips(page);
    if (
      chipsBefore.appr === expectedBaseChips.appr &&
      chipsBefore.ffi  === expectedBaseChips.ffi  &&
      chipsBefore.ci   === expectedBaseChips.ci   &&
      chipsBefore.apps === expectedBaseChips.apps
    ) {
      pass(`[${theme}] count-strip-live-read (≥2 day query)`, JSON.stringify(chipsBefore));
    } else {
      fail(
        `[${theme}] count-strip-live-read`,
        `expected ${JSON.stringify(expectedBaseChips)} got ${JSON.stringify(chipsBefore)}`
      );
    }

    // ── Phase 3.2 — write today via the V2 UI (verified key bindings)
    // Add: APPR +3, FFI +1, CI +1 (via "CIs conducted"), APPS +1, NB-API = 5000
    await clickStepperIncrease(page, 'Qualified approaches', 3);
    await clickStepperIncrease(page, 'FFIs conducted', 1);
    await clickStepperIncrease(page, 'CIs conducted', 1);
    await clickStepperIncrease(page, 'New business — apps', 1);
    await fillMoneyRow(page, 'New business — API (TTD)', 5000);

    // Also flex the bug-target storage keys to guarantee they were exposed to UI:
    await clickStepperIncrease(page, 'New CIs booked', 1);

    await shoot(page, `${theme}-dcv2-filled`);

    await saveDaily(page);
    pass(`[${theme}] save-success`);

    // ── axe NO-NEW serious/critical (re-open form for the surface scan)
    await openDailyCapture(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = (axe.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
    if (serious.length === 0) pass(`[${theme}] axe-no-serious-critical`);
    else {
      const top = serious.slice(0, 3).map((v) => `${v.id}(${v.nodes.length})`).join(', ');
      fail(`[${theme}] axe-no-serious-critical`, top);
    }

    // ── Phase 3.2 cont. — hard-reload and verify the form pre-populates from
    //    the just-saved doc.
    await page.evaluate(() => location.reload());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="daily-fab"]') ||
            document.querySelector('[data-testid^="agent-tab-"]'),
      { timeout: 45000 }
    );
    await openDailyCapture(page);

    const reread = await readChips(page);
    const expectAfter = {
      appr: expectedBaseChips.appr + 3,
      ffi:  expectedBaseChips.ffi  + 1,
      ci:   expectedBaseChips.ci   + 1,
      apps: expectedBaseChips.apps + 1,
    };
    if (
      reread.appr === expectAfter.appr &&
      reread.ffi  === expectAfter.ffi  &&
      reread.ci   === expectAfter.ci   &&
      reread.apps === expectAfter.apps
    ) {
      pass(`[${theme}] post-save-chip-refresh`, JSON.stringify(reread));
    } else {
      fail(
        `[${theme}] post-save-chip-refresh`,
        `expected ${JSON.stringify(expectAfter)} got ${JSON.stringify(reread)}`
      );
    }

    // Verify the API money field pre-populates (proves the saved doc loads back).
    const apiInputVal = await page.getByLabel('New business — API (TTD)', { exact: false }).inputValue();
    const apiOk = /5000|5,?000\.?0?0?/.test(apiInputVal);
    if (apiOk) pass(`[${theme}] today-pre-populates`, `nb.api=${apiInputVal}`);
    else fail(`[${theme}] today-pre-populates`, `expected 5000 got "${apiInputVal}"`);

    await shoot(page, `${theme}-dcv2-postreload`);

    // ── DCV2 diagnostic dump
    if (debugLogs.length) {
      console.log(`  [${theme}] dcv2-debug log entries (${debugLogs.length}):`);
      debugLogs.forEach((l) => console.log('    ' + l));
    } else {
      console.log(`  [${theme}] dcv2-debug log entries: 0 (component may not have logged)`);
    }

    // ── JS errors / page errors (ignore CORS-blocked Fontshare CDN — design font, not load-bearing)
    const filt = (xs) => xs.filter((t) => !/ResizeObserver|favicon|net::ERR|api\.fontshare\.com/.test(t));
    if (filt(errors).length === 0 && filt(pageErrors).length === 0) {
      pass(`[${theme}] no-js-errors`);
    } else {
      fail(`[${theme}] no-js-errors`, `console=${filt(errors).slice(0, 2).join(' | ')} page=${filt(pageErrors).slice(0, 2).join(' | ')}`);
    }
  } catch (err) {
    fail(`[${theme}] browser-error`, String(err?.message ?? err).slice(0, 240));
  } finally {
    await context.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== daily-capture-v2-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);

  const { fb, auth, db } = initFb();
  let tenantId = null;
  let uid = null;
  const today = todayISO();
  const weekStarting = getSundayOf(today);
  const seedDate = secondDayInWeek(today);

  let browser;
  try {
    // ── Pre-clean + pre-seed via Node Web SDK ─────────────────────────────
    const cred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid = cred.user.uid;
    tenantId = await resolveTenantId(cred.user);
    if (!tenantId) throw new Error('tenantId could not be resolved from claims for the test agent');
    pass('sdk-signin', `tid=${tenantId.slice(0, 6)}… uid=${uid.slice(0, 6)}…`);

    const deletedCount = await deleteWeekDocs(db, tenantId, uid, weekStarting);
    pass('pre-clean-week', `deleted ${deletedCount} prior doc(s) for week ${weekStarting}`);

    await seedSecondDay(db, tenantId, uid, 'Test Agent', seedDate);
    pass('pre-seed-second-day', `${seedDate} weekStarting=${weekStarting}`);

    // Expected chip baseline = the seed values.
    const expectedBaseChips = { appr: 4, ffi: 1, ci: 1, apps: 1 };

    // ── Browser runs ──────────────────────────────────────────────────────
    browser = await chromium.launch({ headless: true });

    await runTheme(browser, 'light', expectedBaseChips);

    // After theme 1, today's doc has been written with deltas. Read current
    // chip state to feed theme 2 (so its baseline assertion is accurate).
    const afterLight = await listWeekDocs(db, tenantId, uid, weekStarting);
    const chipsAfterLight = afterLight.reduce(
      (acc, e) => ({
        appr: acc.appr + (parseInt(e.qualifiedApproaches, 10) || 0),
        ffi:  acc.ffi  + (parseInt(e.ffiConducted,         10) || 0),
        ci:   acc.ci   + (parseInt(e.ciConducted,          10) || 0),
        apps: acc.apps + (parseInt(e.newBusiness?.apps,    10) || 0),
      }),
      { appr: 0, ffi: 0, ci: 0, apps: 0 }
    );
    await runTheme(browser, 'dark', chipsAfterLight);

    // ── Phase 3.4 — aggregation regression via local aggregator import ────
    const finalDocs = await listWeekDocs(db, tenantId, uid, weekStarting);
    const todayDoc = finalDocs.find((d) => d.date === today);
    if (!todayDoc) {
      fail('aggregation-regression', 'today doc missing post-smoke');
    } else {
      // Verified storage-key sanity on the persisted doc.
      const expectedKeys = [
        'qualifiedApproaches', 'appointmentsSet', 'ffisScheduled', 'ffiConducted',
        'solutionPresentations', 'newCIBooked', 'oldCIBooked', 'ciConducted',
        'newNamesAdded', 'oldNamesWorked', 'serviceContacts',
      ];
      const missing = expectedKeys.filter((k) => !(k in todayDoc));
      const staleCased = ['ffisConducted', 'cisConducted', 'newCisBooked', 'oldCisBooked']
        .filter((k) => k in todayDoc);

      if (missing.length === 0 && staleCased.length === 0) {
        pass('today-doc-key-shape', `${expectedKeys.length} keys present; no stale-cased keys`);
      } else {
        fail('today-doc-key-shape', `missing=[${missing.join(',')}] stale=[${staleCased.join(',')}]`);
      }

      // Run the real aggregator over the persisted docs. Must emit the
      // weekly-shape fields with namesFromOther / oldNamesPool intact.
      const agg = aggregateDailyToWeekly(finalDocs, 35);
      const aggKeys = [
        'qualifiedApproaches', 'appointmentsSet', 'ffisScheduled', 'ffiConducted',
        'solutionPresentations', 'newCIBooked', 'oldCIBooked', 'ciConducted',
        'newBusiness', 'pppIncreases', 'lumpsums',
        'totalProductionCredit', 'totalCommission',
        'namesFromOther', 'oldNamesPool', 'serviceContacts',
      ];
      const missingAgg = aggKeys.filter((k) => !(k in agg));
      const namesOk = agg.namesFromOther > 0;     // seed wrote newNamesAdded=2
      const oldOk   = agg.oldNamesPool   > 0;     // seed wrote oldNamesWorked=1
      if (missingAgg.length === 0 && namesOk && oldOk) {
        pass(
          'aggregator-regression',
          `namesFromOther=${agg.namesFromOther} oldNamesPool=${agg.oldNamesPool} ffiConducted=${agg.ffiConducted} ciConducted=${agg.ciConducted}`
        );
      } else {
        fail(
          'aggregator-regression',
          `missing=[${missingAgg.join(',')}] namesFromOther=${agg.namesFromOther} oldNamesPool=${agg.oldNamesPool}`
        );
      }
    }
  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 240));
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────
    if (browser) await browser.close().catch(() => {});
    if (tenantId && uid) {
      const removed = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => null);
      if (removed != null) pass('post-clean-week', `deleted ${removed} doc(s)`);
    }
    try { await signOut(auth); } catch {}
    try { await deleteApp(fb); } catch {}
  }

  // ── Summary ─────────────────────────────────────────────────────────────
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

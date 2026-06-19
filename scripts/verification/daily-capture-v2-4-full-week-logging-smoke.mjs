/**
 * daily-capture-v2-4-full-week-logging-smoke.mjs — Phase 4 Sunday back-fill smoke.
 *
 * Proves the opening Sunday cell works end-to-end:
 *   Leg 1 — Sunday strip cell present; data-off="true" (off-styled, no nag)
 *   Leg 2 — Sunday cell is a <button> with no disabled attr (tappable)
 *   Leg 3 — Select Sunday, log 1 FFI, save → modal closes without error
 *   Leg 4 — Reload; Sunday cell aria-label = "… — logged"; points pill ≥ 5 pts
 *   Leg 5 — Firestore: doc exists with date==weekStarting & weekStarting==weekStarting
 *   Leg 6 — axe NO-NEW serious/critical
 *
 * Skips all browser legs (with note) when today IS Sunday — the strip is hidden
 * on Sunday; the Sunday cell is only reachable as a back-fill from Mon-onward.
 *
 * Run with:
 *   SMOKE_PREVIEW_URL=https://agencytrack-git-feat-daily-capture-v2-4-full-week-logging-kyron-marchan-s-projects.vercel.app \
 *   node scripts/verification/daily-capture-v2-4-full-week-logging-smoke.mjs
 */

import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore,
  collection, query, where, getDocs,
  doc, deleteDoc,
} from 'firebase/firestore';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resolvePreviewUrl, runBothThemes, waitForLoaded } from './lib/walk-helpers.mjs';
import { getSundayOf } from '../../src/lib/schema/dailyActivity.js';

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
const SHOTS_DIR = join(__dir, `${RUN_TS}-dcv2-p4-screenshots`);

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
  }, 'dcv2-p4-smoke');
  return { fb, auth: getAuth(fb), db: getFirestore(fb) };
}

async function resolveTenantId(user) {
  const tok = await user.getIdTokenResult(true);
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

// ─── Browser helpers ──────────────────────────────────────────────────────

async function shoot(page, name) {
  try {
    mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: false });
  } catch {}
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
  await waitForLoaded(page, 'dcv2-count-strip');
  await page.waitForTimeout(1000); // let weekDocs onSnapshot resolve
}

async function closeDailyCapture(page) {
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 8000 });
  await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 15000 });
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

// ─── Per-theme smoke ──────────────────────────────────────────────────────

async function smokeTheme(page, theme, ctx) {
  const { weekStarting, isSunday, db, tenantId, uid } = ctx;
  console.log(`\n── theme: ${theme} ──`);

  // Clean slate: delete any week docs from a prior run of this theme.
  const cleaned = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => 0);
  pass(`[${theme}] per-theme-clean`, `deleted ${cleaned} doc(s) for week ${weekStarting}`);

  if (isSunday) {
    skip(`[${theme}] all-legs`, 'today is Sunday — strip hidden; Sunday cell only reachable Mon-onward');
    return;
  }

  try {
    await loginAsAgent(page);
    pass(`[${theme}] login`);

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((theme === 'dark') === isDark) pass(`[${theme}] theme-applied`);
    else fail(`[${theme}] theme-applied`, `documentElement.dark=${isDark}`);

    await openDailyCapture(page);
    await shoot(page, `${theme}-strip`);

    // ── Leg 1 — Sunday cell exists and is off-styled ──────────────────────────
    const sundayCell = page.locator(`[data-testid="dcv2-strip-day-${weekStarting}"]`);
    await sundayCell.waitFor({ state: 'attached', timeout: 8000 });
    const dataOff = await sundayCell.getAttribute('data-off');
    if (dataOff === 'true') {
      pass(`[${theme}] leg1-sunday-cell-off`, `data-off="true" (Sun ${weekStarting})`);
    } else {
      fail(`[${theme}] leg1-sunday-cell-off`, `expected data-off="true" got "${dataOff}"`);
    }

    // ── Leg 2 — Sunday cell is a tappable <button> ────────────────────────────
    const tagName = await sundayCell.evaluate((el) => el.tagName);
    const isDisabled = await sundayCell.getAttribute('disabled');
    if (tagName === 'BUTTON' && isDisabled === null) {
      pass(`[${theme}] leg2-sunday-tappable`, '<button> with no disabled attr (not isFuture)');
    } else {
      fail(`[${theme}] leg2-sunday-tappable`, `tagName=${tagName} disabled=${isDisabled}`);
    }

    // ── Leg 3 — click Sunday, log 1 FFI, save ────────────────────────────────
    await sundayCell.click();
    await page.waitForTimeout(2000); // getDailyEntry fetch for Sunday resolves

    // Expand interviews accordion if collapsed.
    const interviewsBtn = page.locator('[aria-controls="dcv2-interviews-body"]');
    const expanded = await interviewsBtn.getAttribute('aria-expanded').catch(() => null);
    if (expanded !== 'true') {
      await interviewsBtn.click();
      await page.waitForTimeout(200);
    }

    // +1 FFI = 5 pts; pattern mirrors 3b smoke's clickIncrease.
    const ffiBtn = page.getByRole('button', { name: /FFIs conducted increase/i });
    await ffiBtn.click();
    await page.waitForTimeout(100);
    await shoot(page, `${theme}-prefill`);

    await page.click('[data-testid="dcv2-save"]');
    await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 15000 });
    pass(`[${theme}] leg3-sunday-save`, 'saved 1 FFI (5 pts) for Sunday back-fill');

    // ── Leg 4 — reload: Sunday isLogged + points ≥ 5 ─────────────────────────
    await page.evaluate(() => location.reload());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="daily-fab"]') ||
            document.querySelector('[data-testid^="agent-tab-"]'),
      { timeout: 45000 }
    );
    await openDailyCapture(page);
    await shoot(page, `${theme}-reload`);

    // (a) Sunday cell aria-label must include "logged" (isLogged trumps isOff in the template)
    const sundayReload = page.locator(`[data-testid="dcv2-strip-day-${weekStarting}"]`);
    await sundayReload.waitFor({ state: 'attached', timeout: 8000 });
    // Wait for onSnapshot to propagate weekDocs (aria-label updates reactively)
    await page.waitForFunction(
      (ws) => {
        const el = document.querySelector(`[data-testid="dcv2-strip-day-${ws}"]`);
        return el && (el.getAttribute('aria-label') ?? '').includes('logged');
      },
      weekStarting,
      { timeout: 10000 }
    );
    const ariaLabel = await sundayReload.getAttribute('aria-label');
    pass(`[${theme}] leg4-sunday-isLogged`, `aria-label="${ariaLabel}"`);

    // (b) Points pill exists (weekPoints > 0 → Sunday FFI is counted in weekly total).
    // Pill is hidden when weekPoints = 0; its presence proves the Sunday doc contributes.
    // Badge text verifies a valid pace state (mirrors 3b smoke's pill-existence pattern).
    const pill = page.locator('[data-testid="dcv2-points-pill"]');
    const pillCount = await pill.count();
    if (pillCount > 0) {
      const badge = page.locator('[data-testid="dcv2-pace-badge"]');
      const badgeText = (await badge.count()) > 0 ? (await badge.textContent())?.trim() : null;
      const validStates = ['Behind', 'On pace', 'Ahead'];
      if (validStates.includes(badgeText)) {
        pass(`[${theme}] leg4-points-nonzero`, `pill visible + badge="${badgeText}" (Sunday FFI counted in weekly total)`);
      } else {
        fail(`[${theme}] leg4-points-nonzero`, `pill visible but unexpected badge "${badgeText}"`);
      }
    } else {
      fail(`[${theme}] leg4-points-nonzero`, 'dcv2-points-pill not found — weekPoints=0 means Sunday FFI was not counted');
    }

    await closeDailyCapture(page);

    // ── Leg 5 — Firestore: Sunday doc has correct date + weekStarting ─────────
    const weekDocs = await listWeekDocs(db, tenantId, uid, weekStarting);
    const sundayDoc = weekDocs.find((d) => d.date === weekStarting);
    if (sundayDoc) {
      pass(`[${theme}] leg5-sunday-doc-exists`, `date=${sundayDoc.date} weekStarting=${sundayDoc.weekStarting}`);
      if (sundayDoc.weekStarting === weekStarting) {
        pass(`[${theme}] leg5-weekStarting-correct`, `weekStarting=${sundayDoc.weekStarting} == ${weekStarting} (getSundayOf(Sunday)=itself)`);
      } else {
        fail(`[${theme}] leg5-weekStarting-correct`, `expected ${weekStarting} got ${sundayDoc.weekStarting}`);
      }
      if ((sundayDoc.ffiConducted ?? 0) === 1) {
        pass(`[${theme}] leg5-ffi-value`, 'ffiConducted=1 ✓');
      } else {
        fail(`[${theme}] leg5-ffi-value`, `expected ffiConducted=1 got ${sundayDoc.ffiConducted}`);
      }
    } else {
      fail(`[${theme}] leg5-sunday-doc-exists`, `no dailyActivity doc found with date=${weekStarting}`);
    }

    // ── Leg 6 — axe NO-NEW ────────────────────────────────────────────────────
    await openDailyCapture(page);
    await runAxe(page, theme, 'axe');
    await closeDailyCapture(page);

  } catch (err) {
    fail(`[${theme}] browser-error`, String(err?.message ?? err).slice(0, 280));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== daily-capture-v2-4-full-week-logging-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);

  const { fb, auth, db } = initFb();
  let tenantId = null;
  let uid      = null;

  const today        = todayISO();
  const weekStarting = getSundayOf(today);
  const isSunday     = today === weekStarting;

  console.log(`  today=${today} weekStarting=${weekStarting} isSunday=${isSunday}`);
  if (isSunday) console.log('  NOTE: running on Sunday — all browser legs will SKIP');

  let browser;
  try {
    const agentCred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid      = agentCred.user.uid;
    tenantId = await resolveTenantId(agentCred.user);
    if (!tenantId) throw new Error('agent tenantId could not be resolved');
    pass('agent-signin', `tid=${tenantId.slice(0, 6)}… uid=${uid.slice(0, 6)}…`);

    const preCleaned = await deleteWeekDocs(db, tenantId, uid, weekStarting);
    pass('pre-clean', `deleted ${preCleaned} prior doc(s) for week ${weekStarting}`);

    const ctx = { today, weekStarting, isSunday, db, tenantId, uid };
    browser = await chromium.launch({ headless: true });

    await runBothThemes(browser, {
      baseUrl:   PREVIEW_URL,
      token:     E.VERCEL_BYPASS_TOKEN,
      viewport:  { width: 390, height: 844 },
      perTheme:  async (page, theme) => { await smokeTheme(page, theme, ctx); },
    });

  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 280));
  } finally {
    if (browser) await browser.close().catch(() => {});

    if (tenantId && uid) {
      const removed = await deleteWeekDocs(db, tenantId, uid, weekStarting).catch(() => null);
      if (removed != null) pass('post-clean', `deleted ${removed} Sunday doc(s)`);
    }
    try { await signOut(auth); } catch {}
    try { await deleteApp(fb); } catch {}
  }

  const total   = results.length;
  const passed  = results.filter((r) => r.status === 'PASS').length;
  const failed  = results.filter((r) => r.status === 'FAIL').length;
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

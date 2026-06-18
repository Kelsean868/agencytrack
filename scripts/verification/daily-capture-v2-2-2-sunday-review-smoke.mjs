/**
 * daily-capture-v2-2-2-sunday-review-smoke.mjs
 * Daily Capture v2 Phase 2.2 — Sunday review of the COMPLETED week, from a LIVE draft.
 *
 * Proves the full Option B chain end-to-end (the headline that #687 had to defer):
 *   BUILD  — log daily entries via the real app save path on a weekday of week W;
 *            on-save aggregation must build W's weekly DRAFT.
 *   MERGE  — pre-set a manual field on W's draft, log once more; the on-save
 *            recompute must PRESERVE the manual field (merge, not clobber).
 *   REVIEW — force the FOLLOWING Sunday; DCv2 must show W (the completed week),
 *            NON-EMPTY; "Review & submit" must open the wizard on W, PRE-FILLED.
 *
 * Clock is faked BACKWARD (real recent Sundays/weekdays) so Firebase Auth sees
 * the freshly-issued token as long-valid (a forward fake breaks login).
 *
 * Dates (computed from real now, all in the past):
 *   reviewSunday = most-recent Sunday ; W = reviewSunday − 7 ; buildDay = W + 3 (Wed)
 */

import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs,
} from 'firebase/firestore';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resolvePreviewUrl, setupBypassSession, setTheme, waitForLoaded } from './lib/walk-helpers.mjs';

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
const SHOTS_DIR = join(__dir, `${RUN_TS}-dcv2-p22-screenshots`);
// Pin the browser to Trinidad time so getMostRecentSunday() (browser-local, used
// by aggregateCurrentWeekDaily) agrees with getTodayTT()/getSundayOf() (TT) under
// the faked clock — i.e. replicate a real Trinidad agent. Without this the two
// diverge and on-save aggregation keys to a different week than the daily doc.
const CTX = { viewport: { width: 390, height: 844 }, timezoneId: 'America/Port_of_Spain' };

const results = [];
const pass = (s, n = '') => { results.push({ status: 'PASS' }); console.log(`  ✓ ${s}${n ? ` — ${n}` : ''}`); };
const fail = (s, n = '') => { results.push({ status: 'FAIL' }); console.log(`  ✗ ${s}${n ? ` — ${n}` : ''}`); };

// ─── Dates ──────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
const isoUTC = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function computeDates() {
  const s = new Date();
  s.setUTCDate(s.getUTCDate() - s.getUTCDay());     // most-recent Sunday (review day)
  const reviewSunday = isoUTC(s);
  const w = new Date(s); w.setUTCDate(w.getUTCDate() - 7);   // completed week W
  const W = isoUTC(w);
  const b = new Date(w); b.setUTCDate(b.getUTCDate() + 3);   // Wednesday of W
  const buildDay = isoUTC(b);
  return { reviewSunday, W, buildDay };
}

// ─── Firebase SDK ─────────────────────────────────────────────────────────────

function initFb() {
  const fb = initializeApp({
    apiKey: E.VITE_FIREBASE_API_KEY, authDomain: E.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: E.VITE_FIREBASE_PROJECT_ID, storageBucket: E.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: E.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: E.VITE_FIREBASE_APP_ID,
  }, 'dcv2-p22-smoke');
  return { fb, auth: getAuth(fb), db: getFirestore(fb) };
}
async function resolveTenantId(u) { return (await u.getIdTokenResult(true)).claims?.tenantId ?? null; }

async function deleteWeekDailyDocs(db, tid, uid, weekStarting) {
  const col = collection(db, `tenants/${tid}/users/${uid}/dailyActivity`);
  const snap = await getDocs(query(col, where('weekStarting', '==', weekStarting)));
  for (const d of snap.docs) await deleteDoc(doc(db, `tenants/${tid}/users/${uid}/dailyActivity/${d.id}`));
  return snap.size;
}
const draftRef = (db, tid, uid, ws) => doc(db, `tenants/${tid}/submissions/${uid}_${ws}`);
async function readDraft(db, tid, uid, ws) {
  // A `get` on a non-existent submission is DENIED by rules (resource is null →
  // canAccessOwn(resource.data.agentId) can't evaluate), so treat any error as
  // "no draft" rather than letting it throw.
  try {
    const snap = await getDoc(draftRef(db, tid, uid, ws));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}
/**
 * Reset the weekly draft to a clean, rule-valid baseline. submissions are
 * `allow delete: if false`, so the draft can't be deleted — overwrite it
 * (merge:false) to zero out activity + drop any stale manual fields between runs.
 */
async function resetDraft(db, tid, uid, ws, branchId) {
  await setDoc(draftRef(db, tid, uid, ws), {
    userId: uid, agentId: uid, agentName: 'A11y', branchId,
    weekStarting: ws, status: 'draft',
    prospectingLettersSent: 0, ffiConducted: 0, aggregatedFromDaily: false,
  }).catch(() => {});
}

// ─── In-page helpers ──────────────────────────────────────────────────────────

async function forceDate(context, iso) {
  const ms = new Date(`${iso}T12:00:00Z`).getTime();
  await context.addInitScript((m) => {
    const RealDate = Date;
    // Function (not class) override so a bare `Date()` call (valid JS — returns
    // a string, no `new`) doesn't throw "Class constructor cannot be invoked".
    function FakeDate(...args) {
      if (!(this instanceof FakeDate)) return new RealDate(m).toString();
      return args.length ? new RealDate(...args) : new RealDate(m);
    }
    FakeDate.prototype = RealDate.prototype;
    FakeDate.now = () => m;
    FakeDate.parse = RealDate.parse;
    FakeDate.UTC = RealDate.UTC;
    Date = FakeDate;
  }, ms);
}
async function login(page) {
  await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', E.A11Y_AGENT_EMAIL);
  await page.fill('input[type="password"]', E.A11Y_AGENT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="daily-fab"]') || document.querySelector('[data-testid^="agent-tab-"]'),
    { timeout: 45000 },
  );
}
async function openDaily(page) {
  await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 20000 });
  await page.click('[data-testid="daily-fab"]');
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { timeout: 15000 });
}
async function clickIncrease(page, label, times = 1) {
  const btn = page.getByRole('button', { name: new RegExp(`${label} increase`, 'i') });
  for (let i = 0; i < times; i++) { await btn.click(); await page.waitForTimeout(40); }
}
async function saveDaily(page) {
  await waitForLoaded(page, 'dcv2-count-strip').catch(() => {});
  await page.click('[data-testid="dcv2-save"]');
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 15000 });
}
async function shoot(page, name) {
  try { mkdirSync(SHOTS_DIR, { recursive: true }); await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`) }); } catch {}
}

// ─── Build + merge (one weekday context) ───────────────────────────────────────

async function buildAndMerge(browser, db, tid, uid, { buildDay, W }) {
  console.log(`\n── BUILD+MERGE (faked weekday ${buildDay}, week W=${W}) ──`);
  const ctx = await browser.newContext(CTX);
  try {
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await setTheme(ctx, 'light');
    await forceDate(ctx, buildDay);
    const page = await ctx.newPage();
    await login(page);

    // BUILD — log via the real save path.
    await openDaily(page);
    await clickIncrease(page, 'Prospecting letters sent', 3);
    await clickIncrease(page, 'FFIs conducted', 2);
    await shoot(page, 'build-filled');
    await saveDaily(page);

    const builtDraft = await readDraft(db, tid, uid, W);
    if (builtDraft && builtDraft.aggregatedFromDaily === true
        && Number(builtDraft.prospectingLettersSent) >= 3 && Number(builtDraft.ffiConducted) >= 2) {
      pass('draft-built-on-save', `letters=${builtDraft.prospectingLettersSent} ffi=${builtDraft.ffiConducted}`);
    } else {
      fail('draft-built-on-save', `draft=${JSON.stringify(builtDraft && {
        agg: builtDraft.aggregatedFromDaily, letters: builtDraft.prospectingLettersSent, ffi: builtDraft.ffiConducted })}`);
      return; // can't prove the rest without a built draft
    }

    // MERGE — pre-set a manual field, log once more, assert preservation.
    await setDoc(draftRef(db, tid, uid, W),
      { selfRating: 4, nextWeekTargets: { api: 50000 } }, { merge: true });

    await openDaily(page);
    await clickIncrease(page, 'FFIs conducted', 1);  // existing 2 → 3
    await saveDaily(page);

    const merged = await readDraft(db, tid, uid, W);
    const preserved = merged && merged.selfRating === 4 && merged.nextWeekTargets?.api === 50000;
    const recomputed = merged && Number(merged.ffiConducted) === 3;
    if (preserved && recomputed) {
      pass('on-save-recompute-preserves-manual', `selfRating=${merged.selfRating} ffi=${merged.ffiConducted}`);
    } else {
      fail('on-save-recompute-preserves-manual',
        `selfRating=${merged?.selfRating} targets=${JSON.stringify(merged?.nextWeekTargets)} ffi=${merged?.ffiConducted}`);
    }
  } catch (err) {
    fail('build-merge-error', String(err?.message ?? err).slice(0, 280));
  } finally {
    await ctx.close();
  }
}

// ─── Review (per theme, faked Sunday) ──────────────────────────────────────────

async function review(browser, theme, { reviewSunday, W }) {
  console.log(`\n── REVIEW theme=${theme} (faked Sunday ${reviewSunday}, completed week=${W}) ──`);
  const ctx = await browser.newContext(CTX);
  const errs = [];
  try {
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await setTheme(ctx, theme);
    await forceDate(ctx, reviewSunday);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(e.message));
    await login(page);

    const ttDate = await page.evaluate(
      () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date()));
    if (ttDate === reviewSunday) pass(`[${theme}] getTodayTT-is-sunday`, ttDate);
    else { fail(`[${theme}] getTodayTT-is-sunday`, `expected ${reviewSunday} got ${ttDate}`); return; }

    await openDaily(page);
    await page.waitForFunction(
      () => /your week from daily logs/i.test(document.body.textContent || ''), { timeout: 15000 }).catch(() => {});
    await shoot(page, `${theme}-sunday-review`);

    // NON-EMPTY completed-week summary: days logged "1/5" (one daily doc in W),
    // NOT "0/5" (the empty week-starting-today the pre-2.2 bug showed).
    const hasOne = await page.getByText('1/5').count();
    const hasZero = await page.getByText('0/5').count();
    if (hasOne > 0 && hasZero === 0) pass(`[${theme}] completed-week-non-empty`, 'days-logged 1/5');
    else fail(`[${theme}] completed-week-non-empty`, `"1/5"=${hasOne} "0/5"=${hasZero}`);

    // axe on the Sunday view.
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = (axe.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
    if (serious.length === 0) pass(`[${theme}] axe-no-serious-critical`);
    else fail(`[${theme}] axe-no-serious-critical`, serious.slice(0, 3).map((v) => `${v.id}(${v.nodes.length})`).join(', '));

    // Deep-link → wizard opens on W, pre-filled.
    await page.getByRole('button', { name: /review & submit/i }).first().click();
    await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 10000 }).catch(() => {});
    const wizard = await page.waitForSelector('[data-testid="wizard-v2-modal"]', { timeout: 15000 }).then(() => true).catch(() => false);
    if (wizard) pass(`[${theme}] deep-link-opens-wizard`);
    else { fail(`[${theme}] deep-link-opens-wizard`, 'wizard-v2-modal absent'); return; }

    const onStep = await page.locator('[data-testid="wizard-v2-step-counter"]').count();
    if (onStep > 0) pass(`[${theme}] wizard-on-step-screen`, 'initialWeek (W) honored');
    else fail(`[${theme}] wizard-on-step-screen`, 'step counter absent');

    // PRE-FILL: step 1 (Letters & outreach) shows the aggregated prospectingLettersSent=3.
    const lettersInput = page.getByLabel('Prospecting Letters Sent', { exact: false });
    await page.waitForFunction(
      () => {
        const el = [...document.querySelectorAll('input')].find(
          (i) => (i.id || '').toLowerCase().includes('prospectingletterssent'));
        return el && String(el.value) === '3';
      }, { timeout: 10000 }).then(() => true).catch(() => false);
    const lettersVal = await lettersInput.inputValue().catch(() => null);
    if (lettersVal === '3') pass(`[${theme}] wizard-prefilled`, `prospectingLettersSent=${lettersVal}`);
    else fail(`[${theme}] wizard-prefilled`, `expected 3 got ${lettersVal}`);
    await shoot(page, `${theme}-wizard-prefilled`);

    const filt = (xs) => xs.filter((t) => !/ResizeObserver|favicon|net::ERR|api\.fontshare\.com/.test(t));
    if (filt(errs).length === 0) pass(`[${theme}] no-js-errors`);
    else fail(`[${theme}] no-js-errors`, filt(errs).slice(0, 2).join(' | '));
  } catch (err) {
    fail(`[${theme}] review-error`, String(err?.message ?? err).slice(0, 280));
  } finally {
    await ctx.close();
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== daily-capture-v2-2-2-sunday-review-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);
  const { fb, auth, db } = initFb();
  const { reviewSunday, W, buildDay } = computeDates();
  let browser, tid, uid, claimBranchId = null;
  try {
    const cred = await signInWithEmailAndPassword(auth, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    uid = cred.user.uid;
    const tok = await cred.user.getIdTokenResult(true);
    tid = tok.claims?.tenantId ?? null;
    claimBranchId = tok.claims?.branchId ?? null;   // rule compares the write to THIS
    if (!tid) throw new Error('tenantId unresolved');
    pass('sdk-signin', `tid=${tid.slice(0, 6)}… uid=${uid.slice(0, 6)}… branch=${claimBranchId}`);
    console.log(`  reviewSunday=${reviewSunday}  W=${W}  buildDay=${buildDay}`);

    // Pre-clean week W for a deterministic build: delete daily docs, and RESET
    // the draft to a zeroed baseline (submissions can't be deleted by rule).
    const delDocs = await deleteWeekDailyDocs(db, tid, uid, W);
    await resetDraft(db, tid, uid, W, claimBranchId);
    pass('pre-clean', `deleted ${delDocs} daily doc(s) + reset draft for ${W}`);

    browser = await chromium.launch({ headless: true });
    await buildAndMerge(browser, db, tid, uid, { buildDay, W });
    for (const theme of ['light', 'dark']) await review(browser, theme, { reviewSunday, W });
  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 280));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (tid && uid) {
      await deleteWeekDailyDocs(db, tid, uid, W).catch(() => {});
      await resetDraft(db, tid, uid, W, claimBranchId);
      console.log('  post-clean done');
    }
    try { await signOut(auth); } catch {}
    try { await deleteApp(fb); } catch {}
  }
  const total = results.length, passed = results.filter((r) => r.status === 'PASS').length, failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n=== RESULT: ${passed}/${total} passed, ${failed} failed — ${failed === 0 ? 'OK ✓' : 'FAILED ✗'} ===`);
  console.log(`Screenshots: ${SHOTS_DIR}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error('Fatal:', err?.stack ?? err); process.exit(1); });

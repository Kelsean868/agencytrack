/**
 * Weekly Planner v2 — Slice 3a smoke (agent surface, both themes).
 *
 * S3a turns the committed-plan view's value rows into PACE ROWS: floor tick +
 * plan cap + variance-coloured actual fill + a live pace marker. Actuals are
 * READ (no new write path) — mid-week from Daily Capture, final from the weekly
 * submission. This walk proves the user-visible behaviour on a real Vercel
 * preview through real Firebase rules: commit a plan (S2) → see mid-week pace
 * rows (calls hatched) → enter Daily Capture values through the real UI → return
 * → assert the actual fills + "mid-week · daily capture" chip + pace marker +
 * variance states reflect what was entered.
 *
 * E3 standard, both themes. SOURCE-AWARE (brief D3): the committed pace rows read
 * from a submitted weekly report when one exists for the week (source "final ·
 * submitted" — calls resolves to the 5-component sum, no live pace marker),
 * otherwise from the Daily Capture aggregate (source "mid-week · daily capture" —
 * calls hatched, live pace marker). The walk detects which arm the account is in
 * and asserts the matching behaviour; the Daily Capture write+own-delete path is
 * exercised either way.
 *   COMMIT     Plan this week → Commit (S2 path) so the committed view renders.
 *   PACE ROWS  five rows render; source chip valid; FINAL → calls resolved + no
 *              live readout · DAILY → calls hatched + "Day N of 6" readout.
 *   DAILY      open Daily Capture (real modal), enter qualifiedApproaches /
 *              ffiConducted / ciConducted / new-business apps, save (write path).
 *   RESOLVE    back on Game Plan, actuals are present; DAILY → reflect the entered
 *              values · FINAL → come from the submission (calls resolved).
 *   A11Y       axe NO-NEW serious/critical on the hub; 0 console errors.
 *   CLEANUP    delete the plan doc AND the daily entry as the AGENT (own-delete
 *              path through real rules), then getDoc-confirm both are gone.
 *
 *   node scripts/verification/weekly-plan-v2-slice-3a-smoke.mjs --url=<preview>
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('='); if (eq < 1) return;
      const k = line.slice(0, eq).trim(); const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v]; }));
const URL          = args.url ?? 'https://agencytrack.vercel.app';
const IS_PROD      = URL.startsWith('https://');
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const SHOT_DIR     = 'verification/weekly-plan-s3a';

// Daily values entered through the UI — kept small + distinct so the resolve
// step can assert each row independently.
const DAILY = { qa: 20, ffi: 6, ci: 5, apps: 2 };

if (!AGENT_EMAIL || !AGENT_PASS) { console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD'); process.exit(1); }
if (IS_PROD && !BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN for prod URL'); process.exit(1); }
try { mkdirSync(SHOT_DIR, { recursive: true }); } catch { /* ignore */ }

// Most recent Sunday (YYYY-MM-DD), mirroring validators.getRecentSundays(1)[0].
function mostRecentSunday() {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Today (YYYY-MM-DD, local) — the dailyActivity doc id.
function todayId() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const errors = [];

async function login(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    if (t === 'dark') { document.documentElement.classList.add('dark'); localStorage.setItem('agencytrack-dark', 'true'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('agencytrack-dark', 'false'); }
  }, theme);
  await page.waitForTimeout(400);
}

async function gotoGamePlan(page) {
  await page.click('[data-testid="agent-tab-game-plan"]');
  await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 15_000 });
  await page.waitForSelector('[data-testid="suggested-week-card"]', { timeout: 15_000 });
  await page.waitForTimeout(800);
}

const has = (page, id) => page.evaluate((i) => Boolean(document.querySelector(`[data-testid="${i}"]`)), id);
const valOf = (page, id) => page.evaluate((i) => { const el = document.querySelector(`[data-testid="${i}"]`); return el ? el.textContent.trim() : null; }, id);
const textOf = (page, id) => page.evaluate((i) => { const el = document.querySelector(`[data-testid="${i}"]`); return el ? (el.textContent || '') : ''; }, id);
const shot = (page, name) => page.screenshot({ path: `${SHOT_DIR}/${name}.png` }).catch(() => {});

// Ensure a committed plan exists (commit via the S2 path if not already committed).
async function ensureCommitted(page) {
  if (await has(page, 'weekly-plan-committed')) return;
  await page.click('[data-testid="plan-this-week"]');
  await page.waitForSelector('[data-testid="weekly-plan-edit"]', { timeout: 8_000 });
  await page.click('[data-testid="weekly-plan-commit"]');
  await page.waitForSelector('[data-testid="weekly-plan-committed"]', { timeout: 15_000 });
}

async function fillDaily(page, label, value) {
  const sel = `input[aria-label="${label}"]`;
  await page.waitForSelector(sel, { timeout: 8_000 });
  await page.fill(sel, String(value));
  await page.waitForTimeout(120);
}

async function run() {
  console.log(`\nWeekly Planner v2 — Slice 3a smoke\nTarget: ${URL}\n`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('fontshare.com')) return;
    if (t.includes('Failed to load resource') && t.includes('net::ERR_FAILED')) return;
    errors.push(t);
  });

  const r = {};
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page);

    // ── Phase A: commit a plan, observe the pace rows (source-aware, both themes) ─
    await gotoGamePlan(page);
    await ensureCommitted(page);

    r.paceRows = await has(page, 'weekly-plan-pace-rows');
    const chip0 = await textOf(page, 'weekly-plan-source-chip');
    const source = /final · submitted/i.test(chip0) ? 'final'
      : /mid-week · daily capture/i.test(chip0) ? 'daily' : 'unknown';
    r.source = source;
    r.sourceChipValid = source !== 'unknown';
    if (source === 'daily') {
      // mid-week: calls is the hatched no-daily-source state + a live pace readout.
      r.callsHatched = await has(page, 'pace-nodaily-callsMade');
      r.paceReadout = /Day \d of 6/i.test(await textOf(page, 'weekly-plan-pace-readout'));
    } else {
      // final: the submission drives actuals — calls RESOLVES (5-sum), no live marker.
      r.callsResolved = await has(page, 'pace-actual-callsMade');
      r.noLiveReadout = !(await has(page, 'weekly-plan-pace-readout'));
    }
    await shot(page, `pacerows-${source}-light`);
    await setTheme(page, 'dark');
    await shot(page, `pacerows-${source}-dark`);
    await setTheme(page, 'light');

    // ── Phase B: enter Daily Capture values through the real UI ─────────────────
    await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 15_000 });
    await page.click('[data-testid="daily-fab"]');
    await page.waitForSelector('[data-testid="daily-capture-v2"]', { timeout: 15_000 });
    await fillDaily(page, 'Qualified approaches', DAILY.qa);
    await fillDaily(page, 'FFIs conducted', DAILY.ffi);
    await fillDaily(page, 'CIs conducted', DAILY.ci);
    await fillDaily(page, 'New business — apps', DAILY.apps);
    await page.click('[data-testid="dcv2-save"]');
    await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 15_000 });
    r.dailySaved = true;

    // ── Phase C: return to Game Plan, assert the actuals resolve (source-aware) ──
    await page.reload({ waitUntil: 'domcontentloaded' });
    await login(page).catch(() => {});
    await gotoGamePlan(page);

    r.contactsActual = parseInt(await valOf(page, 'pace-actual-contactsMade'), 10);
    r.ffiActual = parseInt(await valOf(page, 'pace-actual-factFindsCompleted'), 10);
    r.ciActual = parseInt(await valOf(page, 'pace-actual-closingInterviewsKept'), 10);
    r.appsActual = parseInt(await valOf(page, 'pace-actual-applicationsSubmitted'), 10);
    r.variancePresent = await has(page, 'pace-variance-applicationsSubmitted');
    await shot(page, `resolved-${source}-light`);
    await setTheme(page, 'dark');
    await shot(page, `resolved-${source}-dark`);
    await setTheme(page, 'light');

    if (source === 'daily') {
      // daily aggregate ≥ the values we just entered (pre-existing days may add more).
      r.callsStillHatched = await has(page, 'pace-nodaily-callsMade');
      r.actualsResolved =
        r.contactsActual >= DAILY.qa && r.ffiActual >= DAILY.ffi &&
        r.ciActual >= DAILY.ci && r.appsActual >= DAILY.apps;
    } else {
      // final: actuals come from the submission — calls resolves to the 5-sum, the
      // four daily-sourced rows show finite values from the submitted report.
      r.callsActual = parseInt(await valOf(page, 'pace-actual-callsMade'), 10);
      r.actualsResolved =
        Number.isFinite(r.callsActual) && Number.isFinite(r.contactsActual) &&
        Number.isFinite(r.ffiActual) && Number.isFinite(r.ciActual) && Number.isFinite(r.appsActual);
    }

    // ── axe NO-NEW serious/critical on the hub ──────────────────────────────────
    try {
      const res = await new AxeBuilder({ page }).include('[data-testid="game-plan-hub"]').withTags(['wcag2a', 'wcag2aa']).analyze();
      r.axeSC = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
    } catch (e) { r.axeSC = [{ id: 'axe-error', target: String(e).slice(0, 120) }]; }
  } catch (e) {
    r.fatal = String(e).slice(0, 300);
  } finally {
    await browser.close();
  }

  // ── Phase D: cleanup — delete the plan doc AND the daily entry as the AGENT ───
  const cleanup = { planDeleted: false, planGone: false, dailyDeleted: false, dailyGone: false };
  try {
    const cfg = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };
    const app = initializeApp(cfg, `wp3a-cleanup-${Date.now() % 100000}`);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const cred = await signInWithEmailAndPassword(auth, AGENT_EMAIL, AGENT_PASS);
    const uid = cred.user.uid;
    const tenantId = (await cred.user.getIdTokenResult()).claims.tenantId;

    const planRef = doc(db, `tenants/${tenantId}/weeklyPlans/${uid}_${mostRecentSunday()}`);
    await deleteDoc(planRef);
    cleanup.planDeleted = true;
    cleanup.planGone = !(await getDoc(planRef)).exists();

    const dailyRef = doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${todayId()}`);
    await deleteDoc(dailyRef);
    cleanup.dailyDeleted = true;
    cleanup.dailyGone = !(await getDoc(dailyRef)).exists();
  } catch (e) {
    cleanup.error = String(e).slice(0, 200);
  }
  r.cleanup = cleanup;

  // Source-specific gate: daily → hatched calls + pace readout; final → calls resolved + no live readout.
  const sourceGate = r.source === 'daily'
    ? (r.callsHatched && r.paceReadout && r.callsStillHatched)
    : (r.source === 'final' && r.callsResolved && r.noLiveReadout);

  const pass = (
    r.paceRows && r.sourceChipValid && sourceGate &&
    r.dailySaved && r.variancePresent && r.actualsResolved &&
    Array.isArray(r.axeSC) && r.axeSC.length === 0 && errors.length === 0 &&
    cleanup.planDeleted && cleanup.planGone && cleanup.dailyDeleted && cleanup.dailyGone && !r.fatal
  );

  console.log(`  source=${r.source} paceRows=${r.paceRows} sourceChipValid=${r.sourceChipValid} sourceGate=${sourceGate}`);
  if (r.source === 'daily') console.log(`    callsHatched=${r.callsHatched} paceReadout=${r.paceReadout} callsStillHatched=${r.callsStillHatched}`);
  else console.log(`    callsResolved=${r.callsResolved} noLiveReadout=${r.noLiveReadout} callsActual=${r.callsActual}`);
  console.log(`  dailySaved=${r.dailySaved} variancePresent=${r.variancePresent} actualsResolved=${r.actualsResolved}`);
  console.log(`  actuals contacts=${r.contactsActual} ffi=${r.ffiActual} ci=${r.ciActual} apps=${r.appsActual} (entered ${JSON.stringify(DAILY)})`);
  console.log(`  axe-sc=${Array.isArray(r.axeSC) ? r.axeSC.length : 'n/a'} consoleErrors=${errors.length} cleanup=${JSON.stringify(cleanup)}`);
  if (Array.isArray(r.axeSC)) r.axeSC.slice(0, 4).forEach((n) => console.log(`    axe ${n.id}: ${n.target}`));
  if (errors.length) errors.slice(0, 4).forEach((e) => console.log(`    console.error: ${e}`));
  if (r.fatal) console.log(`  FATAL: ${r.fatal}`);
  console.log(`\nWeekly Planner v2 Slice 3a smoke: ${pass ? '✓ PASS' : '✗ FAIL'}`);
  process.exit(pass ? 0 : 1);
}

run();

/**
 * Weekly Planner v2 — Slice 3b smoke (Standard drawer, both themes).
 *
 * S3b evolves the Standard Pulse-chip drawer to 3 honest states.
 * This smoke verifies:
 *   NO-RELOAD COMMIT PATH (A fix): after committing via Game Plan, navigate to
 *     Home WITHOUT any page.reload() and assert the drawer shows the plan state.
 *   NO-RELOAD DELETE PATH (A fix): click "Clear" in Game Plan → navigate to Home
 *     WITHOUT any page.reload() → drawer reverts to the no-plan floor+nudge state.
 *   D1 CALLS 5-SUM: the calls row actual matches the 5-component submission sum.
 *   AXE (B widened): both new drawer states (plan rows + chip; nudge button).
 *   CLEANUP: daily entry only (plan cleared in the browser walk).
 *
 *   node scripts/verification/weekly-plan-v2-slice-3b-smoke.mjs --url=<preview>
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, query, collection, where, deleteDoc } from 'firebase/firestore';
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
const SHOT_DIR     = 'verification/weekly-plan-s3b';

if (!AGENT_EMAIL || !AGENT_PASS) { console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD'); process.exit(1); }
if (IS_PROD && !BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN for prod URL'); process.exit(1); }
try { mkdirSync(SHOT_DIR, { recursive: true }); } catch { /* ignore */ }

function todayId() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function mostRecentSunday() {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay());
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

const has = (page, id) => page.evaluate((i) => Boolean(document.querySelector(`[data-testid="${i}"]`)), id);
const valOf = (page, id) => page.evaluate((i) => { const el = document.querySelector(`[data-testid="${i}"]`); return el ? el.textContent.trim() : null; }, id);
const textOf = (page, id) => page.evaluate((i) => { const el = document.querySelector(`[data-testid="${i}"]`); return el ? (el.textContent || '') : ''; }, id);
const shot = (page, name) => page.screenshot({ path: `${SHOT_DIR}/${name}.png` }).catch(() => {});

async function gotoHome(page) {
  await page.click('[data-testid="agent-tab-dashboard"]');
  await page.waitForTimeout(800);
}

/** Navigate to Game Plan, commit a plan (or confirm one exists), and return. */
async function commitPlanViaGamePlan(page) {
  await page.click('[data-testid="agent-tab-game-plan"]');
  await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 15_000 });
  await page.waitForSelector('[data-testid="suggested-week-card"]', { timeout: 15_000 });
  await page.waitForTimeout(800);
  if (await has(page, 'weekly-plan-committed')) return; // already committed this session
  const planBtn = page.getByTestId('plan-this-week');
  if (await planBtn.count()) {
    await planBtn.click();
    await page.waitForSelector('[data-testid="weekly-plan-edit"]', { timeout: 8_000 });
  } else {
    await page.click('[data-testid="weekly-plan-edit-btn"]');
    await page.waitForSelector('[data-testid="weekly-plan-edit"]', { timeout: 8_000 });
  }
  await page.click('[data-testid="weekly-plan-commit"]');
  await page.waitForSelector('[data-testid="weekly-plan-committed"]', { timeout: 15_000 });
}

/** Open the Standard Pulse chip drawer (assumes we are on the Home tab). */
async function openStandardDrawer(page) {
  await page.waitForSelector('[data-testid="pulse-chip-standard"]', { timeout: 15_000 });
  await page.click('[data-testid="pulse-chip-standard"]');
  await page.waitForSelector('[data-testid="standard-drawer-rows"]', { timeout: 10_000 });
  await page.waitForTimeout(600);
}

async function run() {
  console.log(`\nWeekly Planner v2 — Slice 3b smoke\nTarget: ${URL}\n`);
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

    // ── Phase A: commit plan → navigate to Home WITHOUT reload → assert plan state ─
    // Tests the onPlanChanged staleness fix: the Standard drawer must reflect the
    // committed plan immediately, without a page.reload(), because onPlanChanged()
    // triggers AgentDashboard to re-fetch committedPlan after the Game Plan commit.
    await commitPlanViaGamePlan(page);
    await gotoHome(page); // NO page.reload() — pure navigation
    await openStandardDrawer(page);

    r.drawerOpen = await has(page, 'standard-drawer-rows');
    const chipText = await textOf(page, 'standard-drawer-source-chip');
    const source = /final · submitted/i.test(chipText) ? 'final'
      : /mid-week · daily capture/i.test(chipText) ? 'daily' : 'unknown';
    r.source = source;
    r.sourceChipValid = source !== 'unknown';
    r.planRowsPresent = await has(page, 'drawer-plan-row-callsMade');

    if (source === 'final') {
      r.callsResolved = await has(page, 'drawer-actual-callsMade');
      r.callsActual = parseInt(await valOf(page, 'drawer-actual-callsMade'), 10);
    } else {
      r.callsHatched = await has(page, 'drawer-nodaily-callsMade');
    }

    await shot(page, `plan-state-${source}-light`);
    await setTheme(page, 'dark');
    await shot(page, `plan-state-${source}-dark`);
    await setTheme(page, 'light');

    // ── Phase B: axe on new S3b elements in plan-state ─────────────────────────
    // Includes source chip + plan-metric rows (the new PlanMetricRow elements).
    // StandardRow "Close" amber chips (pre-existing on main, unchanged) are
    // excluded by targeting only the new testids — not the full dialog.
    try {
      const res = await new AxeBuilder({ page })
        .include('[data-testid="standard-drawer-source-chip"]')
        .include('[data-testid="drawer-plan-row-callsMade"]')
        .include('[data-testid="drawer-plan-row-contactsMade"]')
        .include('[data-testid="drawer-plan-row-factFindsCompleted"]')
        .include('[data-testid="drawer-plan-row-closingInterviewsKept"]')
        .include('[data-testid="drawer-plan-row-applicationsSubmitted"]')
        .withTags(['wcag2a', 'wcag2aa']).analyze();
      r.axePlanState = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
    } catch (e) { r.axePlanState = [{ id: 'axe-error', target: String(e).slice(0, 120) }]; }

    // Close the drawer.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // ── Phase C: clear plan via the UI → navigate to Home WITHOUT reload → assert nudge ─
    // Tests onPlanChanged for deletes AND proves the no-plan state reverts in-session.
    await page.click('[data-testid="agent-tab-game-plan"]');
    await page.waitForSelector('[data-testid="weekly-plan-clear"]', { timeout: 12_000 });
    await page.click('[data-testid="weekly-plan-clear"]');
    // Wait for the committed view to disappear (plan cleared in GamePlanV2 local state).
    await page.waitForFunction(() => !document.querySelector('[data-testid="weekly-plan-committed"]'), { timeout: 10_000 });
    await gotoHome(page); // NO page.reload() — pure navigation
    await openStandardDrawer(page);

    r.noPlanDrawer = !(await has(page, 'standard-drawer-source-chip')); // no chip in no-plan state
    r.nudgeVisible = await has(page, 'standard-drawer-game-plan-nudge');

    await shot(page, 'no-plan-state-light');
    await setTheme(page, 'dark');
    await shot(page, 'no-plan-state-dark');
    await setTheme(page, 'light');

    // ── Phase B2: axe on new S3b elements in no-plan state ─────────────────────
    // Includes the "Commit a plan" nudge button.
    try {
      const res = await new AxeBuilder({ page })
        .include('[data-testid="standard-drawer-game-plan-nudge"]')
        .withTags(['wcag2a', 'wcag2aa']).analyze();
      r.axeNoPlanState = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
    } catch (e) { r.axeNoPlanState = [{ id: 'axe-error', target: String(e).slice(0, 120) }]; }

    // Verify nudge navigates to Game Plan (tap it, confirm tab switches).
    await page.click('[data-testid="standard-drawer-game-plan-nudge"]');
    await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 10_000 });
    r.nudgeNavWorks = true;
    await page.waitForTimeout(400);
  } catch (e) {
    r.fatal = String(e).slice(0, 300);
  } finally {
    await browser.close();
  }

  // ── Phase D: SDK cleanup — daily doc only (plan cleared in browser walk) ─────
  const cleanup = { planAlreadyCleared: true, dailyDeleted: false, dailyGone: false };
  let expectedCallsSum;
  try {
    const cfg = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };
    const app = initializeApp(cfg, `wp3b-cleanup-${Date.now() % 100000}`);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const cred = await signInWithEmailAndPassword(auth, AGENT_EMAIL, AGENT_PASS);
    const uid = cred.user.uid;
    const tenantId = (await cred.user.getIdTokenResult()).claims.tenantId;
    const week = mostRecentSunday();

    // D1 verify: fetch current-week submission to compute expected 5-sum.
    const snap = await getDocs(query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('agentId', '==', uid),
      where('weekStarting', '==', week),
    ));
    if (!snap.empty) {
      const d = snap.docs[0].data();
      expectedCallsSum = (d.referralCalls||0) + (d.followUpCalls||0) + (d.coldCalls||0) + (d.seminarTradeshowCalls||0) + (d.serviceCalls||0);
    }
    if (r.callsActual !== undefined && expectedCallsSum !== undefined) {
      r.callsSumCorrect = r.callsActual === expectedCallsSum;
    }

    // Confirm plan is gone (cleared via UI "Clear" button in Phase C).
    const planRef = doc(db, `tenants/${tenantId}/weeklyPlans/${uid}_${week}`);
    cleanup.planGone = !(await getDoc(planRef)).exists();

    // Delete any daily doc the walk created.
    const dailyRef = doc(db, `tenants/${tenantId}/users/${uid}/dailyActivity/${todayId()}`);
    await deleteDoc(dailyRef).catch(() => {});
    cleanup.dailyDeleted = true;
    cleanup.dailyGone = !(await getDoc(dailyRef)).exists();
  } catch (e) {
    cleanup.error = String(e).slice(0, 200);
  }

  const axeSC = (r.axePlanState ?? []).concat(r.axeNoPlanState ?? []);
  const sourceGate = r.source === 'daily'
    ? r.callsHatched
    : (r.source === 'final' && r.callsResolved);

  const pass = (
    r.drawerOpen && r.sourceChipValid && sourceGate &&
    r.planRowsPresent &&
    (r.callsSumCorrect !== false) &&
    r.noPlanDrawer && r.nudgeVisible && r.nudgeNavWorks &&
    axeSC.length === 0 && errors.length === 0 &&
    (cleanup.planGone !== false) && !r.fatal
  );

  console.log(`  source=${r.source} drawerOpen=${r.drawerOpen} sourceChipValid=${r.sourceChipValid} sourceGate=${sourceGate}`);
  console.log(`  planRowsPresent=${r.planRowsPresent}`);
  if (r.source === 'final') console.log(`    callsResolved=${r.callsResolved} callsActual=${r.callsActual} expectedCallsSum=${expectedCallsSum} callsSumCorrect=${r.callsSumCorrect}`);
  else console.log(`    callsHatched=${r.callsHatched}`);
  console.log(`  noPlanDrawer=${r.noPlanDrawer} nudgeVisible=${r.nudgeVisible} nudgeNavWorks=${r.nudgeNavWorks}`);
  console.log(`  axe-plan-state=${r.axePlanState?.length ?? 'n/a'} axe-no-plan-state=${r.axeNoPlanState?.length ?? 'n/a'} consoleErrors=${errors.length}`);
  console.log(`  cleanup=${JSON.stringify(cleanup)}`);
  if (axeSC.length) axeSC.slice(0, 4).forEach((n) => console.log(`    axe ${n.id}: ${n.target}`));
  if (errors.length) errors.slice(0, 4).forEach((e) => console.log(`    console.error: ${e}`));
  if (r.fatal) console.log(`  FATAL: ${r.fatal}`);
  console.log(`\nWeekly Planner v2 Slice 3b smoke: ${pass ? '✓ PASS' : '✗ FAIL'}`);
  process.exit(pass ? 0 : 1);
}

run();

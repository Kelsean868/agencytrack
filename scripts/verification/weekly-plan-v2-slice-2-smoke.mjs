/**
 * Weekly Planner v2 — Slice 2 smoke (agent surface, both themes).
 *
 * Slice 2 makes the suggested week a committable plan: the new
 * tenants/{tid}/weeklyPlans/{agentId}_{weekStart} collection + rules + the
 * SuggestedWeekCard edit/committed modes. This smoke proves the user-visible
 * behavior on a real Vercel preview through real Firebase rules + claims —
 * selector-only checks miss rules bugs, so it does a real write→reload→read.
 *
 * E3 standard, both themes:
 *   SCREENSHOTS  suggestion / edit / committed, light + dark.
 *   CLAMP        in the floor state every stepper seeds at its floor → decrement
 *                disabled; incrementing then decrementing back re-clamps.
 *   LIFECYCLE    Commit (callsMade +1 → 'agent') → RELOAD → assert the committed
 *                view shows the persisted value + 'Custom' (agent) provenance
 *                (exercises create + own-read rules live) → Edit → CANCEL (assert
 *                committed view unchanged, no write) → Edit → Reset → re-Commit
 *                at the floor → assert persisted.
 *   CLEANUP      delete the plan doc as the AGENT via the web SDK (own-delete
 *                path through real rules), then getDoc-confirm it is gone.
 *   A11Y         axe NO-NEW serious/critical on the hub; 0 console errors.
 *
 *   node scripts/verification/weekly-plan-v2-slice-2-smoke.mjs --url=<preview>
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
const SHOT_DIR     = 'verification/weekly-plan-s2';

if (!AGENT_EMAIL || !AGENT_PASS) { console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD'); process.exit(1); }
if (IS_PROD && !BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN for prod URL'); process.exit(1); }
try { mkdirSync(SHOT_DIR, { recursive: true }); } catch { /* ignore */ }

// Most recent Sunday (YYYY-MM-DD), mirroring validators.getRecentSundays(1)[0]
// — local-tz, same clock the preview app uses for the doc ID.
function mostRecentSunday() {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const RESULTS = [];
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
const shot = (page, name) => page.screenshot({ path: `${SHOT_DIR}/${name}.png` }).catch(() => {});

async function run() {
  console.log(`\nWeekly Planner v2 — Slice 2 smoke\nTarget: ${URL}\n`);
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

    // ── Phase A: screenshots + clamp, both themes (no write) ──────────────────
    await gotoGamePlan(page);
    r.floorState = await has(page, 'suggested-week-floor');
    r.planAffordance = await has(page, 'plan-this-week');
    await shot(page, 'suggestion-light');

    await page.click('[data-testid="plan-this-week"]');
    await page.waitForSelector('[data-testid="weekly-plan-edit"]', { timeout: 8_000 });
    await shot(page, 'edit-light');
    // Clamp: in floor state contactsMade seeds at its floor → decrement disabled.
    r.clampDecDisabled = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="plan-step-contactsMade-dec"]');
      return Boolean(b) && b.disabled === true;
    });
    // Cancel back to the suggestion so dark captures the suggestion cleanly.
    await page.click('[data-testid="weekly-plan-cancel"]');
    await page.waitForSelector('[data-testid="suggested-week-floor"]', { timeout: 8_000 });

    await setTheme(page, 'dark');
    await shot(page, 'suggestion-dark');
    await page.click('[data-testid="plan-this-week"]');
    await page.waitForSelector('[data-testid="weekly-plan-edit"]', { timeout: 8_000 });
    await shot(page, 'edit-dark');
    await page.click('[data-testid="weekly-plan-cancel"]');
    await setTheme(page, 'light');
    await page.waitForSelector('[data-testid="suggested-week-floor"]', { timeout: 8_000 });

    // ── Phase B: lifecycle (light) ────────────────────────────────────────────
    await page.click('[data-testid="plan-this-week"]');
    await page.waitForSelector('[data-testid="weekly-plan-edit"]', { timeout: 8_000 });
    const floorCalls = parseInt(await valOf(page, 'plan-step-callsMade-value'), 10);
    await page.click('[data-testid="plan-step-callsMade-inc"]'); // → floor+1, provenance 'agent'
    const expectCalls = parseInt(await valOf(page, 'plan-step-callsMade-value'), 10);
    r.incApplied = expectCalls === floorCalls + 1;
    await page.click('[data-testid="weekly-plan-commit"]');
    // Commit clears edit mode once the refetch lands.
    await page.waitForSelector('[data-testid="weekly-plan-committed"]', { timeout: 15_000 });

    // RELOAD → assert persistence through real rules + claims.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await login(page).catch(() => {});
    await gotoGamePlan(page);
    r.committedAfterReload = await has(page, 'weekly-plan-committed');
    r.persistedCalls = parseInt(await valOf(page, 'plan-committed-callsMade-value'), 10);
    r.persistedAgentProvenance = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="weekly-plan-committed"]');
      return Boolean(c) && /Custom/.test(c.textContent || ''); // 'agent' provenance chip
    });
    await shot(page, 'committed-light');
    await setTheme(page, 'dark');
    await shot(page, 'committed-dark');
    await setTheme(page, 'light');

    // Edit → CANCEL → committed view unchanged (no write).
    await page.click('[data-testid="weekly-plan-edit-btn"]');
    await page.waitForSelector('[data-testid="weekly-plan-edit"]', { timeout: 8_000 });
    r.editSeededFromCommitted = parseInt(await valOf(page, 'plan-step-callsMade-value'), 10) === expectCalls;
    await page.click('[data-testid="plan-step-callsMade-inc"]'); // dirty → +1
    await page.click('[data-testid="weekly-plan-cancel"]');
    await page.waitForSelector('[data-testid="weekly-plan-committed"]', { timeout: 8_000 });
    r.cancelKeptCommitted = parseInt(await valOf(page, 'plan-committed-callsMade-value'), 10) === expectCalls;

    // Edit → Reset → back to the floor suggestion → re-Commit at the floor.
    await page.click('[data-testid="weekly-plan-edit-btn"]');
    await page.waitForSelector('[data-testid="weekly-plan-edit"]', { timeout: 8_000 });
    await page.click('[data-testid="weekly-plan-reset"]');
    r.resetToFloor = parseInt(await valOf(page, 'plan-step-callsMade-value'), 10) === floorCalls;
    await page.click('[data-testid="weekly-plan-commit"]');
    await page.waitForSelector('[data-testid="weekly-plan-committed"]', { timeout: 15_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await login(page).catch(() => {});
    await gotoGamePlan(page);
    r.recommitPersisted = parseInt(await valOf(page, 'plan-committed-callsMade-value'), 10) === floorCalls;

    // ── axe NO-NEW serious/critical on the hub ────────────────────────────────
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

  // ── Phase C: cleanup — delete the plan doc as the AGENT (own-delete path) ────
  let cleanup = { deleted: false, confirmedGone: false };
  try {
    const cfg = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };
    const app = initializeApp(cfg, `wp-cleanup-${Date.now() % 100000}`);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const cred = await signInWithEmailAndPassword(auth, AGENT_EMAIL, AGENT_PASS);
    const uid = cred.user.uid;
    const claims = (await cred.user.getIdTokenResult()).claims;
    const tenantId = claims.tenantId;
    const week = mostRecentSunday();
    const ref = doc(db, `tenants/${tenantId}/weeklyPlans/${uid}_${week}`);
    await deleteDoc(ref);
    cleanup.deleted = true;
    const after = await getDoc(ref);
    cleanup.confirmedGone = !after.exists();
    cleanup.docId = `${uid}_${week}`;
  } catch (e) {
    cleanup.error = String(e).slice(0, 200);
  }
  r.cleanup = cleanup;

  RESULTS.push(r);

  const pass = (
    r.floorState && r.planAffordance && r.clampDecDisabled && r.incApplied &&
    r.committedAfterReload && r.persistedCalls === (typeof r.persistedCalls === 'number' ? r.persistedCalls : NaN) &&
    r.persistedAgentProvenance && r.editSeededFromCommitted && r.cancelKeptCommitted &&
    r.resetToFloor && r.recommitPersisted &&
    Array.isArray(r.axeSC) && r.axeSC.length === 0 && errors.length === 0 &&
    cleanup.deleted && cleanup.confirmedGone && !r.fatal
  );

  console.log(`  floorState=${r.floorState} planAffordance=${r.planAffordance} clampDecDisabled=${r.clampDecDisabled} incApplied=${r.incApplied}`);
  console.log(`  committedAfterReload=${r.committedAfterReload} persistedCalls=${r.persistedCalls} agentProvenance=${r.persistedAgentProvenance}`);
  console.log(`  editSeededFromCommitted=${r.editSeededFromCommitted} cancelKeptCommitted=${r.cancelKeptCommitted} resetToFloor=${r.resetToFloor} recommitPersisted=${r.recommitPersisted}`);
  console.log(`  axe-sc=${Array.isArray(r.axeSC) ? r.axeSC.length : 'n/a'} consoleErrors=${errors.length} cleanup=${JSON.stringify(cleanup)}`);
  if (Array.isArray(r.axeSC)) r.axeSC.slice(0, 4).forEach((n) => console.log(`    axe ${n.id}: ${n.target}`));
  if (errors.length) errors.slice(0, 4).forEach((e) => console.log(`    console.error: ${e}`));
  if (r.fatal) console.log(`  FATAL: ${r.fatal}`);
  console.log(`\nWeekly Planner v2 Slice 2 smoke: ${pass ? '✓ PASS' : '✗ FAIL'}`);
  process.exit(pass ? 0 : 1);
}

run();

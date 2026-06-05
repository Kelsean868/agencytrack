// compliance-v2-s3-smoke.mjs — Phase 5 smoke for Compliance v2 Slice 3
// (feat/compliance-v2-s3 — plan-adoption lens + Filing⇄Plan toggle).
//
// READ-ONLY on the preview (NO plan nudge is fired: the deployed CF still
// rejects 'compliance.plan.nudge' until the post-merge deploy — the live plan-
// nudge round-trip is the DEFERRED leg, run in /post-merge). Uses
// setupBypassSession — token never in a bare URL after handshake.
//
// Per theme (light + dark):
//   1. Filing lens (default) unchanged: reality bar + stat-filed present.
//   2. Toggle → Plan: bar swaps to committed/not-committed; stat-filed gone;
//      exception header = "Haven't committed a plan"; roster + CBTT hidden.
//   3. Plan bar CONSISTENT with an independent web-SDK fan-out recompute over
//      the roster (bar.committed == derived) AND not-committed == plan
//      exception-row count.
//   4. Plan-Nudge button renders ENABLED (correct copy) — NOT fired.
//   5. Toggle → Filing: filing bar returns (lockstep both directions).
//   6. axe enumerate-and-accept (S1 allowlist) 0 unexpected + 0 console errors.
//   7. Screenshot each theme (plan lens).

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { setupBypassSession, setTheme, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const require = createRequire(import.meta.url);

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}
const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

const TOKEN        = requireEnv('VERCEL_BYPASS_TOKEN');
const MGR_EMAIL    = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const MGR_PASSWORD = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');

const PREVIEW_HOST =
  process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-compliance-v2-s3-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 1280, height: 900 };
const SS_DIR = resolve('verification', 'compliance-v2-s3-smoke');
mkdirSync(SS_DIR, { recursive: true });

const { AxeBuilder } = require('../../node_modules/@axe-core/playwright');

const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

const SERIOUS_ALLOWLIST = [
  { name: 'StatusPill danger pill on-tint (contrast-debt FU)',   test: (h) => /bg-danger\/15/.test(h) && /text-danger/.test(h) },
  { name: 'StatusPill warning pill on-tint (contrast-debt FU)',  test: (h) => /bg-warning\/15/.test(h) && /text-warning/.test(h) },
  { name: 'StatusPill success pill on-tint (contrast-debt FU)',  test: (h) => /bg-success\/15/.test(h) && /text-success/.test(h) },
  { name: 'exception count badge on-tint (contrast-debt FU)',    test: (h) => /bg-danger\/10/.test(h) && /text-danger/.test(h) },
  { name: 'pre-existing notification-bell badge',                test: (h) => /\babsolute\b/.test(h) && /bg-danger/.test(h) && /text-white/.test(h) },
];

const PLAN_NUDGE_TYPE = 'compliance.plan.nudge';
const firstInt = (s) => { const m = String(s ?? '').match(/-?\d+/); return m ? parseInt(m[0], 10) : NaN; };

async function loginAsManager(page) {
  await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', MGR_EMAIL);
  await page.fill('input[type="password"]', MGR_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 20000 });
  safeLog('[Auth] Branch manager logged in');
}

async function navigateToCompliance(page) {
  await page.click('[data-testid="nav-compliance"]', { timeout: 8000 });
  await page.waitForSelector('[data-testid="compliance-reality-bar"]', { timeout: 15000 });
}

// Independent recompute of plan adoption over the BM's roster via the web SDK
// (mirrors the app: getTenantUsers tenant-wide → role agent → getWeeklyPlan
// fan-out; a denied out-of-scope GET counts as not-committed, like the UI).
async function recomputePlanAdoption(weekStart) {
  const fbApp = initializeApp({
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  }, 's3-smoke-recompute');
  const auth = getAuth(fbApp);
  const cred = await signInWithEmailAndPassword(auth, MGR_EMAIL, MGR_PASSWORD);
  const tenantId = (await cred.user.getIdTokenResult()).claims.tenantId;
  const db = getFirestore(fbApp);
  const usersSnap = await getDocs(collection(db, `tenants/${tenantId}/users`));
  const agents = usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.role === 'agent' && u.provisioning !== true && u.active !== false);
  let committed = 0;
  await Promise.all(agents.map(async (a) => {
    try {
      const snap = await getDoc(doc(db, `tenants/${tenantId}/weeklyPlans/${a.id}_${weekStart}`));
      if (snap.exists()) committed += 1;
    } catch { /* denied/out-of-scope GET = not committed (matches the UI) */ }
  }));
  return { total: agents.length, committed, notCommitted: agents.length - committed };
}

async function runTheme(context, theme, recompute) {
  console.log(`\n── Theme: ${theme} ──`);
  await setTheme(context, theme);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text() ?? '';
    const url = (typeof msg.location === 'function' ? msg.location()?.url : '') ?? '';
    if (/fontshare/i.test(text) || /fontshare/i.test(url)) return;
    consoleErrors.push(text);
  });

  await loginAsManager(page);
  await navigateToCompliance(page);

  // Leg 1: filing lens default.
  const filedPresent = await page.locator('[data-testid="compliance-stat-filed"]').count();
  record(`Leg 1 filing default (${theme})`, filedPresent > 0,
    filedPresent > 0 ? 'filing reality bar present (stat-filed)' : 'filing bar MISSING');

  const weekStart = await page.$eval('select[aria-label="Week"]', (el) => el.value);

  // Leg 2: toggle → plan; bar + list swap, roster/CBTT hidden.
  await page.click('[data-testid="compliance-lens-plan"]');
  await page.waitForSelector('[data-testid="compliance-stat-committed"]', { timeout: 10000 });
  const filedGone   = await page.locator('[data-testid="compliance-stat-filed"]').count();
  const planHeader  = await page.locator('text=Haven\'t committed a plan').count();
  const rosterGone  = await page.locator('[data-testid="compliance-roster"]').count();
  const cbttGone    = await page.locator('[data-testid="compliance-cbtt-section"]').count();
  record(`Leg 2 toggle→plan (${theme})`,
    filedGone === 0 && planHeader > 0 && rosterGone === 0 && cbttGone === 0,
    `stat-filed gone=${filedGone === 0} · plan header=${planHeader > 0} · roster hidden=${rosterGone === 0} · CBTT hidden=${cbttGone === 0}`);

  // Leg 3: plan bar CONSISTENT with the independent recompute + with its own list.
  const committedVal = await page.getAttribute('[data-testid="compliance-stat-committed"]', 'data-value');
  const barCommitted = firstInt(committedVal);                                   // "X / Y · Z%"
  const barTotal     = firstInt(String(committedVal).split('/')[1]);
  const barNotCommitted = firstInt(await page.getAttribute('[data-testid="compliance-stat-notcommitted"]', 'data-value'));
  const planRows = await page.locator('[data-testid="compliance-exception-row"]').count();
  const consistent =
    barCommitted === recompute.committed &&
    barNotCommitted === recompute.notCommitted &&
    barTotal === recompute.total &&
    barNotCommitted === planRows;
  record(`Leg 3 plan bar == fan-out (${theme})`, consistent,
    consistent
      ? `bar committed ${barCommitted}/${barTotal}, not-committed ${barNotCommitted} == recompute; not-committed == ${planRows} rows`
      : `MISMATCH bar={c:${barCommitted},nc:${barNotCommitted},t:${barTotal}} recompute=${JSON.stringify(recompute)} rows=${planRows}`);

  // Leg 4: plan-Nudge button renders (NOT fired) when there are exceptions.
  if (planRows > 0) {
    const nudgeBtn = await page.locator('[data-testid="compliance-nudge-btn"]').first();
    const visible = await nudgeBtn.isVisible().catch(() => false);
    const enabled = visible ? await nudgeBtn.isEnabled().catch(() => false) : false;
    record(`Leg 4 plan-Nudge renders, not fired (${theme})`, visible && enabled,
      visible && enabled ? 'plan Nudge button present + enabled (deliberately NOT fired)' : 'plan Nudge button missing/disabled');
  } else {
    record(`Leg 4 plan-Nudge renders, not fired (${theme})`, true, 'no not-committed agents in preview — button leg skipped (source-aware)');
  }
  await page.screenshot({ path: resolve(SS_DIR, `${theme}-plan-lens.png`), fullPage: true });

  // Leg 5: toggle back → filing (lockstep both directions).
  await page.click('[data-testid="compliance-lens-filing"]');
  const filedBack = await page.locator('[data-testid="compliance-stat-filed"]').waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  record(`Leg 5 toggle→filing back (${theme})`, filedBack, filedBack ? 'filing bar returned on toggle back' : 'filing bar did NOT return');

  // Leg 6: axe + console.
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const crit = axe.violations.filter((v) => v.impact === 'critical');
  const seriousNodes = axe.violations
    .filter((v) => v.impact === 'serious')
    .flatMap((v) => v.nodes.map((n) => ({ id: v.id, html: n.html ?? '' })));
  const unexpected = seriousNodes.filter((n) => !SERIOUS_ALLOWLIST.some((a) => a.test(n.html)));
  record(`Leg 6 axe (${theme})`, crit.length === 0 && unexpected.length === 0,
    `critical: ${crit.length} · serious: ${seriousNodes.length} (allowlisted ${seriousNodes.length - unexpected.length}, unexpected ${unexpected.length})` +
    (unexpected.length ? ` → NEW: ${unexpected.map((n) => `${n.id} :: ${n.html}`).join(' | ')}` : '')); // html aids triage
  record(`Leg 6 console (${theme})`, consoleErrors.length === 0,
    consoleErrors.length === 0 ? '0 console errors (Fontshare CORS filtered)' : `${consoleErrors.length} error(s): ${consoleErrors.slice(0, 3).join(' | ')}`);

  await page.close();
}

async function main() {
  console.log('Compliance v2 S3 — read-only smoke (BM, both themes; NO plan nudge fired)');
  safeLog('Preview host:', PREVIEW_HOST);

  const browser = await chromium.launch({ headless: true });
  let recompute = null;
  try {
    // Throwaway probe context (its own session) to read the panel's default week,
    // then recompute plan adoption once against that week.
    const ctxProbe = await browser.newContext({ viewport: VIEWPORT });
    await setupBypassSession(ctxProbe, PREVIEW_URL, TOKEN);
    const probe = await ctxProbe.newPage();
    await loginAsManager(probe);
    await navigateToCompliance(probe);
    const weekStart = await probe.$eval('select[aria-label="Week"]', (el) => el.value);
    await ctxProbe.close();
    recompute = await recomputePlanAdoption(weekStart);
    safeLog('Plan-adoption recompute (week ' + weekStart + '):', JSON.stringify(recompute));

    // Fresh (unauthenticated) context per theme.
    const ctxLight = await browser.newContext({ viewport: VIEWPORT });
    await setupBypassSession(ctxLight, PREVIEW_URL, TOKEN);
    await runTheme(ctxLight, 'light', recompute);
    await ctxLight.close();

    const ctxDark = await browser.newContext({ viewport: VIEWPORT });
    await setupBypassSession(ctxDark, PREVIEW_URL, TOKEN);
    await runTheme(ctxDark, 'dark', recompute);
    await ctxDark.close();
  } finally {
    await browser.close();
  }

  console.log('\n── Summary ─────────────────────────────────────────────────');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  results.forEach(({ leg, passed, detail }) => console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`));
  console.log(`\nPlan nudge type '${PLAN_NUDGE_TYPE}' NOT fired pre-merge (deferred to /post-merge after the CF deploy).`);
  console.log(`${passed + failed} checks: ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.error('Smoke FAILED — see above.'); process.exit(1); }
}

main().catch((err) => {
  console.error('Fatal smoke error:', err);
  process.exit(1);
});

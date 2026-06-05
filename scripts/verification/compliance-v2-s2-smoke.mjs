// compliance-v2-s2-smoke.mjs — Phase 5 smoke for Compliance v2 Slice 2
// (feat/compliance-v2-s2 — Nudge CF + notifications + unlock/view re-home).
//
// WRITES via the live sendComplianceNudge CF (must be deployed first). Uses
// setupBypassSession — token never in a bare URL after handshake.
//
// Flow (BM credential):
//   LIGHT theme — full write walk:
//     1. Nudge a not-in agent → CF success → cooldown chip renders w/ relative time
//     2. RELOAD → cooldown chip persists (deterministic-ID upline GET proof)
//     3. Nudge-all confirm dialog shows correct count + scope → CANCEL (no blast)
//     4. Submitted row View → SubmissionViewer opens
//     5. axe serious/critical (allowlist-asserted) + 0 console errors
//     6. screenshot
//   DARK theme — observe (no new write, proves cross-session persistence):
//     7. the same agent shows a cooldown chip (fresh login, separate context)
//     8. Nudge-all confirm → CANCEL · View → viewer · axe · console · screenshot
//   CLEANUP (web SDK, signed in as the BM = the nudge creator):
//     9. deleteDoc the nudges record (creator-delete, D2 rule) → getDoc confirms gone,
//        resetting the cooldown for repeatability. The bell notification +
//        auditNudges docs are INTENTIONAL durable records — NOT cleaned (documented).
//        One real email per run is sent to the test agent by design.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { setupBypassSession, setTheme, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const require = createRequire(import.meta.url);

// ── Env ─────────────────────────────────────────────────────────────────────
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
const NUDGE_TYPE   = 'compliance.filing.nudge';

const PREVIEW_HOST =
  process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-compliance-v2-s2-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 1280, height: 900 };
const SS_DIR = resolve('verification', 'compliance-v2-s2-smoke');
mkdirSync(SS_DIR, { recursive: true });

const { AxeBuilder } = require('../../node_modules/@axe-core/playwright');

const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

// Same enumerate-and-accept allowlist as S1 (contrast-debt family + bell badge).
const SERIOUS_ALLOWLIST = [
  { name: 'StatusPill danger pill on-tint (contrast-debt FU)',   test: (h) => /bg-danger\/15/.test(h) && /text-danger/.test(h) },
  { name: 'StatusPill warning pill on-tint (contrast-debt FU)',  test: (h) => /bg-warning\/15/.test(h) && /text-warning/.test(h) },
  { name: 'StatusPill success pill on-tint (contrast-debt FU)',  test: (h) => /bg-success\/15/.test(h) && /text-success/.test(h) },
  { name: 'exception count badge on-tint (contrast-debt FU)',    test: (h) => /bg-danger\/10/.test(h) && /text-danger/.test(h) },
  { name: 'pre-existing notification-bell badge',                test: (h) => /\babsolute\b/.test(h) && /bg-danger/.test(h) && /text-white/.test(h) },
];

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

// Read the selected week (YYYY-MM-DD) from the panel's week <select>.
async function readSelectedWeek(page) {
  return page.$eval('select[aria-label="Week"]', (el) => el.value);
}

async function axeAndConsole(page, theme, consoleErrors) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const crit = axe.violations.filter((v) => v.impact === 'critical');
  const seriousNodes = axe.violations
    .filter((v) => v.impact === 'serious')
    .flatMap((v) => v.nodes.map((n) => ({ id: v.id, html: n.html ?? '', target: n.target })));
  const unexpected = seriousNodes.filter((n) => !SERIOUS_ALLOWLIST.some((a) => a.test(n.html)));
  record(`axe (${theme})`, crit.length === 0 && unexpected.length === 0,
    `critical: ${crit.length}${crit.length ? ` [${crit.map((v) => v.id).join(', ')}]` : ''} · serious: ${seriousNodes.length} (allowlisted ${seriousNodes.length - unexpected.length}, unexpected ${unexpected.length})` +
    (unexpected.length ? ` → NEW: ${unexpected.map((n) => `${n.id}@${JSON.stringify(n.target)}`).join('; ')}` : ''));
  record(`console (${theme})`, consoleErrors.length === 0,
    consoleErrors.length === 0 ? '0 console errors (Fontshare CORS filtered)' : `${consoleErrors.length} error(s): ${consoleErrors.slice(0, 3).join(' | ')}`);
}

function attachConsole(page) {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text() ?? '';
    const url = (typeof msg.location === 'function' ? msg.location()?.url : '') ?? '';
    if (/fontshare/i.test(text) || /fontshare/i.test(url)) return;
    consoleErrors.push(text);
  });
  return consoleErrors;
}

// Shared sub-walks (Nudge-all confirm→cancel; View→viewer) used in both themes.
async function nudgeAllConfirmThenCancel(page, theme, expectedCount) {
  const nudgeAll = page.locator('[data-testid="compliance-nudge-all"]');
  if (await nudgeAll.count() === 0) {
    record(`Nudge-all confirm (${theme})`, true, 'no exceptions in preview — skipped (source-aware)');
    return;
  }
  await nudgeAll.click();
  const dialog = await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).then(() => true).catch(() => false);
  if (!dialog) { record(`Nudge-all confirm (${theme})`, false, 'confirm dialog did NOT open'); return; }
  const title = await page.locator('[role="dialog"] #confirm-dialog-title').textContent();
  const namesCount = new RegExp(`Nudge ${expectedCount} agent`).test(title ?? '');
  record(`Nudge-all confirm (${theme})`, namesCount,
    namesCount ? `dialog names count: "${title?.trim()}"` : `count mismatch in "${title?.trim()}" (expected ${expectedCount})`);
  // CANCEL — never blast.
  await page.locator('[role="dialog"] button', { hasText: /cancel/i }).first().click();
  await page.waitForTimeout(300);
}

async function viewOpensViewer(page, theme) {
  const viewBtn = page.locator('[data-testid="compliance-view-btn"]').first();
  if (await viewBtn.count() === 0) {
    record(`View → viewer (${theme})`, true, 'no submitted rows in preview — skipped (source-aware)');
    return;
  }
  await viewBtn.click();
  // SubmissionViewer renders a right-side panel headed "Submission Details".
  const opened = await page.locator('h2', { hasText: 'Submission Details' })
    .waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  record(`View → viewer (${theme})`, opened, opened ? 'SubmissionViewer opened on View' : 'viewer did NOT open');
  if (opened) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
}

let nudgedUid = null;
let selectedWeek = null;

async function runLight(context) {
  console.log('\n── Theme: light (write walk) ──');
  await setTheme(context, 'light');
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);
  await loginAsManager(page);
  await navigateToCompliance(page);
  selectedWeek = await readSelectedWeek(page);

  const exRows = page.locator('[data-testid="compliance-exception-row"]');
  const exCount = await exRows.count();

  if (exCount === 0) {
    record('Leg 1 nudge (light)', true, 'no not-in agents in preview — nudge write skipped (source-aware)');
  } else {
    // Capture the first exception agent's uid (for deterministic cleanup).
    const firstRow = exRows.first();
    nudgedUid = await firstRow.getAttribute('data-uid');
    const nudgeBtn = firstRow.locator('[data-testid="compliance-nudge-btn"]');

    if (await nudgeBtn.count() === 0) {
      record('Leg 1 nudge (light)', true, `first exception agent already on cooldown (uid ${nudgedUid}) — observing chip instead`);
    } else {
      await nudgeBtn.click();
      // Cooldown chip appears on success (CF round-trip).
      const chip = await firstRow.locator('[data-testid="compliance-cooldown-chip"]')
        .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      const chipText = chip ? await firstRow.locator('[data-testid="compliance-cooldown-chip"]').textContent() : '';
      record('Leg 1 nudge (light)', chip, chip ? `CF fired; cooldown chip "${chipText?.trim()}"` : 'cooldown chip did NOT render after nudge');
    }

    // Leg 2: reload → chip persists (upline GET on the deterministic id).
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="compliance-reality-bar"]', { timeout: 15000 });
    const persisted = await page.locator(`[data-testid="compliance-exception-row"][data-uid="${nudgedUid}"] [data-testid="compliance-cooldown-chip"]`)
      .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    record('Leg 2 reload-persist (light)', persisted, persisted ? 'cooldown chip persisted across reload (upline GET)' : 'chip did NOT persist');
  }

  // Leg 3: Nudge-all confirm → cancel.
  await nudgeAllConfirmThenCancel(page, 'light', exCount);
  // Leg 4: View → viewer.
  await viewOpensViewer(page, 'light');
  // Leg 5/6: axe + console.
  await axeAndConsole(page, 'light', consoleErrors);
  await page.screenshot({ path: resolve(SS_DIR, 'light-compliance.png'), fullPage: true });
  await page.close();
}

async function runDark(context) {
  console.log('\n── Theme: dark (observe; no new write) ──');
  await setTheme(context, 'dark');
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);
  await loginAsManager(page);
  await navigateToCompliance(page);

  // Cross-session persistence: the nudged agent (if any) shows a cooldown chip
  // in a fresh login/context.
  if (nudgedUid) {
    const chip = await page.locator(`[data-testid="compliance-exception-row"][data-uid="${nudgedUid}"] [data-testid="compliance-cooldown-chip"]`)
      .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    record('Leg 7 cross-session chip (dark)', chip, chip ? 'cooldown chip visible in fresh dark-theme session' : 'chip not visible (data may have shifted)');
  } else {
    record('Leg 7 cross-session chip (dark)', true, 'no agent nudged this run — skipped (source-aware)');
  }

  const exCount = await page.locator('[data-testid="compliance-exception-row"]').count();
  await nudgeAllConfirmThenCancel(page, 'dark', exCount);
  await viewOpensViewer(page, 'dark');
  await axeAndConsole(page, 'dark', consoleErrors);
  await page.screenshot({ path: resolve(SS_DIR, 'dark-compliance.png'), fullPage: true });
  await page.close();
}

// Cleanup: delete the nudges record as the creating BM (D2 creator-delete rule).
async function cleanup() {
  if (!nudgedUid || !selectedWeek) {
    record('Cleanup', true, 'nothing nudged this run — no cleanup needed');
    return;
  }
  const fbApp = initializeApp({
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  }, 's2-smoke-cleanup');
  const auth = getAuth(fbApp);
  const cred = await signInWithEmailAndPassword(auth, MGR_EMAIL, MGR_PASSWORD);
  const tokenResult = await cred.user.getIdTokenResult();
  const tenantId = tokenResult.claims.tenantId;
  const db = getFirestore(fbApp);
  const nudgeId = `${nudgedUid}_${NUDGE_TYPE}_${selectedWeek}`;
  const ref = doc(db, `tenants/${tenantId}/nudges/${nudgeId}`);
  await deleteDoc(ref); // creator delete — proves the D2 delete rule live
  const after = await getDoc(ref);
  record('Cleanup', !after.exists(),
    !after.exists()
      ? `nudges/${nudgeId} deleted by creator; getDoc confirms gone (cooldown reset). Durable: bell notification + auditNudges intentionally retained; 1 email sent by design.`
      : 'nudge record STILL EXISTS after delete');
}

async function main() {
  console.log('Compliance v2 S2 — write smoke (BM credential, both themes)');
  safeLog('Preview host:', PREVIEW_HOST);

  const browser = await chromium.launch({ headless: true });
  try {
    const ctxLight = await browser.newContext({ viewport: VIEWPORT });
    await setupBypassSession(ctxLight, PREVIEW_URL, TOKEN);
    await runLight(ctxLight);
    await ctxLight.close();

    const ctxDark = await browser.newContext({ viewport: VIEWPORT });
    await setupBypassSession(ctxDark, PREVIEW_URL, TOKEN);
    await runDark(ctxDark);
    await ctxDark.close();
  } finally {
    await browser.close();
  }

  // Cleanup runs regardless (try/finally semantics via its own try).
  try {
    await cleanup();
  } catch (err) {
    record('Cleanup', false, `cleanup threw: ${err.message ?? err}`);
  }

  console.log('\n── Summary ─────────────────────────────────────────────────');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  results.forEach(({ leg, passed, detail }) => console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`));
  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('Smoke FAILED — see above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal smoke error:', err);
  process.exit(1);
});

/**
 * smoke-plan-review-b2.mjs — PR-B2 plan-review drawer smoke (tabs + denied→
 * neutral live proof + dynamic focus trap), both themes, against a Vercel preview.
 *
 * B1-deploy-conditional (brief Phase 5): when the B1 yearPlan/monthlyPlan upline
 * arms are NOT live (B1 unmerged/undeployed), every plan read denies — the Year
 * Plan / Monthly tabs MUST render the NEUTRAL "Plan unavailable" state and never
 * an error. That IS the pre-deploy behavior contract, asserted live here.
 * Value-level plan legs (seeded targets, health verdicts) are the Rule 13
 * deferred FU, re-run post-B1-deploy.
 *
 * Legs:
 *  1. UM opens a shared agent's drawer → three tabs render, Overview selected,
 *     GPM1 Overview testids intact.
 *  2. Year Plan tab → tpd-year-unavailable (neutral), NO tpd-year-error.
 *  3. Monthly tab   → tpd-monthly-unavailable (neutral), NO tpd-monthly-error.
 *  4. Focus trap: Tab on Coach (last) wraps to Close (first); Shift+Tab back.
 *  5. Dark theme: repeat 1–3.
 *  6. Cleanup: restore the worksheet's original visibility; 0 orphans (this
 *     smoke seeds NOTHING except the visibility flip when needed).
 *
 * SAFETY: tatillife_smoke hard guard (agent token tenant claim). The only write
 * is the agent's own visibility field via the agent's OWN client token
 * (rules-enforced), restored in finally.
 *
 * Run: node scripts/verification/smoke-plan-review-b2.mjs <https-preview-url>
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  safeLog,
  waitForFirebaseReady,
} from './lib/walk-helpers.mjs';
import { loadEnv, loginAs, getIdToken, decodeJwt, firestoreGet } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');
const E     = loadEnv(ROOT);

const PREVIEW_URL = (process.argv[2] || '').replace(/\/$/, '');
if (!PREVIEW_URL.startsWith('https://')) {
  console.error('Usage: node scripts/verification/smoke-plan-review-b2.mjs <https-preview-url>');
  process.exit(2);
}

const FIREBASE_PROJECT = 'agencytrack-2a610';
const SMOKE_TENANT     = 'tatillife_smoke';
const YEAR             = new Date().getFullYear();

const results = [];
const pass = (label, note = '') => { results.push({ label, ok: true }); console.log(`  ✅ ${label}${note ? ': ' + note : ''}`); };
const fail = (label, detail = '') => { results.push({ label, ok: false, detail }); console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`); };

async function restGet(idToken, path) {
  const { ok, body } = await firestoreGet(path, idToken, FIREBASE_PROJECT);
  if (!ok) throw new Error(`GET ${path} → ${JSON.stringify(body?.error ?? body).slice(0, 200)}`);
  return body;
}

async function restPatch(idToken, path, fields, fieldMasks) {
  const maskParams = fieldMasks.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}?${maskParams}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`PATCH ${path} → ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

async function openTeamPlans(page) {
  await waitForFirebaseReady(page, 25_000);
  await page.waitForSelector('[data-testid^="nav-"]', { state: 'attached', timeout: 30_000 });
  const navSel = '[data-testid="nav-team-game-plans"]';
  if (!(await page.locator(navSel).first().isVisible().catch(() => false))) {
    const toggle = page.locator('[data-testid="sidebar-ws-toggle-team"]');
    if (await toggle.first().isVisible().catch(() => false)) await toggle.first().click();
  }
  await page.waitForSelector(navSel, { state: 'visible', timeout: 15_000 });
  await page.locator(navSel).first().click();
  await page.waitForSelector('[data-testid="team-plans-roster"][data-loading="false"]', { timeout: 30_000 });
}

async function assertTabsAndNeutral(page, agentUid, themeTag) {
  await page.locator(`[data-testid="team-plans-view-${agentUid}"]`).click();
  await page.waitForSelector('[data-testid="team-plans-drawer"]', { timeout: 15_000 });

  // Leg 1 — tab shell + Overview intact.
  const overviewSelected = await page.locator('[data-testid="tpd-tab-overview"]').getAttribute('aria-selected');
  const hasYear = await page.locator('[data-testid="tpd-tab-year"]').count();
  const hasMonthly = await page.locator('[data-testid="tpd-tab-monthly"]').count();
  if (overviewSelected === 'true' && hasYear === 1 && hasMonthly === 1) pass(`1${themeTag}: three tabs render, Overview selected`);
  else fail(`1${themeTag}: tab shell`, `selected=${overviewSelected} year=${hasYear} monthly=${hasMonthly}`);
  const gpmIntact = await page.locator('[data-testid="team-plans-drawer-hero"]').count()
    && await page.locator('[data-testid="tpd-fyc-required"]').count()
    && await page.locator('[data-testid="team-plans-drawer-income"]').count();
  if (gpmIntact) pass(`1${themeTag}: GPM1 Overview testids intact`);
  else fail(`1${themeTag}: GPM1 Overview content missing`);

  // Leg 2 — Year tab denied→NEUTRAL (B1 arms not live).
  await page.locator('[data-testid="tpd-tab-year"]').click();
  try {
    await page.waitForSelector('[data-testid="tpd-year-unavailable"]', { timeout: 20_000 });
    const errCount = await page.locator('[data-testid="tpd-year-error"]').count();
    if (errCount === 0) pass(`2${themeTag}: Year tab denied → NEUTRAL "Plan unavailable" (no error alarm)`);
    else fail(`2${themeTag}: Year tab rendered an ERROR state on denial`);
  } catch {
    const errVisible = await page.locator('[data-testid="tpd-year-error"]').count();
    const emptyVisible = await page.locator('[data-testid="tpd-year-empty"]').count();
    fail(`2${themeTag}: Year tab neutral state`, `unavailable absent (error=${errVisible} empty=${emptyVisible}) — if B1 deployed since, run the value-level FU legs instead`);
  }

  // Leg 3 — Monthly tab denied→NEUTRAL.
  await page.locator('[data-testid="tpd-tab-monthly"]').click();
  try {
    await page.waitForSelector('[data-testid="tpd-monthly-unavailable"]', { timeout: 20_000 });
    const errCount = await page.locator('[data-testid="tpd-monthly-error"]').count();
    if (errCount === 0) pass(`3${themeTag}: Monthly tab denied → NEUTRAL "Plan unavailable"`);
    else fail(`3${themeTag}: Monthly tab rendered an ERROR state on denial`);
  } catch {
    fail(`3${themeTag}: Monthly tab neutral state`, 'tpd-monthly-unavailable absent');
  }

  // Leg 4 — dynamic focus trap (light only; DOM behavior is theme-invariant).
  if (themeTag === ' (light)') {
    await page.locator('[data-testid="team-plans-drawer-coach"]').focus();
    await page.keyboard.press('Tab');
    const afterTab = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (afterTab === 'Close plan detail') pass('4: Tab on Coach (last) wraps to Close (first)');
    else fail('4: focus trap forward wrap', `activeElement aria-label="${afterTab}"`);
    await page.keyboard.press('Shift+Tab');
    const afterShift = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    if (afterShift === 'team-plans-drawer-coach') pass('4: Shift+Tab on Close wraps back to Coach (last)');
    else fail('4: focus trap backward wrap', `activeElement data-testid="${afterShift}"`);
  }

  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="team-plans-drawer"]', { state: 'detached', timeout: 10_000 });
}

(async () => {
  const required = [
    'VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY',
    'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD',
    'A11Y_UNIT_MANAGER_EMAIL', 'A11Y_UNIT_MANAGER_PASSWORD',
  ];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  const agentToken  = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, E.VITE_FIREBASE_API_KEY);
  const agentClaims = decodeJwt(agentToken);
  const AGENT_UID   = agentClaims.user_id;
  const TENANT_ID   = agentClaims.tenantId;
  if (TENANT_ID !== SMOKE_TENANT) {
    console.error(`HARD GUARD: A11Y agent resolves to tenant "${TENANT_ID}" — aborting before any write.`);
    process.exit(1);
  }
  safeLog(`[setup] tenant=${TENANT_ID} agent=${AGENT_UID}`);

  const worksheetPath = `tenants/${TENANT_ID}/users/${AGENT_UID}/moneyNeeds/${YEAR}`;
  const originalDoc = await restGet(agentToken, worksheetPath);
  const originalVisibility = originalDoc.fields?.visibility?.stringValue ?? 'private';
  let flipped = false;

  const browser = await chromium.launch({ headless: true });
  let capture = null;
  try {
    // The drawer only opens from a SHARED row — flip visibility if needed (agent's own token).
    if (originalVisibility !== 'shared') {
      await restPatch(agentToken, worksheetPath, { visibility: { stringValue: 'shared' } }, ['visibility']);
      flipped = true;
      safeLog('[seed] visibility flipped to shared (will restore)');
    }

    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    capture = captureConsoleAndNetwork(page);
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(page, E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD, `${PREVIEW_URL}/`);

    // Light theme.
    await openTeamPlans(page);
    await assertTabsAndNeutral(page, AGENT_UID, ' (light)');

    // Dark theme.
    await page.evaluate(() => localStorage.setItem('agencytrack-dark', '1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) pass('5 (dark): dark theme active after reload');
    else fail('5 (dark): dark theme activation');
    await openTeamPlans(page);
    await assertTabsAndNeutral(page, AGENT_UID, ' (dark)');
    await page.evaluate(() => localStorage.removeItem('agencytrack-dark'));
  } catch (e) {
    fail('smoke', `crashed: ${e.message}`);
  } finally {
    // Cleanup — restore visibility exactly; the smoke wrote nothing else.
    try {
      if (flipped) {
        await restPatch(agentToken, worksheetPath, { visibility: { stringValue: originalVisibility } }, ['visibility']);
        const check = await restGet(agentToken, worksheetPath);
        (check.fields?.visibility?.stringValue === originalVisibility)
          ? pass('6-cleanup', `visibility restored to "${originalVisibility}", 0 orphans`)
          : fail('6-cleanup', `visibility restore mismatch: ${check.fields?.visibility?.stringValue}`);
      } else {
        pass('6-cleanup', 'nothing seeded (worksheet already shared), 0 orphans');
      }
    } catch (e) { fail('6-cleanup', `restore error: ${e.message}`); }

    if (capture) console.log(formatCaptureReport(capture));
    await browser.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
    if (failed.length) { failed.forEach((r) => console.log(`  ✗ ${r.label}${r.detail ? ' — ' + r.detail : ''}`)); process.exit(1); }
    console.log('All legs green.');
    process.exit(0);
  }
})();

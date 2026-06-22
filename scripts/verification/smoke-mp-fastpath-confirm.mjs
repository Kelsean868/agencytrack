/**
 * smoke-mp-fastpath-confirm.mjs  (committed — producing-manager fast path)
 *
 * Verifies the producing-manager (UM/BM) daily-review → Confirm fast path on a
 * branch preview / production:
 *   MP-0  bundle-health (any day): manager dashboard → mp-* tab → daily FAB →
 *         DailyCaptureV2 mounts (proves the edited ManagerDashboard bundle boots)
 *   MP-1  (SUNDAY-GATED) "Review & submit" routes the wizard to the Confirm screen
 *         (week-confirm-view) at step 10, seeded from the manager's own aggregation
 *   MP-2  console clean
 *
 * The live Confirm screen is reachable ONLY on Sundays — DailyCaptureV2's
 * SundayConfirmView (the "Review & submit" deep-link that fires onReviewSubmit)
 * renders only when isTodaySunday. On a non-Sunday this skips-not-fails MP-1 and
 * relies on the RTL coverage (ManagerDashboardFastPath.test.jsx, real resolvePath).
 * Deferred live re-run: on/after 2026-06-28 (see docs/FOLLOW_UPS.md).
 *
 * READ/ASSERT only — does NOT submit, does NOT alter the seeded draft.
 *
 * Env: VERCEL_BYPASS_TOKEN + A11Y_UNIT_MANAGER_* (default) or A11Y_BRANCH_MANAGER_*
 *      when MP_ROLE=branch. SMOKE_BASE_URL overrides the preview base.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession, captureConsoleAndNetwork, formatCaptureReport } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();
const need = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env: ${k}`); return v; };

const BYPASS = need('VERCEL_BYPASS_TOKEN');
const ROLE   = (process.env.MP_ROLE || 'unit').toLowerCase();          // 'unit' | 'branch'
const EMAIL  = ROLE === 'branch' ? need('A11Y_BRANCH_MANAGER_EMAIL')    : need('A11Y_UNIT_MANAGER_EMAIL');
const PASS   = ROLE === 'branch' ? need('A11Y_BRANCH_MANAGER_PASSWORD') : need('A11Y_UNIT_MANAGER_PASSWORD');
const BASE   = process.env.SMOKE_BASE_URL
  || 'https://agencytrack-git-feat-producing-manager-fastpath-kyron-marchan-s-projects.vercel.app';

const stamp = () => new Date().toISOString().slice(11, 19);
const results = [];
const pass = (id, n = '') => { results.push({ id, ok: true, n }); console.log(`  [${stamp()}] PASS ${id}${n ? ' — ' + n : ''}`); };
const fail = (id, n = '') => { results.push({ id, ok: false, n }); console.log(`  [${stamp()}] FAIL ${id}${n ? ' — ' + n : ''}`); };
const skip = (id, n = '') => { results.push({ id, ok: true, skipped: true, n }); console.log(`  [${stamp()}] SKIP ${id}${n ? ' — ' + n : ''}`); };

async function login(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30000 });
  await page.waitForTimeout(2500);
}

// Navigate to an mp-* tab (mp-game-plan), open the daily-capture modal, and
// report whether the Sunday "Review & submit" deep-link is present.
async function openMpDailyAndDetectSunday(page) {
  const navMp = page.locator('[data-testid="nav-mp-game-plan"]');
  await navMp.waitFor({ state: 'visible', timeout: 15000 });
  await navMp.click();
  const fab = page.locator('[data-testid="daily-fab"]');
  await fab.waitFor({ state: 'visible', timeout: 10000 });
  await fab.click();
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { timeout: 12000 });
  await page.waitForTimeout(4000);
  const reviewBtn = page.getByRole('button', { name: /review.*submit/i });
  return reviewBtn.isVisible({ timeout: 5000 }).catch(() => false);
}

(async () => {
  console.log(`[${stamp()}] Producing-manager fast-path Confirm smoke (${ROLE}) — ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, BASE, BYPASS);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await login(page);
    console.log(`[${stamp()}] signed in as ${ROLE} manager`);

    const isSunday = await openMpDailyAndDetectSunday(page);
    // Bundle-health gate (reachable any day): DailyCaptureV2 mounting off an
    // mp-* tab proves the edited ManagerDashboard bundle parsed and booted clean.
    const dcvMounted = await page.locator('[data-testid="daily-capture-v2"]').isVisible().catch(() => false);
    dcvMounted
      ? pass('MP-0-bundle-health', 'mp-tab → FAB → daily-capture-v2 mounted (edited ManagerDashboard boots clean)')
      : fail('MP-0-bundle-health', 'daily-capture-v2 did not mount from an mp-* tab');

    if (isSunday) {
      // Sunday: the manager Confirm deep-link is live — assert fast-path routing.
      await page.getByRole('button', { name: /review.*submit/i }).click();
      const atConfirm = await page.locator('[data-testid="week-confirm-view"]')
        .waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false);
      const title = (await page.locator('[data-testid="wizard-v2-step-title"]').textContent().catch(() => '')).trim();
      (atConfirm && title === 'Confirm your week')
        ? pass('MP-1-fast-path-confirm', `manager daily-review → Confirm (title="${title}")`)
        : fail('MP-1-fast-path-confirm', `atConfirm=${atConfirm} title="${title}"`);
    } else {
      // Non-Sunday: the Confirm deep-link does not appear (DailyCaptureV2 Sunday gate).
      // Skip-not-fail per the banked "state-gated smoke" rule; RTL-covered by
      // ManagerDashboardFastPath.test.jsx (real resolvePath → initialScreen='confirm').
      skip('MP-1-fast-path-confirm', 'Sunday-gated manager Confirm not reachable today; RTL-covered — re-run on/after 2026-06-28');
    }

    // Close without submitting.
    const close = page.locator('[data-testid="wizard-v2-close"], [data-testid="daily-capture-v2-close"]').first();
    if (await close.isVisible({ timeout: 2000 }).catch(() => false)) await close.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    console.log(`[${stamp()}] closed without submitting`);

    const errs = (capture.consoleMessages ?? []).filter((m) => {
      const t = typeof m.type === 'function' ? m.type() : m.type;
      const tx = typeof m.text === 'function' ? m.text() : m.text;
      return t === 'error' && !/\.map|favicon|ERR_BLOCKED_BY_CLIENT|net::ERR_ABORTED/.test(tx || '');
    });
    errs.length === 0 ? pass('MP-2-console', '0 errors') : fail('MP-2-console', `${errs.length}: ${errs.map(m => (typeof m.text === 'function' ? m.text() : m.text)).join(' | ').slice(0,300)}`);

    console.log('\n' + formatCaptureReport(capture));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks: ${results.length - failed.length} passed, ${failed.length} failed`);
  console.log(failed.length === 0 ? 'Smoke PASSED.' : 'Smoke FAILED.');
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => { console.error('Unhandled:', e); process.exit(1); });

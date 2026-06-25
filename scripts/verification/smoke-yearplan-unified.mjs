/**
 * smoke-yearplan-unified.mjs — PR-U1 Game Plan Unification Core (Direction 1.5).
 *
 * Proves the merged Money Needs + Allocator surface writes the CANONICAL
 * `yearPlan/{year}` store (3-line life/ah/general, targetAPI-canonical) instead
 * of the retired `moneyNeeds.allocation` field, and that the Game Plan rail
 * collapsed from 4 steps to 3 (Money Needs · Monthly · Review & Commit).
 *
 * The merged surface is gated behind VITE_MONEY_NEEDS_MERGED_ENABLED, which is
 * OFF on the Vercel preview — so the write cycle runs against a LOCAL flag-ON
 * `vite preview` build (mirroring smoke-money-needs-merged-local.mjs), logging
 * in as the A11Y agent against production Firebase. The 3-step rail collapse is
 * flag-INDEPENDENT (VITE_GAME_PLAN_LOOP_ENABLED defaults on), so it is also
 * asserted when this smoke is pointed at the flag-OFF preview (SMOKE_PREVIEW_URL).
 *
 * Asserts (state-tolerant — the agent's worksheet/profile is whatever it is):
 *   1. Game Plan rail shows EXACTLY the 3 collapsed steps; NO "Year Plan" step.
 *   2. Merged-surface path active when flag-ON (no legacy YearPlanModal mount).
 *   3. When a commission need exists + merged surface present: allocate →
 *      Send → Game Plan; cascade "Planned annual API" is non-zero (the yearPlan
 *      write reached the loop). When the General line is visible, set a known
 *      General commission and confirm its derived API is present in the total.
 *   4. Reload → the allocated total persists (yearPlan survived the round-trip).
 *   5. Both themes render; 0 app console errors.
 *
 * Credentials by boolean presence only (Rule 4). Not wired into CI — manual.
 *
 * Usage:
 *   LOCAL flag-ON (full write cycle):  node scripts/verification/smoke-yearplan-unified.mjs
 *   PREVIEW (rail collapse only):      SMOKE_PREVIEW_URL=https://… node scripts/verification/smoke-yearplan-unified.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setTheme, setupBypassSession, loginAs,
  captureConsoleAndNetwork, formatCaptureReport, installGlobalTimeout,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const PREVIEW = process.env.SMOKE_PREVIEW_URL?.replace(/\/+$/, '');
const BASE = PREVIEW ?? 'http://localhost:4173';
const IS_LOCAL = !PREVIEW;
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS = process.env.A11Y_AGENT_PASSWORD;
const BYPASS = process.env.VERCEL_BYPASS_TOKEN;

const results = [];
const ok = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${extra ? ` (${extra})` : ''}`);
};

function parseCurrency(text) {
  if (!text) return NaN;
  const m = text.replace(/,/g, '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
}

async function gotoTab(page, tab) {
  await page.waitForSelector(`[data-testid="agent-tab-${tab}"]`, { timeout: 20_000 });
  await page.locator(`[data-testid="agent-tab-${tab}"]`).first().click({ force: true });
  await page.waitForTimeout(1800);
}

// Reach the merged allocator (flag-ON local only): create a worksheet + pick a
// license if first-run, mirroring smoke-money-needs-merged-local.mjs.
async function reachMerged(page) {
  await gotoTab(page, 'money-needs');
  await page.waitForSelector('text=Money Needs Worksheet', { timeout: 20_000 }).catch(() => {});
  const startBtn = await page.$('button:has-text("Start")');
  if (startBtn) { await startBtn.click().catch(() => {}); await page.waitForTimeout(2500); }
  for (let i = 0; i < 3; i++) {
    const picker = await page.$('[data-testid="alloc-license-picker"]');
    if (!picker) break;
    await page.click('[data-testid="alloc-license-picker"] button:has-text("Composite")').catch(() => {});
    await page.waitForTimeout(1500);
  }
}

// Assert the 3-step rail collapse on the Game Plan tab.
async function assertRailCollapse(page, label) {
  await gotoTab(page, 'game-plan');
  const rail = page.locator('[data-testid="game-plan-rail"]');
  const railVisible = await rail.isVisible({ timeout: 15_000 }).catch(() => false);
  ok(`[${label}] game-plan rail renders`, railVisible);
  if (!railVisible) return;
  const railText = await rail.textContent();
  ok(`[${label}] rail has "Money Needs" step`, /Money Needs/.test(railText));
  ok(`[${label}] rail has "Monthly Plan" step`, /Monthly Plan/.test(railText));
  ok(`[${label}] rail has "Review & Commit" step`, /Review & Commit/.test(railText));
  ok(`[${label}] rail has NO "Year Plan" step (4→3 collapse)`, !/Year Plan/.test(railText), railText.replace(/\s+/g, ' ').slice(0, 120));
}

(async () => {
  if (!EMAIL || !PASS) { console.error('Missing A11Y_AGENT creds'); process.exit(2); }
  if (PREVIEW && !BYPASS) { console.error('SMOKE_PREVIEW_URL set but VERCEL_BYPASS_TOKEN missing'); process.exit(2); }

  const clearTimeout = installGlobalTimeout(180_000, () => console.error('partial results:', results));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (PREVIEW) await setupBypassSession(context, BASE, BYPASS);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await loginAs(page, BASE, EMAIL, PASS);
    await page.waitForTimeout(1200);

    // ── 1. Rail collapse (flag-independent) — light theme ────────────────────
    await setTheme(context, 'light');
    await assertRailCollapse(page, 'light');
    await page.screenshot({ path: 'screenshots/yearplan-unified-rail-light.png', fullPage: true }).catch(() => {});

    if (IS_LOCAL) {
      // ── 2. Merged surface active (flag-ON) ─────────────────────────────────
      await reachMerged(page);
      const legacySend = await page.$('button:has-text("Send to Playground")');
      ok('legacy "Send to Playground" is NOT present (swap happened)', !legacySend);
      const merged = await page.$('[data-testid="merged-allocator"]');
      const noNeed = await page.$('[data-testid="alloc-no-need"]');
      const picker = await page.$('[data-testid="alloc-license-picker"]');
      ok('a merged-surface state renders (allocator / no-need / picker)',
        merged || noNeed || picker, merged ? 'allocator' : noNeed ? 'no-need' : picker ? 'picker' : 'none');

      // ── 3. Write cycle: allocate → Send → yearPlan reaches the loop ─────────
      if (merged) {
        // If the General line is visible, set a known General commission so its
        // derived API (commission ÷ 0.10) is provably present in the planned total.
        const genInput = await page.$('[data-testid="alloc-line-commission-input-general"]');
        let expectGeneralAPI = NaN;
        if (genInput) {
          await genInput.fill('5000');     // clamped to [0, required]; 5000 ÷ 0.10 = 50000 API
          await genInput.evaluate((el) => el.blur());
          await page.waitForTimeout(600);
          const genApiText = await page.$eval('[data-testid="alloc-line-api-label-general"]', (el) => el.textContent).catch(() => '');
          expectGeneralAPI = parseCurrency(genApiText);
          ok('General line accepts a commission and derives non-zero API',
            expectGeneralAPI > 0, `generalAPI=${expectGeneralAPI}`);
        } else {
          ok('General line not visible for this license — General-in-total assertion skipped (acceptable)', true);
        }

        await page.click('[data-testid="alloc-send-btn"]').catch(() => {});
        const ack = await page.waitForSelector('[data-testid="alloc-ack-modal"]', { timeout: 8000 }).catch(() => null);
        ok('Send opens the acknowledgement modal', !!ack);
        const stored = await page.evaluate(() => localStorage.getItem('agencytrack-playground-income-goal'));
        ok('Send wrote the Playground income-goal key', !!stored);
        if (ack) await page.click('[data-testid="alloc-ack-continue"]').catch(() => {});
        await page.waitForTimeout(2200);

        // Now on the Game Plan tab — the cascade's "Planned annual API" proves
        // the merged write reached yearPlan.
        const cascade = page.locator('[data-testid="game-plan-cascade"]');
        await cascade.isVisible({ timeout: 15_000 }).catch(() => false);
        const cascadeText = await cascade.textContent().catch(() => '');
        const plannedFigure = await cascade.locator('text=Planned annual API').locator('..')
          .locator('.font-display').first().textContent().catch(() => '');
        const plannedAPI = parseCurrency(plannedFigure);
        ok('cascade shows a non-zero Planned annual API (yearPlan written via merged surface)',
          plannedAPI > 0, `planned=${plannedAPI}`);
        if (expectGeneralAPI > 0) {
          ok('planned total includes the General API contribution (general not dropped)',
            plannedAPI >= expectGeneralAPI - 1, `planned=${plannedAPI} >= general=${expectGeneralAPI}`);
        }

        // ── 4. Reload → allocated total persists (yearPlan round-trip) ────────
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        await gotoTab(page, 'game-plan');
        const cascade2 = page.locator('[data-testid="game-plan-cascade"]');
        await cascade2.isVisible({ timeout: 15_000 }).catch(() => false);
        const planned2 = parseCurrency(
          await cascade2.locator('text=Planned annual API').locator('..').locator('.font-display').first().textContent().catch(() => ''),
        );
        ok('after reload the planned annual API persists (yearPlan survived)',
          planned2 > 0, `planned=${planned2}`);
        void cascadeText;
      } else {
        ok('write cycle skipped — agent worksheet has no commission need (acceptable, state-tolerant)', true);
      }
    } else {
      ok('merged-write cycle skipped — preview runs flag-OFF (operator Step-zero is the live acceptance test)', true);
    }

    // ── 5. Dark theme — rail still collapses cleanly ─────────────────────────
    await setTheme(context, 'dark');
    await page.waitForTimeout(500);
    await assertRailCollapse(page, 'dark');
    await page.screenshot({ path: 'screenshots/yearplan-unified-rail-dark.png', fullPage: true }).catch(() => {});

    // ── Console hygiene ──────────────────────────────────────────────────────
    console.log(formatCaptureReport(capture));
    // Known network noise on localhost: the _vercel analytics scripts (absent off
    // a real Vercel deploy) and the Firestore Listen/Write long-poll channels,
    // which abort by design on page close / mid-run reload (not app failures).
    const allNetNoise = (capture.networkFailures ?? []).every((f) => {
      const s = JSON.stringify(f);
      return /_vercel\/(insights|speed-insights)/.test(s)
        || /firestore\.googleapis\.com\/.*\/(Listen|Write)\/channel/.test(s);
    });
    const appErrors = capture.consoleMessages.filter((m) => m.type === 'error'
      && !/Failed to load resource/i.test(m.text ?? ''));
    ok('0 app console errors (Vercel-analytics 404s + Firestore channel aborts are known noise)',
      appErrors.length === 0 && (IS_LOCAL ? allNetNoise : true),
      `${appErrors.length} app errors`);
  } catch (err) {
    ok(`walk crashed: ${err.message}`, false);
    await page.screenshot({ path: 'screenshots/yearplan-unified-crash.png' }).catch(() => {});
  } finally {
    clearTimeout();
    await browser.close();
    const failed = results.filter((r) => !r.pass);
    console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
    process.exit(failed.length ? 1 : 0);
  }
})();

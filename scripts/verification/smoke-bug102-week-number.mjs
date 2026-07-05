/**
 * smoke-bug102-week-number.mjs
 *
 * BUG-102 regression smoke: the week number rendered by the dashboard topbar
 * crumb, the Daily Capture header, and the Game Plan suggested-week label must
 * all agree, and must equal the shared floored Sunday-anchored helper's value
 * for today's LOCAL calendar day (`weekNumber()` in src/utils/dateHelpers.js —
 * imported directly, so the assertion target IS the shipped formula).
 *
 * Pre-fix behavior this guards against: the topbar/GamePlan formulas were
 * unfloored (`(now - jan1)/86400000` with a fractional day), so the rendered
 * week incremented mid-week with the time of day ("Week 28" vs Daily Capture's
 * floored "WK 27" on the same Saturday).
 *
 * Legs: desktop-light 1440×900 (topbar + Daily Capture + Game Plan) and
 * mobile-light 380×820 (Daily Capture via the ＋ Quick-Add; the topbar crumb is
 * CSS-collapsed under 768px so it has no mobile assertion). One theme only:
 * every asserted value is text content, theme-independent — dark adds no
 * signal for this finding.
 *
 * READ-ONLY: no Firestore writes; the Daily Capture takeover is opened and
 * closed without saving. Credentials via .env.local → process.env by NAME only.
 *
 * Usage:
 *   SMOKE_PREVIEW_URL="https://<immutable-deployment>.vercel.app" \
 *     node --env-file=.env.local scripts/verification/smoke-bug102-week-number.mjs
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
  stamp,
} from './lib/walk-helpers.mjs';
import { weekNumber } from '../../src/utils/dateHelpers.js';

const BASE = (process.env.SMOKE_PREVIEW_URL || process.env.SMOKE_BASE_URL || '')
  .replace(/\/+$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS = process.env.A11Y_AGENT_PASSWORD;

if (!BASE || !TOKEN || !EMAIL || !PASS) {
  console.error('MISSING ENV: need SMOKE_PREVIEW_URL, VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD');
  process.exit(2);
}

const EXPECTED = weekNumber(); // today's local calendar day, floored helper

const results = [];
const pass = (id, msg) => { results.push({ id, ok: true, msg }); console.log(`[${stamp()}] PASS ${id} — ${msg}`); };
const fail = (id, msg) => { results.push({ id, ok: false, msg }); console.log(`[${stamp()}] FAIL ${id} — ${msg}`); };
const skip = (id, msg) => { results.push({ id, ok: true, msg: `SKIP: ${msg}` }); console.log(`[${stamp()}] SKIP ${id} — ${msg}`); };

async function readMatch(page, selector, re, timeout = 8000) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'attached', timeout });
  // Poll until the element's text actually matches — a one-shot textContent()
  // can capture a loading/placeholder state before the value stabilizes
  // (CodeRabbit). Fall through to a final read if the poll times out so the
  // caller still gets null (recorded as a fail) rather than a thrown abort.
  await page
    .waitForFunction(
      ([sel, src]) => {
        const node = document.querySelector(sel);
        return !!node && new RegExp(src).test(node.textContent || '');
      },
      [selector, re.source],
      { timeout },
    )
    .catch(() => {});
  const text = (await el.textContent()) || '';
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

async function openDailyCapture(page, { mobile }) {
  if (mobile) {
    await page.locator('[data-testid="bottomnav-create"]').first().click({ timeout: 6000 });
    // Wait for the Quick-Add sheet's Log-today item rather than a fixed sleep.
    const logToday = page.locator('[data-testid="quickadd-log-today"]').first();
    await logToday.waitFor({ state: 'visible', timeout: 6000 });
    await logToday.click({ timeout: 6000 });
  } else {
    await page.locator('[data-testid="agent-tab-daily-log"]').first().click({ timeout: 6000 });
  }
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { timeout: 10000 });
}

async function run() {
  const browser = await chromium.launch();
  try {
    // ── Desktop leg ──────────────────────────────────────────────────────
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
      let capture;
      try {
      await setupBypassSession(context, BASE, TOKEN);
      const page = await context.newPage();
      capture = captureConsoleAndNetwork(page);
      await loginAs(page, BASE, EMAIL, PASS);

      // 1. Topbar crumb week
      const topbarWeek = await readMatch(page, '.topbar-crumb', /Week (\d+)/);
      if (topbarWeek === EXPECTED) pass('desktop-topbar', `topbar crumb "Week ${topbarWeek}" === helper expected ${EXPECTED}`);
      else fail('desktop-topbar', `topbar week ${topbarWeek} !== expected ${EXPECTED}`);

      // 2. Daily Capture header week (same session, same minute)
      await openDailyCapture(page, { mobile: false });
      const dcText = (await page.locator('[data-testid="daily-capture-v2"]').textContent()) || '';
      const dcWeek = (dcText.match(/WK (\d+)/) || [])[1] ? Number(dcText.match(/WK (\d+)/)[1]) : null;
      if (dcWeek === EXPECTED) pass('desktop-daily-capture', `Daily Capture "WK ${dcWeek}" === expected ${EXPECTED}`);
      else fail('desktop-daily-capture', `Daily Capture week ${dcWeek} !== expected ${EXPECTED}`);
      if (topbarWeek !== null && dcWeek !== null && topbarWeek === dcWeek) {
        pass('desktop-agreement', `topbar and Daily Capture agree (${topbarWeek}) — BUG-102 divergence closed`);
      } else {
        fail('desktop-agreement', `topbar ${topbarWeek} vs Daily Capture ${dcWeek} — surfaces disagree`);
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.reload({ waitUntil: 'domcontentloaded' });

      // 3. Game Plan suggested-week label (soft leg: card may not render for
      //    every account state; skip-note rather than fail if absent)
      await page.locator('[data-testid="agent-tab-game-plan"]').first().click({ timeout: 6000 });
      // Wait for the Game Plan hub container instead of a fixed sleep.
      await page.locator('[data-testid="game-plan-hub"]').first()
        .waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      // Anchor on the SuggestedWeekCard eyebrow span ("Suggested weekly plan ·
      // Wk N" / "Your weekly plan · Wk N") and read ITS OWN textContent — a bare
      // /Wk (\d+)/ on body.textContent swallows digits from adjacent text nodes
      // (concatenated without separators, e.g. "Wk 28" + "60"). Wait for the span
      // itself (populated after the hub's async plan fetch, later than the hub
      // container mounts) before reading; a genuine absence still skips.
      const gpSpan = page.locator('span', { hasText: /weekly plan · Wk \d+/i }).first();
      const gpPresent = await gpSpan.waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true).catch(() => false);
      const gpText = gpPresent ? (await gpSpan.textContent()) || '' : '';
      const gpMatch = gpText.match(/weekly plan · Wk (\d+)/i);
      if (!gpMatch) skip('desktop-game-plan', 'suggested-week "Wk N" label not present for this account state');
      else if (Number(gpMatch[1]) === EXPECTED) pass('desktop-game-plan', `Game Plan "Wk ${gpMatch[1]}" === expected ${EXPECTED}`);
      else fail('desktop-game-plan', `Game Plan week ${gpMatch[1]} !== expected ${EXPECTED}`);

      const errs = capture.consoleMessages.filter((m) => m.type === 'error');
      if (errs.length === 0) pass('desktop-console', '0 console errors');
      else fail('desktop-console', `${errs.length} console errors: ${errs.map((e) => e.text).slice(0, 3).join(' | ')}`);
      } catch (e) {
        fail('desktop-leg', `unexpected error before all desktop checks ran: ${e.message}`);
      } finally {
        if (capture) console.log(formatCaptureReport(capture));
        await context.close();
      }
    }

    // ── Mobile leg (380px) ───────────────────────────────────────────────
    {
      const context = await browser.newContext({ viewport: { width: 380, height: 820 }, ignoreHTTPSErrors: true });
      let capture;
      try {
      await setupBypassSession(context, BASE, TOKEN);
      const page = await context.newPage();
      capture = captureConsoleAndNetwork(page);
      await loginAs(page, BASE, EMAIL, PASS);

      await openDailyCapture(page, { mobile: true });
      const dcText = (await page.locator('[data-testid="daily-capture-v2"]').textContent()) || '';
      const dcWeek = (dcText.match(/WK (\d+)/) || [])[1] ? Number(dcText.match(/WK (\d+)/)[1]) : null;
      if (dcWeek === EXPECTED) pass('mobile-daily-capture', `Daily Capture "WK ${dcWeek}" === expected ${EXPECTED} at 380px`);
      else fail('mobile-daily-capture', `Daily Capture week ${dcWeek} !== expected ${EXPECTED} at 380px`);

      const errs = capture.consoleMessages.filter((m) => m.type === 'error');
      if (errs.length === 0) pass('mobile-console', '0 console errors');
      else fail('mobile-console', `${errs.length} console errors: ${errs.map((e) => e.text).slice(0, 3).join(' | ')}`);
      } catch (e) {
        fail('mobile-leg', `unexpected error before all mobile checks ran: ${e.message}`);
      } finally {
        if (capture) console.log(formatCaptureReport(capture));
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n════════ SUMMARY ════════');
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.id} — ${r.msg}`);
  console.log(`\n${results.length - failed.length}/${results.length} PASS (expected week for today: ${EXPECTED})`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => { console.error('SMOKE CRASH:', e.message); process.exit(1); });

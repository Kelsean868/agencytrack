/**
 * smoke-a11y-h1-skiplink.mjs
 *
 * L1-5a accessibility sweep — verifies three shell-level a11y fixes on the live
 * agent surface:
 *   1. A11Y-103 skip link: the FIRST Tab stop from page top is "Skip to main
 *      content"; activating it moves focus to the <main> landmark.
 *   2. A11Y-001 headings: every screen has a topbar <h1> (was a styled div).
 *   3. UX-101 dynamic title: the <h1> text tracks the active nav item's label
 *      (was a static "Dashboard" on all 15 agent tabs).
 *
 * READ-ONLY (navigation + focus/DOM reads only; no writes). Credentials via
 * .env.local → process.env by NAME only. Desktop 1440 (both themes for the
 * skip-link contrast) + a 380px pass.
 *
 * Usage:
 *   SMOKE_PREVIEW_URL="https://<immutable-deployment>.vercel.app" \
 *     node --env-file=.env.local scripts/verification/smoke-a11y-h1-skiplink.mjs
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
  stamp,
} from './lib/walk-helpers.mjs';

const BASE = (process.env.SMOKE_PREVIEW_URL || process.env.SMOKE_BASE_URL || '')
  .replace(/\/+$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS = process.env.A11Y_AGENT_PASSWORD;

if (!BASE || !TOKEN || !EMAIL || !PASS) {
  console.error('MISSING ENV: need SMOKE_PREVIEW_URL, VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD');
  process.exit(2);
}

const results = [];
const pass = (id, msg) => { results.push({ id, ok: true, msg }); console.log(`[${stamp()}] PASS ${id} — ${msg}`); };
const fail = (id, msg) => { results.push({ id, ok: false, msg }); console.log(`[${stamp()}] FAIL ${id} — ${msg}`); };

// tabId → expected h1 label (from navConfig AGENT_NAV).
const SCREENS = [
  { tab: 'agent-tab-awards', label: 'Awards' },
  { tab: 'agent-tab-game-plan', label: 'Game Plan' },
  { tab: 'agent-tab-commission', label: 'Commission' },
  { tab: 'agent-tab-history', label: 'History' },
];

async function h1Texts(page) {
  return page.locator('h1').evaluateAll((els) => els.map((e) => (e.textContent || '').trim()));
}

async function runLeg(browser, { theme, viewport, mobile }) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  let capture;
  try {
    await setupBypassSession(context, BASE, TOKEN);
    const page = await context.newPage();
    capture = captureConsoleAndNetwork(page);
    await loginAs(page, BASE, EMAIL, PASS);
    if (theme === 'dark') {
      await page.evaluate(() => localStorage.setItem('agencytrack-dark', '1'));
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await page.waitForSelector('.topbar-title', { timeout: 10000 });

    // 1. Skip link is the first Tab stop, and activating it focuses <main>.
    await page.evaluate(() => { document.body.focus(); if (document.activeElement) document.activeElement.blur(); });
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() => {
      const el = document.activeElement;
      return { text: (el?.textContent || '').trim(), cls: el?.className || '', tag: el?.tagName };
    });
    if (/skip to main content/i.test(firstFocus.text) && /skip-link/.test(firstFocus.cls)) {
      pass(`${theme}-skiplink-first`, 'first Tab stop is the skip link');
    } else {
      fail(`${theme}-skiplink-first`, `first Tab stop was <${firstFocus.tag}> "${firstFocus.text.slice(0, 40)}" (cls="${firstFocus.cls}")`);
    }
    // Activating it moves focus into the main landmark.
    await page.keyboard.press('Enter');
    const afterActivate = await page.evaluate(() => {
      const el = document.activeElement;
      return { id: el?.id || '', tag: el?.tagName };
    });
    if (afterActivate.id === 'main-content') pass(`${theme}-skiplink-target`, 'activating skip link focuses #main-content');
    else fail(`${theme}-skiplink-target`, `focus after activate was <${afterActivate.tag}> id="${afterActivate.id}"`);

    // Skip-link contrast (computed, focused state visible): fg vs bg differ.
    const colors = await page.evaluate(() => {
      const a = document.querySelector('.skip-link');
      if (!a) return null;
      a.focus();
      const cs = getComputedStyle(a);
      return { color: cs.color, bg: cs.backgroundColor };
    });
    if (colors && colors.color !== colors.bg) pass(`${theme}-skiplink-contrast`, `fg ${colors.color} vs bg ${colors.bg} (distinct)`);
    else fail(`${theme}-skiplink-contrast`, `skip-link colors not resolvable/distinct: ${JSON.stringify(colors)}`);

    // On mobile the sidebar tabs are hidden (reached via bottom-nav/More), so
    // just assert the landing screen has a topbar <h1> (A11Y-001 holds at 380px).
    if (mobile) {
      const titleEl = await page.evaluate(() => {
        const h = document.querySelector('.topbar-title');
        return { tag: h?.tagName, text: (h?.textContent || '').trim() };
      });
      if (titleEl.tag === 'H1' && titleEl.text.length > 0) pass(`${theme}-h1-landing`, `topbar <h1> = "${titleEl.text}" at 380px`);
      else fail(`${theme}-h1-landing`, `expected non-empty <h1>, got <${titleEl.tag}> "${titleEl.text}"`);
      const errsM = capture.consoleMessages.filter((m) => m.type === 'error');
      if (errsM.length === 0) pass(`${theme}-console`, '0 console errors');
      else fail(`${theme}-console`, `${errsM.length} console errors: ${errsM.map((e) => e.text).slice(0, 3).join(' | ')}`);
      return;
    }

    // 2 + 3. Per-screen dynamic h1 (desktop — sidebar tabs visible).
    for (const { tab, label } of SCREENS) {
      await page.locator(`[data-testid="${tab}"]`).first().click({ timeout: 6000 });
      await page.waitForFunction(
        (expected) => {
          const h = document.querySelector('.topbar-title');
          return !!h && h.tagName === 'H1' && (h.textContent || '').trim() === expected;
        },
        label,
        { timeout: 8000 },
      ).catch(() => {});
      const titleEl = await page.evaluate(() => {
        const h = document.querySelector('.topbar-title');
        return { tag: h?.tagName, text: (h?.textContent || '').trim() };
      });
      const all = await h1Texts(page);
      if (titleEl.tag === 'H1' && titleEl.text === label) {
        pass(`${theme}-h1-${label}`, `topbar <h1> = "${label}" (${all.length} h1 total on screen)`);
      } else {
        fail(`${theme}-h1-${label}`, `expected <h1> "${label}", got <${titleEl.tag}> "${titleEl.text}"`);
      }
    }

    const errs = capture.consoleMessages.filter((m) => m.type === 'error');
    if (errs.length === 0) pass(`${theme}-console`, '0 console errors');
    else fail(`${theme}-console`, `${errs.length} console errors: ${errs.map((e) => e.text).slice(0, 3).join(' | ')}`);
  } catch (e) {
    fail(`${theme}-leg`, `unexpected error: ${e.message}`);
  } finally {
    if (capture) console.log(formatCaptureReport(capture));
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch();
  try {
    await runLeg(browser, { theme: 'light', viewport: { width: 1440, height: 900 } });
    await runLeg(browser, { theme: 'dark', viewport: { width: 1440, height: 900 } });
    await runLeg(browser, { theme: 'mobile', viewport: { width: 380, height: 820 }, mobile: true });
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log('\n════════ SUMMARY ════════');
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.id} — ${r.msg}`);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => { console.error('SMOKE CRASH:', e.message); process.exit(1); });

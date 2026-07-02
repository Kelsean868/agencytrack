// commission-dark-contrast-smoke.mjs — Phase 5 regression smoke for the
// commission dark-mode color-contrast fix (GoalDecompositionTab).
//
// READ-ONLY (no Firestore writes). E3 credential (AGENT).
// PR #771's dark-leg trust repair surfaced 8 real color-contrast nodes in dark
// mode: `text-primary dark:text-primary-dark` text spans rendering the un-lifted
// teal #01696f (2.33–2.50:1) on GoalDecompositionTab. The fix deletes the
// `dark:text-primary-dark` override so bare `text-primary` (= #4ab5b8 lifted in
// dark, 6.14–6.61:1) renders. This smoke proves the regression is cleared.
//
// Per theme (dark asserts the fix; light asserts no regression):
//   Leg DEFAULT — Commission tab → GoalDecomposition (default 'goal' tab). Run
//                 axe; color-contrast serious/critical nodes (minus bell-badge
//                 baseline) == 0. Dark is the fix proof; light is the guard.
//   Leg DIALOG  — open the confirm dialog (fill income → "Save as My Goals";
//                 this only sets showConfirm — NO write). Renders the :359/:360
//                 confirm-dialog spans (a conditional touched site). Run axe;
//                 0 new color-contrast nodes.
//   Leg SS      — §2 screenshot per theme.
//
// NOT covered (named residual, see FOLLOW_UPS): the history pill (:151) needs
// ≥8 submitted weeks (hasHistory) to render — not seeded here. Its class was
// fixed by the same atomic substring replacement (verified in the diff) and its
// bg-primary/10 pairing is math-locked in contrast.test.js.
//
//   node scripts/verification/commission-dark-contrast-smoke.mjs [--url=<preview>|--prod]

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  waitForTheme,
  safeLog,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  stamp,
} from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

installGlobalTimeout(10 * 60 * 1000);

const require = createRequire(import.meta.url);
const { AxeBuilder } = require('../../node_modules/@axe-core/playwright');

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) if (!(k in process.env)) process.env[k] = env[k];
const need = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var: ${k}`); return v; };

const TOKEN       = need('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = need('A11Y_AGENT_EMAIL');
const AGENT_PASS  = need('A11Y_AGENT_PASSWORD');
const BASE_URL    = resolveSmokeBaseUrl({});
const VIEWPORT    = { width: 1280, height: 900 };
const SS_DIR      = resolve('verification', 'commission-dark-contrast-smoke');
mkdirSync(SS_DIR, { recursive: true });

const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

// bell-badge-only allowlist (pre-existing approved baseline — same as commission smokes)
const SERIOUS_ALLOWLIST = [
  { test: (h) => /\babsolute\b/.test(h) && /bg-danger/.test(h) && /text-white/.test(h) },
];
const isAllowlisted = (n) => {
  const h = (n.html || '') + ' ' + (n.target || []).join(' ');
  return SERIOUS_ALLOWLIST.some((e) => e.test(h));
};

async function loginAsAgent(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 25_000 });
  safeLog('[auth] agent logged in');
}

// Run axe, return the color-contrast nodes that are NOT allowlisted.
async function contrastNodes(page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const cc = res.violations.find((v) => v.id === 'color-contrast');
  if (!cc) return [];
  return cc.nodes.filter((n) => !isAllowlisted(n));
}

async function runTheme(browser, theme) {
  console.log(`\n=== ${theme.toUpperCase()} MODE ===`);
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, BASE_URL, TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await setTheme(context, theme);           // literal string; prime before nav
    await loginAsAgent(page);

    await page.click('[data-testid="agent-tab-commission"]');
    await page.waitForTimeout(3000);
    await waitForTheme(page, theme);           // assert the applied theme before axe

    // ── Leg DEFAULT ──────────────────────────────────────────────────────────
    const goalTabActive = await page.evaluate(() => {
      const t = [...document.querySelectorAll('[role="tab"]')].find((el) => /goal|decomp/i.test(el.textContent || ''));
      return t ? t.getAttribute('aria-selected') === 'true' : false;
    });
    record(`${theme}-goal-tab-active`, goalTabActive, goalTabActive ? 'GoalDecomposition (default tab) active' : 'goal tab not active');

    const defaultNodes = await contrastNodes(page);
    record(`${theme}-default-contrast`, defaultNodes.length === 0,
      defaultNodes.length === 0
        ? '0 color-contrast nodes on default ladder'
        : `${defaultNodes.length} color-contrast node(s): ${defaultNodes.slice(0, 3).map((n) => (n.html || '').slice(0, 60)).join(' | ')}`);

    // ── Leg DIALOG (renders :359/:360; no write) ─────────────────────────────
    // Fill income → click "Save as My Goals" (handleRequestConfirm only sets
    // showConfirm=true; the Firestore write is gated behind "Set as my goal",
    // which we never click).
    let dialogOpened = false;
    try {
      await page.waitForSelector('#gdt-income-goal-ttd', { timeout: 8000 });
      await page.fill('#gdt-income-goal-ttd', '250000');
      await page.waitForTimeout(500);
      await page.click('[data-testid="commission-save-goal-btn"]');
      await page.waitForTimeout(600);
      dialogOpened = await page.isVisible('[data-testid="commission-confirm-dialog"]');
    } catch (e) {
      safeLog(`[dialog] could not open confirm dialog: ${e.message}`);
    }
    record(`${theme}-dialog-opens`, dialogOpened, dialogOpened ? 'confirm dialog open (no write)' : 'confirm dialog did not open');

    if (dialogOpened) {
      const dialogNodes = await contrastNodes(page);
      record(`${theme}-dialog-contrast`, dialogNodes.length === 0,
        dialogNodes.length === 0
          ? '0 color-contrast nodes with confirm dialog open (:359/:360 clear)'
          : `${dialogNodes.length} color-contrast node(s): ${dialogNodes.slice(0, 3).map((n) => (n.html || '').slice(0, 60)).join(' | ')}`);
      // Cancel the dialog (no write path touched)
      const cancel = await page.$('[data-testid="commission-confirm-cancel"]');
      if (cancel) await cancel.click();
    }

    // ── Leg SS ────────────────────────────────────────────────────────────────
    await page.screenshot({ path: resolve(SS_DIR, `commission-dark-contrast-${theme}.png`), fullPage: false });
    record(`${theme}-screenshot`, true, 'saved to verification/commission-dark-contrast-smoke/');

    console.log(formatCaptureReport(capture));
  } catch (err) {
    record(`${theme}-fatal`, false, `exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

console.log(`\ncommission-dark-contrast smoke → ${BASE_URL}`);
const browser = await chromium.launch({ headless: true });
try {
  await runTheme(browser, 'dark');   // fix proof first
  await runTheme(browser, 'light');  // no-regression guard
} finally {
  await browser.close();
}
finishSmoke(results);

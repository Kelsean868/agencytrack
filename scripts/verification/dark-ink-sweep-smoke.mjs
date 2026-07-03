// dark-ink-sweep-smoke.mjs — Phase 5 regression smoke for the repo-wide
// dark:text-primary-dark-as-text sweep (FU of PR #773).
//
// READ-ONLY (no Firestore writes; the GoalsPanel LockToggle click only flips
// local component state — Save is never clicked). BRANCH MANAGER credential.
//
// GoalsPanel.jsx carried 7 of the 24 swept sites (LockedBadge, LockToggle
// active label, three locked banners, "(locked)" inline, Set-target outline
// button). This smoke renders the manager Goals surface + the Unit locked
// banner in BOTH themes and proves:
//   Leg NAV     — Goals tab reachable, GoalsPanel sub-tabs render.
//   Leg AXE-1   — axe color-contrast on the default Goals view: 0 serious
//                 nodes (bell-badge baseline allowlisted).
//   Leg BANNER  — Unit sub-tab → click "Lock" (local state only) → the locked
//                 banner (swept site, ex-GoalsPanel:325) renders; VALUE-LEVEL:
//                 its computed color is the lifted teal rgb(74, 181, 184) in
//                 dark (was un-lifted rgb(1, 105, 111) pre-sweep) and
//                 rgb(1, 105, 111) in light (unchanged).
//   Leg AXE-2   — axe color-contrast with the banner rendered: 0 serious.
//   Leg SS      — §2 screenshot per theme.
//
//   SMOKE_BASE_URL=<preview> node scripts/verification/dark-ink-sweep-smoke.mjs

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

const TOKEN    = need('VERCEL_BYPASS_TOKEN');
const BM_EMAIL = need('A11Y_BRANCH_MANAGER_EMAIL');
const BM_PASS  = need('A11Y_BRANCH_MANAGER_PASSWORD');
const BASE_URL = resolveSmokeBaseUrl({});
const VIEWPORT = { width: 1440, height: 900 };
const SS_DIR   = resolve('verification', 'dark-ink-sweep-smoke');
mkdirSync(SS_DIR, { recursive: true });

// Expected computed colors of the swept banner text (see src/index.css):
//   dark  → bare text-primary lifts to --primary-channels 74 181 184
//   light → text-primary stays --primary-channels 1 105 111
const EXPECTED_COLOR = {
  dark:  'rgb(74, 181, 184)',
  light: 'rgb(1, 105, 111)',
};

const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

// bell-badge-only allowlist (pre-existing approved baseline)
const isAllowlisted = (n) => {
  const h = (n.html || '') + ' ' + (n.target || []).join(' ');
  return /\babsolute\b/.test(h) && /bg-danger/.test(h) && /text-white/.test(h);
};

async function contrastNodes(page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const cc = res.violations.find((v) => v.id === 'color-contrast');
  if (!cc) return [];
  return cc.nodes.filter((n) => !isAllowlisted(n));
}

async function loginAsBM(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', BM_EMAIL);
  await page.fill('input[type="password"]', BM_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 25_000 });
  safeLog('[auth] BM logged in');
}

// Producing-manager (BM) sidebar renders the manager Goals item as
// "Team Goals" + TEAM scope chip with data-testid="nav-goals" (probed on the
// preview — label-text matching is ambiguous vs the "Goals MINE" mp-goals
// item, so navigate by testid).
async function clickManagerNavTab(page, testid) {
  const btn = page.locator(`[data-testid="${testid}"]`).first();
  await btn.waitFor({ timeout: 10_000 });
  await btn.click();
  await page.waitForTimeout(800);
}

async function runTheme(browser, theme) {
  console.log(`\n=== ${theme.toUpperCase()} MODE ===`);
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, BASE_URL, TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await setTheme(context, theme);
    await loginAsBM(page);
    await clickManagerNavTab(page, 'nav-goals');
    await waitForTheme(page, theme);

    // ── Leg NAV ──────────────────────────────────────────────────────────────
    const subTab = page.locator('[role="tab"]').first();
    let navOk = false;
    try { await subTab.waitFor({ timeout: 10_000 }); navOk = true; } catch { /* recorded below */ }
    record(`${theme}-goals-nav`, navOk, navOk ? 'GoalsPanel sub-tabs rendered' : 'GoalsPanel sub-tabs did not render');

    // ── Leg AXE-1: default Goals view ────────────────────────────────────────
    const nodes1 = await contrastNodes(page);
    record(`${theme}-goals-default-contrast`, nodes1.length === 0,
      nodes1.length === 0
        ? '0 color-contrast nodes on default Goals view'
        : `${nodes1.length} node(s): ${nodes1.slice(0, 3).map((n) => (n.html || '').slice(0, 70)).join(' | ')}`);

    // ── Leg BANNER: Unit sub-tab → Lock (local state) → swept banner ─────────
    let bannerColor = null;
    try {
      const unitTab = page.locator('[role="tab"]', { hasText: /^Unit$/i }).first();
      await unitTab.waitFor({ timeout: 8_000 });
      await unitTab.click();
      await page.waitForTimeout(800);
      const lockBtn = page.locator('button', { hasText: /^\s*Lock\s*$/ }).first();
      await lockBtn.waitFor({ timeout: 10_000 });
      await lockBtn.click(); // local setLocked(true) — NO write; Save never clicked
      const banner = page.locator('text=must meet or exceed this unit target').first();
      await banner.waitFor({ timeout: 5_000 });
      bannerColor = await banner.evaluate((el) => getComputedStyle(el).color);
    } catch (e) {
      safeLog(`[banner] could not render locked banner: ${e.message}`);
    }
    record(`${theme}-locked-banner-color`, bannerColor === EXPECTED_COLOR[theme],
      bannerColor === EXPECTED_COLOR[theme]
        ? `banner computed color == ${EXPECTED_COLOR[theme]} (value-level, swept site ex-GoalsPanel:325)`
        : `expected ${EXPECTED_COLOR[theme]}, got ${bannerColor ?? 'no banner rendered'}`);

    // ── Leg AXE-2: with the swept banner rendered ────────────────────────────
    if (bannerColor !== null) {
      const nodes2 = await contrastNodes(page);
      record(`${theme}-locked-banner-contrast`, nodes2.length === 0,
        nodes2.length === 0
          ? '0 color-contrast nodes with locked banner rendered'
          : `${nodes2.length} node(s): ${nodes2.slice(0, 3).map((n) => (n.html || '').slice(0, 70)).join(' | ')}`);
    }

    // ── Leg SS ───────────────────────────────────────────────────────────────
    await page.screenshot({ path: resolve(SS_DIR, `dark-ink-sweep-${theme}.png`), fullPage: false });
    record(`${theme}-screenshot`, true, 'saved to verification/dark-ink-sweep-smoke/');

    console.log(formatCaptureReport(capture));
  } catch (err) {
    record(`${theme}-fatal`, false, `exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

console.log(`\ndark-ink-sweep smoke → ${BASE_URL}`);
const browser = await chromium.launch({ headless: true });
try {
  await runTheme(browser, 'dark');   // fix proof first
  await runTheme(browser, 'light');  // no-regression guard
} finally {
  await browser.close();
}
finishSmoke(results);

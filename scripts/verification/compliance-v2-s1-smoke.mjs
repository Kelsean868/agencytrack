// compliance-v2-s1-smoke.mjs — Phase 5 smoke for Compliance v2 Slice 1
// (feat/compliance-v2-s1 — filing reality bar + exception list + streak roster).
//
// READ-ONLY. No writes, no Admin SDK mutation, no cleanup beyond the browser
// session. Uses setupBypassSession — token never in a bare URL after handshake.
//
// Per leg (both themes: light + dark):
//   1. Reality bar present; its stat chips (filed/on-time/late/not-in) are
//      CONSISTENT with the rendered roster — recompute from each row's
//      data-status and assert bar == roster-derived (the brief's core check).
//   2. Exception list count == the not-in count derived from the roster.
//   3. Streak chips render on roster rows (source-aware: presence only, no
//      specific value required — preview data state varies).
//   4. CBTT section present (regulatory section kept).
//   5. Row click opens the SHARED coaching drawer (role=dialog), then closes.
//   6. axe serious/critical on the Compliance surface (fail on critical; list
//      serious for dispatcher §6 / NO-NEW-vs-main triage) + 0 console errors.
//   7. Screenshot each theme.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
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

const PREVIEW_HOST =
  process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-compliance-v2-s1-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 1280, height: 900 };
const SS_DIR = resolve('verification', 'compliance-v2-s1-smoke');
mkdirSync(SS_DIR, { recursive: true });

const { AxeBuilder } = require('../../node_modules/@axe-core/playwright');

const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

// Enumerate-and-accept (the S3b lesson — never exclude-and-hope). Every serious
// color-contrast node MUST match one documented signature; any unlisted serious
// node FAILS the leg. These are the shared-chrome danger/warning text-on-tint
// family tracked by the contrast-debt FOLLOW_UP (token-level fix, app-wide) +
// the pre-existing notification-bell badge. NOT new to this surface.
const SERIOUS_ALLOWLIST = [
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

// Parse the leading integer from a stat's data-value (filed = "24 / 28 · 86%").
const firstInt = (s) => {
  const m = String(s ?? '').match(/-?\d+/);
  return m ? parseInt(m[0], 10) : NaN;
};

async function runTheme(context, theme) {
  console.log(`\n── Theme: ${theme} ──`);
  await setTheme(context, theme);
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // Known-noise filter (matches the .map/.ico precedent in captureConsoleAndNetwork):
    // the Fontshare CDN (Satoshi/Cabinet Grotesk) CORS-blocks its stylesheet app-wide —
    // present on main, every page; not introduced by this surface.
    const text = msg.text() ?? '';
    const url = (typeof msg.location === 'function' ? msg.location()?.url : '') ?? '';
    if (/fontshare/i.test(text) || /fontshare/i.test(url)) return;
    consoleErrors.push(text);
  });

  await loginAsManager(page);
  await navigateToCompliance(page);
  await page.screenshot({ path: resolve(SS_DIR, `${theme}-compliance.png`), fullPage: true });

  // ── Leg 1: reality bar consistent with roster ──────────────────────────────
  const bar = {
    filed:  firstInt(await page.getAttribute('[data-testid="compliance-stat-filed"]', 'data-value')),
    onTime: firstInt(await page.getAttribute('[data-testid="compliance-stat-ontime"]', 'data-value')),
    late:   firstInt(await page.getAttribute('[data-testid="compliance-stat-late"]', 'data-value')),
    notIn:  firstInt(await page.getAttribute('[data-testid="compliance-stat-notin"]', 'data-value')),
  };
  const total = firstInt((await page.getAttribute('[data-testid="compliance-stat-filed"]', 'data-value'))?.split('/')[1]);

  const rowStatuses = await page.$$eval('[data-testid="compliance-roster-row"]',
    (rows) => rows.map((r) => r.getAttribute('data-status')));
  const derived = {
    onTime: rowStatuses.filter((s) => s === 'on-time').length,
    late:   rowStatuses.filter((s) => s === 'late').length,
    notIn:  rowStatuses.filter((s) => s === 'not-in').length,
  };
  derived.filed = derived.onTime + derived.late;

  const consistent =
    bar.onTime === derived.onTime &&
    bar.late === derived.late &&
    bar.notIn === derived.notIn &&
    bar.filed === derived.filed &&
    total === rowStatuses.length;
  record(`Leg 1 (${theme})`, consistent,
    consistent
      ? `bar == roster: filed ${bar.filed}/${total}, on-time ${bar.onTime}, late ${bar.late}, not-in ${bar.notIn} (${rowStatuses.length} rows)`
      : `MISMATCH bar=${JSON.stringify(bar)} total=${total} vs roster=${JSON.stringify(derived)} rows=${rowStatuses.length}`);

  // ── Leg 2: exception count == not-in ───────────────────────────────────────
  const exCount = await page.$$eval('[data-testid="compliance-exception-row"]', (r) => r.length);
  // When zero exceptions the list shows an "Everyone's in" collapse (0 rows).
  record(`Leg 2 (${theme})`, exCount === derived.notIn,
    `exception rows ${exCount} == not-in ${derived.notIn}`);

  // ── Leg 3: streak chips render (source-aware) ──────────────────────────────
  if (rowStatuses.length > 0) {
    const hasStreak = await page.locator('[data-testid="compliance-roster-row"]').first()
      .locator('text=/\\d+ wk/').count();
    record(`Leg 3 (${theme})`, hasStreak > 0,
      hasStreak > 0 ? 'streak chip present on first roster row' : 'no streak chip found (sm+ viewport expected)');
  } else {
    record(`Leg 3 (${theme})`, true, 'no roster rows in preview data — streak check skipped (source-aware)');
  }

  // ── Leg 4: CBTT section present ─────────────────────────────────────────────
  const cbtt = await page.locator('[data-testid="compliance-cbtt-section"]').count();
  record(`Leg 4 (${theme})`, cbtt > 0, cbtt > 0 ? 'CBTT section present' : 'CBTT section MISSING');

  // ── Leg 5: row click opens shared coaching drawer ──────────────────────────
  if (rowStatuses.length > 0) {
    await page.locator('[data-testid="compliance-roster-row"]').first().click();
    const drawer = await page.waitForSelector('[role="dialog"][aria-labelledby="coaching-notes-title"]', { timeout: 8000 })
      .then(() => true).catch(() => false);
    record(`Leg 5 (${theme})`, drawer, drawer ? 'coaching drawer opened on row click' : 'drawer did NOT open');
    if (drawer) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  } else {
    record(`Leg 5 (${theme})`, true, 'no roster rows — drawer click skipped (source-aware)');
  }

  // ── Leg 6: axe (allowlist-asserted) + console errors ───────────────────────
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const crit = axe.violations.filter((v) => v.impact === 'critical');
  const seriousNodes = axe.violations
    .filter((v) => v.impact === 'serious')
    .flatMap((v) => v.nodes.map((n) => ({ id: v.id, html: n.html ?? '', target: n.target })));
  const unexpected = seriousNodes.filter((n) => !SERIOUS_ALLOWLIST.some((a) => a.test(n.html)));
  record(`Leg 6 axe (${theme})`, crit.length === 0 && unexpected.length === 0,
    `critical: ${crit.length}${crit.length ? ` [${crit.map((v) => v.id).join(', ')}]` : ''} · serious: ${seriousNodes.length} (allowlisted ${seriousNodes.length - unexpected.length}, unexpected ${unexpected.length})` +
    (unexpected.length ? ` → NEW: ${unexpected.map((n) => `${n.id}@${JSON.stringify(n.target)}`).join('; ')}` : ''));
  record(`Leg 6 console (${theme})`, consoleErrors.length === 0,
    consoleErrors.length === 0 ? '0 console errors (Fontshare CORS filtered)' : `${consoleErrors.length} console error(s): ${consoleErrors.slice(0, 3).join(' | ')}`);

  await page.close();
}

async function main() {
  console.log('Compliance v2 S1 — read-only smoke (BM credential, both themes)');
  safeLog('Preview host:', PREVIEW_HOST);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      await setupBypassSession(context, PREVIEW_URL, TOKEN);
      await runTheme(context, theme);
      await context.close();
    }
  } finally {
    await browser.close();
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

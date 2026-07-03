/**
 * smoke-financing-escalation-k10b.mjs — PRE-MERGE, UI-LEVEL smoke for Track K · K10b
 * (financingEscalations: UM "Flag to BM" + BM inbox subview).
 *
 * ── Rule 13 waiver (unmissable): the WRITE path (raise → read → ack) CANNOT be
 *    smoked pre-merge — the financingEscalations rules + composite index are not
 *    deployed until Kyron runs `firebase deploy --only firestore:rules,firestore:indexes`
 *    AFTER merge. This smoke therefore asserts ONLY UI wiring:
 *      A) UM: roster flag actions present; drawer Flag-to-BM is a LIVE control that
 *         opens the escalation form (reason select + note). NO submit.
 *      B) UM gate: the BM-only Financing tab is NOT reachable for a UM (existing gate).
 *      C) BM: the Financing → Escalations subview mounts the inbox component (pre-deploy
 *         its branch query is rules-denied → error/empty state — MOUNT is what we prove).
 *    The full write-read-ack cycle is a POST-DEPLOY deferred-verification FU (see
 *    docs/FOLLOW_UPS.md) — run against tatillife_smoke once rules + index are live.
 *
 * Prereq (UM roster rows): reuse the K10a fixture —
 *   node scripts/verification/seed-unit-financing-k10a.mjs --apply
 * then run (from the main worktree, .env.local present):
 *   SMOKE_BASE_URL="https://agencytrack-git-<branch>-kyron-marchan-s-projects.vercel.app" \
 *     node scripts/verification/smoke-financing-escalation-k10b.mjs
 * cleanup:
 *   node scripts/verification/seed-unit-financing-k10a.mjs --cleanup
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  waitForLoaded,
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

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var: ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) throw new Error('Set SMOKE_BASE_URL to the preview (or prod) URL');

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };
const count = (page, sel) => page.locator(sel).count();

async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2000);
}

async function clickNav(page, ids) {
  for (const id of ids) {
    const loc = page.locator(`[data-testid="${id}"]`);
    if (await loc.count() > 0) { await loc.first().click(); return true; }
  }
  // workspace-layout fallback: switch to the My Team workspace, then retry.
  const toggle = page.locator('[data-testid="sidebar-ws-team"], [data-testid="sidebar-ws-toggle-team"]');
  if (await toggle.count() > 0) { await toggle.first().click(); await page.waitForTimeout(400); }
  for (const id of ids) {
    const loc = page.locator(`[data-testid="${id}"]`);
    if (await loc.count() > 0) { await loc.first().click(); return true; }
  }
  return false;
}

// ── Leg A + B: the Unit Manager surface ──────────────────────────────────────
async function runUM(browser, theme) {
  const t = (id) => `${id}[${theme}]`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  await setTheme(ctx, theme);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try {
    await login(page, requireEnv('A11Y_UNIT_MANAGER_EMAIL'), requireEnv('A11Y_UNIT_MANAGER_PASSWORD'));
    pass(t('um-login'));
  } catch (e) { fail(t('um-login'), e.message); formatCaptureReport(cap); await ctx.close(); return; }

  // Leg B (gate): the BM-only Financing tab must NOT be reachable for a UM.
  (await count(page, '[data-testid="nav-financing"], [data-testid="pinned-financing"]')) === 0
    ? pass(t('B-um-no-bm-financing'), 'BM Financing tab absent for the UM (role gate)')
    : fail(t('B-um-no-bm-financing'), 'UM can see the BM Financing tab — role gate breached');

  if (!(await clickNav(page, ['pinned-unit-financing', 'nav-unit-financing']))) {
    fail(t('nav'), 'Unit Financing nav not reachable'); formatCaptureReport(cap); await ctx.close(); return;
  }
  const loaded = await waitForLoaded(page, 'unit-financing-roster', 20_000).then(() => true).catch(() => false);
  if (!loaded) { fail(t('load'), 'unit-financing-roster did not load'); formatCaptureReport(cap); await ctx.close(); return; }
  await page.waitForTimeout(800);

  // A1: risk-card "Flag to BM" actions present (the adj foil from the K10a fixture).
  (await count(page, '[data-testid="unit-financing-flag-adj-k10a_adj"]')) > 0
    ? pass(t('A1-riskcard-flag'), 'risk-card Flag-to-BM action present')
    : fail(t('A1-riskcard-flag'), 'risk-card Flag-to-BM action missing');

  // A2: open the read-only drawer → the footer Flag control is LIVE (not disabled).
  await page.locator('[data-testid="unit-financing-view-k10a_adj"]').first().click();
  const drawer = page.locator('[data-testid="unit-financing-drawer"]');
  await drawer.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  const flag = page.locator('[data-testid="unit-financing-drawer-flag"]');
  const flagLive = (await flag.count() > 0) && !(await flag.isDisabled());
  flagLive ? pass(t('A2-drawer-flag-live'), 'drawer Flag-to-BM is a live control')
    : fail(t('A2-drawer-flag-live'), 'drawer Flag-to-BM not a live control');

  // A3: clicking it opens the escalation FORM (reason select + note) — NO submit.
  if (flagLive) {
    await flag.click();
    const modal = page.locator('[data-testid="financing-escalation-modal"]');
    await modal.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const hasReason = (await count(page, '[data-testid="financing-escalation-reason"]')) > 0;
    const hasNote = (await count(page, '[data-testid="financing-escalation-note"]')) > 0;
    (hasReason && hasNote)
      ? pass(t('A3-escalation-form'), 'reason select + note form render')
      : fail(t('A3-escalation-form'), `reason=${hasReason} note=${hasNote}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  formatCaptureReport(cap);
  await ctx.close();
}

// ── Leg C: the Branch Manager inbox subview mounts ───────────────────────────
async function runBM(browser, theme) {
  const t = (id) => `${id}[${theme}]`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  await setTheme(ctx, theme);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try {
    await login(page, requireEnv('A11Y_BRANCH_MANAGER_EMAIL'), requireEnv('A11Y_BRANCH_MANAGER_PASSWORD'));
    pass(t('bm-login'));
  } catch (e) { fail(t('bm-login'), e.message); formatCaptureReport(cap); await ctx.close(); return; }

  if (!(await clickNav(page, ['pinned-financing', 'nav-financing']))) {
    fail(t('bm-nav'), 'BM Financing nav not reachable'); formatCaptureReport(cap); await ctx.close(); return;
  }
  await page.waitForTimeout(600);

  // C1: the Escalations subview tab exists on the BM Financing tab.
  const subview = page.locator('[data-testid="financing-subview-escalations"]');
  if (await subview.count() === 0) {
    fail(t('C1-subview-present'), 'financing-subview-escalations tab absent');
    formatCaptureReport(cap); await ctx.close(); return;
  }
  pass(t('C1-subview-present'), 'Escalations subview tab present');

  // C2: clicking it MOUNTS the inbox component (loading/error/empty are all fine
  //     pre-deploy — the branch query is rules-denied until the rules ship).
  await subview.first().click();
  const mounted = await page.locator('[data-testid="financing-escalation-inbox"]')
    .waitFor({ state: 'attached', timeout: 15_000 }).then(() => true).catch(() => false);
  mounted ? pass(t('C2-inbox-mounts'), 'FinancingEscalationInbox mounted (pre-deploy state)')
    : fail(t('C2-inbox-mounts'), 'inbox component did not mount');

  formatCaptureReport(cap);
  await ctx.close();
}

(async () => {
  console.log(`\nK10b financing-escalation PRE-MERGE UI smoke → ${BASE_URL}`);
  console.log('  (write path waived per Rule 13 — rules/index not deployed pre-merge)\n');
  const browser = await chromium.launch();
  try {
    await runUM(browser, 'light');
    await runUM(browser, 'dark');
    await runBM(browser, 'light');
    await runBM(browser, 'dark');
  } finally { await browser.close(); }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`));
    process.exit(1);
  }
  console.log('All legs green.');
})();

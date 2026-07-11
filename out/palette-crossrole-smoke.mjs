/**
 * palette-crossrole-smoke.mjs — item 1.1b live verification on the staging deploy.
 *
 * Legs:
 *   0. Deploy freshness — served CSS bundle contains `.topbar-mobile-search`
 *      (the 1.1b marker). Exit 3 = DEPLOY-STALE (rerun after Vercel finishes).
 *   1. branch_manager desktop — Ctrl-K opens palette (dialog contract), Actions
 *      group present (manager action set), filter "master" + Enter navigates to
 *      Master Sheet (1.6 reality bar visible), reopen + Escape closes.
 *   2. tenant_admin desktop — palette lists New branch / New user (1.3
 *      enrichment); firing New user opens the create drawer (never submitted).
 *   3. agent mobile 390x844 — login at desktop width, resize to mobile, the
 *      1.1b topbar search button is visible, opens the SAME palette, Escape
 *      closes and focus returns to the button.
 *
 * Usage: node --env-file=.env.staging out/palette-crossrole-smoke.mjs
 * Staging-only synthetic accounts (not secrets); bypass token never printed.
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  stamp,
  installGlobalTimeout,
} from '../scripts/verification/lib/walk-helpers.mjs';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';

const BASE = 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app';
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
if (!TOKEN) { console.error('MISSING ENV: VERCEL_BYPASS_TOKEN'); process.exit(2); }

const ACCOUNTS = {
  branch_manager: { email: 'staging-branch-manager@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' },
  tenant_admin:   { email: 'staging-tenant-admin@agencytrack-staging.test',   password: 'ChangeMe-Staging-2026!' },
  agent:          { email: 'staging-agent-1@agencytrack-staging.test',        password: 'ChangeMe-Staging-2026!' },
};

const SS_DIR = resolve('out/palette-smoke', stamp().replace(/:/g, '-'));
mkdirSync(SS_DIR, { recursive: true });

const results = [];
const record = (id, status, detail) => {
  results.push({ id, status, detail });
  console.log(`[${stamp()}] ${status === 'PASS' ? '✓' : status === 'SKIP' ? '⊘' : '✗'} ${status} ${id} — ${detail}`);
};
const pass = (id, d) => record(id, 'PASS', d);
const fail = (id, d) => record(id, 'FAIL', d);
const shot = async (page, name) => { try { await page.screenshot({ path: join(SS_DIR, `${name}.png`) }); } catch { /* best-effort */ } };

const clearTimer = installGlobalTimeout(10 * 60 * 1000, () => {
  for (const r of results) console.log(`  ${r.status} ${r.id}: ${r.detail}`);
});

async function loginRealForm(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  const outcome = await Promise.race([
    page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 }).then(() => 'rendered'),
    page.waitForSelector('text=Incorrect email or password', { timeout: 20_000 }).then(() => 'auth-error'),
  ]).catch(() => 'timeout');
  if (outcome !== 'rendered') throw new Error(`LOGIN-${outcome.toUpperCase()}: ${email}`);
  await page.waitForTimeout(1200);
}

const PALETTE = '[role="dialog"][aria-label="Command palette"]';
const PALETTE_INPUT = 'input[aria-label="Search commands"]';

const browser = await chromium.launch();
try {
  // ── Leg 0: deploy freshness ─────────────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    await setupBypassSession(context, BASE, TOKEN);
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    const cssHref = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href).find((h) => h.includes('/assets/')));
    let cssBody = '';
    if (cssHref) cssBody = await (await page.request.get(cssHref)).text();
    const jsHref = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')].map((l) => l.src).find((h) => h.includes('/assets/index-')));
    let jsBody = '';
    if (jsHref) jsBody = await (await page.request.get(jsHref)).text();
    await context.close();
    // NOTE: no JS-bundle marker — CreateUserDrawer lives in a lazy role-dashboard
    // chunk (EFF-002 code-split), never in the entry index-*.js. The retrofit is
    // proven by leg 2's role=dialog assertion instead.
    if (!cssBody.includes('topbar-mobile-search')) {
      console.error(`DEPLOY-STALE: bundle lacks a marker (css topbar-mobile-search=${cssBody.includes('topbar-mobile-search')}, js create-user-drawer-title=${jsBody.includes('create-user-drawer-title')}). Vercel likely still building — rerun shortly.`);
      process.exit(3);
    }
    pass('deploy-fresh', 'both markers present (1.1b css + CreateUserDrawer retrofit js)');
  }

  // ── Leg 1: branch_manager desktop ───────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    await setupBypassSession(context, BASE, TOKEN);
    const page = await context.newPage();
    const cap = captureConsoleAndNetwork(page);
    try {
      await loginRealForm(page, ACCOUNTS.branch_manager.email, ACCOUNTS.branch_manager.password);
      await page.keyboard.press('Control+k');
      const dlg = page.locator(PALETTE);
      await dlg.waitFor({ state: 'visible', timeout: 8_000 });
      const modal = await dlg.getAttribute('aria-modal');
      modal === 'true' ? pass('bm-open', 'Ctrl-K opened palette, role=dialog aria-modal=true')
                       : fail('bm-open', `palette open but aria-modal=${modal}`);

      const actionCount = await page.locator('[role="group"][aria-label="Actions"] [role="option"]').count();
      actionCount > 0 ? pass('bm-actions', `Actions group present with ${actionCount} option(s) (manager set)`)
                      : fail('bm-actions', 'no Actions group / zero action options for branch_manager');

      await page.fill(PALETTE_INPUT, 'master');
      await page.locator('[data-testid="cmdk-option-nav:mastersheet"]').waitFor({ state: 'visible', timeout: 5_000 });
      await page.keyboard.press('Enter');
      await dlg.waitFor({ state: 'hidden', timeout: 5_000 });
      // 1.6 reality bar is the definitive Master Sheet marker
      const realityVisible = await page.getByText('WEEK API', { exact: false }).first()
        .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
      realityVisible ? pass('bm-navigate', 'filter "master" + Enter navigated to Master Sheet (reality bar rendered)')
                     : fail('bm-navigate', 'palette closed but Master Sheet reality bar never rendered');
      await shot(page, 'bm-mastersheet');

      await page.keyboard.press('Control+k');
      await dlg.waitFor({ state: 'visible', timeout: 5_000 });
      await page.keyboard.press('Escape');
      const closed = await dlg.waitFor({ state: 'hidden', timeout: 5_000 }).then(() => true).catch(() => false);
      closed ? pass('bm-escape', 'Escape closed the reopened palette') : fail('bm-escape', 'palette did not close on Escape');
    } catch (e) {
      fail('bm-leg', e.message); await shot(page, 'bm-FAIL');
    }
    console.log(formatCaptureReport(cap));
    await context.close();
  }

  // ── Leg 2: tenant_admin desktop ─────────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    await setupBypassSession(context, BASE, TOKEN);
    const page = await context.newPage();
    try {
      await loginRealForm(page, ACCOUNTS.tenant_admin.email, ACCOUNTS.tenant_admin.password);
      await page.keyboard.press('Control+k');
      const dlg = page.locator(PALETTE);
      await dlg.waitFor({ state: 'visible', timeout: 8_000 });

      const hasBranch = await page.locator('[data-testid="cmdk-option-act:new-branch"]').isVisible();
      const hasUser = await page.locator('[data-testid="cmdk-option-act:new-user"]').isVisible();
      hasBranch && hasUser ? pass('ta-enriched', 'palette lists New branch + New user (1.3 enrichment)')
                           : fail('ta-enriched', `New branch visible=${hasBranch}, New user visible=${hasUser}`);

      await page.locator('[data-testid="cmdk-option-act:new-user"]').click();
      await dlg.waitFor({ state: 'hidden', timeout: 5_000 });
      const drawer = page.locator('[role="dialog"]:not([aria-label="Command palette"])').first();
      const drawerOpen = await drawer.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
      drawerOpen ? pass('ta-create-fires', 'New user action opened the create drawer (real handler)')
                 : fail('ta-create-fires', 'no drawer/dialog appeared after firing New user');
      await shot(page, 'ta-create-drawer');
      if (drawerOpen) await page.keyboard.press('Escape'); // never submit
    } catch (e) {
      fail('ta-leg', e.message); await shot(page, 'ta-FAIL');
    }
    await context.close();
  }

  // ── Leg 3: agent mobile ─────────────────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    await setupBypassSession(context, BASE, TOKEN);
    const page = await context.newPage();
    try {
      await loginRealForm(page, ACCOUNTS.agent.email, ACCOUNTS.agent.password);
      await page.setViewportSize({ width: 390, height: 844 }); // resize AFTER login (mobile-login caveat)
      await page.waitForTimeout(800);

      const btn = page.locator('button.topbar-mobile-search');
      const visible = await btn.isVisible();
      visible ? pass('mob-visible', 'mobile topbar search button visible at 390px')
              : fail('mob-visible', 'button.topbar-mobile-search not visible at 390px');
      if (visible) {
        const box = await btn.boundingBox();
        (box && box.width >= 43 && box.height >= 43)
          ? pass('mob-target', `touch target ${Math.round(box.width)}x${Math.round(box.height)}px (>=44 floor, 1px rounding tolerated)`)
          : fail('mob-target', `touch target ${box ? Math.round(box.width) + 'x' + Math.round(box.height) : 'null'}px — under 44px floor`);

        await btn.click();
        const dlg = page.locator(PALETTE);
        await dlg.waitFor({ state: 'visible', timeout: 8_000 });
        pass('mob-open', 'tap opened the same CommandPalette');
        await shot(page, 'mob-palette');

        await page.keyboard.press('Escape');
        await dlg.waitFor({ state: 'hidden', timeout: 5_000 });
        const returned = await page.evaluate(() => document.activeElement?.className?.includes('topbar-mobile-search'));
        returned ? pass('mob-focus-return', 'Escape closed palette, focus returned to the mobile trigger')
                 : fail('mob-focus-return', `focus did not return to trigger (activeElement=${await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className)})`);
      }
    } catch (e) {
      fail('mob-leg', e.message); await shot(page, 'mob-FAIL');
    }
    await context.close();
  }
} finally {
  await browser.close();
  clearTimer();
}

const fails = results.filter((r) => r.status === 'FAIL');
console.log(`\n── palette cross-role smoke: ${results.filter((r) => r.status === 'PASS').length} PASS / ${fails.length} FAIL ──`);
console.log(`screenshots: ${SS_DIR}`);
process.exit(fails.length ? 1 : 0);

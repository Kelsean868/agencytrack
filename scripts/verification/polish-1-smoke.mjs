/**
 * polish-1 — Mobile UX + Toast primitive smoke walk.
 *
 * Verifies three user-surfaced fixes from the polish-1 PR:
 *   1. Mobile sign-out: ProfileScreen Account section exposes a working
 *      Sign Out button at 390x844 (the agent's expected viewport).
 *   2. Agent More drawer: bottom-nav exposes the More button; drawer holds
 *      Career, Awards, Persistency, Production Report; tap → navigation;
 *      backdrop + Escape dismiss.
 *   3. Kiosk toast: clicking copy on a kiosk URL fires the new Toast
 *      primitive ("Link copied" success variant). Mid-toast screenshot
 *      captured for PR proof.
 *
 * Plus a regression sweep: agent + manager top-level surfaces still render.
 *
 * Bypass: WALK-3 setupBypassSession pattern. Token in exactly ONE URL inside
 * the helper's sanitizing try/catch. After session setup all navigation uses
 * bare URLs.
 *
 * Run from the MAIN worktree (where .env.local lives):
 *   node scripts/verification/polish-1-smoke.mjs
 *
 * Override preview host:
 *   PREVIEW_HOST=agencytrack-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/polish-1-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD
 *   A11Y_SALES_MANAGER_EMAIL / A11Y_SALES_MANAGER_PASSWORD
 *
 * Artifacts: verification/polish-1/screenshots/ (gitignored).
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/polish-1');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const SM_EMAIL     = env.A11Y_SALES_MANAGER_EMAIL;
const SM_PASSWORD  = env.A11Y_SALES_MANAGER_PASSWORD;
const AG_EMAIL     = env.A11Y_AGENT_EMAIL;
const AG_PASSWORD  = env.A11Y_AGENT_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-polish-1-m-6c5779-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)             { console.error('VERCEL_BYPASS_TOKEN not present');                process.exit(1); }
if (!SM_EMAIL || !SM_PASSWORD) { console.error('A11Y_SALES_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }
if (!AG_EMAIL || !AG_PASSWORD) { console.error('A11Y_AGENT_EMAIL/PASSWORD not present');         process.exit(1); }

// Defense-in-depth redaction.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  if (BYPASS_TOKEN) out = out.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  if (SM_PASSWORD)  out = out.replace(new RegExp(SM_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  if (AG_PASSWORD)  out = out.replace(new RegExp(AG_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  return out;
}

const results = {};
const consoleErrors = [];
async function check(id, label, fn) {
  try {
    await fn();
    results[id] = { label, pass: true };
    console.log(`  ✓ ${id}: ${label}`);
  } catch (e) {
    const msg = redact(e?.message ?? String(e));
    results[id] = { label, pass: false, error: msg };
    console.error(`  ✗ ${id}: ${label} — ${msg}`);
  }
}

async function login(page, email, password, { mobile = false } = {}) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for a viewport-specific anchor.
  // - mobile: bottom-nav (sidebar exists in DOM but is display:none).
  // - desktop: sidebar profile testid.
  const anchor = mobile
    ? '[data-testid="bottomnav-profile"]'
    : '[data-testid="nav-profile"]';
  await page.waitForSelector(anchor, { timeout: 30_000 });
}

async function logoutViaCookieClear(context) {
  // Clear all cookies; firebase auth re-evaluates on next page load.
  await context.clearCookies();
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch();

  // ── Mobile context (390x844) for sign-out + drawer ─────────────────────────
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await setupBypassSession(mobileContext, BASE_URL, BYPASS_TOKEN);

  const mobilePage = await mobileContext.newPage();
  mobilePage.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[mobile] ${redact(m.text())}`);
  });

  console.log('\n── ISSUE 1 — Mobile sign-out (agent @ 390x844) ──');
  await login(mobilePage, AG_EMAIL, AG_PASSWORD, { mobile: true });

  // Navigate to Profile via mobile bottom-nav
  await mobilePage.click('[data-testid="bottomnav-profile"]');
  await mobilePage.waitForSelector('[data-testid="profile-sign-out"]', { timeout: 15_000 });
  await mobilePage.screenshot({
    path: resolve(SS_DIR, '01-mobile-profile-with-signout.png'),
    fullPage: false,
  });

  await check('mobile-signout-visible', 'Sign Out button visible at 390x844', async () => {
    const btn = await mobilePage.$('[data-testid="profile-sign-out"]');
    if (!btn) throw new Error('profile-sign-out testid missing');
    const box = await btn.boundingBox();
    if (!box) throw new Error('button has no bounding box');
    if (box.height < 44) throw new Error(`Sign Out button height ${box.height}px < 44px`);
    if (box.width < 44)  throw new Error(`Sign Out button width ${box.width}px < 44px`);
  });

  await check('mobile-signout-works', 'Click → user signed out → login form', async () => {
    await mobilePage.click('[data-testid="profile-sign-out"]');
    // Sign-out triggers AuthContext to render LoginScreen which has the email input
    await mobilePage.waitForSelector('input[type="email"]', { timeout: 15_000 });
  });
  await mobilePage.screenshot({
    path: resolve(SS_DIR, '02-mobile-after-signout.png'),
    fullPage: false,
  });

  // ── ISSUE 2 — Agent More drawer ──────────────────────────────────────────
  console.log('\n── ISSUE 2 — Agent More drawer ──');
  await login(mobilePage, AG_EMAIL, AG_PASSWORD, { mobile: true });

  await check('drawer-more-button-visible', 'Bottom-nav shows the More button', async () => {
    const more = await mobilePage.$('[data-testid="bottomnav-more"]');
    if (!more) throw new Error('bottomnav-more testid missing');
  });

  await mobilePage.click('[data-testid="bottomnav-more"]');
  await mobilePage.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  await mobilePage.screenshot({
    path: resolve(SS_DIR, '03-agent-more-drawer-open.png'),
    fullPage: false,
  });

  await check('drawer-items-correct', 'Drawer contains Career, Awards, Persistency, Production Report', async () => {
    const labels = await mobilePage.$$eval(
      'div[role="dialog"] nav button span',
      (nodes) => nodes.map((n) => n.textContent?.trim() ?? ''),
    );
    const expected = ['Career', 'Awards', 'Persistency', 'Production Report'];
    for (const e of expected) {
      if (!labels.includes(e)) throw new Error(`missing item: ${e} (found: ${labels.join(', ')})`);
    }
  });

  await check('drawer-tap-navigates', 'Tap Persistency → drawer dismisses + nav', async () => {
    // Click the Persistency item inside the drawer
    await mobilePage.click('div[role="dialog"] nav button:has-text("Persistency")');
    // Drawer should close
    await mobilePage.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5_000 });
    // Persistency tab should be active — agent persistency tab has a known testid
    await mobilePage.waitForSelector('[data-testid="agent-persistency-summary"], [data-testid="agent-persistency-edit-button"]', { timeout: 10_000 });
  });

  // Re-open drawer and confirm backdrop dismiss
  await mobilePage.click('[data-testid="bottomnav-more"]');
  await mobilePage.waitForSelector('[role="dialog"]');
  await check('drawer-backdrop-dismiss', 'Backdrop click dismisses drawer', async () => {
    await mobilePage.click('[data-testid="nav-drawer-backdrop"]');
    await mobilePage.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5_000 });
  });

  // Re-open drawer and confirm Escape dismiss
  await mobilePage.click('[data-testid="bottomnav-more"]');
  await mobilePage.waitForSelector('[role="dialog"]');
  await check('drawer-escape-dismiss', 'Escape key dismisses drawer', async () => {
    await mobilePage.keyboard.press('Escape');
    await mobilePage.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5_000 });
  });

  // ── Regression sweep — agent surfaces (mobile) ──────────────────────────
  console.log('\n── Regression — agent surfaces (mobile) ──');
  await mobilePage.click('[data-testid="bottomnav-home"]');
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: resolve(SS_DIR, '04-agent-home-mobile.png'), fullPage: false });

  await mobileContext.close();

  // ── Desktop context (1440x900) for Kiosk toast ──────────────────────────
  console.log('\n── ISSUE 3 — Kiosk toast (sales_manager @ desktop) ──');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await setupBypassSession(desktopContext, BASE_URL, BYPASS_TOKEN);

  const desktopPage = await desktopContext.newPage();
  desktopPage.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[desktop] ${redact(m.text())}`);
  });

  await login(desktopPage, SM_EMAIL, SM_PASSWORD);

  // Navigate to Kiosk via sidebar
  await desktopPage.click('[data-testid="nav-kiosk"]');
  await desktopPage.waitForSelector('text=Kiosk Mode', { timeout: 10_000 });
  await desktopPage.waitForTimeout(2000); // let token list load

  // If no tokens exist, generate one — that itself fires a success toast
  let copyButtons = await desktopPage.$$('button[title^="Copy URL"], button[title^="Copied"]');

  if (copyButtons.length === 0) {
    console.log('  → no existing tokens, generating one');
    await desktopPage.click('text=Generate URL');
    // Auto-copy fires a toast immediately. Wait for the toast container.
    await desktopPage.waitForSelector('[data-testid="toast-stack"]', { timeout: 10_000 });
    await desktopPage.screenshot({ path: resolve(SS_DIR, '05-kiosk-generate-toast.png'), fullPage: false });
    // Wait for the toast to dismiss before we try copy
    await desktopPage.waitForSelector('[data-testid="toast-stack"]', { state: 'detached', timeout: 10_000 });
    copyButtons = await desktopPage.$$('button[title^="Copy URL"], button[title^="Copied"]');
  }

  await check('kiosk-copy-toast-fires', 'Click Copy → success toast renders', async () => {
    if (copyButtons.length === 0) throw new Error('no copy button found after generate');
    await copyButtons[0].click();
    await desktopPage.waitForSelector('[data-testid="toast-success"]', { timeout: 5_000 });
  });

  await desktopPage.screenshot({ path: resolve(SS_DIR, '06-kiosk-copy-toast-mid.png'), fullPage: false });

  await check('kiosk-toast-message', 'Toast says "Link copied"', async () => {
    const text = await desktopPage.$eval('[data-testid="toast-success"]', (n) => n.textContent ?? '');
    if (!text.includes('Link copied')) throw new Error(`toast text was: ${text}`);
  });

  await check('kiosk-toast-aria', 'Toast has role=status + aria-live=polite', async () => {
    const role = await desktopPage.$eval('[data-testid="toast-success"]', (n) => n.getAttribute('role'));
    const live = await desktopPage.$eval('[data-testid="toast-success"]', (n) => n.getAttribute('aria-live'));
    if (role !== 'status') throw new Error(`role was: ${role}`);
    if (live !== 'polite') throw new Error(`aria-live was: ${live}`);
  });

  await check('kiosk-toast-auto-dismisses', 'Toast auto-dismisses after duration', async () => {
    await desktopPage.waitForSelector('[data-testid="toast-stack"]', { state: 'detached', timeout: 10_000 });
  });

  // ── Regression sweep — manager surfaces (desktop) ────────────────────────
  console.log('\n── Regression — manager surfaces (desktop) ──');
  await desktopPage.click('[data-testid="nav-overview"]');
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({ path: resolve(SS_DIR, '07-manager-overview-desktop.png'), fullPage: false });

  await desktopPage.click('[data-testid="nav-awards"]');
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({ path: resolve(SS_DIR, '08-manager-awards-desktop.png'), fullPage: false });

  await desktopPage.click('[data-testid="nav-team"]');
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({ path: resolve(SS_DIR, '09-manager-team-desktop.png'), fullPage: false });

  await desktopContext.close();
  await browser.close();

  // ── Final tally ──────────────────────────────────────────────────────────
  const passed = Object.values(results).filter((r) => r.pass).length;
  const failed = Object.values(results).filter((r) => !r.pass).length;

  writeFileSync(RESULTS_FILE, JSON.stringify({
    passed,
    failed,
    consoleErrors,
    results,
  }, null, 2));

  console.log(`\n── Summary ──`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`  console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.error(`    ${e}`));
  }
  console.log(`  artifacts: ${ARTIFACTS_DIR}`);

  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error(`\nFATAL: ${redact(err?.message ?? String(err))}`);
  process.exit(2);
});

/**
 * vh-helpers.mjs — shared plumbing for the VH staging smoke suite.
 * Builds on scripts/verification/lib/walk-helpers.mjs (Run-1 pattern):
 * bypass session, real login form, per-leg console + network watchdogs
 * (console-clean assertion + zero-prod-requests isolation check on EVERY leg).
 */
import {
  setupBypassSession,
  captureConsoleAndNetwork,
} from '../lib/walk-helpers.mjs';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { BASE, ACCOUNTS, EXPECT } from './expectations.mjs';

const TOKEN = process.env.VERCEL_BYPASS_TOKEN;

// Benign console noise that must not fail a leg (Firestore backoff retries,
// Vercel bypass redirects, missing favicon on preview deploys).
const CONSOLE_ALLOWLIST = [
  /favicon/i,
  /net::ERR_ABORTED/i,
  /_vercel/i,
  /transport errored/i,          // Firestore stream backoff (retries succeed)
  /WebChannelConnection.*transport/i,
  /installations\/.*(403|401)/i, // Firebase Installations noise on previews
  /third-party cookie/i,
  /preload/i,
];

export function assertEnv() {
  if (!TOKEN) { console.error('MISSING ENV: VERCEL_BYPASS_TOKEN (run with node --env-file=.env.staging)'); process.exit(2); }
}

/**
 * Create a browser context wired with:
 *  - Vercel bypass session
 *  - console capture (errors fail the leg unless allowlisted)
 *  - FULL request log with a production-project tripwire (agencytrack-2a610)
 */
export async function newLegContext(browser, { viewport = { width: 1280, height: 800 }, reducedMotion, colorScheme } = {}) {
  const context = await browser.newContext({
    viewport, ignoreHTTPSErrors: true,
    ...(reducedMotion ? { reducedMotion: 'reduce' } : {}),
    ...(colorScheme ? { colorScheme } : {}),
  });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);
  const prodRequests = [];
  const pageErrors = [];
  page.on('request', (req) => { if (req.url().includes(EXPECT.prodProjectMarker)) prodRequests.push(req.url()); });
  page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));
  return { context, page, capture, prodRequests, pageErrors };
}

/** Real login-form login (Run-1 pattern; viewport-agnostic readiness check).
 * dismissCelebration (default true): fresh contexts have empty localStorage, so
 * an on-load celebration takeover (e.g. the Run3 filing-streak milestone — the
 * seeded 9-wk streak crosses rung 5) can cover the viewport (inset-0 z-60) and
 * intercept a leg's first click. Legs whose SUBJECT is the celebration pass
 * { dismissCelebration: false }. */
export async function login(page, who, { dismissCelebration = true } = {}) {
  const acct = ACCOUNTS[who];
  if (!acct) throw new Error(`unknown account key: ${who}`);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 25_000 });
  await page.fill('input[type="email"]', acct.email);
  await page.fill('input[type="password"]', acct.password);
  await page.click('button[type="submit"]');
  const outcome = await Promise.race([
    page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 25_000 }).then(() => 'rendered'),
    page.waitForSelector('text=Incorrect email or password', { timeout: 25_000 }).then(() => 'auth-error'),
  ]).catch(() => 'timeout');
  if (outcome !== 'rendered') throw new Error(`LOGIN-${outcome.toUpperCase()}: ${acct.email}`);
  await page.waitForTimeout(1500);
  if (dismissCelebration) {
    const dismiss = page.locator('[aria-label="Dismiss celebration"]');
    try {
      await dismiss.waitFor({ state: 'visible', timeout: 2_500 });
      await dismiss.click();
      await dismiss.waitFor({ state: 'detached', timeout: 5_000 });
      await page.waitForTimeout(300);
    } catch { /* no celebration fired — normal for most roles/tabs */ }
  }
}

/** Navigate the sidebar (desktop) to a tab by its visible label. */
export async function gotoTab(page, label) {
  const nav = page.locator('nav[aria-label="Primary navigation"]');
  await nav.getByRole('button', { name: new RegExp(`^${escapeRe(label)}$`, 'i') }).first().click();
  await page.waitForTimeout(900);
}
export function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** TTD currency matcher: staging renders "TTD 122,000" (also tolerate TT$/$). */
export function currencyRe(n) {
  const grouped = Math.round(Number(n)).toLocaleString('en-US');
  return new RegExp(`(?:TTD|TT\\$|\\$)\\s?${escapeRe(grouped)}(?:\\.\\d{2})?\\b`);
}

/** Assert body (or a locator) contains text/regex; throws with context. */
export async function expectText(page, matcher, label, { timeout = 12_000, within } = {}) {
  const target = within ?? page.locator('body');
  const loc = typeof matcher === 'string' ? target.getByText(matcher, { exact: false }) : target.getByText(matcher);
  try { await loc.first().waitFor({ state: 'attached', timeout }); }
  catch { throw new Error(`expectText failed: ${label} — did not find ${matcher}`); }
}

/** End-of-leg hygiene: console-clean + zero prod requests. Throws on breach. */
export function assertLegHygiene({ capture, prodRequests, pageErrors }) {
  if (prodRequests.length) {
    throw new Error(`PROD-ISOLATION BREACH: ${prodRequests.length} request(s) to ${EXPECT.prodProjectMarker}: ${prodRequests.slice(0, 3).join(' | ')}`);
  }
  const errs = [
    ...pageErrors,
    ...capture.consoleMessages.filter((m) => m.type === 'error').map((m) => m.text),
  ].filter((t) => !CONSOLE_ALLOWLIST.some((re) => re.test(t)));
  if (errs.length) {
    throw new Error(`CONSOLE-NOT-CLEAN: ${errs.length} error(s): ${errs.slice(0, 3).join(' | ').slice(0, 500)}`);
  }
}

/**
 * Tablet viewport for the Run-9 planner smokes (Run A Tier 2 / Option 1). 900px
 * is ≥768 (sidebar rail shows → the existing agent-tab-planner nav works) and
 * <1024 (below the E1 desktop-board breakpoint → single-column planner). Single
 * source of truth for the value the E1 drift guard below reasons about.
 */
export const TABLET_VIEWPORT = { width: 900, height: 800 };

/**
 * Planner E1 drift guard (Run A Tier 2 / Option 1). Confirms we are on the
 * PRESERVED single-column planner layer, NOT the E1 desktop board. The six
 * Run-9 smokes run at 900×800 — the sidebar rail shows at ≥768px (so the
 * existing agent-tab-planner nav works) while 900 stays below the E1 desktop
 * board breakpoint (lg = 1024), so the planner renders its single-column views.
 * If the sidebar(768) or board(1024) breakpoint ever moves across 900, these
 * smokes would silently start verifying the wrong layer — this makes that fail
 * loudly. Positive: a single-column view pill is present. Negative: the E1
 * board root testid is absent.
 * @returns {Promise<{pillsPresent:boolean, boardAbsent:boolean, ok:boolean}>}
 */
export async function assertSingleColumnPlanner(page) {
  const td = (id) => `[data-testid="${id}"]`;
  const pillsPresent = await page.locator(td('planner-view-today')).first().isVisible().catch(() => false);
  const boardAbsent = !(await page.locator(td('planner-desktop-board')).first().isVisible().catch(() => false));
  return { pillsPresent, boardAbsent, ok: pillsPresent && boardAbsent };
}

/** Screenshot helper (best-effort). */
export function shotFactory(dir) {
  mkdirSync(dir, { recursive: true });
  return async (page, name) => {
    try { await page.screenshot({ path: join(dir, `${name}.png`), fullPage: false }); } catch { /* best-effort */ }
  };
}

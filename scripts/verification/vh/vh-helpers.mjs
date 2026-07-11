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

/** Screenshot helper (best-effort). */
export function shotFactory(dir) {
  mkdirSync(dir, { recursive: true });
  return async (page, name) => {
    try { await page.screenshot({ path: join(dir, `${name}.png`), fullPage: false }); } catch { /* best-effort */ }
  };
}

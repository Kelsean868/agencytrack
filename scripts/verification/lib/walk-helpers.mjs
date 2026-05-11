/**
 * walk-helpers.mjs — shared utilities for AgencyTrack Playwright walk scripts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FOUR BANKED LESSONS (learned from manual smoke runs — do not re-learn these)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. BYPASS COOKIE VALUE: x-vercel-set-bypass-cookie must be "samesitenone",
 *    NOT "true". The _vercel_jwt is the SSO cookie; the bypass cookie is
 *    server-set via the URL parameter. Using "true" does not wire the cookie.
 *
 * 2. waitUntil FOR FIREBASE APPS: always use 'domcontentloaded', never
 *    'networkidle'. Firebase keeps long-polling sockets open indefinitely;
 *    'networkidle' will never resolve.
 *
 * 3. CardStack.NumericField SELECTOR: renders <input type="text"
 *    inputMode="numeric">, NOT <input type="number">. Use
 *    input[inputmode="numeric"] or a label-based selector — not
 *    input[type="number"], which will miss it.
 *
 * 4. dispatchEvent('click') FOR display:none PARENTS: Playwright refuses
 *    force-click on parents that are display:none. Use
 *    element.dispatchEvent(new Event('click', { bubbles: true })) to bypass
 *    actionability checks when navigating sidebar items at mobile viewport.
 *    See mobileDispatchClick() below.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { mkdir, existsSync } from 'fs';
import { resolve, join } from 'path';

// ── Token-like pattern for redaction ────────────────────────────────────────
// Matches hex/base64/alphanumeric strings >= 20 chars (JWT segments, tokens).
const TOKEN_RE = /[A-Za-z0-9_\-]{20,}/g;

/**
 * safeLog — logs a message, redacting anything that looks like a token or a
 * path to .env.local. Use anywhere a value might bleed sensitive data.
 *
 * @param {string} message - Label / description of what is being logged.
 * @param {string|undefined} value - Optional value to include (will be redacted).
 */
export function safeLog(message, value) {
  if (value === undefined) {
    console.log(message);
    return;
  }
  const safe = String(value)
    .replace(/\.env\.local/g, '[env-file]')
    .replace(TOKEN_RE, '[REDACTED]');
  console.log(message, safe);
}

/**
 * buildBypassUrl — constructs the Vercel preview bypass URL.
 *
 * LESSON 1: cookie value must be "samesitenone", not "true".
 *
 * The function MUST NOT log its return value — the token is embedded in the
 * URL. Callers that log URLs must redact first via safeLog.
 *
 * @param {string} baseUrl - Preview base URL (no trailing slash).
 * @param {string} token   - VERCEL_BYPASS_TOKEN value.
 * @returns {string} Full bypass URL.
 */
export function buildBypassUrl(baseUrl, token) {
  const u = new URL(baseUrl);
  u.searchParams.set('x-vercel-protection-bypass', token);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  return u.toString();
}

/**
 * waitForFirebaseReady — waits for the app to finish initial Firebase auth
 * resolution after a navigation or reload.
 *
 * Polls for the presence of either the login form (unauthenticated) or the
 * primary nav (authenticated). Both are stable first-paint indicators.
 *
 * LESSON 2: uses domcontentloaded internally; never networkidle.
 *
 * @param {import('playwright').Page} page
 * @param {number} [timeout=20000]
 */
export async function waitForFirebaseReady(page, timeout = 20_000) {
  await page.waitForFunction(
    () =>
      document.querySelector('input[type="email"]') !== null ||
      document.querySelector('nav[aria-label="Primary navigation"]') !== null,
    { timeout },
  );
}

/**
 * hardReloadAndAwaitReady — reloads the page with domcontentloaded and then
 * waits for Firebase auth to resolve. Use this as the reload step inside any
 * write-read-verify cycle.
 *
 * @param {import('playwright').Page} page
 */
export async function hardReloadAndAwaitReady(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
}

/**
 * mobileDispatchClick — dispatches a bubbling click event on a DOM element
 * by selector, bypassing Playwright's actionability checks.
 *
 * LESSON 4: use for sidebar nav items at mobile viewports where the sidebar
 * parent is display:none and Playwright's .click() refuses to act.
 *
 * @param {import('playwright').Page} page
 * @param {string} selector - CSS selector for the target element.
 */
export async function mobileDispatchClick(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`mobileDispatchClick: selector not found — ${sel}`);
    el.dispatchEvent(new Event('click', { bubbles: true }));
  }, selector);
}

/**
 * writeReadVerifyCycle — canonical write → screenshot → hard-reload →
 * verify → screenshot sequence. The unit of proof for WALK-1.
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   writeFn:      (page: Page) => Promise<void>,
 *   verifyFn:     (page: Page) => Promise<void>,
 *   description:  string,
 *   screenshotDir: string,
 * }} options
 * @returns {Promise<{ pass: boolean, errors: string[] }>}
 */
export async function writeReadVerifyCycle(page, { writeFn, verifyFn, description, screenshotDir }) {
  const errors = [];
  const slug = description.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const ssDir = resolve(screenshotDir);

  await new Promise((res, rej) =>
    mkdir(ssDir, { recursive: true }, (e) => (e ? rej(e) : res())),
  );

  // ── Write ──────────────────────────────────────────────────────────────────
  try {
    await writeFn(page);
  } catch (e) {
    errors.push(`write phase: ${e.message ?? String(e)}`);
    safeLog(`[writeReadVerifyCycle] FAIL write — ${description}:`, e.message);
    return { pass: false, errors };
  }

  await page.screenshot({
    path: join(ssDir, `${slug}-post-write.png`),
    fullPage: false,
  });

  // ── Hard reload ────────────────────────────────────────────────────────────
  try {
    await hardReloadAndAwaitReady(page);
  } catch (e) {
    errors.push(`reload phase: ${e.message ?? String(e)}`);
    safeLog(`[writeReadVerifyCycle] FAIL reload — ${description}:`, e.message);
    return { pass: false, errors };
  }

  // ── Verify ─────────────────────────────────────────────────────────────────
  try {
    await verifyFn(page);
  } catch (e) {
    errors.push(`verify phase: ${e.message ?? String(e)}`);
    safeLog(`[writeReadVerifyCycle] FAIL verify — ${description}:`, e.message);
    await page.screenshot({
      path: join(ssDir, `${slug}-post-verify-FAIL.png`),
      fullPage: false,
    });
    return { pass: false, errors };
  }

  await page.screenshot({
    path: join(ssDir, `${slug}-post-verify.png`),
    fullPage: false,
  });

  safeLog(`[writeReadVerifyCycle] PASS — ${description}`);
  return { pass: true, errors: [] };
}

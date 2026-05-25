/**
 * walk-helpers.mjs — shared utilities for AgencyTrack Playwright walk scripts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIVE BANKED LESSONS (learned from manual smoke runs — do not re-learn these)
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
 * 5. COOKIE-AFTER-HANDSHAKE BYPASS: the bypass token must appear in a URL
 *    exactly once, for exactly one request, inside a function that catches
 *    and sanitizes errors before they surface. After that single request
 *    Vercel sets the session cookie and all subsequent navigation uses bare
 *    URLs — no token in any URL anywhere. The canonical implementation is
 *    setupBypassSession() below; direct use of buildBypassUrl is forbidden
 *    from consumer code. Banked from M3-smoke incident: Playwright embeds
 *    failing URLs in error.message AND in the Call log block, so any
 *    redaction layer on the consumer side is whack-a-mole — the architecture
 *    must keep the token out of error paths entirely.
 *
 *
 * 6. REACT 19 CONTROLLED-SELECT AUTOMATION: use selectReactOption() below —
 *    Playwright's selectOption() fires a trusted Chromium change event that
 *    React 19 handles correctly. Do NOT layer an extra dispatchEvent('change')
 *    with a generic (untrusted) Event — the extra dispatch may interact badly
 *    with React's synthetic event system and can cause the select to appear
 *    blank in subsequent reads. Banked from PR #248 smoke debugging.
 *
 * 7. OVERFLOW-CONTAINER DATA CHECKS: Playwright's waitFor({ state: 'visible' })
 *    treats elements scrolled out of the viewport within an overflow:auto
 *    container as not visible. Use domTextCount() below for "is this text
 *    rendered anywhere in the DOM" checks; use isVisible() only for
 *    "is this element in the user's viewport" checks. Banked from PR #248.
 *
 * 8. REST-WRITE vs SDK-READ VERIFICATION: smokes that write via Firestore REST
 *    in a fresh browser context and then try to verify via SDK queries may see
 *    stale cache or the pending write only. The canonical smoke pattern is
 *    end-to-end via the UI path (addDoc via SDK → hard-reload → SDK read);
 *    REST writes are diagnostic only and must not gate on SDK observation in
 *    the same context. Banked from PR #248 (wrong getDocsFromServer theory,
 *    reverted in 6b3c252).
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal use only. Consumer code must use setupBypassSession() instead.
// Direct use of buildBypassUrl is forbidden — see CLAUDE.md cookie-after-
// handshake rule. The token embedded in this function's return value can
// surface through Playwright error paths (error.message + Call log block);
// keeping it private to this module is the architectural fix.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * buildBypassUrl — constructs the Vercel preview bypass URL.
 *
 * LESSON 1: cookie value must be "samesitenone", not "true".
 *
 * @private — internal to walk-helpers.mjs. Consumer code MUST call
 *            setupBypassSession() instead. See LESSON 5 above and the
 *            cookie-after-handshake rule in CLAUDE.md.
 *
 * The function MUST NOT log its return value — the token is embedded in the
 * URL. The single legitimate consumer is setupBypassSession() below, which
 * passes the URL into one tightly-scoped page.goto() inside a sanitizing
 * try/catch.
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
 * setupBypassSession — establishes a Vercel preview bypass session on a
 * Playwright BrowserContext via a single cookie-setting handshake request.
 *
 * The token appears in exactly ONE URL, for exactly ONE page.goto(), inside
 * a try/catch that sanitizes ALL error surfaces before re-throwing. After
 * the handshake, Vercel has set the session cookie on the context and all
 * subsequent navigation in any page from this context uses bare URLs — the
 * token is never reintroduced.
 *
 * LESSON 5: this is the canonical bypass mechanism. Consumer code must NOT
 * call buildBypassUrl directly — the token leaks through Playwright's
 * error.message + Call log on DNS or network failures, and consumer-side
 * redaction is whack-a-mole (the next failure mode encodes the token
 * differently).
 *
 * Canonical usage:
 *
 *   const browser = await chromium.launch();
 *   const context = await browser.newContext();
 *   await setupBypassSession(context, `https://${PREVIEW_HOST}`, process.env.VERCEL_BYPASS_TOKEN);
 *   const page = await context.newPage();
 *   await page.goto(`https://${PREVIEW_HOST}/`); // NO token in URL ever again
 *
 * @param {import('playwright').BrowserContext} context - Playwright context
 *        on which to set the bypass session cookie.
 * @param {string} baseUrl - Preview base URL (no trailing slash).
 * @param {string} token   - VERCEL_BYPASS_TOKEN value.
 * @throws {Error} A sanitized error (error name + code only, no URL, no
 *         token) if the handshake fails for any reason.
 */
export async function setupBypassSession(context, baseUrl, token) {
  const page = await context.newPage();
  const setupUrl = `${baseUrl}/?x-vercel-protection-bypass=${token}&x-vercel-set-bypass-cookie=samesitenone`;
  try {
    await page.goto(setupUrl, { waitUntil: 'domcontentloaded' });
  } catch (err) {
    throw new Error(`Bypass session setup failed: ${err.name} (${err.code ?? 'unknown'})`);
  } finally {
    await page.close();
  }
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

/**
 * selectReactOption — selects an option in a React 19 controlled <select>.
 *
 * LESSON 6: Playwright's page.selectOption() fires a trusted Chromium change
 * event that React handles correctly. Do NOT add an extra dispatchEvent after
 * selectOption — the extra untrusted Event can interact badly with React 19's
 * synthetic event system.
 *
 * Usage (preferred over raw locator.selectOption):
 *
 *   await selectReactOption(page, page.locator('#productLine'), 'ah');
 *
 * @param {import('playwright').Page}    page
 * @param {import('playwright').Locator} locator - The <select> element locator.
 * @param {string}                       value   - The option value to select.
 */
export async function selectReactOption(page, locator, value) {
  await locator.selectOption(value);
}

/**
 * domTextCount — counts occurrences of `text` inside elements matching
 * `selector` regardless of viewport or overflow visibility.
 *
 * LESSON 7: use this for "is this data rendered anywhere in the DOM" checks
 * inside overflow-scroll containers (modals, drawers, infinite lists). Use
 * locator.isVisible() only when you need viewport-level visibility (i.e. the
 * user can actually see the element without scrolling).
 *
 * @param {import('playwright').Page} page
 * @param {string} selector  - CSS selector for the container (e.g. '.card')
 * @param {string} text      - Text to search for (exact substring match).
 * @returns {Promise<number>} Count of matching elements containing the text.
 */
export async function domTextCount(page, selector, text) {
  return page.evaluate(
    ([sel, txt]) => {
      const nodes = document.querySelectorAll(sel);
      let count = 0;
      for (const n of nodes) {
        if (n.textContent && n.textContent.includes(txt)) count++;
      }
      return count;
    },
    [selector, text],
  );
}

/**
 * walk-helpers.mjs — shared utilities for AgencyTrack Playwright walk scripts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NINE BANKED LESSONS (learned from manual smoke runs — do not re-learn these)
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
 * 9. CONSOLE/NETWORK CAPTURE: call captureConsoleAndNetwork(page) immediately
 *    after opening a new page (before any goto) to wire up listeners. The helper
 *    accumulates console errors/warnings and failed network requests for the
 *    lifetime of the page. Call formatCaptureReport(capture) before exit to
 *    print a summary block. Static-asset noise (.map, .ico) is filtered inside
 *    the helper — per-feature smokes do not need their own filter. Banked from
 *    PR #238 post-merge dispatch (ad-hoc supplemental script).
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

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE-HARNESS PRIMITIVES — screen-agnostic helpers shared by per-screen
// smokes (Daily Capture, Game Plan, Commission, Policy Ledger, Settings, …).
// Each encodes a hard-won lesson so per-screen smokes never re-derive it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resolvePreviewUrl — resolves the Vercel target for a smoke run.
 *
 * LESSON: Vercel truncates long branch names into per-branch aliases with a
 * hash suffix (e.g. `redesign/daily-capture-v2` →
 * `agencytrack-git-redesign-daily-5c6e28-…`). The alias is branch-specific and
 * MUST NOT be hardcoded across smokes — pass the PR's preview alias (decoded
 * from the Vercel preview-bot comment's target_url) via SMOKE_PREVIEW_URL. With
 * no override, falls back to production.
 *
 * @returns {string} SMOKE_PREVIEW_URL if set, else the production URL.
 */
export function resolvePreviewUrl() {
  return process.env.SMOKE_PREVIEW_URL ?? 'https://agencytrack.vercel.app';
}

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE HARNESS HARDENING — the template for all smokes (banked 2026-06-05 after
// three idle-stream "hangs": a finished smoke never exits because the firebase
// web SDK holds an open gRPC stream, so the runner waits forever). Three guards:
//   1. resolveSmokeBaseUrl — resolve the target URL ONCE before launch (no
//      deploy-resolution polling inside the run). Priority: --prod / SMOKE_PROD
//      → production; SMOKE_BASE_URL → that; PREVIEW_HOST → https://host; else the
//      script's defaultHost; else production.
//   2. installGlobalTimeout — a hard ceiling; on expiry print partial results +
//      a loud TIMEOUT marker and exit nonzero. No indefinite waits anywhere.
//   3. finishSmoke — print the summary and process.exit() explicitly (success OR
//      failure) so a lingering SDK connection can never keep the process alive.
// ─────────────────────────────────────────────────────────────────────────────

const PROD_URL = 'https://agencytrack.vercel.app';

export function resolveSmokeBaseUrl({ defaultHost } = {}) {
  const argv = process.argv.slice(2);
  if (argv.includes('--prod') || process.env.SMOKE_PROD === '1') return PROD_URL;
  if (process.env.SMOKE_BASE_URL) return process.env.SMOKE_BASE_URL.replace(/\/+$/, '');
  if (process.env.PREVIEW_HOST) return `https://${process.env.PREVIEW_HOST}`;
  if (defaultHost) return `https://${defaultHost}`;
  return PROD_URL;
}

// HH:MM:SS stamp for flushed, ordered progress lines (plain console.log is
// unbuffered — the buffering culprit was piping through `tail`, never the log).
export function stamp() {
  return new Date().toISOString().slice(11, 19);
}

export function installGlobalTimeout(ms, onTimeout) {
  const handle = setTimeout(() => {
    console.error(`\n⏱️  GLOBAL TIMEOUT after ${Math.round(ms / 1000)}s — smoke did not finish.`);
    try { onTimeout?.(); } catch { /* best-effort partial dump */ }
    console.error('TIMEOUT');
    process.exit(2);
  }, ms);
  if (typeof handle.unref === 'function') handle.unref(); // don't let the timer itself keep us alive
  return () => clearTimeout(handle);
}

// Print the summary and exit explicitly. results = [{ leg, passed, detail }].
export function finishSmoke(results, { clearTimeout: clear } = {}) {
  clear?.();
  console.log('\n── Summary ─────────────────────────────────────────────────');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  results.forEach(({ leg, passed: p, detail }) => console.log(`  ${p ? '✓' : '✗'} ${leg}: ${detail}`));
  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.error('Smoke FAILED — see above.'); process.exit(1); }
  console.log('Smoke PASSED.');
  process.exit(0);
}

/**
 * setTheme — primes a Playwright context to boot the app in light or dark.
 *
 * LESSON: main.jsx reads localStorage.getItem('agencytrack-dark') === '1' —
 * the value is the string '1', NOT 'true'. Writing 'true' leaves the app in
 * light mode. Removing the key selects light. Runs as a context init script so
 * the value is present before the app's first paint (no FOUC, no post-load
 * toggle). Theme is therefore a per-context concern — see runBothThemes.
 *
 * @param {import('playwright').BrowserContext} context
 * @param {'light'|'dark'} theme
 */
export async function setTheme(context, theme) {
  await context.addInitScript((t) => {
    try {
      if (t === 'dark') localStorage.setItem('agencytrack-dark', '1');
      else localStorage.removeItem('agencytrack-dark');
    } catch {}
  }, theme);
}

/**
 * waitForLoaded — waits for a data-loading="false" ready signal on a testid'd
 * element.
 *
 * LESSON: panels that read Firestore expose readiness via
 * [data-testid="<id>"][data-loading="false"] — the attribute flips to "false"
 * only after the read resolves AND the derived state is committed in the same
 * render. Wait on the compound selector, not on text content (which can race
 * the attribute).
 *
 * @param {import('playwright').Page} page
 * @param {string} testid - The data-testid of the loading-gated element.
 * @param {number} [timeout=15000]
 */
export async function waitForLoaded(page, testid, timeout = 15_000) {
  await page.waitForSelector(`[data-testid="${testid}"][data-loading="false"]`, { timeout });
}

/**
 * runBothThemes — runs a per-screen smoke body in light then dark, each in a
 * fresh bypassed context.
 *
 * LESSON: theme is a context-level concern (set before first paint via
 * setTheme's init script), so each theme needs its OWN context — a single page
 * cannot be reused across both. This runner owns the context lifecycle: for
 * each of light then dark it creates a context (at the given viewport),
 * establishes the Vercel bypass session, primes the theme, opens a page, and
 * hands it to perTheme. The context is always closed in finally.
 *
 * perTheme receives (page, theme) and owns ALL screen-specific work plus its
 * own assertions and error handling — the runner deliberately does not catch
 * body errors, so the body controls how a failure is recorded.
 *
 * Signature note: the kickoff brief sketched `runBothThemes(page, fn)`; a single
 * shared page is structurally impossible (theme is per-context), so the
 * finalized signature is `(browser, { baseUrl, token, viewport, perTheme })`.
 *
 * @param {import('playwright').Browser} browser
 * @param {{
 *   baseUrl: string,
 *   token: string,
 *   viewport?: { width: number, height: number },
 *   perTheme: (page: import('playwright').Page, theme: 'light'|'dark') => Promise<void>,
 * }} options
 */
export async function runBothThemes(browser, { baseUrl, token, viewport, perTheme }) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext(viewport ? { viewport } : {});
    try {
      await setupBypassSession(context, baseUrl, token);
      await setTheme(context, theme);
      const page = await context.newPage();
      await perTheme(page, theme);
    } finally {
      await context.close();
    }
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
 * loginAs — navigates to /login and signs in with email + password.
 *
 * Waits for the login form to appear, fills credentials, submits, then
 * polls for body content length > 200 as a proxy for the dashboard
 * rendering. Adds a 1 s settle delay after the poll resolves.
 *
 * This is the canonical login helper for smoke scripts — use it instead of
 * copy-pasting a `waitForFunction(() => document.body.textContent.length > 200)`
 * block into each smoke.
 *
 * @param {import('playwright').Page} page
 * @param {string} baseUrl - Base URL, no trailing slash (e.g. 'https://agencytrack.vercel.app').
 * @param {string} email
 * @param {string} password
 */
export async function loginAs(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 25_000 });
  await page.waitForTimeout(1000);
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

// Static-asset noise pattern — filtered inside captureConsoleAndNetwork so
// per-feature smokes do not need their own filter (LESSON 9).
const STATIC_ASSET_RE = /\.(map|ico)(\?|$)/;

/**
 * captureConsoleAndNetwork — wires console error/warn listeners and network
 * failure listeners on a Playwright Page. Must be called immediately after
 * `context.newPage()` and before the first `page.goto()`.
 *
 * LESSON 9: call this before navigation; the returned capture object
 * accumulates throughout the page's lifetime. Pass it to
 * formatCaptureReport() to print a summary block at smoke exit.
 *
 * @param {import('playwright').Page} page
 * @returns {{ consoleMessages: Array<{type:string,text:string}>,
 *             networkFailures: Array<{url:string,failure:string}> }}
 */
export function captureConsoleAndNetwork(page) {
  const consoleMessages = [];
  const networkFailures = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warn') {
      consoleMessages.push({ type, text: msg.text() });
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (STATIC_ASSET_RE.test(url)) return;
    networkFailures.push({ url, failure: request.failure()?.errorText ?? 'unknown' });
  });

  return { consoleMessages, networkFailures };
}

/**
 * installBearerTokenCapture — installs a window.fetch patch that captures the
 * Firebase Auth bearer token the moment the SDK first makes an authenticated
 * request. Must be called before the first page.goto() (it uses addInitScript).
 *
 * After calling this, use captureBearerToken(page) to read the captured token.
 *
 * WHY addInitScript: page.on('request') cannot intercept gRPC-web framed
 * requests that the Firestore SDK sends. addInitScript() runs at the JS layer
 * before any page script, so the patch is in place when the SDK first makes
 * auth'd fetch calls.
 *
 * @param {import('playwright').Page} page
 */
export async function installBearerTokenCapture(page) {
  await page.addInitScript(() => {
    const _orig = window.fetch;
    window.__bearerToken = null;
    window.fetch = function (input, init) {
      try {
        let auth = '';
        if (input && typeof input === 'object' && typeof input.headers?.get === 'function') {
          auth = input.headers.get('authorization') || input.headers.get('Authorization') || '';
        }
        const h = init?.headers;
        if (h) {
          const fromH = typeof h.get === 'function'
            ? (h.get('authorization') || h.get('Authorization') || '')
            : (h.authorization || h.Authorization || '');
          if (fromH) auth = fromH;
        }
        if (!window.__bearerToken && auth && String(auth).startsWith('Bearer ')) {
          window.__bearerToken = String(auth).slice(7);
        }
      } catch {}
      return _orig.apply(this, arguments);
    };
  });
}

/**
 * captureBearerToken — reads the Firebase Auth bearer token captured by
 * installBearerTokenCapture. Falls back to the Firebase Auth IndexedDB store
 * if the fetch-patch window hasn't seen an authenticated request yet.
 *
 * Returns null if neither source yields a token.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string|null>}
 */
export async function captureBearerToken(page) {
  const fromFetch = await page.evaluate(() => window.__bearerToken ?? null);
  if (fromFetch) return fromFetch;

  return page.evaluate(() => new Promise((resolve) => {
    try {
      const req = indexedDB.open('firebaseLocalStorageDb');
      req.onerror = () => resolve(null);
      req.onsuccess = (e) => {
        try {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) { resolve(null); return; }
          const tx = db.transaction('firebaseLocalStorage', 'readonly');
          const store = tx.objectStore('firebaseLocalStorage');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            for (const item of (getAll.result ?? [])) {
              const tok = item?.value?.stsTokenManager?.accessToken;
              if (tok) { resolve(tok); return; }
            }
            resolve(null);
          };
          getAll.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
    } catch { resolve(null); }
  }));
}

/**
 * formatCaptureReport — prints a console/network capture summary block.
 *
 * Canonical usage at smoke exit:
 *
 *   const capture = captureConsoleAndNetwork(page);
 *   // ... smoke steps ...
 *   formatCaptureReport(capture);
 *
 * @param {{ consoleMessages: Array<{type:string,text:string}>,
 *           networkFailures: Array<{url:string,failure:string}> }} capture
 */
export function formatCaptureReport({ consoleMessages, networkFailures }) {
  const SEP = '── Console/network capture ─────────────────────────────────';
  const END = '────────────────────────────────────────────────────────────';
  const lines = [SEP];

  if (consoleMessages.length === 0) {
    lines.push('  console: (clean)');
  } else {
    lines.push(`  console: ${consoleMessages.length} message(s)`);
    for (const { type, text } of consoleMessages) {
      lines.push(`    [${type}] ${text.slice(0, 200)}`);
    }
  }

  if (networkFailures.length === 0) {
    lines.push('  network failures: (none)');
  } else {
    lines.push(`  network failures: ${networkFailures.length}`);
    for (const { url, failure } of networkFailures) {
      lines.push(`    FAIL ${failure}: ${url.slice(0, 200)}`);
    }
  }

  lines.push(END);
  console.log(lines.join('\n'));
}

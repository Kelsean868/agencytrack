/**
 * auth-helpers.mjs — shared utilities for the pre-pilot shakedown suite.
 *
 * Provides:
 *   - loadEnv()              : .env.local loader with embedded-key detection
 *   - adminInit()            : Firebase Admin SDK singleton init
 *   - loginAsViaUI()         : Playwright email+password login flow
 *   - logoutViaUI()          : Playwright sign-out
 *   - getIdTokenForUid()     : Admin custom token → REST exchange → ID token
 *   - firestoreRestRequest() : Authenticated Firestore REST helper
 *   - setupBrowser()         : Launch headless Chromium + return { browser, context, page }
 *   - setDarkMode()          : Toggle dark mode via localStorage + reload
 *   - setMobileViewport()    : 390×844 (iPhone 14 Pro)
 *   - setDesktopViewport()   : 1280×800
 *   - screenshot()           : Path-safe screenshot helper
 *   - check()                : Assertion helper (label, fn) → { pass, error }
 *   - TEST_USERS             : Test roster constants
 *   - BASE_URL               : Production URL
 *   - TENANT_ID
 *
 * Auth strategy:
 *   UI walks:          loginAsViaUI — email+password via Playwright login form
 *   Permission matrix: getIdTokenForUid — Admin SDK custom token → REST exchange
 *
 * CLAUDE.md rules observed:
 *   - Never echo env values to stdout (env loaded but not logged)
 *   - Admin SDK via functions/node_modules (not repo root)
 *   - No bypass needed: shakedown targets production URL (no Vercel protection)
 */

import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join }              from 'path';
import { fileURLToPath }                       from 'url';
import { createRequire }                       from 'module';

export const __dir  = dirname(fileURLToPath(import.meta.url));
export const ROOT   = resolve(__dir, '../../..');

// ── Constants ─────────────────────────────────────────────────────────────────

export const BASE_URL      = 'https://agencytrack.vercel.app';
export const TENANT_ID     = 'tatillife_south';
export const TEST_PASSWORD = 'TestSeed!2026';

export const TEST_USERS = {
  branchManager:  { email: 'bm-001@agencytrack.test',    role: 'branch_manager', password: TEST_PASSWORD },
  unitManager1:   { email: 'um-001@agencytrack.test',    role: 'unit_manager',   password: TEST_PASSWORD },
  unitManager2:   { email: 'um-002@agencytrack.test',    role: 'unit_manager',   password: TEST_PASSWORD },
  agent1:         { email: 'agent-001@agencytrack.test', role: 'agent',          password: TEST_PASSWORD },
  agent2:         { email: 'agent-002@agencytrack.test', role: 'agent',          password: TEST_PASSWORD },
  agent3:         { email: 'agent-003@agencytrack.test', role: 'agent',          password: TEST_PASSWORD },
  agent4:         { email: 'agent-004@agencytrack.test', role: 'agent',          password: TEST_PASSWORD },
  agent5:         { email: 'agent-005@agencytrack.test', role: 'agent',          password: TEST_PASSWORD },
  agent6:         { email: 'agent-006@agencytrack.test', role: 'agent',          password: TEST_PASSWORD },
  agent7:         { email: 'agent-007@agencytrack.test', role: 'agent',          password: TEST_PASSWORD },
};

// ── Env loader ────────────────────────────────────────────────────────────────

let _env = null;

/**
 * loadEnv — reads and validates .env.local.
 *
 * Validates each line: throws on embedded KEY= patterns (concatenated lines)
 * as banked from the SEC-9 autonomous run incident. Never echoes values.
 * Lines without a `=` are silently skipped (covers bare URLs, comments, blanks).
 *
 * Going forward: only lines matching ^[A-Z_]+=  are parsed. Per Phase 1
 * retrospective — PowerShell -split '=' returned a bare SMTP URL line
 * because it lacked a KEY= prefix. This parser skips such lines cleanly.
 *
 * @returns {Record<string, string>}
 */
export function loadEnv() {
  if (_env) return _env;
  const p = resolve(ROOT, '.env.local');
  if (!existsSync(p)) {
    console.warn('[auth-helpers] .env.local not found — env will be empty');
    _env = {};
    return _env;
  }
  const src = readFileSync(p, 'utf8');
  const result = {};
  const lines  = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    // Only parse lines that start with an uppercase KEY= pattern.
    // Bare URLs (smtps://, https://, etc.) are skipped entirely.
    if (!/^[A-Z_][A-Z0-9_]*=/.test(line)) continue;
    const eq  = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    let   val = line.slice(eq + 1).trim();
    // Detect concatenated key=value pairs on one line.
    const embedded = val.match(/([A-Z][A-Z0-9_]{2,})=/);
    if (embedded) {
      throw new Error(
        `Malformed .env.local line ${i + 1}: key "${key}" value appears to ` +
        `contain embedded key "${embedded[1]}". Ensure each pair is on its own line.`,
      );
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  _env = result;
  return _env;
}

// ── Admin SDK ─────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
let _admin = null;
let _db    = null;
let _auth  = null;

/**
 * adminInit — singleton Firebase Admin SDK init.
 * Uses functions/node_modules/firebase-admin per CLAUDE.md.
 * @returns {{ admin, db, auth }}
 */
export function adminInit() {
  if (_admin) return { admin: _admin, db: _db, auth: _auth };
  const keyPath = resolve(ROOT, 'functions/service-account-key.json');
  if (!existsSync(keyPath)) {
    throw new Error(`service-account-key.json not found at ${keyPath}`);
  }
  const admin = require('../../../functions/node_modules/firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
  }
  _admin = admin;
  _db    = admin.firestore();
  _auth  = admin.auth();
  return { admin, db: _db, auth: _auth };
}

// ── Firebase REST helpers (permission matrix) ─────────────────────────────────

/**
 * getIdTokenForUid — mints a custom token for a UID, then exchanges it for
 * a client-side ID token via the Firebase Auth REST API.
 *
 * The ID token is subject to Firestore security rules — use it to test
 * permission boundaries from the perspective of that user.
 *
 * @param {string} uid
 * @returns {Promise<string>} ID token
 */
export async function getIdTokenForUid(uid) {
  const { auth } = adminInit();
  const env      = loadEnv();
  const apiKey   = env.VITE_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY missing from .env.local');

  const customToken = await auth.createCustomToken(uid);

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    throw new Error(`Custom token exchange failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.idToken;
}

/**
 * firestoreRestRequest — makes an authenticated Firestore REST API request.
 *
 * @param {{ method, path, idToken, body? }} opts
 *   path: Firestore REST path relative to project root
 *         e.g. "projects/{projectId}/databases/(default)/documents/tenants/..."
 * @returns {Promise<{ status: number, ok: boolean, data: any }>}
 */
export async function firestoreRestRequest({ method, path, idToken, body }) {
  const projectId = 'agencytrack-2a610';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, ok: res.ok, data };
}

/**
 * getUidByEmail — looks up a Firebase Auth UID by email.
 * @param {string} email
 * @returns {Promise<string>}
 */
export async function getUidByEmail(email) {
  const { auth } = adminInit();
  const user = await auth.getUserByEmail(email);
  return user.uid;
}

// ── Playwright helpers ────────────────────────────────────────────────────────

let _playwright = null;
function playwright() {
  if (!_playwright) _playwright = require('../../../node_modules/playwright');
  return _playwright;
}

/**
 * setupBrowser — launches headless Chromium, creates a fresh context and page.
 * @returns {Promise<{ browser, context, page }>}
 */
export async function setupBrowser() {
  const { chromium } = playwright();
  const browser  = await chromium.launch({ headless: true });
  const context  = await browser.newContext({
    viewport:  { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * setDesktopViewport — 1280×800.
 */
export async function setDesktopViewport(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
}

/**
 * setMobileViewport — 390×844 (iPhone 14 Pro form factor).
 */
export async function setMobileViewport(page) {
  await page.setViewportSize({ width: 390, height: 844 });
}

/**
 * setDarkMode — enables dark mode by setting localStorage then reloading.
 * Mirrors AgencyTrack's dark-mode persistence (src/main.jsx).
 */
export async function setDarkMode(page, enabled = true) {
  await page.evaluate((v) => {
    localStorage.setItem('agencytrack-dark', v ? '1' : '');
    if (v) document.documentElement.classList.add('dark');
    else   document.documentElement.classList.remove('dark');
  }, enabled);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

/**
 * waitForAppReady — waits for the app to render either the login form or
 * the authenticated primary navigation. Mirrors walk-helpers.mjs pattern.
 * Always uses domcontentloaded (never networkidle — Firebase keeps sockets).
 */
export async function waitForAppReady(page, timeout = 25_000) {
  await page.waitForFunction(
    () =>
      document.querySelector('input[type="email"]') !== null ||
      document.querySelector('nav[aria-label="Primary navigation"]') !== null ||
      document.querySelector('[data-testid="platform-admin-stub"]') !== null ||
      document.body.innerText.includes('Platform Admin'),
    { timeout },
  );
}

/**
 * loginAsViaUI — fills the login form and waits for the dashboard.
 *
 * @param {import('playwright').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function loginAsViaUI(page, email, password) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for dashboard (agent sees "Dashboard", managers see "Overview" or nav)
  await page.waitForFunction(
    () =>
      document.querySelector('nav[aria-label="Primary navigation"]') !== null ||
      document.body.innerText.includes('Platform Admin'),
    { timeout: 30_000 },
  );
}

/**
 * logoutViaUI — clicks the Sign Out button and waits for the login screen.
 * Looks for any button or link containing "sign out" text (case-insensitive).
 */
export async function logoutViaUI(page) {
  // Try sidebar profile/sign-out button
  const signOutBtn = page.getByRole('button', { name: /sign out/i }).first();
  if (await signOutBtn.count() > 0) {
    await signOutBtn.click();
  } else {
    // Navigate to profile tab first
    const profileBtn = page.getByRole('button', { name: /profile/i }).first();
    if (await profileBtn.count() > 0) {
      await profileBtn.click();
      await page.waitForTimeout(500);
    }
    await page.getByRole('button', { name: /sign out/i }).first().click();
  }
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
}

/**
 * navigateToTab — clicks a sidebar nav item by its visible label text.
 * Handles both desktop sidebar and mobile bottom-nav.
 * Always waits for the app to be ready before looking for buttons (important
 * after page.reload() calls where React hasn't re-rendered yet).
 */
export async function navigateToTab(page, label) {
  await waitForAppReady(page);
  // Try sidebar first (button with exact or partial matching label)
  const sidebarBtn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
  if (await sidebarBtn.count() > 0) {
    await sidebarBtn.click();
    await page.waitForTimeout(600);
    return;
  }
  // Mobile: dispatch click via evaluate (sidebar may be display:none)
  await page.evaluate((lbl) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find((b) => b.textContent?.toLowerCase().includes(lbl.toLowerCase()));
    if (target) target.dispatchEvent(new Event('click', { bubbles: true }));
    else throw new Error(`navigateToTab: button "${lbl}" not found`);
  }, label);
  await page.waitForTimeout(600);
}

// ── Screenshot helper ─────────────────────────────────────────────────────────

/**
 * screenshot — takes a screenshot and ensures the directory exists.
 * Never throws — logs error and continues.
 *
 * @param {import('playwright').Page} page
 * @param {string} filePath - Absolute path for the screenshot.
 */
export async function screenshot(page, filePath) {
  const dir = resolve(filePath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    await page.screenshot({ path: filePath, fullPage: false });
  } catch (e) {
    console.warn(`[screenshot] failed to capture ${filePath}: ${e.message}`);
  }
}

// ── Assertion helper ──────────────────────────────────────────────────────────

/**
 * check — runs an assertion function and returns a structured result.
 *
 * @param {string} id   - Test ID (e.g. "T1.01")
 * @param {string} label
 * @param {() => Promise<void>} fn - Throws on failure
 * @returns {Promise<TestResult>}
 */
export async function check(id, label, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`  ✓ ${id}: ${label} (${ms}ms)`);
    return { id, label, pass: true, ms };
  } catch (e) {
    const ms  = Date.now() - start;
    const msg = e?.message ?? String(e);
    console.error(`  ✗ ${id}: ${label} — ${msg}`);
    return { id, label, pass: false, ms, error: msg };
  }
}

/**
 * sleep — promise-based delay.
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * assertVisible — throws if selector is not visible within timeout.
 */
export async function assertVisible(page, selector, desc, timeout = 10_000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
  } catch {
    throw new Error(`Expected "${desc}" to be visible (selector: ${selector})`);
  }
}

/**
 * assertBodyContains — throws if page body doesn't contain text.
 */
export async function assertBodyContains(page, text) {
  const body = await page.locator('body').innerText();
  if (!body.includes(text)) throw new Error(`Expected body to contain "${text}"`);
}

/**
 * assertNoConsoleErrors — asserts no unhandled console errors were logged.
 * Returns a collector function to attach; call assertNoConsoleErrors.report()
 * to check at the end of a test.
 */
export function consoleErrorCollector(page) {
  const errors = [];
  const harmless = [
    /\[AgencyTrack\] Auth claims:/,
    /\[AgencyTrack\] UID:/,
    /firestore\.googleapis\.com\/.*Listen\/channel/,
    /cdn\.fontshare\.com/,
    /ResizeObserver loop/,
  ];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!harmless.some((p) => p.test(text))) errors.push(text);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${String(err)}`);
  });
  return {
    get errors() { return errors; },
    assertNone() {
      if (errors.length > 0) throw new Error(`Console errors: ${errors.slice(0, 3).join(' | ')}`);
    },
  };
}

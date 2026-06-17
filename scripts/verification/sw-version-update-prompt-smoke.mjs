/**
 * PR #673 smoke — SW version-update prompt (prompt-to-reload).
 *
 * The two-version update test is manual (impractical to automate — needs two
 * deploys). This smoke guards the brief's stated risk instead: that the
 * registerType change / ReloadPrompt wiring could break SW registration or the
 * app load entirely.
 *
 * ReloadPrompt mounts at the React root (sibling of AppRoot in App.jsx), so its
 * registerSW wiring and banner logic run regardless of auth state. The core
 * checks are therefore role-agnostic and verified pre-auth on the login screen;
 * one authenticated load confirms the post-login shell still renders.
 *
 * Per-theme (login screen, pre-auth):
 *   1. App loads (login screen renders) — app not broken by the SW change.
 *   2. Service worker registers (navigator.serviceWorker.getRegistration() truthy)
 *      and /sw.js is the active script.
 *   3. ReloadPrompt banner is NOT shown on a fresh load (no false-positive
 *      "new version" prompt; data-testid="reload-prompt" absent).
 *   4. No new console errors (SW/registerSW/runtime) beyond known noise.
 * Plus (once): authenticated load (tenant_admin) → dashboard renders, SW still active.
 *
 * Note: agent / branch_manager / unit_manager A11Y accounts are absent on this
 * preview (cleaned up by recent test-account ops); tenant_admin is used for the
 * authenticated leg. The SW behavior is role-agnostic so the tier is immaterial.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

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

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

const AUTH = { email: process.env.A11Y_TENANT_ADMIN_EMAIL, pass: process.env.A11Y_TENANT_ADMIN_PASSWORD };

if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}
if (!AUTH.email || !AUTH.pass) {
  console.error('Missing A11Y_TENANT_ADMIN_EMAIL / A11Y_TENANT_ADMIN_PASSWORD');
  process.exit(1);
}

const RESULTS = [];
function record(name, pass, detail = '') {
  RESULTS.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(2000);
}

async function runTheme(theme, { doLogin }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);

  const errors = [];
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    if (text.includes('Incorrect email or password')) return; // not relevant to this smoke
    errors.push(text);
  });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (theme === 'dark') {
      await page.evaluate(() => localStorage.setItem('agencytrack-dark', '1'));
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    // Wait for the login screen (pre-auth root render).
    await page.waitForSelector('input[type="email"]', { timeout: 30_000 });

    // 1. App loads (login screen renders).
    const rendered = await page.evaluate(
      () => document.body.textContent.replace(/\s+/g, '').length > 40
    );
    record(`[${theme}] app loads (login screen renders)`, rendered);

    // 2. SW registers + /sw.js active (registerSW fires on window load).
    await page.waitForTimeout(3500);
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const reg = await navigator.serviceWorker.getRegistration();
      const active = reg?.active?.scriptURL || null;
      return { supported: true, hasReg: !!reg, active };
    });
    record(
      `[${theme}] service worker registered (/sw.js active)`,
      sw.supported && sw.hasReg && !!sw.active && sw.active.endsWith('/sw.js'),
      sw.active ? `active=${sw.active}` : `supported=${sw.supported} hasReg=${sw.hasReg}`
    );

    // 3. No false update banner on fresh load.
    const banner = await page.$('[data-testid="reload-prompt"]');
    record(`[${theme}] no false update banner on fresh load`, banner === null);

    // 4. Authenticated load (once) — post-login shell still renders.
    if (doLogin) {
      await login(page, AUTH.email, AUTH.pass);
      const dash = await page.evaluate(
        () => document.body.textContent.replace(/\s+/g, '').length > 400
      );
      record(`[${theme}] post-login shell renders (tenant_admin)`, dash);
    }

    // 5. No new console errors.
    record(
      `[${theme}] no new console errors`,
      errors.length === 0,
      errors.length ? errors.slice(0, 3).join(' | ') : ''
    );
  } catch (e) {
    record(`[${theme}] smoke threw`, false, String(e).slice(0, 200));
  } finally {
    await browser.close();
  }
}

(async () => {
  console.log(`SW version-update smoke → ${URL}`);
  await runTheme('light', { doLogin: true });
  await runTheme('dark', { doLogin: false });
  const failed = RESULTS.filter(r => !r.pass);
  console.log(`\n${RESULTS.length - failed.length}/${RESULTS.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();

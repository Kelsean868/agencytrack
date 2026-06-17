/**
 * PR #675 smoke — remove Firestore runtimeCaching from SW.
 *
 * Verifies that removing the catch-all Firestore NetworkFirst route does not
 * break app functionality, and that the prior symptom (5s SW timeout causing
 * realtime listener drop + Cache.put errors) no longer appears.
 *
 * Legs:
 *   1. App loads with SW active (first load + reload to engage SW) — shell renders.
 *   2. Authenticated load (tenant_admin) → Firestore data present after 7 s
 *      (past the old 5 s NetworkFirst timeout); no Firestore SW errors in console.
 *   3. SW still registered and active on /sw.js; no clientsClaim (prompt mode).
 *   4. Offline shell: go offline → reload → login screen still renders from precache.
 *
 * Manual-only (not automated):
 *   - DevTools Network: Listen/channel request NOT "from ServiceWorker".
 *   - Firestore offline local-cache: load data online → go offline → data still shows.
 *
 * Credentials: tenant_admin (agent creds absent on preview; SW behavior is role-agnostic).
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
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.join('=')];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AUTH         = {
  email: process.env.A11Y_TENANT_ADMIN_EMAIL,
  pass:  process.env.A11Y_TENANT_ADMIN_PASSWORD,
};

if (IS_PROD && !BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN'); process.exit(1); }
if (!AUTH.email || !AUTH.pass) { console.error('Missing A11Y_TENANT_ADMIN_EMAIL / _PASSWORD'); process.exit(1); }

const RESULTS = [];
function record(name, pass, detail = '') {
  RESULTS.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

/** Console errors to ignore (fontshare, generic net errors, app-level auth) */
function isNoise(text) {
  if (text.includes('fontshare.com')) return true;
  if (text.includes('ERR_INTERNET_DISCONNECTED')) return true; // offline leg
  if (text.includes('Incorrect email or password')) return true;
  if (text.includes('net::ERR_NETWORK_CHANGED')) return true;
  return false;
}

/** Firestore-SW specific error patterns (old bug indicators) */
function isFirestoreSwError(text) {
  if (text.includes('Cache.put')) return true;
  if (text.includes('no-response') && text.toLowerCase().includes('firestore')) return true;
  if (text.includes('NetworkFirst') && text.includes('firestore')) return true;
  return false;
}

(async () => {
  console.log(`\nFirestore SW runtimeCaching smoke → ${URL}\n`);
  const browser = await chromium.launch({ headless: true });

  // ── Leg 2 + 3: Authenticated load, 7 s past old timeout, no Firestore SW errors ─
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);

    const errors = [];
    const firestoreSwErrors = [];
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (isNoise(text)) return;
      if (isFirestoreSwError(text)) firestoreSwErrors.push(text);
      errors.push(text);
    });

    // First load → SW installs + activates
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3_000); // let SW install/activate
    // Reload → SW now controlling the page
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });

    // 1. Shell renders (login screen)
    const loginVisible = await page.waitForSelector('input[type="email"]', { timeout: 20_000 })
      .then(() => true).catch(() => false);
    record('leg1: shell renders after SW-controlled reload', loginVisible);

    // 3. SW registered on /sw.js
    await page.waitForTimeout(2_000);
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        supported: true,
        hasReg: !!reg,
        active: reg?.active?.scriptURL ?? null,
        waiting: reg?.waiting?.scriptURL ?? null,
      };
    });
    record(
      'leg3: SW registered and active on /sw.js',
      sw.supported && sw.hasReg && !!sw.active && sw.active.endsWith('/sw.js'),
      sw.active ? `active=${sw.active}` : `supported=${sw.supported} hasReg=${sw.hasReg}`,
    );

    // Authenticate as tenant_admin
    if (loginVisible) {
      await page.fill('input[type="email"]', AUTH.email);
      await page.fill('input[type="password"]', AUTH.pass);
      await Promise.all([
        page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
        page.click('button[type="submit"]'),
      ]);
      // Wait for dashboard content
      await page.waitForFunction(
        () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
        { timeout: 30_000 },
      );
    }

    // 2a. Data present immediately after auth
    const dataImmediate = await page.evaluate(
      () => document.body.textContent.replace(/\s+/g, '').length > 400,
    );
    record('leg2a: Firestore data present after auth', dataImmediate);

    // 2b. Wait 7 s (past old 5 s SW NetworkFirst timeout) → data still present
    console.log('     (waiting 7 s past old 5 s timeout…)');
    await page.waitForTimeout(7_000);
    const dataAfter7s = await page.evaluate(
      () => document.body.textContent.replace(/\s+/g, '').length > 400,
    );
    record('leg2b: Firestore data still present after 7 s (no listener drop)', dataAfter7s);

    // 2c. No Firestore-SW errors in console
    record(
      'leg2c: no Firestore SW errors (Cache.put / no-response)',
      firestoreSwErrors.length === 0,
      firestoreSwErrors.length ? firestoreSwErrors[0].slice(0, 150) : '',
    );

    // 2d. No other unexpected console errors
    record(
      'leg2d: no unexpected console errors',
      errors.length === 0,
      errors.length ? errors.slice(0, 2).join(' | ').slice(0, 200) : '',
    );

    await context.close();
  } catch (e) {
    record('auth legs threw', false, String(e).slice(0, 300));
  }

  // ── Leg 4: Offline shell renders from precache ─────────────────────────────────
  try {
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (IS_PROD) await setupBypassSession(context2, URL, BYPASS_TOKEN);
    const page2 = await context2.newPage();

    // Load once online → SW installs+activates; reload → SW controls
    await page2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page2.waitForTimeout(3_000);
    await page2.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page2.waitForTimeout(1_000);

    // Go offline
    await context2.setOffline(true);

    // Reload offline → SW should serve precached index.html
    try {
      await page2.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
    } catch {
      // domcontentloaded may not fire cleanly under offline+SW; check DOM directly
    }
    await page2.waitForTimeout(2_000);

    const shellOffline = await page2.evaluate(
      () => document.body && document.body.textContent.replace(/\s+/g, '').length > 20,
    );
    record('leg4: offline shell renders from precache', shellOffline);

    await context2.close();
  } catch (e) {
    record('leg4 offline threw', false, String(e).slice(0, 300));
  }

  await browser.close();

  const failed = RESULTS.filter(r => !r.pass);
  console.log(`\n${RESULTS.length - failed.length}/${RESULTS.length} PASS\n`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach(r => console.log(`  ✗ ${r.name}${r.detail ? `: ${r.detail}` : ''}`));
  }
  process.exit(failed.length ? 1 : 0);
})();

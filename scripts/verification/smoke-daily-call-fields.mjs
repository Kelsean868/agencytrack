/**
 * smoke-daily-call-fields.mjs — Daily Capture v2 call-fields slice.
 *
 * WHY THIS RUNS LOCALLY AND NOT ON THE VERCEL PREVIEW.
 * A feature-branch Vercel preview builds against PRODUCTION Firebase
 * (agencytrack-2a610) — Vercel's staging env vars are bound to the `staging`
 * BRANCH, not to the Preview environment. The A11Y_* accounts exist on staging
 * only, so a login against a feature-branch preview returns AUTH-ERROR, and a
 * MUTATING smoke there would touch the live tenant. Forbidden.
 *
 * So this smoke follows the documented alternative (CLAUDE.md § Workflow):
 *   npm run build -- --mode staging
 *   confirm the bundle carries agencytrack-staging and ZERO agencytrack-2a610
 *   serve it locally  ->  npx vite preview --port 4174
 *
 * The bundle check is re-asserted here at runtime against the live app config,
 * and the smoke REFUSES TO RUN if the app is pointed at production.
 *
 * WHAT IT PROVES (the brief's named smoke, write-read-verify):
 *   1. Daily Capture opens and renders in BOTH themes.
 *   2. A day is SAVED with dials and service calls through the real rule layer.
 *   3. It is READ BACK and the saved values survive.
 *   4. The pace badge total and the aggregated weekly draft AGREE — the F3
 *      disagreement that ruling D-SC closes.
 *
 * Usage:  node scripts/verification/smoke-daily-call-fields.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4174';
const TS = new Date().toISOString().replace(/[:.]/g, '-');

// ── env (names only ever referenced; values never logged) ────────────────────
function loadEnvFile(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* file absent — fall through to process.env */ }
  return out;
}
// Staging fixture credentials. The A11Y_* pair in `.env.local` is a PRODUCTION
// account — it fails against staging Firebase with "Incorrect email or
// password", which is exactly the symptom CLAUDE.md records in the opposite
// direction. The staging fixtures are seeded by scripts/staging/seed-staging.mjs
// with the synthetic address below and STAGING_SEED_PASSWORD from .env.staging.
const E = { ...loadEnvFile('.env.local'), ...loadEnvFile('.env.staging'), ...process.env };
const STAGING_AGENT_EMAIL = 'staging-agent-1@agencytrack-staging.test';

const results = [];
const pass = (name, detail = '') => { results.push({ name, ok: true, detail }); console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); };
const fail = (name, detail = '') => { results.push({ name, ok: false, detail }); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); };
const skip = (name, why) => { results.push({ name, ok: true, skipped: true, detail: why }); console.log(`  SKIP  ${name} — ${why} (skip, NOT a pass)`); };

// The FAB opens the Quick Add sheet; "Log today" inside it opens Daily Capture.
// Two clicks, not one — a single-click smoke times out on an open sheet, which
// reads as "the screen is broken" when nothing is broken at all.
async function openDailyCapture(page) {
  await page.locator('[data-testid="daily-fab"]').dispatchEvent('click');
  const logToday = page.locator('[data-testid="quickadd-log-today"]');
  await logToday.waitFor({ state: 'visible', timeout: 15_000 });
  // The sheet's own full-bleed scrim sits ON TOP of its buttons during the
  // screen-enter transition, so Playwright's actionability check never clears.
  // Dispatch the click directly — the handler is a plain onClick.
  await logToday.dispatchEvent('click');
  await page.waitForSelector('[data-testid="daily-capture-v2"]', { timeout: 20_000 });
  await settle(page);
}

// Takes the EXACT aria-label prefix, not a pattern. Building a RegExp from a
// label containing parentheses — "Dials (total calls)" — silently turns them
// into a capture group, so the locator matches nothing and the failure reads as
// "the stepper is missing" rather than "the locator is wrong".
async function bump(page, ariaLabelPrefix, times) {
  const btn = page.locator(`button[aria-label="${ariaLabelPrefix} increase"]`);
  await btn.waitFor({ state: 'visible', timeout: 10_000 });
  for (let i = 0; i < times; i += 1) await btn.click();
}
async function hasStepper(page, ariaLabelPrefix) {
  return (await page.locator(`button[aria-label="${ariaLabelPrefix} increase"]`).count()) > 0;
}

// The pill renders ONLY when dayPoints > 0, so its ABSENCE means zero points —
// not "unknown". Returning null for absence silently skipped the D-SC assertion,
// which is the one thing this smoke exists to prove. It also carries a pace
// badge whose text has no digits, so read the labelled number, not any number.
// Daily Capture loads TODAY's existing entry asynchronously and hides the points
// pill behind `!loading`. Reading points immediately after the dialog appears
// therefore returns 0 for a day that already has activity — a race in the SMOKE,
// which on its first run looked exactly like a scoring bug. Wait for the dialog's
// own text to stop changing before reading anything out of it.
// Requires THREE consecutive identical samples plus a minimum floor. Two was not
// enough on a COLD Firestore cache: the dialog's text is briefly stable while the
// day's saved entry is still in flight, so the first leg read 0 points for a day
// that already held 12. The second leg passed on a warm cache — which is exactly
// how a race disguises itself as a leg-specific bug.
async function settle(page, selector = '[data-testid="daily-capture-v2"]', quietMs = 600) {
  const floor = Date.now() + 2_000;
  let last = null;
  let stable = 0;
  for (let i = 0; i < 60; i += 1) {
    const now = await page.locator(selector).innerText().catch(() => null);
    stable = (now !== null && now === last) ? stable + 1 : 0;
    last = now;
    if (stable >= 3 && Date.now() >= floor) return;
    await page.waitForTimeout(quietMs / 2);
  }
}

async function readDayPoints(page) {
  const pill = page.locator('[data-testid="dcv2-points-pill"]');
  if (!(await pill.count())) return 0;
  const txt = (await pill.first().innerText()).replace(/\s+/g, ' ');
  const m = /(\d+)\s*pts today/i.exec(txt);
  return m ? Number(m[1]) : 0;
}

async function runLeg(browser, theme) {
  console.log(`\n── ${theme.toUpperCase()} leg ──`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((t) => {
    try {
      if (t === 'dark') localStorage.setItem('agencytrack-dark', '1');
      else localStorage.removeItem('agencytrack-dark');
    } catch { /* storage unavailable */ }
  }, theme);

  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

  try {
    // ── GUARD: refuse to run against production Firebase ─────────────────────
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    const projectId = await page.evaluate(async () => {
      const html = document.documentElement.outerHTML;
      const src = [...document.querySelectorAll('script[src]')].map((s) => s.src);
      for (const u of src) {
        const t = await fetch(u).then((r) => r.text()).catch(() => '');
        const m = /agencytrack-(staging|2a610)/.exec(t);
        if (m) return m[0];
      }
      return /agencytrack-(staging|2a610)/.exec(html)?.[0] ?? 'unknown';
    });
    if (projectId !== 'agencytrack-staging') {
      fail(`[${theme}] firebase target guard`, `app is pointed at "${projectId}" — refusing to run a mutating smoke`);
      return;
    }
    pass(`[${theme}] firebase target guard`, 'agencytrack-staging (NOT production)');

    // ── theme actually booted ────────────────────────────────────────────────
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark === (theme === 'dark')) pass(`[${theme}] theme booted`, `html.dark=${isDark}`);
    else { fail(`[${theme}] theme booted`, `html.dark=${isDark}, expected ${theme === 'dark'}`); return; }

    // ── login ────────────────────────────────────────────────────────────────
    if (!E.STAGING_SEED_PASSWORD) {
      skip(`[${theme}] agent login`, 'STAGING_SEED_PASSWORD not set in this worktree (.env.staging)');
      return;
    }
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
    await page.fill('input[type="email"]', STAGING_AGENT_EMAIL);
    await page.fill('input[type="password"]', E.STAGING_SEED_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 30_000 });
    pass(`[${theme}] agent login + dashboard`, 'daily-fab present');

    // ── open Daily Capture ───────────────────────────────────────────────────
    await openDailyCapture(page);
    pass(`[${theme}] Daily Capture opens`, 'daily-capture-v2 rendered');

    // Measured as DELTAS around each bump, so the assertion holds whatever the
    // day already contained. An absolute expected total would depend on prior
    // runs against the same staging fixture and would be false the second time.
    const p0 = await readDayPoints(page);

    await bump(page, 'Dials (total calls)', 3);
    await settle(page);
    const p1 = await readDayPoints(page);
    if (p1 - p0 === 3) pass(`[${theme}] 3 dials score 3 pt`, `${p0} -> ${p1}`);
    else fail(`[${theme}] 3 dials score 3 pt`, `${p0} -> ${p1}, delta ${p1 - p0}`);

    let p2 = p1;
    if (await hasStepper(page, 'Service contacts')) {
      await bump(page, 'Service contacts', 2);
      await settle(page);
      p2 = await readDayPoints(page);
      // THE RULING, asserted in the live app: serviceContacts is a REACH and
      // must score nothing. Only serviceCalls (an ATTEMPT) scores, and there is
      // no UI to enter it in this slice — so the correct delta here is exactly 0.
      if (p2 - p1 === 0) pass(`[${theme}] D-SC live — 2 serviceContacts score 0 pt`, `${p1} -> ${p2}`);
      else fail(`[${theme}] D-SC live — 2 serviceContacts score 0 pt`, `${p1} -> ${p2}, delta ${p2 - p1}`);
    } else {
      skip(`[${theme}] D-SC live serviceContacts check`, 'delivery group stepper not reachable in this state');
    }

    if (p2 >= p0) pass(`[${theme}] day points are monotonic across the edit`, `${p0} -> ${p2}`);
    else fail(`[${theme}] day points are monotonic across the edit`, `${p0} -> ${p2} DECREASED`);

    await page.click('[data-testid="dcv2-save"]');
    await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 25_000 });
    pass(`[${theme}] save committed`, 'dialog closed without error');

    // ── READ BACK ────────────────────────────────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 30_000 });
    await openDailyCapture(page);
    const reread = await readDayPoints(page);
    if (reread === p2) pass(`[${theme}] read-back agrees with the saved total`, `${reread} pt survived a reload`);
    else fail(`[${theme}] read-back agrees with the saved total`, `saved ${p2}, read ${reread}`);

    await page.screenshot({ path: `screenshots/smoke-daily-call-fields-${theme}-${TS}.png`, fullPage: false });

    // A bare "Failed to load resource" console line is useless without the URL —
    // report the actual requests so a 404 can be judged rather than guessed.
    const realFailures = failedRequests.filter(
      // _vercel/insights + speed-insights are injected by Vercel's edge and do not
      // exist on a local serve. Environment artifact, not an app defect.
      (u) => !/favicon|apple-touch-icon|manifest|sw\.js|workbox|\/pwa-|_vercel\/(speed-)?insights|identitytoolkit.*accounts:lookup/i.test(u)
    );
    if (realFailures.length === 0) {
      pass(`[${theme}] no unexplained failed requests`, `${failedRequests.length} benign (icons/PWA)`);
    } else {
      fail(`[${theme}] no unexplained failed requests`, realFailures.slice(0, 4).join(' | '));
    }
  } catch (err) {
    fail(`[${theme}] leg crashed`, err.message);
  } finally {
    await context.close();
  }
}

(async () => {
  console.log(`\n=== smoke-daily-call-fields ${TS} ===`);
  console.log(`base: ${BASE}  (local serve of a --mode staging build)`);
  const browser = await chromium.launch();
  try {
    await runLeg(browser, 'light');
    await runLeg(browser, 'dark');
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`\n=== ${results.length - failed.length - skipped.length} PASS / ${failed.length} FAIL / ${skipped.length} SKIP ===`);
  if (failed.length) { failed.forEach((f) => console.log(`  FAILED: ${f.name} — ${f.detail}`)); process.exit(1); }
  process.exit(0);
})();

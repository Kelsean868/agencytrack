/**
 * BUG-N3 smoke — verify Production Report renders unit names, not raw Firestore UIDs.
 *
 * Checks:
 *   01  Login as branch_manager → dashboard loads
 *   02  Click Production Report tab → view loads
 *   03  Screenshot at 1440x900 (desktop)
 *   04  Programmatic check: no UID-like strings (≥20 alnum) in unit leaderboard text
 *   05  Screenshot at 390x844 (mobile)
 *   06  Dark mode — screenshot at 1440x900
 *
 * Run from project root:
 *   node scripts/verification/bug-n3-smoke.mjs
 *
 * Override preview host:
 *   PREVIEW_HOST=agencytrack-git-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/bug-n3-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD
 *
 * Artifacts: verification/bug-n3/ (gitignored).
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { buildBypassUrl, safeLog, waitForFirebaseReady } from './lib/walk-helpers.mjs';

const SS_DIR      = resolve(process.cwd(), 'verification/bug-n3');
const RESULTS_FILE = resolve(SS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv(p) {
  try {
    const src = readFileSync(p, 'utf8');
    const env = {};
    src.split('\n').forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k) env[k] = v;
    });
    return env;
  } catch { return {}; }
}

const env          = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL     = env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD  = env.A11Y_BRANCH_MANAGER_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-fix-bug-n3-production-report-unit-names-kyron-marchan-s-projects.vercel.app';

if (!BYPASS_TOKEN)             { console.error('VERCEL_BYPASS_TOKEN not found in .env.local'); process.exit(1); }
if (!BM_EMAIL || !BM_PASSWORD) { console.error('A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not found'); process.exit(1); }

const BASE_URL = `https://${PREVIEW_HOST}`;

// ── helpers ──────────────────────────────────────────────────────────────────
const UID_RE = /\b[A-Za-z0-9]{20,}\b/g;

const results = [];
let strikes = 0;

function pass(id, label) {
  console.log(`✅ ${id.toString().padStart(2, '0')}  ${label}`);
  results.push({ id, label, status: 'pass' });
}

function fail(id, label, detail) {
  console.error(`❌ ${id.toString().padStart(2, '0')}  ${label} — ${detail}`);
  results.push({ id, label, status: 'fail', detail });
  strikes++;
}

async function login(page) {
  const bypassUrl = buildBypassUrl(BASE_URL, BYPASS_TOKEN);
  await page.goto(bypassUrl, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  await page.fill('input[type="email"]', BM_EMAIL);
  await page.fill('input[type="password"]', BM_PASSWORD);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
}

async function clickProductionReportTab(page) {
  // Try the tab by text content — matches both AgentDashboard and ManagerDashboard labels
  const tab = page.getByRole('tab', { name: /production report/i });
  if (await tab.count() > 0) {
    await tab.click();
  } else {
    // Fallback: button with matching text
    await page.click('button:has-text("Production Report")');
  }
  // Wait for the Production Report heading to appear
  await page.waitForSelector('h2:has-text("Production Report")', { timeout: 10_000 });
}

// ── main ─────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page    = await ctx.newPage();

// ── 01  Login ─────────────────────────────────────────────────────────────────
try {
  await login(page);
  const nav = await page.$('nav[aria-label="Primary navigation"]');
  if (!nav) throw new Error('Primary nav not found after login');
  pass(1, 'Login as branch_manager → dashboard loads');
} catch (e) {
  fail(1, 'Login as branch_manager → dashboard loads', e.message);
  await browser.close();
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  process.exit(1);
}

// ── 02  Production Report tab ────────────────────────────────────────────────
try {
  await clickProductionReportTab(page);
  pass(2, 'Production Report tab → view loads');
} catch (e) {
  fail(2, 'Production Report tab → view loads', e.message);
  await page.screenshot({ path: resolve(SS_DIR, '02-tab-fail.png'), fullPage: false });
  await browser.close();
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  process.exit(1);
}

// ── 03  Desktop screenshot ────────────────────────────────────────────────────
await page.screenshot({ path: resolve(SS_DIR, '03-desktop-1440.png'), fullPage: false });
pass(3, 'Screenshot captured at 1440×900');

// ── 04  Programmatic UID check ────────────────────────────────────────────────
try {
  const unitLeaderboardText = await page.evaluate(() => {
    // Find the Unit Leaderboard card by its heading text
    const headings = [...document.querySelectorAll('p')];
    const heading = headings.find(p => /unit leaderboard/i.test(p.textContent));
    if (!heading) return '';
    // Walk up to the card container and grab its text
    const card = heading.closest('.card') ?? heading.parentElement;
    return card ? card.innerText : '';
  });

  const uidMatches = unitLeaderboardText.match(UID_RE) ?? [];
  // Filter out known-OK long strings (currency amounts formatted without commas won't hit this, but be safe)
  const suspectUids = uidMatches.filter(m => /^[A-Za-z0-9]{20,}$/.test(m));

  if (suspectUids.length > 0) {
    safeLog('Suspect UID-like strings found in Unit Leaderboard:', suspectUids.join(', '));
    fail(4, 'No UID-like strings in Unit Leaderboard text', `found ${suspectUids.length}: ${suspectUids.map(() => '[REDACTED]').join(', ')}`);
  } else {
    pass(4, 'No UID-like strings in Unit Leaderboard text — fix confirmed');
  }
} catch (e) {
  fail(4, 'Programmatic UID check', e.message);
}

// ── 05  Mobile screenshot ─────────────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: resolve(SS_DIR, '05-mobile-390.png'), fullPage: false });
pass(5, 'Screenshot captured at 390×844 (mobile)');
await page.setViewportSize({ width: 1440, height: 900 });

// ── 06  Dark mode screenshot ──────────────────────────────────────────────────
try {
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await page.screenshot({ path: resolve(SS_DIR, '06-dark-mode-1440.png'), fullPage: false });
  pass(6, 'Dark mode screenshot at 1440×900');
} catch (e) {
  fail(6, 'Dark mode screenshot', e.message);
}

// ── summary ───────────────────────────────────────────────────────────────────
await browser.close();
writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

const passCount = results.filter(r => r.status === 'pass').length;
const failCount = results.filter(r => r.status === 'fail').length;
console.log(`\n─────────────────────────────────`);
console.log(`BUG-N3 smoke: ${passCount}/6 pass, ${failCount} fail`);
console.log(`Artifacts: verification/bug-n3/`);
if (failCount > 0) process.exit(1);

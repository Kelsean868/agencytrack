/**
 * Track J banner-rehome smoke — WeeklyChampionsBanner on ProductionLeaderboardSurface.
 *
 * Per the brief Phase 3f: live data is honest-empty (prior week has no
 * submissions in the test tenant — the CF correctly writes a doc with
 * all-null payload). Smoke asserts the wiring lives:
 *
 *   1. Banner mounts on the surface (3 [data-testid="champion-card"] elements).
 *   2. Banner appears ABOVE the period chips (DOM order).
 *   3. The "No submissions recorded last week" subtitle is shown (banner's
 *      honest-empty path — now truthful, not rules-denied).
 *   4. Zero console errors (the doc read does NOT throw — proves rules +
 *      doc-key + read path are all correct end-to-end).
 *   5. Both themes.
 *
 * The populated case (with name + value + non-empty subtitle) is component-
 * tested in BannerRehome.test.jsx — live test tenant doesn't seed real
 * prior-week production.
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
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');
  process.exit(1);
}
if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

const RESULTS = [];

async function login(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(1500);
}

async function smokeTheme(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors  = [];

  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }

    await page.click('[data-testid="agent-tab-leaderboard"]');
    await page.waitForSelector('[data-testid="production-leaderboard-surface"]', { timeout: 15_000 });
    // Give the weeklyChampions getDoc time to resolve.
    await page.waitForTimeout(1500);

    const surface = page.locator('[data-testid="production-leaderboard-surface"]');

    // ── 1. Banner mounted? → 3 champion-card testids inside the surface.
    const championCardCount = await surface.locator('[data-testid="champion-card"]').count();

    // ── 2. Banner ABOVE the period chips? → DOM-order check.
    const bannerThenChips = await page.evaluate(() => {
      const surface = document.querySelector('[data-testid="production-leaderboard-surface"]');
      if (!surface) return null;
      const cards   = surface.querySelectorAll('[data-testid="champion-card"]');
      const tablist = surface.querySelector('[role="tablist"]');
      if (cards.length === 0 || !tablist) return null;
      const banner  = cards[0].closest('div.rounded-xl');
      if (!banner) return null;
      // DOCUMENT_POSITION_FOLLOWING bit set → banner comes BEFORE tablist.
      return !!(banner.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING);
    });

    // ── 3. Honest-empty subtitle visible (doc IS empty in test tenant).
    const subtitleCount = await surface.locator(
      'text=/No submissions recorded last week/i'
    ).count();

    // ── 4. "No data yet" in each champion card.
    const noDataYetCount = await surface.locator('text=/No data yet/').count();

    const pass = (
      championCardCount === 3 &&
      bannerThenChips === true &&
      subtitleCount >= 1 &&
      noDataYetCount >= 3 &&
      errors.length === 0
    );

    RESULTS.push({
      theme,
      championCardCount, bannerThenChips,
      subtitleCount, noDataYetCount,
      errors: errors.length, pass,
    });

    console.log(`[${theme}] champion-cards=${championCardCount} banner-above-chips=${bannerThenChips} subtitle=${subtitleCount} no-data-yet=${noDataYetCount} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

console.log(`\nTrack J banner-rehome smoke`);
console.log(`Target: ${URL}\n`);

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nBanner-rehome smoke: ${allPass ? `✓ ${RESULTS.length}/${RESULTS.length} PASS` : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

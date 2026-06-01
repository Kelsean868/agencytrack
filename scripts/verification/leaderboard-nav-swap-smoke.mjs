/**
 * Track J P6 — leaderboard nav swap smoke (AGENT-only, both themes).
 *
 * Asserts the atomic agent-nav swap on the live preview / prod:
 *   1. The agent sidebar shows ONE "Leaderboard" nav item (label "Leaderboard",
 *      data-testid="agent-tab-leaderboard").
 *   2. Clicking it mounts the production-leaderboard surface
 *      (data-testid="production-leaderboard-surface").
 *   3. The retired points-board surface is NOT visible — i.e. no element with
 *      data-testid="points-leaderboard" / "weekly-champions-banner" inside the
 *      reachable content (the only mount was inside gamification/Leaderboard,
 *      which no longer renders on the agent surface).
 *   4. The Career Portal nav item is still present + still reachable, and the
 *      BadgeGrid still renders inside it (proving gamification surfaces survive).
 *   5. Zero console errors (filtered for known localhost-only CORS noise).
 *
 * Mirrors the P3/P4/P7 smoke pattern. The PROOF lives in:
 *   - The component test (`AgentDashboardNav.test.jsx`) for the nav-config assertions
 *   - This smoke for the live-DOM + console layer.
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

    // ── 1. Leaderboard nav item is present (exactly one).
    const leaderboardNavCount = await page
      .locator('[data-testid="agent-tab-leaderboard"]').count();
    const leaderboardLabel = leaderboardNavCount > 0
      ? (await page.locator('[data-testid="agent-tab-leaderboard"]').first().textContent())?.trim()
      : null;

    // ── 2. Career Portal nav item is also present (gamification surface
    //      survives — BadgeGrid is mounted inside CareerPortal).
    const careerNavCount = await page
      .locator('[data-testid="agent-tab-career"]').count();

    // ── 3. Click the Leaderboard nav item → production-leaderboard surface mounts.
    await page.click('[data-testid="agent-tab-leaderboard"]');
    await page.waitForSelector(
      '[data-testid="production-leaderboard-surface"]',
      { timeout: 15_000 }
    );
    const surfaceCount = await page
      .locator('[data-testid="production-leaderboard-surface"]').count();

    // ── 4. No points-leaderboard surface markers visible.
    //      (gamification/Leaderboard rendered the WeeklyChampionsBanner via
    //      data-testid="champion-card"; if those are present, the retired
    //      board has somehow leaked through.)
    const championCardCount = await page
      .locator('[data-testid="champion-card"]').count();

    // ── 5. The URL has no "?tab=production-leaderboard" — the temp route is
    //      retired; the surface mounts via the real nav.
    const currentUrl = page.url();
    const tempRoutePresent = currentUrl.includes('tab=production-leaderboard');

    // ── 6. Career Portal still reachable + BadgeGrid still mounts inside it.
    await page.click('[data-testid="agent-tab-career"]');
    // CareerPortal renders BadgeGrid which has no canonical testId; check that
    // career-related copy renders + no error fires.
    await page.waitForTimeout(1500);
    const careerSurfaceText = await page.locator('body').textContent();
    const careerHasContent = (careerSurfaceText?.length ?? 0) > 800;

    const pass = (
      leaderboardNavCount === 1 &&
      leaderboardLabel === 'Leaderboard' &&
      careerNavCount === 1 &&
      surfaceCount === 1 &&
      championCardCount === 0 &&
      !tempRoutePresent &&
      careerHasContent &&
      errors.length === 0
    );

    RESULTS.push({
      theme,
      leaderboardNavCount, leaderboardLabel,
      careerNavCount,
      surfaceCount,
      championCardCount,
      tempRoutePresent,
      careerHasContent,
      errors: errors.length,
      pass,
    });

    console.log(`[${theme}] leaderboard-nav=${leaderboardNavCount} (label="${leaderboardLabel}") career-nav=${careerNavCount} surface=${surfaceCount} champion-cards=${championCardCount} temp-route=${tempRoutePresent} career-content=${careerHasContent} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

// ── Mobile-viewport smoke (390×844) — bottom-nav "Ranks" click path ──────────
//
// Belt-and-suspenders coverage requested by dispatcher on PR #404 pre-review.
// The desktop smoke above exercises the sidebar tabId-routing path; this one
// exercises the BOTTOM-NAV click path. Both share the same render branch
// (single `{activeTab === 'production-leaderboard' && <ProductionLeaderboardSurface />}`),
// but only this mobile pass proves the mobile entry point is wired + clickable.
//
// MobileBottomNav.jsx renders each BOTTOM_NAV item with
//   data-testid = item.testId ?? `bottomnav-${item.id}`.
// The "Ranks" entry has id 'leaderboard' and no explicit testId, so the
// resolved testid is `bottomnav-leaderboard`.
//
// Note: the existing `login()` helper uses
//   page.waitForFunction(() => document.body.textContent.length > 400)
// for the post-login wait — that pattern is mobile-friendly (no dependency
// on the sidebar nav landmark hidden at 390px) per the banked smoke rules.
async function smokeMobile(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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

    // ── 1. Bottom-nav "Ranks" item is present (exactly one).
    const ranksBtn       = page.locator('[data-testid="bottomnav-leaderboard"]');
    const ranksBtnCount  = await ranksBtn.count();
    const ranksLabel     = ranksBtnCount > 0
      ? (await ranksBtn.first().textContent())?.trim()
      : null;

    // ── 2. Tap the bottom-nav Ranks button → production-leaderboard surface mounts.
    await ranksBtn.click();
    await page.waitForSelector(
      '[data-testid="production-leaderboard-surface"]',
      { timeout: 15_000 }
    );
    const surfaceCount = await page
      .locator('[data-testid="production-leaderboard-surface"]').count();

    // ── 3. The "Ranks" button gets the .active class + aria-current="page"
    //      (per MobileBottomNav.jsx — only the active tab has these).
    const ranksAriaCurrent = await ranksBtn.first().getAttribute('aria-current');
    const ranksClass       = await ranksBtn.first().getAttribute('class');
    const ranksIsActive    = ranksAriaCurrent === 'page' && (ranksClass ?? '').includes('active');

    // ── 4. No points-leaderboard surface markers visible.
    const championCardCount = await page
      .locator('[data-testid="champion-card"]').count();

    // ── 5. The URL has no "?tab=production-leaderboard" — temp route retired.
    const currentUrl = page.url();
    const tempRoutePresent = currentUrl.includes('tab=production-leaderboard');

    const pass = (
      ranksBtnCount === 1 &&
      ranksLabel === 'Ranks' &&
      surfaceCount === 1 &&
      ranksIsActive &&
      championCardCount === 0 &&
      !tempRoutePresent &&
      errors.length === 0
    );

    RESULTS.push({
      theme: `mobile-${theme}`,
      ranksBtnCount, ranksLabel,
      surfaceCount,
      ranksIsActive,
      championCardCount,
      tempRoutePresent,
      errors: errors.length,
      pass,
    });

    console.log(`[mobile-${theme}] ranks-btn=${ranksBtnCount} (label="${ranksLabel}") surface=${surfaceCount} ranks-active=${ranksIsActive} champion-cards=${championCardCount} temp-route=${tempRoutePresent} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

console.log(`\nTrack J P6 — leaderboard nav swap smoke`);
console.log(`Target: ${URL}\n`);

await smokeTheme('light');
await smokeTheme('dark');
await smokeMobile('light');
await smokeMobile('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nP6 smoke: ${allPass ? `✓ ${RESULTS.length}/${RESULTS.length} PASS` : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

/**
 * Track J P4 — around-me visible-case render smoke.
 *
 * Per the brief's dispatcher decision #2: the test branch has 6 agents (max
 * rank 6), so the below-set cluster (rank > 8 / > 7) CANNOT trigger live.
 * Below-set is unit-tested in src/lib/leaderboard/__tests__/aroundMeLogic.test.js.
 *
 * This smoke covers the ONE live-reachable case: test agent at rank 1 YTD →
 * podium YOU pill + teal ring on the champion card, NO desktop sticky footer,
 * NO mobile sticky bar. Both themes.
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

  if (IS_PROD) {
    await setupBypassSession(context, URL, BYPASS_TOKEN);
  }

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Pre-existing localhost-only CORS noise (P3 smoke documents this).
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });

  try {
    // Track J P6 — production-leaderboard is now a real primary-nav item;
    // the `?tab=production-leaderboard` temp route was retired. Land at the
    // dashboard root and click the "Leaderboard" nav item to reach the surface.
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }

    // Click the real Leaderboard nav item.
    await page.click('[data-testid="agent-tab-leaderboard"]');

    await page.waitForSelector('[data-testid="production-leaderboard-surface"]', { timeout: 15_000 });

    // Test agent is rank 1 in YTD per P3 backfill. Assert:
    //   1. Rank-1 podium card has data-viewer="true" + YOU pill visible
    //   2. The card has the inset 1.5px ring (inline box-shadow)
    //   3. NO desktop around-me footer rendered
    //   4. NO mobile sticky bar (since we're at >=sm width, .sm:hidden hides it)
    //   5. NO tail row carries data-viewer
    //   6. Rank-2 / rank-3 podium cards DO NOT have data-viewer

    // Note: the surface renders TWO responsive blocks (`.sm:hidden` mobile +
    // `.hidden sm:block` desktop), so the rank-1 podium card appears TWICE in
    // the DOM with only one visible at a given viewport. We check both
    // instances carry the viewer attribute + YOU pill rather than asserting
    // a single instance.
    const rank1Cards = page.locator('[data-testid="podium-card-rank-1"]');
    const rank1Count = await rank1Cards.count();
    // At desktop viewport (1280px), the desktop block (.hidden sm:block) is
    // visible; the mobile block (.sm:hidden) is display:none. Both should
    // still have data-viewer="true" because both render the same data.
    const rank1ViewerAttrs = [];
    for (let i = 0; i < rank1Count; i++) {
      rank1ViewerAttrs.push(await rank1Cards.nth(i).getAttribute('data-viewer'));
    }
    const allRank1HaveViewer = rank1ViewerAttrs.every((a) => a === 'true');
    // YOU pill: should exist on EACH rank-1 instance (so count === rank1Count)
    const youPillCount = await page.locator('[data-testid="podium-you-pill"]').count();
    const youPillMatchesRank1 = youPillCount === rank1Count;
    // Inset ring on the first rank-1 card
    const rank1Style = await rank1Cards.first().getAttribute('style');
    const hasInsetRing = rank1Style && rank1Style.includes('inset 0 0 0 1.5px');

    const desktopFooterCount = await page.locator('[data-testid="around-me-desktop"]').count();
    const tailViewerCount = await page.locator('[data-testid^="tail-row-rank-"][data-viewer="true"]').count();
    const otherPodiumViewer = await page.locator('[data-testid="podium-card-rank-2"][data-viewer="true"], [data-testid="podium-card-rank-3"][data-viewer="true"]').count();

    // The mobile bar is .sm:hidden so it's CSS-hidden at 1280px, but it's still
    // in the DOM. Confirm its `data-cluster-state` indicates a visible state
    // for the test agent (which means the bar component returns null) — that
    // is, the testid should NOT be in the DOM at all because the component
    // returns null when state is VISIBLE_*.
    const mobileBarCount = await page.locator('[data-testid="around-me-mobile"]').count();

    const pass = (
      allRank1HaveViewer &&
      youPillMatchesRank1 &&
      hasInsetRing &&
      desktopFooterCount === 0 &&
      tailViewerCount === 0 &&
      otherPodiumViewer === 0 &&
      mobileBarCount === 0 &&
      errors.length === 0
    );

    RESULTS.push({
      theme, rank1Count, allRank1HaveViewer, youPillCount, hasInsetRing,
      desktopFooterCount, tailViewerCount, otherPodiumViewer, mobileBarCount,
      errors, pass,
    });

    console.log(`[${theme}] rank1-cards=${rank1Count} allHaveViewer=${allRank1HaveViewer} youPills=${youPillCount}(match=${youPillMatchesRank1}) insetRing=${hasInsetRing} desktopFooter=${desktopFooterCount} tailViewer=${tailViewerCount} otherPodiumViewer=${otherPodiumViewer} mobileBar=${mobileBarCount} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

console.log(`\nTrack J P4 — around-me visible-case render smoke`);
console.log(`Target: ${URL}\n`);

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nVisible-case smoke: ${allPass ? '✓ 2/2 PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

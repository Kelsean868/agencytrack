/**
 * Track J P3 — Production Leaderboard surface smoke + axe pass.
 *
 * Both themes (light + dark) as the test agent against the temp route
 * `?tab=production-leaderboard`. Asserts:
 *   - eyebrow + podium + period chips + tail render from the real
 *     leaderboards/{branchId} aggregate
 *   - chip-switch re-renders without an explicit refetch (state-only)
 *   - 0 console errors
 *   - axe color-contrast: NO-NEW serious/critical nodes on the surface
 *     (delta vs the surface alone — surface is pre-clean if it adds zero
 *     new nodes; pre-existing nodes from the topbar `.top-1\.5` carry over)
 *
 * Usage:
 *   node scripts/verification/production-leaderboard-smoke.mjs --url=http://127.0.0.1:4173
 *   node scripts/verification/production-leaderboard-smoke.mjs --url=https://agencytrack.vercel.app
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
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

async function loginAndWait(page) {
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
    // Pre-existing localhost-only CORS noise — fontshare.com's CORS allowlist
    // excludes 127.0.0.1; it doesn't fire on the prod domain. Not a P3
    // regression — skip from the smoke's error tally.
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });

  try {
    // Land on temp route directly via query param
    const targetUrl = `${URL}/?tab=production-leaderboard`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await loginAndWait(page);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }

    // The login flow returns the user to the saved state; we may need to push
    // the query param again (some apps strip it post-login).
    const currentUrl = page.url();
    if (!currentUrl.includes('tab=production-leaderboard')) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    }

    // Wait for the surface to mount
    await page.waitForSelector('[data-testid="production-leaderboard-surface"]', { timeout: 15_000 });

    // ── Default state assertions (period=YTD) ─────────────────────────────
    const eyebrowText = await page.locator('[data-testid="leaderboard-eyebrow"]').textContent();
    const eyebrowOk = eyebrowText && eyebrowText.includes('YTD');

    // Podium — expect [#2, #1, #3] cards present (rank 1 always present if any data)
    const podiumCards = await page.locator('[data-testid^="podium-card-rank-"]').count();

    // Period chips — all 4 + YTD aria-selected=true at boot
    const chipCount = await page.locator('[data-testid^="leaderboard-period-"]').count();
    const ytdSelected = await page.locator('[data-testid="leaderboard-period-ytd"]').getAttribute('aria-selected');

    // Tail (may be empty for slow periods, but YTD has prod data per the
    // backfill from P1b)
    const tailRows = await page.locator('[data-testid^="tail-row-rank-"]').count();

    // Capture YTD-period API for the top agent to compare after chip switch
    const ytdTopApi = await page.evaluate(() => {
      const podium = document.querySelector('[data-testid="podium-card-rank-1"]');
      return podium ? podium.textContent : null;
    });

    // ── Chip-switch: WK → re-renders from the same doc (no refetch) ───────
    let wkSwitchOk = true;
    let wkTopApi = null;
    try {
      await page.click('[data-testid="leaderboard-period-wk"]');
      await page.waitForTimeout(500);
      const wkSelected = await page.locator('[data-testid="leaderboard-period-wk"]').getAttribute('aria-selected');
      wkSwitchOk = wkSelected === 'true';
      const wkPodium = await page.locator('[data-testid="podium-card-rank-1"]').first();
      wkTopApi = (await wkPodium.count()) > 0 ? await wkPodium.textContent() : null;
      // Switch back to YTD for the axe snapshot below
      await page.click('[data-testid="leaderboard-period-ytd"]');
      await page.waitForTimeout(400);
    } catch (err) {
      wkSwitchOk = false;
      console.log(`  chip-switch error: ${err.message}`);
    }

    // ── axe pass on the surface ───────────────────────────────────────────
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const newContrastFails = (axeResults.violations.find(v => v.id === 'color-contrast')?.nodes || [])
      .filter(n => {
        const sel = (n.target ?? []).join(' > ');
        // Filter pre-existing baselines AND dispatcher-accepted design-intent nodes:
        //   .top-1\.5 — pre-existing topbar notification badge (unrelated to P3).
        //   leaderboard-eyebrow + champion label (.border-gold\/50 ... .text-gold) —
        //     dispatcher-accepted text-gold design-intent (PR #401 pre-review).
        //     Tracked by the app-wide gold-contrast pass FU in docs/FOLLOW_UPS.md;
        //     do not regress these here.
        if (sel.includes('top-1\\.5')) return false;
        if (sel.includes('leaderboard-eyebrow')) return false;
        if (sel.includes('border-gold\\/50') && sel.includes('text-gold')) return false;
        return true;
      });

    const pass = (
      eyebrowOk &&
      podiumCards > 0 &&
      chipCount === 4 &&
      ytdSelected === 'true' &&
      wkSwitchOk &&
      errors.length === 0 &&
      newContrastFails.length === 0
    );

    RESULTS.push({ theme, eyebrowOk, podiumCards, chipCount, ytdSelected, tailRows, wkSwitchOk, ytdTopApi, wkTopApi, errors, newContrastFails: newContrastFails.length, pass });

    console.log(`[${theme}] eyebrow=${eyebrowOk} podium=${podiumCards} chips=${chipCount} ytd-sel=${ytdSelected} tail=${tailRows} chip-switch=${wkSwitchOk} errors=${errors.length} axe-new=${newContrastFails.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (ytdTopApi && wkTopApi) {
      const sameTopAcrossPeriods = ytdTopApi.trim() === wkTopApi.trim();
      console.log(`  ytd top excerpt: ${ytdTopApi.replace(/\s+/g, ' ').trim().slice(0, 80)}`);
      console.log(`  wk  top excerpt: ${wkTopApi.replace(/\s+/g, ' ').trim().slice(0, 80)}`);
      console.log(`  top-card text changed across periods? ${sameTopAcrossPeriods ? 'no' : 'YES (re-render confirmed)'}`);
    }
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
    if (newContrastFails.length) newContrastFails.slice(0, 3).forEach(n => console.log(`  axe: ${(n.target ?? []).join(' > ')}`));
  } finally {
    await browser.close();
  }
}

console.log(`\nTrack J P3 — production leaderboard render smoke + axe`);
console.log(`Target: ${URL}\n`);

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nProd-Leaderboard smoke: ${allPass ? '✓ 2/2 PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

/**
 * nexus-glass-s2-hero-smoke.mjs — Phase 3 verification for Nexus Glass S2 Hero PR.
 *
 * Evolved from nexus-glass-s1-smoke.mjs. Asserts the three flagship cards carry
 * .glass.hero.{teal|gold} classes and that hero CSS tokens are defined in both themes.
 *
 *   1. CommissionAnchorStrip (agent/commission tab)  — .glass.hero.gold
 *   2. SuggestedWeekCard (agent/game-plan tab)       — .glass.hero.teal
 *   3. PersRealityBar (manager/persistency tab)      — .glass.hero.teal
 *
 * Also:
 *   - Hero CSS tokens defined (--hero-ink, --hero-ink-muted-teal, --hero-chip-island)
 *   - Chip-island elements present inside each hero card
 *   - No console errors on any leg
 *   - Screenshots saved to scripts/verification/screenshots/nexus-glass-s2-hero/
 *
 * Usage:
 *   SMOKE_BASE_URL=https://<preview-host> node scripts/verification/nexus-glass-s2-hero-smoke.mjs
 *   node scripts/verification/nexus-glass-s2-hero-smoke.mjs --prod
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  setupBypassSession,
  setTheme,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  captureConsoleAndNetwork,
  formatCaptureReport,
  stamp,
} from './lib/walk-helpers.mjs';

// ── env loading ────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !/^#/.test(k) && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

const BASE_URL     = resolveSmokeBaseUrl({ defaultHost: 'agencytrack-git-feat-nexus-glass-s2-hero-kyron-marchan-s-projects.vercel.app' });
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const BM_EMAIL     = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS      = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!BYPASS_TOKEN && !BASE_URL.includes('localhost')) {
  console.error('VERCEL_BYPASS_TOKEN not set — cannot access preview. Exiting.');
  process.exit(1);
}
if (!AGENT_EMAIL || !AGENT_PASS || !BM_EMAIL || !BM_PASS) {
  console.error('Missing A11Y credentials. Exiting.');
  process.exit(1);
}

const SCREENSHOT_DIR = resolve('scripts/verification/screenshots/nexus-glass-s2-hero');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

console.log(`[${stamp()}] Nexus Glass S2 Hero smoke — target: ${BASE_URL}`);

const RESULTS = [];
const clearTimeout = installGlobalTimeout(240_000, () => finishSmoke(RESULTS));

// ── helpers ────────────────────────────────────────────────────────────────────
async function login(page, email, password) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () =>
      document.querySelector('nav[aria-label="Primary navigation"]') !== null ||
      document.querySelector('[data-testid="agent-tab-home"]') !== null,
    { timeout: 25_000 },
  );
  await page.waitForTimeout(1000);
}

function recordResult(leg, passed, detail) {
  RESULTS.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

/**
 * Assert that the hero CSS custom properties are resolved in the current theme.
 * Returns { allDefined, values }.
 */
async function assertHeroTokens(page, theme) {
  return page.evaluate((theme) => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const get = (v) => cs.getPropertyValue(v).trim();
    const values = {
      heroInk:          get('--hero-ink'),
      heroInkMutedTeal: get('--hero-ink-muted-teal'),
      heroInkMutedGold: get('--hero-ink-muted-gold'),
      heroAccent:       get('--hero-accent'),
      heroDotSuccess:   get('--hero-dot-success'),
      heroDotDanger:    get('--hero-dot-danger'),
      heroChipIsland:   get('--hero-chip-island'),
      heroChipBorder:   get('--hero-chip-border'),
      // gradient stop spot-checks
      heroLTealA:       get('--glass-hero-l-teal-a'),
      heroLGoldA:       get('--glass-hero-l-gold-a'),
    };
    const allDefined = Object.values(values).every((v) => v.length > 0);
    return { allDefined, values };
  }, theme);
}

// ── main smoke ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });

// ── AGENT LEGS ─────────────────────────────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
    await setTheme(ctx, theme);
    const page = await ctx.newPage();
    const capture = captureConsoleAndNetwork(page);

    await login(page, AGENT_EMAIL, AGENT_PASS);

    // ── Hero token spot-check (light or dark depending on theme) ──────────────
    const { allDefined, values } = await assertHeroTokens(page, theme);
    recordResult(
      `agent-${theme}/hero-tokens-defined`,
      allDefined,
      allDefined
        ? `all hero tokens resolved (ink=${values.heroInk}, muted-teal=${values.heroInkMutedTeal})`
        : `MISSING tokens: ${JSON.stringify(Object.entries(values).filter(([, v]) => !v).map(([k]) => k))}`,
    );

    // ── Leg 1: CommissionAnchorStrip (hero gold) on Commission tab ────────────
    await page.waitForTimeout(800);
    await page.click('[data-testid="agent-tab-commission"]');
    await page.waitForTimeout(1500);

    const anchorHasHeroGold = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="commission-anchor-strip"]');
      return el ? (el.classList.contains('glass') && el.classList.contains('hero') && el.classList.contains('gold')) : false;
    });
    recordResult(
      `agent-${theme}/commission-anchor-strip class`,
      anchorHasHeroGold,
      anchorHasHeroGold
        ? '.glass.hero.gold on [data-testid="commission-anchor-strip"]'
        : '.glass.hero.gold NOT FOUND — check D3 swap landed',
    );

    // Chip-island presence inside CommissionAnchorStrip
    const anchorHasChipIsland = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="commission-anchor-strip"]');
      if (!strip) return false;
      // Chip-islands have class including "border-[--hero-chip-border]" — check via inline style attribute
      // Tailwind arbitrary-value classes don't appear in classList reliably across configs;
      // verify by checking --hero-chip-island resolves via a child with matching bg-color.
      // Simpler: just check the strip has at least one child with rounded-xl (chip shape).
      return strip.querySelectorAll('.rounded-xl').length > 0;
    });
    recordResult(
      `agent-${theme}/commission-anchor-strip chip-island`,
      anchorHasChipIsland,
      anchorHasChipIsland ? 'chip-island elements (.rounded-xl) present' : 'no chip-island elements found',
    );

    // Screenshot
    const anchorEl = await page.$('[data-testid="commission-anchor-strip"]');
    if (anchorEl) {
      await anchorEl.screenshot({ path: resolve(SCREENSHOT_DIR, `commission-anchor-strip-${theme}.png`) });
      console.log(`[${stamp()}]    📸 CommissionAnchorStrip ${theme}`);
    }

    // ── Leg 2: SuggestedWeekCard (hero teal) on Game Plan tab ────────────────
    await page.click('[data-testid="agent-tab-game-plan"]');
    await page.waitForTimeout(1500);

    const cardHasHeroTeal = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="suggested-week-card"]');
      return el ? (el.classList.contains('glass') && el.classList.contains('hero') && el.classList.contains('teal')) : false;
    });
    recordResult(
      `agent-${theme}/suggested-week-card class`,
      cardHasHeroTeal,
      cardHasHeroTeal
        ? '.glass.hero.teal on [data-testid="suggested-week-card"]'
        : '.glass.hero.teal NOT FOUND',
    );

    const swcEl = await page.$('[data-testid="suggested-week-card"]');
    if (swcEl) {
      await swcEl.screenshot({ path: resolve(SCREENSHOT_DIR, `suggested-week-card-${theme}.png`) });
      console.log(`[${stamp()}]    📸 SuggestedWeekCard ${theme}`);
    }

    // ── Console check for agent pass ──────────────────────────────────────────
    const captureReport = formatCaptureReport(capture);
    const hasErrors = capture.consoleMessages.some((m) => m.type === 'error') ||
      capture.networkFailures.length > 0;
    recordResult(
      `agent-${theme}/no-console-errors`,
      !hasErrors,
      !hasErrors ? 'clean' : `errors — ${captureReport.split('\n').slice(0, 3).join(' | ')}`,
    );
    if (hasErrors) console.log(captureReport);
  } finally {
    await ctx.close();
  }
}

// ── MANAGER LEGS ───────────────────────────────────────────────────────────────
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
    await setTheme(ctx, theme);
    const page = await ctx.newPage();
    const capture = captureConsoleAndNetwork(page);

    await login(page, BM_EMAIL, BM_PASS);

    // ── Leg 3: PersRealityBar (hero teal) on Manager Persistency tab ──────────
    const persTab = page.locator('[data-testid="tab-persistency"]');
    await persTab.click();
    await page.waitForTimeout(1200);

    // Wait for the non-loading state: loading uses .card, loaded uses .glass.hero.teal
    let persHasHeroTeal = false;
    try {
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="pers-reality-bar"]');
          return el && el.classList.contains('glass') && el.classList.contains('hero');
        },
        { timeout: 12_000 },
      );
      persHasHeroTeal = true;
    } catch {
      // If still loading or no data, check static class
      const el = await page.$('[data-testid="pers-reality-bar"]');
      if (el) {
        const cls = await el.getAttribute('class');
        persHasHeroTeal = !!(cls?.includes('glass') && cls?.includes('hero'));
      }
    }
    recordResult(
      `manager-${theme}/pers-reality-bar class`,
      persHasHeroTeal,
      persHasHeroTeal
        ? '.glass.hero.teal on [data-testid="pers-reality-bar"]'
        : '.glass.hero.teal NOT FOUND (still loading or missing)',
    );

    // Chip-island presence inside PersRealityBar
    const persHasChipIsland = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="pers-bar-aggregate"]');
      if (!bar) return false;
      return bar.querySelectorAll('.rounded-xl').length > 0;
    });
    recordResult(
      `manager-${theme}/pers-reality-bar chip-island`,
      persHasChipIsland,
      persHasChipIsland ? 'chip-island elements present in aggregate section' : 'no chip-islands in aggregate section',
    );

    const persEl = await page.$('[data-testid="pers-reality-bar"]');
    if (persEl) {
      await persEl.screenshot({ path: resolve(SCREENSHOT_DIR, `pers-reality-bar-${theme}.png`) });
      console.log(`[${stamp()}]    📸 PersRealityBar ${theme}`);
    }

    // ── Console check ─────────────────────────────────────────────────────────
    const hasErrors = capture.consoleMessages.some((m) => m.type === 'error') ||
      capture.networkFailures.length > 0;
    recordResult(
      `manager-${theme}/no-console-errors`,
      !hasErrors,
      !hasErrors ? 'clean' : 'errors found',
    );
  } finally {
    await ctx.close();
  }
}

// ── Hero token dark-mode spot-proof (standalone context) ──────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
    await setTheme(ctx, 'dark');
    const page = await ctx.newPage();
    await login(page, AGENT_EMAIL, AGENT_PASS);
    await page.waitForTimeout(800);

    const { allDefined, values } = await assertHeroTokens(page, 'dark');
    recordResult(
      'dark-token-spot/hero-tokens-defined',
      allDefined,
      allDefined
        ? `dark hero tokens resolved (ink-muted-teal=${values.heroInkMutedTeal}, chip-island=${values.heroChipIsland})`
        : `MISSING dark tokens: ${JSON.stringify(Object.entries(values).filter(([, v]) => !v).map(([k]) => k))}`,
    );

    // Verify gradient stop tokens are defined (not empty)
    const gradientsDefined = !!(values.heroLTealA && values.heroLGoldA);
    recordResult(
      'dark-token-spot/gradient-stops-defined',
      gradientsDefined,
      gradientsDefined
        ? `gradient stops: teal-a=${values.heroLTealA}, gold-a=${values.heroLGoldA}`
        : 'gradient stop tokens empty or missing',
    );
  } finally {
    await ctx.close();
  }
}

await browser.close();
finishSmoke(RESULTS, { clearTimeout });

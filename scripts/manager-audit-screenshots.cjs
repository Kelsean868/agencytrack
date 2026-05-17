/**
 * manager-audit-screenshots.cjs
 *
 * Captures screenshots of the manager portal screens that the audit's mock
 * file (mocks/manager-portal-concepts.html) covers. Per Phase 3 Q1 Option (a):
 * 4 screens × 2 viewports × 2 modes = 16 screenshots, gitignored, anchor for
 * the visual analysis.
 *
 * Screens: Overview, Goals (My Unit > Agent Goals), Persistency, Awards.
 * Viewports: desktop 1440x900, mobile 390x844.
 * Modes: light (default), dark (toggled via header button).
 *
 * Usage (run from worktree root):
 *   node scripts/manager-audit-screenshots.cjs --url=https://agencytrack.vercel.app
 *
 * Reuses walk-helpers.mjs from PR #95: bypass cookie, domcontentloaded waits,
 * Firebase ready polling. Reads VERCEL_BYPASS_TOKEN +
 * A11Y_BRANCH_MANAGER_EMAIL/PASSWORD from .env.local.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const { loadEnv } = require('./lib/loadEnv.cjs');

Object.assign(process.env, loadEnv(path.resolve(__dirname, '../.env.local')));

function arg(name, fallback) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.replace(`--${name}=`, '') : fallback;
}

const BASE_URL = arg('url', 'https://agencytrack.vercel.app');
const BYPASS = process.env.VERCEL_BYPASS_TOKEN || '';
const EMAIL = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const PASSWORD = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Missing A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD in .env.local');
  process.exit(1);
}

function detectScope(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'agencytrack.vercel.app') return { scope: 'production', needsBypass: false };
    if (u.hostname.endsWith('.vercel.app')) return { scope: 'preview', needsBypass: !!BYPASS };
    return { scope: 'local', needsBypass: false };
  } catch {
    return { scope: 'unknown', needsBypass: false };
  }
}
const { scope, needsBypass } = detectScope(BASE_URL);

const SCREENS = [
  { id: 'overview', tabLabel: 'Overview', landing: 'Team YTD API' },
  { id: 'goals', tabLabel: 'Goals', landing: 'Personal Annual Target', subTabs: [{ label: 'My Unit', landing: 'Agent Goals' }] },
  { id: 'persistency', tabLabel: 'Persistency', landing: 'Persistency' },
  { id: 'awards', tabLabel: 'Awards', landing: 'Annual' },
];

const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];

const outDir = path.resolve(process.cwd(), 'verification', 'manager-portal-audit');
fs.mkdirSync(outDir, { recursive: true });
console.log(`[mgr-audit] target=${BASE_URL} scope=${scope} bypass=${needsBypass ? 'on' : 'off'}`);
console.log(`[mgr-audit] output dir: ${outDir}`);

async function captureForViewport(page, helpers, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.waitForTimeout(400);

  // Navigate fresh after viewport change so layout settles
  if (needsBypass) {
    await page.goto(helpers.buildBypassUrl(BASE_URL, BYPASS), { waitUntil: 'domcontentloaded' });
  }
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Welcome back', { timeout: 20_000 });
  await page.waitForTimeout(800);

  for (const screen of SCREENS) {
    console.log(`  [${viewport.id}] -> ${screen.id}`);
    try {
      // For mobile, sidebar is hidden; need to use bottom-nav drawer.
      // Easiest: click sidebar item if visible, otherwise open mobile drawer.
      const sidebarLink = page.locator(`nav[aria-label="Primary navigation"] >> text=${screen.tabLabel}`).first();
      const sidebarVisible = await sidebarLink.isVisible().catch(() => false);
      if (sidebarVisible) {
        await sidebarLink.click();
      } else {
        // Mobile: open the "More" drawer via bottom-nav, then click the link
        const moreBtn = page.locator('nav[aria-label="Quick navigation"] >> text=More').first();
        const moreVisible = await moreBtn.isVisible().catch(() => false);
        if (moreVisible) {
          await moreBtn.click();
          await page.waitForTimeout(300);
          // Drawer link
          const drawerLink = page.locator(`text=${screen.tabLabel}`).last();
          await drawerLink.click();
        } else {
          // Fall back: maybe it's in the bottom-nav directly (e.g. Overview)
          const bnLink = page.locator(`nav[aria-label="Quick navigation"] >> text=${screen.tabLabel}`).first();
          if (await bnLink.isVisible().catch(() => false)) await bnLink.click();
        }
      }
      await page.waitForTimeout(900);

      // Sub-tab navigation if any (Goals -> My Unit)
      if (screen.subTabs) {
        for (const st of screen.subTabs) {
          const stBtn = page.locator(`button:has-text("${st.label}")`).first();
          if (await stBtn.isVisible().catch(() => false)) {
            await stBtn.click();
            await page.waitForTimeout(700);
          }
        }
      }

      // Light screenshot
      const lightPath = path.join(outDir, `${screen.id}_${viewport.id}_light.png`);
      await page.screenshot({ path: lightPath, fullPage: true });
      console.log(`    light  -> ${path.basename(lightPath)}`);
    } catch (e) {
      console.log(`    [SKIP] ${screen.id} ${viewport.id} light: ${e.message?.slice(0, 120)}`);
    }
  }

  // Now toggle dark mode and re-capture
  console.log(`  [${viewport.id}] toggling dark mode...`);
  await page.evaluate(() => {
    const html = document.documentElement;
    html.classList.add('dark');
    try { localStorage.setItem('agencytrack-dark', 'true'); } catch {}
  });
  await page.waitForTimeout(400);

  for (const screen of SCREENS) {
    console.log(`  [${viewport.id}] -> ${screen.id} (dark)`);
    try {
      const sidebarLink = page.locator(`nav[aria-label="Primary navigation"] >> text=${screen.tabLabel}`).first();
      const sidebarVisible = await sidebarLink.isVisible().catch(() => false);
      if (sidebarVisible) {
        await sidebarLink.click();
      } else {
        const moreBtn = page.locator('nav[aria-label="Quick navigation"] >> text=More').first();
        if (await moreBtn.isVisible().catch(() => false)) {
          await moreBtn.click();
          await page.waitForTimeout(300);
          const drawerLink = page.locator(`text=${screen.tabLabel}`).last();
          await drawerLink.click();
        } else {
          const bnLink = page.locator(`nav[aria-label="Quick navigation"] >> text=${screen.tabLabel}`).first();
          if (await bnLink.isVisible().catch(() => false)) await bnLink.click();
        }
      }
      await page.waitForTimeout(900);

      if (screen.subTabs) {
        for (const st of screen.subTabs) {
          const stBtn = page.locator(`button:has-text("${st.label}")`).first();
          if (await stBtn.isVisible().catch(() => false)) {
            await stBtn.click();
            await page.waitForTimeout(700);
          }
        }
      }

      const darkPath = path.join(outDir, `${screen.id}_${viewport.id}_dark.png`);
      await page.screenshot({ path: darkPath, fullPage: true });
      console.log(`    dark   -> ${path.basename(darkPath)}`);
    } catch (e) {
      console.log(`    [SKIP] ${screen.id} ${viewport.id} dark: ${e.message?.slice(0, 120)}`);
    }
  }

  // Restore light for next viewport
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    try { localStorage.setItem('agencytrack-dark', 'false'); } catch {}
  });
}

(async () => {
  const helpers = await import(
    pathToFileURL(path.join(__dirname, 'verification', 'lib', 'walk-helpers.mjs')).href
  );
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    // Login (desktop viewport)
    if (needsBypass) {
      await page.goto(helpers.buildBypassUrl(BASE_URL, BYPASS), { waitUntil: 'domcontentloaded' });
    }
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForSelector('text=Welcome back', { timeout: 25_000 });
    console.log('[mgr-audit] login ok');

    for (const vp of VIEWPORTS) {
      console.log(`\n[mgr-audit] viewport=${vp.id} (${vp.width}x${vp.height})`);
      await captureForViewport(page, helpers, vp);
    }
    console.log('\n[mgr-audit] done');
  } catch (e) {
    console.error('[mgr-audit] FATAL:', e.message);
    try { await page.screenshot({ path: path.join(outDir, '_fatal_state.png'), fullPage: true }); } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

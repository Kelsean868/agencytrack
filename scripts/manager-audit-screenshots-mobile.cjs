/**
 * manager-audit-screenshots-mobile.cjs — mobile-only follow-up to
 * manager-audit-screenshots.cjs. Runs at 390x844 from the start so the
 * mobile bottom-nav + drawer pattern is the chrome from login forward.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const { loadEnv } = require('./lib/loadEnv.cjs');

Object.assign(process.env, loadEnv(path.resolve(__dirname, '../.env.local')));

const BASE_URL = 'https://agencytrack.vercel.app';
const EMAIL = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const PASSWORD = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const outDir = path.resolve(process.cwd(), 'verification', 'manager-portal-audit');
fs.mkdirSync(outDir, { recursive: true });

// On mobile bottom-nav: Dashboard / Team / Reports / Campaigns / Profile / More
// Goals, Persistency, Awards live in the More drawer.
const SCREENS = [
  { id: 'overview', via: 'bottom', label: 'Dashboard' },
  { id: 'goals', via: 'drawer', label: 'Goals' },
  { id: 'persistency', via: 'drawer', label: 'Persistency' },
  { id: 'awards', via: 'drawer', label: 'Awards' },
];

async function navigate(page, screen) {
  if (screen.via === 'bottom') {
    await page.locator(`nav[aria-label="Quick navigation"] button:has-text("${screen.label}")`).first().click();
  } else {
    // Open More drawer then click target
    await page.locator('nav[aria-label="Quick navigation"] button:has-text("More")').first().click();
    await page.waitForTimeout(400);
    await page.locator(`nav[aria-label="More navigation options"] button:has-text("${screen.label}")`).first().click();
  }
  await page.waitForTimeout(1000);
}

async function captureSet(page, mode) {
  if (mode === 'dark') {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('agencytrack-dark', 'true'); } catch {}
    });
    await page.waitForTimeout(400);
  } else {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('agencytrack-dark', 'false'); } catch {}
    });
    await page.waitForTimeout(400);
  }
  for (const s of SCREENS) {
    try {
      await navigate(page, s);
      // Goals: click "My Unit" sub-tab
      if (s.id === 'goals') {
        const myUnit = page.locator('button:has-text("My Unit")').first();
        if (await myUnit.isVisible().catch(() => false)) {
          await myUnit.click();
          await page.waitForTimeout(700);
        }
      }
      const file = path.join(outDir, `${s.id}_mobile_${mode}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  [${mode}] ${s.id} -> ${path.basename(file)}`);
    } catch (e) {
      console.log(`  [SKIP] ${s.id} mobile ${mode}: ${e.message?.slice(0, 120)}`);
    }
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  console.log(`[mgr-audit-mobile] target=${BASE_URL}`);
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForSelector('text=Welcome back', { timeout: 25_000 });
    console.log('[mgr-audit-mobile] login ok');
    console.log('\n[mgr-audit-mobile] capturing light...');
    await captureSet(page, 'light');
    console.log('\n[mgr-audit-mobile] capturing dark...');
    await captureSet(page, 'dark');
    console.log('\n[mgr-audit-mobile] done');
  } catch (e) {
    console.error('[mgr-audit-mobile] FATAL:', e.message);
    try { await page.screenshot({ path: path.join(outDir, '_mobile_fatal.png'), fullPage: true }); } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

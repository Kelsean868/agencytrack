import { chromium } from 'playwright';
import { setupBypassSession } from '../scripts/verification/lib/walk-helpers.mjs';
const BASE = 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
await setupBypassSession(context, BASE, process.env.VERCEL_BYPASS_TOKEN);
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"]', { timeout: 20000 });
await page.fill('input[type="email"]', 'staging-branch-manager@agencytrack-staging.test');
await page.fill('input[type="password"]', 'ChangeMe-Staging-2026!');
await page.click('button[type="submit"]');
await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20000 });
await page.waitForTimeout(2000);
const ids = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')).filter((t) => t.startsWith('nav-') || t.startsWith('pinned-')));
console.log('nav testids:', JSON.stringify(ids));
await page.screenshot({ path: 'out/war-debug.png' });
await browser.close();

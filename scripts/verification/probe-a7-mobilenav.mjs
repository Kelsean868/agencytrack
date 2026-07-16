// Diagnostic probe for the a7 smoke: mobile login, dump bottom-nav testids +
// screenshot. Read-only.
import { chromium } from 'playwright';
import { assertEnv, newLegContext, login, shotFactory } from './vh/vh-helpers.mjs';

assertEnv();
const browser = await chromium.launch();
const shot = shotFactory('run8-a7-probe');
const ctx = await newLegContext(browser, { viewport: { width: 390, height: 844 } });
try {
  await login(ctx.page, 'agent1');
  await ctx.page.waitForTimeout(3000);
  const ids = await ctx.page.$$eval('[data-testid^="bottomnav"]', (els) =>
    els.map((e) => `${e.getAttribute('data-testid')} visible=${!!(e.offsetWidth || e.offsetHeight)} text=${(e.innerText || '').replace(/\n/g, '/')}`));
  console.log(ids.join('\n') || 'NO bottomnav testids found');
  const navCount = await ctx.page.locator('nav').count();
  console.log('nav elements:', navCount);
  await shot(ctx.page, 'a7-probe-mobile-dashboard');
} finally {
  await ctx.context.close();
  await browser.close();
}

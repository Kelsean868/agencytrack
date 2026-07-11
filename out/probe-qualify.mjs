import { chromium } from 'playwright';
import { newLegContext, login } from '../scripts/verification/vh/vh-helpers.mjs';
const browser = await chromium.launch();
const ctx = await newLegContext(browser);
await login(ctx.page, 'branch_manager');
const p = ctx.page;
const ws = p.locator('[data-testid="sidebar-ws-toggle-team"]');
if (await ws.count()) { await ws.click(); await p.waitForTimeout(600); }
const nav = p.locator('nav[aria-label="Primary navigation"]');
await nav.getByRole('button', { name: /^campaigns$/i }).first().click();
await p.waitForTimeout(1200);
await p.getByText('Staging Sprint — Qualify').first().click();
await p.waitForTimeout(3500);
await p.screenshot({ path: 'out/probe-qualify.png', fullPage: true });
const txt = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('*')].filter(el => /LIVE STANDINGS/i.test(el.textContent) && el.children.length);
  return document.body.innerText.slice(document.body.innerText.indexOf('Staging Sprint'), document.body.innerText.indexOf('Staging Sprint') + 1600);
});
console.log(txt);
await browser.close();

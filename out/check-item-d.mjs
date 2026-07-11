// One-off Run3 item-D live check (not a suite leg): UM Team Reports renders the
// Unit Aggregate as a glass hero (BM parity) with the four stats. Lives in
// gitignored out/ — verification artifact, not shipped code.
import { chromium } from 'playwright';
import { newLegContext, login, gotoTab, assertLegHygiene } from '../scripts/verification/vh/vh-helpers.mjs';

const browser = await chromium.launch();
const ctx = await newLegContext(browser);
try {
  const p = ctx.page;
  await login(p, 'unit_manager');
  const navItem = p.locator('[data-testid="nav-production-report"], [data-testid="pinned-production-report"]').first();
  await navItem.scrollIntoViewIfNeeded();
  await navItem.click();
  await p.waitForTimeout(900);
  const hero = p.locator('.glass.hero.teal', { hasText: 'Unit Aggregate' });
  await hero.waitFor({ state: 'visible', timeout: 20_000 });
  const txt = (await hero.textContent()) || '';
  for (const label of ['Total API', 'Apps', 'Avg API / Agent', 'Agents']) {
    if (!txt.includes(label)) throw new Error(`hero missing label: ${label}`);
  }
  const m = txt.match(/TTD\s?([\d,]+)/);
  if (!m) throw new Error('hero Total API shows no TTD value');
  assertLegHygiene(ctx);
  console.log(`ITEM-D PASS — Unit Aggregate rendered as .glass.hero.teal with all 4 stats; Total API TTD ${m[1]}; hygiene clean`);
} finally {
  await ctx.context.close();
  await browser.close();
}

/**
 * cleanup-staging-call-sources.mjs — revoke any leftover smoke-created sources.
 *
 * A failed revoke leg leaves a LIVE bearer token in the staging tenant. That is
 * the one failure mode of this smoke that leaves state behind, so it gets its
 * own tool rather than a manual note nobody reads.
 *
 * Revokes every ACTIVE row whose label contains "smoke". Staging only.
 */
import { chromium } from 'playwright';
import { setupBypassSession } from './lib/walk-helpers.mjs';

const BASE = (process.env.STAGING_BASE_URL || 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app').replace(/\/+$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const PW = process.env.STAGING_SEED_PASSWORD;
if (!TOKEN || !PW) throw new Error('Missing VERCEL_BYPASS_TOKEN or STAGING_SEED_PASSWORD');
if (!/agencytrack-git-staging-/.test(BASE)) throw new Error('REFUSING: not the staging deployment.');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await setupBypassSession(ctx, BASE, TOKEN);
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
await page.fill('input[type="email"]', 'staging-agent-1@agencytrack-staging.test');
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 });
await page.waitForTimeout(3000);

const dismiss = page.locator('[data-testid="celebration-dismiss"]').first();
if (await dismiss.isVisible({ timeout: 3000 }).catch(() => false)) { await dismiss.click(); await page.waitForTimeout(800); }

const nav = page.locator('[data-testid="agent-tab-call-sources"]').first();
await nav.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(500);
await nav.click({ timeout: 15_000 });
await page.waitForTimeout(2500);

let revoked = 0;
for (let pass = 0; pass < 12; pass++) {
  const target = page.locator('[data-testid="cs-row"]')
    .filter({ hasText: 'smoke' })
    .filter({ has: page.locator('[data-testid="cs-revoke"]') })
    .first();
  if (!await target.isVisible({ timeout: 3000 }).catch(() => false)) break;
  const label = (await target.textContent().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 60);
  await target.locator('[data-testid="cs-revoke"]').click();
  const ok = await Promise.race([
    target.locator('[data-testid="cs-revoked-badge"]').waitFor({ state: 'visible', timeout: 45_000 }).then(() => true),
    target.waitFor({ state: 'detached', timeout: 45_000 }).then(() => true),
  ]).catch(() => false);
  console.log(`${ok ? 'revoked' : 'FAILED  '} :: ${label}`);
  if (!ok) break;
  revoked++;
  await page.waitForTimeout(600);
}

const stillActive = await page.locator('[data-testid="cs-row"]')
  .filter({ hasText: 'smoke' })
  .filter({ has: page.locator('[data-testid="cs-revoke"]') })
  .count().catch(() => -1);

console.log(`\nrevoked this run: ${revoked}`);
console.log(`smoke rows still ACTIVE: ${stillActive}`);
console.log(stillActive === 0 ? 'CLEAN — no live smoke tokens left.' : 'NOT CLEAN — live tokens remain.');
await browser.close();
process.exit(stillActive === 0 ? 0 : 1);

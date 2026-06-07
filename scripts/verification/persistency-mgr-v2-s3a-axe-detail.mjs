/**
 * One-shot: get full node detail for the S3a axe failure.
 * Agent dark, ledger-lapsed surface.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { setupBypassSession, setTheme, resolveSmokeBaseUrl } from './lib/walk-helpers.mjs';

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

const BASE_URL     = resolveSmokeBaseUrl({ defaultHost: 'agencytrack.vercel.app' });
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
await setTheme(ctx, 'dark');
const page = await ctx.newPage();

await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
await page.fill('input[type="email"]', AGENT_EMAIL);
await page.fill('input[type="password"]', AGENT_PASS);
await page.click('button[type="submit"]');
await page.waitForFunction(
  () =>
    document.querySelector('nav[aria-label="Primary navigation"]') !== null ||
    document.querySelector('[data-testid="agent-tab-home"]') !== null,
  { timeout: 25_000 },
);
await page.waitForTimeout(1000);

// Navigate to persistency → playground → lapsed link → ledger
await page.locator('[data-testid="agent-tab-persistency"]').click();
await page.waitForTimeout(1200);
await page.locator('[data-testid="agent-playground-open-button"]').click();
await page.waitForTimeout(800);
await page.locator('[data-testid="playground-view-lapsed-btn"]').click();
await page.waitForTimeout(1500);
// Wait for ledger to fully load (not in loading state)
await page.waitForFunction(
  () => !document.querySelector('[data-testid="ledger-loading"]'),
  { timeout: 10_000 },
).catch(() => {});
await page.waitForTimeout(500);

const results = await new AxeBuilder({ page })
  .include('[data-testid="policy-ledger-surface"]')
  .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
  .analyze();

const serious = results.violations.filter(
  (v) => v.impact === 'serious' || v.impact === 'critical',
);

console.log('\n=== Full axe violation detail: Agent-dark/ledger-lapsed ===\n');
if (serious.length === 0) {
  console.log('No serious/critical violations.');
} else {
  for (const v of serious) {
    console.log(`Rule: ${v.id}`);
    console.log(`Impact: ${v.impact}`);
    console.log(`Description: ${v.description}`);
    console.log(`Help: ${v.helpUrl}`);
    console.log(`Nodes (${v.nodes.length}):`);
    for (const n of v.nodes) {
      console.log(`  HTML: ${n.html}`);
      console.log(`  Target: ${JSON.stringify(n.target)}`);
      if (n.any && n.any.length > 0) {
        for (const a of n.any) {
          console.log(`  any: ${a.message}`);
          if (a.data) console.log(`  data: ${JSON.stringify(a.data)}`);
        }
      }
      if (n.failureSummary) console.log(`  failure: ${n.failureSummary}`);
      console.log();
    }
  }
}

await ctx.close();
await browser.close();

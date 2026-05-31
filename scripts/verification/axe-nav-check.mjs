/**
 * axe-nav-check.mjs — a11y gate for the v2 agent nav IA (J-AD-nav PR).
 *
 * Runs production axe scan on the agent dashboard after login.
 * Reports any serious/critical violations.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

import { setupBypassSession } from './lib/walk-helpers.mjs';

const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const PROD_URL     = 'https://agencytrack.vercel.app';

if (!BYPASS_TOKEN || !AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing credentials'); process.exit(1);
}

const browser = await chromium.launch({ headless: true });
let violations = [];

async function runAxe(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .analyze();
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length === 0) {
    console.log(`  axe ${label}: PASS (0 serious/critical violations)`);
  } else {
    const detail = serious.map(v => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`).join('\n');
    console.log(`  axe ${label}: FAIL — ${serious.length} violation(s)\n${detail}`);
    violations.push({ label, serious });
  }
}

async function loginAndWait(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(2000);
}

for (const theme of ['light', 'dark']) {
  console.log(`\n=== ${theme.toUpperCase()} MODE ===`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, PROD_URL, BYPASS_TOKEN);
  const page = await context.newPage();
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await loginAndWait(page);

  if (theme === 'dark') {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('agencytrack-dark', 'true'); } catch {}
    });
    await page.waitForTimeout(400);
  }

  // Axe on dashboard home (sidebar visible)
  await runAxe(page, `${theme}/dashboard`);

  await context.close();
}

await browser.close();

if (violations.length === 0) {
  console.log('\n✓ axe gate: 0 serious/critical violations across light + dark');
  process.exit(0);
} else {
  console.error(`\n✗ axe gate: ${violations.length} violation(s) found`);
  process.exit(1);
}

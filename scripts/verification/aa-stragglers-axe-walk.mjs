/**
 * aa-stragglers-axe-walk.mjs
 * Targeted axe color-contrast check for the two AA-straggler surfaces:
 *   1. ActivityFeed — .activity-list scoped scan
 *   2. NotificationDrawer — open the bell, scan the drawer panel
 * Both themes. Pass --url=<preview> to target a PR preview instead of prod.
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

const urlArg = process.argv.find(a => a.startsWith('--url='));
const BASE_URL = urlArg ? urlArg.split('=').slice(1).join('=') : 'https://agencytrack.vercel.app';

if (!BYPASS_TOKEN || !AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing credentials (VERCEL_BYPASS_TOKEN / A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD)');
  process.exit(1);
}

function printNodes(label, nodes) {
  if (!nodes.length) { console.log(`  ${label}: PASS (0 nodes)`); return; }
  console.log(`  ${label}: ${nodes.length} failing node(s)`);
  for (const n of nodes) {
    const sel = (n.target ?? []).join(' > ');
    const checks = n.any ?? [];
    const data = checks.map(c => {
      const d = c.data ?? {};
      return `fg=${d.fgColor ?? '?'} bg=${d.bgColor ?? '?'} ratio=${d.contrastRatio ?? '?'} (need ${d.expectedContrastRatio ?? '?'})`;
    }).join('; ');
    console.log(`    [node] ${sel}`);
    if (data) console.log(`           ${data}`);
  }
}

async function runAxeOnScope(page, scopeSelector, label) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  if (scopeSelector) builder = builder.include(scopeSelector);
  const results = await builder.analyze();
  const contrast = results.violations.find(v => v.id === 'color-contrast');
  const nodes = contrast ? contrast.nodes : [];
  printNodes(label, nodes);
  return nodes;
}

const browser = await chromium.launch({ headless: true });
const summary = {};

for (const theme of ['light', 'dark']) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`THEME: ${theme.toUpperCase()}`);
  console.log('═'.repeat(60));

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30_000 });
  await page.waitForTimeout(2000);

  if (theme === 'dark') {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('agencytrack-dark', 'true'); } catch {}
    });
    await page.waitForTimeout(400);
  }

  // ── ActivityFeed ──────────────────────────────────────────────────────
  console.log('\n── ActivityFeed ──');
  const feedCount = await page.locator('.activity-list').count();
  if (feedCount) {
    const feedNodes = await runAxeOnScope(page, '.activity-list', `ActivityFeed/${theme}`);
    summary[`ActivityFeed/${theme}`] = feedNodes.length;
  } else {
    console.log('  .activity-list not found (agent may have no events — axe skipped for this surface)');
    summary[`ActivityFeed/${theme}`] = 'n/a';
  }

  // ── NotificationDrawer ───────────────────────────────────────────────
  console.log('\n── NotificationDrawer ──');
  const bell = page.locator('[aria-label^="Notifications"]').first();
  if (await bell.count()) {
    await bell.click();
    await page.waitForTimeout(700);
    // The drawer is a fixed panel, not role=dialog — scope to the fixed right panel
    const drawerLocator = page.locator('.fixed.right-0.h-full');
    const drawerCount = await drawerLocator.count();
    if (drawerCount) {
      const drawerNodes = await runAxeOnScope(page, '.fixed.right-0.h-full', `NotificationDrawer/${theme}`);
      summary[`NotificationDrawer/${theme}`] = drawerNodes.length;
      const closeBtn = page.getByRole('button', { name: /close notifications/i });
      if (await closeBtn.count()) await closeBtn.click();
    } else {
      console.log('  Drawer panel not found after bell click');
      summary[`NotificationDrawer/${theme}`] = 'n/a';
    }
  } else {
    console.log('  Bell button not found');
    summary[`NotificationDrawer/${theme}`] = 'n/a';
  }

  await context.close();
}

await browser.close();

console.log('\n══ SUMMARY ══');
for (const [key, count] of Object.entries(summary)) {
  const result = count === 'n/a' ? 'N/A (not rendered — skipped)' : count === 0 ? 'PASS (0 nodes)' : `FAIL (${count} nodes)`;
  console.log(`  ${key}: ${result}`);
}

const failures = Object.values(summary).filter(v => typeof v === 'number' && v > 0);
if (failures.length === 0) {
  console.log('\n✓ aa-stragglers axe walk: ALL PASS');
  process.exit(0);
} else {
  console.log(`\n✗ aa-stragglers axe walk: ${failures.length} surface(s) with contrast failures`);
  process.exit(1);
}

/**
 * axe-contrast-detail.mjs
 * Runs axe color-contrast check and prints per-node: selector + measured/required ratio.
 * Pass --branch=<label> for labeling; default "branch".
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
const PROD_URL     = process.env.AXE_TARGET_URL ?? 'https://agencytrack.vercel.app';

const labelArg = process.argv.find(a => a.startsWith('--branch='));
const LABEL = labelArg ? labelArg.split('=')[1] : 'branch';

if (!BYPASS_TOKEN || !AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing credentials'); process.exit(1);
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

async function runContrastDetail(page, theme) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const contrastViolation = results.violations.find(v => v.id === 'color-contrast');
  if (!contrastViolation) {
    console.log(`[${LABEL}/${theme}] color-contrast: PASS (0 nodes)`);
    return [];
  }

  const nodes = contrastViolation.nodes;
  console.log(`\n[${LABEL}/${theme}] color-contrast: ${nodes.length} failing node(s)`);
  console.log('─'.repeat(72));

  const entries = nodes.map((node, i) => {
    // target is an array of selectors; join for display
    const selector = (node.target ?? []).join(' > ');
    // failureSummary contains the measured fg/bg + ratio info
    const summary = node.failureSummary ?? '';
    // Extract ratio lines from failureSummary
    const ratioLines = summary.split('\n').filter(l =>
      l.includes('ratio') || l.includes('color') || l.includes('Expected') || l.includes('foreground') || l.includes('background')
    ).map(l => l.trim()).join(' | ');

    // Also extract from any()/all() checks
    const checks = node.any ?? [];
    const ratioData = checks.map(c => {
      const data = c.data ?? {};
      return `fg=${data.fgColor ?? '?'} bg=${data.bgColor ?? '?'} ratio=${data.contrastRatio ?? '?'} (need ${data.expectedContrastRatio ?? '?'})`;
    }).join('; ');

    console.log(`  [${i + 1}] selector: ${selector || '(no target)'}`);
    if (ratioData) console.log(`       contrast: ${ratioData}`);
    else if (ratioLines) console.log(`       summary: ${ratioLines}`);
    console.log();
    return { selector, ratioData };
  });

  console.log('─'.repeat(72));
  return entries;
}

const browser = await chromium.launch({ headless: true });
const allResults = {};

for (const theme of ['light', 'dark']) {
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

  const entries = await runContrastDetail(page, theme);
  allResults[theme] = entries;
  await context.close();
}

await browser.close();

// Summary: check for sidebar section headers and footer avatar button
console.log('\n══ SIDEBAR/AVATAR CHECK ══');
for (const [theme, entries] of Object.entries(allResults)) {
  const sidebarHeaders = entries.filter(e =>
    e.selector.includes('sidebar-section') ||
    e.selector.includes('sidebar-link') ||
    e.selector.toLowerCase().includes('planning') ||
    e.selector.toLowerCase().includes('tools') ||
    e.selector.toLowerCase().includes('recognition')
  );
  const avatarNodes = entries.filter(e =>
    e.selector.includes('sidebar-foot-avatar') ||
    e.selector.includes('sidebar-foot')
  );
  console.log(`[${LABEL}/${theme}] sidebar-section-header nodes: ${sidebarHeaders.length}`);
  console.log(`[${LABEL}/${theme}] footer-avatar nodes: ${avatarNodes.length}`);
}

console.log(`\nTotal [${LABEL}/light]: ${allResults.light.length} nodes`);
console.log(`Total [${LABEL}/dark]:  ${allResults.dark.length} nodes`);

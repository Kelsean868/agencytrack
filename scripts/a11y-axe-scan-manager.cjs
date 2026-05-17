/**
 * A11y axe scan — manager-side.
 *
 * Runs @axe-core/playwright against 9 manager-facing pages, prints a
 * per-page + per-rule summary, and writes a JSON report under
 * verification/a11y/manager_<timestamp>.json.
 *
 * Pages covered (9): manager_dashboard, manager_compliance, manager_goals,
 *   manager_persistency, manager_settlements, manager_campaigns,
 *   manager_awards, manager_agents, manager_meeting_mode.
 *
 * Credentials read from .env.local:
 *   A11Y_BRANCH_MANAGER_EMAIL, A11Y_BRANCH_MANAGER_PASSWORD
 *   A11Y_BASE_URL (optional — defaults to http://localhost:5173)
 *
 * Usage:
 *   node scripts/a11y-axe-scan-manager.cjs
 *   node scripts/a11y-axe-scan-manager.cjs --url=https://agencytrack-git-<branch>.vercel.app
 *   node scripts/a11y-axe-scan-manager.cjs --dark   # scan in dark mode
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const { loadEnv } = require('./lib/loadEnv.cjs');

Object.assign(process.env, loadEnv(path.resolve(__dirname, '../.env.local')));

const argUrl = (process.argv.find((a) => a.startsWith('--url=')) || '').replace('--url=', '');
const BASE_URL = argUrl || process.env.A11Y_BASE_URL || 'http://localhost:5173';
const EMAIL    = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const PASSWORD = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const BYPASS   = process.env.VERCEL_BYPASS_TOKEN || '';
// `--dark`: enables dark mode pre-mount by setting localStorage
// `agencytrack-dark = '1'`, then reloading. Mirrors the
// AgencyTrack dark-mode toggle (see src/main.jsx).
const DARK     = process.argv.includes('--dark');

if (!EMAIL || !PASSWORD) {
  console.error('Missing A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD in .env.local');
  process.exit(1);
}

async function applyVercelBypass(page) {
  if (!BYPASS) return;
  if (!/vercel\.app/i.test(BASE_URL)) return;
  const u = new URL(BASE_URL);
  u.searchParams.set('x-vercel-protection-bypass', BYPASS);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
}

// pageId, tabLabel (or null for special flows)
const PAGES = [
  ['manager_dashboard',    'Overview'],
  ['manager_agents',       'Team'],
  ['manager_campaigns',    'Campaigns'],
  ['manager_awards',       'Awards'],
  ['manager_compliance',   'Compliance'],
  ['manager_persistency',  'Persistency'],
  ['manager_goals',        'Goals'],
  ['manager_settlements',  'Settlements'],
  ['manager_meeting_mode', null], // special — clicks Start Meeting
];

async function clickTab(page, label) {
  await page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first().click();
  await page.waitForTimeout(400);
}

async function signIn(page) {
  await applyVercelBypass(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForSelector('text=Overview', { timeout: 15_000 });

  if (DARK) {
    // Persist the toggle and reload so main.jsx applies the dark
    // class pre-mount (no FOUC, matches user behavior). Use
    // domcontentloaded — Firebase listeners keep the network busy
    // long after the page is interactive, so networkidle would time out.
    await page.evaluate(() => localStorage.setItem('agencytrack-dark', '1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Overview', { timeout: 15_000 });
  }
}

(async () => {
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '').slice(0, 15);
  const browser = await chromium.launch();
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  const report = {
    startedAt: startedAt.toISOString(),
    baseUrl: BASE_URL,
    side: 'manager',
    mode: DARK ? 'dark' : 'light',
    pages: {},
    totals: { byRule: {}, nodes: 0, violations: 0 },
  };

  try {
    await signIn(page);

    for (const [pageId, tabLabel] of PAGES) {
      if (pageId === 'manager_meeting_mode') {
        // Open meeting mode overlay
        await page.getByRole('button', { name: /Start Meeting/i }).click();
        await page.waitForTimeout(800);
      } else {
        await clickTab(page, tabLabel);
      }

      const results = await new AxeBuilder({ page }).analyze();
      const byRule = {};
      let nodes = 0;
      for (const v of results.violations) {
        byRule[v.id] = (byRule[v.id] || 0) + v.nodes.length;
        nodes += v.nodes.length;
        report.totals.byRule[v.id] = (report.totals.byRule[v.id] || 0) + v.nodes.length;
      }
      report.totals.nodes      += nodes;
      report.totals.violations += results.violations.length;
      report.pages[pageId] = {
        url: page.url(),
        violations: results.violations.length,
        nodes,
        byRule,
      };
      console.log(`[${pageId}] violations=${results.violations.length} nodes=${nodes} ${JSON.stringify(byRule)}`);

      if (pageId === 'manager_meeting_mode') {
        // Close overlay so subsequent runs (if any) reset cleanly
        const closeBtn = page.getByRole('button', { name: /close|exit/i }).first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n── TOTALS ──');
  console.log(`Total violations: ${report.totals.violations}`);
  console.log(`Total nodes:      ${report.totals.nodes}`);
  console.log('By rule:');
  for (const [rule, count] of Object.entries(report.totals.byRule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule.padEnd(28)} ${count}`);
  }

  const outDir = path.resolve(process.cwd(), 'verification', 'a11y');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `manager${DARK ? '-dark' : ''}_${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${path.relative(process.cwd(), outPath)}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

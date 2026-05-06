/**
 * A11y axe scan — agent-side.
 *
 * Runs @axe-core/playwright against 8 agent-facing pages, prints a
 * per-page + per-rule summary, and writes a JSON report under
 * verification/a11y/agent_<timestamp>.json.
 *
 * Pages covered (8): login, dashboard, career, awards, leaderboard,
 *   history, profile, wizard_picker.
 *
 * Credentials read from .env.local:
 *   A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD
 *   A11Y_BASE_URL (optional — defaults to http://localhost:5173)
 *
 * Usage:
 *   node scripts/a11y-axe-scan.cjs
 *   node scripts/a11y-axe-scan.cjs --url=https://agencytrack-git-<branch>.vercel.app
 *   node scripts/a11y-axe-scan.cjs --dark   # scan in dark mode
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

// ── Env ──────────────────────────────────────────────────────────────────────
loadDotEnvLocal();

function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  const lines = text.split(/\r?\n/);
  // First pass: validate every line. Throw before mutating process.env so a
  // partial parse can't precede the failure. Detection target: a line where
  // the value half contains an embedded `KEY=` pattern, which only happens
  // when two key=value pairs got concatenated by a missing newline (see
  // TOOLING-N — silent corruption ate an hour of the SEC-9 autonomous run).
  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const embedded = val.match(/([A-Z][A-Z0-9_]*)=/);
    if (embedded) {
      throw new Error(
        `Malformed .env.local: line ${i + 1} appears to concatenate two keys ` +
        `("${key}" and "${embedded[1]}"). Ensure each key is on its own line ` +
        `and the file ends with a trailing newline.`
      );
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    parsed.push([key, val]);
  }
  for (const [key, val] of parsed) {
    if (!(key in process.env)) process.env[key] = val;
  }
}

const argUrl = (process.argv.find((a) => a.startsWith('--url=')) || '').replace('--url=', '');
const BASE_URL = argUrl || process.env.A11Y_BASE_URL || 'http://localhost:5173';
const EMAIL    = process.env.A11Y_AGENT_EMAIL;
const PASSWORD = process.env.A11Y_AGENT_PASSWORD;
const BYPASS   = process.env.VERCEL_BYPASS_TOKEN || '';
// `--dark`: enables dark mode pre-mount by setting localStorage
// `agencytrack-dark = '1'`, then reloading. Mirrors the AgencyTrack
// dark-mode toggle (see src/main.jsx). Mirrors the manager scan script.
const DARK     = process.argv.includes('--dark');

if (!EMAIL || !PASSWORD) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD in .env.local');
  process.exit(1);
}

async function applyVercelBypass(page) {
  if (!BYPASS) return;
  if (!/vercel\.app/i.test(BASE_URL)) return;
  // Visit with bypass query — Vercel sets a persistent bypass cookie on the response.
  const u = new URL(BASE_URL);
  u.searchParams.set('x-vercel-protection-bypass', BYPASS);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
}

// ── Pages to scan ────────────────────────────────────────────────────────────
// Each entry: [pageId, gotoFn(page) -> Promise<void>]
const PAGES = [
  ['login', async (page) => {
    await applyVercelBypass(page);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    // Login screen is the unauthenticated landing — wait for the AT brand.
    await page.waitForSelector('text=AgencyTrack', { timeout: 10_000 });
  }],
  ['dashboard',     async (page) => clickTab(page, 'Dashboard')],
  ['career',        async (page) => clickTab(page, 'Career')],
  ['awards',        async (page) => clickTab(page, 'Awards')],
  ['leaderboard',   async (page) => clickTab(page, 'Leaderboard')],
  ['history',       async (page) => clickTab(page, 'History')],
  ['profile',       async (page) => clickTab(page, 'Profile')],
  ['wizard_picker', async (page) => {
    await clickTab(page, 'Dashboard');
    await page.getByRole('button', { name: /Submit Weekly Report/i }).click();
    await page.waitForSelector('text=Select Week', { timeout: 10_000 });
  }],
];

async function clickTab(page, label) {
  await page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).click();
  await page.waitForTimeout(300); // allow tab content to render
}

// ── Login flow ───────────────────────────────────────────────────────────────
async function signIn(page) {
  await applyVercelBypass(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for the post-login dashboard tab bar.
  await page.waitForSelector('text=Dashboard', { timeout: 15_000 });

  if (DARK) {
    // Persist the toggle and reload so main.jsx applies the dark
    // class pre-mount (no FOUC, matches user behavior). Use
    // domcontentloaded — Firebase listeners keep the network busy
    // long after the page is interactive, so networkidle would time out.
    await page.evaluate(() => localStorage.setItem('agencytrack-dark', '1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Dashboard', { timeout: 15_000 });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '').slice(0, 15);
  const browser = await chromium.launch();
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  const report = {
    startedAt: startedAt.toISOString(),
    baseUrl: BASE_URL,
    side: 'agent',
    mode: DARK ? 'dark' : 'light',
    pages: {},
    totals: { byRule: {}, nodes: 0, violations: 0 },
  };

  try {
    for (const [pageId, gotoFn] of PAGES) {
      // login is special — covered by signIn for non-login pages
      if (pageId === 'login') {
        await gotoFn(page);
      } else if (pageId === 'dashboard') {
        await signIn(page);
      } else {
        await gotoFn(page);
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
    }
  } finally {
    await browser.close();
  }

  // Print totals
  console.log('\n── TOTALS ──');
  console.log(`Total violations: ${report.totals.violations}`);
  console.log(`Total nodes:      ${report.totals.nodes}`);
  console.log('By rule:');
  for (const [rule, count] of Object.entries(report.totals.byRule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule.padEnd(28)} ${count}`);
  }

  // Save report
  const outDir = path.resolve(process.cwd(), 'verification', 'a11y');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `agent${DARK ? '-dark' : ''}_${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${path.relative(process.cwd(), outPath)}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

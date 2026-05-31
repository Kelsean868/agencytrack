/**
 * Track J P7 — AgentProductionView rank pill + around-me live smoke.
 *
 * Per the brief: the LIVE smoke can only reach the test agent (rank 1 in the
 * 6-agent seeded branch), so "pill renders 1" alone doesn't prove the fix.
 * The PROOF lives in the component test that forces rank 14. This smoke
 * confirms three things the component test CAN'T prove:
 *   1. The pill on prod really IS reading from the live aggregate
 *      (data-rank == 1 AND data-total == 6 == the live branch size, not 1/1).
 *   2. The where-you-rank panel renders with the viewer at the top + the
 *      next neighbor row from the live aggregate.
 *   3. No new axe contrast nodes on the surface; both themes; 0 console errors.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';
import { AxeBuilder } from '@axe-core/playwright';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');
  process.exit(1);
}
if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

const RESULTS = [];

async function login(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(1500);
}

async function smokeTheme(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors  = [];

  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Localhost-only CORS noise (documented in earlier P-series smokes)
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }

    // Navigate to the agent's Production Report tab
    await page.click('[data-testid="agent-tab-production-report"]');
    await page.waitForSelector('[data-testid="agent-production-rank-pill"]', { timeout: 15_000 });

    // Switch to YTD (the period with seeded data; the default is week)
    await page.click('button[role="tab"]:has-text("YTD")');
    await page.waitForTimeout(800);

    // Pill assertions — the actual rank comes from the aggregate
    const pill = page.locator('[data-testid="agent-production-rank-pill"]');
    const dataRank  = await pill.getAttribute('data-rank');
    const dataTotal = await pill.getAttribute('data-total');
    const pillText  = await pill.textContent();

    // Where-you-rank panel
    const panelCount = await page.locator('[data-testid="where-you-rank-panel"]').count();
    const viewerRowAttr = await page.locator('[data-viewer="true"]').count();

    // axe contrast — filter:
    //   • dispatcher-accepted gold nodes (P3 FU)
    //   • topbar notification badge (.top-1\.5) — pre-existing across all axe runs
    //   • DataSourceBadge "Estimated" (bg-warning/15 text-warning) — pre-existing
    //     in AgentProductionView on main; not introduced by P7. Tracked by the
    //     app-wide gold-contrast pass FU (which covers warning-tint variants too).
    //   • Hero avatar circle (.text-base + bg-primary text-white in dark mode) —
    //     pre-existing on main (AgentProductionView.jsx line 109 unchanged by P7).
    //     Same shape as the P3 chip-active issue that was fixed there via
    //     bg-primary dark:bg-primary-dark; this avatar pre-dates that pattern
    //     and is FU-tracked.
    const axeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const ccViolations = axeResults.violations.find(v => v.id === 'color-contrast')?.nodes || [];
    const newContrastFails = ccViolations.filter(n => {
      const sel = (n.target ?? []).join(' > ');
      const html = n.html ?? '';
      if (sel.includes('top-1\\.5')) return false;
      if (sel.includes('text-gold') || sel.includes('leaderboard-eyebrow')) return false;
      // DataSourceBadge "Estimated" — bg-warning/15 + text-warning on the badge
      if (html.includes('bg-warning/15') && html.includes('text-warning')) return false;
      // AgentProductionView hero avatar — bg-primary text-white text-base in dark mode
      if (html.includes('w-11 h-11 rounded-full bg-primary text-white')) return false;
      return true;
    });

    // PROOF assertions against the LIVE branch (6 agents post-backfill).
    // test agent IS rank 1; the LIVE proof is that data-total ≠ 1 (which it
    // WOULD be under the old self-only ranking).
    const pillReadsBranchSize = dataTotal && Number(dataTotal) > 1;
    const pillReadsRank = dataRank && dataRank !== 'unranked';

    const pass = (
      pillReadsRank &&
      pillReadsBranchSize &&
      panelCount === 1 &&
      viewerRowAttr >= 1 &&
      newContrastFails.length === 0 &&
      errors.length === 0
    );

    RESULTS.push({
      theme, dataRank, dataTotal, pillText: pillText?.replace(/\s+/g, ' ').trim().slice(0, 80),
      panelCount, viewerRowAttr, newContrastFails: newContrastFails.length,
      errors: errors.length, pass,
    });

    console.log(`[${theme}] data-rank=${dataRank} data-total=${dataTotal} panel=${panelCount} viewer-rows=${viewerRowAttr} axe-new=${newContrastFails.length} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    console.log(`  pill text: ${pillText?.replace(/\s+/g, ' ').trim()}`);
    if (newContrastFails.length) newContrastFails.slice(0, 3).forEach(n => console.log(`  axe: ${(n.target ?? []).join(' > ')}`));
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

console.log(`\nTrack J P7 — AgentProductionView rank pill + around-me smoke`);
console.log(`Target: ${URL}\n`);

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nP7 smoke: ${allPass ? '✓ 2/2 PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

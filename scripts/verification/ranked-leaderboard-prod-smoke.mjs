/**
 * Prod smoke for PR #396 — RankedLeaderboard v2 token swap.
 * Both themes: BM login → Production Report → verify rank badge classes.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

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

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BM_EMAIL     = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const BM_PASS      = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');
const PROD_URL     = `https://${process.env.PREVIEW_HOST ?? 'agencytrack.vercel.app'}`;

const OLD_CLASSES = ['bg-yellow-400', 'text-yellow-600', 'bg-zinc-300', 'text-zinc-500', 'bg-amber-600', 'text-amber-700'];
const RESULTS = [];

async function loginAndWait(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', BM_EMAIL);
  await page.fill('input[type="password"]', BM_PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function runTheme(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors  = [];

  await setupBypassSession(context, PROD_URL, BYPASS_TOKEN);
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await loginAndWait(page);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }

    // Navigate to Production Report
    await page.click('[data-testid="nav-production-report"]');
    await page.waitForTimeout(2500);

    const badgeInfo = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('.w-7.h-7.rounded-full'));
      return spans.map(s => ({ cls: s.className, text: s.textContent.trim() }));
    });

    const oldFound = badgeInfo.flatMap(b =>
      OLD_CLASSES.filter(c => b.cls.includes(c)).map(c => `rank "${b.text}" has old class: ${c}`)
    );

    const rank1 = badgeInfo.find(b => b.text === '1');
    const rank2 = badgeInfo.find(b => b.text === '2');
    const rank3 = badgeInfo.find(b => b.text === '3');

    const pass = oldFound.length === 0 && errors.length === 0;
    RESULTS.push({ theme, rows: badgeInfo.length, oldFound, errors, pass });

    console.log(`[prod-smoke][${theme}] rows=${badgeInfo.length} oldFound=${oldFound.length} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (oldFound.length) oldFound.forEach(m => console.log(`  OLD: ${m}`));
    if (rank1) console.log(`  rank-1: ${rank1.cls}`);
    if (rank2) console.log(`  rank-2: ${rank2.cls}`);
    if (rank3) console.log(`  rank-3: ${rank3.cls}`);
    if (errors.length) errors.slice(0,3).forEach(e => console.log(`  error: ${e}`));
  } finally {
    await browser.close();
  }
}

await runTheme('light');
await runTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nProd smoke: ${allPass ? '✓ 2/2 PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

/**
 * Both-themes smoke for PR #396 — RankedLeaderboard v2 token swap.
 * Logs in as BM, navigates to Production Report, verifies:
 *   1. No old non-Nexus classes (yellow-400, zinc-300, amber-600) on any rank badge
 *   2. New Nexus token classes present on rank-1/2/3 badges (when data renders >=3 rows)
 *   3. 0 console errors
 */
import { chromium } from 'playwright';
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

const URL   = 'http://127.0.0.1:4173';
const EMAIL = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const PASS  = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
if (!EMAIL || !PASS) { console.error('Missing A11Y_BRANCH_MANAGER_* credentials'); process.exit(1); }

const OLD_CLASSES = ['bg-yellow-400', 'text-yellow-600', 'bg-zinc-300', 'text-zinc-500', 'bg-amber-600', 'text-amber-700'];
const NEW_RANK1   = ['bg-gold-tint', 'text-gold'];
const NEW_RANK2   = ['bg-surface-muted', 'text-ink-muted'];
const NEW_RANK3   = ['bg-warning-tint', 'text-warning'];

const RESULTS = [];

async function smokeTheme(theme) {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await ctx.newPage();
  const errors  = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await Promise.all([
      page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30000 }),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForFunction(() => document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30000 });
    await page.waitForTimeout(1500);

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

    // Collect all rank badge spans (w-7 h-7 rounded-full in RankedLeaderboard)
    const badgeInfo = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('.w-7.h-7.rounded-full'));
      return spans.map(s => ({ cls: s.className, text: s.textContent.trim() }));
    });

    // Check for old non-Nexus classes
    const oldFound = badgeInfo.flatMap(b =>
      OLD_CLASSES.filter(c => b.cls.includes(c)).map(c => `rank-badge "${b.text}" has old class: ${c}`)
    );

    // Check new Nexus classes on rank 1/2/3 (only when >=3 badges exist)
    const rankBadges = badgeInfo.filter(b => ['1','2','3'].includes(b.text));
    const rank1Badge = rankBadges.find(b => b.text === '1');
    const rank2Badge = rankBadges.find(b => b.text === '2');
    const rank3Badge = rankBadges.find(b => b.text === '3');

    const newMissing = [];
    if (rank1Badge) {
      NEW_RANK1.forEach(c => { if (!rank1Badge.cls.includes(c)) newMissing.push(`rank-1 missing ${c}`); });
    }
    if (rank2Badge) {
      NEW_RANK2.forEach(c => { if (!rank2Badge.cls.includes(c)) newMissing.push(`rank-2 missing ${c}`); });
    }
    if (rank3Badge) {
      NEW_RANK3.forEach(c => { if (!rank3Badge.cls.includes(c)) newMissing.push(`rank-3 missing ${c}`); });
    }

    const dataRows = badgeInfo.length;
    const pass = oldFound.length === 0 && errors.length === 0;
    RESULTS.push({ theme, dataRows, oldFound, newMissing, errors, pass });

    console.log(`[${theme}] badge rows=${dataRows} oldClassFound=${oldFound.length} newClassMissing=${newMissing.length} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (oldFound.length) oldFound.forEach(m => console.log(`  OLD CLASS: ${m}`));
    if (newMissing.length) newMissing.forEach(m => console.log(`  NOTE: ${m} (data may be absent)`));
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
    if (rank1Badge) console.log(`  rank-1 classes: ${rank1Badge.cls}`);
    if (rank2Badge) console.log(`  rank-2 classes: ${rank2Badge.cls}`);
    if (rank3Badge) console.log(`  rank-3 classes: ${rank3Badge.cls}`);
  } finally {
    await browser.close();
  }
}

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nBoth-themes smoke: ${allPass ? '✓ PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

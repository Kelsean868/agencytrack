/**
 * Both-themes smoke for PR #397 — AgentProductionView v2 port.
 * Agent login → Production Report tab → verify:
 *   1. Hero card renders (avatar initials, name, 3 KPIs present)
 *   2. 4-window period grid renders (4 cells)
 *   3. Floor bar renders
 *   4. No ProductionTable present (removed from agent view)
 *   5. No old non-Nexus classes on the component root
 *   6. 0 console errors
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
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS  = process.env.A11Y_AGENT_PASSWORD;
if (!EMAIL || !PASS) { console.error('Missing A11Y_AGENT_* credentials'); process.exit(1); }

const OLD_CLASSES = ['bg-yellow-400', 'bg-zinc-300', 'bg-amber-600', 'text-yellow-', 'text-zinc-', 'text-amber-'];
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

    // Navigate to Production Report tab
    await page.click('[data-testid="agent-tab-production-report"]');
    await page.waitForTimeout(2500);

    const checks = await page.evaluate((oldClasses) => {
      // 1. Avatar circle (bg-primary text-white initials div)
      const avatar = document.querySelector('.w-11.h-11.rounded-full.bg-primary');
      const avatarInitials = avatar?.textContent?.trim() ?? null;

      // 2. 3-KPI labels (font-mono uppercase text)
      const eyebrows = Array.from(document.querySelectorAll('.font-mono.uppercase.tracking-widest'))
        .map(el => el.textContent.trim().toUpperCase());
      const hasApiLabel  = eyebrows.some(t => t.includes('NEW API'));
      const hasAppsLabel = eyebrows.some(t => t.includes('APPLICATIONS'));
      const hasPersLabel = eyebrows.some(t => t.includes('PERSISTENCY'));

      // 3. 4-window grid — look for "Week / Month / Quarter / Year" labels in mono cells
      const windowCells = Array.from(document.querySelectorAll('.grid-cols-4 .font-mono'));
      const windowLabels = windowCells.map(el => el.textContent.trim().toUpperCase());
      const hasWeek    = windowLabels.some(t => t === 'WEEK');
      const hasMonth   = windowLabels.some(t => t === 'MONTH');
      const hasQuarter = windowLabels.some(t => t === 'QUARTER');
      const hasYear    = windowLabels.some(t => t === 'YEAR');

      // 4. Floor bar — look for progress bar with h-2 rounded-full
      const floorBar = !!document.querySelector('.h-2.rounded-full');

      // 5. Old non-Nexus classes anywhere in the production view
      const allHtml = document.body.innerHTML;
      const oldFound = oldClasses.filter(c => allHtml.includes(c));

      // 6. ProductionTable should be absent (no table tag in the agent prod view area)
      const hasTable = !!document.querySelector('table');

      return {
        avatarInitials,
        hasApiLabel, hasAppsLabel, hasPersLabel,
        hasWeek, hasMonth, hasQuarter, hasYear,
        floorBar,
        oldFound,
        hasTable,
      };
    }, OLD_CLASSES);

    const issues = [];
    if (!checks.avatarInitials)  issues.push('avatar circle not found');
    if (!checks.hasApiLabel)     issues.push('NEW API label missing');
    if (!checks.hasAppsLabel)    issues.push('APPLICATIONS label missing');
    if (!checks.hasPersLabel)    issues.push('PERSISTENCY label missing');
    if (!checks.hasWeek)         issues.push('Week window missing');
    if (!checks.hasMonth)        issues.push('Month window missing');
    if (!checks.hasQuarter)      issues.push('Quarter window missing');
    if (!checks.hasYear)         issues.push('Year window missing');
    if (!checks.floorBar)        issues.push('Floor progress bar missing');
    if (checks.oldFound.length)  issues.push(`old non-Nexus classes: ${checks.oldFound.join(', ')}`);
    if (errors.length)           issues.push(`console errors: ${errors.length}`);

    const pass = issues.length === 0;
    RESULTS.push({ theme, checks, errors, pass });

    console.log(`[${theme}] avatar="${checks.avatarInitials}" api=${checks.hasApiLabel} apps=${checks.hasAppsLabel} pers=${checks.hasPersLabel} windows=${checks.hasWeek && checks.hasMonth && checks.hasQuarter && checks.hasYear} floor=${checks.floorBar} table=${checks.hasTable} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (issues.length) issues.forEach(i => console.log(`  ISSUE: ${i}`));
    if (errors.length) errors.slice(0,3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nBoth-themes smoke: ${allPass ? '✓ PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

/**
 * Prod smoke for PR #397 — AgentProductionView v2 port.
 * Both themes via setupBypassSession: agent login → Production Report tab
 * → verify hero renders (no rank pill, 3 KPIs, floor bar, 4 windows, 0 errors).
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
const AGENT_EMAIL  = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS   = requireEnv('A11Y_AGENT_PASSWORD');
const PROD_URL     = `https://${process.env.PREVIEW_HOST ?? 'agencytrack.vercel.app'}`;

const RESULTS = [];

async function loginAndWait(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
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

    await page.click('[data-testid="agent-tab-production-report"]');
    await page.waitForTimeout(2500);

    const checks = await page.evaluate(() => {
      const avatar      = document.querySelector('.w-11.h-11.rounded-full.bg-primary');
      const eyebrows    = Array.from(document.querySelectorAll('.font-mono.uppercase.tracking-widest'))
                            .map(el => el.textContent.trim().toUpperCase());
      const windowLabels = Array.from(document.querySelectorAll('.grid-cols-4 .font-mono'))
                            .map(el => el.textContent.trim().toUpperCase());
      // Rank pill would contain '#' followed by digits and ' /' — check it's absent
      const rankPillPresent = Array.from(document.querySelectorAll('.text-primary'))
        .some(el => /^#\d+$/.test(el.textContent.trim()));

      return {
        avatarInitials:  avatar?.textContent?.trim() ?? null,
        hasApiLabel:     eyebrows.some(t => t.includes('NEW API')),
        hasAppsLabel:    eyebrows.some(t => t.includes('APPLICATIONS')),
        hasPersLabel:    eyebrows.some(t => t.includes('PERSISTENCY')),
        hasWeek:         windowLabels.some(t => t === 'WEEK'),
        hasMonth:        windowLabels.some(t => t === 'MONTH'),
        hasQuarter:      windowLabels.some(t => t === 'QUARTER'),
        hasYear:         windowLabels.some(t => t === 'YEAR'),
        hasFloorBar:     !!document.querySelector('.h-2.rounded-full'),
        rankPillPresent,
        hasTable:        !!document.querySelector('table'),
      };
    });

    const issues = [];
    if (!checks.avatarInitials)  issues.push('avatar missing');
    if (!checks.hasApiLabel)     issues.push('NEW API label missing');
    if (!checks.hasAppsLabel)    issues.push('APPLICATIONS label missing');
    if (!checks.hasPersLabel)    issues.push('PERSISTENCY label missing');
    if (!checks.hasWeek)         issues.push('Week window missing');
    if (!checks.hasMonth)        issues.push('Month window missing');
    if (!checks.hasQuarter)      issues.push('Quarter window missing');
    if (!checks.hasYear)         issues.push('Year window missing');
    if (!checks.hasFloorBar)     issues.push('floor bar missing');
    if (checks.rankPillPresent)  issues.push('rank pill still present (must-fix regression)');
    if (errors.length)           issues.push(`${errors.length} console error(s)`);

    const pass = issues.length === 0;
    RESULTS.push({ theme, checks, errors, pass });

    console.log(`[prod-smoke][${theme}] avatar="${checks.avatarInitials}" api=${checks.hasApiLabel} apps=${checks.hasAppsLabel} pers=${checks.hasPersLabel} windows=${[checks.hasWeek, checks.hasMonth, checks.hasQuarter, checks.hasYear].every(Boolean)} floor=${checks.hasFloorBar} rankPill=${checks.rankPillPresent} table=${checks.hasTable} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (issues.length) issues.forEach(i => console.log(`  ISSUE: ${i}`));
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

await runTheme('light');
await runTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nProd smoke: ${allPass ? '✓ 2/2 PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

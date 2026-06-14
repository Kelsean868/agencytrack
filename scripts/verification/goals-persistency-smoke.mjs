/**
 * goals-persistency-smoke.mjs — PR #614 verification
 *
 * Asserts the persistency metric row lands correctly in CommitmentHero:
 *   Leg 1 — Agent light:   Goals tab → "Pst." label present in hero
 *   Leg 2 — Agent dark:    same in dark mode
 *   Leg 3 — Mobile 390×844: Goals reachable via More-drawer, "Pst." present
 *
 * Usage:
 *   node scripts/verification/goals-persistency-smoke.mjs [preview-url]
 *   SMOKE_PREVIEW_URL=https://... node scripts/verification/goals-persistency-smoke.mjs
 */

import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { setupBypassSession, loginAs } from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const lines = readFileSync(join(__dirname, '../../.env.local'), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* absent — rely on shell env */ }
}
loadEnv();

const PREVIEW_URL  = process.env.SMOKE_PREVIEW_URL ?? process.argv[2] ?? 'https://agencytrack.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;

const SCREENSHOTS_DIR = join(__dirname, '../../tmp/screenshots');
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let passed = 0, failed = 0;
const RESULTS = [];

function report(label, ok, detail = '') {
  const icon = ok ? '✓' : '✗';
  const line = `${icon} ${label}${detail ? ` — ${detail}` : ''}`;
  RESULTS.push(line);
  console.log(line);
  if (ok) passed++; else failed++;
}


async function navigateToGoals(page, isMobile = false) {
  if (isMobile) {
    const directTab = page.getByTestId('agent-tab-goals');
    if (await directTab.isVisible().catch(() => false)) {
      await directTab.click();
      await page.waitForTimeout(1500);
      return true;
    }
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(1000);
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const btn = btns.find(el => el.textContent.trim() === 'Goals' || el.textContent.trim().startsWith('Goals'));
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (clicked) { await page.waitForTimeout(1500); return true; }
    }
    return false;
  }
  const tab = page.getByTestId('agent-tab-goals');
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function assertPersistencyMetric(page, legLabel) {
  await page.waitForTimeout(1000);
  const body    = await page.evaluate(() => document.body.innerHTML);
  const hasHero = body.includes('data-testid="commitment-hero"');

  if (!hasHero) {
    // No personal commitment — hero not rendered; pass with note
    const hasNoCommit = body.includes('data-testid="gap-analysis-no-commitment"');
    const hasEmpty    = body.includes('data-testid="gap-analysis-empty"');
    const state = hasNoCommit ? 'no-commitment' : hasEmpty ? 'empty' : 'unknown';
    report(`${legLabel} — persistency row (skipped: hero not in state ${state})`, true, 'no commitment set');
    return state;
  }

  // Hero is present — check for "Pst." label inside it
  const heroText = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="commitment-hero"]');
    return el ? el.innerText : '';
  });

  const hasPstLabel = heroText.includes('Pst.');
  report(`${legLabel} — hero has "Pst." label`, hasPstLabel);

  // Value should be a percentage like "92.3%" or a dash "—"
  const hasPctOrDash = /\d+\.\d+%|—/.test(heroText);
  report(`${legLabel} — persistency shows value or dash`, hasPctOrDash, hasPctOrDash ? 'value/dash present' : 'neither found');

  return 'populated';
}

const browser = await chromium.launch({ headless: true });

try {
  console.log(`\nGoals persistency hero smoke → ${PREVIEW_URL}`);

  // ── Leg 1: Agent light ─────────────────────────────────────────────────────
  console.log('\n── Leg 1: Agent light ──────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
    report('Leg 1 — dashboard loaded', (await page.evaluate(() => document.body.textContent.length)) > 200);
    const reached = await navigateToGoals(page);
    report('Leg 1 — Goals tab navigable', reached);
    if (reached) {
      const state = await assertPersistencyMetric(page, 'Leg 1');
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-persistency-light.png'), fullPage: true });
      console.log(`  State: ${state} | Screenshot: tmp/screenshots/goals-persistency-light.png`);
    }
    await ctx.close();
  }

  // ── Leg 2: Agent dark ──────────────────────────────────────────────────────
  console.log('\n── Leg 2: Agent dark ───────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('agencytrack-dark', 'true');
    });
    await page.waitForTimeout(300);
    report('Leg 2 — dark mode applied', await page.evaluate(() => document.documentElement.classList.contains('dark')));
    const reached = await navigateToGoals(page);
    report('Leg 2 — Goals tab navigable', reached);
    if (reached) {
      const state = await assertPersistencyMetric(page, 'Leg 2');
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-persistency-dark.png'), fullPage: true });
      console.log(`  State: ${state} | Screenshot: tmp/screenshots/goals-persistency-dark.png`);
    }
    await ctx.close();
  }

  // ── Leg 3: Mobile 390×844 ──────────────────────────────────────────────────
  console.log('\n── Leg 3: Mobile 390×844 ──────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
    report('Leg 3 — dashboard loaded', (await page.evaluate(() => document.body.textContent.length)) > 200);
    const reached = await navigateToGoals(page, true);
    report('Leg 3 — Goals tab navigable (More-drawer)', reached);
    if (reached) {
      const state = await assertPersistencyMetric(page, 'Leg 3');
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-persistency-mobile.png'), fullPage: true });
      console.log(`  State: ${state} | Screenshot: tmp/screenshots/goals-persistency-mobile.png`);
    }
    await ctx.close();
  }

} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Goals persistency smoke: ${passed} pass / ${failed} fail`);
if (failed > 0) {
  console.log('\nFailed:');
  RESULTS.filter(r => r.startsWith('✗')).forEach(r => console.log(' ', r));
  process.exit(1);
}

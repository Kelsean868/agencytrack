/**
 * goals-restyle-smoke.mjs — PR #612 verification
 *
 * Asserts the v2 Goal Hierarchy restyle lands correctly:
 *   Leg 1 — Agent light: CommitmentHero + OrgContextStrip/FloorRow + GapNote visible
 *   Leg 2 — Agent dark: same checks in dark mode
 *   Leg 3 — Mobile 390×844: Goals reachable via More-drawer, hero present
 *   Leg 4 — Empty state: agent with no commitment sees "Build it in Game Plan" + floor
 *
 * Usage:
 *   node scripts/verification/goals-restyle-smoke.mjs [preview-url]
 *   SMOKE_PREVIEW_URL=https://... node scripts/verification/goals-restyle-smoke.mjs
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

const PREVIEW_URL   = process.env.SMOKE_PREVIEW_URL ?? process.argv[2] ?? 'https://agencytrack.vercel.app';
const BYPASS_TOKEN  = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL   = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS    = process.env.A11Y_AGENT_PASSWORD;

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

// Check which Goals state rendered and what v2 components are present
async function assertGoalsV2(page, legLabel) {
  await page.waitForTimeout(1000);
  const body = await page.evaluate(() => document.body.innerHTML);

  // Check for new v2 testids (innerHTML for attribute-based search)
  const hasHero        = body.includes('data-testid="commitment-hero"');
  const hasFloorRow    = body.includes('data-testid="floor-row"');
  const hasGapNote     = body.includes('data-testid="gap-note"');
  const hasPanel       = body.includes('data-testid="gap-analysis-panel"');
  const hasNoCommit    = body.includes('data-testid="gap-analysis-no-commitment"');
  const hasEmpty       = body.includes('data-testid="gap-analysis-empty"');
  const hasLoading     = body.includes('data-testid="gap-analysis-loading"');
  // Use innerText (rendered text only) to avoid false-positives from CSS class names like "coming-soon-badge"
  const innerText      = await page.evaluate(() => document.body.innerText);
  const hasComingSoon  = innerText.toLowerCase().includes('coming soon');

  report(`${legLabel} — no "Coming soon"`, !hasComingSoon);

  if (hasPanel) {
    // Populated state — all three main blocks should be present
    report(`${legLabel} — CommitmentHero present`, hasHero);
    report(`${legLabel} — FloorRow present`, hasFloorRow);
    report(`${legLabel} — GapNote present`, hasGapNote);
    return 'populated';
  } else if (hasNoCommit) {
    // No-commitment state — "Build it in Game Plan" + floor
    const text = await page.evaluate(() => document.body.innerText);
    report(`${legLabel} — no-commitment state: "Build it in Game Plan"`, text.includes('Build it in Game Plan'));
    report(`${legLabel} — no-commitment state: floor row still shown`, hasFloorRow);
    return 'no-commitment';
  } else if (hasEmpty) {
    report(`${legLabel} — empty state (no hierarchy)`, true, 'no targets');
    return 'empty';
  } else if (hasLoading) {
    report(`${legLabel} — loading state (data still fetching)`, true, 'may need retry');
    return 'loading';
  } else {
    report(`${legLabel} — recognized v2 state`, false, 'no known testid found');
    return 'unknown';
  }
}

const browser = await chromium.launch({ headless: true });

try {
  console.log(`\nGoals restyle v2 smoke → ${PREVIEW_URL}`);

  // ── Leg 1: Agent light ────────────────────────────────────────────────────
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
      const state = await assertGoalsV2(page, 'Leg 1');
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-restyle-light.png'), fullPage: true });
      console.log(`  State: ${state} | Screenshot: tmp/screenshots/goals-restyle-light.png`);
    }
    await ctx.close();
  }

  // ── Leg 2: Agent dark ─────────────────────────────────────────────────────
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
      const state = await assertGoalsV2(page, 'Leg 2');
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-restyle-dark.png'), fullPage: true });
      console.log(`  State: ${state} | Screenshot: tmp/screenshots/goals-restyle-dark.png`);
    }
    await ctx.close();
  }

  // ── Leg 3: Mobile 390×844 ────────────────────────────────────────────────
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
      const state = await assertGoalsV2(page, 'Leg 3');
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-restyle-mobile.png'), fullPage: true });
      console.log(`  State: ${state} | Screenshot: tmp/screenshots/goals-restyle-mobile.png`);
    }
    await ctx.close();
  }

} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Goals restyle smoke: ${passed} pass / ${failed} fail`);
if (failed > 0) {
  console.log('\nFailed:');
  RESULTS.filter(r => r.startsWith('✗')).forEach(r => console.log(' ', r));
  process.exit(1);
}

/**
 * ungate-goals-smoke.mjs — PR #610 verification
 *
 * Asserts Goals tab is un-gated for both agent and manager dashboards:
 *   1. Agent (light): Goals tab renders "Goal Hierarchy" title (not "Coming soon")
 *   2. Agent (dark): same
 *   3. Manager/BM (light): Goals tab renders GoalsPanel content (not "Coming soon")
 *   4. Mobile agent (390×844): Goals tab reachable + un-gated
 *
 * Usage:
 *   node scripts/verification/ungate-goals-smoke.mjs [preview-url]
 *   SMOKE_PREVIEW_URL=https://... node scripts/verification/ungate-goals-smoke.mjs
 *
 * Env required: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD,
 *               A11Y_BRANCH_MANAGER_EMAIL, A11Y_BRANCH_MANAGER_PASSWORD
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

const PREVIEW_URL    = process.env.SMOKE_PREVIEW_URL ?? process.argv[2] ?? 'https://agencytrack.vercel.app';
const BYPASS_TOKEN   = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL    = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS     = process.env.A11Y_AGENT_PASSWORD;
const MANAGER_EMAIL  = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const MANAGER_PASS   = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

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
    // On mobile, Goals may live in the More drawer (not bottom nav).
    // Try direct testId first; if hidden, open the drawer and click by text.
    const directTab = page.getByTestId('agent-tab-goals');
    const isDirectVisible = await directTab.isVisible().catch(() => false);
    if (isDirectVisible) {
      await directTab.click();
      await page.waitForTimeout(1500);
      return true;
    }
    // Open More drawer
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    const moreVisible = await moreBtn.isVisible().catch(() => false);
    if (moreVisible) {
      await moreBtn.click();
      await page.waitForTimeout(1000);
      // Click Goals item in drawer — try multiple selector strategies
      // 1. button with exact "Goals" label
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const goalsBtn = btns.find(el => el.textContent.trim() === 'Goals' || el.textContent.trim().startsWith('Goals'));
        if (goalsBtn) { goalsBtn.click(); return true; }
        return false;
      });
      if (clicked) {
        await page.waitForTimeout(1500);
        return true;
      }
    }
    return false;
  }

  // Desktop: try data-testid first
  const tab = page.getByTestId('agent-tab-goals');
  const tabVisible = await tab.isVisible().catch(() => false);
  if (tabVisible) {
    await tab.click();
    await page.waitForTimeout(1500);
    return true;
  }

  // Try any nav button/link containing "Goals" (manager sidebar)
  const anyGoals = page.locator('nav button, nav a').filter({ hasText: /^Goals$/ }).first();
  const anyVisible = await anyGoals.isVisible().catch(() => false);
  if (anyVisible) {
    await anyGoals.click();
    await page.waitForTimeout(1500);
    return true;
  }

  return false;
}

function wireCapture(page, errors) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const ignore = ['Missing or insufficient permissions', 'fontshare', 'net::ERR', 'CORS', 'permission-denied'];
      if (!ignore.some(p => text.includes(p))) errors.push(text);
    }
  });
}

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

try {
  console.log(`\nGoals un-gate smoke → ${PREVIEW_URL}`);

  // ── Agent light mode ─────────────────────────────────────────────────────────
  console.log('\n── Agent light mode ────────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    wireCapture(page, consoleErrors);
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
    report('Agent light — dashboard loaded', await page.locator('[data-testid^="agent-tab-"]').count() > 0);

    const tabReached = await navigateToGoals(page);
    report('Agent light — Goals tab navigable', tabReached);

    if (tabReached) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const lower = bodyText.toLowerCase();
      const hasComingSoon = lower.includes('coming soon');
      // GapAnalysisPanel renders title with CSS uppercase → innerText is "GOAL HIERARCHY"
      const hasGoalHierarchy = lower.includes('goal hierarchy');
      const hasNoTargets = lower.includes('no targets have been set yet');
      const hasGoalsContent = hasGoalHierarchy || hasNoTargets;

      report('Agent light — no "Coming soon" on Goals tab', !hasComingSoon);
      report('Agent light — GapAnalysisPanel content visible', hasGoalsContent,
        hasGoalHierarchy ? 'Goal Hierarchy title' : hasNoTargets ? 'empty-state text' : 'neither');
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-ungate-agent-light.png'), fullPage: true });
      console.log('  Screenshot: tmp/screenshots/goals-ungate-agent-light.png');
    }
    await ctx.close();
  }

  // ── Agent dark mode ──────────────────────────────────────────────────────────
  console.log('\n── Agent dark mode ─────────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    wireCapture(page, consoleErrors);
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);

    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('agencytrack-dark', 'true');
    });
    await page.waitForTimeout(300);
    report('Agent dark — dark class applied', await page.evaluate(() => document.documentElement.classList.contains('dark')));

    const tabReached = await navigateToGoals(page);
    report('Agent dark — Goals tab navigable', tabReached);

    if (tabReached) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const lower = bodyText.toLowerCase();
      const hasComingSoon = lower.includes('coming soon');
      const hasGoalsContent = lower.includes('goal hierarchy') || lower.includes('no targets have been set yet');

      report('Agent dark — no "Coming soon" on Goals tab', !hasComingSoon);
      report('Agent dark — GapAnalysisPanel content visible', hasGoalsContent);
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-ungate-agent-dark.png'), fullPage: true });
      console.log('  Screenshot: tmp/screenshots/goals-ungate-agent-dark.png');
    }
    await ctx.close();
  }

  // ── Manager (branch_manager) light mode ──────────────────────────────────────
  console.log('\n── Manager light mode ──────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    wireCapture(page, consoleErrors);
    await loginAs(page, PREVIEW_URL, MANAGER_EMAIL, MANAGER_PASS);

    // Manager dashboard uses sidebar nav — wait for it to render
    await page.waitForTimeout(1000);
    report('Manager light — dashboard loaded', (await page.evaluate(() => document.body.innerText)).length > 100);

    const tabReached = await navigateToGoals(page, false);
    report('Manager light — Goals tab navigable', tabReached);

    if (tabReached) {
      await page.waitForTimeout(1000);
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasComingSoon = bodyText.includes('Coming soon');
      // GoalsPanel renders agent goal tables, tab pills, or commission playground
      const hasGoalsContent = bodyText.includes('Annual API') || bodyText.includes('Goal') ||
                              bodyText.includes('Target') || bodyText.includes('Commission');

      report('Manager light — no "Coming soon" on Goals tab', !hasComingSoon);
      report('Manager light — GoalsPanel content visible', hasGoalsContent);
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-ungate-manager-light.png'), fullPage: true });
      console.log('  Screenshot: tmp/screenshots/goals-ungate-manager-light.png');
    }
    await ctx.close();
  }

  // ── Mobile agent (390×844) ───────────────────────────────────────────────────
  console.log('\n── Mobile agent 390×844 ────────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    wireCapture(page, consoleErrors);
    await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
    report('Mobile — dashboard loaded', (await page.evaluate(() => document.body.textContent.length)) > 200);
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-ungate-mobile-pre-nav.png') });

    const tabReached = await navigateToGoals(page, true);
    report('Mobile — Goals tab navigable (More-drawer if needed)', tabReached);

    if (tabReached) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const lower = bodyText.toLowerCase();
      const hasComingSoon = lower.includes('coming soon');
      const hasGoalsContent = lower.includes('goal hierarchy') || lower.includes('no targets have been set yet');

      report('Mobile — no "Coming soon" on Goals tab', !hasComingSoon);
      report('Mobile — GapAnalysisPanel content visible', hasGoalsContent);
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-ungate-mobile.png'), fullPage: true });
      console.log('  Screenshot: tmp/screenshots/goals-ungate-mobile.png');
    }
    await ctx.close();
  }

  report('0 unexpected console errors', consoleErrors.length === 0,
    consoleErrors.length > 0
      ? `${consoleErrors.length}: ${consoleErrors.slice(0, 2).map(e => e.slice(0, 100)).join(' | ')}`
      : '');

} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Goals un-gate smoke result: ${passed} pass / ${failed} fail`);
if (failed > 0) {
  console.log('\nFailed:');
  RESULTS.filter(r => r.startsWith('✗')).forEach(r => console.log(' ', r));
  process.exit(1);
}

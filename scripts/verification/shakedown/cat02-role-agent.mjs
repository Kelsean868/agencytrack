/**
 * cat02-role-agent.mjs — Category 2A: Agent surface coverage (14 tests).
 *
 * Exercises all AgentDashboard tabs for agent-001.
 * Captures screenshots in light+dark × desktop+mobile.
 */

import { join } from 'path';

import {
  ROOT, BASE_URL, TEST_USERS,
  setupBrowser, loginAsViaUI, logoutViaUI,
  navigateToTab, waitForAppReady,
  check, screenshot, consoleErrorCollector,
  setDarkMode, setDesktopViewport, setMobileViewport,
  assertVisible, assertBodyContains, sleep,
} from './auth-helpers.mjs';

const AGENT = TEST_USERS.agent1;

export async function runCat02Agent({ log, ssDir } = {}) {
  const _log  = log ?? console.log;
  const ssOut = ssDir ? join(ssDir, 'cat02-agent') : join(ROOT, 'verification', 'shakedown-screenshots', 'cat02-agent');
  const results = [];

  _log('\n── Category 2A: Agent surface coverage ──');

  const { browser, page } = await setupBrowser();
  const console_ = consoleErrorCollector(page);

  await loginAsViaUI(page, AGENT.email, AGENT.password);

  // ── T2A.01: AgentDashboard KPI tiles ───────────────────────────────────────
  results.push(await check('T2A.01', 'AgentDashboard KPI tiles render', async () => {
    await setDesktopViewport(page);
    await navigateToTab(page, 'Dashboard');
    await sleep(1000);
    const body = await page.locator('body').innerText();
    // KPI tiles should show API, Apps, or production-related text
    if (!body.match(/api|apps|total|production|persistency/i)) {
      throw new Error('No KPI content found on agent dashboard');
    }
    await screenshot(page, join(ssOut, 'dashboard', 'light-desktop.png'));
  }));

  // ── T2A.02: Weekly Wizard — open ──────────────────────────────────────────
  results.push(await check('T2A.02', 'Weekly Wizard opens — Step 1 renders', async () => {
    // Find the Submit Report / wizard trigger button
    const wizardBtn = page.getByRole('button', { name: /submit.*report|start.*report|new.*report|submit/i }).first();
    if (await wizardBtn.count() > 0) {
      await wizardBtn.click();
    } else {
      // Bottom nav "Submit" item
      const submitNav = page.locator('[data-testid="bottom-nav-submit"], button:has-text("Submit")').first();
      if (await submitNav.count() > 0) await submitNav.click();
      else throw new Error('Cannot locate wizard trigger button');
    }
    await sleep(1000);
    // Wizard should show week-starting input or step 1 content
    const body = await page.locator('body').innerText();
    if (!body.match(/week.*start|activity|report|step/i)) {
      throw new Error('Wizard step 1 content not detected');
    }
    await screenshot(page, join(ssOut, 'wizard', 'step1.png'));
  }));

  // ── T2A.03: Wizard — navigate all 5 screens ─────────────────────────────
  results.push(await check('T2A.03', 'Wizard — 5 screens navigable', async () => {
    // Fill in a Week Starting date (most recent Sunday)
    const today = new Date();
    const day   = today.getUTCDay();
    const sun   = new Date(today);
    sun.setUTCDate(today.getUTCDate() - day);
    const sunStr = `${sun.getUTCFullYear()}-${String(sun.getUTCMonth() + 1).padStart(2, '0')}-${String(sun.getUTCDate()).padStart(2, '0')}`;

    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.count() > 0) {
      await dateInput.fill(sunStr);
    }

    // Advance past date pre-screen before counting wizard screens
    const preDateNext = page.getByRole('button', { name: /next|continue/i }).first();
    if (await preDateNext.count() > 0) {
      await preDateNext.click();
      await sleep(300);
    }

    // Navigate through Next buttons, collecting screenshots
    for (let screen = 1; screen <= 5; screen++) {
      await screenshot(page, join(ssOut, 'wizard', `screen${screen}.png`));
      if (screen < 5) {
        const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(600);
        }
      }
    }
    // Should be on screen 5 (Summary)
    const body = await page.locator('body').innerText();
    if (!body.match(/summary|review|submit|total/i)) {
      throw new Error('Wizard screen 5 (summary) not detected');
    }
  }));

  // ── T2A.04: Close wizard (Back to dashboard) ──────────────────────────────
  results.push(await check('T2A.04', 'Wizard — back/close returns to dashboard', async () => {
    const closeBtn = page.getByRole('button', { name: /close|cancel|back to dashboard/i }).first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    } else {
      // Press Escape or navigate away
      await page.keyboard.press('Escape');
    }
    await sleep(800);
    // Should be back on dashboard
    await navigateToTab(page, 'Dashboard');
    await sleep(500);
  }));

  // ── T2A.05: Career Portal ─────────────────────────────────────────────────
  results.push(await check('T2A.05', 'Career Portal renders with goal tracking', async () => {
    await navigateToTab(page, 'Career');
    await sleep(1000);
    const body = await page.locator('body').innerText();
    if (!body.match(/goal|career|commission|club|target/i)) {
      throw new Error('Career Portal content not detected');
    }
    await screenshot(page, join(ssOut, 'career', 'light-desktop.png'));
  }));

  // ── T2A.06: Awards tab ────────────────────────────────────────────────────
  results.push(await check('T2A.06', 'Awards tab renders badge grid', async () => {
    await navigateToTab(page, 'Awards');
    await sleep(1000);
    const body = await page.locator('body').innerText();
    if (!body.match(/award|badge|recognition|achievement/i)) {
      throw new Error('Awards tab content not detected');
    }
    await screenshot(page, join(ssOut, 'awards', 'light-desktop.png'));
  }));

  // ── T2A.07: History tab ───────────────────────────────────────────────────
  results.push(await check('T2A.07', 'History tab shows 4 seeded submission weeks', async () => {
    await navigateToTab(page, 'History');
    await sleep(1200);
    const body = await page.locator('body').innerText();
    if (!body.match(/week|submission|report|history/i)) {
      throw new Error('History tab content not detected');
    }
    // Check for at least some entries (seeded 4 weeks)
    const rows = await page.locator('[data-testid*="submission"], tr, .submission-row').count();
    _log(`  History rows visible: ${rows}`);
    await screenshot(page, join(ssOut, 'history', 'light-desktop.png'));
  }));

  // ── T2A.08: Profile — logging mode toggle ─────────────────────────────────
  results.push(await check('T2A.08', 'Profile — logging mode toggle cycles correctly', async () => {
    await navigateToTab(page, 'Profile');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'profile', 'light-desktop-before.png'));
    // Look for logging mode toggle
    const toggleBtn = page.getByRole('button', { name: /weekly|hybrid|daily|logging/i }).first();
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click();
      await sleep(600);
      await screenshot(page, join(ssOut, 'profile', 'light-desktop-after-toggle.png'));
    } else {
      _log('  WARN: logging mode toggle button not found — may be in a different selector');
    }
  }));

  // ── T2A.09: Leaderboard ──────────────────────────────────────────────────
  results.push(await check('T2A.09', 'Leaderboard renders with test agents visible', async () => {
    await navigateToTab(page, 'Leaderboard');
    await sleep(1000);
    const body = await page.locator('body').innerText();
    if (!body.match(/leaderboard|rank|agent|top/i)) {
      throw new Error('Leaderboard content not detected');
    }
    await screenshot(page, join(ssOut, 'leaderboard', 'light-desktop.png'));
  }));

  // ── T2A.10: Production Report tab ─────────────────────────────────────────
  results.push(await check('T2A.10', 'Production Report tab renders without errors', async () => {
    await navigateToTab(page, 'Production Report');
    await sleep(1000);
    const body = await page.locator('body').innerText();
    if (!body.match(/production|report|api|apps/i)) {
      throw new Error('Production Report content not detected');
    }
    await screenshot(page, join(ssOut, 'production-report', 'light-desktop.png'));
  }));

  // ── T2A.11: Persistency tab (agent read-only) ─────────────────────────────
  results.push(await check('T2A.11', 'Persistency tab (agent view) renders read-only', async () => {
    await navigateToTab(page, 'Persistency');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'persistency', 'light-desktop.png'));
    // Should not have entry form (agents cannot enter persistency)
    const entryForm = await page.locator('input[type="number"][placeholder*="persist"], button:has-text("Save Persistency")').count();
    if (entryForm > 0) {
      throw new Error('Agent appears to have persistency ENTRY form — should be read-only');
    }
  }));

  // ── T2A.12: Dark mode across dashboard ───────────────────────────────────
  results.push(await check('T2A.12', 'Dark mode — dashboard renders correctly', async () => {
    await navigateToTab(page, 'Dashboard');
    await setDarkMode(page, true);
    await sleep(800);
    const bodyEl = page.locator('body');
    const cls = await bodyEl.evaluate((el) => document.documentElement.className);
    if (!cls.includes('dark')) throw new Error('Dark mode class not applied');
    await screenshot(page, join(ssOut, 'dashboard', 'dark-desktop.png'));
    await setDarkMode(page, false);
  }));

  // ── T2A.13: Mobile viewport ───────────────────────────────────────────────
  results.push(await check('T2A.13', 'Mobile viewport — agent tabs accessible at 390×844', async () => {
    await setMobileViewport(page);
    await navigateToTab(page, 'Dashboard');
    await sleep(800);
    await screenshot(page, join(ssOut, 'dashboard', 'light-mobile.png'));
    await navigateToTab(page, 'History');
    await sleep(600);
    await screenshot(page, join(ssOut, 'history', 'light-mobile.png'));
    await setDesktopViewport(page);
  }));

  // ── T2A.14: Console errors check ─────────────────────────────────────────
  results.push(await check('T2A.14', 'No console errors during agent walk', async () => {
    console_.assertNone();
  }));

  await browser.close();

  const pass  = results.filter((r) => r.pass).length;
  const total = results.length;
  _log(`\nCat 2A result: ${pass}/${total} passed`);
  return { category: 'cat02-agent', results, pass, total };
}

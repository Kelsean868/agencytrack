/**
 * cat08-screenshot-dossier.mjs — Category 8: Structured visual dossier.
 *
 * Captures every primary surface in light+dark × desktop+mobile.
 * Target: ≥80 screenshots organized by role/surface/theme/viewport.
 *
 * This category produces screenshots only — no assertions.
 * All captures are for Kyron's visual review.
 */

import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import {
  ROOT, TEST_USERS, loadEnv,
  setupBrowser, loginAsViaUI, navigateToTab,
  screenshot, sleep,
  setDesktopViewport, setMobileViewport,
} from './auth-helpers.mjs';
import { waitForTheme } from '../lib/walk-helpers.mjs';

const DESKTOP = { width: 1280, height: 800 };
const MOBILE  = { width: 390,  height: 844 };

export async function runCat08ScreenshotDossier({ log, ssDir } = {}) {
  const _log   = log ?? console.log;
  const outDir = ssDir ? join(ssDir, 'cat08-dossier') : join(ROOT, 'verification', 'shakedown-screenshots', 'cat08-dossier');
  mkdirSync(outDir, { recursive: true });

  _log('\n── Category 8: Screenshot dossier ──');

  let shotCount = 0;

  async function ss(page, ...parts) {
    const filePath = join(outDir, ...parts);
    mkdirSync(join(filePath, '..'), { recursive: true });
    await screenshot(page, filePath);
    shotCount++;
  }

  // setTheme — local to this dossier (does NOT go through walk-helpers.mjs's
  // context-level setTheme(); this file shares one browser context across both
  // light and dark captures per role via UI login, so a fresh-context-per-theme
  // shape à la runBothThemes is not structurally available here). Full #771
  // conformance is still applied: string theme arg (never boolean), and
  // waitForTheme asserts the DOM actually landed on the target theme (via the
  // shared walk-helpers guard) before returning control to any caller — no
  // capture can run against a not-yet-applied theme.
  async function setTheme(page, theme) {
    if (theme !== 'light' && theme !== 'dark') {
      throw new TypeError(
        `setTheme: theme must be the string 'light' or 'dark', got ${JSON.stringify(theme)} `
        + `(${typeof theme}). A boolean silently boots/keeps the app in the wrong theme.`,
      );
    }
    await page.evaluate((t) => {
      if (t === 'dark') { localStorage.setItem('agencytrack-dark', '1'); }
      else               { localStorage.removeItem('agencytrack-dark'); }
    }, theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForTheme(page, theme);
  }

  // ── Agent surfaces ────────────────────────────────────────────────────────
  {
    _log('  [1/5] Agent surfaces…');
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, TEST_USERS.agent1.email, TEST_USERS.agent1.password);

    const agentTabs = [
      { tab: 'Dashboard', dir: 'dashboard' },
      { tab: 'Career',    dir: 'career' },
      { tab: 'Awards',    dir: 'awards' },
      { tab: 'History',   dir: 'history' },
      { tab: 'Leaderboard', dir: 'leaderboard' },
      { tab: 'Profile',   dir: 'profile' },
    ];

    for (const { tab, dir } of agentTabs) {
      await navigateToTab(page, tab);
      await sleep(800);
      // Light desktop
      await setDesktopViewport(page);
      await ss(page, 'agent', dir, 'light-desktop.png');
      // Light mobile
      await setMobileViewport(page);
      await sleep(400);
      await ss(page, 'agent', dir, 'light-mobile.png');
      await setDesktopViewport(page);
    }

    // Dark mode pass (desktop only)
    await setTheme(page, 'dark');
    for (const { tab, dir } of agentTabs) {
      await navigateToTab(page, tab);
      await sleep(600);
      await ss(page, 'agent', dir, 'dark-desktop.png');
    }
    await setTheme(page, 'light');

    // Wizard screens
    await navigateToTab(page, 'Dashboard');
    const submitBtn = page.getByRole('button', { name: /submit.*report|submit/i }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await sleep(600);
      // Advance past date pre-screen before counting wizard screens
      const preDateNext = page.getByRole('button', { name: /next|continue/i }).first();
      if (await preDateNext.count() > 0) {
        await preDateNext.click();
        await sleep(300);
      }
      for (let i = 1; i <= 5; i++) {
        await ss(page, 'agent', 'wizard', `screen-${i}-light-desktop.png`);
        const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
        if (i < 5 && await nextBtn.count() > 0) { await nextBtn.click(); await sleep(500); }
      }
      const closeBtn = page.getByRole('button', { name: /close|cancel|back/i }).first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      else await page.keyboard.press('Escape');
    }

    await browser.close();
    _log(`  Agent: ${shotCount} shots so far`);
  }

  // ── Unit Manager surfaces ─────────────────────────────────────────────────
  {
    _log('  [2/5] Unit Manager surfaces…');
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, TEST_USERS.unitManager1.email, TEST_USERS.unitManager1.password);

    const umTabs = [
      { tab: 'Overview',    dir: 'overview' },
      { tab: 'Team',        dir: 'team' },
      { tab: 'Master Sheet', dir: 'mastersheet' },
      { tab: 'Campaigns',   dir: 'campaigns' },
      { tab: 'Goals',       dir: 'goals' },
      { tab: 'Persistency', dir: 'persistency' },
      { tab: 'Settlements', dir: 'settlements' },
      { tab: 'Awards',      dir: 'awards' },
    ];

    for (const { tab, dir } of umTabs) {
      await navigateToTab(page, tab);
      await sleep(800);
      await setDesktopViewport(page);
      await ss(page, 'unit-manager', dir, 'light-desktop.png');
      await setMobileViewport(page);
      await sleep(400);
      await ss(page, 'unit-manager', dir, 'light-mobile.png');
      await setDesktopViewport(page);
    }

    // Dark desktop
    await setTheme(page, 'dark');
    for (const { tab, dir } of umTabs.slice(0, 3)) {
      await navigateToTab(page, tab);
      await sleep(600);
      await ss(page, 'unit-manager', dir, 'dark-desktop.png');
    }
    await setTheme(page, 'light');

    await browser.close();
    _log(`  Unit Manager: ${shotCount} shots so far`);
  }

  // ── Branch Manager surfaces ───────────────────────────────────────────────
  {
    _log('  [3/5] Branch Manager surfaces…');
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, TEST_USERS.branchManager.email, TEST_USERS.branchManager.password);

    const bmTabs = [
      { tab: 'Overview',    dir: 'overview' },
      { tab: 'Team',        dir: 'team' },
      { tab: 'Master Sheet', dir: 'mastersheet' },
      { tab: 'Campaigns',   dir: 'campaigns' },
      { tab: 'Goals',       dir: 'goals' },
      { tab: 'Persistency', dir: 'persistency' },
      { tab: 'Settlements', dir: 'settlements' },
      { tab: 'Awards',      dir: 'awards' },
      { tab: 'Kiosk',       dir: 'kiosk' },
      { tab: 'Agent of Month', dir: 'agent-of-month' },
      { tab: 'Production Report', dir: 'production-report' },
    ];

    for (const { tab, dir } of bmTabs) {
      await navigateToTab(page, tab);
      await sleep(800);
      await setDesktopViewport(page);
      await ss(page, 'branch-manager', dir, 'light-desktop.png');
      await setMobileViewport(page);
      await sleep(400);
      await ss(page, 'branch-manager', dir, 'light-mobile.png');
      await setDesktopViewport(page);
    }

    // Dark desktop pass
    await setTheme(page, 'dark');
    for (const { tab, dir } of bmTabs.slice(0, 4)) {
      await navigateToTab(page, tab);
      await sleep(600);
      await ss(page, 'branch-manager', dir, 'dark-desktop.png');
    }
    await setTheme(page, 'light');

    await browser.close();
    _log(`  Branch Manager: ${shotCount} shots so far`);
  }

  // ── Tenant Admin surfaces ─────────────────────────────────────────────────
  const env      = loadEnv();
  const TA_EMAIL = env.A11Y_TENANT_ADMIN_EMAIL;
  const TA_PASS  = env.A11Y_TENANT_ADMIN_PASSWORD;

  if (!TA_EMAIL || !TA_PASS) {
    _log('  [4/5] Tenant Admin: SKIPPED (no TA creds)');
  } else {
    _log('  [4/5] Tenant Admin surfaces…');
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, TA_EMAIL, TA_PASS);

    const taTabs = [
      { tab: 'Dashboard',    dir: 'dashboard' },
      { tab: 'All Users',    dir: 'users' },
      { tab: 'Branches',     dir: 'branches' },
      { tab: 'Company Config', dir: 'config' },
      { tab: 'Campaigns',    dir: 'campaigns' },
    ];

    for (const { tab, dir } of taTabs) {
      await navigateToTab(page, tab);
      await sleep(800);
      await setDesktopViewport(page);
      await ss(page, 'tenant-admin', dir, 'light-desktop.png');
      await setMobileViewport(page);
      await sleep(400);
      await ss(page, 'tenant-admin', dir, 'light-mobile.png');
      await setDesktopViewport(page);
    }

    await setTheme(page, 'dark');
    await navigateToTab(page, 'Dashboard');
    await sleep(600);
    await ss(page, 'tenant-admin', 'dashboard', 'dark-desktop.png');
    await setTheme(page, 'light');

    await browser.close();
    _log(`  Tenant Admin: ${shotCount} shots so far`);
  }

  // ── Platform Admin stub ───────────────────────────────────────────────────
  const PA_EMAIL = env.A11Y_PLATFORM_ADMIN_EMAIL;
  const PA_PASS  = env.A11Y_PLATFORM_ADMIN_PASSWORD;

  if (!PA_EMAIL || !PA_PASS) {
    _log('  [5/5] Platform Admin stub: SKIPPED (no PA creds)');
  } else {
    _log('  [5/5] Platform Admin stub…');
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, PA_EMAIL, PA_PASS);
    await sleep(1000);
    await ss(page, 'platform-admin', 'stub-screen', 'light-desktop.png');
    await setMobileViewport(page);
    await ss(page, 'platform-admin', 'stub-screen', 'light-mobile.png');
    await browser.close();
  }

  _log(`\n  Total screenshots captured: ${shotCount}`);
  const pass = shotCount >= 80 ? 1 : 0;
  const result = {
    id: 'T8.ALL',
    label: `Screenshot dossier — ${shotCount} captures`,
    pass: shotCount >= 80,
    shotCount,
  };
  if (!result.pass) {
    _log(`  WARN: Only ${shotCount} screenshots captured — target is ≥80`);
  }

  return {
    category: 'cat08-screenshot-dossier',
    results:  [result],
    pass,
    total: 1,
    shotCount,
  };
}

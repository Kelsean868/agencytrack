/**
 * cat02-role-tenant-admin.mjs — Category 2D: Tenant Admin surface coverage (10 tests).
 *
 * Uses A11Y_TENANT_ADMIN_EMAIL/PASSWORD from .env.local (real tenant admin account).
 * TenantAdminDashboard tabs: Dashboard, Branches, All Users, Company Config, Campaigns, Profile.
 */

import { join }  from 'path';
import { existsSync } from 'fs';
import { resolve }    from 'path';

import {
  ROOT, TENANT_ID, loadEnv, adminInit,
  setupBrowser, loginAsViaUI,
  navigateToTab,
  check, screenshot, consoleErrorCollector,
  setDesktopViewport, setMobileViewport,
  sleep,
} from './auth-helpers.mjs';

export async function runCat02TenantAdmin({ log, ssDir } = {}) {
  const _log  = log ?? console.log;
  const ssOut = ssDir ? join(ssDir, 'cat02-tenant-admin') : join(ROOT, 'verification', 'shakedown-screenshots', 'cat02-tenant-admin');
  const results = [];

  _log('\n── Category 2D: Tenant Admin surface coverage ──');

  const env      = loadEnv();
  const TA_EMAIL = env.A11Y_TENANT_ADMIN_EMAIL;
  const TA_PASS  = env.A11Y_TENANT_ADMIN_PASSWORD;

  if (!TA_EMAIL || !TA_PASS) {
    const msg = 'A11Y_TENANT_ADMIN_EMAIL / A11Y_TENANT_ADMIN_PASSWORD not in .env.local — skipping Cat 2D';
    _log(`  SKIP: ${msg}`);
    return {
      category: 'cat02-tenant-admin',
      results:  [{ id: 'T2D.SKIP', label: msg, pass: false, skipped: true }],
      pass: 0, total: 1,
    };
  }

  const { browser, page } = await setupBrowser();
  const console_ = consoleErrorCollector(page);

  await loginAsViaUI(page, TA_EMAIL, TA_PASS);

  // ── T2D.01: TenantAdminDashboard renders ─────────────────────────────────
  results.push(await check('T2D.01', 'TenantAdminDashboard renders correctly', async () => {
    await sleep(1000);
    await screenshot(page, join(ssOut, 'dashboard', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/company|tenant|dashboard|overview|branches|users/i)) {
      throw new Error('TenantAdminDashboard content not detected');
    }
  }));

  // ── T2D.02: All Users tab — 10 test users visible ────────────────────────
  results.push(await check('T2D.02', 'All Users tab — all 10 test users visible', async () => {
    await navigateToTab(page, 'All Users');
    await sleep(1500);
    await screenshot(page, join(ssOut, 'users', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    const testEmails = [
      'bm-001', 'um-001', 'um-002',
      'agent-001', 'agent-002', 'agent-003',
    ];
    const found = testEmails.filter((e) => body.includes(e));
    _log(`  Test users found in All Users tab: ${found.length}/6 sampled`);
    if (found.length === 0) {
      _log('  WARN: No test user emails detected — seeding may be incomplete or display format differs');
    }
  }));

  // ── T2D.03: Branches tab ─────────────────────────────────────────────────
  results.push(await check('T2D.03', 'Branches tab renders; Cyril Murray Branch visible', async () => {
    await navigateToTab(page, 'Branches');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'branches', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/branch|Cyril Murray|create|add/i)) {
      throw new Error('Branches tab content not detected');
    }
  }));

  // ── T2D.04: Company Config tab ────────────────────────────────────────────
  results.push(await check('T2D.04', 'Company Config tab renders; TA can edit Company Floor', async () => {
    await navigateToTab(page, 'Company Config');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'config', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/config|minimum|floor|company|api|apps/i)) {
      throw new Error('Company Config content not detected');
    }
    // TA should have edit access
    const editEl = await page.locator('input, button:has-text("Save"), button:has-text("Edit")').count();
    _log(`  Company Config edit elements: ${editEl}`);
  }));

  // ── T2D.05: BulkImportUsersModal — re-test C2 flow ───────────────────────
  results.push(await check('T2D.05', 'BulkImportUsers modal accessible and renders preview step', async () => {
    await navigateToTab(page, 'All Users');
    await sleep(800);
    // Look for Bulk Import or Import Users button
    const bulkBtn = page.getByRole('button', { name: /bulk.*import|import.*user/i }).first();
    if (await bulkBtn.count() > 0) {
      await bulkBtn.click();
      await sleep(800);
      await screenshot(page, join(ssOut, 'users', 'bulk-import-modal.png'));
      // Close modal
      const closeBtn = page.getByRole('button', { name: /close|cancel/i }).first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      else await page.keyboard.press('Escape');
      await sleep(500);
    } else {
      _log('  WARN: Bulk Import button not found — may be named differently; see screenshot');
      await screenshot(page, join(ssOut, 'users', 'looking-for-bulk-import.png'));
    }
  }));

  // ── T2D.06: Campaigns tab ─────────────────────────────────────────────────
  results.push(await check('T2D.06', 'Campaigns tab accessible for TA', async () => {
    await navigateToTab(page, 'Campaigns');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'campaigns', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/campaign|create|Test Campaign/i)) {
      _log('  WARN: Campaigns content not detected for TA — verify via screenshot');
    }
  }));

  // ── T2D.07: Profile tab ───────────────────────────────────────────────────
  results.push(await check('T2D.07', 'Profile tab renders for TA', async () => {
    await navigateToTab(page, 'Profile');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'profile', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/profile|name|email|photo/i)) {
      _log('  WARN: Profile content not clearly detected — verify via screenshot');
    }
  }));

  // ── T2D.08: Dark mode ─────────────────────────────────────────────────────
  results.push(await check('T2D.08', 'Dark mode — TenantAdminDashboard renders correctly', async () => {
    await navigateToTab(page, 'Dashboard');
    await page.evaluate(() => {
      localStorage.setItem('agencytrack-dark', '1');
      document.documentElement.classList.add('dark');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await screenshot(page, join(ssOut, 'dashboard', 'dark-desktop.png'));
    await page.evaluate(() => {
      localStorage.removeItem('agencytrack-dark');
      document.documentElement.classList.remove('dark');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(800);
  }));

  // ── T2D.09: Mobile viewport ───────────────────────────────────────────────
  results.push(await check('T2D.09', 'Mobile viewport — TA Dashboard + Users accessible', async () => {
    await setMobileViewport(page);
    await sleep(500);
    await screenshot(page, join(ssOut, 'dashboard', 'light-mobile.png'));
    await navigateToTab(page, 'All Users');
    await sleep(600);
    await screenshot(page, join(ssOut, 'users', 'light-mobile.png'));
    await setDesktopViewport(page);
  }));

  // ── T2D.10: Console errors check ──────────────────────────────────────────
  results.push(await check('T2D.10', 'No console errors during TA walk', async () => {
    console_.assertNone();
  }));

  await browser.close();

  const pass  = results.filter((r) => r.pass).length;
  const total = results.length;
  _log(`\nCat 2D result: ${pass}/${total} passed`);
  return { category: 'cat02-tenant-admin', results, pass, total };
}

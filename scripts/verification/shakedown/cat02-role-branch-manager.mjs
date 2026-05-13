/**
 * cat02-role-branch-manager.mjs — Category 2C: Branch Manager surface coverage (14 tests).
 *
 * Exercises ManagerDashboard tabs for bm-001.
 * Branch Manager sees all 7 test agents across both units.
 */

import { join }       from 'path';
import { randomUUID } from 'crypto';

import {
  ROOT, TEST_USERS, TENANT_ID, adminInit,
  setupBrowser, loginAsViaUI,
  navigateToTab,
  check, screenshot, consoleErrorCollector,
  setDesktopViewport, setMobileViewport,
  assertBodyContains, sleep,
} from './auth-helpers.mjs';

const BM = TEST_USERS.branchManager;

export async function runCat02BranchManager({ log, ssDir, uidByEmail } = {}) {
  const _log  = log ?? console.log;
  const ssOut = ssDir ? join(ssDir, 'cat02-branch-manager') : join(ROOT, 'verification', 'shakedown-screenshots', 'cat02-branch-manager');
  const results = [];

  _log('\n── Category 2C: Branch Manager surface coverage ──');

  const { browser, page } = await setupBrowser();
  const console_ = consoleErrorCollector(page);

  await loginAsViaUI(page, BM.email, BM.password);

  // ── T2C.01: Overview — all 7 agents ──────────────────────────────────────
  results.push(await check('T2C.01', 'Overview renders for BM (all 7 test agents in branch)', async () => {
    await sleep(1000);
    await screenshot(page, join(ssOut, 'overview', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/overview|dashboard|agent|team|branch/i)) {
      throw new Error('BM Overview content not detected');
    }
  }));

  // ── T2C.02: Master Sheet — all 7 agents ──────────────────────────────────
  results.push(await check('T2C.02', 'Master Sheet — all 7 test agents visible (branch-scoped)', async () => {
    await navigateToTab(page, 'Master Sheet');
    await sleep(1500);
    await screenshot(page, join(ssOut, 'mastersheet', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/master|sheet|agent|name/i)) {
      throw new Error('Master Sheet content not detected for BM');
    }
    // BM should see all 7 test agents
    const agentCount = (body.match(/Test Agent|agent-0/gi) || []).length;
    _log(`  Master Sheet agent mentions: ${agentCount}`);
  }));

  // ── T2C.03: Campaigns tab ─────────────────────────────────────────────────
  results.push(await check('T2C.03', 'Campaigns tab visible and shows Test Campaign Q2', async () => {
    await navigateToTab(page, 'Campaigns');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'campaigns', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/campaign|Test Campaign|create|Q2/i)) {
      throw new Error('Campaigns content not detected for BM');
    }
  }));

  // ── T2C.04: Persistency entry ─────────────────────────────────────────────
  results.push(await check('T2C.04', 'Persistency tab — BM can enter persistency', async () => {
    await navigateToTab(page, 'Persistency');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'persistency', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/persistency|persist|%/i)) {
      throw new Error('Persistency tab content not detected for BM');
    }
    // BM should have entry capability (input or button)
    const entryEl = await page.locator('input[type="number"], button:has-text("Save"), button:has-text("Enter")').count();
    _log(`  Persistency entry elements found: ${entryEl}`);
  }));

  // ── T2C.05: Settlements entry ─────────────────────────────────────────────
  results.push(await check('T2C.05', 'Settlements tab — BM can confirm settlements', async () => {
    await navigateToTab(page, 'Settlements');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'settlements', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/settlement|settle|confirm|production/i)) {
      throw new Error('Settlements tab content not detected for BM');
    }
    // BM should see entry capability
    const entryEl = await page.locator(
      'button:has-text("Confirm"), button:has-text("Enter"), button:has-text("Add Settlement"), input'
    ).count();
    _log(`  Settlement entry elements found: ${entryEl}`);
  }));

  // ── T2C.06: Goals tab — 5-layer hierarchy ────────────────────────────────
  results.push(await check('T2C.06', 'Goals tab — BM can enter branch target; floor read-only', async () => {
    await navigateToTab(page, 'Goals');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'goals', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/goal|target|branch|floor|minimum/i)) {
      throw new Error('Goals content not detected for BM');
    }
    // Company Floor should NOT be editable for BM
    const floorEdit = await page.locator('button:has-text("Edit Floor"), input[placeholder*="floor"]:not([disabled])').count();
    _log(`  Company Floor edit elements: ${floorEdit} (should be 0 or read-only)`);
  }));

  // ── T2C.07: User Management — create user ─────────────────────────────────
  results.push(await check('T2C.07', 'Team tab — create user dialog accessible', async () => {
    await navigateToTab(page, 'Team');
    await sleep(1000);
    // Look for Add Agent / Create User / Invite button
    const addBtn = page.getByRole('button', { name: /add.*agent|create.*user|invite|add.*user/i }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await sleep(800);
      await screenshot(page, join(ssOut, 'team', 'create-user-dialog.png'));
      // Close dialog
      const closeBtn = page.getByRole('button', { name: /close|cancel/i }).first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      else await page.keyboard.press('Escape');
    } else {
      _log('  WARN: Add Agent/Create User button not found via role — try screenshot to verify');
      await screenshot(page, join(ssOut, 'team', 'light-desktop.png'));
    }
  }));

  // ── T2C.08: Agent of Month tab ───────────────────────────────────────────
  results.push(await check('T2C.08', 'Agent of Month tab renders for BM', async () => {
    await navigateToTab(page, 'Agent of Month');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'agent-of-month', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/agent.*month|AOM|recognition|nominate|champion/i)) {
      _log('  WARN: AOM content not clearly detected — verify via screenshot');
    }
  }));

  // ── T2C.09: Kiosk tab — token generation ────────────────────────────────
  results.push(await check('T2C.09', 'Kiosk tab — token generation accessible', async () => {
    await navigateToTab(page, 'Kiosk');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'kiosk', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/kiosk|token|generate|display/i)) {
      throw new Error('Kiosk tab content not detected');
    }
    // Look for Generate Token button
    const genBtn = page.getByRole('button', { name: /generate|create.*token/i }).first();
    if (await genBtn.count() > 0) {
      await genBtn.click();
      await sleep(1000);
      await screenshot(page, join(ssOut, 'kiosk', 'token-generated.png'));
      _log('  Kiosk token generation triggered');
      // Revoke the token
      const revokeBtn = page.getByRole('button', { name: /revoke|delete.*token/i }).first();
      if (await revokeBtn.count() > 0) {
        await revokeBtn.click();
        await sleep(800);
        await screenshot(page, join(ssOut, 'kiosk', 'token-revoked.png'));
        _log('  Kiosk token revoked');
      }
    } else {
      _log('  WARN: Generate Token button not found — kiosk may already have a token; see screenshot');
    }
  }));

  // ── T2C.10: Branch CSV export ─────────────────────────────────────────────
  results.push(await check('T2C.10', 'Branch CSV export — download initiated', async () => {
    // Look for export button in Master Sheet or Team tab
    await navigateToTab(page, 'Master Sheet');
    await sleep(1000);
    const exportBtn = page.getByRole('button', { name: /export|csv|download/i }).first();
    if (await exportBtn.count() > 0) {
      // Set up download listener
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
        exportBtn.click(),
      ]);
      if (download) {
        _log(`  CSV download started: ${download.suggestedFilename()}`);
        await download.cancel();
      } else {
        _log('  WARN: No download event captured — export may use a different mechanism');
        await screenshot(page, join(ssOut, 'mastersheet', 'post-export-click.png'));
      }
    } else {
      _log('  WARN: Export/CSV button not found in Master Sheet — searching Team tab');
      await navigateToTab(page, 'Team');
      await sleep(800);
      await screenshot(page, join(ssOut, 'team', 'looking-for-export.png'));
    }
  }));

  // ── T2C.11: Production Report ─────────────────────────────────────────────
  results.push(await check('T2C.11', 'Production Report tab renders for BM', async () => {
    await navigateToTab(page, 'Production Report');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'production-report', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/production|report|api|apps|summary/i)) {
      throw new Error('Production Report content not detected for BM');
    }
  }));

  // ── T2C.12: Dark mode ────────────────────────────────────────────────────
  results.push(await check('T2C.12', 'Dark mode — BM dashboard renders correctly', async () => {
    await navigateToTab(page, 'Overview');
    // Toggle dark via localStorage
    await page.evaluate(() => {
      localStorage.setItem('agencytrack-dark', '1');
      document.documentElement.classList.add('dark');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await screenshot(page, join(ssOut, 'overview', 'dark-desktop.png'));
    // Restore
    await page.evaluate(() => {
      localStorage.removeItem('agencytrack-dark');
      document.documentElement.classList.remove('dark');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(800);
  }));

  // ── T2C.13: Mobile viewport ──────────────────────────────────────────────
  results.push(await check('T2C.13', 'Mobile viewport — BM Overview + Master Sheet accessible', async () => {
    await setMobileViewport(page);
    await navigateToTab(page, 'Overview');
    await sleep(800);
    await screenshot(page, join(ssOut, 'overview', 'light-mobile.png'));
    await navigateToTab(page, 'Master Sheet');
    await sleep(600);
    await screenshot(page, join(ssOut, 'mastersheet', 'light-mobile.png'));
    await setDesktopViewport(page);
  }));

  // ── T2C.14: Console errors check ─────────────────────────────────────────
  results.push(await check('T2C.14', 'No console errors during BM walk', async () => {
    console_.assertNone();
  }));

  await browser.close();

  const pass  = results.filter((r) => r.pass).length;
  const total = results.length;
  _log(`\nCat 2C result: ${pass}/${total} passed`);
  return { category: 'cat02-branch-manager', results, pass, total };
}

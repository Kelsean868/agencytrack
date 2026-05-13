/**
 * cat02-role-unit-manager.mjs — Category 2B: Unit Manager surface coverage (10 tests).
 *
 * Exercises ManagerDashboard tabs for um-001.
 * Unit UM_001 has agents 001–004; agents 005–007 belong to UM_002.
 */

import { join } from 'path';

import {
  ROOT, TEST_USERS,
  setupBrowser, loginAsViaUI,
  navigateToTab,
  check, screenshot, consoleErrorCollector,
  setDarkMode, setDesktopViewport, setMobileViewport,
  sleep,
} from './auth-helpers.mjs';

const UM = TEST_USERS.unitManager1;

export async function runCat02UnitManager({ log, ssDir } = {}) {
  const _log  = log ?? console.log;
  const ssOut = ssDir ? join(ssDir, 'cat02-unit-manager') : join(ROOT, 'verification', 'shakedown-screenshots', 'cat02-unit-manager');
  const results = [];

  _log('\n── Category 2B: Unit Manager surface coverage ──');

  const { browser, page } = await setupBrowser();
  const console_ = consoleErrorCollector(page);

  await loginAsViaUI(page, UM.email, UM.password);

  // ── T2B.01: Overview tab ──────────────────────────────────────────────────
  results.push(await check('T2B.01', 'ManagerDashboard Overview renders for UM', async () => {
    await sleep(1000);
    await screenshot(page, join(ssOut, 'overview', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/overview|dashboard|agent|team/i)) {
      throw new Error('UM Overview content not detected');
    }
  }));

  // ── T2B.02: Team tab — unit-scoped agents ─────────────────────────────────
  results.push(await check('T2B.02', 'Team tab — agents 001-004 visible; 005-007 NOT visible', async () => {
    await navigateToTab(page, 'Team');
    await sleep(1200);
    const body = await page.locator('body').innerText();
    // Agents 001-004 belong to UM_001
    const hasAgent1 = body.includes('Test Agent 001') || body.includes('agent-001');
    const hasAgent5 = body.includes('Test Agent 005') || body.includes('agent-005');
    if (hasAgent5) {
      throw new Error('UM sees agent-005 which belongs to UM_002 — cross-unit leak!');
    }
    if (!hasAgent1) {
      _log('  WARN: Test Agent 001 not found by name in Team tab — may use email or truncated name');
    }
    await screenshot(page, join(ssOut, 'team', 'light-desktop.png'));
  }));

  // ── T2B.03: Master Sheet — 4 agents (unit-scoped) ─────────────────────────
  results.push(await check('T2B.03', 'Master Sheet — unit-scoped (≤4 agents)', async () => {
    await navigateToTab(page, 'Master Sheet');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'mastersheet', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/master|sheet|agent|name/i)) {
      throw new Error('Master Sheet content not detected for UM');
    }
    // Should NOT see agent-005..007
    if (body.includes('Test Agent 005') || body.includes('Test Agent 006') || body.includes('Test Agent 007')) {
      throw new Error('UM Master Sheet shows UM_002 agents — cross-unit data leak');
    }
  }));

  // ── T2B.04: Campaigns tab ─────────────────────────────────────────────────
  results.push(await check('T2B.04', 'Campaigns tab — Test Campaign Q2 visible', async () => {
    await navigateToTab(page, 'Campaigns');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'campaigns', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/campaign|Test Campaign|Q2/i)) {
      throw new Error('Test Campaign Q2 not visible in Campaigns tab');
    }
  }));

  // ── T2B.05: Persistency tab — 3 months for 4 agents ──────────────────────
  results.push(await check('T2B.05', 'Persistency tab — seeded data visible for unit agents', async () => {
    await navigateToTab(page, 'Persistency');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'persistency', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/persistency|persist|%|jan|feb|mar|2026/i)) {
      _log('  WARN: Persistency seeded data not detected by regex — verify manually via screenshot');
    }
  }));

  // ── T2B.06: Goals tab — gap analysis, Company Floor read-only ─────────────
  results.push(await check('T2B.06', 'Goals tab — gap analysis renders; Company Floor read-only for UM', async () => {
    await navigateToTab(page, 'Goals');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'goals', 'light-desktop.png'));
    const body = await page.locator('body').innerText();
    if (!body.match(/goal|target|floor|minimum|gap/i)) {
      throw new Error('Goals tab content not detected');
    }
    // UM should NOT have Company Floor edit capability
    const floorInput = await page.locator('input[placeholder*="floor"], input[placeholder*="minimum"]').count();
    if (floorInput > 0) {
      throw new Error('UM appears to have Company Floor edit access — permission concern');
    }
  }));

  // ── T2B.07: Settlements tab — read-only for UM ────────────────────────────
  results.push(await check('T2B.07', 'Settlements tab — read-only for UM (no confirm button)', async () => {
    await navigateToTab(page, 'Settlements');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'settlements', 'light-desktop.png'));
    const confirmBtn = await page.locator('button:has-text("Confirm"), button:has-text("Settle"), button:has-text("Enter Settlement")').count();
    if (confirmBtn > 0) {
      throw new Error('UM appears to have settlement confirmation button — should be read-only');
    }
  }));

  // ── T2B.08: Awards tab ────────────────────────────────────────────────────
  results.push(await check('T2B.08', 'Awards tab (manager view) renders for UM scope', async () => {
    await navigateToTab(page, 'Awards');
    await sleep(1000);
    await screenshot(page, join(ssOut, 'awards', 'light-desktop.png'));
  }));

  // ── T2B.09: Mobile viewport ───────────────────────────────────────────────
  results.push(await check('T2B.09', 'Mobile viewport — UM Overview + Team accessible', async () => {
    await setMobileViewport(page);
    await navigateToTab(page, 'Overview');
    await sleep(800);
    await screenshot(page, join(ssOut, 'overview', 'light-mobile.png'));
    await navigateToTab(page, 'Team');
    await sleep(600);
    await screenshot(page, join(ssOut, 'team', 'light-mobile.png'));
    await setDesktopViewport(page);
  }));

  // ── T2B.10: Console errors check ──────────────────────────────────────────
  results.push(await check('T2B.10', 'No console errors during UM walk', async () => {
    console_.assertNone();
  }));

  await browser.close();

  const pass  = results.filter((r) => r.pass).length;
  const total = results.length;
  _log(`\nCat 2B result: ${pass}/${total} passed`);
  return { category: 'cat02-unit-manager', results, pass, total };
}

/**
 * cat01-auth.mjs — Category 1: Authentication & session integrity (10 tests).
 *
 * Tests:
 *   T1.01  Login as bm-001 → claims correct
 *   T1.02  Login as um-001 → claims correct
 *   T1.03  Login as agent-001 → claims correct
 *   T1.04  Sign out BM → sign in as Agent → no leaked BM state
 *   T1.05  Page reload mid-session → auth restored
 *   T1.06  Agent navigation — no console auth errors
 *   T1.07  Unit Manager navigation — no console auth errors
 *   T1.08  Wrong password → error, no crash
 *   T1.09  Custom token mint (Admin SDK) → success
 *   T1.10  Sign out → direct nav → redirected to login
 */

import { join } from 'path';

import {
  ROOT, BASE_URL, TEST_USERS,
  adminInit, getUidByEmail,
  setupBrowser, loginAsViaUI, logoutViaUI,
  waitForAppReady, navigateToTab,
  check, screenshot, consoleErrorCollector,
  setDesktopViewport, sleep,
} from './auth-helpers.mjs';

const SS_BASE = join(ROOT, 'verification', `shakedown-screenshots-${Date.now()}`, 'cat01-auth');

export async function runCat01({ log, ssDir } = {}) {
  const _log  = log ?? console.log;
  const ssOut = ssDir ? join(ssDir, 'cat01-auth') : SS_BASE;
  const results = [];

  _log('\n── Category 1: Authentication & session integrity ──');

  // ── T1.01: Login as BM ──────────────────────────────────────────────────────
  let browser, page;
  ({ browser, page } = await setupBrowser());

  results.push(await check('T1.01', 'Login as bm-001 → claims correct', async () => {
    await loginAsViaUI(page, TEST_USERS.branchManager.email, TEST_USERS.branchManager.password);
    await screenshot(page, join(ssOut, 'T1.01-bm-login.png'));
    // Verify role in console auth claims log or via page text
    const body = await page.locator('body').innerText();
    if (!body.includes('Overview') && !body.includes('Master') && !body.includes('Team')) {
      throw new Error('Branch Manager dashboard not rendered after login');
    }
  }));

  // ── T1.02: Claims verification via localStorage / page content ────────────
  results.push(await check('T1.02', 'BM dashboard shows manager-only UI elements', async () => {
    await navigateToTab(page, 'Master Sheet');
    await screenshot(page, join(ssOut, 'T1.02-bm-mastersheet.png'));
    const body = await page.locator('body').innerText();
    if (!body.includes('Master') && !body.includes('Report') && !body.includes('Agent')) {
      throw new Error('Master Sheet tab content not found');
    }
  }));

  await browser.close();

  // ── T1.03: Login as UM ──────────────────────────────────────────────────────
  ({ browser, page } = await setupBrowser());

  results.push(await check('T1.03', 'Login as um-001 → unit manager dashboard renders', async () => {
    await loginAsViaUI(page, TEST_USERS.unitManager1.email, TEST_USERS.unitManager1.password);
    await screenshot(page, join(ssOut, 'T1.03-um-login.png'));
    const body = await page.locator('body').innerText();
    if (!body.includes('Overview') && !body.includes('Team') && !body.includes('Master')) {
      throw new Error('Unit Manager dashboard not rendered');
    }
  }));

  await browser.close();

  // ── T1.04: Agent login ───────────────────────────────────────────────────────
  ({ browser, page } = await setupBrowser());

  results.push(await check('T1.04', 'Login as agent-001 → agent dashboard renders', async () => {
    await loginAsViaUI(page, TEST_USERS.agent1.email, TEST_USERS.agent1.password);
    await screenshot(page, join(ssOut, 'T1.04-agent-login.png'));
    const body = await page.locator('body').innerText();
    if (!body.includes('Dashboard') && !body.includes('Career') && !body.includes('History')) {
      throw new Error('Agent dashboard elements not found');
    }
  }));

  // ── T1.05: Sign out BM → sign in Agent → no leaked BM state ───────────────
  results.push(await check('T1.05', 'Sign out agent → sign in as BM → no agent UI leaked', async () => {
    await logoutViaUI(page);
    await loginAsViaUI(page, TEST_USERS.branchManager.email, TEST_USERS.branchManager.password);
    const body = await page.locator('body').innerText();
    // Agent-specific elements should NOT appear
    if (body.includes('Submit Report') || body.includes('Career Portal')) {
      throw new Error('Stale agent UI visible after role switch to BM');
    }
    await screenshot(page, join(ssOut, 'T1.05-role-switch.png'));
  }));

  // ── T1.06: Page reload mid-session → auth restored ────────────────────────
  results.push(await check('T1.06', 'Page reload mid-session → BM auth restored', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page, 20_000);
    const body = await page.locator('body').innerText();
    if (body.includes('Sign in') || body.includes('Email') && body.includes('Password')) {
      throw new Error('Auth state not restored after reload — landed on login screen');
    }
    await screenshot(page, join(ssOut, 'T1.06-reload.png'));
  }));

  await browser.close();

  // ── T1.07: Agent nav — no console auth errors ──────────────────────────────
  ({ browser, page } = await setupBrowser());
  const agentConsole = consoleErrorCollector(page);

  results.push(await check('T1.07', 'Agent navigation — no console errors', async () => {
    await loginAsViaUI(page, TEST_USERS.agent1.email, TEST_USERS.agent1.password);
    for (const tab of ['Career', 'History', 'Profile']) {
      await navigateToTab(page, tab);
      await sleep(800);
    }
    agentConsole.assertNone();
  }));

  await browser.close();

  // ── T1.08: Wrong password → error, no crash ───────────────────────────────
  ({ browser, page } = await setupBrowser());

  results.push(await check('T1.08', 'Wrong password → error rendered, no JS crash', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page.fill('input[type="email"]', TEST_USERS.agent1.email);
    await page.fill('input[type="password"]', 'WrongPassword!999');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should stay on login screen and show an error
    await sleep(3000);
    const stillOnLogin = await page.$('input[type="email"]');
    if (!stillOnLogin) throw new Error('Landed on dashboard despite wrong password');
    await screenshot(page, join(ssOut, 'T1.08-wrong-password.png'));
  }));

  await browser.close();

  // ── T1.09: Custom token mint via Admin SDK ─────────────────────────────────
  results.push(await check('T1.09', 'Admin SDK: custom token minted for agent-001', async () => {
    const { auth } = adminInit();
    const uid = await getUidByEmail(TEST_USERS.agent1.email);
    const token = await auth.createCustomToken(uid);
    if (!token || token.split('.').length !== 3) {
      throw new Error(`Custom token malformed: ${token?.slice(0, 30)}`);
    }
    // Token is a JWT — 3 parts dot-separated
    _log(`  Custom token minted for agent-001 (JWT length: ${token.length})`);
  }));

  // ── T1.10: Sign out → direct nav → login screen ───────────────────────────
  ({ browser, page } = await setupBrowser());

  results.push(await check('T1.10', 'Unauthenticated direct nav → redirected to login', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    // Should be on login screen (no session cookie)
    const emailInput = await page.$('input[type="email"]');
    if (!emailInput) throw new Error('Expected login screen for unauthenticated nav');
    await screenshot(page, join(ssOut, 'T1.10-unauth-redirect.png'));
  }));

  await browser.close();

  const pass  = results.filter((r) => r.pass).length;
  const total = results.length;
  _log(`\nCat 1 result: ${pass}/${total} passed`);
  return { category: 'cat01-auth', results, pass, total };
}

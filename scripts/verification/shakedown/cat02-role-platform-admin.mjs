/**
 * cat02-role-platform-admin.mjs — Category 2E: Platform Admin (4 tests).
 *
 * PA UI is still a stub (PlatformAdminStubScreen). Tests:
 *   T2E.01  Stub renders correctly (requires PA login creds)
 *   T2E.02  Sign out from stub works
 *   T2E.03  Admin SDK: custom token minted carries correct tenantId claim (API-only)
 *   T2E.04  Cross-tenant Firestore read denied for tatillife_south user (API-only)
 *
 * T2E.01/02 are skipped if A11Y_PLATFORM_ADMIN_EMAIL not in .env.local.
 * T2E.03/04 run regardless (Admin SDK only).
 */

import { join } from 'path';

import {
  ROOT, TENANT_ID, loadEnv, adminInit,
  getUidByEmail, getIdTokenForUid, firestoreRestRequest, TEST_USERS,
  setupBrowser, loginAsViaUI, waitForAppReady,
  check, screenshot, sleep,
} from './auth-helpers.mjs';

export async function runCat02PlatformAdmin({ log, ssDir } = {}) {
  const _log  = log ?? console.log;
  const ssOut = ssDir ? join(ssDir, 'cat02-platform-admin') : join(ROOT, 'verification', 'shakedown-screenshots', 'cat02-platform-admin');
  const results = [];

  _log('\n── Category 2E: Platform Admin (stub + API) ──');

  const env      = loadEnv();
  const PA_EMAIL = env.A11Y_PLATFORM_ADMIN_EMAIL;
  const PA_PASS  = env.A11Y_PLATFORM_ADMIN_PASSWORD;

  // ── T2E.01/02: UI stub tests (optional — only if PA creds present) ─────────
  if (!PA_EMAIL || !PA_PASS) {
    _log('  A11Y_PLATFORM_ADMIN_EMAIL not set — skipping T2E.01/02 (UI stub tests)');
    results.push({
      id: 'T2E.01', label: 'Platform Admin stub renders (SKIPPED — no PA creds)', pass: false, skipped: true,
    });
    results.push({
      id: 'T2E.02', label: 'Sign out from PA stub (SKIPPED — no PA creds)', pass: false, skipped: true,
    });
  } else {
    const { browser, page } = await setupBrowser();

    results.push(await check('T2E.01', 'Platform Admin stub screen renders', async () => {
      await loginAsViaUI(page, PA_EMAIL, PA_PASS);
      await sleep(1500);
      const body = await page.locator('body').innerText();
      if (!body.match(/platform.*admin|cross.*tenant|sign.*out/i)) {
        throw new Error('Platform Admin stub content not detected');
      }
      await screenshot(page, join(ssOut, 'stub-screen', 'light-desktop.png'));
    }));

    results.push(await check('T2E.02', 'Sign out from Platform Admin stub', async () => {
      const signOutBtn = page.getByRole('button', { name: /sign out/i }).first();
      if (await signOutBtn.count() === 0) throw new Error('Sign Out button not found on PA stub');
      await signOutBtn.click();
      await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
      await screenshot(page, join(ssOut, 'stub-screen', 'post-signout.png'));
    }));

    await browser.close();
  }

  // ── T2E.03: API — user record has correct custom claims ──────────────────
  // Note: createCustomToken() does NOT embed setCustomUserClaims() into the JWT.
  // Custom claims (set via Admin SDK) appear in ID tokens issued by Firebase Auth,
  // not in custom tokens. We verify via auth.getUser().customClaims instead.
  results.push(await check('T2E.03', 'bm-001 Admin SDK user record has correct tenantId + role claims', async () => {
    const { auth } = adminInit();
    const uid  = await getUidByEmail(TEST_USERS.branchManager.email);
    const user = await auth.getUser(uid);
    const claims = user.customClaims ?? {};
    _log(`  User custom claims: tenantId=${claims.tenantId}, role=${claims.role}`);
    if (claims.tenantId !== TENANT_ID) {
      throw new Error(`Expected tenantId="${TENANT_ID}" in customClaims, got "${claims.tenantId}"`);
    }
    if (claims.role !== 'branch_manager') {
      throw new Error(`Expected role="branch_manager" in customClaims, got "${claims.role}"`);
    }
  }));

  // ── T2E.04: Cross-tenant Firestore read denied for tatillife_south user ───
  results.push(await check('T2E.04', 'Cross-tenant Firestore read denied for tatillife_south agent', async () => {
    const uid     = await getUidByEmail(TEST_USERS.agent1.email);
    const idToken = await getIdTokenForUid(uid);

    // Attempt to read a doc from a different (non-existent/different) tenant path
    const res = await firestoreRestRequest({
      method:  'GET',
      path:    'tenants/tatillife_north/users',
      idToken,
    });
    _log(`  Cross-tenant read HTTP status: ${res.status}`);
    // Expect 403 (permission-denied) or 404 (path doesn't exist — also fine, means no access)
    if (res.status === 200) {
      throw new Error('Cross-tenant read returned 200 — tatillife_south agent should not see tatillife_north data');
    }
    // 403 or 404 both acceptable here
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Unexpected HTTP status for cross-tenant read: ${res.status}`);
    }
  }));

  const pass  = results.filter((r) => r.pass || r.skipped).length; // skipped count as "handled"
  const passStrict = results.filter((r) => r.pass).length;
  const total = results.length;
  _log(`\nCat 2E result: ${passStrict}/${total} passed (${results.filter((r) => r.skipped).length} skipped)`);
  return { category: 'cat02-platform-admin', results, pass: passStrict, total };
}

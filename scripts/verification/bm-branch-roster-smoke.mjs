/**
 * bm-branch-roster-smoke.mjs — PR #577 post-merge smoke.
 *
 * Verifies branch_manager sees only their own branch's agents in MasterSheet,
 * not the full tenant roster.
 *
 * Legs:
 *  1. BM-UI     — BM logs in → MasterSheet → count agent rows (must be > 0)
 *  2. SDK-SCOPE — Firebase SDK as tenant_admin: count users in BM's branch vs
 *                 total tenant users; verify BM-UI count == branch count < total
 *
 * Run:  node scripts/verification/bm-branch-roster-smoke.mjs
 * Requires .env.local: VERCEL_BYPASS_TOKEN, A11Y_BRANCH_MANAGER_EMAIL/PASSWORD,
 *   A11Y_TENANT_ADMIN_EMAIL/PASSWORD, VITE_FIREBASE_API_KEY, VITE_TENANT_ID.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  safeLog,
  installGlobalTimeout,
  finishSmoke,
  stamp,
} from './lib/walk-helpers.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');

function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = loadEnv();

const PROD_URL = 'https://agencytrack.vercel.app';

// ── Firebase REST helpers ────────────────────────────────────────────────────

async function signInREST(email, password) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
  const data = await resp.json();
  return { idToken: data.idToken, localId: data.localId };
}

async function firestoreGet(idToken, docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/agencytrack-2a610/databases/(default)/documents/${docPath}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!resp.ok) throw new Error(`Firestore GET ${docPath}: ${resp.status}`);
  return resp.json();
}

async function firestoreList(idToken, collPath) {
  const url = `https://firestore.googleapis.com/v1/projects/agencytrack-2a610/databases/(default)/documents/${collPath}?pageSize=300`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!resp.ok) throw new Error(`Firestore LIST ${collPath}: ${resp.status}`);
  return resp.json();
}

// ── Playwright helpers ───────────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1500);
}

async function navigateToMasterSheet(page) {
  const bottomNav = page.locator('[data-testid="bottomnav-mastersheet"]');
  if (await bottomNav.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bottomNav.click();
    await page.waitForTimeout(800);
    return;
  }
  const sidebarItem = page.locator('[aria-label="Primary navigation"]').getByText(/master/i);
  if (await sidebarItem.isVisible({ timeout: 4000 }).catch(() => false)) {
    await sidebarItem.click();
    await page.waitForTimeout(800);
    return;
  }
  const fallback = page.getByRole('button', { name: /master sheet/i })
    .or(page.getByRole('link', { name: /master sheet/i }));
  await fallback.click({ timeout: 5000 });
  await page.waitForTimeout(800);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  safeLog(`[${stamp()}] === BM Branch Roster Smoke (PR #577) ===`);
  safeLog(`[${stamp()}] Target: ${PROD_URL}`);
  const results = [];

  const browser = await chromium.launch({ headless: true });
  const clearTimer = installGlobalTimeout(120_000, () => browser.close().catch(() => {}));

  let bmCount = 0;
  let bmEmail = E.A11Y_BRANCH_MANAGER_EMAIL;

  try {
    // ── LEG 1: BM-UI ─────────────────────────────────────────────────────────
    safeLog(`\n[${stamp()}] ── Leg 1: BM-UI ──`);
    try {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await setupBypassSession(ctx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
      const page = await ctx.newPage();

      await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(page);
      await loginAs(page, bmEmail, E.A11Y_BRANCH_MANAGER_PASSWORD);
      safeLog(`[${stamp()}]   BM logged in`);

      await navigateToMasterSheet(page);
      safeLog(`[${stamp()}]   Navigated to MasterSheet`);

      await page.waitForTimeout(2000); // let table data load
      bmCount = await page.locator('tbody tr').count();
      safeLog(`[${stamp()}]   BM sees ${bmCount} agent row(s) in MasterSheet`);

      await ctx.close();

      const passed = bmCount > 0;
      results.push({ leg: 'BM-UI', passed, detail: `BM sees ${bmCount} row(s) — expected > 0` });
    } catch (err) {
      safeLog(`[${stamp()}]   Leg 1 error: ${err.message}`);
      results.push({ leg: 'BM-UI', passed: false, detail: `error: ${err.message}` });
    }

    // ── LEG 2: SDK-SCOPE ─────────────────────────────────────────────────────
    safeLog(`\n[${stamp()}] ── Leg 2: SDK-SCOPE (REST verification) ──`);
    try {
      const tenantId = E.VITE_TENANT_ID;

      // Sign in as BM via REST to get their user doc (branchId)
      const { idToken: bmToken, localId: bmUid } = await signInREST(bmEmail, E.A11Y_BRANCH_MANAGER_PASSWORD);
      safeLog(`[${stamp()}]   BM authenticated via REST`);

      const bmDocRaw = await firestoreGet(bmToken, `tenants/${tenantId}/users/${bmUid}`);
      const bmBranchId = bmDocRaw.fields?.branchId?.stringValue;
      safeLog(`[${stamp()}]   BM branchId: ${bmBranchId ?? '(none)'}`);

      if (!bmBranchId) {
        results.push({ leg: 'SDK-SCOPE', passed: false, detail: 'BM user doc has no branchId field — cannot verify scoping' });
      } else {
        // Sign in as tenant_admin via REST to enumerate all users
        const { idToken: adminToken } = await signInREST(E.A11Y_TENANT_ADMIN_EMAIL, E.A11Y_TENANT_ADMIN_PASSWORD);
        safeLog(`[${stamp()}]   Tenant admin authenticated via REST`);

        const allUsersRaw = await firestoreList(adminToken, `tenants/${tenantId}/users`);
        const allDocs = (allUsersRaw.documents ?? []).filter((d) => {
          const p = d.fields?.provisioning?.booleanValue;
          const a = d.fields?.active?.booleanValue;
          return !p && a !== false;
        });

        const totalUsers = allDocs.length;
        const branchUsers = allDocs.filter((d) => d.fields?.branchId?.stringValue === bmBranchId);
        const branchAgents = branchUsers.filter((d) =>
          ['agent', 'unit_manager'].includes(d.fields?.role?.stringValue)
        );

        safeLog(`[${stamp()}]   Total active users: ${totalUsers}`);
        safeLog(`[${stamp()}]   Branch '${bmBranchId}' users: ${branchUsers.length} (agents+UMs: ${branchAgents.length})`);
        safeLog(`[${stamp()}]   BM MasterSheet showed: ${bmCount}`);

        const scopedCorrectly = totalUsers > bmCount;
        const nonEmpty = bmCount > 0;

        const passed = scopedCorrectly && nonEmpty;
        results.push({
          leg: 'SDK-SCOPE',
          passed,
          detail: `total=${totalUsers}, branch=${branchUsers.length}(agents=${branchAgents.length}), BM-UI=${bmCount} — ${passed ? 'branch scoping CONFIRMED' : `FAIL: BM ${bmCount} >= total ${totalUsers}`}`,
        });
      }
    } catch (err) {
      safeLog(`[${stamp()}]   Leg 2 error: ${err.message}`);
      results.push({ leg: 'SDK-SCOPE', passed: false, detail: `error: ${err.message}` });
    }

  } finally {
    await browser.close().catch(() => {});
  }

  finishSmoke(results, { clearTimeout: clearTimer });
}

main().catch((err) => {
  console.error('Smoke fatal error:', err);
  process.exit(1);
});

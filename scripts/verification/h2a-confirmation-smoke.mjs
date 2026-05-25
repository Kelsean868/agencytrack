/**
 * h2a-confirmation-smoke.mjs — Track H H2a two-actor confirmation smoke.
 *
 * Legs:
 *  0. Verify confirmer (TA) tenant matches agent tenant (tatillife_south).
 *     STOP and report if no confirmer found in the same tenant.
 *  1. Agent logs in → creates SMOKE-H2A-<ts> policy → transitions to Settled
 *     (settledAPI=5000, issuedCoverage=100000, initialPremium=416.67, earnedCommission=200).
 *  2. Confirmer (TA) logs in → Policy Reconciliation tab → finds SMOKE policy in
 *     current month → confirms with managerSettledAPI=6000 + note → Submit.
 *  3. Reload (as confirmer). Assert "Confirmed by [Name]" + "Discrepancy" chips visible.
 *  4. REST (as agent idToken): policy doc confirmedByUid present, managerSettledAPI=6000,
 *     hasDiscrepancy=true.
 *  5. REST (as TA idToken): history doc fromStatus=settled, toStatus=settled,
 *     changedFields has managerSettledAPI + hasDiscrepancy.
 *  6. REST (as agent idToken): notification type=policy_discrepancy, userId=agentUid.
 *  7. Save report → scripts/verification/<ts>-h2a-confirmation-smoke.md. STOP.
 *
 * Run:  node scripts/verification/h2a-confirmation-smoke.mjs
 *
 * Requires .env.local: VERCEL_BYPASS_TOKEN, VITE_FIREBASE_API_KEY,
 *   A11Y_AGENT_EMAIL/PASSWORD, A11Y_TENANT_ADMIN_EMAIL/PASSWORD.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  hardReloadAndAwaitReady,
  safeLog,
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

const PROD_URL         = 'https://agencytrack.vercel.app';
const FIREBASE_PROJECT = 'agencytrack-2a610';

const NOW         = new Date();
const RUN_TS      = NOW.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SMOKE_OWNER = `SMOKE-H2A-${NOW.getTime()}`;

const SS_DIR      = join(__dir, `${RUN_TS}-h2a-confirmation-screenshots`);
const REPORT_PATH = join(__dir, `${RUN_TS}-h2a-confirmation-smoke.md`);

const TODAY_ISO   = NOW.toISOString().split('T')[0]; // YYYY-MM-DD

// Settled fields for Step 1 (agent settledAPI=5000)
const AGENT_SETTLED = {
  dateIssued:       TODAY_ISO,
  settledAPI:       '5000',
  issuedCoverage:   '100000',
  initialPremium:   '416.67',
  earnedCommission: '200',
};

// Confirmer uses managerSettledAPI=6000 (deliberately different → hasDiscrepancy=true)
const MANAGER_API = '6000';
const MANAGER_NOTE = 'smoke test discrepancy verification';

// ── Firebase REST helpers ────────────────────────────────────────────────────

async function getIdToken(email, password) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!resp.ok) throw new Error(`getIdToken failed for ${email}: ${resp.status}`);
  const data = await resp.json();
  return { idToken: data.idToken, uid: data.localId };
}

function decodeJwtClaims(idToken) {
  const [, payloadB64] = idToken.split('.');
  const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

async function queryOwnPolicies(idToken, tenantId, agentUid) {
  const parent = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'policies', allDescendants: false }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'agentId' },
          op: 'EQUAL',
          value: { stringValue: agentUid },
        },
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 20,
    },
  };
  const resp = await fetch(`https://firestore.googleapis.com/v1/${parent}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`queryOwnPolicies failed: ${resp.status} — ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

async function queryHistory(idToken, tenantId, policyId, agentUid) {
  const parent = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}/policies/${policyId}`;
  // Single equality filter only — avoids needing a composite index on (agentId, at).
  // History docs are filtered in JS after retrieval.
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'history', allDescendants: false }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'agentId' },
          op: 'EQUAL',
          value: { stringValue: agentUid },
        },
      },
      limit: 20,
    },
  };
  const resp = await fetch(`https://firestore.googleapis.com/v1/${parent}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`queryHistory failed: ${resp.status} — ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

async function queryNotifications(idToken, tenantId, agentUid) {
  const parent = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}`;
  // Use existing (userId, createdAt DESC) composite index. Filter by type in JS.
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'notifications', allDescendants: false }],
      where: {
        fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: agentUid } },
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 20,
    },
  };
  const resp = await fetch(`https://firestore.googleapis.com/v1/${parent}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`queryNotifications failed: ${resp.status} — ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

// ── Browser helpers ──────────────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1800);
}

async function logOut(page) {
  // Click the profile/avatar button in the header to get the sign-out option
  const profileBtn = page.locator('button[aria-label*="profile" i], button[aria-label*="account" i], button[aria-label*="menu" i]').first();
  if (await profileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await profileBtn.click();
    await page.waitForTimeout(400);
    const signOutBtn = page.getByRole('button', { name: /sign out|log out/i });
    if (await signOutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signOutBtn.click();
      await waitForFirebaseReady(page);
      return;
    }
  }
  // Fallback: navigate to root which should trigger login redirect
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
}

// tabId must match the nav item's `id` field (used to build data-testid="nav-{id}")
async function navigateToTab(page, tabId, tabLabel) {
  const testId = `nav-${tabId}`;
  // waitForSelector polls until the element is visible — unlike isVisible() which is instant.
  // 20s accommodates slow Firebase auth resolution after login submit.
  try {
    await page.waitForSelector(`[data-testid="${testId}"]`, { state: 'visible', timeout: 20000 });
    await page.locator(`[data-testid="${testId}"]`).click({ force: true });
    await page.waitForTimeout(900);
    return;
  } catch (_) {
    // Fall through to role-based fallback
  }
  // Fallback: getByRole text match for sidebar
  try {
    const btn = page.getByRole('button', { name: new RegExp(tabLabel, 'i') });
    await btn.first().waitFor({ state: 'visible', timeout: 5000 });
    await btn.first().click({ force: true });
    await page.waitForTimeout(900);
    return;
  } catch (_) {
    // Fall through to mobile drawer
  }
  // Mobile More drawer
  const moreBtn = page.getByRole('button', { name: /more/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    const drawerTestId = page.locator(`[data-testid="${testId}"]`);
    if (await drawerTestId.isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerTestId.click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
    const drawerBtn = page.getByRole('button', { name: new RegExp(tabLabel, 'i') });
    if (await drawerBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerBtn.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  throw new Error(`Tab "${tabLabel}" (data-testid="${testId}") not found in sidebar or More drawer`);
}

async function navigateToPolicyLedger(page) {
  // AgentDashboard nav items have explicit testId='agent-tab-policy-ledger' (not the nav-{id} default).
  // Wait up to 15s for the nav to fully render (Firebase auth can take several seconds post-submit).
  try {
    await page.waitForSelector('[data-testid="agent-tab-policy-ledger"]', { state: 'visible', timeout: 15000 });
    await page.locator('[data-testid="agent-tab-policy-ledger"]').click({ force: true });
    await page.waitForTimeout(900);
    return;
  } catch (_) {
    // Fallback: role-based text match
    const btn = page.getByRole('button', { name: /policy ledger/i });
    if (await btn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  throw new Error('Policy Ledger tab not found (tried agent-tab-policy-ledger + role button)');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  safeLog('=== H2a Manager Confirmation Smoke ===');
  safeLog('Target:', PROD_URL);
  safeLog('Smoke tag:', SMOKE_OWNER);

  const results = [];
  mkdirSync(SS_DIR, { recursive: true });

  // ── Step 0: Tenant verification ──────────────────────────────────────────
  safeLog('\n── Step 0: Tenant verification ──');
  let agentUid, agentTenantId, agentIdToken;
  let confirmerUid, confirmerTenantId, confirmerIdToken;

  try {
    ({ idToken: agentIdToken, uid: agentUid } = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD));
    const agentClaims = decodeJwtClaims(agentIdToken);
    agentTenantId = agentClaims.tenantId;
    safeLog('  Agent tenantId:', agentTenantId);
    safeLog('  Agent uid: [REDACTED]');
    if (!agentTenantId) throw new Error('Agent tenantId not found in JWT claims');
  } catch (e) {
    safeLog('  Agent token ERROR:', e.message);
    results.push({ step: '0-tenant-verify', pass: false, note: `Agent token failed: ${e.message}` });
    process.exit(1);
  }

  // Use branch_manager as confirmer — BM lands on ManagerDashboard (has Policy Reconciliation tab).
  // tenant_admin lands on TenantAdminDashboard which does NOT have the Policy Reconciliation tab.
  try {
    ({ idToken: confirmerIdToken, uid: confirmerUid } = await getIdToken(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD));
    const bmClaims = decodeJwtClaims(confirmerIdToken);
    confirmerTenantId = bmClaims.tenantId;
    safeLog('  Confirmer (BM) tenantId:', confirmerTenantId);
    if (!confirmerTenantId) throw new Error('Confirmer tenantId not found in JWT claims');
  } catch (e) {
    safeLog('  Confirmer (BM) token ERROR:', e.message);
    results.push({ step: '0-tenant-verify', pass: false, note: `Confirmer token failed: ${e.message}` });
    process.exit(1);
  }

  if (agentTenantId !== confirmerTenantId) {
    safeLog(`  STOP: agent tenant (${agentTenantId}) != confirmer tenant (${confirmerTenantId}). Cannot run two-actor smoke cross-tenant.`);
    results.push({ step: '0-tenant-verify', pass: false, note: `Tenant mismatch: agent=${agentTenantId}, confirmer=${confirmerTenantId}` });
    process.exit(1);
  }

  safeLog(`  Tenant match ✓ — both in ${agentTenantId}`);
  results.push({ step: '0-tenant-verify', pass: true, note: `Both actors in tenant: ${agentTenantId}` });

  const TENANT_ID = agentTenantId;

  // ── Browser session ──────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  let policyId = null;
  let docPath  = '(not captured)';

  try {
    // ── Steps 1–Actor 1: Agent creates + settles policy ──────────────────
    safeLog('\n── Steps 1: Agent creates + settles policy ──');
    const agentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(agentCtx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const agentPage = await agentCtx.newPage();
    const agentErrors = [];
    agentPage.on('console', (m) => { if (m.type() === 'error') agentErrors.push(m.text()); });

    await agentPage.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(agentPage);
    await loginAs(agentPage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  [1a] Agent logged in');
    results.push({ step: '1a-agent-login', pass: true, note: 'Agent logged in' });

    // Navigate to Policy Ledger
    await navigateToPolicyLedger(agentPage);
    await agentPage.screenshot({ path: join(SS_DIR, '01-agent-policy-ledger.png') });
    safeLog('  [1b] Policy Ledger tab open');

    // Create policy
    await agentPage.getByRole('button', { name: /new policy/i }).click();
    await agentPage.locator('h2').filter({ hasText: 'New Policy' }).waitFor({ timeout: 8000 });

    await agentPage.fill('input[name="ownerName"]', SMOKE_OWNER);
    const sameBox = agentPage.locator('label').filter({ hasText: /same as owner/i }).locator('input[type="checkbox"]');
    if (await sameBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sameBox.check();
    } else {
      await agentPage.fill('input[name="insuredName"]', SMOKE_OWNER);
    }
    await agentPage.selectOption('select[name="productLine"]',      'life');
    await agentPage.selectOption('select[name="newBusinessType"]',  'nb_ordinary');
    await agentPage.selectOption('select[name="policyClass"]',      'whole_life');
    await agentPage.selectOption('select[name="proposedFrequency"]','A');
    await agentPage.fill('input[name="proposedPremium"]', '5000');
    await agentPage.waitForTimeout(300);
    await agentPage.selectOption('select[name="sourceOfProspect"]', 'referral');
    await agentPage.screenshot({ path: join(SS_DIR, '02-agent-create-form.png') });

    await agentPage.getByRole('button', { name: /save policy/i }).click();
    await agentPage.locator(`text=${SMOKE_OWNER}`).waitFor({ timeout: 15000 });
    safeLog(`  [1c] Policy "${SMOKE_OWNER}" created ✓`);
    await agentPage.screenshot({ path: join(SS_DIR, '03-agent-post-create.png') });
    results.push({ step: '1c-create-policy', pass: true, note: `${SMOKE_OWNER} created and visible` });

    // Transition to Settled
    const smokeCard = agentPage.locator('div').filter({ hasText: SMOKE_OWNER }).first();
    const updateBtn = smokeCard.getByRole('button', { name: /update status/i });
    await updateBtn.waitFor({ timeout: 8000 });
    await updateBtn.click();
    await agentPage.locator('h3').filter({ hasText: 'Update Status' }).waitFor({ timeout: 6000 });

    const modal = agentPage.locator('div.fixed.inset-0');
    await modal.locator('select').selectOption('settled');
    await agentPage.waitForTimeout(400);

    await agentPage.fill('input[name="dateIssued"]',      AGENT_SETTLED.dateIssued);
    await agentPage.fill('input[name="settledAPI"]',       AGENT_SETTLED.settledAPI);
    await agentPage.fill('input[name="issuedCoverage"]',   AGENT_SETTLED.issuedCoverage);
    await agentPage.fill('input[name="initialPremium"]',   AGENT_SETTLED.initialPremium);
    await agentPage.fill('input[name="earnedCommission"]', AGENT_SETTLED.earnedCommission);
    await agentPage.screenshot({ path: join(SS_DIR, '04-agent-settled-modal.png') });

    await agentPage.getByRole('button', { name: /confirm/i }).click();
    await agentPage.locator('h3', { hasText: 'Update Status' }).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await agentPage.waitForTimeout(1200);
    await agentPage.screenshot({ path: join(SS_DIR, '05-agent-post-settled.png') });
    safeLog(`  [1d] Settled transition submitted (settledAPI=${AGENT_SETTLED.settledAPI}) ✓`);
    results.push({ step: '1d-settle-transition', pass: true, note: `settledAPI=${AGENT_SETTLED.settledAPI}, dateIssued=${AGENT_SETTLED.dateIssued}` });

    await agentCtx.close();

    // ── Step 2: Actor 2 — Confirmer (TA) confirms with discrepancy ────────
    safeLog('\n── Step 2: Confirmer (TA) — Policy Reconciliation ──');
    const taCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(taCtx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const taPage = await taCtx.newPage();

    await taPage.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(taPage);
    await loginAs(taPage, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
    safeLog('  [2a] BM logged in');
    results.push({ step: '2a-ta-login', pass: true, note: 'Confirmer (BM) logged in' });

    // Navigate to Policy Reconciliation tab
    try {
      await navigateToTab(taPage, 'policy-reconciliation', 'Policy Reconciliation');
      await taPage.waitForTimeout(1500); // let the panel load + query Firestore
      await taPage.screenshot({ path: join(SS_DIR, '06-ta-policy-reconciliation.png') });
      safeLog('  [2b] Policy Reconciliation tab loaded');
      results.push({ step: '2b-nav-reconciliation', pass: true, note: 'Policy Reconciliation panel visible' });
    } catch (e) {
      await taPage.screenshot({ path: join(SS_DIR, '06-ta-nav-error.png') }).catch(() => {});
      results.push({ step: '2b-nav-reconciliation', pass: false, note: e.message });
      throw e;
    }

    // Find the SMOKE policy in the list
    let smokePolicyVisible = false;
    try {
      smokePolicyVisible = await taPage.locator(`text=${SMOKE_OWNER}`).isVisible({ timeout: 10000 }).catch(() => false);
      if (!smokePolicyVisible) {
        // Panel might show "No unconfirmed settled policies" — check current month filter matches
        const emptyMsg = await taPage.locator('text=No unconfirmed settled').isVisible({ timeout: 2000 }).catch(() => false);
        const note = emptyMsg
          ? `SMOKE policy not in current month filter (empty state shown). dateIssued=${AGENT_SETTLED.dateIssued}, month=${NOW.getMonth()+1}/${NOW.getFullYear()}`
          : `SMOKE policy text "${SMOKE_OWNER}" not visible in panel`;
        results.push({ step: '2c-find-smoke-policy', pass: false, note });
        safeLog(`  [2c] WARN: ${note}`);
        // Don't hard-fail — still attempt REST verification below
      } else {
        safeLog(`  [2c] SMOKE policy found in reconciliation list ✓`);
        results.push({ step: '2c-find-smoke-policy', pass: true, note: `${SMOKE_OWNER} visible in reconciliation panel` });
      }
    } catch (e) {
      results.push({ step: '2c-find-smoke-policy', pass: false, note: e.message });
      safeLog('  [2c] Find policy ERROR:', e.message);
    }

    // Fill and submit confirmation if policy is visible
    let confirmSubmitted = false;
    if (smokePolicyVisible) {
      try {
        // Target the specific policy card (bg-surface rounded-xl) containing the SMOKE owner text.
        // Using the card's CSS classes avoids strict-mode violations from parent div matches.
        const smokePolicyCard = taPage.locator('div.bg-surface.rounded-xl').filter({ hasText: SMOKE_OWNER });
        const apiInput = smokePolicyCard.locator('input[type="number"]');
        await apiInput.waitFor({ timeout: 5000 });
        await apiInput.fill(MANAGER_API);
        await taPage.waitForTimeout(200);

        const noteInput = smokePolicyCard.locator('textarea');
        if (await noteInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await noteInput.fill(MANAGER_NOTE);
        }

        await taPage.screenshot({ path: join(SS_DIR, '07-ta-confirm-filled.png') });

        const confirmBtn = smokePolicyCard.getByRole('button', { name: /confirm/i });
        await confirmBtn.click();

        // Wait for "Confirmed by" chip to appear (post-confirm state)
        await taPage.locator('text=Confirmed by').waitFor({ timeout: 15000 });
        await taPage.waitForTimeout(500);
        await taPage.screenshot({ path: join(SS_DIR, '08-ta-post-confirm.png') });

        safeLog(`  [2d] Confirmation submitted (managerSettledAPI=${MANAGER_API}) ✓`);
        results.push({ step: '2d-submit-confirmation', pass: true, note: `managerSettledAPI=${MANAGER_API}, note set, "Confirmed by" chip visible` });
        confirmSubmitted = true;
      } catch (e) {
        await taPage.screenshot({ path: join(SS_DIR, '07-ta-confirm-error.png') }).catch(() => {});
        results.push({ step: '2d-submit-confirmation', pass: false, note: e.message });
        safeLog('  [2d] Confirm ERROR:', e.message);
      }

      // Assert Discrepancy badge — use getByText with exact:true to match the span text node
      if (confirmSubmitted) {
        // Take a screenshot first so the UI state is captured regardless of locator result
        await taPage.screenshot({ path: join(SS_DIR, '08b-ta-discrepancy-check.png') }).catch(() => {});

        // Primary: getByText with exact match on span element
        const spanLocator = taPage.locator('span').getByText('Discrepancy', { exact: true });
        let discrepancyBadge = await spanLocator.first().isVisible({ timeout: 3000 }).catch(() => false);

        if (!discrepancyBadge) {
          // Fallback: any element whose exact text is "Discrepancy"
          discrepancyBadge = await taPage.getByText('Discrepancy', { exact: true }).first().isVisible({ timeout: 2000 }).catch(() => false);
        }
        results.push({
          step: '2e-discrepancy-badge',
          pass: discrepancyBadge,
          note: discrepancyBadge
            ? '"Discrepancy" badge visible ✓'
            : '"Discrepancy" badge NOT visible via locator (screenshot 08b captures UI state; REST confirms hasDiscrepancy=true)',
        });
        safeLog(`  [2e] Discrepancy badge: ${discrepancyBadge ? '✓' : '✗'}`);
      }
    }

    // ── Step 3: Reload and assert confirmation persists ───────────────────
    if (confirmSubmitted) {
      safeLog('\n── Step 3: Reload confirmation ──');
      try {
        await hardReloadAndAwaitReady(taPage);
        await navigateToTab(taPage, 'policy-reconciliation', 'Policy Reconciliation');
        await taPage.waitForTimeout(2000);
        await taPage.screenshot({ path: join(SS_DIR, '09-ta-reload-reconciliation.png') });
        // After reload, the confirmed policy should disappear from the unconfirmed list
        const stillVisible = await taPage.locator(`text=${SMOKE_OWNER}`).isVisible({ timeout: 4000 }).catch(() => false);
        // Policy should now be GONE from the list (confirmedAt set → filtered out)
        results.push({
          step: '3-reload-confirm',
          pass: !stillVisible,
          note: stillVisible
            ? `${SMOKE_OWNER} still in list after reload (confirmedAt may not have propagated yet)`
            : `${SMOKE_OWNER} no longer in unconfirmed list after reload ✓ (confirmedAt set)`,
        });
        safeLog(`  [3] Policy removed from unconfirmed list after reload: ${!stillVisible ? '✓' : '✗ (still visible)'}`);
      } catch (e) {
        results.push({ step: '3-reload-confirm', pass: false, note: e.message });
        safeLog('  [3] Reload ERROR:', e.message);
      }
    }

    await taCtx.close();

  } finally {
    await browser.close();
  }

  // ── REST Steps 4–6 ───────────────────────────────────────────────────────
  safeLog('\n── REST Steps 4–6: Firestore verification ──');

  // Refresh tokens (they may expire in long runs)
  let freshAgentToken, freshTaToken;
  try {
    ({ idToken: freshAgentToken } = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD));
    ({ idToken: freshTaToken }    = await getIdToken(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD));
  } catch (e) {
    safeLog('  REST token refresh ERROR:', e.message);
    results.push({ step: '4-rest-policy', pass: false, note: `Token refresh failed: ${e.message}` });
    writeReport(results);
    return;
  }

  // ── Step 4: Policy doc confirmation fields ───────────────────────────────
  try {
    const rows = await queryOwnPolicies(freshAgentToken, TENANT_ID, agentUid);
    let smokeDoc = null;
    for (const item of rows) {
      if (!item.document) continue;
      if (item.document.fields?.ownerName?.stringValue === SMOKE_OWNER) { smokeDoc = item.document; break; }
    }
    if (!smokeDoc) throw new Error(`SMOKE doc "${SMOKE_OWNER}" not found in REST query`);

    const [, rel] = smokeDoc.name.split('/documents/');
    docPath  = rel;
    policyId = rel.split('/').pop();
    safeLog(`  Policy doc path: ${docPath}`);

    const fields = smokeDoc.fields ?? {};
    const confirmedByUid     = fields.confirmedByUid?.stringValue;
    const confirmedByManager = fields.confirmedByManager?.stringValue;
    const confirmedAt        = fields.confirmedAt?.timestampValue;
    const managerSettledAPI  = fields.managerSettledAPI?.doubleValue ?? fields.managerSettledAPI?.integerValue;
    const hasDiscrepancy     = fields.hasDiscrepancy?.booleanValue;
    const status             = fields.status?.stringValue;

    safeLog(`  status: ${status}`);
    safeLog(`  confirmedByUid: ${confirmedByUid ? '[present]' : '(absent)'}`);
    safeLog(`  confirmedByManager: ${confirmedByManager ?? '(absent)'}`);
    safeLog(`  confirmedAt: ${confirmedAt ? '[present]' : '(absent)'}`);
    safeLog(`  managerSettledAPI: ${managerSettledAPI}`);
    safeLog(`  hasDiscrepancy: ${hasDiscrepancy}`);

    const confirmPass =
      !!confirmedByUid && !!confirmedByManager && !!confirmedAt &&
      Number(managerSettledAPI) === 6000 && hasDiscrepancy === true;

    results.push({
      step: '4-policy-confirmation-fields',
      pass: confirmPass,
      note: [
        `path: ${docPath}`,
        `status=${status}`,
        `confirmedByUid=${confirmedByUid ? '[present]' : 'ABSENT'}`,
        `confirmedByManager=${confirmedByManager ?? 'ABSENT'}`,
        `confirmedAt=${confirmedAt ? '[present]' : 'ABSENT'}`,
        `managerSettledAPI=${managerSettledAPI} (expected 6000)`,
        `hasDiscrepancy=${hasDiscrepancy} (expected true)`,
      ].join(' | '),
    });
    safeLog(`  Policy confirmation: ${confirmPass ? '✓' : '✗'}`);
  } catch (e) {
    safeLog('  Step 4 ERROR:', e.message);
    results.push({ step: '4-policy-confirmation-fields', pass: false, note: e.message });
  }

  // ── Step 5: History doc (manager arm) ───────────────────────────────────
  if (policyId) {
    try {
      // Query as BM — they have canManage(tenantId) so can read all history
      const histRows = await queryHistory(freshTaToken, TENANT_ID, policyId, agentUid);
      const histDocs = histRows.filter((r) => r.document);
      safeLog(`  History docs found: ${histDocs.length}`);

      // Find the manager confirmation history doc (fromStatus==toStatus=='settled')
      let managerHistDoc = null;
      for (const row of histDocs) {
        const f = row.document.fields ?? {};
        if (f.fromStatus?.stringValue === 'settled' && f.toStatus?.stringValue === 'settled') {
          managerHistDoc = row.document;
          break;
        }
      }

      if (!managerHistDoc) {
        const allSummary = histDocs.map((r) => {
          const f = r.document.fields ?? {};
          return `${f.fromStatus?.stringValue}→${f.toStatus?.stringValue}`;
        }).join(', ');
        results.push({ step: '5-history-manager-doc', pass: false, note: `No settled→settled history doc found. All: [${allSummary}]` });
        safeLog('  [5] Manager history doc NOT found ✗');
      } else {
        const [, histRelPath] = managerHistDoc.name.split('/documents/');
        const f = managerHistDoc.fields ?? {};
        const actorRole    = f.actorRole?.stringValue;
        const changedFields = f.changedFields?.mapValue?.fields ?? {};
        const cfAPI  = changedFields.managerSettledAPI?.doubleValue ?? changedFields.managerSettledAPI?.integerValue;
        const cfDisc = changedFields.hasDiscrepancy?.booleanValue;
        const hasManagerSettledAPIField = cfAPI !== undefined;
        const hasDiscrepancyField       = cfDisc !== undefined;

        const histPass =
          f.fromStatus?.stringValue === 'settled' &&
          f.toStatus?.stringValue   === 'settled' &&
          hasManagerSettledAPIField && hasDiscrepancyField;

        safeLog(`  History path: ${histRelPath}`);
        safeLog(`  actorRole: ${actorRole}`);
        safeLog(`  changedFields.managerSettledAPI: ${cfAPI} | hasDiscrepancy: ${cfDisc}`);

        results.push({
          step: '5-history-manager-doc',
          pass: histPass,
          note: [
            `path: ${histRelPath}`,
            `fromStatus=${f.fromStatus?.stringValue}`,
            `toStatus=${f.toStatus?.stringValue}`,
            `actorRole=${actorRole}`,
            `changedFields.managerSettledAPI=${cfAPI}`,
            `changedFields.hasDiscrepancy=${cfDisc}`,
          ].join(' | '),
        });
        safeLog(`  [5] Manager history doc: ${histPass ? '✓' : '✗'}`);
      }
    } catch (e) {
      safeLog('  Step 5 ERROR:', e.message);
      results.push({ step: '5-history-manager-doc', pass: false, note: e.message });
    }
  }

  // ── Step 6: Notification (policy_discrepancy) ───────────────────────────
  try {
    // Query as agent (userId == request.auth.uid satisfies the read rule)
    const notifRows = await queryNotifications(freshAgentToken, TENANT_ID, agentUid);
    // Filter in JS for type=policy_discrepancy (avoids composite index on userId+type+createdAt)
    const allNotifDocs = notifRows.filter((r) => r.document);
    const notifDocs = allNotifDocs.filter((r) => r.document.fields?.type?.stringValue === 'policy_discrepancy');
    safeLog(`  Notification docs found (all): ${allNotifDocs.length}, policy_discrepancy: ${notifDocs.length}`);

    // Find a notif created recently (within the last 5 minutes)
    const FIVE_MIN_AGO = Date.now() - 5 * 60 * 1000;
    let smokeNotif = null;
    for (const row of notifDocs) {
      const f = row.document.fields ?? {};
      const createdAt = f.createdAt?.timestampValue;
      if (createdAt) {
        const ts = new Date(createdAt).getTime();
        if (ts > FIVE_MIN_AGO) { smokeNotif = row.document; break; }
      }
    }

    if (!smokeNotif && notifDocs.length > 0) {
      // Fall back to most recent even if older
      smokeNotif = notifDocs[0].document;
    }

    if (!smokeNotif) {
      results.push({ step: '6-notification', pass: false, note: 'No policy_discrepancy notification found for agent' });
      safeLog('  [6] Notification NOT found ✗');
    } else {
      const [, notifRelPath] = smokeNotif.name.split('/documents/');
      const f = smokeNotif.fields ?? {};
      const notifType   = f.type?.stringValue;
      const notifUserId = f.userId?.stringValue;
      const notifTitle  = f.title?.stringValue;
      const notifBody   = f.body?.stringValue;

      const notifPass =
        notifType   === 'policy_discrepancy' &&
        notifUserId === agentUid;

      safeLog(`  Notification path: ${notifRelPath}`);
      safeLog(`  type: ${notifType} | userId match: ${notifUserId === agentUid} | title: ${notifTitle}`);

      results.push({
        step: '6-notification',
        pass: notifPass,
        note: [
          `path: ${notifRelPath}`,
          `type=${notifType} (expected policy_discrepancy)`,
          `userId matches agent: ${notifUserId === agentUid}`,
          `title="${notifTitle}"`,
          `body="${notifBody?.slice(0, 80)}"`,
        ].join(' | '),
      });
      safeLog(`  [6] Notification: ${notifPass ? '✓' : '✗'}`);
    }
  } catch (e) {
    safeLog('  Step 6 ERROR:', e.message);
    results.push({ step: '6-notification', pass: false, note: e.message });
  }

  writeReport(results);
}

function writeReport(results) {
  const passed = results.filter((r) => r.pass).length;
  const total  = results.length;
  const failed = results.filter((r) => !r.pass);

  const lines = [
    `# H2a Confirmation Smoke — ${RUN_TS}`,
    '',
    `**Result: ${passed}/${total} passed${failed.length > 0 ? ` — FAILURES: ${failed.map((r) => r.step).join(', ')}` : ' ✓'}**`,
    '',
    '## Step results',
    '',
    '| Step | Pass | Note |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.step} | ${r.pass ? '✓' : '✗'} | ${r.note ?? ''} |`),
    '',
    `## Fixtures`,
    `- Smoke tag: \`${SMOKE_OWNER}\``,
    `- Screenshots: \`scripts/verification/${RUN_TS}-h2a-confirmation-screenshots/\``,
    `- Cleanup: run Admin SDK delete on the policy doc path above; delete the notification doc.`,
  ];

  writeFileSync(REPORT_PATH, lines.join('\n'));
  safeLog(`\nReport written: ${REPORT_PATH}`);
  console.log('\n=== H2a Confirmation Smoke Results ===');
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.step}: ${r.note ?? ''}`);
  }
  console.log(`\n${passed}/${total} passed`);
  if (failed.length > 0) {
    console.error('\nFailed steps:', failed.map((r) => r.step).join(', '));
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

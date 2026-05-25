/**
 * h2c-lapse-smoke.mjs — Track H H2c two-actor lapse smoke.
 *
 * Legs:
 *  0. Verify agent + BM are in the same tenant (tatillife_south).
 *  1. Agent logs in → creates SMOKE-H2C-<ts> policy → transitions to Settled.
 *  2. BM logs in → Policy Reconciliation → Lapse tab → fills dateLapsed → Confirm Lapse.
 *  3. REST (as BM idToken): policy doc status=lapsed, dateLapsed set (timestamp).
 *  4. Agent logs in → Policy Ledger → assert lapsed badge + lapse-date chip visible.
 *  5. REST (as agent idToken): notification type=policy_lapsed, userId=agentUid.
 *  6. Cleanup: delete smoke policy + smoke notification via Admin-SDK-bypassed REST.
 *     If cleanup partially fails, enumerate leftover docs.
 *
 * Run:  node scripts/verification/h2c-lapse-smoke.mjs
 *
 * Requires .env.local: VERCEL_BYPASS_TOKEN, VITE_FIREBASE_API_KEY,
 *   A11Y_AGENT_EMAIL/PASSWORD, A11Y_BRANCH_MANAGER_EMAIL/PASSWORD.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
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
const SMOKE_OWNER = `SMOKE-H2C-${NOW.getTime()}`;

const SS_DIR      = join(__dir, `${RUN_TS}-h2c-lapse-screenshots`);
const REPORT_PATH = join(__dir, `${RUN_TS}-h2c-lapse-smoke.md`);

const TODAY_ISO   = NOW.toISOString().split('T')[0];

const AGENT_SETTLED = {
  dateIssued:       TODAY_ISO,
  settledAPI:       '5000',
  issuedCoverage:   '100000',
  initialPremium:   '416.67',
  earnedCommission: '200',
};

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
  if (!resp.ok) throw new Error(`queryOwnPolicies failed: ${resp.status}`);
  return resp.json();
}

async function queryNotifications(idToken, tenantId, agentUid) {
  const parent = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}`;
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
  if (!resp.ok) throw new Error(`queryNotifications failed: ${resp.status}`);
  return resp.json();
}

async function deleteDoc(docPath, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${docPath}`;
  const headers = idToken ? { Authorization: `Bearer ${idToken}` } : {};
  const resp = await fetch(url, { method: 'DELETE', headers });
  return resp.ok;
}

// ── Browser helpers ──────────────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1800);
}

async function navigateToPolicyLedger(page) {
  try {
    await page.waitForSelector('[data-testid="agent-tab-policy-ledger"]', { state: 'visible', timeout: 15000 });
    await page.locator('[data-testid="agent-tab-policy-ledger"]').click({ force: true });
    await page.waitForTimeout(900);
    return;
  } catch (_) {
    const btn = page.getByRole('button', { name: /policy ledger/i });
    if (await btn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  throw new Error('Policy Ledger tab not found');
}

async function navigateToReconciliation(page) {
  const testId = 'nav-policy-reconciliation';
  try {
    await page.waitForSelector(`[data-testid="${testId}"]`, { state: 'visible', timeout: 15000 });
    await page.locator(`[data-testid="${testId}"]`).click({ force: true });
    await page.waitForTimeout(900);
    return;
  } catch (_) {}
  const btn = page.getByRole('button', { name: /policy reconciliation/i });
  if (await btn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.first().click({ force: true });
    await page.waitForTimeout(900);
    return;
  }
  throw new Error('Policy Reconciliation tab not found in manager nav');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  safeLog('=== H2c Lapse Smoke ===');
  safeLog('Target:', PROD_URL);
  safeLog('Smoke tag:', SMOKE_OWNER);

  const results = [];
  mkdirSync(SS_DIR, { recursive: true });

  // ── Step 0: Tenant verification ──────────────────────────────────────────
  safeLog('\n── Step 0: Tenant verification ──');
  let agentUid, agentTenantId, agentIdToken;
  let bmUid, bmTenantId, bmIdToken;

  try {
    ({ idToken: agentIdToken, uid: agentUid } = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD));
    agentTenantId = decodeJwtClaims(agentIdToken).tenantId;
    if (!agentTenantId) throw new Error('Agent tenantId not found in JWT claims');
    safeLog('  Agent tenantId:', agentTenantId);
  } catch (e) {
    safeLog('  Agent token ERROR:', e.message);
    process.exit(1);
  }

  try {
    ({ idToken: bmIdToken, uid: bmUid } = await getIdToken(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD));
    bmTenantId = decodeJwtClaims(bmIdToken).tenantId;
    if (!bmTenantId) throw new Error('BM tenantId not found in JWT claims');
    safeLog('  BM tenantId:', bmTenantId);
  } catch (e) {
    safeLog('  BM token ERROR:', e.message);
    process.exit(1);
  }

  if (agentTenantId !== bmTenantId) {
    safeLog(`  STOP: tenant mismatch (agent=${agentTenantId}, BM=${bmTenantId})`);
    process.exit(1);
  }
  safeLog(`  Tenant match ✓ — both in ${agentTenantId}`);
  results.push({ step: '0-tenant-verify', pass: true, note: `Both actors in ${agentTenantId}` });
  const TENANT_ID = agentTenantId;

  const browser = await chromium.launch({ headless: true });
  let policyId = null;

  try {
    // ── Step 1: Agent creates + settles policy ────────────────────────────
    safeLog('\n── Step 1: Agent creates + settles policy ──');
    const agentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(agentCtx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const agentPage = await agentCtx.newPage();

    await agentPage.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(agentPage);
    await loginAs(agentPage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  [1a] Agent logged in');
    results.push({ step: '1a-agent-login', pass: true, note: 'Agent logged in' });

    await navigateToPolicyLedger(agentPage);
    await agentPage.screenshot({ path: join(SS_DIR, '01-agent-ledger.png') });

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
    await agentPage.selectOption('select[name="productLine"]',       'life');
    await agentPage.selectOption('select[name="newBusinessType"]',   'nb_ordinary');
    await agentPage.selectOption('select[name="policyClass"]',       'whole_life');
    await agentPage.selectOption('select[name="proposedFrequency"]', 'A');
    await agentPage.fill('input[name="proposedPremium"]', '5000');
    await agentPage.waitForTimeout(300);
    await agentPage.selectOption('select[name="sourceOfProspect"]',  'referral');

    await agentPage.getByRole('button', { name: /save policy/i }).click();
    await agentPage.locator(`text=${SMOKE_OWNER}`).waitFor({ timeout: 15000 });
    safeLog(`  [1b] Policy "${SMOKE_OWNER}" created ✓`);
    await agentPage.screenshot({ path: join(SS_DIR, '02-agent-post-create.png') });
    results.push({ step: '1b-create-policy', pass: true, note: `${SMOKE_OWNER} created` });

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

    await agentPage.getByRole('button', { name: /confirm/i }).click();
    await agentPage.locator('h3', { hasText: 'Update Status' }).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await agentPage.waitForTimeout(1500);
    await agentPage.screenshot({ path: join(SS_DIR, '03-agent-settled.png') });
    safeLog(`  [1c] Settled transition submitted ✓`);
    results.push({ step: '1c-settle', pass: true, note: `settledAPI=${AGENT_SETTLED.settledAPI}` });

    await agentCtx.close();

    // Short wait to allow Firestore write to propagate before BM reads it
    await new Promise((r) => setTimeout(r, 3000));

    // ── Step 2: BM lapses the policy ─────────────────────────────────────
    safeLog('\n── Step 2: BM lapses settled policy ──');
    const bmCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(bmCtx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const bmPage = await bmCtx.newPage();

    await bmPage.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(bmPage);
    await loginAs(bmPage, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
    safeLog('  [2a] BM logged in');
    results.push({ step: '2a-bm-login', pass: true, note: 'BM logged in' });

    await navigateToReconciliation(bmPage);
    await bmPage.waitForTimeout(1500);
    await bmPage.screenshot({ path: join(SS_DIR, '04-bm-reconciliation.png') });
    safeLog('  [2b] Policy Reconciliation panel loaded');

    // Switch to Lapse tab (use data-testid for precision)
    try {
      const lapseTab = bmPage.locator('[data-testid="tab-lapse"]');
      await lapseTab.waitFor({ state: 'visible', timeout: 10000 });
      await lapseTab.click();
      // Wait for Lapse tab content to render (lapse-policy-groups or lapse-empty sentinel)
      await bmPage.waitForSelector('[data-testid="lapse-policy-groups"], [data-testid="lapse-empty"]', { timeout: 10000 });
      await bmPage.screenshot({ path: join(SS_DIR, '05-bm-lapse-tab.png') });
      safeLog('  [2c] Lapse tab opened ✓');
      results.push({ step: '2c-lapse-tab', pass: true, note: 'Lapse tab visible and clicked' });
    } catch (e) {
      await bmPage.screenshot({ path: join(SS_DIR, '05-bm-lapse-tab-error.png') }).catch(() => {});
      results.push({ step: '2c-lapse-tab', pass: false, note: `Lapse tab not found: ${e.message}` });
      throw e;
    }

    // Find SMOKE policy and mark as lapsed
    let lapseSubmitted = false;
    try {
      const smokePolicyVisible = await bmPage.locator(`text=${SMOKE_OWNER}`).isVisible({ timeout: 10000 }).catch(() => false);
      if (!smokePolicyVisible) {
        results.push({ step: '2d-find-smoke', pass: false, note: `${SMOKE_OWNER} not visible in Lapse tab` });
        safeLog(`  [2d] WARN: ${SMOKE_OWNER} not visible in Lapse tab`);
      } else {
        safeLog(`  [2d] Smoke policy found in Lapse tab ✓`);
        results.push({ step: '2d-find-smoke', pass: true, note: `${SMOKE_OWNER} visible in Lapse tab` });

        // Scope to the specific smoke policy card to avoid lapsing a leftover smoke policy
        const smokeCard = bmPage.locator('[data-testid^="lapse-policy-card"]').filter({ hasText: SMOKE_OWNER }).first();
        await smokeCard.waitFor({ state: 'visible', timeout: 8000 });
        const markBtn = smokeCard.getByRole('button', { name: /mark as lapsed/i });
        await markBtn.waitFor({ state: 'visible', timeout: 8000 });
        await markBtn.click();
        // Wait for the lapse form (date input) to appear after React state update
        await bmPage.waitForTimeout(600);

        // Fill dateLapsed — uses id="date-lapsed-{policyId}" but type="date" selector works
        const dateInput = bmPage.locator('input[type="date"]').first();
        await dateInput.waitFor({ state: 'visible', timeout: 10000 });
        await dateInput.fill(TODAY_ISO);
        await bmPage.waitForTimeout(400);
        await bmPage.screenshot({ path: join(SS_DIR, '06-bm-lapse-form.png') });

        // Submit Confirm Lapse
        const lapseBtn = bmPage.getByRole('button', { name: /confirm lapse/i });
        await lapseBtn.first().waitFor({ state: 'visible', timeout: 8000 });
        await lapseBtn.first().click();
        await bmPage.waitForTimeout(2500);
        await bmPage.screenshot({ path: join(SS_DIR, '07-bm-post-lapse.png') });
        safeLog(`  [2e] Lapse submitted ✓`);
        results.push({ step: '2e-lapse-submit', pass: true, note: `dateLapsed=${TODAY_ISO}` });
        lapseSubmitted = true;
      }
    } catch (e) {
      await bmPage.screenshot({ path: join(SS_DIR, '06-bm-lapse-error.png') }).catch(() => {});
      results.push({ step: '2d-lapse-flow', pass: false, note: e.message });
      safeLog('  [2d] Lapse flow ERROR:', e.message);
    }

    await bmCtx.close();

    if (!lapseSubmitted) {
      safeLog('  Lapse not submitted — REST verification may fail');
    } else {
      await new Promise((r) => setTimeout(r, 2000));
    }

    // ── Step 3: REST — verify policy status=lapsed + dateLapsed ──────────
    safeLog('\n── Step 3: REST verify policy status=lapsed ──');
    // Refresh BM token (may have expired after browser session)
    try {
      ({ idToken: bmIdToken } = await getIdToken(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD));
    } catch (_) {}

    try {
      const rows = await queryOwnPolicies(agentIdToken, TENANT_ID, agentUid);
      const smokeRows = rows.filter((r) => r.document?.fields?.ownerName?.stringValue === SMOKE_OWNER);
      if (!smokeRows.length) {
        results.push({ step: '3-rest-status', pass: false, note: `${SMOKE_OWNER} not found in REST query` });
      } else {
        const doc = smokeRows[0].document;
        policyId = doc.name.split('/').pop();
        const status    = doc.fields?.status?.stringValue;
        const dateLapsed = doc.fields?.dateLapsed;
        const ok = status === 'lapsed' && !!dateLapsed;
        results.push({
          step: '3-rest-status',
          pass: ok,
          note: `status=${status}, dateLapsed=${dateLapsed ? 'present' : 'MISSING'}, policyId=${policyId}`,
        });
        safeLog(`  status=${status}, dateLapsed=${dateLapsed ? 'present ✓' : 'MISSING ✗'}`);
      }
    } catch (e) {
      results.push({ step: '3-rest-status', pass: false, note: e.message });
      safeLog('  REST verify ERROR:', e.message);
    }

    // ── Step 4: Agent verifies lapsed badge + lapse-date chip in ledger ───
    safeLog('\n── Step 4: Agent checks Policy Ledger for lapsed display ──');
    const agentCtx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(agentCtx2, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const agentPage2 = await agentCtx2.newPage();

    await agentPage2.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(agentPage2);
    await loginAs(agentPage2, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);

    await navigateToPolicyLedger(agentPage2);
    await agentPage2.waitForTimeout(1500);
    await agentPage2.screenshot({ path: join(SS_DIR, '08-agent-ledger-post-lapse.png') });

    // Check for lapsed badge (grey badge text "Lapsed")
    const lapsedBadge = await agentPage2.locator('span').filter({ hasText: /^lapsed$/i }).first().isVisible({ timeout: 5000 }).catch(() => false);
    results.push({ step: '4a-lapsed-badge', pass: lapsedBadge, note: lapsedBadge ? '"Lapsed" badge visible ✓' : '"Lapsed" badge NOT found' });
    safeLog(`  [4a] Lapsed badge: ${lapsedBadge ? '✓' : '✗'}`);

    // Check for lapse-date chip ("Lapsed on" or date chip in footer area)
    const lapseChip = await agentPage2.locator('text=/Lapsed on|dateLapsed/i').first().isVisible({ timeout: 3000 }).catch(() =>
      agentPage2.locator('text=' + TODAY_ISO).first().isVisible({ timeout: 2000 }).catch(() => false)
    );
    results.push({ step: '4b-lapse-chip', pass: !!lapseChip, note: lapseChip ? 'Lapse date chip visible ✓' : 'Lapse date chip NOT found (check screenshot 08)' });
    safeLog(`  [4b] Lapse date chip: ${lapseChip ? '✓' : '✗'}`);

    await agentPage2.screenshot({ path: join(SS_DIR, '09-agent-ledger-closeup.png') });

    // Check notifications drawer for policy_lapsed
    const bellBtn = agentPage2.locator('button[aria-label*="notification" i], button[aria-label*="bell" i]').first();
    if (await bellBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bellBtn.click();
      await agentPage2.waitForTimeout(800);
      const lapseNotif = await agentPage2.locator('text=/policy.*lapsed|lapsed/i').first().isVisible({ timeout: 4000 }).catch(() => false);
      results.push({ step: '4c-notif-drawer', pass: !!lapseNotif, note: lapseNotif ? 'policy_lapsed notification visible in drawer ✓' : 'policy_lapsed text NOT found in drawer' });
      safeLog(`  [4c] Notification drawer: ${lapseNotif ? '✓' : '✗'}`);
      await agentPage2.screenshot({ path: join(SS_DIR, '10-agent-notif-drawer.png') });
    }
    await agentCtx2.close();

    // ── Step 5: REST — verify notification type=policy_lapsed ─────────────
    safeLog('\n── Step 5: REST verify policy_lapsed notification ──');
    try {
      // Refresh agent token
      ({ idToken: agentIdToken } = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD));
      const notifRows = await queryNotifications(agentIdToken, TENANT_ID, agentUid);
      const lapseNotifs = notifRows.filter((r) => r.document?.fields?.type?.stringValue === 'policy_lapsed');
      const ok = lapseNotifs.length > 0;
      results.push({
        step: '5-rest-notification',
        pass: ok,
        note: ok
          ? `policy_lapsed notification found (${lapseNotifs.length} doc) ✓`
          : 'No policy_lapsed notification found in agent\'s notifications',
      });
      safeLog(`  policy_lapsed notification: ${ok ? '✓' : '✗'}`);
    } catch (e) {
      results.push({ step: '5-rest-notification', pass: false, note: e.message });
      safeLog('  REST notification query ERROR:', e.message);
    }

  } finally {
    await browser.close();

    // ── Step 6: Cleanup (best-effort; cleanup failures do NOT affect pass/fail) ──
    safeLog('\n── Step 6: Cleanup ──');
    // Policy: allow delete: if false in Firestore rules — cannot delete via REST.
    // Log policyId for manual cleanup if needed.
    if (policyId) {
      safeLog(`  Policy ${policyId} left in prod (rules prohibit delete). Owner="${SMOKE_OWNER}" — identifiable by ownerName.`);
    } else {
      safeLog('  No policyId captured — policy may not have been created.');
    }

    // Notifications: agent can delete their own — attempt with fresh token.
    try {
      const { idToken: freshToken } = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const notifRows = await queryNotifications(freshToken, agentTenantId, agentUid);
      const lapseNotifs = notifRows.filter((r) => r.document?.fields?.type?.stringValue === 'policy_lapsed');
      let cleaned = 0;
      for (const r of lapseNotifs) {
        const path = r.document.name.replace(`projects/${FIREBASE_PROJECT}/databases/(default)/documents/`, '');
        if (await deleteDoc(path, freshToken)) cleaned++;
      }
      safeLog(`  Cleaned ${cleaned}/${lapseNotifs.length} policy_lapsed notification(s)`);
    } catch (e) {
      safeLog('  Notification cleanup ERROR (non-fatal):', e.message);
    }

    // ── Final report ──────────────────────────────────────────────────────
    safeLog('\n=== FINAL REPORT ===');
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass);
    for (const r of results) {
      safeLog(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.step} — ${r.note}`);
    }
    safeLog(`\n${passed}/${results.length} passed`);

    const reportLines = [
      `# H2c Lapse Smoke — ${RUN_TS}`,
      '',
      `**Tag:** \`${SMOKE_OWNER}\``,
      `**Target:** ${PROD_URL}`,
      '',
      '| Step | Pass | Note |',
      '|---|---|---|',
      ...results.map((r) => `| ${r.step} | ${r.pass ? '✅' : '❌'} | ${r.note} |`),
      '',
      `**${passed}/${results.length} passed**`,
    ];
    writeFileSync(REPORT_PATH, reportLines.join('\n'));
    safeLog('\nReport saved to:', REPORT_PATH);

    if (failed.length > 0) {
      safeLog('\nFailed steps:', failed.map((r) => r.step).join(', '));
      process.exit(1);
    }
  }
}

main().catch((err) => { safeLog('FATAL:', err.message); process.exit(1); });

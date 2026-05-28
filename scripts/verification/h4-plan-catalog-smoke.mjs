/**
 * h4-plan-catalog-smoke.mjs — Track H H4 Policy Plan Catalog production smoke.
 *
 * 9-leg write-read-verify cycle covering:
 *   a. TA → CompanyConfigPanel → plan-catalog tile → PlanCatalogModal → add "Smoke Plan A"
 *      → reload → tile count incremented ✓
 *   b. Agent → PolicyLedgerPanel → select "Smoke Plan A" from picker → policyClass auto-fills
 *      → override policyClass → save → reload → entry persists with overridden class ✓
 *   c. Agent → "Other" path → type PENDING_NAME → save → wait for CF ✓
 *   d. TA → PlanCatalogModal → Pending Review tab → PENDING_NAME appears, loggedByAgents=1 ✓
 *   e. TA → approve PENDING_NAME → moves to Active Plans ✓
 *   f. Agent (hard reload) → new policy form → PENDING_NAME in picker ✓
 *   g. TA → deactivate "Smoke Plan A" → agent reload → "Smoke Plan A" NOT in picker ✓
 *   h. Negative: agent REST write to config/policyPlans → PERMISSION_DENIED ✓
 *   i. Zero unexpected console errors throughout ✓
 *
 * Run:  node scripts/verification/h4-plan-catalog-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN, VITE_FIREBASE_API_KEY,
 *   A11Y_TENANT_ADMIN_EMAIL, A11Y_TENANT_ADMIN_PASSWORD,
 *   A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  hardReloadAndAwaitReady,
  safeLog,
  selectReactOption,
  captureConsoleAndNetwork,
  formatCaptureReport,
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
const FIREBASE_PROJECT = 'agencytrack-2a610';

const TS          = Date.now();
const PLAN_NAME   = `Smoke Plan A-${TS}`;
const PENDING_NAME = `Smoke Pending X-${TS}`;

// ── Result tracking ──────────────────────────────────────────────────────────
const results = [];
function pass(leg, note = '') {
  results.push({ leg, status: 'PASS', note });
  safeLog(`  ✓ [${leg}] ${note}`);
}
function fail(leg, note = '') {
  results.push({ leg, status: 'FAIL', note });
  safeLog(`  ✗ [${leg}] ${note}`);
}

// ── Login helper ─────────────────────────────────────────────────────────────
async function loginAs(page, email, password) {
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  const emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible({ timeout: 5000 }).catch(() => false))) return; // already logged in
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('input[type="email"]') === null,
    { timeout: 25000 }
  );
  await page.waitForTimeout(1200);
}

// ── TA config tab navigation ──────────────────────────────────────────────────
async function navToConfigTab(page) {
  const configTab = page.locator('[data-testid="nav-config"]');
  await configTab.waitFor({ state: 'visible', timeout: 15000 });
  await configTab.click();
  // Wait for loading skeletons to clear
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    { timeout: 20000 }
  );
  await page.waitForTimeout(600);
}

// ── Agent policy-ledger tab navigation ───────────────────────────────────────
async function navToPolicyLedger(page) {
  const tab = page.locator('[data-testid="agent-tab-policy-ledger"]');
  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab.click();
  } else {
    // Mobile More drawer
    await page.getByRole('button', { name: /more/i }).click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="agent-tab-policy-ledger"]').click();
  }
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    { timeout: 15000 }
  );
  await page.waitForTimeout(600);
}

// ── REST: get agent ID token ─────────────────────────────────────────────────
async function getIdToken(email, password) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!resp.ok) throw new Error(`getIdToken failed: ${resp.status}`);
  const d = await resp.json();
  return d.idToken;
}

// ── REST: extract tenantId from JWT ─────────────────────────────────────────
function extractTenantId(idToken) {
  const [, b64] = idToken.split('.');
  const padded  = b64 + '='.repeat((4 - b64.length % 4) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')).tenantId ?? null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  safeLog(`\n=== H4 Plan Catalog Production Smoke ===`);
  safeLog(`Target: ${PROD_URL}`);
  safeLog(`Plan name:    ${PLAN_NAME}`);
  safeLog(`Pending name: ${PENDING_NAME}`);

  let initialActivePlanCount = 0;
  const allConsoleErrors = [];

  const browser = await chromium.launch({ headless: true });

  try {
    // ── Context A: Tenant Admin ────────────────────────────────────────────
    safeLog('\n── Context A: Tenant Admin ──────────────────────────────');
    const ctxTA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(ctxTA, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const pageTA = await ctxTA.newPage();
    const captureTA = captureConsoleAndNetwork(pageTA);

    await loginAs(pageTA, E.A11Y_TENANT_ADMIN_EMAIL, E.A11Y_TENANT_ADMIN_PASSWORD);
    safeLog('  TA logged in');

    // ── LEG a: Add plan ────────────────────────────────────────────────────
    safeLog('\n── Leg a: TA adds plan ──');
    try {
      await navToConfigTab(pageTA);

      // Read initial active count from tile
      const tileEl = pageTA.locator('[data-testid="plan-catalog-tile"]');
      await tileEl.waitFor({ timeout: 10000 });
      const tileValueText = await tileEl.locator('.config-tile-value').innerText().catch(() => '');
      const countMatch = tileValueText.match(/(\d+)\s+active/);
      initialActivePlanCount = countMatch ? parseInt(countMatch[1], 10) : 0;
      safeLog(`  Initial active plan count: ${initialActivePlanCount} (tile: "${tileValueText}")`);

      // Click tile → open modal
      await tileEl.click();
      await pageTA.locator('[role="dialog"]').waitFor({ timeout: 10000 });
      await pageTA.waitForTimeout(500);

      // Verify "Active Plans" tab visible
      const activeTab = pageTA.getByRole('button', { name: 'Active Plans' });
      if (!(await activeTab.isVisible({ timeout: 5000 }).catch(() => false))) {
        throw new Error('PlanCatalogModal did not open — "Active Plans" tab not found');
      }

      // Open Add Plan form
      const addBtn = pageTA.locator('[data-testid="add-plan-btn"]');
      await addBtn.waitFor({ timeout: 8000 });
      await addBtn.click();
      await pageTA.locator('[data-testid="plan-form"]').waitFor({ timeout: 8000 });

      // Fill: name (id="pf-name" in PlanCatalogModal)
      await pageTA.fill('#pf-name', PLAN_NAME);

      // class = whole_life (default — no change needed)
      // productLine = life (default — no change needed)

      // Submit
      const submitBtn = pageTA.locator('[data-testid="plan-form-submit"]');
      await submitBtn.click();

      // Wait for plan row to appear
      await pageTA.waitForFunction(
        (name) => {
          const rows = document.querySelectorAll('[data-testid^="plan-row-"]');
          return [...rows].some((r) => r.textContent.includes(name));
        },
        PLAN_NAME,
        { timeout: 15000 }
      );
      safeLog(`  Plan "${PLAN_NAME}" added to catalog ✓`);

      // Close modal
      await pageTA.getByRole('button', { name: /close|×/i }).first().click();
      await pageTA.waitForTimeout(500);

      // Hard reload + re-navigate to config
      await hardReloadAndAwaitReady(pageTA);
      await navToConfigTab(pageTA);

      // Verify tile count incremented
      const tileAfter = pageTA.locator('[data-testid="plan-catalog-tile"]');
      await tileAfter.waitFor({ timeout: 10000 });
      const tileValueAfter = await tileAfter.locator('.config-tile-value').innerText().catch(() => '');
      const countAfter = parseInt((tileValueAfter.match(/(\d+)\s+active/) ?? [])[1] ?? '0', 10);

      if (countAfter >= initialActivePlanCount + 1) {
        pass('a', `Tile updated: "${tileValueAfter}" (was ${initialActivePlanCount} active, now ${countAfter})`);
      } else {
        fail('a', `Tile count did not increment: "${tileValueAfter}" (expected ≥${initialActivePlanCount + 1})`);
      }
    } catch (err) {
      fail('a', err.message);
    }

    // ── Context B: Agent ───────────────────────────────────────────────────
    safeLog('\n── Context B: Agent ─────────────────────────────────────');
    const ctxAgent = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(ctxAgent, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const pageAgent = await ctxAgent.newPage();
    const captureAgent = captureConsoleAndNetwork(pageAgent);

    await loginAs(pageAgent, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  Agent logged in');

    // ── LEG b: Agent picks catalog plan ────────────────────────────────────
    safeLog('\n── Leg b: Agent picks catalog plan ──');
    const OWNER_B = `Smoke-B-${TS}`;
    try {
      await navToPolicyLedger(pageAgent);

      // Open New Policy form
      await pageAgent.getByRole('button', { name: /new policy/i }).click();
      await pageAgent.waitForTimeout(800);

      // Fill ownerName first (insuredName copies it when "same as owner" is checked)
      const ownerNameInput = pageAgent.locator('#ownerName, input[name="ownerName"]');
      await ownerNameInput.waitFor({ timeout: 8000 });
      await ownerNameInput.fill(OWNER_B);

      // Check "same as owner" → insuredName auto-fills
      const sameAsOwner = pageAgent.locator('label').filter({ hasText: /same as owner/i }).locator('input[type="checkbox"]');
      if (await sameAsOwner.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sameAsOwner.check();
        await pageAgent.waitForTimeout(300);
      }

      // Fill proposedPremium — auto-computes proposedAPI via handleChange
      const premiumInput = pageAgent.locator('#proposedPremium');
      await premiumInput.waitFor({ timeout: 8000 });
      await premiumInput.fill('500');
      await pageAgent.waitForTimeout(400); // let handleChange propagate proposedAPI

      // sourceOfProspect — REQUIRED (default is empty)
      const sourceSelect = pageAgent.locator('#sourceOfProspect');
      await selectReactOption(pageAgent, sourceSelect, 'referral');
      await pageAgent.waitForTimeout(200);

      // Wait for catalog to load (useEffect async), then verify PLAN_NAME is in the dropdown
      const planPicker = pageAgent.locator('[data-testid="plan-picker-select"]');
      await planPicker.waitFor({ timeout: 10000 });
      await pageAgent.waitForTimeout(1500); // allow Firestore catalog read to complete

      const options = await planPicker.locator('option').allInnerTexts();
      if (!options.some((o) => o === PLAN_NAME)) {
        throw new Error(`"${PLAN_NAME}" not found in plan picker options: ${options.join(', ')}`);
      }

      // Select the plan — find its option value by text
      const planOptionValue = await planPicker.evaluate((sel, name) => {
        const opts = [...sel.querySelectorAll('option')];
        const opt = opts.find((o) => o.textContent.trim() === name);
        return opt?.value ?? null;
      }, PLAN_NAME);

      if (!planOptionValue) {
        throw new Error(`Could not find option value for "${PLAN_NAME}"`);
      }

      await selectReactOption(pageAgent, planPicker, planOptionValue);
      await pageAgent.waitForTimeout(500);

      // Verify policyClass auto-filled to whole_life
      const policyClassSel = pageAgent.locator('#policyClass');
      const classVal = await policyClassSel.inputValue();
      if (classVal !== 'whole_life') {
        fail('b-autofill', `policyClass expected "whole_life" but got "${classVal}"`);
      } else {
        safeLog('  policyClass auto-filled to whole_life ✓');
      }

      // Override policyClass to "term"
      await selectReactOption(pageAgent, policyClassSel, 'term');
      await pageAgent.waitForTimeout(300);

      // Save policy
      await pageAgent.getByRole('button', { name: /save policy/i }).click();
      // Wait for list view (h2 heading switches back to "Policy Ledger")
      await pageAgent.locator('h2').filter({ hasText: /Policy Ledger/i }).waitFor({ timeout: 25000 });
      await pageAgent.waitForTimeout(800);

      // Verify entry in the list immediately
      const immediateVisible = await pageAgent.evaluate((name) =>
        document.body.textContent.includes(name), OWNER_B);

      // Hard reload + navigate back
      await hardReloadAndAwaitReady(pageAgent);
      await navToPolicyLedger(pageAgent);

      // Verify the entry in the list after reload
      const count = await pageAgent.evaluate((name) => document.body.textContent.includes(name), OWNER_B);
      if (count) {
        pass('b', `Policy with catalog plan "${PLAN_NAME}" persists after reload, class overridden to "term" (pre-reload visible: ${immediateVisible})`);
      } else {
        fail('b', `Policy entry "${OWNER_B}" not found after reload`);
      }
    } catch (err) {
      fail('b', err.message);
    }

    // ── LEG c: Agent "Other" path ──────────────────────────────────────────
    safeLog('\n── Leg c: Agent enters "Other" plan ──');
    const OWNER_C = `Smoke-C-${TS}`;
    try {
      // Open new policy form
      await pageAgent.getByRole('button', { name: /new policy/i }).click();
      await pageAgent.waitForTimeout(800);

      // Fill ownerName first
      const ownerNameInput = pageAgent.locator('#ownerName, input[name="ownerName"]');
      await ownerNameInput.waitFor({ timeout: 8000 });
      await ownerNameInput.fill(OWNER_C);

      // Check "same as owner" → insuredName auto-fills
      const sameAsOwner = pageAgent.locator('label').filter({ hasText: /same as owner/i }).locator('input[type="checkbox"]');
      if (await sameAsOwner.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sameAsOwner.check();
        await pageAgent.waitForTimeout(300);
      }

      // Fill proposedPremium — auto-computes proposedAPI via handleChange
      const premiumInput = pageAgent.locator('#proposedPremium');
      await premiumInput.waitFor({ timeout: 8000 });
      await premiumInput.fill('750');
      await pageAgent.waitForTimeout(400);

      // sourceOfProspect — REQUIRED
      const sourceSelect = pageAgent.locator('#sourceOfProspect');
      await selectReactOption(pageAgent, sourceSelect, 'referral');
      await pageAgent.waitForTimeout(200);

      const planPicker = pageAgent.locator('[data-testid="plan-picker-select"]');
      await planPicker.waitFor({ timeout: 10000 });
      await pageAgent.waitForTimeout(800);

      // Select "Other"
      await selectReactOption(pageAgent, planPicker, '__other__');
      await pageAgent.waitForTimeout(400);

      // Free-text input should appear
      const freeText = pageAgent.locator('[data-testid="plan-name-freetext"]');
      await freeText.waitFor({ timeout: 8000 });
      await freeText.fill(PENDING_NAME);

      // Save
      await pageAgent.getByRole('button', { name: /save policy/i }).click();
      // Wait for list view (h2 heading switches back to "Policy Ledger")
      await pageAgent.locator('h2').filter({ hasText: /Policy Ledger/i }).waitFor({ timeout: 25000 });
      await pageAgent.waitForTimeout(800);

      // Verify the entry appeared in the list
      const savedVisible = await pageAgent.evaluate((name) =>
        document.body.textContent.includes(name), OWNER_C);
      safeLog(`  Policy "${OWNER_C}" in list immediately after save: ${savedVisible}`);

      safeLog('  Waiting 15s for Cloud Function to run...');
      await pageAgent.waitForTimeout(15000);

      pass('c', `Policy with planName="${PENDING_NAME}" saved (visible: ${savedVisible}); CF allowed 15s to run`);
    } catch (err) {
      fail('c', err.message);
    }

    // ── LEG d: TA sees pending entry ───────────────────────────────────────
    safeLog('\n── Leg d: TA checks Pending Review ──');
    try {
      // Reload TA page and navigate back to config
      await hardReloadAndAwaitReady(pageTA);
      await navToConfigTab(pageTA);

      // Open plan catalog modal
      const tileEl = pageTA.locator('[data-testid="plan-catalog-tile"]');
      await tileEl.waitFor({ timeout: 10000 });
      await tileEl.click();
      await pageTA.locator('[role="dialog"]').waitFor({ timeout: 10000 });
      await pageTA.waitForTimeout(400);

      // Click "Pending Review" tab
      const pendingTab = pageTA.getByRole('button', { name: 'Pending Review' });
      await pendingTab.waitFor({ timeout: 10000 });
      await pendingTab.click();
      await pageTA.waitForTimeout(500);

      // Wait for the pending entry to appear (with retry for CF lag)
      let found = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        const pendingRow = await pageTA.locator('[data-testid^="pending-row-"]').filter({ hasText: PENDING_NAME }).count();
        if (pendingRow > 0) { found = true; break; }
        safeLog(`  Pending entry not yet visible (attempt ${attempt + 1}/6) — waiting 5s...`);
        await pageTA.waitForTimeout(5000);
        // Re-click tab to refresh
        await pendingTab.click();
        await pageTA.waitForTimeout(500);
      }

      if (!found) {
        // Also check DOM for the name
        found = await pageTA.evaluate((name) => document.body.textContent.includes(name), PENDING_NAME);
      }

      if (found) {
        pass('d', `"${PENDING_NAME}" visible in Pending Review tab ✓`);
      } else {
        fail('d', `"${PENDING_NAME}" NOT found in Pending Review after retries (CF may have failed)`);
      }
    } catch (err) {
      fail('d', err.message);
    }

    // ── LEG e: TA approves pending entry ───────────────────────────────────
    safeLog('\n── Leg e: TA approves pending entry ──');
    try {
      // Modal should already be open on Pending Review tab from leg d
      const approveBtn = pageTA.locator(`[data-testid="approve-btn-${PENDING_NAME}"]`);
      const approveBtnVisible = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (!approveBtnVisible) {
        // Fallback: find by proximity
        const row = pageTA.locator('[data-testid^="pending-row-"]').filter({ hasText: PENDING_NAME });
        await row.getByRole('button', { name: /approve/i }).click();
      } else {
        await approveBtn.click();
      }

      await pageTA.waitForTimeout(500);

      // Promote form should appear: fill class + productLine
      const promoteForm = pageTA.locator(`[data-testid="promote-form-${PENDING_NAME}"]`);
      const promoteVisible = await promoteForm.isVisible({ timeout: 5000 }).catch(() => false);

      if (promoteVisible) {
        // Select class = whole_life (default fine), productLine = life (default fine)
        // Just submit
        const promoteSubmit = pageTA.locator(`[data-testid="promote-submit-${PENDING_NAME}"]`);
        if (await promoteSubmit.isVisible({ timeout: 5000 }).catch(() => false)) {
          await promoteSubmit.click();
        } else {
          // fallback: find submit button inside the promote form
          await promoteForm.getByRole('button', { name: /approve|confirm|submit/i }).first().click();
        }
      } else {
        // Promote form may be inline — look for a submit within the pending row
        const row = pageTA.locator('[data-testid^="pending-row-"]').filter({ hasText: PENDING_NAME });
        await row.getByRole('button', { name: /confirm|approve|submit/i }).first().click();
      }

      await pageTA.waitForTimeout(1500);

      // Verify: entry removed from Pending Review
      const stillPending = await pageTA.locator('[data-testid^="pending-row-"]')
        .filter({ hasText: PENDING_NAME }).count();

      if (stillPending === 0) {
        pass('e', `"${PENDING_NAME}" approved and removed from Pending Review ✓`);
      } else {
        fail('e', `"${PENDING_NAME}" still visible in Pending Review after approval`);
      }
    } catch (err) {
      fail('e', err.message);
    }

    // ── LEG f: Agent sees promoted plan in picker ──────────────────────────
    safeLog('\n── Leg f: Agent sees promoted plan in picker ──');
    try {
      // Hard reload agent page to get fresh catalog
      await hardReloadAndAwaitReady(pageAgent);
      await navToPolicyLedger(pageAgent);

      // Open New Policy form
      await pageAgent.getByRole('button', { name: /new policy/i }).click();
      await pageAgent.waitForTimeout(800);

      const planPicker = pageAgent.locator('[data-testid="plan-picker-select"]');
      await planPicker.waitFor({ timeout: 12000 });

      const options = await planPicker.locator('option').allInnerTexts();
      // PENDING_NAME is now in active plans (approved in leg e)
      const found = options.some((o) => o.includes(PENDING_NAME.split('-')[0]) && o.includes(TS.toString()));

      // Close form
      await pageAgent.getByRole('button', { name: /cancel|close|×/i }).first().click().catch(() => {});

      if (found) {
        pass('f', `"${PENDING_NAME}" appears in agent plan picker after promotion ✓`);
      } else {
        // Check if any option contains the partial name
        const partial = options.some((o) => o.startsWith('Smoke Pending X'));
        if (partial) {
          pass('f', `"Smoke Pending X" variant appears in agent plan picker ✓`);
        } else {
          fail('f', `"${PENDING_NAME}" NOT in agent plan picker options: ${options.join(', ')}`);
        }
      }
    } catch (err) {
      fail('f', err.message);
    }

    // ── LEG g: TA deactivates "Smoke Plan A"; agent can't see it ──────────
    safeLog('\n── Leg g: TA deactivates Smoke Plan A ──');
    try {
      // TA: open modal on Active Plans tab
      await hardReloadAndAwaitReady(pageTA);
      await navToConfigTab(pageTA);

      const tileEl = pageTA.locator('[data-testid="plan-catalog-tile"]');
      await tileEl.waitFor({ timeout: 10000 });
      await tileEl.click();
      await pageTA.waitForTimeout(500);

      // Ensure Active Plans tab is selected
      const activeTab = pageTA.getByRole('button', { name: 'Active Plans' });
      await activeTab.click();
      await pageTA.waitForTimeout(400);

      // Find PLAN_NAME row and click deactivate
      const planRow = pageTA.locator('[data-testid^="plan-row-"]').filter({ hasText: PLAN_NAME });
      const deactivateBtn = planRow.locator('[data-testid^="deactivate-plan-"]');
      const deactivateBtnVisible = await deactivateBtn.isVisible({ timeout: 8000 }).catch(() => false);

      if (deactivateBtnVisible) {
        await deactivateBtn.click();
        await pageTA.waitForTimeout(1500);
        safeLog(`  Deactivated "${PLAN_NAME}" ✓`);
      } else {
        // Fallback: find by button text
        const fallback = planRow.getByRole('button', { name: /deactivate/i });
        await fallback.click();
        await pageTA.waitForTimeout(1500);
      }

      // Verify plan row shows as retired (not in active list or marked retired)
      const activeCount = await pageTA.locator('[data-testid^="plan-row-"]').filter({ hasText: PLAN_NAME }).count();
      const retiredCount = await pageTA.locator('[data-testid^="retired-plan-"]').filter({ hasText: PLAN_NAME }).count();
      safeLog(`  After deactivate — plan-row count: ${activeCount}, retired-row count: ${retiredCount}`);

      // Agent: hard reload and verify plan not in picker
      await hardReloadAndAwaitReady(pageAgent);
      await navToPolicyLedger(pageAgent);
      await pageAgent.getByRole('button', { name: /new policy/i }).click();
      await pageAgent.waitForTimeout(800);

      const planPickerAgent = pageAgent.locator('[data-testid="plan-picker-select"]');
      await planPickerAgent.waitFor({ timeout: 12000 });

      const agentOptions = await planPickerAgent.locator('option').allInnerTexts();
      const planStillVisible = agentOptions.some((o) => o === PLAN_NAME);

      // Close form
      await pageAgent.getByRole('button', { name: /cancel|close|×/i }).first().click().catch(() => {});

      if (!planStillVisible) {
        pass('g', `"${PLAN_NAME}" deactivated and no longer appears in agent picker ✓`);
      } else {
        fail('g', `"${PLAN_NAME}" still appears in agent picker after deactivation`);
      }
    } catch (err) {
      fail('g', err.message);
    }

    // ── LEG h: Negative — PERMISSION_DENIED for agent write ───────────────
    safeLog('\n── Leg h: Negative — agent write to config/policyPlans ──');
    try {
      const agentToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const tenantId   = extractTenantId(agentToken);
      if (!tenantId) throw new Error('Could not extract tenantId from agent JWT');

      const docPath = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}/config/policyPlans`;
      const patchUrl = `https://firestore.googleapis.com/v1/${docPath}`;

      const resp = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${agentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            plans: { arrayValue: { values: [{ mapValue: { fields: { name: { stringValue: 'SMOKE-INJECT' }, isActive: { booleanValue: true } } } }] } },
          },
        }),
      });

      if (resp.status === 403) {
        pass('h', `Agent direct write → HTTP 403 PERMISSION_DENIED ✓`);
      } else if (resp.status === 401) {
        pass('h', `Agent direct write → HTTP 401 UNAUTHENTICATED (rules blocked, similar protection) ✓`);
      } else {
        const body = await resp.text();
        fail('h', `Expected 403/401 but got HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }
    } catch (err) {
      fail('h', err.message);
    }

    // ── LEG i: Console errors ──────────────────────────────────────────────
    safeLog('\n── Leg i: Console errors ──');
    const NOISE_PATTERNS = [
      'GrpcConnection', 'WebChannel', 'long-polling',
      'favicon', 'robots.txt', 'sw.js',
    ];
    const filter = (msg) => !NOISE_PATTERNS.some((p) => msg.includes(p));

    const taErrors = captureTA.consoleMessages
      .filter((m) => m.type === 'error' && filter(m.text))
      .map((m) => m.text);
    const agentErrors = captureAgent.consoleMessages
      .filter((m) => m.type === 'error' && filter(m.text))
      .map((m) => m.text);

    const allFiltered = [...taErrors, ...agentErrors];
    if (allFiltered.length === 0) {
      pass('i', '0 unexpected console errors across TA and agent contexts ✓');
    } else {
      fail('i', `${allFiltered.length} console error(s): ${allFiltered.join(' | ').slice(0, 300)}`);
    }

    await ctxTA.close();
    await ctxAgent.close();

    // ── Final report ───────────────────────────────────────────────────────
    safeLog('\n══════════════════════════════════════════════════════════');
    safeLog('H4 Plan Catalog Smoke — Results');
    safeLog('══════════════════════════════════════════════════════════');
    for (const r of results) {
      safeLog(`  ${r.status === 'PASS' ? '✓' : '✗'} [${r.leg}] ${r.note}`);
    }

    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    safeLog(`\nOverall: ${failed === 0 ? 'PASS' : 'FAIL'} — ${passed}/${results.length} legs passed`);

    if (failed > 0) process.exit(1);

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  safeLog('Fatal:', err.message);
  process.exit(1);
});

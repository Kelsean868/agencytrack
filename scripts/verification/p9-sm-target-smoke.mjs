/**
 * p9-sm-target-smoke.mjs — Production smoke for Phase 9 SM Target goals layer (PR #381).
 *
 * Legs:
 *   A: SM sets SM Target (api=600000, apps=90) → save → reload → persists
 *   B: Agent dashboard Goals → "SM Target" tier visible in GapAnalysisPanel with actual value
 *   C: SM GoalsPanel Goal Cascade → "SM Target" shows actual value (not "Not set")
 *   D: REST rule negatives — agent write → 403; SM writes other uid → 403; SM writes own → 200
 *   E: Zero console errors across all legs
 *   Cleanup: Reset SM Target to 0/0 via UI
 *
 * Run: node scripts/verification/p9-sm-target-smoke.mjs
 */

import { chromium as _chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  safeLog,
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

const PROD_URL    = 'https://agencytrack.vercel.app';
const PROJECT_ID  = 'agencytrack-2a610';
const TENANT_ID   = 'tatillife_south';
const SM_UID      = 'da0XaHhB4wTYlXDnQmAJ6TRIPTn1';
const YEAR        = new Date().getFullYear();
const SM_DOC_ID   = `${SM_UID}_${YEAR}`;
const OTHER_DOC_ID = `other-fake-uid-smoke_${YEAR}`;

// Sentinel test values for Leg A (smoke does NOT collide with real production data)
const TEST_API  = 600000;
const TEST_APPS = 90;

const results = [];
let passed = 0;
let failed = 0;

function pass(leg, note = '') {
  results.push({ leg, status: 'PASS', note });
  safeLog(`  ✓ [${leg}] ${note}`);
  passed++;
}
function fail(leg, note = '') {
  results.push({ leg, status: 'FAIL', note });
  safeLog(`  ✗ [${leg}] ${note}`);
  failed++;
}

// ── Firebase Auth REST — get an ID token for a user ─────────────────────────
async function getIdToken(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`Auth REST failed: ${res.status}`);
  const data = await res.json();
  return data.idToken;
}

// ── Firestore REST — PATCH a doc with a simple field ────────────────────────
async function firestorePatch(idToken, docPath, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const body = { fields };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  return res.status;
}

// ── Navigation helpers ───────────────────────────────────────────────────────
async function loginAs(page, email, password) {
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  const emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible({ timeout: 8000 }).catch(() => false))) return;
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('input[type="email"]') === null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1500);
}

async function clickManagerNavItem(page, label) {
  // Desktop sidebar
  const sidebarBtn = page.locator('nav[aria-label="Primary navigation"] button')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .first();
  if (await sidebarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sidebarBtn.click();
    await page.waitForTimeout(600);
    return;
  }
  // Mobile: try bottom nav directly
  const bottomItem = page.locator(`[data-testid^="bottomnav-"]:has-text("${label}")`).first();
  if (await bottomItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bottomItem.click();
    await page.waitForTimeout(600);
    return;
  }
  // Mobile "More" drawer
  const more = page.locator('[data-testid="bottomnav-more"]');
  if (await more.isVisible({ timeout: 2000 }).catch(() => false)) {
    await more.click();
    await page.waitForTimeout(500);
    const drawer = page.locator('nav[aria-label="More navigation options"]');
    await drawer.waitFor({ timeout: 4000 });
    await drawer.locator(`button:has-text("${label}")`).first().click();
    await page.waitForTimeout(600);
  }
}

async function clickGoalsSubTab(page, label) {
  const tab = page.locator(`[role="tab"]:has-text("${label}")`).first();
  await tab.waitFor({ timeout: 10000 });
  await tab.click();
  await page.waitForTimeout(500);
}

async function fillSmTargetForm(page, api, apps) {
  // The GoalLevelForm has "Annual API (TTD)" and "Annual Apps" inputs
  const inputs = page.locator('.card input[type="number"]');
  const apiInput  = inputs.first();
  const appsInput = inputs.nth(1);
  await apiInput.waitFor({ timeout: 8000 });
  await apiInput.fill(String(api));
  await appsInput.fill(String(apps));
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  safeLog(`\n══════════════════════════════════════════════════════════`);
  safeLog(`Phase 9 SM Target — Production Smoke  (PR #381)`);
  safeLog(`Target: ${PROD_URL}`);
  safeLog(`SM UID: [REDACTED — da0X…]  Year: ${YEAR}`);
  safeLog(`══════════════════════════════════════════════════════════\n`);

  const browser = await _chromium.launch({ headless: true });
  const consoleErrors = [];

  try {
    // ── SM context ──────────────────────────────────────────────────────────
    const ctxSm = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setupBypassSession(ctxSm, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const smPage = await ctxSm.newPage();
    const smCapture = captureConsoleAndNetwork(smPage);
    smPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[SM] ${msg.text()}`);
    });

    safeLog('── Leg A: SM sets SM Target → save → reload → persists ──');
    try {
      await loginAs(smPage, E.A11Y_SALES_MANAGER_EMAIL, E.A11Y_SALES_MANAGER_PASSWORD);
      safeLog('  SM logged in');

      await clickManagerNavItem(smPage, 'Goals');
      await smPage.waitForSelector('[role="tablist"] [role="tab"]', { timeout: 15000 });

      // SM Target tab should be visible
      const smTabVisible = await smPage.locator('[role="tab"]:has-text("SM Target")').isVisible({ timeout: 5000 }).catch(() => false);
      if (!smTabVisible) throw new Error('SM Target tab not visible for sales_manager');

      await clickGoalsSubTab(smPage, 'SM Target');

      // Save original values for cleanup
      const inputs = smPage.locator('.card input[type="number"]');
      await inputs.first().waitFor({ timeout: 8000 });
      const origApi  = await inputs.first().inputValue().catch(() => '0');
      const origApps = await inputs.nth(1).inputValue().catch(() => '0');
      safeLog(`  Original values: api="${origApi}", apps="${origApps}"`);

      // Fill test sentinel values
      await fillSmTargetForm(smPage, TEST_API, TEST_APPS);

      // Save
      const saveBtn = smPage.locator('button:has-text("Save SM Target")').first();
      await saveBtn.waitFor({ timeout: 5000 });
      await saveBtn.click();

      // Wait for save to complete (button leaves "Saving…" state)
      await smPage.waitForFunction(
        () => !document.querySelector('button')?.textContent?.includes('Saving'),
        { timeout: 12000 }
      );
      safeLog('  Saved SM Target');

      // Hard reload
      await smPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(smPage, 20000);
      await smPage.waitForTimeout(1000);

      // Navigate back
      await clickManagerNavItem(smPage, 'Goals');
      await smPage.waitForSelector('[role="tablist"] [role="tab"]', { timeout: 15000 });
      await clickGoalsSubTab(smPage, 'SM Target');

      // Verify read-back
      const readApi  = await smPage.locator('.card input[type="number"]').first().inputValue({ timeout: 8000 });
      const readApps = await smPage.locator('.card input[type="number"]').nth(1).inputValue({ timeout: 5000 });
      safeLog(`  Read-back: api="${readApi}", apps="${readApps}"`);

      if (parseFloat(readApi) !== TEST_API)   throw new Error(`API read-back mismatch: expected ${TEST_API}, got ${readApi}`);
      if (parseFloat(readApps) !== TEST_APPS) throw new Error(`Apps read-back mismatch: expected ${TEST_APPS}, got ${readApps}`);

      pass('A', `SM Target save + reload persists (api=${TEST_API}, apps=${TEST_APPS})`);

      // Stash cleanup values
      smPage._origApi  = origApi;
      smPage._origApps = origApps;
    } catch (e) {
      fail('A', `SM Target write-read-verify: ${e.message}`);
    }

    safeLog('\n── Leg C: SM GoalsPanel Goal Cascade shows SM Target (not "Not set") ──');
    try {
      // Still on SM session — navigate to Goals, check Goal Cascade panel
      await clickManagerNavItem(smPage, 'Goals');
      await smPage.waitForSelector('[role="tablist"] [role="tab"]', { timeout: 15000 });

      // Wait for hierarchy to load (GapAnalysisPanel loading skeletons to disappear)
      await smPage.waitForFunction(
        () => document.querySelectorAll('.animate-pulse').length === 0,
        { timeout: 15000 }
      );
      await smPage.waitForTimeout(500);

      const bodyText = await smPage.evaluate(() => document.body.textContent ?? '');

      if (!bodyText.includes('SM Target')) {
        throw new Error('"SM Target" label not found in GoalsPanel Goal Cascade');
      }

      // "Not set" should NOT appear for the SM tier when a target has been set
      // (smTierMissing = false when salesManagerTarget doc exists)
      // Check: SM Target label is present AND is NOT immediately followed by "Not set"
      const smTargetNotSet = await smPage.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('p'));
        let smTargetEl = null;
        for (const el of labels) {
          if ((el.textContent ?? '').trim() === 'SM Target') { smTargetEl = el; break; }
        }
        if (!smTargetEl) return { found: false };
        // Find the sibling <p> that shows the target value or "Not set"
        const row = smTargetEl.closest('div');
        const notSetEl = row?.querySelector('p:last-child');
        return { found: true, valueText: notSetEl?.textContent?.trim() };
      });

      safeLog(`  SM Target row found: ${smTargetNotSet.found}, value text: "${smTargetNotSet.valueText}"`);

      if (!smTargetNotSet.found) throw new Error('"SM Target" layer label not found in Goal Cascade');
      if (smTargetNotSet.valueText === 'Not set') {
        throw new Error('Goal Cascade shows "Not set" for SM Target even though target was saved in Leg A');
      }

      pass('C', `GoalsPanel Goal Cascade shows SM Target with actual value (not "Not set")`);
    } catch (e) {
      fail('C', `GoalsPanel Goal Cascade SM tier: ${e.message}`);
    }

    // ── Agent context ─────────────────────────────────────────────────────────
    safeLog('\n── Leg B: Agent dashboard Goals → SM Target tier visible ──');
    const ctxAgent = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setupBypassSession(ctxAgent, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    const agentPage = await ctxAgent.newPage();
    agentPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[Agent] ${msg.text()}`);
    });

    try {
      await loginAs(agentPage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      safeLog('  Agent logged in');

      // Navigate to Goals tab in agent dashboard
      const goalsTab = agentPage.locator('[data-testid="agent-tab-goals"], [role="tab"]:has-text("Goals"), button:has-text("Goals")').first();
      if (await goalsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await goalsTab.click();
        await agentPage.waitForTimeout(1000);
      } else {
        // Try sidebar/nav
        const sideNav = agentPage.locator('nav button:has-text("Goals")').first();
        if (await sideNav.isVisible({ timeout: 3000 }).catch(() => false)) {
          await sideNav.click();
          await agentPage.waitForTimeout(1000);
        }
      }

      // Wait for GapAnalysisPanel skeletons to clear
      await agentPage.waitForFunction(
        () => document.querySelectorAll('.animate-pulse').length === 0,
        { timeout: 15000 }
      );
      await agentPage.waitForTimeout(500);

      const agentBody = await agentPage.evaluate(() => document.body.textContent ?? '');

      if (!agentBody.includes('SM Target')) {
        throw new Error('"SM Target" tier not found in agent dashboard gap analysis');
      }

      // Verify it shows actual value (TTD amount), not "Not set"
      const agentSmRow = await agentPage.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('p'));
        for (const el of labels) {
          if ((el.textContent ?? '').trim() === 'SM Target') {
            const row = el.closest('div');
            const valueEl = row?.querySelector('p:last-child');
            return { found: true, valueText: valueEl?.textContent?.trim() };
          }
        }
        return { found: false };
      });

      safeLog(`  Agent SM Target row: found=${agentSmRow.found}, value="${agentSmRow.valueText}"`);

      if (!agentSmRow.found) throw new Error('"SM Target" label not found in agent dashboard GapAnalysisPanel');
      if (agentSmRow.valueText === 'Not set') {
        throw new Error('Agent sees "Not set" for SM Target — smUid not resolved in AgentDashboard getGoalHierarchy call');
      }

      pass('B', `Agent dashboard Gap Analysis shows SM Target row with actual value`);
    } catch (e) {
      fail('B', `Agent dashboard SM tier: ${e.message}`);
    }

    // ── Leg D: REST rule negatives ───────────────────────────────────────────
    safeLog('\n── Leg D: Firestore rule negatives (REST) ──');
    const smDocPath   = `tenants/${TENANT_ID}/salesManagerGoals/${SM_DOC_ID}`;
    const otherDocPath = `tenants/${TENANT_ID}/salesManagerGoals/${OTHER_DOC_ID}`;
    const testField   = { smokeTest: { booleanValue: true } };

    try {
      // D1: Agent tries to write to SM doc → expect 403
      const agentToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const d1Status = await firestorePatch(agentToken, smDocPath, testField);
      safeLog(`  D1 agent→SM doc: HTTP ${d1Status} (expect 403)`);
      if (d1Status === 403) pass('D1', `Agent write to salesManagerGoals → 403 DENIED`);
      else fail('D1', `Agent write to salesManagerGoals: expected 403, got ${d1Status}`);
    } catch (e) {
      fail('D1', `Agent REST test error: ${e.message}`);
    }

    try {
      // D2: SM writes another uid's doc → expect 403
      const smToken = await getIdToken(E.A11Y_SALES_MANAGER_EMAIL, E.A11Y_SALES_MANAGER_PASSWORD);
      const d2Status = await firestorePatch(smToken, otherDocPath, testField);
      safeLog(`  D2 SM→other-uid doc: HTTP ${d2Status} (expect 403)`);
      if (d2Status === 403) pass('D2', `SM write to another uid's doc → 403 DENIED`);
      else fail('D2', `SM write to other uid doc: expected 403, got ${d2Status}`);
    } catch (e) {
      fail('D2', `SM→other REST test error: ${e.message}`);
    }

    try {
      // D3: SM writes own doc → expect 200
      const smToken = await getIdToken(E.A11Y_SALES_MANAGER_EMAIL, E.A11Y_SALES_MANAGER_PASSWORD);
      const d3Status = await firestorePatch(smToken, smDocPath, { smokeTestPassed: { booleanValue: true } });
      safeLog(`  D3 SM→own doc: HTTP ${d3Status} (expect 200)`);
      if (d3Status === 200) pass('D3', `SM write to own doc → 200 ALLOWED`);
      else fail('D3', `SM write to own doc: expected 200, got ${d3Status}`);
    } catch (e) {
      fail('D3', `SM→own REST test error: ${e.message}`);
    }

    // ── Leg E: Console errors ─────────────────────────────────────────────────
    safeLog('\n── Leg E: Console errors ──');
    const realErrors = consoleErrors.filter(e =>
      !/_vercel|favicon|workbox|sw\.js|Failed to load resource.*404/i.test(e)
    );
    safeLog(`  Raw console errors: ${consoleErrors.length}, filtered: ${realErrors.length}`);
    if (realErrors.length === 0) {
      pass('E', 'Zero console errors across all legs');
    } else {
      fail('E', `${realErrors.length} console error(s):\n    ${realErrors.slice(0, 5).join('\n    ')}`);
    }

    // ── Cleanup: reset SM Target to original values ───────────────────────────
    safeLog('\n── Cleanup: reset SM Target ──');
    try {
      await clickManagerNavItem(smPage, 'Goals');
      await smPage.waitForSelector('[role="tablist"] [role="tab"]', { timeout: 15000 });
      await clickGoalsSubTab(smPage, 'SM Target');

      const resetApi  = smPage._origApi  || '0';
      const resetApps = smPage._origApps || '0';
      await fillSmTargetForm(smPage, resetApi, resetApps);

      const saveBtn = smPage.locator('button:has-text("Save SM Target")').first();
      await saveBtn.click();
      await smPage.waitForFunction(
        () => !Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Saving')),
        { timeout: 10000 }
      );
      safeLog(`  SM Target reset to api="${resetApi}", apps="${resetApps}"`);
    } catch (e) {
      safeLog(`  Cleanup WARN: ${e.message} — SM target left at test values. Reset manually if needed.`);
    }

    await ctxSm.close();
    await ctxAgent.close();

  } finally {
    await browser.close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  safeLog(`\n${'═'.repeat(60)}`);
  safeLog(`Phase 9 SM Target Smoke: ${passed}/${passed + failed} passed, ${failed} failed`);
  if (failed > 0) {
    safeLog('\nFailed legs:');
    for (const r of results) {
      if (r.status === 'FAIL') safeLog(`  ${r.leg}: ${r.note}`);
    }
  }
  safeLog(`${'═'.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Smoke script crashed:', e.message);
  process.exit(1);
});

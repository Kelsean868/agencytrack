/**
 * goals-rule-smoke.mjs — Preview smoke for PR #382: agent goals write-rule fix.
 *
 * Legs:
 *   A: Agent → Career Portal → Goals → Edit My Goals → save → reload → values persist
 *   B: REST PATCH agent's OWN goals doc → expect 200 (rule now allows agent write)
 *   C: REST PATCH ANOTHER agent's goals doc → expect 403 (cross-uid write blocked)
 *   D: Zero console errors on the personal-commitment save path
 *   Cleanup: REST snapshot-before + restore in finally{} (smoke-discipline Pattern B)
 *
 * Run: node scripts/verification/goals-rule-smoke.mjs
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

const PREVIEW_HOST = 'agencytrack.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;
const PROJECT_ID   = 'agencytrack-2a610';
const TENANT_ID    = 'tatillife_south';

// Sentinel test values — must exceed company minimums (API floor is tenure-band based,
// flat fallback is 200k; apps minimum is ~24/yr; persistency minimum is ~80%).
// Use values well above any realistic floor to avoid minimum-validation failures.
const TEST_API         = 600000;
const TEST_APPS        = 120;
const TEST_PERSISTENCY = 90;

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

// ── Firebase Auth REST ────────────────────────────────────────────────────────
async function getIdTokenAndUid(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`Auth REST failed: HTTP ${res.status}`);
  const data = await res.json();
  return { idToken: data.idToken, uid: data.localId };
}

// ── Firestore REST helpers ────────────────────────────────────────────────────
function docUrl(docPath) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
}

async function firestoreGetDoc(idToken, docPath) {
  const res = await fetch(docUrl(docPath), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${docPath}: HTTP ${res.status}`);
  return res.json();
}

async function firestorePatch(idToken, docPath, fields) {
  const res = await fetch(docUrl(docPath), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields }),
  });
  return res.status;
}

async function firestoreDeleteDoc(idToken, docPath) {
  const res = await fetch(docUrl(docPath), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return res.status;
}

// ── Smoke cleanup (always runs in finally) ────────────────────────────────────
async function cleanupSmoke(agentToken, agentDocPath, otherDocPath, origSnapshot, smokeRunId) {
  safeLog('\n── Cleanup (finally) ──');
  let ok = true;

  try {
    if (origSnapshot === null) {
      const st = await firestoreDeleteDoc(agentToken, agentDocPath);
      safeLog(`  agent goals doc DELETE: HTTP ${st} (was not pre-existing)`);
    } else {
      const origFields = origSnapshot.fields ?? {};
      const fieldsToRemove = ['smokeField'];
      const maskParams = [
        ...Object.keys(origFields),
        ...fieldsToRemove,
      ].map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
      const restoreUrl = `${docUrl(agentDocPath)}?${maskParams}`;
      const restoreRes = await fetch(restoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentToken}` },
        body: JSON.stringify({ fields: origFields }),
      });
      safeLog(`  agent goals doc RESTORE: HTTP ${restoreRes.status}`);
      if (restoreRes.status !== 200) throw new Error(`Restore PATCH failed: HTTP ${restoreRes.status}`);

      const afterSnap = await firestoreGetDoc(agentToken, agentDocPath);
      if (afterSnap?.fields?.smokeField) {
        throw new Error('smokeField still present after restore');
      }
      safeLog(`  agent goals doc verify: ✓`);
    }

    // Delete other-uid doc in case Leg C unexpectedly allowed the write
    const otherSt = await firestoreDeleteDoc(agentToken, otherDocPath);
    safeLog(`  other-uid goals doc DELETE: HTTP ${otherSt} (404 = correctly denied in Leg C)`);

  } catch (e) {
    ok = false;
    safeLog(`  Cleanup FAILED: ${e.message}  SMOKE_RUN_ID=${smokeRunId} — restore agent goals doc manually`);
  }

  return ok;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
async function loginAs(page, baseUrl, email, password) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  const emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible({ timeout: 10000 }).catch(() => false))) {
    throw new Error('Login form not visible after navigation');
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('input[type="email"]') === null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1500);
}

async function navigateToCareerPortal(page) {
  // Wait for the primary nav to be attached before trying to interact
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
  await page.waitForTimeout(500);

  // Desktop sidebar — prefer text match (consistent with clickManagerNavItem pattern)
  const sidebarCareer = page.locator('nav[aria-label="Primary navigation"] button')
    .filter({ hasText: /^\s*Career\s*$/ })
    .first();
  if (await sidebarCareer.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sidebarCareer.click();
    await page.waitForTimeout(800);
    return;
  }

  // Fallback: testid-based (in case label text is hidden in collapsed sidebar)
  const byTestId = page.locator('[data-testid="agent-tab-career"]').first();
  if (await byTestId.isVisible({ timeout: 2000 }).catch(() => false)) {
    await byTestId.click();
    await page.waitForTimeout(800);
    return;
  }

  // Mobile: More drawer
  const more = page.locator('[data-testid="bottomnav-more"]');
  if (await more.isVisible({ timeout: 2000 }).catch(() => false)) {
    await more.click();
    await page.waitForTimeout(500);
    const drawer = page.locator('nav[aria-label="More navigation options"]');
    await drawer.waitFor({ timeout: 4000 });
    await drawer.locator('button').filter({ hasText: /Career/ }).first().click();
    await page.waitForTimeout(800);
    return;
  }

  // Diagnostic: dump visible nav buttons to help diagnose
  const navBtns = await page.locator('nav[aria-label="Primary navigation"] button').allTextContents().catch(() => []);
  throw new Error(`Cannot locate Career Portal nav item. Primary nav buttons: [${navBtns.join(', ')}]`);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const SMOKE_RUN_ID = `goalsrule_${Date.now()}`;

  safeLog(`\n══════════════════════════════════════════════════════════`);
  safeLog(`Goals Rule Fix — Preview Smoke  (PR #382)`);
  safeLog(`Target: ${PREVIEW_URL}`);
  safeLog(`SMOKE_RUN_ID: ${SMOKE_RUN_ID}`);
  safeLog(`══════════════════════════════════════════════════════════\n`);

  // Get agent token + UID (needed for cleanup pre-fetch and REST probes)
  const { idToken: agentToken, uid: agentUid } =
    await getIdTokenAndUid(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);

  safeLog(`Agent UID: [obtained — redacted]`);

  const agentDocPath  = `tenants/${TENANT_ID}/goals/${agentUid}`;
  const otherDocPath  = `tenants/${TENANT_ID}/goals/smoke-other-uid-${SMOKE_RUN_ID}`;

  // Pre-fetch original doc snapshot before any writes (Pattern B)
  const origSnapshot = await firestoreGetDoc(agentToken, agentDocPath).catch(() => null);
  safeLog(`Pre-test snapshot: ${origSnapshot ? 'doc exists (will restore)' : 'doc does not exist (will delete)'}`);

  const browser = await _chromium.launch({ headless: true });
  let ctx;

  try {
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    // Production URL — no Vercel bypass needed
    const page = await ctx.newPage();
    const capture = captureConsoleAndNetwork(page);

    // Track console errors specifically on the save path
    const savePathErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') savePathErrors.push(msg.text());
    });

    // ── Leg A: UI write-read-verify ─────────────────────────────────────────
    safeLog('── Leg A: Agent Career Portal → Goals → Edit → save → reload → verify ──');
    try {
      await loginAs(page, PREVIEW_URL, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      safeLog('  Agent logged in');

      await navigateToCareerPortal(page);
      safeLog('  Career Portal loaded');

      // Wait for Goals Overview card
      await page.waitForSelector('.card', { timeout: 15000 });
      await page.waitForTimeout(500);

      // Click "Edit My Goals"
      const editBtn = page.locator('button:has-text("Edit My Goals")').first();
      await editBtn.waitFor({ timeout: 10000 });
      await editBtn.click();
      await page.waitForTimeout(400);

      // Fill in sentinel values — three inputs appear in the table rows (API, Apps, Persistency)
      // They render as <input type="number">
      const inputs = page.locator('table input[type="number"]');
      const count = await inputs.count();
      safeLog(`  Found ${count} goal input(s) in table`);

      if (count < 1) throw new Error('No goal inputs found in edit mode');

      // API (first input)
      await inputs.nth(0).fill(String(TEST_API));
      if (count >= 2) await inputs.nth(1).fill(String(TEST_APPS));
      if (count >= 3) await inputs.nth(2).fill(String(TEST_PERSISTENCY));

      // Save
      const saveBtn = page.locator('button:has-text("Save")').first();
      await saveBtn.waitFor({ timeout: 5000 });
      await saveBtn.click();

      // Wait for save to complete — button leaves "Saving…" state
      await page.waitForFunction(
        () => {
          const btns = Array.from(document.querySelectorAll('button'));
          return !btns.some(b => (b.textContent ?? '').includes('Saving'));
        },
        { timeout: 15000 }
      );

      // Check for ANY save error text rendered by the component
      // (permission-denied and minimum-validation errors appear as UI text, not console.error)
      await page.waitForTimeout(800);  // allow React state update to render
      const saveErrorEl = await page.locator('p.text-red-500').first().textContent({ timeout: 500 }).catch(() => null);
      if (saveErrorEl && saveErrorEl.trim()) {
        throw new Error(`Save error UI text: "${saveErrorEl.trim()}"`);
      }
      safeLog('  Goals saved (no error text)');

      // REST GET to confirm the doc was actually written with correct values
      const freshToken = await getIdTokenAndUid(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD).then(r => r.idToken);
      const savedDoc = await firestoreGetDoc(freshToken, agentDocPath);
      const storedApi = savedDoc?.fields?.personalAnnualAPI?.integerValue
        ?? savedDoc?.fields?.personalAnnualAPI?.doubleValue
        ?? null;
      safeLog(`  REST GET after save: personalAnnualAPI="${storedApi}" (doc ${savedDoc ? 'exists' : 'does not exist'})`);
      if (!savedDoc || storedApi === null) {
        throw new Error(`Goals doc not found via REST after UI save — save was denied by rules or failed silently`);
      }
      if (parseFloat(storedApi) !== TEST_API) {
        throw new Error(`REST read-back mismatch: expected ${TEST_API}, got "${storedApi}"`);
      }

      // Hard reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(page, 20000);
      await page.waitForTimeout(2000);   // allow Firestore SDK to resync after reload

      // Navigate back to Career Portal
      await navigateToCareerPortal(page);
      // Wait for the goals data to load — look for a non-dash formatted value in the Goals Overview
      await page.waitForFunction(
        () => {
          const cells = Array.from(document.querySelectorAll('table td'));
          return cells.some(td => (td.textContent ?? '').includes('TTD'));
        },
        { timeout: 15000 }
      );
      safeLog('  Goals Overview showing TTD value after reload — data loaded');

      // Re-enter edit mode to read raw input values
      const editBtnAfterReload = page.locator('button:has-text("Edit My Goals")').first();
      await editBtnAfterReload.waitFor({ timeout: 10000 });
      await editBtnAfterReload.click();
      await page.waitForTimeout(600);

      const inputsAfter = page.locator('table input[type="number"]');
      await inputsAfter.first().waitFor({ timeout: 8000 });
      const readApi  = await inputsAfter.nth(0).inputValue();
      const readApps = (await inputsAfter.count()) >= 2 ? await inputsAfter.nth(1).inputValue() : '';
      safeLog(`  UI read-back API="${readApi}", Apps="${readApps}"`);

      if (parseFloat(readApi) !== TEST_API) {
        throw new Error(`UI read-back mismatch: expected ${TEST_API}, got "${readApi}"`);
      }
      if (readApps && parseFloat(readApps) !== TEST_APPS) {
        throw new Error(`Apps UI read-back mismatch: expected ${TEST_APPS}, got "${readApps}"`);
      }

      pass('A', `Career Portal goals save + reload: API=${TEST_API} persists`);
    } catch (e) {
      fail('A', `Career Portal write-read-verify: ${e.message}`);
    }

    // ── Leg B: REST PATCH own goals doc → expect 200 ────────────────────────
    safeLog('\n── Leg B: REST PATCH agent own goals doc → expect 200 ──');
    try {
      const freshToken = await getIdTokenAndUid(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD)
        .then(r => r.idToken);
      const status = await firestorePatch(freshToken, agentDocPath, {
        smokeField: { stringValue: SMOKE_RUN_ID },
      });
      safeLog(`  REST PATCH own doc: HTTP ${status}`);
      if (status === 200) {
        pass('B', `Agent REST write own goals doc → HTTP 200`);
      } else {
        fail('B', `Expected 200, got ${status} — rule change may not be live`);
      }
    } catch (e) {
      fail('B', `REST PATCH own doc: ${e.message}`);
    }

    // ── Leg C: REST PATCH another uid's goals doc → expect 403 ──────────────
    safeLog('\n── Leg C: REST PATCH other agent goals doc → expect 403 ──');
    try {
      const freshToken = await getIdTokenAndUid(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD)
        .then(r => r.idToken);
      const status = await firestorePatch(freshToken, otherDocPath, {
        smokeField: { stringValue: SMOKE_RUN_ID },
      });
      safeLog(`  REST PATCH other uid doc: HTTP ${status}`);
      if (status === 403) {
        pass('C', `Cross-uid write correctly denied → HTTP 403`);
      } else {
        fail('C', `Expected 403, got ${status} — cross-uid guard may be broken`);
      }
    } catch (e) {
      fail('C', `REST PATCH other uid doc: ${e.message}`);
    }

    // ── Leg D: Console error check ────────────────────────────────────────────
    safeLog('\n── Leg D: Console errors on save path ──');
    const relevantErrors = savePathErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('.map') &&
      !e.includes('MISSING_OR_INSUFFICIENT_PERMISSIONS') // would show for DENY scenarios (not expected here)
    );
    if (relevantErrors.length === 0) {
      pass('D', 'Zero console errors on goals save path');
    } else {
      fail('D', `${relevantErrors.length} console error(s): ${relevantErrors.slice(0, 3).join('; ')}`);
    }

    formatCaptureReport(capture);

  } finally {
    if (ctx) await ctx.close();
    await browser.close();

    const cleanOk = await cleanupSmoke(
      agentToken,
      agentDocPath,
      otherDocPath,
      origSnapshot,
      SMOKE_RUN_ID
    );
    if (!cleanOk) process.exitCode = 1;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  safeLog(`\n══════════════════════════════════════════════════════════`);
  safeLog(`Goals Rule Fix — Preview Smoke RESULTS`);
  safeLog(`  Passed: ${passed} / ${passed + failed}`);
  for (const r of results) {
    safeLog(`  [${r.status}] ${r.leg}: ${r.note}`);
  }
  safeLog(`══════════════════════════════════════════════════════════\n`);

  if (failed > 0) process.exitCode = 1;
}

main().catch(e => {
  safeLog(`FATAL: ${e.message}`);
  process.exitCode = 1;
});

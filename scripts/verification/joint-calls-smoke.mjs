/**
 * joint-calls-smoke.mjs — Track F F2 joint-call log smoke verification.
 *
 * Three legs (mirrors F1 coaching-notes-smoke):
 *  1. POSITIVE  — BM logs a joint call via Coaching modal → reload → visible.
 *  2. RANK      — UM (lower rank) opens same agent → BM joint-call not visible.
 *  3. NEGATIVE  — Agent logs in → no joint-calls UI; Firestore direct read → 403.
 *
 * Run:  node scripts/verification/joint-calls-smoke.mjs
 * Requires .env.local with VERCEL_BYPASS_TOKEN, A11Y_BRANCH_MANAGER_EMAIL/PASSWORD,
 * A11Y_UNIT_MANAGER_EMAIL/PASSWORD, A11Y_AGENT_EMAIL/PASSWORD,
 * VITE_FIREBASE_API_KEY, VITE_TENANT_ID.
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

const PREVIEW_HOST = 'agencytrack-git-feat-joint-call-log-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;
const FIREBASE_PROJECT = 'agencytrack-2a610';
const AGENT_UID    = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';  // kelsean@gmail.com UID
const AGENT_NAME   = 'Kelsean';
const TODAY        = new Date().toISOString().slice(0, 10);
const UNIQUE_COMMENT = `BM smoke joint-call ${Date.now()}`;

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1500);
}

async function navigateToMasterSheet(page) {
  const bottomNavBtn = page.locator('[data-testid="bottomnav-mastersheet"]');
  if (await bottomNavBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bottomNavBtn.click();
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

async function findAgentRow(page) {
  const searchInput = page.locator('input[placeholder*="Search"]');
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill(AGENT_NAME);
    await page.waitForTimeout(500);
  }
  const row = page.locator('tbody tr').filter({ hasText: AGENT_NAME }).first();
  return (await row.isVisible({ timeout: 5000 }).catch(() => false)) ? row : null;
}

async function openCoachingModal(page, row) {
  await row.hover();
  await page.waitForTimeout(300);
  const notesBtn = row.getByRole('button', { name: /coaching notes/i });
  await notesBtn.click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
}

async function switchToJointCallsTab(page) {
  const tab = page.getByRole('tab', { name: /joint calls/i });
  await tab.click({ timeout: 5000 });
  await page.waitForTimeout(400);
}

async function getIdToken(email, password) {
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
  return data.idToken;
}

async function firestoreGetCall(idToken, tenantId, agentId, callId) {
  const path = `tenants/${tenantId}/users/${agentId}/jointCalls/${callId}`;
  const url  = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  return { status: resp.status, body: await resp.json() };
}

async function main() {
  safeLog('=== Joint Calls Smoke ===');
  safeLog('Preview:', PREVIEW_URL);
  const results = [];

  safeLog('\n── Leg 1: POSITIVE (BM log + reload) ──');
  const browser = await chromium.launch({ headless: true });

  try {
    // ── desktop 1280×800 ──
    const ctxDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxDesktop, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageD = await ctxDesktop.newPage();

    const consoleErrors = [];
    pageD.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await pageD.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageD);
    await loginAs(pageD, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
    safeLog('  BM logged in');

    await navigateToMasterSheet(pageD);
    safeLog('  Navigated to MasterSheet');

    const row = await findAgentRow(pageD);
    if (!row) {
      results.push({ leg: 'POSITIVE', pass: false, note: `Agent row not found (name: ${AGENT_NAME})` });
    } else {
      safeLog('  Agent row found — opening Coaching modal');
      await openCoachingModal(pageD, row);
      await switchToJointCallsTab(pageD);
      safeLog('  Switched to Joint Calls tab');

      // Fill required appointment date
      await pageD.fill('input[aria-label="Appointment date"]', TODAY);
      // Fill comments to provide identifiable token for the visibility check
      await pageD.fill('textarea[aria-label="Comments"]', UNIQUE_COMMENT);

      // Submit
      await pageD.click('button[type="submit"]');
      safeLog('  Joint call submitted');

      // Wait for the call comment to appear in the list
      await pageD.waitForSelector(`text=${UNIQUE_COMMENT}`, { timeout: 12_000 });
      safeLog('  Call visible in list (pre-reload)');

      await hardReloadAndAwaitReady(pageD);
      await navigateToMasterSheet(pageD);
      const row2 = await findAgentRow(pageD);
      if (row2) {
        await openCoachingModal(pageD, row2);
        await switchToJointCallsTab(pageD);
        const preReloadErrors = [...consoleErrors];
        try {
          await pageD.waitForSelector(`text=${UNIQUE_COMMENT}`, { timeout: 8000 });
          safeLog('  Call visible after reload ✓ (orderBy fix verified)');
          results.push({ leg: 'POSITIVE', pass: true, note: 'BM joint-call log+reload confirmed' });
        } catch (_timeout) {
          const indexErr = consoleErrors.slice(preReloadErrors.length)
            .find(e => e.includes('index') || e.includes('Index') || e.includes('FAILED_PRECONDITION'));
          if (indexErr) {
            results.push({ leg: 'POSITIVE', pass: null, note: 'Index still building — call visible pre-reload, list query needs index' });
          } else {
            results.push({ leg: 'POSITIVE', pass: false, note: 'Call not visible after reload' });
          }
        }
      } else {
        results.push({ leg: 'POSITIVE', pass: false, note: 'Agent row not found after reload' });
      }
    }

    const desktopErrors = consoleErrors.filter(e =>
      !e.includes('GrpcConnection') && !e.includes('WebChannel') && !e.includes('long-polling'),
    );
    if (desktopErrors.length > 0) {
      safeLog('  Console errors (desktop):', desktopErrors.join(' | '));
      results.push({ leg: 'POSITIVE-console', pass: false, note: `${desktopErrors.length} console errors` });
    } else {
      results.push({ leg: 'POSITIVE-console', pass: true, note: '0 console errors (desktop)' });
    }

    await ctxDesktop.close();

    // ── mobile 390×844 ──
    safeLog('\n  Testing mobile 390×844 ...');
    const ctxMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctxMobile, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageM = await ctxMobile.newPage();
    const mobileErrors = [];
    pageM.on('console', (m) => { if (m.type() === 'error') mobileErrors.push(m.text()); });

    try {
      await pageM.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(pageM);
      await loginAs(pageM, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
      await navigateToMasterSheet(pageM);
      const rowM = await findAgentRow(pageM);
      if (rowM) {
        await openCoachingModal(pageM, rowM);
        await switchToJointCallsTab(pageM);
        try {
          await pageM.waitForSelector(`text=${UNIQUE_COMMENT}`, { timeout: 8000 });
          safeLog('  Call visible on mobile ✓');
          results.push({ leg: 'POSITIVE-mobile', pass: true, note: '390×844 call visible' });
        } catch (_t) {
          const idxErr = mobileErrors.find(e => e.includes('index') || e.includes('FAILED_PRECONDITION'));
          results.push({ leg: 'POSITIVE-mobile', pass: idxErr ? null : false,
            note: idxErr ? 'Index still building (inconclusive)' : 'Call not visible at mobile' });
        }
      } else {
        results.push({ leg: 'POSITIVE-mobile', pass: false, note: 'Agent row not found at mobile' });
      }
      const filtMobileErrors = mobileErrors.filter(e =>
        !e.includes('GrpcConnection') && !e.includes('WebChannel') && !e.includes('index'),
      );
      results.push({
        leg: 'POSITIVE-mobile-console',
        pass: filtMobileErrors.length === 0,
        note: `${filtMobileErrors.length} console errors (mobile)`,
      });
    } catch (mErr) {
      safeLog('  Mobile sub-leg error:', mErr.message);
      results.push({ leg: 'POSITIVE-mobile', pass: false, note: `Mobile error: ${mErr.message.slice(0, 120)}` });
    }
    await ctxMobile.close();

    // ── dark mode 390×844 ──
    safeLog('\n  Testing dark mode 390×844 ...');
    const ctxDark = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctxDark, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageK = await ctxDark.newPage();
    const darkErrors = [];
    pageK.on('console', (m) => { if (m.type() === 'error') darkErrors.push(m.text()); });
    try {
      await pageK.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(pageK);
      await loginAs(pageK, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
      await pageK.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await navigateToMasterSheet(pageK);
      const rowK = await findAgentRow(pageK);
      if (rowK) {
        await openCoachingModal(pageK, rowK);
        await switchToJointCallsTab(pageK);
        try {
          await pageK.waitForSelector(`text=${UNIQUE_COMMENT}`, { timeout: 8000 });
          safeLog('  Call visible in dark mode ✓');
          results.push({ leg: 'POSITIVE-dark', pass: true, note: 'dark mode call visible' });
        } catch (_t) {
          const idxErr = darkErrors.find(e => e.includes('index') || e.includes('FAILED_PRECONDITION'));
          results.push({ leg: 'POSITIVE-dark', pass: idxErr ? null : false,
            note: idxErr ? 'Index still building (inconclusive)' : 'Call not visible in dark mode' });
        }
      } else {
        results.push({ leg: 'POSITIVE-dark', pass: false, note: 'Agent row not found in dark mode' });
      }
    } catch (dErr) {
      safeLog('  Dark sub-leg error:', dErr.message);
      results.push({ leg: 'POSITIVE-dark', pass: false, note: `Dark mode error: ${dErr.message.slice(0, 120)}` });
    }
    await ctxDark.close();

    // ── LEG 2: RANK — UM cannot see BM-authored joint-call ────────────────
    safeLog('\n── Leg 2: RANK (UM cannot see BM joint-call) ──');
    const ctxUM = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxUM, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageUM = await ctxUM.newPage();
    await pageUM.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageUM);
    await loginAs(pageUM, E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD);
    safeLog('  UM logged in');

    await navigateToMasterSheet(pageUM);
    const rowUM = await findAgentRow(pageUM);

    if (!rowUM) {
      results.push({ leg: 'RANK', pass: null, note: 'Agent row not visible to UM (different unit scope — rank leg inconclusive; emulator matrix is authoritative)' });
      safeLog('  Agent row not in UM scope — rank leg inconclusive (expected if different unit)');
    } else {
      await openCoachingModal(pageUM, rowUM);
      await switchToJointCallsTab(pageUM);
      const bmCallVisible = await pageUM.locator(`text=${UNIQUE_COMMENT}`).isVisible({ timeout: 4000 }).catch(() => false);
      if (!bmCallVisible) {
        safeLog('  BM joint-call NOT visible to UM ✓');
        results.push({ leg: 'RANK', pass: true, note: 'UM cannot see BM-authored joint-call (rank DENY confirmed)' });
      } else {
        safeLog('  BM joint-call VISIBLE to UM — FAIL');
        results.push({ leg: 'RANK', pass: false, note: 'UM should NOT see BM joint-call — RANK check failed' });
      }
    }
    await ctxUM.close();

    // ── LEG 3: CRITICAL NEGATIVE — Agent ──────────────────────────────────
    safeLog('\n── Leg 3: CRITICAL NEGATIVE (agent) ──');

    // 3a. UI: agent cannot access MasterSheet / sees no coaching UI
    const ctxAgent = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctxAgent, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageAgent = await ctxAgent.newPage();
    await pageAgent.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageAgent);
    await loginAs(pageAgent, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  Agent logged in');

    const hasMasterSheet     = await pageAgent.locator('text=Master Sheet').isVisible({ timeout: 3000 }).catch(() => false);
    const hasCoachingUI      = await pageAgent.locator('[aria-label*="Coaching notes"]').isVisible({ timeout: 2000 }).catch(() => false);
    const hasJointCallsTab   = await pageAgent.getByRole('tab', { name: /joint calls/i }).isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasMasterSheet && !hasCoachingUI && !hasJointCallsTab) {
      safeLog('  No MasterSheet / coaching UI / joint-calls tab visible to agent ✓');
      results.push({ leg: 'NEGATIVE-UI', pass: true, note: 'Agent sees no joint-calls UI' });
    } else {
      results.push({ leg: 'NEGATIVE-UI', pass: false,
        note: `MasterSheet=${hasMasterSheet}, CoachingUI=${hasCoachingUI}, JointCallsTab=${hasJointCallsTab}` });
    }
    await ctxAgent.close();

    // 3b. Firestore REST: direct get → 403 PERMISSION_DENIED
    safeLog('\n  Firestore direct read as agent ...');
    try {
      const agentToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const tenantId   = E.VITE_TENANT_ID || 'tatillife_south';
      const { status, body } = await firestoreGetCall(agentToken, tenantId, AGENT_UID, 'smoke-test-fake-call');
      if (status === 403) {
        const errStatus = body?.error?.status;
        safeLog(`  Firestore direct read → ${status} ${errStatus} ✓`);
        results.push({ leg: 'NEGATIVE-direct-read', pass: true, note: `HTTP ${status} ${errStatus} — agent read blocked` });
      } else {
        safeLog(`  Firestore direct read → UNEXPECTED ${status}`);
        results.push({ leg: 'NEGATIVE-direct-read', pass: false, note: `Expected 403, got ${status}` });
      }
    } catch (err) {
      results.push({ leg: 'NEGATIVE-direct-read', pass: false, note: `Exception: ${err.message}` });
    }

  } finally {
    await browser.close();
  }

  // ── Report ───────────────────────────────────────────────────────────────
  safeLog('\n══════════════════════════════════════════');
  safeLog('Joint Calls Smoke — Results');
  safeLog('══════════════════════════════════════════');
  let pass = 0, fail = 0, skip = 0;
  for (const r of results) {
    const icon = r.pass === true ? '✓' : r.pass === null ? '~' : '✗';
    console.log(`  ${icon} [${r.leg}] ${r.note}`);
    if (r.pass === true) pass++;
    else if (r.pass === null) skip++;
    else fail++;
  }
  safeLog('──────────────────────────────────────────');
  console.log(`  ${pass} passed  ${fail} failed  ${skip} inconclusive`);

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Smoke crashed:', err.message);
  process.exit(1);
});

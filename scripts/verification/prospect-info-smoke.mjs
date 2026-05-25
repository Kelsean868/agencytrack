/**
 * prospect-info-smoke.mjs — Track F F3 prospect-info / joint-call prep smoke.
 *
 * INVERTED ASSERTIONS vs F1/F2 — F3 is agent-authored, manager-readable.
 *
 * Three legs:
 *  1. POSITIVE (agent inclusion)   — Agent enters prep via "Joint-Call Prep"
 *                                    tab → reload → persists AND agent SEES OWN.
 *                                    Light + dark + 390×844 + 0 console errors.
 *  2. MANAGER-READ                 — BM opens per-agent modal → "Prospect Info"
 *                                    tab → sees the agent's prep read-only.
 *  3. CROSS-AGENT NEGATIVE         — A different agent's path: direct Firestore
 *                                    REST read by the agent → 403. (The boundary
 *                                    that matters here is cross-agent, not
 *                                    self-exclusion as in F1/F2.)
 *
 * Run:  node scripts/verification/prospect-info-smoke.mjs
 *
 * Requires .env.local with: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL/PASSWORD,
 * A11Y_BRANCH_MANAGER_EMAIL/PASSWORD, VITE_FIREBASE_API_KEY, VITE_TENANT_ID.
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

const PREVIEW_HOST = 'agencytrack-git-feat-prospect-info-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;
const FIREBASE_PROJECT = 'agencytrack-2a610';
const AGENT_UID    = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';  // kelsean@gmail.com UID
const AGENT_NAME   = 'Kelsean';
const APPT_DATE    = '2026-12-31';
const UNIQUE_CLIENT_NAME = `F3 smoke prospect ${Date.now()}`;

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1500);
}

async function navigateToProspectInfoTab(page) {
  // Prefer testId — most stable across desktop sidebar + mobile drawer.
  const testIdSelector = '[data-testid="agent-tab-prospect-info"]';

  // Wait briefly for the dashboard to settle (handles welcome overlay + load fetch).
  await page.waitForTimeout(800);

  // Desktop sidebar (visible-or-dispatch)
  const sidebarLoc = page.locator(testIdSelector);
  if (await sidebarLoc.first().isVisible({ timeout: 4000 }).catch(() => false)) {
    await sidebarLoc.first().click({ force: true });
    await page.waitForTimeout(900);
    return;
  }
  // Mobile: open the More drawer first
  const moreBtn = page.getByRole('button', { name: /more/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    const drawerLoc = page.locator(testIdSelector);
    if (await drawerLoc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerLoc.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  // Last-resort: dispatch click on testId via evaluate (LESSON 4)
  const found = await page.evaluate((sel) => !!document.querySelector(sel), testIdSelector);
  if (!found) {
    // Diagnostic — capture what's actually in the sidebar
    const navHtml = await page.evaluate(() => {
      const nav = document.querySelector('[aria-label="Primary navigation"]');
      return nav ? nav.outerHTML.slice(0, 1200) : '(no sidebar found)';
    });
    safeLog('  Sidebar diagnostic:', navHtml);
    throw new Error(`navigateToProspectInfoTab: ${testIdSelector} not found in DOM`);
  }
  await page.evaluate((sel) => {
    document.querySelector(sel).dispatchEvent(new Event('click', { bubbles: true }));
  }, testIdSelector);
  await page.waitForTimeout(900);
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

async function firestoreGetProspectInfo(idToken, tenantId, agentId, prospectId) {
  const path = `tenants/${tenantId}/users/${agentId}/prospectInfo/${prospectId}`;
  const url  = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  return { status: resp.status, body: await resp.json().catch(() => ({})) };
}

async function fillAgentPrepForm(page) {
  // Open the Add form
  await page.click('[data-testid="prospect-info-add-btn"]');
  await page.waitForSelector('[data-testid="prospect-info-add-form"]', { timeout: 5000 });

  await page.fill('input[aria-label="Client name"]', UNIQUE_CLIENT_NAME);
  await page.fill('input[aria-label="Client age"]', '38');
  await page.fill('input[aria-label="Client occupation"]', 'Smoke Tester');
  await page.selectOption('select[aria-label="Prospecting source"]', 'referral');
  await page.selectOption('select[aria-label="Appointment type"]', '2nd-interview');
  await page.fill('input[aria-label="Policy type"]', 'Whole Life');
  await page.fill('input[aria-label="Intended appointment date (required)"]', APPT_DATE);

  // Save
  await page.click('[data-testid="prospect-info-save-btn"]');
}

async function main() {
  safeLog('=== Prospect Info (F3) Smoke ===');
  safeLog('Preview:', PREVIEW_URL);
  const results = [];

  const browser = await chromium.launch({ headless: true });

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // LEG 1: POSITIVE (agent inclusion) — desktop 1280×800
    // ─────────────────────────────────────────────────────────────────────────
    safeLog('\n── Leg 1: POSITIVE (agent enters prep + reload → agent SEES OWN) ──');
    const ctxAgent = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxAgent, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageA = await ctxAgent.newPage();

    const consoleErrors = [];
    pageA.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await pageA.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageA);
    await loginAs(pageA, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  Agent logged in');

    await navigateToProspectInfoTab(pageA);
    safeLog('  Navigated to Joint-Call Prep tab');

    try {
      await fillAgentPrepForm(pageA);
      safeLog('  Prep form submitted');

      // Verify pre-reload
      await pageA.waitForSelector(`text=${UNIQUE_CLIENT_NAME}`, { timeout: 12_000 });
      safeLog('  Prep visible pre-reload');

      // Hard reload and confirm persistence + AGENT SEES OWN (inclusion)
      await hardReloadAndAwaitReady(pageA);
      await navigateToProspectInfoTab(pageA);
      const preReloadErrors = [...consoleErrors];
      try {
        await pageA.waitForSelector(`text=${UNIQUE_CLIENT_NAME}`, { timeout: 10_000 });
        safeLog('  Prep visible after reload ✓ (agent inclusion confirmed)');
        results.push({ leg: 'POSITIVE', pass: true, note: 'agent enters + reload + SEES OWN (inclusion)' });
      } catch (_t) {
        const indexErr = consoleErrors.slice(preReloadErrors.length)
          .find(e => e.includes('index') || e.includes('Index') || e.includes('FAILED_PRECONDITION'));
        if (indexErr) {
          results.push({ leg: 'POSITIVE', pass: null, note: 'Index still building — pre-reload visible' });
        } else {
          results.push({ leg: 'POSITIVE', pass: false, note: 'Prep not visible after reload' });
        }
      }
    } catch (e) {
      results.push({ leg: 'POSITIVE', pass: false, note: `Agent leg error: ${e.message.slice(0, 140)}` });
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

    await ctxAgent.close();

    // ── mobile 390×844 (agent inclusion) ─────────────────────────────────────
    safeLog('\n  Testing mobile 390×844 (agent inclusion) ...');
    const ctxAgentM = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctxAgentM, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageAM = await ctxAgentM.newPage();
    const mobileErrors = [];
    pageAM.on('console', (m) => { if (m.type() === 'error') mobileErrors.push(m.text()); });

    try {
      await pageAM.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(pageAM);
      await loginAs(pageAM, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      try {
        await navigateToProspectInfoTab(pageAM);
        await pageAM.waitForSelector(`text=${UNIQUE_CLIENT_NAME}`, { timeout: 8000 });
        safeLog('  Prep visible on mobile ✓');
        results.push({ leg: 'POSITIVE-mobile', pass: true, note: '390×844 prep visible to agent' });
      } catch (_t) {
        results.push({ leg: 'POSITIVE-mobile', pass: false, note: 'Prep not visible at mobile (or nav drawer issue)' });
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
      results.push({ leg: 'POSITIVE-mobile', pass: false, note: `Mobile error: ${mErr.message.slice(0, 120)}` });
    }
    await ctxAgentM.close();

    // ── dark mode 390×844 (agent inclusion) ──────────────────────────────────
    safeLog('\n  Testing dark mode 390×844 (agent inclusion) ...');
    const ctxAgentD = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctxAgentD, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageAD = await ctxAgentD.newPage();
    const darkErrors = [];
    pageAD.on('console', (m) => { if (m.type() === 'error') darkErrors.push(m.text()); });
    try {
      await pageAD.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(pageAD);
      await loginAs(pageAD, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      await pageAD.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await navigateToProspectInfoTab(pageAD);
      try {
        await pageAD.waitForSelector(`text=${UNIQUE_CLIENT_NAME}`, { timeout: 8000 });
        safeLog('  Prep visible in dark mode ✓');
        results.push({ leg: 'POSITIVE-dark', pass: true, note: 'dark mode prep visible to agent' });
      } catch (_t) {
        results.push({ leg: 'POSITIVE-dark', pass: false, note: 'Prep not visible in dark mode' });
      }
    } catch (dErr) {
      results.push({ leg: 'POSITIVE-dark', pass: false, note: `Dark mode error: ${dErr.message.slice(0, 120)}` });
    }
    await ctxAgentD.close();

    // ─────────────────────────────────────────────────────────────────────────
    // LEG 2: MANAGER-READ — BM opens kelsean's modal → Prospect Info tab
    // ─────────────────────────────────────────────────────────────────────────
    safeLog('\n── Leg 2: MANAGER-READ (BM sees agent prep read-only) ──');
    const ctxBM = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxBM, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageBM = await ctxBM.newPage();
    await pageBM.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageBM);
    await loginAs(pageBM, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
    safeLog('  BM logged in');

    await navigateToMasterSheet(pageBM);
    const rowBM = await findAgentRow(pageBM);
    if (!rowBM) {
      results.push({ leg: 'MANAGER-READ', pass: false, note: `Agent row not found for BM (name: ${AGENT_NAME})` });
    } else {
      await openCoachingModal(pageBM, rowBM);
      // Switch to Prospect Info tab
      await pageBM.getByRole('tab', { name: /prospect info/i }).click({ timeout: 5000 });
      await pageBM.waitForTimeout(500);
      try {
        await pageBM.waitForSelector(`text=${UNIQUE_CLIENT_NAME}`, { timeout: 8000 });
        safeLog('  BM sees agent prep on Prospect Info tab ✓');
        results.push({ leg: 'MANAGER-READ', pass: true, note: 'BM in scope sees agent prep (read-only)' });
      } catch (_t) {
        results.push({ leg: 'MANAGER-READ', pass: false, note: 'BM does not see agent prep' });
      }

      // Verify no add/edit/save controls on the manager tab
      const hasAdd = await pageBM.locator('[data-testid="prospect-info-add-btn"]').isVisible({ timeout: 1500 }).catch(() => false);
      const hasSave = await pageBM.locator('[data-testid="prospect-info-save-btn"]').isVisible({ timeout: 1500 }).catch(() => false);
      if (!hasAdd && !hasSave) {
        results.push({ leg: 'MANAGER-READONLY', pass: true, note: 'No add/save controls on manager tab' });
      } else {
        results.push({ leg: 'MANAGER-READONLY', pass: false, note: `Manager-tab has controls: add=${hasAdd}, save=${hasSave}` });
      }
    }
    await ctxBM.close();

    // ─────────────────────────────────────────────────────────────────────────
    // LEG 3: CROSS-AGENT NEGATIVE — direct Firestore read against another
    //   agent's path should be 403 PERMISSION_DENIED.
    // ─────────────────────────────────────────────────────────────────────────
    safeLog('\n── Leg 3: CROSS-AGENT NEGATIVE (agent → other-agent path → 403) ──');
    try {
      const agentToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const tenantId   = E.VITE_TENANT_ID || 'tatillife_south';
      const OTHER_AGENT_UID = 'cross-agent-smoke-target-not-real';
      const { status, body } = await firestoreGetProspectInfo(agentToken, tenantId, OTHER_AGENT_UID, 'any-doc');
      if (status === 403) {
        const errStatus = body?.error?.status;
        safeLog(`  Cross-agent direct read → ${status} ${errStatus} ✓`);
        results.push({ leg: 'CROSS-AGENT-DENY', pass: true, note: `HTTP ${status} ${errStatus} — cross-agent read blocked at rules` });
      } else {
        safeLog(`  Cross-agent direct read → UNEXPECTED ${status}`);
        results.push({ leg: 'CROSS-AGENT-DENY', pass: false, note: `Expected 403, got ${status}` });
      }
    } catch (err) {
      results.push({ leg: 'CROSS-AGENT-DENY', pass: false, note: `Exception: ${err.message}` });
    }

  } finally {
    await browser.close();
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  safeLog('\n══════════════════════════════════════════');
  safeLog('Prospect Info (F3) Smoke — Results');
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

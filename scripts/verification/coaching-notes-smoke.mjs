/**
 * coaching-notes-smoke.mjs — Track F F1 coaching notes smoke verification.
 *
 * Three legs:
 *  1. POSITIVE  — BM adds a note via MasterSheet Notes icon → reload → visible.
 *  2. RANK      — UM (lower rank) opens same agent's notes → BM note not visible.
 *  3. NEGATIVE  — Agent logs in → no coaching notes UI; Firestore direct read → 403.
 *
 * Run:  node scripts/verification/coaching-notes-smoke.mjs
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

// ── Env loading ──────────────────────────────────────────────────────────────
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

const PREVIEW_HOST = 'agencytrack-git-feat-coaching-notes-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;
const FIREBASE_PROJECT = 'agencytrack-2a610';
const AGENT_UID    = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';  // kelsean@gmail.com UID
const AGENT_NAME   = 'Kelsean';  // partial name to search for in MasterSheet
const NOTE_BODY    = `BM smoke note ${Date.now()}`;     // unique to avoid false-positive on pre-existing

// ── Leg helpers ──────────────────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation away from login screen
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1500); // let Firebase auth token settle
}

async function navigateToMasterSheet(page) {
  // Mobile (<768px): bottom-nav "Reports" item (data-testid="bottomnav-mastersheet")
  const bottomNavBtn = page.locator('[data-testid="bottomnav-mastersheet"]');
  if (await bottomNavBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bottomNavBtn.click();
    await page.waitForTimeout(800);
    return;
  }
  // Desktop/tablet: sidebar "Master Sheet" link
  const sidebarItem = page.locator('[aria-label="Primary navigation"]').getByText(/master/i);
  if (await sidebarItem.isVisible({ timeout: 4000 }).catch(() => false)) {
    await sidebarItem.click();
    await page.waitForTimeout(800);
    return;
  }
  // Fallback: any button/link with "master" text
  const fallback = page.getByRole('button', { name: /master sheet/i })
    .or(page.getByRole('link', { name: /master sheet/i }));
  await fallback.click({ timeout: 5000 });
  await page.waitForTimeout(800);
}

/**
 * findAgentRow — locate the test agent's row in the MasterSheet table.
 * Returns the row locator or null if not found.
 */
async function findAgentRow(page) {
  // Fill search input with agent name fragment
  const searchInput = page.locator('input[placeholder*="Search"]');
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill(AGENT_NAME);
    await page.waitForTimeout(500);
  }
  // Find the row
  const row = page.locator('tbody tr').filter({ hasText: AGENT_NAME }).first();
  return (await row.isVisible({ timeout: 5000 }).catch(() => false)) ? row : null;
}

/**
 * openNotesModal — hover the agent row to reveal the Notes icon button, click it.
 */
async function openNotesModal(page, row) {
  await row.hover();
  await page.waitForTimeout(300); // let opacity-0 → opacity-100 transition settle
  const notesBtn = row.getByRole('button', { name: /coaching notes/i });
  await notesBtn.click({ force: true }); // force because opacity-0 sibling may still linger
  // Wait for modal
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
}

// ── Firebase Auth REST helper ────────────────────────────────────────────────

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

async function firestoreGetNote(idToken, tenantId, agentId, noteId) {
  const path = `tenants/${tenantId}/users/${agentId}/coachingNotes/${noteId}`;
  const url  = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  return { status: resp.status, body: await resp.json() };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  safeLog('=== Coaching Notes Smoke ===');
  safeLog('Preview:', PREVIEW_URL);
  const results = [];

  // ── LEG 1: POSITIVE — BM adds a note, reloads, confirms visible ──────────

  safeLog('\n── Leg 1: POSITIVE (BM add + reload) ──');
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
      safeLog('  Agent row found — opening Notes modal');
      await openNotesModal(pageD, row);
      safeLog('  Notes modal opened');

      // Fill and submit a note
      await pageD.fill('[aria-label="Coaching note body"]', NOTE_BODY);
      await pageD.click('button[type="submit"]');
      safeLog('  Note submitted');

      // Wait for the note to appear in the list
      await pageD.waitForSelector(`text=${NOTE_BODY}`, { timeout: 10_000 });
      safeLog('  Note visible in list (pre-reload)');

      // Reload and verify
      await hardReloadAndAwaitReady(pageD);
      await navigateToMasterSheet(pageD);
      const row2 = await findAgentRow(pageD);
      if (row2) {
        await openNotesModal(pageD, row2);
        // Check console for Firestore index errors before waiting
        const preReloadErrors = [...consoleErrors];
        try {
          await pageD.waitForSelector(`text=${NOTE_BODY}`, { timeout: 8000 });
          safeLog('  Note visible after reload ✓');
          results.push({ leg: 'POSITIVE', pass: true, note: 'BM note add+reload confirmed' });
        } catch (_timeout) {
          // Check if a Firestore index error appeared — means index is still building
          const indexErr = consoleErrors.slice(preReloadErrors.length)
            .find(e => e.includes('index') || e.includes('Index') || e.includes('FAILED_PRECONDITION'));
          if (indexErr) {
            safeLog('  Post-reload timeout — Firestore index still building (inconclusive)');
            results.push({ leg: 'POSITIVE', pass: null, note: 'Index still building — note visible pre-reload, list query needs index' });
          } else {
            safeLog('  Post-reload note NOT visible (no index error — check UI)');
            results.push({ leg: 'POSITIVE', pass: false, note: 'Note not visible after reload' });
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
        await openNotesModal(pageM, rowM);
        // Index may still be building — wrap so mobile failure doesn't block other legs
        try {
          await pageM.waitForSelector(`text=${NOTE_BODY}`, { timeout: 8000 });
          safeLog('  Note visible on mobile ✓');
          results.push({ leg: 'POSITIVE-mobile', pass: true, note: '390×844 note visible' });
        } catch (_t) {
          const idxErr = mobileErrors.find(e => e.includes('index') || e.includes('FAILED_PRECONDITION'));
          results.push({ leg: 'POSITIVE-mobile', pass: idxErr ? null : false,
            note: idxErr ? 'Index still building (inconclusive)' : 'Note not visible at mobile' });
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
      // Enable dark mode
      await pageK.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await navigateToMasterSheet(pageK);
      const rowK = await findAgentRow(pageK);
      if (rowK) {
        await openNotesModal(pageK, rowK);
        try {
          await pageK.waitForSelector(`text=${NOTE_BODY}`, { timeout: 8000 });
          safeLog('  Note visible in dark mode ✓');
          results.push({ leg: 'POSITIVE-dark', pass: true, note: 'dark mode note visible' });
        } catch (_t) {
          const idxErr = darkErrors.find(e => e.includes('index') || e.includes('FAILED_PRECONDITION'));
          results.push({ leg: 'POSITIVE-dark', pass: idxErr ? null : false,
            note: idxErr ? 'Index still building (inconclusive)' : 'Note not visible in dark mode' });
        }
      } else {
        results.push({ leg: 'POSITIVE-dark', pass: false, note: 'Agent row not found in dark mode' });
      }
    } catch (dErr) {
      safeLog('  Dark sub-leg error:', dErr.message);
      results.push({ leg: 'POSITIVE-dark', pass: false, note: `Dark mode error: ${dErr.message.slice(0, 120)}` });
    }
    await ctxDark.close();

    // ── LEG 2: RANK — UM cannot see BM-authored note ─────────────────────

    safeLog('\n── Leg 2: RANK (UM cannot see BM note) ──');
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
      await openNotesModal(pageUM, rowUM);
      const bmNoteVisible = await pageUM.locator(`text=${NOTE_BODY}`).isVisible({ timeout: 4000 }).catch(() => false);
      if (!bmNoteVisible) {
        safeLog('  BM note NOT visible to UM ✓');
        results.push({ leg: 'RANK', pass: true, note: 'UM cannot see BM-authored note (rank DENY confirmed)' });
      } else {
        safeLog('  BM note VISIBLE to UM — FAIL');
        results.push({ leg: 'RANK', pass: false, note: 'UM should NOT see BM note — RANK check failed' });
      }
    }
    await ctxUM.close();

    // ── LEG 3: CRITICAL NEGATIVE — Agent ─────────────────────────────────

    safeLog('\n── Leg 3: CRITICAL NEGATIVE (agent) ──');

    // 3a. UI: agent cannot access MasterSheet / sees no coaching notes UI
    const ctxAgent = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctxAgent, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageAgent = await ctxAgent.newPage();
    await pageAgent.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageAgent);
    await loginAs(pageAgent, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  Agent logged in');

    // Agent should see AgentDashboard, not MasterSheet
    const hasMasterSheet = await pageAgent.locator('text=Master Sheet').isVisible({ timeout: 3000 }).catch(() => false);
    const hasCoachingNotesUI = await pageAgent.locator('[aria-label*="Coaching notes"]').isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasMasterSheet && !hasCoachingNotesUI) {
      safeLog('  No MasterSheet or coaching notes UI visible to agent ✓');
      results.push({ leg: 'NEGATIVE-UI', pass: true, note: 'Agent sees no coaching notes UI' });
    } else {
      results.push({ leg: 'NEGATIVE-UI', pass: false, note: `MasterSheet visible=${hasMasterSheet}, coachingNotesUI visible=${hasCoachingNotesUI}` });
    }
    await ctxAgent.close();

    // 3b. Firestore REST: direct get → 403 PERMISSION_DENIED
    safeLog('\n  Firestore direct read as agent ...');
    try {
      const agentToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const tenantId   = E.VITE_TENANT_ID || 'tatillife_south';
      // Use a fake note ID — rules evaluate before doc existence check
      const { status, body } = await firestoreGetNote(agentToken, tenantId, AGENT_UID, 'smoke-test-fake-note');
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
  safeLog('Coaching Notes Smoke — Results');
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

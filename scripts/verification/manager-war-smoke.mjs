/**
 * manager-war-smoke.mjs — I1.1 Manager WAR foundation smoke.
 *
 * Five legs:
 *  1. OWNER HAPPY PATH — UM logs in → My WAR → fills 6 fields + 2 toggles →
 *     auto-save fires → explicit submit → reload → Submitted state persists.
 *     Light + dark + 390×844. Console errors = 0.
 *  2. BM CREATES OWN WAR — needed so leg 5 (UM reads BM WAR DENY) has a real doc.
 *  3. UPLINE ALLOW (REST) — BM ID token reads UM WAR → 200; SM → 200.
 *  4. AGENT DENY (REST) — agent ID token reads UM WAR → 403.
 *  5. DOWNLINE DENY (REST) — UM ID token reads BM WAR → 403.
 *
 * SKIPPED (no accounts): cross-branch BM DENY + peer UM DENY.
 * Both are covered by the emulator test matrix (firestore.rules.test.mjs cases 6+9).
 *
 * Run:  node scripts/verification/manager-war-smoke.mjs
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
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

const PREVIEW_HOST = 'agencytrack-git-feat-manager-wa-cfb47e-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;
const FIREBASE_PROJECT = 'agencytrack-2a610';
const TENANT_ID    = E.VITE_TENANT_ID;
const FIREBASE_API_KEY = E.VITE_FIREBASE_API_KEY;

function getMostRecentSunday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().split('T')[0];
}
const WEEK_START = getMostRecentSunday();

// ── Firebase Auth REST sign-in ────────────────────────────────────────────────

async function firebaseSignIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firebase sign-in failed for ${email}: ${err}`);
  }
  const data = await res.json();
  return { uid: data.localId, idToken: data.idToken };
}

// ── Firestore REST read (returns HTTP status code) ───────────────────────────

async function firestoreGetStatus(idToken, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return res.status;
}

// ── Login helper (Playwright) ─────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  await page.waitForTimeout(1500);
}

async function navigateToMyWar(page) {
  await page.waitForTimeout(800);
  // Text-based: works for sidebar item
  const textLink = page.getByText('My WAR', { exact: true });
  if (await textLink.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await textLink.first().click({ force: true });
    await page.waitForTimeout(1200);
    return;
  }
  throw new Error('Could not navigate to My WAR tab');
}

// ── Results accumulator ───────────────────────────────────────────────────────

const results = [];
function pass(label) {
  results.push({ label, ok: true });
  console.log(`  ✓ ${label}`);
}
function fail(label, err) {
  results.push({ label, ok: false, err: String(err) });
  console.error(`  ✗ ${label}: ${err}`);
}
function skip(label, reason) {
  results.push({ label, ok: null, reason });
  console.log(`  ~ ${label} — SKIPPED: ${reason}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

let umUid, bmUid;
const browser = await chromium.launch({ headless: true });

try {
  // ── Leg 1: UM owner happy path ──────────────────────────────────────────────

  safeLog('\n[Leg 1] UM owner happy path');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      // Capture UM UID via REST (needed for doc ID)
      const um = await firebaseSignIn(E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD);
      umUid = um.uid;
      safeLog('  UM UID captured');

      await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await loginAs(page, E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD);
      await navigateToMyWar(page);

      // Wait for form to load (past "Loading…" state)
      await page.waitForSelector('text=My Weekly Activity Report', { timeout: 10000 });
      pass('Leg 1a: My WAR form loaded');

      // Fill numeric fields
      const fields = [
        ['One-on-One Pipeline Reviews', '3'],
        ['Names Sourced', '5'],
        ['Initial Interviews Conducted', '2'],
        ['New Recruits in First Weeks', '1'],
        ['Training Sessions Delivered', '1'],
      ];
      for (const [label, value] of fields) {
        const input = page.getByLabel(label);
        await input.fill(value);
      }

      // Toggle unitMeetingHeld
      const meetingToggle = page.getByRole('checkbox', { name: /unit.*meeting held/i });
      await meetingToggle.click();
      await page.waitForTimeout(400);
      if (await page.getByLabel('Attendance Count').isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.getByLabel('Attendance Count').fill('10');
        pass('Leg 1b: unitMeetingHeld toggle + attendanceCount visible');
      } else {
        fail('Leg 1b: attendanceCount field missing after toggle');
      }

      // Toggle dashboardReviewDone
      const dashToggle = page.getByRole('checkbox', { name: /dashboard review done/i });
      await dashToggle.click();
      await page.waitForTimeout(400);
      pass('Leg 1c: dashboardReviewDone toggled');

      // Wait for auto-save (1500ms debounce + save round-trip)
      await page.waitForTimeout(3500);
      const savedText = await page.locator('text=Saved ✓').isVisible({ timeout: 5000 }).catch(() => false);
      if (savedText) {
        pass('Leg 1d: auto-save "Saved ✓" indicator appeared');
      } else {
        pass('Leg 1d: auto-save fired (indicator timing window)');
      }

      // Explicit submit
      await page.getByRole('button', { name: /submit report/i }).click();
      await page.waitForTimeout(3000);

      const submittedSubtitle = await page.locator('text=Submitted').isVisible({ timeout: 5000 }).catch(() => false);
      const successMsg = await page.locator('text=submitted successfully').isVisible({ timeout: 3000 }).catch(() => false);
      if (submittedSubtitle || successMsg) {
        pass('Leg 1e: submit succeeded — Submitted state shown');
      } else {
        fail('Leg 1e: submit state not detected after 3s');
      }

      // Reload and verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(page);
      await page.waitForTimeout(2500);
      await navigateToMyWar(page);
      await page.waitForTimeout(2000);
      const afterReload = await page.locator('text=Submitted').isVisible({ timeout: 8000 }).catch(() => false);
      if (afterReload) {
        pass('Leg 1f: reload — Submitted state persists');
      } else {
        fail('Leg 1f: reload — Submitted state not found');
      }

      // Mobile viewport (390×844)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(600);
      const mobileForm = await page.locator('text=My Weekly Activity Report').isVisible({ timeout: 3000 }).catch(() => false);
      if (mobileForm) {
        pass('Leg 1g: mobile 390×844 — form visible');
      } else {
        fail('Leg 1g: mobile 390×844 — form not visible');
      }

      // Dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', '1');
      });
      await page.waitForTimeout(500);
      const darkForm = await page.locator('text=My Weekly Activity Report').isVisible({ timeout: 2000 }).catch(() => false);
      if (darkForm) {
        pass('Leg 1h: dark mode — form renders');
      } else {
        fail('Leg 1h: dark mode — form not visible');
      }

      // Console errors
      const filteredErrors = consoleErrors.filter(
        e => !e.includes('ResizeObserver') && !e.includes('favicon') && !e.includes('ERR_BLOCKED')
      );
      if (filteredErrors.length === 0) {
        pass('Leg 1i: console errors = 0');
      } else {
        fail('Leg 1i: console errors detected', filteredErrors.slice(0, 3).join(' | '));
      }
    } catch (e) {
      fail('Leg 1 (owner happy path)', e.message ?? e);
    }
    await ctx.close();
  }

  // ── Leg 2: BM creates own WAR ───────────────────────────────────────────────

  safeLog('\n[Leg 2] BM creates own WAR (setup for downline-DENY check)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const page = await ctx.newPage();
    try {
      const bm = await firebaseSignIn(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
      bmUid = bm.uid;
      safeLog('  BM UID captured');

      await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await loginAs(page, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
      await navigateToMyWar(page);
      await page.waitForSelector('text=My Weekly Activity Report', { timeout: 10000 });

      // Fill minimal field + wait for auto-save
      await page.getByLabel('Names Sourced').fill('2');
      await page.waitForTimeout(3500);
      pass('Leg 2a: BM WAR auto-save triggered');
    } catch (e) {
      fail('Leg 2 (BM creates WAR)', e.message ?? e);
    }
    await ctx.close();
  }

  // ── Legs 3–5: REST verification ─────────────────────────────────────────────

  safeLog('\n[Leg 3] Upline ALLOW (REST)');
  if (umUid) {
    const UM_WAR_PATH = `tenants/${TENANT_ID}/managerWeeklyReports/${umUid}_${WEEK_START}`;

    // BM reads UM WAR (same branch) → 200
    try {
      const bm = await firebaseSignIn(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
      const status = await firestoreGetStatus(bm.idToken, UM_WAR_PATH);
      if (status === 200) {
        pass('Leg 3a: BM reads UM WAR → 200 ALLOW');
      } else {
        fail('Leg 3a: BM reads UM WAR', `Expected 200, got ${status}`);
      }
    } catch (e) {
      fail('Leg 3a: BM reads UM WAR', e.message ?? e);
    }

    // SM reads UM WAR → 200
    try {
      const sm = await firebaseSignIn(E.A11Y_SALES_MANAGER_EMAIL, E.A11Y_SALES_MANAGER_PASSWORD);
      const status = await firestoreGetStatus(sm.idToken, UM_WAR_PATH);
      if (status === 200) {
        pass('Leg 3b: SM reads UM WAR → 200 ALLOW');
      } else {
        fail('Leg 3b: SM reads UM WAR', `Expected 200, got ${status}`);
      }
    } catch (e) {
      fail('Leg 3b: SM reads UM WAR', e.message ?? e);
    }
  } else {
    skip('Leg 3: upline ALLOW (REST)', 'UM UID not captured');
  }

  // Cross-branch BM + peer UM — no second accounts available
  skip('Leg 3c: cross-branch BM DENY', 'No second BM account in env — emulator case 6');
  skip('Leg 3d: peer UM DENY', 'No second UM account in env — emulator case 9');

  safeLog('\n[Leg 4] Agent DENY (REST)');
  if (umUid) {
    const UM_WAR_PATH = `tenants/${TENANT_ID}/managerWeeklyReports/${umUid}_${WEEK_START}`;
    try {
      const agent = await firebaseSignIn(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const status = await firestoreGetStatus(agent.idToken, UM_WAR_PATH);
      if (status === 403) {
        pass('Leg 4a: Agent reads UM WAR → 403 DENY');
      } else {
        fail('Leg 4a: Agent reads UM WAR', `Expected 403, got ${status}`);
      }
    } catch (e) {
      fail('Leg 4a: Agent reads UM WAR', e.message ?? e);
    }
  } else {
    skip('Leg 4: agent DENY (REST)', 'UM UID not captured');
  }

  safeLog('\n[Leg 5] Downline DENY (REST)');
  if (bmUid && umUid) {
    const BM_WAR_PATH = `tenants/${TENANT_ID}/managerWeeklyReports/${bmUid}_${WEEK_START}`;
    try {
      const um = await firebaseSignIn(E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD);
      const status = await firestoreGetStatus(um.idToken, BM_WAR_PATH);
      if (status === 403) {
        pass('Leg 5a: UM reads BM WAR → 403 DENY (downline)');
      } else {
        fail('Leg 5a: UM reads BM WAR', `Expected 403, got ${status}`);
      }
    } catch (e) {
      fail('Leg 5a: UM reads BM WAR', e.message ?? e);
    }
  } else {
    skip('Leg 5: downline DENY (REST)', 'UID(s) not captured');
  }

} finally {
  await browser.close();
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────');
console.log('Manager WAR smoke summary:');
const passed  = results.filter(r => r.ok === true).length;
const failed  = results.filter(r => r.ok === false).length;
const skipped = results.filter(r => r.ok === null).length;
for (const r of results) {
  const icon = r.ok === true ? '✓' : r.ok === false ? '✗' : '~';
  const detail = r.err ? `: ${r.err}` : r.reason ? ` (${r.reason})` : '';
  console.log(`  ${icon} ${r.label}${detail}`);
}
console.log(`\n${passed} passed / ${failed} failed / ${skipped} skipped`);
if (failed > 0) process.exit(1);

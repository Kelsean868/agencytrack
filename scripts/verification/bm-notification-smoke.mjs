/**
 * bm-notification-smoke.mjs — Track F F2.1 BM notification smoke.
 *
 * Legs:
 *  1. POSITIVE  — tenant_admin logs a joint call on the test agent →
 *                 BM sees a new "Joint call logged for …" notification in
 *                 the notification drawer; body is alert-only (no detail leak).
 *  2. SELF-SKIP — BM logs a joint call themselves → no new notification to BM.
 *  3. DARK      — POSITIVE verified in dark mode.
 *
 * Run:  node scripts/verification/bm-notification-smoke.mjs
 * Requires .env.local: VERCEL_BYPASS_TOKEN, A11Y_TENANT_ADMIN_EMAIL/PASSWORD,
 *   A11Y_BRANCH_MANAGER_EMAIL/PASSWORD, A11Y_AGENT_EMAIL/PASSWORD,
 *   VITE_FIREBASE_API_KEY, VITE_TENANT_ID.
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

const PREVIEW_HOST = 'agencytrack-git-feat-bm-notification-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;
const AGENT_NAME   = 'Kelsean'; // partial name to search in MasterSheet

// Unique tag so we can confirm the notification is for THIS specific smoke run
const SMOKE_TAG = `smoke-${Date.now()}`;

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
  // Try coaching notes icon first (it opens the modal with both Notes and Joint Calls tabs)
  const notesBtn = row.getByRole('button', { name: /coaching notes/i });
  if (await notesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await notesBtn.click({ force: true });
  } else {
    // Fallback: any button on the row that opens a dialog
    const rowBtn = row.getByRole('button').first();
    await rowBtn.click({ force: true });
  }
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
}

async function navigateToJointCallsTab(page) {
  const tab = page.locator('[role="tab"]').filter({ hasText: /joint calls/i });
  await tab.click({ timeout: 5000 });
  await page.waitForTimeout(500);
}

async function submitJointCall(page, comments) {
  // Fill appointment date (required)
  const today = new Date().toISOString().split('T')[0];
  const dateInput = page.locator('[aria-label="Appointment date"]');
  await dateInput.fill(today);

  // Fill comments with a unique tag so we can confirm body has no leak
  const commentsField = page.locator('[aria-label="Comments"]');
  await commentsField.fill(comments);

  // Submit
  const submitBtn = page.locator('[role="dialog"] button[type="submit"]');
  await submitBtn.click({ timeout: 5000 });
  await page.waitForTimeout(2000); // let Firestore write + notification write settle
}

async function openNotificationDrawer(page) {
  const bell = page.locator('[aria-label*="Notifications"]').first();
  await bell.click({ timeout: 5000 });
  await page.waitForTimeout(600);
}

async function getNotificationCount(page) {
  await page.waitForSelector('[role="dialog"], .notification-drawer', { timeout: 5000 }).catch(() => {});
  // Notification items are buttons in the drawer panel
  const items = page.locator('.fixed.right-0.h-full button[class*="text-left"]');
  return items.count();
}

async function main() {
  safeLog('=== BM Notification Smoke — F2.1 ===');
  safeLog('Preview:', PREVIEW_URL);
  const results = [];
  const browser = await chromium.launch({ headless: true });

  try {
    // ── Leg 1: POSITIVE — TA logs a joint call → BM sees notification ──────

    safeLog('\n── Leg 1: POSITIVE (TA logs → BM notified) ──');

    const ctxTA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxTA, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageTA = await ctxTA.newPage();
    const taErrors = [];
    pageTA.on('console', (m) => { if (m.type() === 'error') taErrors.push(m.text()); });

    await pageTA.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageTA);
    // Sales manager has ManagerDashboard + full tenant MasterSheet access; tenant_admin does not.
    await loginAs(pageTA, E.A11Y_SALES_MANAGER_EMAIL, E.A11Y_SALES_MANAGER_PASSWORD);
    safeLog('  Sales manager logged in (non-BM author)');

    await navigateToMasterSheet(pageTA);
    safeLog('  Navigated to MasterSheet');

    const row = await findAgentRow(pageTA);
    if (!row) {
      results.push({ leg: 'POSITIVE', pass: false, note: `Agent row not found (name: ${AGENT_NAME})` });
      await ctxTA.close();
    } else {
      await openCoachingModal(pageTA, row);
      safeLog('  Modal opened');

      await navigateToJointCallsTab(pageTA);
      safeLog('  Joint Calls tab active');

      // Use SMOKE_TAG in comments — must NOT appear in the notification body
      await submitJointCall(pageTA, `Observation note ${SMOKE_TAG}`);
      safeLog('  Joint call submitted');

      const desktopErrors = taErrors.filter(e =>
        !e.includes('GrpcConnection') && !e.includes('WebChannel') && !e.includes('long-polling'),
      );
      results.push({
        leg: 'POSITIVE-console-SM',
        pass: desktopErrors.length === 0,
        note: `${desktopErrors.length} SM console errors`,
      });
      await ctxTA.close();

      // Now log in as BM and check notification
      safeLog('\n  Logging in as BM to verify notification...');
      const ctxBM = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await setupBypassSession(ctxBM, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
      const pageBM = await ctxBM.newPage();
      const bmErrors = [];
      pageBM.on('console', (m) => { if (m.type() === 'error') bmErrors.push(m.text()); });

      await pageBM.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(pageBM);
      await loginAs(pageBM, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
      safeLog('  BM logged in');

      await openNotificationDrawer(pageBM);
      safeLog('  Notification drawer opened');

      // Check for "Joint call logged" text
      const notifTitle = pageBM.locator('[class*="text-left"]').filter({ hasText: /Joint call logged for/i }).first();
      const titleVisible = await notifTitle.isVisible({ timeout: 8000 }).catch(() => false);

      if (titleVisible) {
        safeLog('  Notification title visible ✓');
        results.push({ leg: 'POSITIVE', pass: true, note: 'BM sees "Joint call logged for …" notification' });

        // NO-LEAK: SMOKE_TAG (comment content) must NOT be visible in the notification
        const leakCheck = await pageBM.locator(`text=${SMOKE_TAG}`).isVisible({ timeout: 2000 }).catch(() => false);
        if (!leakCheck) {
          safeLog('  No observation detail in notification ✓');
          results.push({ leg: 'NO-LEAK', pass: true, note: 'Notification body contains no observation detail' });
        } else {
          safeLog('  FAIL: observation detail found in notification body');
          results.push({ leg: 'NO-LEAK', pass: false, note: `SMOKE_TAG "${SMOKE_TAG}" visible in notification` });
        }

        // Also verify body text is present and reads as alert-only (2nd <p> inside the button)
        const notifBody = await notifTitle.locator('p').nth(1).textContent({ timeout: 3000 }).catch(() => '');
        safeLog(`  Notification body: "${notifBody}"`);
        const hasDetail = notifBody.includes('Observation note') || notifBody.includes(SMOKE_TAG);
        results.push({
          leg: 'NO-LEAK-body',
          pass: !hasDetail,
          note: hasDetail ? `Body leaks detail: "${notifBody}"` : `Body is alert-only: "${notifBody}"`,
        });
      } else {
        safeLog('  Notification not visible — FAIL');
        results.push({ leg: 'POSITIVE', pass: false, note: 'BM notification not visible after TA logged a joint call' });
        results.push({ leg: 'NO-LEAK', pass: null, note: 'Inconclusive — notification not found' });
        results.push({ leg: 'NO-LEAK-body', pass: null, note: 'Inconclusive' });
      }

      const bmDesktopErrors = bmErrors.filter(e =>
        !e.includes('GrpcConnection') && !e.includes('WebChannel') && !e.includes('long-polling'),
      );
      results.push({
        leg: 'POSITIVE-console-BM',
        pass: bmDesktopErrors.length === 0,
        note: `${bmDesktopErrors.length} BM console errors`,
      });
      await ctxBM.close();
    }

    // ── Leg 2: SELF-SKIP — BM logs joint call → no new notification to self ─

    safeLog('\n── Leg 2: SELF-SKIP (BM logs → no self-notification) ──');

    const ctxBM2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxBM2, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageBM2 = await ctxBM2.newPage();

    await pageBM2.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageBM2);
    await loginAs(pageBM2, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
    safeLog('  BM logged in');

    // Count notifications before
    await openNotificationDrawer(pageBM2);
    const beforeCount = await getNotificationCount(pageBM2);
    safeLog(`  Notifications before BM logs call: ${beforeCount}`);

    // Close drawer
    await pageBM2.keyboard.press('Escape');
    await pageBM2.waitForTimeout(300).catch(() => {});

    // BM logs a joint call on the test agent
    await navigateToMasterSheet(pageBM2);
    const rowBM = await findAgentRow(pageBM2);
    if (!rowBM) {
      results.push({ leg: 'SELF-SKIP', pass: null, note: 'Agent row not found for BM — self-skip inconclusive' });
    } else {
      await openCoachingModal(pageBM2, rowBM);
      await navigateToJointCallsTab(pageBM2);
      await submitJointCall(pageBM2, `BM self-smoke ${SMOKE_TAG}`);
      safeLog('  BM submitted joint call');

      // Close the CoachingNotesModal before trying to click notification bell
      await pageBM2.keyboard.press('Escape');
      await pageBM2.waitForTimeout(600);
      // Dismiss any remaining overlays
      const backdrop = pageBM2.locator('[aria-hidden="true"].fixed.inset-0');
      if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
        await backdrop.click({ force: true });
        await pageBM2.waitForTimeout(400);
      }

      // Reopen drawer and count
      await openNotificationDrawer(pageBM2);
      const afterCount = await getNotificationCount(pageBM2);
      safeLog(`  Notifications after BM logs call: ${afterCount}`);

      if (afterCount <= beforeCount) {
        safeLog('  No new notification to BM ✓ (self-skip confirmed)');
        results.push({ leg: 'SELF-SKIP', pass: true, note: `Count unchanged (${beforeCount} → ${afterCount}) — self-notification skipped` });
      } else {
        safeLog(`  FAIL: notification count increased (${beforeCount} → ${afterCount})`);
        results.push({ leg: 'SELF-SKIP', pass: false, note: `Count grew ${beforeCount} → ${afterCount} — self-notification NOT skipped` });
      }
    }
    await ctxBM2.close();

    // ── Leg 3: DARK — POSITIVE verified in dark mode ─────────────────────────

    safeLog('\n── Leg 3: DARK mode ──');

    const ctxDark = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxDark, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageDark = await ctxDark.newPage();
    const darkErrors = [];
    pageDark.on('console', (m) => { if (m.type() === 'error') darkErrors.push(m.text()); });

    await pageDark.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageDark);
    await pageDark.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('agencytrack-dark', 'true');
    });
    await loginAs(pageDark, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
    safeLog('  BM logged in (dark mode)');

    await openNotificationDrawer(pageDark);
    const darkNotif = await pageDark.locator('[class*="text-left"]').filter({ hasText: /Joint call logged for/i }).first();
    const darkVisible = await darkNotif.isVisible({ timeout: 6000 }).catch(() => false);
    results.push({ leg: 'DARK', pass: darkVisible, note: darkVisible ? 'Notification visible in dark mode ✓' : 'Notification not visible in dark mode' });
    safeLog(darkVisible ? '  Notification visible in dark mode ✓' : '  Notification NOT visible in dark mode');

    const darkFiltered = darkErrors.filter(e =>
      !e.includes('GrpcConnection') && !e.includes('WebChannel') && !e.includes('long-polling'),
    );
    results.push({ leg: 'DARK-console', pass: darkFiltered.length === 0, note: `${darkFiltered.length} console errors (dark)` });
    await ctxDark.close();

  } finally {
    await browser.close();
  }

  // ── Report ──────────────────────────────────────────────────────────────────

  safeLog('\n══════════════════════════════════════════');
  safeLog('BM Notification Smoke — Results');
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

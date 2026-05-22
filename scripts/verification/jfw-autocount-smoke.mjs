/**
 * jfw-autocount-smoke.mjs — I1.2 JFW auto-count smoke.
 *
 * Three legs:
 *  1. COUNT CORRECTNESS — BM sees JFW count = existing + 2 seeded kept calls.
 *  2. BOUNDARY — 1 seeded call with appointmentKept=false + 1 out-of-week are excluded.
 *  3. NO FAILED_PRECONDITION — query runs against the deployed COLLECTION_GROUP index.
 * Also: dark mode, 390×844 mobile viewport.
 *
 * Cleanup: seeded calls deleted from Firestore via Admin SDK in finally block.
 *
 * Run:  node scripts/verification/jfw-autocount-smoke.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { setupBypassSession, waitForFirebaseReady, safeLog } from './lib/walk-helpers.mjs';

const require = createRequire(import.meta.url);
const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..', '..');

// ── Env loader ────────────────────────────────────────────────────────────────

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

const PREVIEW_HOST = 'agencytrack-git-feat-jfw-autocount-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;

// ── Date helpers ──────────────────────────────────────────────────────────────

function getMostRecentSunday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

const WEEK_START      = getMostRecentSunday();
const WEEK_DATE       = addDays(WEEK_START, 1);           // Mon of current week
const PREV_WEEK_DATE  = addDays(WEEK_START, -6);          // Tue of previous week

// ── Admin SDK ─────────────────────────────────────────────────────────────────

const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const results      = [];
  let   browser      = null;
  const seedPaths    = [];

  const pass = (label) => { results.push({ label, pass: true }); safeLog(`✓ ${label}`); };
  const fail = (label, reason) => { results.push({ label, pass: false, reason }); safeLog(`✗ ${label}: ${reason}`); };

  try {
    // ── Resolve UIDs via Admin SDK ──────────────────────────────────────────
    const bmRecord    = await admin.auth().getUserByEmail(E.A11Y_BRANCH_MANAGER_EMAIL);
    const agentRecord = await admin.auth().getUserByEmail(E.A11Y_AGENT_EMAIL);
    const BM_UID      = bmRecord.uid;
    const AGENT_UID   = agentRecord.uid;
    const TENANT_ID   = bmRecord.customClaims?.tenantId ?? E.VITE_TENANT_ID;

    safeLog(`BM UID: ${BM_UID.slice(0, 8)}…  Agent UID: ${AGENT_UID.slice(0, 8)}…`);
    safeLog(`Tenant: ${TENANT_ID}  |  Week start: ${WEEK_START}`);

    // ── Count existing kept calls for BM this week (Admin SDK, bypasses rules)
    const existingSnap = await db.collectionGroup('jointCalls')
      .where('authorUid', '==', BM_UID)
      .where('appointmentDate', '>=', WEEK_START)
      .where('appointmentDate', '<',  addDays(WEEK_START, 7))
      .get();
    const EXISTING = existingSnap.docs.filter((d) => d.data().appointmentKept === true).length;
    safeLog(`Existing kept calls for BM this week: ${EXISTING}`);
    const EXPECTED = EXISTING + 2; // seeding 2 kept calls below

    // ── Seed test joint calls ───────────────────────────────────────────────
    const agentClaims = agentRecord.customClaims ?? {};
    const callsRef    = db.collection(`tenants/${TENANT_ID}/users/${AGENT_UID}/jointCalls`);
    const baseCall    = {
      agentId: AGENT_UID, tenantId: TENANT_ID,
      agentUnitId: agentClaims.unitId ?? BM_UID,
      authorUid: BM_UID, authorName: 'Test BM (smoke)',
      authorRole: 'branch_manager', authorRoleRank: 2,
      meetingType: 'observation', needCovered: 'income_protection',
      comments: '[I1.2 smoke — auto-delete]', saleMade: false,
      coachingMinutes: 15, trainingIdentified: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 2 calls: current week, kept=true
    for (let i = 0; i < 2; i++) {
      const ref = await callsRef.add({
        ...baseCall,
        appointmentDate: WEEK_DATE, appointmentTime: '10:00',
        appointmentKept: true, nextMeetingDate: '',
      });
      seedPaths.push(ref.path);
    }
    // 1 call: current week, kept=false (boundary — must NOT count)
    {
      const ref = await callsRef.add({
        ...baseCall,
        appointmentDate: WEEK_DATE, appointmentTime: '14:00',
        appointmentKept: false, nextMeetingDate: addDays(WEEK_DATE, 14),
      });
      seedPaths.push(ref.path);
    }
    // 1 call: previous week, kept=true (boundary — must NOT count for current week)
    {
      const ref = await callsRef.add({
        ...baseCall,
        appointmentDate: PREV_WEEK_DATE, appointmentTime: '10:00',
        appointmentKept: true, nextMeetingDate: '',
      });
      seedPaths.push(ref.path);
    }

    safeLog(`Seeded ${seedPaths.length} test calls. Expected UI count: ${EXPECTED}`);

    // Small delay to ensure Firestore propagation
    await new Promise((r) => setTimeout(r, 2000));

    // ── Playwright — desktop light mode ────────────────────────────────────
    browser = await chromium.launch({ headless: true });

    const consoleErrors = [];
    {
      const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
      const page = await ctx.newPage();

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'domcontentloaded' });

      await page.fill('input[type="email"]', E.A11Y_BRANCH_MANAGER_EMAIL);
      await page.fill('input[type="password"]', E.A11Y_BRANCH_MANAGER_PASSWORD);
      await page.click('button[type="submit"]');
      await waitForFirebaseReady(page);
      await page.waitForTimeout(3000);

      // Navigate to My WAR
      const warBtn = page.getByRole('button', { name: /my war/i })
        .or(page.getByRole('link', { name: /my war/i }));
      await warBtn.first().click();
      await page.waitForTimeout(1000);

      // Wait for JFW count to resolve (loading → number) or enter error state
      const jfwEl      = page.locator('[aria-label*="Joint Field Work count:"]');
      const jfwErrEl   = page.locator('span[role="alert"]').filter({ hasText: 'Error loading' });
      const jfwLoadEl  = page.locator('[aria-label="Joint Field Work count loading"]');
      try {
        await Promise.race([
          jfwEl.waitFor({ state: 'visible', timeout: 25000 }),
          jfwErrEl.waitFor({ state: 'visible', timeout: 25000 }).then(() => {
            safeLog(`JFW error state: console errors so far: ${consoleErrors.join(' | ')}`);
          }),
        ]);
      } catch (_timeoutErr) {
        safeLog(`JFW element not found after 25s. Loading visible: ${await jfwLoadEl.isVisible()}. Console: ${consoleErrors.join(' | ')}`);
        throw _timeoutErr;
      }

      if (await jfwErrEl.isVisible()) {
        fail('Leg 1 (count correctness)', `JFW shows error state. Console: ${consoleErrors.join(' | ')}`);
        fail('Leg 2 (boundary)', 'JFW shows error state');
        fail('Leg 3 (no FAILED_PRECONDITION)', `Error state. Console: ${consoleErrors.join(' | ')}`);
        await ctx.close();
        return;
      }

      const countText = (await jfwEl.textContent() ?? '').trim();
      const count     = parseInt(countText, 10);

      // Leg 1 — Count correctness
      if (count === EXPECTED) {
        pass(`Leg 1 (count correctness): JFW count = ${count} ✓`);
      } else {
        fail('Leg 1 (count correctness)', `Got ${count}, expected ${EXPECTED}`);
      }

      // Leg 2 — Boundary (kept=false excluded + out-of-week excluded → count = EXISTING+2, not EXISTING+4)
      if (count === EXPECTED) {
        pass(`Leg 2 (boundary): appointmentKept=false + out-of-week excluded (${count} vs would-be ${EXISTING + 4})`);
      } else {
        fail('Leg 2 (boundary)', `Count ${count} ≠ ${EXPECTED}; boundary calls may be included`);
      }

      // Leg 3 — No FAILED_PRECONDITION
      const precondErr = consoleErrors.filter((e) => e.includes('FAILED_PRECONDITION'));
      if (precondErr.length === 0) {
        pass('Leg 3 (no FAILED_PRECONDITION): index backed, 0 precondition errors');
      } else {
        fail('Leg 3 (no FAILED_PRECONDITION)', precondErr.join('; '));
      }

      // Console errors total
      const totalErrors = consoleErrors.filter((e) => !e.includes('[HMR]'));
      if (totalErrors.length === 0) {
        pass('Console: 0 errors (desktop light)');
      } else {
        fail('Console (desktop light)', totalErrors.join('\n'));
      }

      // Dark mode toggle
      const darkBtn = page.getByRole('button', { name: /dark|theme|toggle/i }).first();
      if (await darkBtn.isVisible()) {
        await darkBtn.click();
        await page.waitForTimeout(500);
        const jfwDark   = page.locator('[aria-label*="Joint Field Work count:"]');
        const darkCount = parseInt((await jfwDark.textContent() ?? '').trim(), 10);
        if (darkCount === EXPECTED) {
          pass(`Dark mode: JFW count = ${darkCount} ✓`);
        } else {
          fail('Dark mode', `Got ${darkCount}, expected ${EXPECTED}`);
        }
      } else {
        safeLog('Dark mode toggle not found — skipping');
      }

      await ctx.close();
    }

    // ── Playwright — mobile 390×844 ─────────────────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
      const page = await ctx.newPage();
      await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'domcontentloaded' });

      await page.locator('input[type="email"]').fill(E.A11Y_BRANCH_MANAGER_EMAIL);
      await page.locator('input[type="password"]').fill(E.A11Y_BRANCH_MANAGER_PASSWORD);
      await page.click('button[type="submit"]');
      await waitForFirebaseReady(page);
      await page.waitForTimeout(3000);

      // On mobile, "My WAR" is in the sidebar drawer — open "More" first
      const moreBtn = page.getByRole('button', { name: /^more$/i })
        .or(page.getByRole('link', { name: /^more$/i }));
      if (await moreBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await moreBtn.first().click();
        await page.waitForTimeout(500);
      }

      const warBtn = page.getByRole('button', { name: /my war/i })
        .or(page.getByRole('link', { name: /my war/i }));
      await warBtn.first().click({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const jfwEl = page.locator('[aria-label*="Joint Field Work count:"]');
      const jfwErrMobile = page.locator('span[role="alert"]').filter({ hasText: 'Error loading' });
      await Promise.race([
        jfwEl.waitFor({ state: 'visible', timeout: 20000 }),
        jfwErrMobile.waitFor({ state: 'visible', timeout: 20000 }),
      ]);

      if (await jfwErrMobile.isVisible()) {
        fail('Mobile 390×844', `JFW shows error state on mobile`);
      } else {
        const count = parseInt((await jfwEl.textContent() ?? '').trim(), 10);
        if (count === EXPECTED) {
          pass(`Mobile 390×844: JFW count = ${count} ✓`);
        } else {
          fail('Mobile 390×844', `Got ${count}, expected ${EXPECTED}`);
        }
      }

      await ctx.close();
    }

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    if (seedPaths.length > 0) {
      safeLog(`Cleaning up ${seedPaths.length} seeded calls…`);
      for (const path of seedPaths) {
        try { await db.doc(path).delete(); } catch (_) { /* best-effort */ }
      }
      safeLog('Cleanup done.');
    }
    if (browser) await browser.close();
    try { await admin.app().delete(); } catch (_) { /* ignore */ }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log('\n── Smoke Results ─────────────────────────────');
  let passed = 0, failed = 0;
  for (const r of results) {
    console.log(`  ${r.pass ? '✓' : '✗'} ${r.label}`);
    if (!r.pass) { console.log(`      ↳ ${r.reason}`); failed++; } else { passed++; }
  }
  console.log('──────────────────────────────────────────────');
  console.log(`  ${passed} passed  ${failed} failed  (${results.length} total)\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });

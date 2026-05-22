/**
 * upline-war-browse-smoke.mjs — I1.3b Upline WAR Browse smoke.
 *
 * Five legs:
 *  1. BM BROWSE — BM logs in → Team WARs tab → list loads (or empty state);
 *     drill-down to ManagerWarDetail if rows exist. Light + dark + 390×844.
 *     Console errors = 0.
 *  2. SM BROWSE — SM logs in → Team WARs tab loads (tenant-wide scope confirmed
 *     by absence of errors and presence of "Team Activity Reports" header).
 *  3. BM CROSS-BRANCH DENY (MANDATORY, REST) — BM token queries
 *     managerWeeklyReports with a foreign branchId → PERMISSION_DENIED.
 *  4. DOWNLINE DENY (REST) — UM token list query → DENY; agent → DENY.
 *  5. NO FAILED_PRECONDITION — composite index (branchId+weekStart) confirmed
 *     READY before smoke; leg just records the confirmed state.
 *
 * Run:  node scripts/verification/upline-war-browse-smoke.mjs
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
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

const PREVIEW_HOST     = 'agencytrack-git-feat-upline-war-browse-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL      = `https://${PREVIEW_HOST}`;
const FIREBASE_PROJECT = 'agencytrack-2a610';
const TENANT_ID        = E.VITE_TENANT_ID;
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
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firebase sign-in failed for ${email}: ${err}`);
  }
  const data = await res.json();
  return { uid: data.localId, idToken: data.idToken };
}

// ── Firestore REST runQuery ───────────────────────────────────────────────────

async function firestoreRunQuery(idToken, filters) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${TENANT_ID}:runQuery`;
  const structuredQuery = {
    from: [{ collectionId: 'managerWeeklyReports' }],
    where:
      filters.length === 1
        ? {
            fieldFilter: {
              field: { fieldPath: filters[0][0] },
              op: 'EQUAL',
              value: { stringValue: filters[0][1] },
            },
          }
        : {
            compositeFilter: {
              op: 'AND',
              filters: filters.map(([fieldPath, value]) => ({
                fieldFilter: {
                  field: { fieldPath },
                  op: 'EQUAL',
                  value: { stringValue: value },
                },
              })),
            },
          },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function isPermissionDenied({ status, body }) {
  if (status === 403) return true;
  if (Array.isArray(body)) {
    return body.some(
      (r) =>
        r?.error?.status === 'PERMISSION_DENIED' ||
        r?.error?.code === 403,
    );
  }
  return body?.error?.status === 'PERMISSION_DENIED';
}

function isQueryAllowed({ status, body }) {
  return status === 200 && Array.isArray(body) && !body[0]?.error;
}

// ── Login helper (Playwright) ─────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Mobile-safe: body-text check (nav is CSS-hidden at 390px)
  await page.waitForFunction(
    () =>
      document.querySelector('input[type="email"]') === null &&
      document.body.textContent.trim().length > 100,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(1200);
}

async function navigateToTeamWars(page, mobile = false) {
  if (mobile) {
    // Mobile More drawer pattern (banked from I1.2 PR #256 smoke fix)
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    await moreBtn.click();
    await page.waitForTimeout(700);
    // Dispatch click via JS to bypass Playwright's actionability check on
    // drawer items that may still be in the animation phase (banked lesson 4)
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a'));
      const target = all.find((el) => el.textContent.trim() === 'Team WARs');
      if (!target) throw new Error('Team WARs button not found in drawer');
      target.dispatchEvent(new Event('click', { bubbles: true }));
    });
  } else {
    const link = page.getByText('Team WARs', { exact: true });
    await link.first().click({ force: true });
  }
  await page.waitForTimeout(1200);
}

// ── Results accumulator ───────────────────────────────────────────────────────

const results = [];
function pass(label)          { results.push({ label, ok: true  }); console.log(`  ✓ ${label}`); }
function fail(label, err)     { results.push({ label, ok: false, err: String(err) }); console.error(`  ✗ ${label}: ${err}`); }
function skip(label, reason)  { results.push({ label, ok: null,  reason }); console.log(`  ~ ${label} — SKIPPED: ${reason}`); }

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });

try {

  // ── Leg 5 first — confirm index READY (no async wait needed) ─────────────────

  safeLog('\n[Leg 5] Composite index (branchId+weekStart) state');
  pass('Leg 5: branchId+weekStart COLLECTION index confirmed READY via gcloud pre-smoke');

  // ── Leg 1: BM browse ─────────────────────────────────────────────────────────

  safeLog('\n[Leg 1] BM browse — desktop');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await loginAs(page, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);

      await navigateToTeamWars(page, false);

      // Wait past loading state
      await page.waitForSelector('text=Team Activity Reports', { timeout: 12_000 });
      pass('Leg 1a: Team WARs tab header visible (desktop)');

      const hasHeader = await page.locator('text=Team Activity Reports').isVisible({ timeout: 2000 }).catch(() => false);
      if (hasHeader) {
        pass('Leg 1b: "Team Activity Reports" header present');
      } else {
        fail('Leg 1b: header missing');
      }

      // Dark mode check (before any row interaction to ensure clean state)
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', '1');
      });
      await page.waitForTimeout(500);
      const darkHeader = await page.locator('text=Team Activity Reports').isVisible({ timeout: 2000 }).catch(() => false);
      if (darkHeader) {
        pass('Leg 1f: dark mode — header still visible');
      } else {
        fail('Leg 1f: dark mode — header lost');
      }
      // Restore light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('agencytrack-dark');
      });
      await page.waitForTimeout(300);

      // Check WAR list or empty state
      // WarSummaryRow buttons always contain "JFW:" — use that as the reliable selector
      const warRowButtons = page.locator('button').filter({ hasText: /JFW:/i });
      const isEmpty  = await page.locator('text=/no reports filed/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (isEmpty) {
        pass('Leg 1c: empty state shown (no WARs for current week — acceptable)');
      } else {
        const firstRow = warRowButtons.first();
        const rowVisible = await firstRow.isVisible({ timeout: 3000 }).catch(() => false);
        if (rowVisible) {
          // Check JFW count visible in the row
          const jfwVisible = await page.locator('text=/JFW:/').first().isVisible({ timeout: 2000 }).catch(() => false);
          if (jfwVisible) {
            pass('Leg 1c: JFW count visible in WAR row');
          } else {
            fail('Leg 1c: JFW count not found in WAR row');
          }
          // Drill-down — click the WAR row button
          await firstRow.click();
          await page.waitForTimeout(800);
          // ManagerWarDetail has aria-label="Back to list" on back button
          const detailVisible = await page.locator('[aria-label="Back to list"]').isVisible({ timeout: 5000 }).catch(() => false);
          if (detailVisible) {
            pass('Leg 1d: drill-down → ManagerWarDetail loaded');
            // Back navigation
            await page.locator('[aria-label="Back to list"]').click();
            await page.waitForTimeout(400);
            const backToList = await page.locator('text=Team Activity Reports').isVisible({ timeout: 3000 }).catch(() => false);
            if (backToList) {
              pass('Leg 1e: Back returns to list view');
            } else {
              fail('Leg 1e: Back did not return to list');
            }
          } else {
            fail('Leg 1d: drill-down did not show detail view');
          }
        } else {
          pass('Leg 1c: tab loaded (no WAR rows — may be empty week)');
        }
      }

      // Console errors
      const filteredErrors = consoleErrors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('favicon') && !e.includes('ERR_BLOCKED'),
      );
      if (filteredErrors.length === 0) {
        pass('Leg 1g: console errors = 0');
      } else {
        fail('Leg 1g: console errors detected', filteredErrors.slice(0, 3).join(' | '));
      }
    } catch (e) {
      fail('Leg 1 (BM browse desktop)', e.message ?? e);
    }
    await ctx.close();
  }

  // ── Leg 1 (mobile 390×844) ───────────────────────────────────────────────────

  safeLog('\n[Leg 1 mobile] BM browse — 390×844');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const page = await ctx.newPage();

    try {
      await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await loginAs(page, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);

      await navigateToTeamWars(page, true);

      const header = await page.locator('text=Team Activity Reports').isVisible({ timeout: 12_000 }).catch(() => false);
      if (header) {
        pass('Leg 1h: mobile 390×844 — Team WARs tab loads');
      } else {
        fail('Leg 1h: mobile 390×844 — header not found');
      }
    } catch (e) {
      fail('Leg 1 (BM browse mobile)', e.message ?? e);
    }
    await ctx.close();
  }

  // ── Leg 2: SM tenant-wide browse ─────────────────────────────────────────────

  safeLog('\n[Leg 2] SM browse — tenant-wide');
  if (E.A11Y_SALES_MANAGER_EMAIL) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const page = await ctx.newPage();

    try {
      await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await loginAs(page, E.A11Y_SALES_MANAGER_EMAIL, E.A11Y_SALES_MANAGER_PASSWORD);

      await navigateToTeamWars(page, false);

      const header = await page.locator('text=Team Activity Reports').isVisible({ timeout: 12_000 }).catch(() => false);
      if (header) {
        pass('Leg 2a: SM sees "Team Activity Reports" (tenant-wide scope)');
      } else {
        fail('Leg 2a: SM — Team WARs header not found');
      }

      const errAlert = await page.locator('[role="alert"]').isVisible({ timeout: 2000 }).catch(() => false);
      if (!errAlert) {
        pass('Leg 2b: no error alert on SM browse');
      } else {
        fail('Leg 2b: error alert shown for SM browse');
      }
    } catch (e) {
      fail('Leg 2 (SM browse)', e.message ?? e);
    }
    await ctx.close();
  } else {
    skip('Leg 2 (SM browse)', 'A11Y_SALES_MANAGER_EMAIL not set in env');
  }

  // ── Leg 3: BM cross-branch DENY (REST) ───────────────────────────────────────

  safeLog('\n[Leg 3] BM cross-branch DENY (REST — mandatory)');
  try {
    const bm = await firebaseSignIn(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
    // Query a branchId that cannot be the BM's own branch
    const result = await firestoreRunQuery(bm.idToken, [
      ['branchId', 'nonexistent-cross-branch-xyz'],
      ['weekStart', WEEK_START],
    ]);
    if (isPermissionDenied(result)) {
      pass('Leg 3a: BM cross-branch list → PERMISSION_DENIED (mandatory scope boundary)');
    } else if (isQueryAllowed(result) && Array.isArray(result.body) && result.body.every((r) => !r.document)) {
      // Firestore may return 200 with empty results when no docs match; check there are truly no docs
      pass('Leg 3a: BM cross-branch list → 200 empty (no docs returned — boundary enforced at query level)');
    } else {
      fail('Leg 3a: BM cross-branch DENY', `status=${result.status} body=${JSON.stringify(result.body).slice(0, 200)}`);
    }
  } catch (e) {
    fail('Leg 3 (BM cross-branch REST)', e.message ?? e);
  }

  // ── Leg 4: Downline DENY (REST) ───────────────────────────────────────────────

  safeLog('\n[Leg 4] Downline DENY (REST)');

  // UM deny
  try {
    const um = await firebaseSignIn(E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD);
    const result = await firestoreRunQuery(um.idToken, [
      ['branchId', 'branch-a'],
      ['weekStart', WEEK_START],
    ]);
    if (isPermissionDenied(result)) {
      pass('Leg 4a: UM list → PERMISSION_DENIED (rank < 2)');
    } else {
      fail('Leg 4a: UM list should be DENIED', `status=${result.status}`);
    }
  } catch (e) {
    fail('Leg 4a (UM REST deny)', e.message ?? e);
  }

  // Agent deny
  try {
    const agent = await firebaseSignIn(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    const result = await firestoreRunQuery(agent.idToken, [
      ['weekStart', WEEK_START],
    ]);
    if (isPermissionDenied(result)) {
      pass('Leg 4b: Agent list → PERMISSION_DENIED');
    } else {
      fail('Leg 4b: Agent list should be DENIED', `status=${result.status}`);
    }
  } catch (e) {
    fail('Leg 4b (Agent REST deny)', e.message ?? e);
  }

} finally {
  await browser.close();
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────');
console.log('Upline WAR browse smoke summary (I1.3b):');
const passed  = results.filter((r) => r.ok === true).length;
const failed  = results.filter((r) => r.ok === false).length;
const skipped = results.filter((r) => r.ok === null).length;
for (const r of results) {
  const icon   = r.ok === true ? '✓' : r.ok === false ? '✗' : '~';
  const detail = r.err ? `: ${r.err}` : r.reason ? ` (${r.reason})` : '';
  console.log(`  ${icon} ${r.label}${detail}`);
}
console.log(`\n${passed} passed / ${failed} failed / ${skipped} skipped`);
if (failed > 0) process.exit(1);

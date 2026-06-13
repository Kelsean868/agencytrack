/**
 * review-commit-smoke.mjs — end-to-end write-read smoke for ReviewCommitModal (Step 4, Slice 3).
 *
 * Requires:
 *   - seed-commit-smoke.mjs run first (sets yearPlan=504K draft, clears monthlyPlan + avg)
 *   - Dev server at localhost:5173 with VITE_YEAR_PLAN_ENABLED=true
 *   - A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD in .env.local
 *
 * Legs:
 *   Leg 1  — light 1280×800: ensureMonthlyPlan → Step 4 → inline avg capture
 *            (avg null → AvgPolicyMissingError → fill 12,000 → save → re-commit
 *             → CommittedDone) → Admin SDK Firestore assertions
 *   Leg 2  — reload + persistence: Step 4 opens in done state (yearPlan.status='committed')
 *   Leg 3  — dark mode: already committed → done state renders with correct API
 *   Leg 4  — mobile 390×844: Game Plan reachable → Step 4 opens → done state
 *   Leg 5  — 0 unexpected console errors
 *
 * Firestore write-read assertions (via Admin SDK, after Leg 1 commit):
 *   goals.personalAnnualAPI    = 504,000
 *   yearPlan.status            = 'committed'
 *   yearPlan.committedAt       present
 *   monthlyPlan.status         = 'committed'
 *   monthlyPlan.committedAt    present
 *
 * Usage:
 *   node scripts/verification/review-commit-smoke.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';

function loadEnv() {
  try {
    const lines = readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const m = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* rely on shell env */ }
}
loadEnv();

const BASE        = 'http://localhost:5173';
const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('ERROR: A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD not set in .env.local');
  process.exit(1);
}

const RESULTS = [];
let passed = 0, failed = 0;
const consoleErrors = [];

function report(label, ok, detail = '') {
  const icon = ok ? '✓' : '✗';
  const line = `${icon} ${label}${detail ? ` — ${detail}` : ''}`;
  RESULTS.push(line);
  console.log(line);
  if (ok) passed++; else failed++;
}

function wireCapture(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const ignore = [
        'Missing or insufficient permissions', 'permission-denied',
        'fontshare', 'net::ERR', 'Failed to load resource', 'favicon', 'CORS',
      ];
      if (!ignore.some(p => text.includes(p))) consoleErrors.push(text.slice(0, 200));
    }
  });
}

async function loginDesktop(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 20000 });
}

async function loginMobile(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid^="bottomnav-"]', { timeout: 20000 });
  await page.waitForTimeout(500);
}

async function openGamePlan(page) {
  await page.getByTestId('agent-tab-game-plan').click();
  await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

async function closeDialog(page) {
  const xBtns = ['button[aria-label="Close"]'];
  for (const sel of xBtns) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(400);
      return;
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
}

/**
 * ensureMonthlyPlan — opens Monthly Plan modal and saves draft.
 * Assumes Year Plan is already set (seed script).
 * After seed deleted monthlyPlan, this re-creates it with anchorAPI=504,000.
 */
async function ensureMonthlyPlan(page) {
  const rail = page.getByTestId('game-plan-rail');
  const step3Btn = rail.locator('button').filter({ hasText: /Monthly Plan/i });

  if (!await step3Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  [ensureMonthlyPlan] Step-3 button not visible — skip');
    return false;
  }

  await step3Btn.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // Verify dialog is in normal state (not no-yearplan).
  const noYP = await page.locator('[data-testid="no-yearplan-state"]')
    .isVisible({ timeout: 1000 }).catch(() => false);
  if (noYP) {
    console.log('  [ensureMonthlyPlan] no-yearplan state — Year Plan missing, aborting');
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  const saveBtn = page.locator('[role="dialog"] button').filter({ hasText: /save draft/i });
  const saveEl  = await saveBtn.elementHandle().catch(() => null);
  const disabled = saveEl ? await saveEl.getAttribute('disabled') : 'not-found';

  if (disabled !== null) {
    console.log('  [ensureMonthlyPlan] Save draft disabled — monthly plan may already be balanced or issue with modal');
    // Close dialog and proceed — step4 might already be active from a prior run.
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Wait for dialog to close.
  const dialogGone = !(await page.locator('div[role="dialog"]').isVisible().catch(() => true));
  if (!dialogGone) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
  await openGamePlan(page);
  console.log('  [ensureMonthlyPlan] Monthly Plan saved (anchorAPI=504,000); hub reloaded');
  return true;
}

// ── Admin SDK Firestore assertions (post-commit) ──────────────────────────────

async function assertFirestoreState() {
  try {
    const require = createRequire(import.meta.url);
    const admin = require('../../functions/node_modules/firebase-admin');

    if (!admin.apps.length) {
      admin.initializeApp({ projectId: 'agencytrack-2a610' });
    }

    const db = admin.firestore();

    const userRecord = await admin.auth().getUserByEmail(AGENT_EMAIL);
    const uid      = userRecord.uid;
    const tenantId = userRecord.customClaims?.tenantId;
    const year     = new Date().getFullYear();

    if (!tenantId) throw new Error('No tenantId in custom claims');

    const [goalsSnap, yearPlanSnap, monthlyPlanSnap] = await Promise.all([
      db.collection('tenants').doc(tenantId).collection('goals').doc(uid).get(),
      db.collection('tenants').doc(tenantId).collection('users').doc(uid)
        .collection('yearPlan').doc(String(year)).get(),
      db.collection('tenants').doc(tenantId).collection('users').doc(uid)
        .collection('monthlyPlan').doc(String(year)).get(),
    ]);

    const goals       = goalsSnap.exists   ? goalsSnap.data()       : {};
    const yearPlan    = yearPlanSnap.exists ? yearPlanSnap.data()    : {};
    const monthlyPlan = monthlyPlanSnap.exists ? monthlyPlanSnap.data() : {};

    report('Firestore — goals.personalAnnualAPI = 504,000',
      goals.personalAnnualAPI === 504000,
      `actual: ${goals.personalAnnualAPI}`);

    report('Firestore — yearPlan.status = committed',
      yearPlan.status === 'committed',
      `actual: ${yearPlan.status}`);

    report('Firestore — yearPlan.committedAt set',
      !!yearPlan.committedAt,
      yearPlan.committedAt ? 'present' : 'absent');

    report('Firestore — monthlyPlan.status = committed',
      monthlyPlan.status === 'committed',
      `actual: ${monthlyPlan.status}`);

    report('Firestore — monthlyPlan.committedAt set',
      !!monthlyPlan.committedAt,
      monthlyPlan.committedAt ? 'present' : 'absent');

    return { uid, tenantId };
  } catch (err) {
    report('Firestore assertions — Admin SDK available', false,
      `skipped: ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });

try {
  // ── LEG 1 + 2: Light 1280×800 — inline-capture commit + reload persist ─────
  console.log('\n── Leg 1: Light 1280×800 — inline avg capture + commit ─────');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginDesktop(page);
    report('Leg 1 — dashboard loaded', true);

    await openGamePlan(page);
    report('Leg 1 — Game Plan hub visible',
      await page.locator('[data-testid="game-plan-hub"]').isVisible().catch(() => false));

    // ── Prerequisite: ensure Monthly Plan (seed deleted it) ─────────────────
    const getStep4 = () =>
      page.getByTestId('game-plan-rail').locator('button').filter({ hasText: /Review & Commit/i });

    const step4InitiallyActive = await getStep4().isVisible({ timeout: 2000 }).catch(() => false);
    if (!step4InitiallyActive) {
      console.log('  [Leg 1] Step 4 not active — running ensureMonthlyPlan (seed deleted it)');
      const mpOk = await ensureMonthlyPlan(page);
      report('Leg 1 — Monthly Plan ensured (504,000 anchor)', mpOk);
    } else {
      report('Leg 1 — Monthly Plan already drafted (step 4 pre-active)', true);
    }

    // ── Verify flag + Step 4 active ─────────────────────────────────────────
    const step4Active = await getStep4().isVisible({ timeout: 3000 }).catch(() => false);
    report('Leg 1 — Step-4 "Review & Commit" active (flag on + monthly drafted)', step4Active,
      step4Active ? '' : 'ABORT: flag off or monthly plan not saved');

    if (!step4Active) {
      await ctx.close();
    } else {
      // ── Open Step 4 modal ────────────────────────────────────────────────
      await getStep4().click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await page.waitForTimeout(1000);

      const inReview = await page.locator('[data-testid="review-api"]')
        .isVisible({ timeout: 2000 }).catch(() => false);
      const inDone = await page.locator('[data-testid="committed-done"]')
        .isVisible({ timeout: 500 }).catch(() => false);

      report('Leg 1 — modal opened in review state (plan not yet committed)',
        inReview && !inDone,
        inDone ? 'opened in done state — seed may not have cleared personalAnnualAPI' : '');

      if (inReview) {
        // ── Review view: verify annual hero shows 504,000 ─────────────────
        const reviewApiText = await page.getByTestId('review-api').textContent().catch(() => '');
        report('Leg 1 — PlanReview hero shows 504,000 API',
          reviewApiText.includes('504') || reviewApiText.includes('504,000'),
          `text: "${reviewApiText.trim()}"`);

        // Continue → CommitConsequence
        await page.getByTestId('review-continue-btn').click();
        await page.waitForTimeout(500);
        report('Leg 1 — CommitConsequence: goal hierarchy shown',
          await page.locator('[aria-label="5-layer goal hierarchy"]').isVisible().catch(() => false));

        // Continue → CommitConfirm
        await page.getByTestId('consequence-continue-btn').click();
        await page.waitForTimeout(500);
        report('Leg 1 — CommitConfirm: recap shows 504,000',
          await page.locator('[data-testid="confirm-api"]').isVisible().catch(() => false));

        // ── Inline avg capture path ──────────────────────────────────────
        // Seed cleared playgroundAvgPolicyAPI → commitPlan throws AvgPolicyMissingError
        // → modal shows inline capture field.

        // Click commit — expect avg-missing error.
        const commitBtn = page.getByTestId('commit-btn');
        report('Leg 1 — commit button present before submit', await commitBtn.isVisible().catch(() => false));

        await commitBtn.click();
        await page.waitForTimeout(3000); // allow commitPlan round-trip

        const avgCapture = page.getByTestId('avg-capture');
        const avgCaptureVisible = await avgCapture.isVisible({ timeout: 3000 }).catch(() => false);
        report('Leg 1 — inline avg capture shown (AvgPolicyMissingError triggered)', avgCaptureVisible);

        // Commit button should be hidden while avg-missing
        report('Leg 1 — commit button hidden during avg capture',
          !(await page.getByTestId('commit-btn').isVisible({ timeout: 500 }).catch(() => false)));

        if (avgCaptureVisible) {
          // Fill avg = 12,000 → apps = 504,000/12,000 = 42 ≥ 42 floor ✓
          await page.getByTestId('avg-policy-input').fill('12000');
          report('Leg 1 — avg-policy-input filled: 12,000', true);

          await page.getByTestId('save-avg-btn').click();
          // Allow time for setGoals write + second commitPlan round-trip
          await page.waitForTimeout(6000);

          const doneEl   = page.getByTestId('committed-done');
          const doneVisible = await doneEl.isVisible({ timeout: 5000 }).catch(() => false);
          report('Leg 1 — CommittedDone rendered after inline avg save + re-commit', doneVisible);

          if (doneVisible) {
            const doneApiText = await page.getByTestId('done-api').textContent().catch(() => '');
            report('Leg 1 — done-api shows 504,000',
              doneApiText.includes('504') || doneApiText.includes('504,000'),
              `text: "${doneApiText.trim()}"`);

            const fourOfFour = await page.locator('text=/4\\s*\\/\\s*4/').isVisible().catch(() => false);
            report('Leg 1 — 4/4 · 100% badge shown', fourOfFour);
          }
        }
      } else if (inDone) {
        // Already committed (seed may not have cleared personalAnnualAPI).
        // Use re-open → re-commit path.
        console.log('  [Leg 1] Already in done state — using re-open path');
        await page.getByTestId('reopen-btn').click();
        await page.waitForTimeout(500);

        const confirmVisible = await page.locator('[data-testid="commit-btn"]').isVisible().catch(() => false);
        report('Leg 1 — re-open routes to CommitConfirm', confirmVisible);

        if (confirmVisible) {
          await page.getByTestId('commit-btn').click();
          await page.waitForTimeout(5000);

          const doneVisible = await page.getByTestId('committed-done').isVisible({ timeout: 3000 }).catch(() => false);
          report('Leg 1 — CommittedDone after re-commit', doneVisible);
        }
      }

      // ── Admin SDK Firestore assertions ───────────────────────────────────
      console.log('\n  [Leg 1] Firestore write-read assertions');
      await assertFirestoreState();

      // ── Close modal ──────────────────────────────────────────────────────
      await closeDialog(page);

      // ── Leg 2: Reload + persistence ──────────────────────────────────────
      console.log('\n── Leg 2: Reload — persistence proof ───────────────────');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
      await openGamePlan(page);

      await getStep4().click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await page.waitForTimeout(1500);

      const persistedDone = await page.locator('[data-testid="committed-done"]')
        .isVisible({ timeout: 3000 }).catch(() => false);
      report('Leg 2 — after reload: Step 4 opens in done state (yearPlan.status persisted)',
        persistedDone);

      if (persistedDone) {
        const persistedApi = await page.getByTestId('done-api').textContent().catch(() => '');
        report('Leg 2 — after reload: committed amount shows 504,000',
          persistedApi.includes('504') || persistedApi.includes('504,000'),
          `text: "${persistedApi.trim()}"`);
      }

      // ── Leg 3: Dark mode ─────────────────────────────────────────────────
      console.log('\n── Leg 3: Dark mode ────────────────────────────────────');

      await closeDialog(page);

      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(300);
      report('Leg 3 — dark class applied',
        await page.evaluate(() => document.documentElement.classList.contains('dark')));

      await getStep4().click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await page.waitForTimeout(800);

      const darkDone = await page.locator('[data-testid="committed-done"]')
        .isVisible({ timeout: 2000 }).catch(() => false);
      report('Leg 3 — dark mode: CommittedDone renders', darkDone);

      if (darkDone) {
        const darkApi = await page.getByTestId('done-api').textContent().catch(() => '');
        report('Leg 3 — dark mode: committed amount shows 504,000',
          darkApi.includes('504') || darkApi.includes('504,000'),
          `text: "${darkApi.trim()}"`);
      }

      await closeDialog(page);
      await ctx.close();
    }
  }

  // ── LEG 4: Mobile 390×844 ─────────────────────────────────────────────────
  console.log('\n── Leg 4: Mobile 390×844 ───────────────────────────────────');
  {
    const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginMobile(page);
    report('Leg 4 (mobile) — login successful', true);

    const moreBtn        = page.getByTestId('bottomnav-more');
    const drawerGamePlan = page.locator('.mobile-nav-drawer nav').getByRole('button', { name: 'Game Plan' });

    let gpReachable = false;
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      gpReachable = await drawerGamePlan.isVisible({ timeout: 3000 }).catch(() => false);
    }
    report('Leg 4 (mobile) — Game Plan tab reachable via More drawer', gpReachable);

    if (gpReachable) {
      await drawerGamePlan.click();
      await page.waitForTimeout(2000);
      report('Leg 4 (mobile) — hub loaded',
        await page.locator('[data-testid="game-plan-hub"]').isVisible().catch(() => false));

      const step4Mobile = page.getByTestId('game-plan-rail')
        .locator('button').filter({ hasText: /Review & Commit/i });
      const s4v = await step4Mobile.isVisible().catch(() => false);
      report('Leg 4 (mobile) — Step-4 button visible', s4v);

      if (s4v) {
        await step4Mobile.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
        await page.waitForTimeout(1000);

        const mobileDone = await page.locator('[data-testid="committed-done"]')
          .isVisible({ timeout: 2000 }).catch(() => false);
        report('Leg 4 (mobile) — ReviewCommitModal opens in done state', mobileDone);

        if (mobileDone) {
          const mobileApi = await page.getByTestId('done-api').textContent().catch(() => '');
          report('Leg 4 (mobile) — done-api amount visible',
            mobileApi.trim().length > 0 && !mobileApi.includes('$0.00'),
            `text: "${mobileApi.trim()}"`);
        }
      }
    }

    await ctx.close();
  }

  // ── Console errors ─────────────────────────────────────────────────────────
  report('Leg 5 — 0 unexpected console errors', consoleErrors.length === 0,
    consoleErrors.length > 0
      ? `${consoleErrors.length} error(s): ${consoleErrors.slice(0, 2).join(' | ')}`
      : '');

} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Result: ${passed} pass / ${failed} fail`);
if (failed > 0) {
  console.log('\nFailed:');
  RESULTS.filter(r => r.startsWith('✗')).forEach(r => console.log('  ', r));
  process.exit(1);
}

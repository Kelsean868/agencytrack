/**
 * review-commit-smoke.mjs — end-to-end smoke for ReviewCommitModal (Step 4, Slice 3).
 *
 * Live write-read: navigates to Game Plan → opens Step 4 → walks
 * Review → Consequence → Confirm → commits → asserts CommittedDone →
 * reloads → asserts the modal opens in done state (persistence proof).
 *
 * Requires:
 *   - Dev server running at localhost:5173 with VITE_YEAR_PLAN_ENABLED=true
 *     (set in .env.local before starting `npm run dev`).
 *   - A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD in .env.local.
 *   - The agent account should have Money Needs filled.
 *     Year Plan + Monthly Plan are auto-ensured by this smoke if absent.
 *
 * Usage:
 *   VITE_YEAR_PLAN_ENABLED=true npm run dev   # terminal 1 — keep running
 *   node scripts/verification/review-commit-smoke.mjs  # terminal 2
 */

import { readFileSync } from 'fs';
import { chromium } from 'playwright';

function loadEnv() {
  try {
    const lines = readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const m = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* file absent — rely on shell env */ }
}
loadEnv();

const BASE        = 'http://localhost:5173';
const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;

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
        'fontshare', 'api.fontshare.com', 'net::ERR',
        'Failed to load resource', 'favicon', 'CORS',
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
  const tab = page.getByTestId('agent-tab-game-plan');
  await tab.click();
  await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

async function closeDialog(page) {
  // Close any open dialog — try labelled X buttons first, then Escape.
  const xBtns = ['button[aria-label="Close"]', 'button[aria-label="Close Year Plan"]',
                  'button[aria-label="Close monthly plan"]'];
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
 * Ensure a Year Plan is drafted (mirrors monthly-plan-smoke ensureYearPlan).
 * Returns true if plan is ready, false on failure.
 */
async function ensureYearPlan(page) {
  const rail    = page.getByTestId('game-plan-rail');
  const step2Btn = rail.locator('button').filter({ hasText: /Year Plan/i });

  if (!await step2Btn.isVisible().catch(() => false)) {
    console.log('  [ensureYearPlan] Year Plan button not visible — skip');
    return false;
  }

  await step2Btn.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && d.querySelectorAll('button').length >= 2;
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);

  // Profile-prompt phase
  const compositeBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Composite' });
  if (await compositeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] profile-prompt → Composite');
    await compositeBtn.click();
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')];
      return !btns.some(b => b.textContent.includes('Composite'));
    }, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')];
      const hasScratch = btns.some(b => b.textContent.trim() === 'Enter from scratch');
      return hasScratch || !!document.querySelector('[role="dialog"] input[type="number"]');
    }, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
  }

  // No-seed phase
  const scratchBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Enter from scratch' });
  if (await scratchBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] no-seed → Enter from scratch');
    await scratchBtn.click();
    await page.waitForTimeout(500);
  }

  // Direct mode
  const directBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Direct $' });
  if (await directBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] → Direct mode');
    await directBtn.click();
    await page.waitForTimeout(400);
  }

  // Fill Life line
  const firstInput = page.locator('[role="dialog"] input[type="number"]').first();
  try {
    await firstInput.waitFor({ state: 'visible', timeout: 8000 });
    await firstInput.fill('120000');
    console.log('  [ensureYearPlan] Life=120000 entered');
  } catch {
    console.log('  [ensureYearPlan] no input found — aborting');
    await closeDialog(page);
    return false;
  }

  const saveBtn = page.locator('[role="dialog"] button').filter({ hasText: /save draft/i });
  await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
  await saveBtn.click();
  await page.waitForTimeout(2500);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
  await openGamePlan(page);
  console.log('  [ensureYearPlan] Year Plan saved; hub reloaded');
  return true;
}

/**
 * Ensure a Monthly Plan is drafted.
 * Assumes Year Plan is already in place. Returns true on success.
 */
async function ensureMonthlyPlan(page) {
  const rail     = page.getByTestId('game-plan-rail');
  const step3Btn = rail.locator('button').filter({ hasText: /Monthly Plan/i });

  if (!await step3Btn.isVisible().catch(() => false)) {
    console.log('  [ensureMonthlyPlan] Monthly Plan button not visible — skip');
    return false;
  }

  await step3Btn.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // If no-yearplan state shows, Year Plan is missing (shouldn't happen after ensureYearPlan).
  const noYP = await page.locator('[data-testid="no-yearplan-state"]')
    .isVisible({ timeout: 1000 }).catch(() => false);
  if (noYP) {
    console.log('  [ensureMonthlyPlan] no-yearplan state — closing and returning false');
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  // Save draft (should be balanced already with even month split).
  const saveBtn = page.locator('[role="dialog"] button').filter({ hasText: /save draft/i });
  const saveEl  = await saveBtn.elementHandle().catch(() => null);
  const disabled = saveEl ? await saveEl.getAttribute('disabled') : 'not-found';

  if (disabled !== null) {
    console.log('  [ensureMonthlyPlan] Save draft disabled — cannot save automatically');
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  await saveBtn.click();
  await page.waitForTimeout(2500);

  const dialogGone = !(await page.locator('div[role="dialog"]').isVisible().catch(() => true));
  if (!dialogGone) await closeDialog(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
  await openGamePlan(page);
  console.log('  [ensureMonthlyPlan] Monthly Plan saved; hub reloaded');
  return true;
}

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('ERROR: A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD not set in .env.local');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });

try {
  // ── LEG 1: Light 1280×800 — full write-read commit cycle ──────────────────
  console.log('\n── Leg 1: Light 1280×800 — full commit cycle ───────────────');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginDesktop(page);
    report('Leg 1 — dashboard loaded', true);

    await openGamePlan(page);
    report('Leg 1 — Game Plan hub visible',
      await page.locator('[data-testid="game-plan-hub"]').isVisible().catch(() => false));

    // Verify flag is on (Step-4 button requires monthlyPlanFilled AND flag).
    // Step 4 becomes active only after Monthly Plan is drafted.
    const getStep4 = () =>
      page.getByTestId('game-plan-rail').locator('button').filter({ hasText: /Review & Commit/i });

    // Pre-flight: ensure Year Plan + Monthly Plan are drafted.
    const step4Visible = await getStep4().isVisible().catch(() => false);
    if (!step4Visible) {
      console.log('  [Leg 1] Step 4 not yet active — ensuring prerequisites');

      // Check if Monthly Plan is active (which implies Year Plan is done).
      const step3Btn = page.getByTestId('game-plan-rail')
        .locator('button').filter({ hasText: /Monthly Plan/i });
      const step3Active = await step3Btn.isVisible().catch(() => false);

      if (!step3Active) {
        const yearPlanOk = await ensureYearPlan(page);
        report('Leg 1 — Year Plan set up (prerequisite)', yearPlanOk);
        if (!yearPlanOk) {
          report('Leg 1 — ABORT: could not ensure Year Plan', false);
          await ctx.close();
          // Skip to leg 2
          goto_leg2: {
            break goto_leg2;
          }
        }
      }

      const monthlyPlanOk = await ensureMonthlyPlan(page);
      report('Leg 1 — Monthly Plan set up (prerequisite)', monthlyPlanOk);
    }

    // Verify Step 4 is now active.
    const step4Active = await getStep4().isVisible({ timeout: 3000 }).catch(() => false);
    report('Leg 1 — Step-4 "Review & Commit" button active', step4Active,
      step4Active ? '' : 'flag may be off or prerequisites missing');

    if (!step4Active) {
      report('Leg 1 — ABORT: Step 4 not active', false,
        'Ensure VITE_YEAR_PLAN_ENABLED=true in .env.local and restart dev server');
      await ctx.close();
    }
    if (step4Active) {
      // ── Open Step 4 modal ────────────────────────────────────────────────
      await getStep4().click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await page.waitForTimeout(1000);

      const inReview = await page.locator('[data-testid="review-api"]')
        .isVisible({ timeout: 3000 }).catch(() => false);
      // Could open in 'done' state if already committed.
      const inDone = await page.locator('[data-testid="committed-done"]')
        .isVisible({ timeout: 1000 }).catch(() => false);

      if (inDone) {
        // Already committed — use re-open path to re-commit.
        console.log('  [Leg 1] Modal opened in done state — using re-open path');
        report('Leg 1 — modal opened (done state — re-open path)', true);

        await page.getByTestId('reopen-btn').click();
        await page.waitForTimeout(500);
        report('Leg 1 — re-open routes to CommitConfirm',
          await page.locator('[data-testid="commit-btn"]').isVisible().catch(() => false));
      } else {
        report('Leg 1 — modal opened in review state', inReview);

        if (inReview) {
          // Review → Consequence → Confirm
          const continueBtns = page.getByTestId('review-continue-btn');
          const hasReviewContinue = await continueBtns.isVisible({ timeout: 2000 }).catch(() => false);
          report('Leg 1 — review: Continue button present (plans complete)', hasReviewContinue);

          if (hasReviewContinue) {
            await continueBtns.click();
            await page.waitForTimeout(500);
            report('Leg 1 — consequence view loaded',
              await page.locator('[data-testid="consequence-continue-btn"]').isVisible().catch(() => false));

            // Verify GoalsCascade is present on consequence view
            report('Leg 1 — 5-layer goal hierarchy shown',
              await page.locator('[aria-label="5-layer goal hierarchy"]').isVisible().catch(() => false));

            await page.getByTestId('consequence-continue-btn').click();
            await page.waitForTimeout(500);
            report('Leg 1 — confirm view loaded',
              await page.locator('[data-testid="confirm-api"]').isVisible().catch(() => false));
          }
        }
      }

      // ── Commit ────────────────────────────────────────────────────────────
      const commitBtn = page.getByTestId('commit-btn');
      const commitVisible = await commitBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (!commitVisible) {
        // avg-missing inline capture may be showing.
        const avgCapture = await page.locator('[data-testid="avg-capture"]')
          .isVisible({ timeout: 1000 }).catch(() => false);

        if (avgCapture) {
          console.log('  [Leg 1] avg-missing error — filling inline avg policy');
          await page.getByTestId('avg-policy-input').fill('10000');
          await page.getByTestId('save-avg-btn').click();
          await page.waitForTimeout(3000);
          // Should now be in done state after save+recommit.
        } else {
          report('Leg 1 — commit button missing (unexpected)', false);
        }
      } else {
        await commitBtn.click();
        // Allow up to 10s for the transaction to complete.
        await page.waitForTimeout(500);

        // May hit avg-missing after clicking commit.
        const avgCapture = await page.locator('[data-testid="avg-capture"]')
          .isVisible({ timeout: 1000 }).catch(() => false);
        if (avgCapture) {
          console.log('  [Leg 1] avg-missing post-commit — filling avg policy');
          await page.getByTestId('avg-policy-input').fill('10000');
          await page.getByTestId('save-avg-btn').click();
          await page.waitForTimeout(3000);
        } else {
          await page.waitForTimeout(5000);
        }
      }

      // ── Assert CommittedDone ──────────────────────────────────────────────
      const doneEl = page.getByTestId('committed-done');
      const doneVisible = await doneEl.isVisible({ timeout: 5000 }).catch(() => false);
      report('Leg 1 — CommittedDone rendered after commit', doneVisible);

      if (doneVisible) {
        const doneApiText = await page.getByTestId('done-api').textContent().catch(() => '');
        report('Leg 1 — done-api shows non-zero amount',
          doneApiText.trim().length > 0 && !doneApiText.includes('$0.00'),
          `"${doneApiText.trim()}"`);

        const fourOfFour = await page.locator('text=/4\\s*\\/\\s*4/').isVisible().catch(() => false);
        report('Leg 1 — 4/4 badge shown', fourOfFour);
      }

      // Close modal
      await page.locator('button[aria-label="Close"]').first().click().catch(() =>
        page.keyboard.press('Escape'));
      await page.waitForTimeout(500);

      // ── Reload + assert persistence ────────────────────────────────────────
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
      await openGamePlan(page);

      await getStep4().click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await page.waitForTimeout(1500);

      const persistedDone = await page.locator('[data-testid="committed-done"]')
        .isVisible({ timeout: 3000 }).catch(() => false);
      report('Leg 1 — after reload: modal opens in done state (Firestore persisted)', persistedDone);

      if (persistedDone) {
        const persistedAPI = await page.getByTestId('done-api').textContent().catch(() => '');
        report('Leg 1 — after reload: committed amount non-zero',
          persistedAPI.trim().length > 0 && !persistedAPI.includes('$0.00'),
          `"${persistedAPI.trim()}"`);
      }

      // ── Leg 2: Dark mode ──────────────────────────────────────────────────
      console.log('\n── Leg 2: Dark mode ─────────────────────────────────────');

      await closeDialog(page);

      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(300);
      report('Leg 2 — dark class applied',
        await page.evaluate(() => document.documentElement.classList.contains('dark')));

      await getStep4().click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await page.waitForTimeout(1000);

      const darkDone = await page.locator('[data-testid="committed-done"]')
        .isVisible({ timeout: 3000 }).catch(() => false);
      report('Leg 2 — dark mode: modal renders (done state)', darkDone);

      if (darkDone) {
        const darkAPI = await page.getByTestId('done-api').textContent().catch(() => '');
        report('Leg 2 — dark mode: committed amount visible',
          darkAPI.trim().length > 0 && !darkAPI.includes('$0.00'),
          `"${darkAPI.trim()}"`);
      }

      await closeDialog(page);
      await ctx.close();
    }
  }

  // ── LEG 3: Mobile 390×844 — modal opens ───────────────────────────────────
  console.log('\n── Leg 3: Mobile 390×844 ───────────────────────────────────');
  {
    const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginMobile(page);
    report('Leg 3 (mobile) — login successful', true);

    // Game Plan is in More drawer on mobile.
    const moreBtn       = page.getByTestId('bottomnav-more');
    const drawerGamePlan = page.locator('.mobile-nav-drawer nav').getByRole('button', { name: 'Game Plan' });

    let gpReachable = false;
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      gpReachable = await drawerGamePlan.isVisible({ timeout: 3000 }).catch(() => false);
    }
    report('Leg 3 (mobile) — Game Plan tab reachable', gpReachable);

    if (gpReachable) {
      await drawerGamePlan.click();
      await page.waitForTimeout(2000);
      report('Leg 3 (mobile) — hub loaded',
        await page.locator('[data-testid="game-plan-hub"]').isVisible().catch(() => false));

      const step4Mobile = page.getByTestId('game-plan-rail')
        .locator('button').filter({ hasText: /Review & Commit/i });
      const s4v = await step4Mobile.isVisible().catch(() => false);
      report('Leg 3 (mobile) — Step-4 button visible', s4v);

      if (s4v) {
        await step4Mobile.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
        await page.waitForTimeout(1000);
        const dlgOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
        report('Leg 3 (mobile) — ReviewCommitModal opens', dlgOpen);

        // Already committed (from Leg 1) — should open in done state.
        const mobileDone = await page.locator('[data-testid="committed-done"]')
          .isVisible({ timeout: 2000 }).catch(() => false);
        report('Leg 3 (mobile) — done state persisted on mobile', mobileDone);
      }
    }

    await ctx.close();
  }

  // ── Console errors ─────────────────────────────────────────────────────────
  report('Leg 4 — 0 unexpected console errors', consoleErrors.length === 0,
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

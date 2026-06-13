/**
 * planning-loop-e2e-smoke.mjs — full end-to-end round-trip for the planning loop.
 *
 * Chains the complete Money Needs → Year Plan → Monthly Plan → Review & Commit
 * path in a single run, then asserts Firestore state via the Admin SDK.
 *
 * Pre-condition:
 *   - VITE_GAME_PLAN_LOOP_ENABLED=true in effect (dev server flag or code default)
 *   - A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD in .env.local
 *
 * Usage (localhost dev server, flag forced on):
 *   node scripts/verification/planning-loop-e2e-smoke.mjs
 *
 * Usage (Vercel preview, after Phase 5 flip):
 *   SMOKE_PREVIEW_URL=https://... node scripts/verification/planning-loop-e2e-smoke.mjs
 *
 * Legs:
 *   1 — Light 1280×800: ensure Money Needs filled → ensure Year Plan → ensure Monthly
 *       Plan → Commit (inline avg capture if needed) → Admin SDK Firestore assertions
 *       → reload → 4/4 · 100%
 *   2 — Dark mode: Game Plan hub shows committed state across theme
 *   3 — Mobile 390×844: hub reachable → Step-4 done state renders
 *   4 — 0 unexpected console errors
 *
 * Firestore assertions (after Leg 1 commit):
 *   goals.personalAnnualAPI    set (> 0)
 *   yearPlan.status            = 'committed'
 *   yearPlan.committedAt       present
 *   monthlyPlan.status         = 'committed'
 *   monthlyPlan.committedAt    present
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

const BASE        = process.env.SMOKE_PREVIEW_URL ?? process.argv[2] ?? 'http://localhost:5173';
const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('✗ A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD not set — aborting');
  process.exit(1);
}

let passed = 0, failed = 0;
const RESULTS = [];
const consoleErrors = [];

function report(label, ok, detail = '') {
  const icon = ok ? '✓' : '✗';
  const line = `${icon} ${label}${detail ? ` — ${detail}` : ''}`;
  RESULTS.push(line);
  console.log(line);
  if (ok) passed++; else failed++;
}

function wireCapture(page) {
  page.on('console', msg => {
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
  await page.getByTestId('agent-tab-game-plan').click();
  await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

// ── Money Needs ───────────────────────────────────────────────────────────────

async function checkMoneyNeedsFilled(page) {
  // PlanAnchorStrip shows afterTaxNeed > 0 only when Money Needs is filled.
  // The Step-1 rail card shows "Done" kicker when filled.
  const step1Done = await page
    .getByTestId('game-plan-rail')
    .locator('text=Done')
    .first()
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  return step1Done;
}

// ── Year Plan (Step 2) ────────────────────────────────────────────────────────

async function ensureYearPlan(page) {
  const step2Btn = page.getByTestId('game-plan-rail')
    .locator('button').filter({ hasText: /Year Plan/i });
  if (!await step2Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] Step-2 button not visible — skip');
    return false;
  }

  await step2Btn.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
  // Wait past loading phase (needs at least 2 buttons).
  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && d.querySelectorAll('button').length >= 2;
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);

  // Profile prompt → choose Composite
  const compositeBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Composite' });
  if (await compositeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] profile-prompt → Composite');
    await compositeBtn.click();
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')];
      const hasScratch = btns.some(b => b.textContent.trim() === 'Enter from scratch');
      const hasInput   = !!document.querySelector('[role="dialog"] input[type="number"]');
      return hasScratch || hasInput;
    }, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
  }

  // No-seed → Enter from scratch
  const scratchBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Enter from scratch' });
  if (await scratchBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] no-seed → Enter from scratch');
    await scratchBtn.click();
    await page.waitForTimeout(500);
  }

  // Already filled → close and proceed
  const saveBtn = page.locator('[role="dialog"] button').filter({ hasText: /save draft/i });
  if (!await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] Save Draft not visible — closing');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
    return false;
  }

  // Check existing Total API input (percent mode) — avoid overwriting a good plan
  const totalApiInput = page.locator('[role="dialog"] input[aria-label*="Total Annual"]');
  let existingTotal = 0;
  if (await totalApiInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    existingTotal = parseFloat(await totalApiInput.inputValue().catch(() => '0')) || 0;
  }

  if (existingTotal >= 300000) {
    // Existing plan is above any API floor — save as-is, don't overwrite
    console.log(`  [ensureYearPlan] existing Total API ${existingTotal} ≥ 300,000 — saving as-is`);
  } else {
    // Switch to Direct mode and fill Life = 600,000 (clears all tenure API floors)
    const directBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Direct $' });
    if (await directBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await directBtn.click();
      await page.waitForTimeout(300);
    }
    const firstInput = page.locator('[role="dialog"] input[type="number"]').first();
    if (await firstInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstInput.fill('600000');
      console.log('  [ensureYearPlan] Life=600,000 entered (floor clearance)');
    }
  }

  await saveBtn.click();
  await page.waitForTimeout(2500);

  // Reload so hub re-fetches yearPlanTotalAPI
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
  await openGamePlan(page);
  console.log('  [ensureYearPlan] Year Plan saved; hub reloaded');
  return true;
}

// ── Monthly Plan (Step 3) ─────────────────────────────────────────────────────

async function ensureMonthlyPlan(page) {
  const step3Btn = page.getByTestId('game-plan-rail')
    .locator('button').filter({ hasText: /Monthly Plan/i });
  if (!await step3Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  [ensureMonthlyPlan] Step-3 button not visible — skip');
    return false;
  }

  await step3Btn.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
  await page.waitForTimeout(2500);

  const noYP = await page.locator('[data-testid="no-yearplan-state"]')
    .isVisible({ timeout: 1000 }).catch(() => false);
  if (noYP) {
    console.log('  [ensureMonthlyPlan] no-yearplan state — Year Plan missing');
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  const saveBtn = page.locator('[role="dialog"] button').filter({ hasText: /save draft/i });
  const saveEl  = await saveBtn.elementHandle().catch(() => null);
  const disabled = saveEl ? await saveEl.getAttribute('disabled') : 'not-found';
  if (disabled !== null) {
    console.log('  [ensureMonthlyPlan] Save Draft disabled — monthly plan already exists');
    await page.keyboard.press('Escape').catch(() => {});
    return true;  // plan exists — that's the goal state
  }

  await saveBtn.click();
  await page.waitForTimeout(2000);

  if (await page.locator('div[role="dialog"]').isVisible().catch(() => true)) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
  await openGamePlan(page);
  console.log('  [ensureMonthlyPlan] Monthly Plan saved; hub reloaded');
  return true;
}

// ── Admin SDK Firestore assertions ────────────────────────────────────────────

async function assertFirestoreState() {
  try {
    const require = createRequire(import.meta.url);
    const admin = require('../../functions/node_modules/firebase-admin');
    const projectId = process.env.GCLOUD_PROJECT || 'agencytrack-2a610';
    if (!admin.apps.length) admin.initializeApp({ projectId });

    const db         = admin.firestore();
    const userRecord = await admin.auth().getUserByEmail(AGENT_EMAIL);
    const uid        = userRecord.uid;
    const tenantId   = userRecord.customClaims?.tenantId;
    const year       = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Port_of_Spain',
      year: 'numeric',
    }).format(new Date()), 10);

    if (!tenantId) throw new Error('No tenantId in custom claims');

    const [goalsSnap, yearPlanSnap, monthlyPlanSnap] = await Promise.all([
      db.collection('tenants').doc(tenantId).collection('goals').doc(uid).get(),
      db.collection('tenants').doc(tenantId).collection('users').doc(uid)
        .collection('yearPlan').doc(String(year)).get(),
      db.collection('tenants').doc(tenantId).collection('users').doc(uid)
        .collection('monthlyPlan').doc(String(year)).get(),
    ]);

    const goals      = goalsSnap.exists      ? goalsSnap.data()      : {};
    const yearPlan   = yearPlanSnap.exists   ? yearPlanSnap.data()   : {};
    const monthlyPlan = monthlyPlanSnap.exists ? monthlyPlanSnap.data() : {};

    report('Firestore — goals.personalAnnualAPI set',
      (goals.personalAnnualAPI ?? 0) > 0,
      `actual: ${goals.personalAnnualAPI}`);
    report('Firestore — yearPlan.status = committed',
      yearPlan.status === 'committed',
      `actual: ${yearPlan.status}`);
    report('Firestore — yearPlan.committedAt present',
      !!yearPlan.committedAt,
      yearPlan.committedAt ? 'present' : 'absent');
    report('Firestore — monthlyPlan.status = committed',
      monthlyPlan.status === 'committed',
      `actual: ${monthlyPlan.status}`);
    report('Firestore — monthlyPlan.committedAt present',
      !!monthlyPlan.committedAt,
      monthlyPlan.committedAt ? 'present' : 'absent');

    return { uid, tenantId };
  } catch (err) {
    report('Firestore assertions (Admin SDK)', false,
      `skipped: ${err.message?.slice(0, 120)}`);
    return null;
  }
}

// ── Step 4 — Commit ───────────────────────────────────────────────────────────

async function runCommitStep(page) {
  const getStep4 = () =>
    page.getByTestId('game-plan-rail').locator('button').filter({ hasText: /Review & Commit/i });

  const step4Active = await getStep4().isVisible({ timeout: 3000 }).catch(() => false);
  if (!step4Active) {
    report('Step 4 — Review & Commit button active (monthly plan filled)', false,
      'ABORT: Step 4 not reachable');
    return false;
  }

  await getStep4().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await page.waitForTimeout(1000);

  const inDone = await page.locator('[data-testid="committed-done"]')
    .isVisible({ timeout: 500 }).catch(() => false);

  if (inDone) {
    // Already committed — verify done state
    const doneApi = await page.getByTestId('done-api').textContent().catch(() => '');
    report('Step 4 — CommittedDone renders (already committed)',
      doneApi.trim().length > 0 && !doneApi.includes('$0'), `api: "${doneApi.trim()}"`);
    await page.keyboard.press('Escape').catch(() => {});
    return true;
  }

  const inReview = await page.locator('[data-testid="review-api"]')
    .isVisible({ timeout: 2000 }).catch(() => false);
  report('Step 4 — modal opens in review state', inReview);
  if (!inReview) { await page.keyboard.press('Escape').catch(() => {}); return false; }

  // Continue → consequence → confirm
  await page.getByTestId('review-continue-btn').click();
  await page.waitForTimeout(500);
  report('Step 4 — CommitConsequence shown',
    await page.locator('[aria-label="5-layer goal hierarchy"]').isVisible().catch(() => false));

  await page.getByTestId('consequence-continue-btn').click();
  await page.waitForTimeout(500);
  report('Step 4 — CommitConfirm shown',
    await page.locator('[data-testid="commit-btn"]').isVisible().catch(() => false));

  // Click commit — may get AvgPolicyMissingError or floor errors
  await page.getByTestId('commit-btn').click();
  await page.waitForTimeout(3500);

  // Detect AvgPolicyMissingError → fill avg and retry
  const avgCapture = page.getByTestId('avg-capture');
  const avgCaptureVisible = await avgCapture.isVisible({ timeout: 2000 }).catch(() => false);
  if (avgCaptureVisible) {
    console.log('  [runCommitStep] avg-missing error → filling 12,000');
    await page.getByTestId('avg-policy-input').fill('12000');
    await page.getByTestId('save-avg-btn').click();
    await page.waitForTimeout(6000);
  } else {
    // Detect floor errors for diagnostic output
    const floorErr  = await page.locator('text=/below your API floor/i').isVisible({ timeout: 500 }).catch(() => false);
    const appsErr   = await page.locator('text=/below the apps floor/i').isVisible({ timeout: 500 }).catch(() => false);
    if (floorErr || appsErr) {
      const which = floorErr ? 'BelowApiFloorError — year plan total below API floor' : 'BelowAppsFloorError — derived apps below floor';
      console.log(`  [runCommitStep] COMMIT BLOCKED: ${which}`);
      report('Step 4 — CommittedDone rendered after commit', false, which);
      await page.keyboard.press('Escape').catch(() => {});
      return false;
    }
    await page.waitForTimeout(3000);
  }

  const doneVisible = await page.locator('[data-testid="committed-done"]')
    .isVisible({ timeout: 5000 }).catch(() => false);
  report('Step 4 — CommittedDone rendered after commit', doneVisible);

  if (doneVisible) {
    const doneApiText = await page.getByTestId('done-api').textContent().catch(() => '');
    report('Step 4 — done-api shows API amount',
      doneApiText.trim().length > 0 && !doneApiText.includes('$0'),
      `text: "${doneApiText.trim()}"`);

    const fourOfFour = await page.locator('text=/4\\s*\\/\\s*4/').isVisible().catch(() => false);
    report('Step 4 — 4/4 · 100% badge shown', fourOfFour);
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
  return doneVisible;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });

try {
  // ── LEG 1: Light 1280×800 — full loop + Firestore assertions ─────────────
  console.log(`\n── Target: ${BASE} ─────────────────────────────────────────`);
  console.log('── Leg 1: Light 1280×800 — full planning loop round-trip ───────');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginDesktop(page);
    report('Leg 1 — dashboard loaded', true);

    await openGamePlan(page);
    report('Leg 1 — Game Plan hub visible',
      await page.locator('[data-testid="game-plan-hub"]').isVisible().catch(() => false));

    // Step 1 — Money Needs (must already be filled; the loop gate depends on it)
    const mnFilled = await checkMoneyNeedsFilled(page);
    report('Leg 1 — Step 1: Money Needs filled', mnFilled,
      mnFilled ? '' : 'Fill Money Needs worksheet first (pre-condition for loop smoke)');

    if (mnFilled) {
      // Step 2 — Year Plan
      const step2Btn = page.getByTestId('game-plan-rail')
        .locator('button').filter({ hasText: /Year Plan/i });
      const step2Done = await page.getByTestId('game-plan-rail')
        .locator('[aria-disabled]').filter({ hasText: /Year Plan/ })
        .count().then(n => n === 0).catch(() => true);
      if (!await step2Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('  [Leg 1] Step-2 not yet active — Year Plan may need seed');
      }
      const yearPlanOk = await ensureYearPlan(page);
      report('Leg 1 — Step 2: Year Plan saved', yearPlanOk || step2Done);

      // Step 3 — Monthly Plan
      const monthlyOk = await ensureMonthlyPlan(page);
      report('Leg 1 — Step 3: Monthly Plan saved', monthlyOk,
        monthlyOk ? '' : 'Save Draft disabled — may already exist (will proceed to Step 4)');

      // Step 4 — Commit
      const commitOk = await runCommitStep(page);
      report('Leg 1 — Step 4: plan committed', commitOk);

      // Firestore assertions
      console.log('\n  [Leg 1] Firestore write-read assertions');
      await assertFirestoreState();

      // Reload → 4/4 persists
      console.log('\n  [Leg 1] Reload persistence check');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
      await openGamePlan(page);

      const railAfterReload = page.getByTestId('game-plan-rail');
      const doneKickers = await railAfterReload.locator('text=Done').count().catch(() => 0);
      report('Leg 1 — after reload: Step-4 shows Done kicker (committed)',
        doneKickers >= 4, `Done kickers in rail: ${doneKickers}`);

      const anchorText = await page.locator('[data-testid="game-plan-anchor"]').textContent().catch(() => '');
      report('Leg 1 — after reload: PlanAnchorStrip shows 100%',
        anchorText.includes('100%'), `anchor has "100%": ${anchorText.includes('100%')}`);
    }

    await ctx.close();
  }

  // ── LEG 2: Dark mode ─────────────────────────────────────────────────────
  console.log('\n── Leg 2: Dark mode ────────────────────────────────────────────');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginDesktop(page);
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('agencytrack-dark', 'true');
    });
    await openGamePlan(page);

    const darkHub = await page.locator('[data-testid="game-plan-hub"]').isVisible().catch(() => false);
    report('Leg 2 (dark) — Game Plan hub renders', darkHub);

    if (darkHub) {
      const step4 = page.getByTestId('game-plan-rail').locator('text=Done');
      const doneCt = await step4.count().catch(() => 0);
      report('Leg 2 (dark) — committed state shows Done kicker(s)',
        doneCt >= 1, `Done kickers: ${doneCt}`);

      // Wait for committedAnnualAPI to propagate from parent (anchor loses "Set in your plan")
      await page.waitForFunction(() => {
        const anchor = document.querySelector('[data-testid="game-plan-anchor"]');
        return anchor && !anchor.textContent.includes('Set in your plan');
      }, { timeout: 8000 }).catch(() => {});

      // Open Step 4 modal in dark mode
      const step4Btn = page.getByTestId('game-plan-rail')
        .locator('button').filter({ hasText: /Review & Commit/i });
      if (await step4Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await step4Btn.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
        await page.waitForTimeout(1200);
        const darkDone = await page.locator('[data-testid="committed-done"]')
          .isVisible({ timeout: 3000 }).catch(() => false);
        report('Leg 2 (dark) — ReviewCommitModal renders committed state', darkDone);
        await page.keyboard.press('Escape').catch(() => {});
      } else {
        report('Leg 2 (dark) — Step-4 button reachable', false, 'plan not committed in dark leg');
      }
    }

    await ctx.close();
  }

  // ── LEG 3: Mobile 390×844 ─────────────────────────────────────────────────
  console.log('\n── Leg 3: Mobile 390×844 ───────────────────────────────────────');
  {
    const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginMobile(page);
    report('Leg 3 (mobile) — login successful', true);

    const moreBtn        = page.getByTestId('bottomnav-more');
    const drawerGamePlan = page.locator('.mobile-nav-drawer nav')
      .getByRole('button', { name: 'Game Plan' });

    let gpReachable = false;
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      gpReachable = await drawerGamePlan.isVisible({ timeout: 3000 }).catch(() => false);
    }
    report('Leg 3 (mobile) — Game Plan reachable via More drawer', gpReachable);

    if (gpReachable) {
      await drawerGamePlan.click();
      await page.waitForTimeout(2000);

      report('Leg 3 (mobile) — hub loaded',
        await page.locator('[data-testid="game-plan-hub"]').isVisible().catch(() => false));

      // Check committed state visible in rail
      const railDone = await page.getByTestId('game-plan-rail')
        .locator('text=Done').count().catch(() => 0);
      report('Leg 3 (mobile) — rail shows Done kicker(s) (committed)',
        railDone >= 1, `Done kickers: ${railDone}`);

      // Wait for committedAnnualAPI to propagate from parent (anchor loses "Set in your plan")
      await page.waitForFunction(() => {
        const anchor = document.querySelector('[data-testid="game-plan-anchor"]');
        return anchor && !anchor.textContent.includes('Set in your plan');
      }, { timeout: 8000 }).catch(() => {});

      // Open Step 4 modal (committed → done state)
      const s4Btn = page.getByTestId('game-plan-rail')
        .locator('button').filter({ hasText: /Review & Commit/i });
      if (await s4Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await s4Btn.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
        await page.waitForTimeout(1200);
        const mobileDone = await page.locator('[data-testid="committed-done"]')
          .isVisible({ timeout: 3000 }).catch(() => false);
        report('Leg 3 (mobile) — ReviewCommitModal shows committed state', mobileDone);
        await page.keyboard.press('Escape').catch(() => {});
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

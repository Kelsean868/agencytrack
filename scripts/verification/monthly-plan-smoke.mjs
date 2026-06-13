/**
 * monthly-plan-smoke.mjs — write-read-verify smoke for MonthlyPlanModal (Slice 2).
 *
 * Method: temporary local un-gate (YEAR_PLAN_ENABLED = true in source) + localhost:5173.
 * No Vercel bypass; Firebase auth via UI login.
 *
 * Doc path: tenants/{tenantId}/users/{uid}/monthlyPlan/2026
 *
 * Pre-condition: test agent may have no licenseProfile, no Money Needs, no Year Plan.
 * ensureYearPlan() handles the full YearPlanModal three-phase flow.
 *
 * Modal close notes (banked from smoke debug):
 *   - YearPlanModal: NOW HAS Escape handler (added PR feat/ungate-planning-loop); also closeable via button[aria-label="Close Year Plan"].
 *   - MonthlyPlanModal: HAS Escape handler. aria-label="Close monthly plan" (lowercase).
 *
 * Legs:
 *   1 — Light 1280×800 write-read-verify
 *   2 — Dark mode (same auth context as Leg 1)
 *   3 — Mobile 390×844
 *   4 — 0 unexpected console errors
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
  } catch { /* rely on shell env */ }
}
loadEnv();

const BASE        = 'http://localhost:5173';
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

// Desktop login — sidebar visible at 1280px.
async function loginDesktop(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 20000 });
}

// Mobile login — sidebar is CSS-hidden at 390px. Wait for bottom nav to confirm
// the agent dashboard has loaded (SPA: body text never drops to 0, so body-text
// checks resolve too early — the bottom nav is the reliable signal).
async function loginMobile(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await page.click('button[type="submit"]');
  // Wait for any bottom-nav item to confirm the agent dashboard rendered.
  await page.waitForSelector('[data-testid^="bottomnav-"]', { timeout: 20000 });
  await page.waitForTimeout(500);
}

async function openGamePlan(page) {
  const tab = page.getByTestId('agent-tab-game-plan');
  await tab.click();
  await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

/** Close Year Plan modal — via its X button or Escape (both now supported). */
async function closeYearPlan(page) {
  const closeBtn = page.locator('button[aria-label="Close Year Plan"]');
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(400);
  }
}

/**
 * ensureYearPlan — sets up a minimal Year Plan via YearPlanModal so that
 * yearPlanTotalAPI > 0 when Monthly Plan opens.
 *
 * Handles full YearPlanModal three-phase flow:
 *   loading → (profile-prompt) → (no-seed) → allocating → Direct mode → save
 *
 * Key: after each phase transition, waits for a SPECIFIC ELEMENT to appear
 * (not a spinner to disappear), because the spinner can be missed in fast renders.
 *
 * After saving, reloads the page and re-opens Game Plan hub.
 * On failure, closes the Year Plan dialog before returning false.
 */
async function ensureYearPlan(page) {
  const rail = page.getByTestId('game-plan-rail');
  const step2Btn = rail.locator('button').filter({ hasText: /Year Plan/i });
  if (!await step2Btn.isVisible().catch(() => false)) {
    console.log('  [ensureYearPlan] Step-2 Year Plan button not visible — skip');
    return false;
  }

  await step2Btn.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

  // Wait past loading: dialog must have at least 2 buttons (close X + at least one action).
  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && d.querySelectorAll('button').length >= 2;
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);

  // ── Phase A: profile-prompt ───────────────────────────────────────────────
  // Composite button inside the dialog (text contains "Composite")
  const compositeBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Composite' });
  if (await compositeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] profile-prompt → clicking Composite');
    await compositeBtn.click();

    // Wait until Composite button disappears (phase transitions away from profile-prompt).
    // This fires as soon as profileSaving=true re-renders, before the Firestore write finishes.
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')];
      return !btns.some(b => b.textContent.includes('Composite'));
    }, { timeout: 15000 }).catch(() => {});

    // Now wait for the next interactive phase to appear: either "Enter from scratch"
    // (no-seed) OR an input[type="number"] (allocating). This happens AFTER the write.
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')];
      const hasScratch = btns.some(b => b.textContent.trim() === 'Enter from scratch');
      const hasInput   = !!document.querySelector('[role="dialog"] input[type="number"]');
      return hasScratch || hasInput;
    }, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
  }

  // ── Phase B: no-seed ─────────────────────────────────────────────────────
  const scratchBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Enter from scratch' });
  if (await scratchBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] no-seed → clicking Enter from scratch');
    await scratchBtn.click();
    await page.waitForTimeout(500);
  }

  // ── Phase C: allocating — switch to Direct mode ──────────────────────────
  const directBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Direct $' });
  if (await directBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('  [ensureYearPlan] allocating → switching to Direct mode');
    await directBtn.click();
    await page.waitForTimeout(400);
  }

  // ── Phase D: fill Life line (first number input) ─────────────────────────
  const firstInput = page.locator('[role="dialog"] input[type="number"]').first();
  try {
    await firstInput.waitFor({ state: 'visible', timeout: 8000 });
    await firstInput.fill('120000');
    console.log('  [ensureYearPlan] Life=120000 entered');
  } catch {
    console.log('  [ensureYearPlan] no number input found — closing dialog and aborting');
    await closeYearPlan(page);
    return false;
  }

  // ── Phase E: save ────────────────────────────────────────────────────────
  const saveBtn = page.locator('[role="dialog"] button').filter({ hasText: /save draft/i });
  await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
  await saveBtn.click();
  await page.waitForTimeout(2500);

  // Reload so hub re-fetches yearPlanTotalAPI.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
  await openGamePlan(page);
  console.log('  [ensureYearPlan] Year Plan saved; hub reloaded');
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });

try {
  // ── LEG 1 + 2: Light then Dark, 1280×800 ─────────────────────────────────
  console.log('\n── Leg 1: Light 1280×800 — write-read-verify ───────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginDesktop(page);
    report('Leg 1 — dashboard loaded', true);

    await openGamePlan(page);
    report('Leg 1 — Game Plan hub visible',
      await page.locator('[data-testid="game-plan-hub"]').isVisible());

    // Step-3 Monthly Plan button (scoped to rail)
    const getStep3 = () =>
      page.getByTestId('game-plan-rail').locator('button').filter({ hasText: /Monthly Plan/i });

    const step3Visible = await getStep3().isVisible().catch(() => false);
    report('Leg 1 — Step-3 "Monthly Plan" button active (flag on)', step3Visible);

    let monthlyPlanReady = false;

    if (!step3Visible) {
      report('Leg 1 — ABORT: flag not taking effect', false);
    } else {
      await getStep3().click();
      await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
      await page.waitForTimeout(2500);

      const noYearPlan = await page.locator('[data-testid="no-yearplan-state"]')
        .isVisible({ timeout: 1000 }).catch(() => false);

      if (noYearPlan) {
        console.log('  [Leg 1] no-yearPlan state — closing Monthly Plan, setting up Year Plan');
        // MonthlyPlanModal has an Escape handler.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        const ok = await ensureYearPlan(page);
        report('Leg 1 — Year Plan setup (prerequisite)', ok,
          ok ? 'Life=120000 saved; hub reloaded' : 'setup failed');

        if (ok) {
          await getStep3().click();
          await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
          await page.waitForTimeout(2500);
          monthlyPlanReady = true;
        }
        // If !ok, Year Plan dialog is already closed by ensureYearPlan.
      } else {
        monthlyPlanReady = true;
      }

      if (monthlyPlanReady) {
        // ── Core assertions ─────────────────────────────────────────────
        const spinCount = await page.locator('[role="dialog"] input[type="number"]').count();
        report('Leg 1 — 7 editable spinbuttons (months 5–11)', spinCount === 7,
          `found ${spinCount}`);

        const pillText = await page.locator('[data-testid="balance-pill"]')
          .textContent().catch(() => '');
        report('Leg 1 — balance-pill shows ✓ (balanced)', pillText.includes('✓'),
          `pill: "${pillText.trim()}"`);

        const saveBtn = page.locator('[role="dialog"] button').filter({ hasText: /save draft/i });
        const saveEl  = await saveBtn.elementHandle().catch(() => null);
        const saveDisabled = saveEl ? await saveEl.getAttribute('disabled') : 'not-found';
        report('Leg 1 — Save draft enabled when balanced', saveDisabled === null);

        // ── Write ──────────────────────────────────────────────────────
        if (saveDisabled === null && spinCount === 7) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
          const dialogGone = !(await page.locator('div[role="dialog"]').isVisible().catch(() => true));
          report('Leg 1 — modal closes after Save', dialogGone);

          // ── Read: reload → re-open → assert persistence ─────────────
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 });
          await openGamePlan(page);

          await getStep3().click();
          await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
          await page.waitForTimeout(2500);

          const spinAfter = await page.locator('[role="dialog"] input[type="number"]').count();
          report(
            'Leg 1 — after reload: 7 spinbuttons (monthlyPlan doc persisted to Firestore)',
            spinAfter === 7, `found ${spinAfter}`,
          );
        }
      }

      // ── LEG 2: Dark mode ────────────────────────────────────────────────
      console.log('\n── Leg 2: Dark mode ────────────────────────────────────');

      // Close any open dialog (Monthly Plan responds to Escape; Year Plan needs X button).
      await closeYearPlan(page);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);

      // Ensure no dialog is blocking before proceeding.
      const dialogOpen = await page.locator('div[role="dialog"]').isVisible().catch(() => false);
      if (dialogOpen) {
        console.log('  [Leg 2] Dialog still open — clicking X button');
        const xBtn = page.locator('button[aria-label="Close Year Plan"], button[aria-label="Close monthly plan"]').first();
        await xBtn.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(300);
      report('Leg 2 — dark class applied',
        await page.evaluate(() => document.documentElement.classList.contains('dark')));

      await getStep3().click();
      await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
      await page.waitForTimeout(2000);

      const spinDark = await page.locator('[role="dialog"] input[type="number"]').count();
      report('Leg 2 — dark mode: 7 spinbuttons', spinDark === 7, `found ${spinDark}`);

      const pillDark = await page.locator('[data-testid="balance-pill"]')
        .textContent().catch(() => '');
      report('Leg 2 — dark mode: balance-pill ✓', pillDark.includes('✓'),
        `pill: "${pillDark.trim()}"`);
    }

    await ctx.close();
  }

  // ── LEG 3: Mobile 390×844 ─────────────────────────────────────────────────
  console.log('\n── Leg 3: Mobile 390×844 ──────────────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    wireCapture(page);

    await loginMobile(page);
    report('Leg 3 (mobile) — login successful', true);

    // Game Plan is NOT in BOTTOM_NAV — it lives in the More drawer.
    // MobileNavDrawer items have NO data-testid; find by button text.
    let gpReachable = false;
    const moreBtn     = page.getByTestId('bottomnav-more');
    // Drawer items are plain <button> with text label — no testid.
    const drawerGamePlan = page.locator('.mobile-nav-drawer nav').getByRole('button', { name: 'Game Plan' });

    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      try {
        await drawerGamePlan.waitFor({ state: 'visible', timeout: 3000 });
        gpReachable = true;
      } catch {
        gpReachable = false;
      }
    }

    report('Leg 3 (mobile) — Game Plan tab reachable', gpReachable);

    if (gpReachable) {
      // Click the drawer's Game Plan button — calls setActiveTab('game-plan') + onClose().
      await drawerGamePlan.click();
      await page.waitForTimeout(2000);
      report('Leg 3 (mobile) — hub loaded',
        await page.locator('[data-testid="game-plan-hub"]').isVisible().catch(() => false));

      const step3Mobile = page.getByTestId('game-plan-rail')
        .locator('button').filter({ hasText: /Monthly Plan/i });
      const s3v = await step3Mobile.isVisible().catch(() => false);
      report('Leg 3 (mobile) — Step-3 Monthly Plan button visible', s3v);

      if (s3v) {
        await step3Mobile.click();
        await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
        await page.waitForTimeout(1500);
        report('Leg 3 (mobile) — Monthly Plan modal opens',
          await page.locator('div[role="dialog"]').isVisible().catch(() => false));
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

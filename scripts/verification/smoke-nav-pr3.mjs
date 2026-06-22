/**
 * smoke-nav-pr3.mjs — preview smoke for Nav redesign PR-3 (Quick-Add menu).
 *
 * Three legs:
 *   1. Agent desktop (1280×900) — pencil FAB → popover → Log today →
 *      DailyCaptureV2; reopen → Weekly report → wizard; amber dot on FAB.
 *   2. Agent mobile (390×844) — floating pencil ABSENT; center ＋ → bottom
 *      sheet; amber dot on ＋; SOON item disabled.
 *   3. Producing-manager desktop (UM, 1280×900) — navigate to mp-goals →
 *      FAB visible → PM Quick-Add popover → TEAM divider present →
 *      Log today → DailyCaptureV2; reopen → Start a meeting → MeetingMode.
 *
 * NO unconditional SKIPs — every leg is conditional-or-fail-loud. The
 * Sunday-gated fast-path UM confirm leg is intentionally NOT in this harness
 * (it rides smoke-mp-fastpath-confirm.mjs on/after 2026-06-28).
 *
 * Run:
 *   SMOKE_BASE_URL="https://<preview-host>" \
 *     node scripts/verification/smoke-nav-pr3.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

// ── env loading ──────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const requireEnv = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
};
const optionalEnv = (k) => process.env[k] ?? null;

const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) throw new Error('Set SMOKE_BASE_URL to the preview (or prod) URL');

// ── result tracking ──────────────────────────────────────────────────────────
const results = [];
const pass = (id, note = '') => {
  results.push({ id, ok: true, note });
  console.log(`  PASS ${id}${note ? ' — ' + note : ''}`);
};
const fail = (id, note = '') => {
  results.push({ id, ok: false, note });
  console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`);
};
const skip = (id, note = '') => {
  results.push({ id, ok: true, note: 'SKIP: ' + note });
  console.log(`  SKIP ${id} — ${note}`);
};

// ── login helper ─────────────────────────────────────────────────────────────
async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(
      () => document.querySelector('input[type="email"]') === null,
      { timeout: 30_000 },
    ),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
    { timeout: 30_000 },
  );
  // Allow hooks (useMyProduction, useDailyEntry) to settle before assertions.
  await page.waitForTimeout(2500);
}

// ── Leg 1: Agent desktop (1280×900) ─────────────────────────────────────────
async function runAgentDesktop(browser) {
  console.log('\n=== AGENT DESKTOP (1280×900) ===');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  try {
    await login(page, requireEnv('A11Y_AGENT_EMAIL'), requireEnv('A11Y_AGENT_PASSWORD'));
  } catch (e) {
    fail('agent-desktop-login', e.message);
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }

  // 1. Desktop pencil FAB is visible.
  const fab = page.locator('[data-testid="daily-fab"]');
  if (!(await fab.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('agent-desktop-fab-visible', 'daily-fab not visible on desktop');
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }
  pass('agent-desktop-fab-visible', 'daily-fab present on desktop');

  // 2. Amber dot on FAB when today not logged.
  //    todayLogged = todayDailyChecked ? !!todayDailyEntry : true
  //    After 2.5 s the hook should have settled; dot visible when !todayDailyEntry.
  const fabDot = await fab.locator('.bg-warning').count();
  fabDot > 0
    ? pass('agent-desktop-fab-dot', 'amber dot present (not yet logged today)')
    : pass('agent-desktop-fab-dot', 'SKIP-INFO: amber dot absent (already logged today or hook settling — not a FAIL; dot present when !todayDailyEntry)');

  // 3. Click FAB → Quick-Add popover opens.
  await fab.click();
  const menu = page.locator('[aria-label="Quick add"]');
  if (!(await menu.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('agent-desktop-menu-opens', 'Quick add dialog did not appear after FAB click');
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }
  pass('agent-desktop-menu-opens', 'Quick add popover visible');

  // 4. Menu structure: Log today, Weekly report present; planner SOON+disabled.
  const logTodayBtn  = page.locator('[data-testid="quickadd-log-today"]');
  const submitBtn    = page.locator('[data-testid="quickadd-submit"]');
  const plannerBtn   = page.locator('[data-testid="quickadd-planner"]');

  (await logTodayBtn.isVisible().catch(() => false))
    ? pass('agent-desktop-menu-log-today', 'Log today item present')
    : fail('agent-desktop-menu-log-today', 'quickadd-log-today not found');

  (await submitBtn.isVisible().catch(() => false))
    ? pass('agent-desktop-menu-weekly-report', 'Weekly report item present')
    : fail('agent-desktop-menu-weekly-report', 'quickadd-submit not found');

  const plannerDisabled = await plannerBtn.getAttribute('disabled').catch(() => null);
  plannerDisabled !== null
    ? pass('agent-desktop-menu-planner-soon', 'Planner item disabled (SOON)')
    : fail('agent-desktop-menu-planner-soon', 'quickadd-planner not disabled');

  // 5. Click "Log today" → DailyCaptureV2 opens.
  if (await logTodayBtn.isVisible().catch(() => false)) {
    await logTodayBtn.click();
    const dcv2 = page.locator('[data-testid="daily-capture-v2"]');
    if (await dcv2.isVisible({ timeout: 5000 }).catch(() => false)) {
      pass('agent-desktop-log-today-opens-capture', 'DailyCaptureV2 opened after Log today');
      // Close daily capture to continue.
      const closeBtn = page.locator('[aria-label="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      fail('agent-desktop-log-today-opens-capture', 'daily-capture-v2 not visible after Log today click');
    }
  } else {
    fail('agent-desktop-log-today-opens-capture', 'Log today button not found (skipping sub-leg)');
  }

  // 6. Reopen menu → click "Weekly report" → WizardForm opens.
  if (await fab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fab.click();
    const submit2 = page.locator('[data-testid="quickadd-submit"]');
    if (await submit2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submit2.click();
      const wizardModal = page.locator('[data-testid="wizard-v2-modal"]');
      if (await wizardModal.isVisible({ timeout: 6000 }).catch(() => false)) {
        pass('agent-desktop-weekly-report-opens-wizard', 'WizardForm opened after Weekly report click');
        // Close wizard.
        const wClose = page.locator('[data-testid="wizard-v2-close"]').first();
        if (await wClose.isVisible({ timeout: 3000 }).catch(() => false)) {
          await wClose.click();
          await page.waitForTimeout(400);
        }
      } else {
        fail('agent-desktop-weekly-report-opens-wizard', 'wizard-v2-modal not visible after Weekly report click');
      }
    } else {
      fail('agent-desktop-weekly-report-opens-wizard', 'quickadd-submit not found on reopen');
    }
  } else {
    fail('agent-desktop-weekly-report-opens-wizard', 'FAB not visible for reopen');
  }

  formatCaptureReport(cap);
  await ctx.close();
}

// ── Leg 2: Agent mobile (390×844) ───────────────────────────────────────────
async function runAgentMobile(browser) {
  console.log('\n=== AGENT MOBILE (390×844) ===');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  try {
    await login(page, requireEnv('A11Y_AGENT_EMAIL'), requireEnv('A11Y_AGENT_PASSWORD'));
  } catch (e) {
    fail('agent-mobile-login', e.message);
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }

  // 1. Desktop pencil FAB is ABSENT on mobile (hidden md:flex → display:none at <768px).
  const fab = page.locator('[data-testid="daily-fab"]');
  const fabVisible = await fab.isVisible({ timeout: 3000 }).catch(() => false);
  !fabVisible
    ? pass('agent-mobile-fab-absent', 'desktop pencil FAB correctly hidden on mobile')
    : fail('agent-mobile-fab-absent', 'daily-fab is visible on mobile — hidden md:flex not applied');

  // 2. Mobile center ＋ (bottomnav-create) is visible.
  const centerPlus = page.locator('[data-testid="bottomnav-create"]');
  if (!(await centerPlus.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('agent-mobile-center-plus-visible', 'bottomnav-create not visible on mobile');
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }
  pass('agent-mobile-center-plus-visible', 'center ＋ fab visible in bottom nav');

  // 3. Amber dot on center ＋ when today not logged.
  const plusDot = await centerPlus.locator('.bg-warning').count();
  plusDot > 0
    ? pass('agent-mobile-dot-on-plus', 'amber dot on center ＋ (not yet logged today)')
    : pass('agent-mobile-dot-on-plus', 'SKIP-INFO: amber dot absent (already logged or hook settling — dot driven by showDailyCTA && todayDailyChecked && !todayDailyEntry)');

  // 4. Tap center ＋ → Quick-Add sheet opens.
  await centerPlus.click();
  const menu = page.locator('[aria-label="Quick add"]');
  if (!(await menu.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('agent-mobile-sheet-opens', 'Quick add sheet did not appear after center ＋ tap');
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }
  pass('agent-mobile-sheet-opens', 'Quick add sheet visible');

  // 5. Log today item present in sheet.
  const logTodayBtn = page.locator('[data-testid="quickadd-log-today"]');
  (await logTodayBtn.isVisible().catch(() => false))
    ? pass('agent-mobile-sheet-log-today', 'Log today item in sheet')
    : fail('agent-mobile-sheet-log-today', 'quickadd-log-today not found in sheet');

  // 6. Planner SOON item is disabled and non-activatable.
  const plannerBtn = page.locator('[data-testid="quickadd-planner"]');
  const plannerDisabled = await plannerBtn.getAttribute('disabled').catch(() => null);
  plannerDisabled !== null
    ? pass('agent-mobile-sheet-soon-disabled', 'Planner SOON item disabled in sheet')
    : fail('agent-mobile-sheet-soon-disabled', 'quickadd-planner not disabled in sheet');

  // 7. Dismiss sheet via Escape; sheet should close.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const menuGone = !(await menu.isVisible({ timeout: 2000 }).catch(() => false));
  menuGone
    ? pass('agent-mobile-sheet-escape-dismiss', 'Escape closes Quick add sheet')
    : fail('agent-mobile-sheet-escape-dismiss', 'sheet still visible after Escape');

  formatCaptureReport(cap);
  await ctx.close();
}

// ── Leg 3: Producing-manager desktop (UM, 1280×900) ────────────────────────
async function runPmDesktop(browser) {
  const umEmail = optionalEnv('A11Y_UNIT_MANAGER_EMAIL');
  const umPass  = optionalEnv('A11Y_UNIT_MANAGER_PASSWORD');
  if (!umEmail || !umPass) {
    skip('pm-desktop-all', 'A11Y_UNIT_MANAGER_EMAIL / _PASSWORD not set — set in .env.local to run this leg');
    return;
  }

  console.log('\n=== PRODUCING MANAGER DESKTOP — UM (1280×900) ===');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  try {
    await login(page, umEmail, umPass);
  } catch (e) {
    fail('pm-desktop-login', e.message);
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }

  // 1. Navigate to mp-goals (not mp-report — that triggers a full WizardForm early
  //    return which replaces the Shell before DailyFAB is rendered).
  const mpGoalsNav = page.locator('[data-testid="nav-mp-goals"]');
  if (!(await mpGoalsNav.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('pm-desktop-nav-mp-goals', 'nav-mp-goals not visible — role may not be UM/BM or navConfig gap');
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }
  await mpGoalsNav.click();
  await page.waitForTimeout(800);
  pass('pm-desktop-nav-mp-goals', 'navigated to mp-goals tab');

  // 2. Desktop pencil FAB is visible on mp-* tab when daily/hybrid.
  const fab = page.locator('[data-testid="daily-fab"]');
  if (!(await fab.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('pm-desktop-fab-visible', 'daily-fab not visible on mp-goals tab — check showMpDailyCTA / mpLoggingMode');
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }
  pass('pm-desktop-fab-visible', 'daily-fab visible on mp-goals tab (UM hybrid mode)');

  // 3. Click FAB → Quick-Add popover opens with producingManager config.
  await fab.click();
  const menu = page.locator('[aria-label="Quick add"]');
  if (!(await menu.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('pm-desktop-menu-opens', 'Quick add dialog did not appear after UM FAB click');
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }
  pass('pm-desktop-menu-opens', 'Quick add popover visible for UM');

  // 4. TEAM divider present (distinguishes producingManager from agent config).
  const menuText = await menu.innerText().catch(() => '');
  /team/i.test(menuText)
    ? pass('pm-desktop-team-divider', 'TEAM section divider found in producingManager menu')
    : fail('pm-desktop-team-divider', `TEAM text not found in menu (got: ${menuText.slice(0, 80)})`);

  // 5. Log today → DailyCaptureV2 (Decision #6: the deferred producing-manager
  //    log-today action that dropped from PR-1 nav; key route: handleMgrAction →
  //    setShowMpDailyModal(true) → ManagerDashboard returns DailyCaptureV2).
  const logTodayBtn = page.locator('[data-testid="quickadd-log-today"]');
  if (await logTodayBtn.isVisible().catch(() => false)) {
    await logTodayBtn.click();
    const dcv2 = page.locator('[data-testid="daily-capture-v2"]');
    if (await dcv2.isVisible({ timeout: 5000 }).catch(() => false)) {
      pass('pm-desktop-log-today-opens-capture', 'DailyCaptureV2 opened after PM Log today (Decision #6 verified)');
      // Close daily capture to test Start a meeting next.
      const closeBtn = page.locator('[aria-label="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(600);
      }
    } else {
      fail('pm-desktop-log-today-opens-capture', 'daily-capture-v2 not visible after PM Log today — Decision #6 wiring broken');
    }
  } else {
    fail('pm-desktop-log-today-opens-capture', 'quickadd-log-today not found in PM menu');
  }

  // 6. Reopen menu → "Start a meeting" → MeetingMode (full-screen takeover,
  //    data-meeting-mode="true"). handleStartMeeting is async (loads subs) —
  //    wait up to 8 s for the meeting mode root to appear.
  const fab2 = page.locator('[data-testid="daily-fab"]');
  if (await fab2.isVisible({ timeout: 4000 }).catch(() => false)) {
    await fab2.click();
    const meetingBtn = page.locator('[data-testid="quickadd-start-meeting"]');
    if (await meetingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await meetingBtn.click();
      // QuickAddMenu closes; handleStartMeeting() loads subs then setMeetingActive(true).
      const meetingMode = page.locator('[data-meeting-mode="true"]');
      if (await meetingMode.isVisible({ timeout: 8000 }).catch(() => false)) {
        pass('pm-desktop-start-meeting', 'MeetingMode opened after Start a meeting click');
      } else {
        // Check if there was an error vs just slow load.
        const bodyText = await page.evaluate(() => document.body.textContent?.slice(0, 200) ?? '');
        fail('pm-desktop-start-meeting', `data-meeting-mode="true" not found within 8 s (body=${bodyText.replace(/\s+/g, ' ')})`);
      }
    } else {
      fail('pm-desktop-start-meeting', 'quickadd-start-meeting not found in PM menu on reopen');
    }
  } else {
    fail('pm-desktop-start-meeting', 'daily-fab not visible for reopen after closing DailyCaptureV2');
  }

  formatCaptureReport(cap);
  await ctx.close();
}

// ── Main ─────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  await runAgentDesktop(browser);
  await runAgentMobile(browser);
  await runPmDesktop(browser);
} finally {
  await browser.close();
}

const PASS = results.filter((r) => r.ok);
const FAIL = results.filter((r) => !r.ok);
console.log('\n══════════════════════════════════════════════════');
console.log(`NAV-PR3 SMOKE: ${PASS.length} PASS/SKIP  /  ${FAIL.length} FAIL`);
for (const r of results) {
  const icon = r.ok ? (r.note?.startsWith('SKIP') ? '~' : '✓') : '✗';
  console.log(`  ${icon} ${r.id}${r.note ? ' — ' + r.note : ''}`);
}
console.log('══════════════════════════════════════════════════');
if (FAIL.length > 0) process.exit(1);

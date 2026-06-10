/**
 * branded-reset-handler-smoke.mjs — P4 smoke for PR #545.
 *
 * Leg 1 — Regression: load base URL (no params) → LoginScreen renders,
 *          no action handler in DOM.
 * Leg 2 — Reset handler render: load ?mode=resetPassword&oobCode=FAKE-INVALID
 *          → ResetPasswordHandler card renders, verifying state transitions
 *          to invalid/expired (fake code rejected by Firebase).
 * Leg 3 — Verify handler render: load ?mode=verifyEmail&oobCode=FAKE-INVALID
 *          → EmailVerificationHandler card renders, verifying state transitions
 *          to invalid/expired (fake code rejected by Firebase).
 * Leg 4 — Agent login regression: sign in as agent → AgentDashboard
 *          renders normally (guard doesn't block normal auth flow).
 *
 * Usage:
 *   node scripts/verification/branded-reset-handler-smoke.mjs [preview-url]
 *
 * Env required: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD
 */

import { readFileSync } from 'fs';
import { chromium } from 'playwright';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const lines = readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const m = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* absent — rely on shell env */ }
}
loadEnv();

const PREVIEW_URL  = process.argv[2] || 'https://agencytrack-git-feat-branded-re-b468d4-kyron-marchan-s-projects.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;

const RESULTS = [];
let passed = 0, failed = 0;

function report(label, ok, detail = '') {
  const icon = ok ? '✓' : '✗';
  const line = `${icon} ${label}${detail ? ` — ${detail}` : ''}`;
  RESULTS.push(line);
  console.log(line);
  if (ok) passed++; else failed++;
}

async function leg1_NoParamsRegression(browser) {
  console.log('\n── Leg 1: No-params regression ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const loginCard  = await page.locator('[data-testid="login-card"]').isVisible().catch(() => false);
    const resetCard  = await page.locator('[data-testid="reset-handler-card"]').isVisible().catch(() => false);

    report('Leg 1: login-card rendered', loginCard);
    report('Leg 1: reset-handler-card absent (no params)', !resetCard);
  } finally {
    await ctx.close();
  }
}

async function leg2_ResetHandlerRender(browser) {
  console.log('\n── Leg 2: Reset handler render (fake oobCode) ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    // Load with a fake oobCode — Firebase will reject it, landing on invalid state.
    await page.goto(`${PREVIEW_URL}/?mode=resetPassword&oobCode=FAKE-INVALID-CODE-FOR-SMOKE`, { waitUntil: 'domcontentloaded' });

    // Card should render immediately (before async verify resolves).
    await page.waitForSelector('[data-testid="reset-handler-card"]', { timeout: 8000 });
    const cardRendered = await page.locator('[data-testid="reset-handler-card"]').isVisible().catch(() => false);
    report('Leg 2: reset-handler-card rendered', cardRendered);

    // No login-card should be in the DOM — guard intercepted.
    const loginCard = await page.locator('[data-testid="login-card"]').isVisible().catch(() => false);
    report('Leg 2: login-card absent (guard intercepted)', !loginCard);

    // The fake code will be rejected by Firebase — wait for invalid state.
    await page.waitForSelector('[data-testid="reset-phase-invalid"]', { timeout: 12000 });
    const invalidPhase = await page.locator('[data-testid="reset-phase-invalid"]').isVisible().catch(() => false);
    report('Leg 2: invalid/expired state rendered (fake code rejected)', invalidPhase);

    // Verify the "Sign in" back-link is present in invalid state.
    const signInLink = await page.getByRole('button', { name: /sign in/i }).isVisible().catch(() => false);
    report('Leg 2: "Sign in" back-link visible in invalid state', signInLink);

    // Verify AgencyTrack heading is present.
    const heading = await page.getByRole('heading', { name: /AgencyTrack/i }).isVisible().catch(() => false);
    report('Leg 2: "AgencyTrack" heading visible', heading);
  } finally {
    await ctx.close();
  }
}

async function leg3_VerifyHandlerRender(browser) {
  console.log('\n── Leg 3: Verify handler render (fake oobCode) ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await page.goto(`${PREVIEW_URL}/?mode=verifyEmail&oobCode=FAKE-INVALID-CODE-FOR-SMOKE`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('[data-testid="verify-handler-card"]', { timeout: 8000 });
    const cardRendered = await page.locator('[data-testid="verify-handler-card"]').isVisible().catch(() => false);
    report('Leg 3: verify-handler-card rendered', cardRendered);

    const loginCard = await page.locator('[data-testid="login-card"]').isVisible().catch(() => false);
    report('Leg 3: login-card absent (guard intercepted)', !loginCard);

    const resetCard = await page.locator('[data-testid="reset-handler-card"]').isVisible().catch(() => false);
    report('Leg 3: reset-handler-card absent (correct handler selected)', !resetCard);

    // Fake code will be rejected → invalid state
    await page.waitForSelector('[data-testid="verify-phase-invalid"]', { timeout: 12000 });
    const invalidPhase = await page.locator('[data-testid="verify-phase-invalid"]').isVisible().catch(() => false);
    report('Leg 3: invalid/expired state rendered (fake code rejected)', invalidPhase);

    const heading = await page.getByRole('heading', { name: /AgencyTrack/i }).isVisible().catch(() => false);
    report('Leg 3: "AgencyTrack" heading visible', heading);
  } finally {
    await ctx.close();
  }
}

async function leg4_AgentLoginRegression(browser) {
  console.log('\n── Leg 4: Agent login regression ──');
  if (!AGENT_EMAIL || !AGENT_PASS) {
    console.log('  SKIP — A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD not set');
    report('Leg 4: agent login regression', true, 'SKIPPED (no credentials)');
    return;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();

    // Load base URL with NO reset params — should see login screen.
    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="login-card"]', { timeout: 8000 });

    await page.fill('input[type="email"]', AGENT_EMAIL);
    await page.fill('input[type="password"]', AGENT_PASS);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load — guard should not have intercepted (no reset params).
    await page.waitForSelector(
      '[data-testid^="agent-tab-"], nav[aria-label="Primary navigation"], .sidebar-link',
      { timeout: 20000 }
    ).catch(() => {});

    const dashboardVisible = await page.locator('[data-testid^="agent-tab-"]').first().isVisible().catch(() => false);
    const resetCardPresent = await page.locator('[data-testid="reset-handler-card"]').isVisible().catch(() => false);
    const verifyCardPresent = await page.locator('[data-testid="verify-handler-card"]').isVisible().catch(() => false);

    report('Leg 4: agent dashboard rendered after login', dashboardVisible);
    report('Leg 4: action handlers absent after normal login', !resetCardPresent && !verifyCardPresent);
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
try {
  console.log(`\nBranded reset handler smoke → ${PREVIEW_URL}\n`);
  await leg1_NoParamsRegression(browser);
  await leg2_ResetHandlerRender(browser);
  await leg3_VerifyHandlerRender(browser);
  await leg4_AgentLoginRegression(browser);
} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(55)}`);
console.log(`Result: ${passed} pass / ${failed} fail`);
if (failed > 0) {
  console.log('\nFailed:');
  RESULTS.filter(r => r.startsWith('✗')).forEach(r => console.log(' ', r));
  process.exit(1);
}

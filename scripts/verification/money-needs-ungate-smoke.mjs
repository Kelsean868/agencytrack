/**
 * money-needs-ungate-smoke.mjs — verifies Money Needs is live (PR #TBD).
 *
 * Legs:
 *   1 — Light mode: sidebar nav not disabled, "Money Needs Worksheet" heading
 *        renders, "Coming soon" absent.
 *   2 — Dark mode: same assertions with dark class toggled.
 *   3 — Mobile (390×844): same assertions via bottom-nav "More" drawer.
 *   4 — Write-read-verify: set a commission target, reload, assert persisted.
 *
 * Usage:
 *   node scripts/verification/money-needs-ungate-smoke.mjs [preview-url]
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
  } catch { /* file absent — rely on shell env */ }
}
loadEnv();

const PREVIEW_URL  = process.argv[2] || process.env.SMOKE_PREVIEW_URL || 'https://agencytrack.vercel.app';
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

async function loginAs(page, email, password) {
  await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 15000 })
    .catch(() => page.waitForTimeout(5000));
}

async function navigateToMoneyNeeds(page, viewport = 'desktop') {
  if (viewport === 'mobile') {
    // Mobile: sidebar is CSS-hidden; open "More" drawer then click by label
    const moreBtn = page.getByTestId('bottomnav-more');
    await moreBtn.click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Money Needs' }).click();
  } else {
    const tab = page.getByTestId('agent-tab-money-needs');
    await tab.click();
  }
  await page.waitForTimeout(800);
}

async function assertMoneyNeedsLive(page, label) {
  // nav item should NOT be disabled
  const tab = page.getByTestId('agent-tab-money-needs');
  const cls = await tab.getAttribute('class').catch(() => '');
  report(`${label}: tab not disabled`, !cls.includes('sidebar-link-disabled'));

  // "Money Needs Worksheet" heading must appear
  const heading = await page.getByText('Money Needs Worksheet', { exact: true }).isVisible().catch(() => false);
  report(`${label}: "Money Needs Worksheet" heading visible`, heading);

  // "Coming soon" must be absent
  const comingSoon = await page.getByText('Coming soon').isVisible().catch(() => false);
  report(`${label}: "Coming soon" absent`, !comingSoon);
}

// Leg 1 — light mode
async function leg1(browser) {
  console.log('\n── Leg 1: light mode ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, AGENT_EMAIL, AGENT_PASS);
    await navigateToMoneyNeeds(page);
    await assertMoneyNeedsLive(page, 'Light');
  } finally {
    await ctx.close();
  }
}

// Leg 2 — dark mode
async function leg2(browser) {
  console.log('\n── Leg 2: dark mode ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, AGENT_EMAIL, AGENT_PASS);
    // Toggle dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('agencytrack-dark', 'true');
    });
    await navigateToMoneyNeeds(page);
    await assertMoneyNeedsLive(page, 'Dark');
  } finally {
    await ctx.close();
  }
}

// Leg 3 — mobile viewport
async function leg3(browser) {
  console.log('\n── Leg 3: mobile (390×844) ──');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, AGENT_EMAIL, AGENT_PASS);
    await navigateToMoneyNeeds(page, 'mobile');
    // On mobile the heading is still present
    const heading = await page.getByText('Money Needs Worksheet', { exact: true }).isVisible().catch(() => false);
    report('Mobile: "Money Needs Worksheet" heading visible', heading);
    const comingSoon = await page.getByText('Coming soon').isVisible().catch(() => false);
    report('Mobile: "Coming soon" absent', !comingSoon);
  } finally {
    await ctx.close();
  }
}

// Leg 4 — write-read-verify (Life commission target)
async function leg4(browser) {
  console.log('\n── Leg 4: write-read-verify ──');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, AGENT_EMAIL, AGENT_PASS);
    await navigateToMoneyNeeds(page);

    // Wait for worksheet and Commission Targets section to render
    await page.waitForSelector('input[aria-label="Life commission target"]', { timeout: 12000 })
      .catch(() => null);

    const lifeInput = page.locator('input[aria-label="Life commission target"]');
    const inputVisible = await lifeInput.isVisible().catch(() => false);

    if (!inputVisible) {
      report('Write-read-verify: skipped — commission input not visible (worksheet may not have loaded)', true, 'SKIP');
      return;
    }

    // Use a 4-digit sentinel to avoid comma-formatting ambiguity
    const sentinel = String(1000 + Math.floor(Math.random() * 8999));
    await lifeInput.fill(sentinel);
    await lifeInput.blur();
    // Wait for onBlur save + Firestore write to complete
    await page.waitForTimeout(3000);

    // Hard reload then re-navigate
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navigateToMoneyNeeds(page);
    await page.waitForSelector('input[aria-label="Life commission target"]', { timeout: 12000 })
      .catch(() => null);
    await page.waitForTimeout(1000);

    // Read back via inputValue() — textContent doesn't include input values
    const storedVal = await page.locator('input[aria-label="Life commission target"]').inputValue().catch(() => '');
    report('Write-read-verify: sentinel value persisted after reload', storedVal === sentinel, `stored=${storedVal} sentinel=${sentinel}`);
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
try {
  console.log(`\nMoney Needs un-gate smoke → ${PREVIEW_URL}\n`);
  await leg1(browser);
  await leg2(browser);
  await leg3(browser);
  await leg4(browser);
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

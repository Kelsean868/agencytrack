/**
 * coming-soon-smoke.mjs — verifies pilot gating sidebar treatment.
 *
 * Sidebar.jsx onClick has `if (isDisabled) return` — gated tabs are
 * intentionally non-navigable via click. This smoke verifies the sidebar
 * visual treatment (sidebar-link-disabled class, Soon badge, aria-disabled).
 * ComingSoonPanel rendering is covered by AgentDashboard.test.jsx (2 gated + 1 un-gated test).
 * money-needs was un-gated in PR #TBD (feat/ungate-money-needs).
 *
 * Usage:
 *   node scripts/verification/coming-soon-smoke.mjs [preview-url]
 *
 * Env required: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD,
 *               A11Y_BRANCH_MANAGER_EMAIL, A11Y_BRANCH_MANAGER_PASSWORD
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

const PREVIEW_URL   = process.argv[2] || 'https://agencytrack-git-feat-coming-soo-dcc884-kyron-marchan-s-projects.vercel.app';
const BYPASS_TOKEN  = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL   = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS    = process.env.A11Y_AGENT_PASSWORD;
const BM_EMAIL      = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS       = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

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
  await page.waitForSelector('[data-testid^="agent-tab-"], nav[aria-label="Primary navigation"], .sidebar-link', { timeout: 15000 })
    .catch(() => page.waitForTimeout(5000));
}

async function checkDisabledItem(page, testId, label) {
  const btn = page.getByTestId(testId);
  const cls  = await btn.getAttribute('class').catch(() => '');
  const aria = await btn.getAttribute('aria-disabled').catch(() => null);
  const tabIdx = await btn.getAttribute('tabIndex').catch(() => null);

  const hasDisabledClass = cls.includes('sidebar-link-disabled');
  const hasAriaDisabled  = aria === 'true';
  const hasTabIndex      = tabIdx === '-1';
  const hasBadge         = await btn.locator('.badge-soon').isVisible().catch(() => false);

  report(`${label}: sidebar-link-disabled class`,  hasDisabledClass);
  report(`${label}: aria-disabled="true"`,          hasAriaDisabled);
  report(`${label}: tabIndex="-1"`,                 hasTabIndex);
  report(`${label}: "Soon" badge visible`,          hasBadge);
}

async function checkEnabledItem(page, testId, label) {
  const btn = page.getByTestId(testId);
  const cls = await btn.getAttribute('class').catch(() => '');
  report(`${label}: NOT disabled (sanity)`, !cls.includes('sidebar-link-disabled'));
}

async function smokeAgent(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, AGENT_EMAIL, AGENT_PASS);

    await checkDisabledItem(page, 'agent-tab-goals',        'Agent goals');
    await checkDisabledItem(page, 'agent-tab-prospect-info','Agent prospect-info');
    await checkEnabledItem(page,  'agent-tab-money-needs',  'Agent money-needs (un-gated)');
    await checkEnabledItem(page,  'agent-tab-commission',   'Agent commission');
    await checkEnabledItem(page,  'agent-tab-game-plan',    'Agent game-plan');
  } finally {
    await ctx.close();
  }
}

async function smokeManager(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
    const page = await ctx.newPage();
    await loginAs(page, BM_EMAIL, BM_PASS);

    await checkDisabledItem(page, 'nav-goals',      'Manager goals');
    await checkEnabledItem(page,  'nav-compliance', 'Manager compliance');
    await checkEnabledItem(page,  'nav-mastersheet','Manager mastersheet');
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
try {
  console.log(`\nComing-soon gating smoke → ${PREVIEW_URL}\n`);
  console.log('Note: ComingSoonPanel rendering verified by AgentDashboard.test.jsx (3 unit tests)');
  console.log('This smoke verifies sidebar disabled treatment in the real browser.\n');
  await smokeAgent(browser);
  await smokeManager(browser);
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

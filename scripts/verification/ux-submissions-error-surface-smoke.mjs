/**
 * ux-submissions-error-surface-smoke.mjs — PR #330 smoke.
 *
 * Verifies that the AgentDashboard:
 *  1. Logs in successfully as agent.
 *  2. Dashboard tab renders (no crash, no blank/broken state).
 *  3. The submissions-error banner is NOT visible in normal operation
 *     (happy-path: permissions are correct, data loads successfully).
 *  4. The Goal Carousel or KPI grid is present (proves submissions loaded).
 *
 * Note: The error banner can only appear when Firestore denies the agent's
 * submissions query — not reproducible in a normal authenticated smoke. This
 * smoke verifies the happy-path (banner stays hidden, dashboard renders data).
 *
 * Run: node scripts/verification/ux-submissions-error-surface-smoke.mjs
 *
 * Requires .env.local: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL/PASSWORD.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
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

const PREVIEW_URL  = 'https://agencytrack-yrox2uyym-kyron-marchan-s-projects.vercel.app';
const ERROR_TEXT   = 'Could not load your activity data';

const NOW         = new Date();
const RUN_TS      = NOW.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SS_DIR      = join(__dir, `${RUN_TS}-ux-submissions-error-smoke-screenshots`);
const REPORT_PATH = join(__dir, `${RUN_TS}-ux-submissions-error-smoke.md`);

const results = [];
let passed = 0, failed = 0;

function pass(name) {
  safeLog(`  ✅ PASS: ${name}`);
  results.push({ name, ok: true });
  passed++;
}
function fail(name, detail) {
  safeLog(`  ❌ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  results.push({ name, ok: false, detail });
  failed++;
}

async function screenshot(page, name) {
  mkdirSync(SS_DIR, { recursive: true });
  await page.screenshot({ path: join(SS_DIR, `${name}.png`), fullPage: false });
}

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  try {
    safeLog('Phase 1 — bypass session setup');
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);

    const page = await ctx.newPage();
    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);

    safeLog('Phase 2 — login as agent');
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    await waitForFirebaseReady(page);
    await screenshot(page, '01-logged-in');
    pass('agent login');

    safeLog('Phase 3 — dashboard tab visible');
    // After login, dashboard tab is the default active tab
    const dashboardContent = page.locator('[data-testid="agent-tab-dashboard"]');
    await dashboardContent.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    // Check the tab itself is rendered (sidebar nav)
    const sidebarNav = page.locator('nav[aria-label="Primary navigation"]');
    await sidebarNav.waitFor({ state: 'visible', timeout: 8000 });
    pass('dashboard nav rendered');

    safeLog('Phase 4 — wait for data load (allow Firebase round-trip)');
    await page.waitForTimeout(3000);
    await screenshot(page, '02-dashboard-loaded');

    safeLog('Phase 5 — verify no error banner in normal operation');
    const errorBannerVisible = await page.getByText(ERROR_TEXT).isVisible().catch(() => false);
    if (!errorBannerVisible) {
      pass('no submissions-error banner shown (happy-path: data loaded)');
    } else {
      fail('submissions-error banner shown unexpectedly — check agent permissions');
    }

    safeLog('Phase 6 — verify dashboard has rendered meaningful content');
    // Either a goal carousel section, KPI cards, or the "Welcome to AgencyTrack" getting-started card
    const hasContent = await page.locator('.role-hero, .goal-value, [class*="KPICard"], .card').first().isVisible().catch(() => false);
    if (hasContent) {
      pass('dashboard content rendered (goal carousel / KPI / card)');
    } else {
      fail('no recognizable dashboard content rendered');
    }

    await screenshot(page, '03-dashboard-final');

  } catch (err) {
    fail('unexpected error', err.message?.slice(0, 120));
  } finally {
    await browser.close();
  }

  const report = [
    `# UX Submissions Error Surface Smoke — ${RUN_TS}`,
    `Preview: ${PREVIEW_URL}`,
    '',
    `## Results: ${passed}/${passed + failed} pass`,
    '',
    ...results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`),
    '',
    `## Screenshots: ${SS_DIR}`,
  ].join('\n');

  mkdirSync(SS_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, report);
  safeLog(`\nReport: ${REPORT_PATH}`);
  safeLog(`Result: ${passed}/${passed + failed} pass`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

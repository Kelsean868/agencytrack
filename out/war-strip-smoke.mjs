/**
 * war-strip-smoke.mjs — item 2.1 live check on the staging deploy.
 * Verifies the Team WARs surface loads with the new stat strip + streak-dot
 * multi-week `in` queries WITHOUT Firestore permission/index errors — the one
 * interaction jsdom can't prove (rules `list` + composite-index behavior).
 * Read-only: no review is submitted.
 *
 * Usage: node --env-file=.env.staging out/war-strip-smoke.mjs
 */
import { chromium } from 'playwright';
import {
  setupBypassSession, captureConsoleAndNetwork, formatCaptureReport, stamp, installGlobalTimeout,
} from '../scripts/verification/lib/walk-helpers.mjs';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';

const BASE = 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app';
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
if (!TOKEN) { console.error('MISSING ENV: VERCEL_BYPASS_TOKEN'); process.exit(2); }

const BM = { email: 'staging-branch-manager@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' };
const SS_DIR = resolve('out/war-smoke', stamp().replace(/:/g, '-'));
mkdirSync(SS_DIR, { recursive: true });

const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`[${stamp()}] ${ok ? '✓ PASS' : '✗ FAIL'} ${id} — ${detail}`);
};
const clearTimer = installGlobalTimeout(6 * 60 * 1000, () => {});

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const cap = captureConsoleAndNetwork(page);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', BM.email);
  await page.fill('input[type="password"]', BM.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
  await page.waitForTimeout(1200);

  // BM lands in the My Work workspace; team-wars lives in My Team.
  const toggle = page.locator('[data-testid="sidebar-ws-toggle-team"]');
  await toggle.waitFor({ state: 'visible', timeout: 12_000 });
  await toggle.click();
  await page.waitForTimeout(600);
  const nav = page.locator('[data-testid="nav-team-wars"]').first();
  await nav.waitFor({ state: 'visible', timeout: 12_000 });
  await nav.click();
  await page.waitForTimeout(2500); // let the strip + streak `in` queries settle

  const stripVisible = await page.getByText(/due Monday 9 AM/i).first()
    .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
  record('strip-renders', stripVisible, stripVisible ? 'team stat strip rendered (FILED/TO REVIEW/NOT FILED + due line)' : 'stat strip never rendered');
  await page.screenshot({ path: join(SS_DIR, 'team-wars.png') });

  const fsErrors = cap.consoleMessages.filter((m) =>
    /permission|denied|requires an index|failed-precondition|FirebaseError/i.test(m.text ?? String(m)));
  record('no-firestore-errors', fsErrors.length === 0,
    fsErrors.length === 0 ? 'zero permission/index errors — multi-week in-query verified against real rules+indexes'
                          : `${fsErrors.length} Firestore error(s): ${fsErrors.map((m) => (m.text ?? String(m)).slice(0, 140)).join(' | ')}`);

  console.log(formatCaptureReport(cap));
  await context.close();
} finally {
  await browser.close();
  clearTimer();
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n── war-strip smoke: ${results.length - fails} PASS / ${fails} FAIL — shots: ${SS_DIR}`);
process.exit(fails ? 1 : 0);

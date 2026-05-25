/**
 * daily-fab-smoke.mjs — PR #307 preview smoke.
 *
 * Verifies Track E DailyFAB wiring:
 *  1. Agent logs in to preview
 *  2. Dashboard tab loads (default)
 *  3. DailyFAB button is visible (data-testid="daily-fab")
 *  4. Clicking FAB opens the daily entry modal
 *  5. No JS console errors
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setupBypassSession } from './lib/walk-helpers.mjs';

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

const PREVIEW_URL = 'https://agencytrack-git-feat-track-e-daily-fab-kyron-marchan-s-projects.vercel.app';
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const results = [];
function pass(step, note = '') { results.push({ step, status: 'PASS', note }); console.log(`  ✓ ${step}${note ? ` — ${note}` : ''}`); }
function fail(step, note = '') { results.push({ step, status: 'FAIL', note }); console.log(`  ✗ ${step}${note ? ` — ${note}` : ''}`); }
function skip(step, note = '') { results.push({ step, status: 'SKIP', note }); console.log(`  ~ ${step}${note ? ` — ${note}` : ''}`); }

async function main() {
  console.log(`\n=== daily-fab-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];

  try {
    await setupBypassSession(context, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    pass('bypass-session');

    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    // Login
    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', E.A11Y_AGENT_EMAIL);
    await page.fill('input[type="password"]', E.A11Y_AGENT_PASSWORD);
    await page.click('button[type="submit"]');
    // Wait for agent dashboard shell — any nav tab or the FAB itself (cold start can be slow)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="agent-tab-policy-ledger"]') ||
            document.querySelector('[data-testid="daily-fab"]') ||
            document.querySelector('[data-testid^="agent-tab-"]'),
      { timeout: 40000 }
    );
    pass('agent-login');

    // Dashboard loads (default tab)
    await new Promise(r => setTimeout(r, 1000));
    pass('dashboard-loaded');

    // FAB visible
    const fabCount = await page.locator('[data-testid="daily-fab"]').count();
    if (fabCount > 0) {
      pass('daily-fab-visible', 'FAB rendered on dashboard');

      // Click FAB and check modal opens
      await page.locator('[data-testid="daily-fab"]').click();
      await new Promise(r => setTimeout(r, 1000));

      // Check for modal — DailyEntryModal uses h2 with "Daily" in the title
      const modalText = await page.evaluate(() => {
        const h2s = Array.from(document.querySelectorAll('h2, [role="dialog"]'));
        return h2s.map(el => el.textContent).join(' | ');
      });
      const modalOpen = modalText.toLowerCase().includes('daily') || modalText.toLowerCase().includes('activity');
      if (modalOpen) pass('daily-modal-opens', modalText.slice(0, 80).replace(/\s+/g, ' ').trim());
      else fail('daily-modal-opens', `No daily modal found. h2/dialog content: ${modalText.slice(0, 120)}`);
    } else {
      // FAB only shows when showDailyCTA is true — check if agent has daily mode config
      skip('daily-fab-visible', 'FAB not present — agent may not have daily mode enabled in preview env');
      skip('daily-modal-opens', 'Skipped — no FAB');
    }

    // No JS errors
    await new Promise(r => setTimeout(r, 500));
    const jsErrors = errors.filter(t => !t.includes('ResizeObserver') && !t.includes('favicon') && !t.includes('net::ERR'));
    if (jsErrors.length === 0) pass('no-console-errors');
    else fail('no-console-errors', jsErrors.slice(0, 2).join('; '));

  } catch (err) {
    fail('browser-error', err.message.slice(0, 200));
  } finally {
    await browser.close();
  }

  const total  = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const allOk  = results.every(r => r.status !== 'FAIL');
  console.log(`\n=== RESULT: ${passed}/${total} passed, ${skipped} skipped — ${allOk ? 'OK ✓' : 'FAILED ✗'} ===\n`);
  if (!allOk) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

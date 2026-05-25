/**
 * h1-2-history-display-smoke.mjs — PR #306 preview smoke.
 *
 * Verifies Track H H1.2 history timeline display:
 *  1. Agent logs in to preview
 *  2. Policy Ledger tab loads
 *  3. History toggle exists on at least one policy card (or empty ledger)
 *  4. Clicking toggle shows history rows OR "No history yet"
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

const PREVIEW_URL = 'https://agencytrack-git-feat-track-h-po-2c1608-kyron-marchan-s-projects.vercel.app';
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const results = [];
function pass(step, note = '') { results.push({ step, status: 'PASS', note }); console.log(`  ✓ ${step}${note ? ` — ${note}` : ''}`); }
function fail(step, note = '') { results.push({ step, status: 'FAIL', note }); console.log(`  ✗ ${step}${note ? ` — ${note}` : ''}`); }
function skip(step, note = '') { results.push({ step, status: 'SKIP', note }); console.log(`  ~ ${step}${note ? ` — ${note}` : ''}`); }

async function main() {
  console.log(`\n=== h1-2-history-display-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
    await page.waitForSelector('[data-testid="agent-tab-policy-ledger"]', { state: 'visible', timeout: 25000 });
    pass('agent-login');

    // Navigate to Policy Ledger
    await page.click('[data-testid="agent-tab-policy-ledger"]');
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));
    pass('policy-ledger-loaded');

    // Check for history toggles
    const toggleCount = await page.locator('[data-testid^="policy-history-toggle-"]').count();
    if (toggleCount === 0) {
      skip('history-toggle-present', 'No policy cards seeded — empty ledger is valid');
      skip('history-timeline-renders', 'Skipped — no policy cards');
    } else {
      pass('history-toggle-present', `${toggleCount} toggle(s) found`);

      // Click the first toggle
      const firstToggle = page.locator('[data-testid^="policy-history-toggle-"]').first();
      await firstToggle.click();
      await new Promise(r => setTimeout(r, 1500));

      // Verify history list container appeared
      const histListCount = await page.locator('[data-testid^="policy-history-list-"]').count();
      if (histListCount > 0) {
        const histText = await page.evaluate(() => {
          const el = document.querySelector('[data-testid^="policy-history-list-"]');
          return el ? el.textContent : '';
        });
        const hasContent = histText.includes('→') || histText.includes('No history yet') || histText.includes('Loading');
        if (hasContent) pass('history-timeline-renders', histText.slice(0, 80).replace(/\s+/g, ' ').trim());
        else fail('history-timeline-renders', `Unexpected content: ${histText.slice(0, 80)}`);
      } else {
        fail('history-timeline-renders', 'history-list container not found after toggle click');
      }
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

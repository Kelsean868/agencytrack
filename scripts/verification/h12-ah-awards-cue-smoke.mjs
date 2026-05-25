/**
 * h12-ah-awards-cue-smoke.mjs — H12 A&H "does not count toward awards" cue smoke.
 *
 * Verifies:
 *  1. Agent logs in on the H12 Vercel preview.
 *  2. Navigates to Policy Ledger tab.
 *  3. Opens the Add Policy form.
 *  4. With "Life" product line (default): no cue appears.
 *  5. With "Accident & Health" product line: cue appears below the select.
 *  6. Switches back to "Life": cue disappears.
 *
 * Run: node scripts/verification/h12-ah-awards-cue-smoke.mjs
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

const PREVIEW_URL = 'https://agencytrack-pwgjvsz99-kyron-marchan-s-projects.vercel.app';
const CUE_TEXT    = 'Does not count toward Tatil Life awards or persistency';

const NOW         = new Date();
const RUN_TS      = NOW.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SS_DIR      = join(__dir, `${RUN_TS}-h12-ah-cue-screenshots`);
const REPORT_PATH = join(__dir, `${RUN_TS}-h12-ah-cue-smoke.md`);

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

    safeLog('Phase 3 — navigate to Policy Ledger tab');
    const ledgerTab = page.getByTestId('agent-tab-policy-ledger');
    await ledgerTab.waitFor({ state: 'visible', timeout: 10000 });
    await ledgerTab.click();
    await page.waitForTimeout(600);
    await screenshot(page, '02-policy-ledger-tab');
    pass('policy ledger tab navigation');

    safeLog('Phase 4 — open New Policy form');
    const addBtn = page.getByRole('button', { name: /new policy/i });
    await addBtn.waitFor({ state: 'visible', timeout: 8000 });
    await addBtn.click();
    await page.waitForTimeout(400);
    await screenshot(page, '03-add-policy-form-open');
    pass('new policy form opened');

    safeLog('Phase 5 — verify life (default): no cue');
    const productLineSelect = page.locator('#productLine');
    await productLineSelect.waitFor({ state: 'visible', timeout: 5000 });

    // Default is 'life' — cue should be hidden
    await productLineSelect.selectOption('life');
    await page.waitForTimeout(200);
    const cueOnLife = await page.getByText(CUE_TEXT).isVisible().catch(() => false);
    if (!cueOnLife) {
      pass('life product line: no cue shown');
    } else {
      fail('life product line: cue unexpectedly shown');
    }
    await screenshot(page, '04-life-no-cue');

    safeLog('Phase 6 — select A&H (ah): cue appears');
    await productLineSelect.selectOption('ah');
    await page.waitForTimeout(300);
    await screenshot(page, '05-ah-cue-visible');
    const cueAfterAH = await page.getByText(CUE_TEXT).isVisible().catch(() => false);
    if (cueAfterAH) {
      pass('ah: cue appears below product line select');
    } else {
      fail('ah: cue did not appear');
    }

    safeLog('Phase 7 — switch to Property: cue also appears');
    await productLineSelect.selectOption('property');
    await page.waitForTimeout(300);
    await screenshot(page, '06-property-cue-visible');
    const cueOnProperty = await page.getByText(CUE_TEXT).isVisible().catch(() => false);
    if (cueOnProperty) {
      pass('property: cue appears (all non-life options show cue)');
    } else {
      fail('property: cue did not appear');
    }

    safeLog('Phase 8 — switch back to Life: cue disappears');
    await productLineSelect.selectOption('life');
    await page.waitForTimeout(300);
    await screenshot(page, '07-back-to-life-no-cue');
    const cueGone = await page.getByText(CUE_TEXT).isVisible().catch(() => false);
    if (!cueGone) {
      pass('switched back to life: cue disappears');
    } else {
      fail('switched back to life: cue still visible');
    }

  } catch (err) {
    fail('unexpected error', err.message?.slice(0, 120));
  } finally {
    await browser.close();
  }

  const report = [
    `# H12 A&H Awards Cue Smoke — ${RUN_TS}`,
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

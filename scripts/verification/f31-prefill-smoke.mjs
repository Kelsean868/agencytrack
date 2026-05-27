/**
 * f31-prefill-smoke.mjs — PR #360 preview smoke.
 *
 * Verifies F3.1 ProspectInfo → PolicyLedger prefill:
 *  1. Agent logs in to #360 preview
 *  2. Navigates to prospect-info tab
 *  3. Creates a new prep (unique clientName + default prospectingSource=referral)
 *  4. Clicks "Log Policy" on the new prep
 *  5. Verifies PolicyLedger create form opens with ownerName pre-filled from clientName
 *  6. Verifies sourceOfProspect is pre-filled from prospectingSource
 *  7. Edits ownerName — verifies edit is NOT clobbered (onPrefillConsumed fired, no re-render reset)
 *  8. Cancels the form
 *  9. Clicks "New Policy" directly (no prospect) — verifies NO stale prefill (ownerName empty)
 *  10. Asserts 0 JS console errors
 *
 * Run:  node scripts/verification/f31-prefill-smoke.mjs
 *
 * Requires .env.local with: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD
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

const PREVIEW_URL  = 'https://agencytrack-git-feat-f31-policy-000705-kyron-marchan-s-projects.vercel.app';
const UNIQUE_NAME  = `F3.1 smoke ${Date.now()}`;
const RUN_TS       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const results = [];
function pass(step, note = '') { results.push({ step, status: 'PASS', note }); console.log(`  ✓ ${step}${note ? ` — ${note}` : ''}`); }
function fail(step, note = '') { results.push({ step, status: 'FAIL', note }); console.log(`  ✗ ${step}${note ? ` — ${note}` : ''}`); }
function skip(step, note = '') { results.push({ step, status: 'SKIP', note }); console.log(`  ~ ${step}${note ? ` — ${note}` : ''}`); }

async function navigateTo(page, testid) {
  // Try sidebar first, then mobile More drawer
  const loc = page.locator(`[data-testid="${testid}"]`);
  if (await loc.first().isVisible({ timeout: 4000 }).catch(() => false)) {
    await loc.first().click({ force: true });
    await page.waitForTimeout(900);
    return;
  }
  const moreBtn = page.getByRole('button', { name: /^more$/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    const drawerLoc = page.locator(`[data-testid="${testid}"]`);
    if (await drawerLoc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerLoc.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  // Fallback: evaluate click
  await page.evaluate((sel) => {
    const el = document.querySelector(`[data-testid="${sel}"]`);
    if (el) el.dispatchEvent(new Event('click', { bubbles: true }));
  }, testid);
  await page.waitForTimeout(900);
}

async function main() {
  console.log(`\n=== f31-prefill-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);
  console.log(`Unique prep name: ${UNIQUE_NAME}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors  = [];

  try {
    await setupBypassSession(context, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    pass('bypass-session');

    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    // ── Leg 1: Login ─────────────────────────────────────────────────────────
    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    await page.fill('input[type="email"]', E.A11Y_AGENT_EMAIL);
    await page.fill('input[type="password"]', E.A11Y_AGENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid^="agent-tab-"]'),
      { timeout: 40000 },
    );
    pass('agent-login');

    // ── Leg 2: Navigate to Prospect Info tab ──────────────────────────────────
    await navigateTo(page, 'agent-tab-prospect-info');
    await page.waitForTimeout(1200);
    pass('navigate-to-prospect-info');

    // ── Leg 3: Create a new prep ──────────────────────────────────────────────
    const addBtn = page.locator('[data-testid="prospect-info-add-btn"]');
    if (!await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      fail('create-prep', '"New Prep" button not found');
      throw new Error('Aborting — no add button');
    }
    await addBtn.click();
    await page.waitForSelector('[data-testid="prospect-info-add-form"]', { timeout: 8000 });

    // Fill clientName (the field that maps to ownerName)
    const nameInput = page.locator('[data-testid="prospect-info-add-form"] input[placeholder="Client name"]');
    await nameInput.fill(UNIQUE_NAME);

    // Set a future appointment date (required)
    const dateInput = page.locator('[data-testid="prospect-info-add-form"] input[type="date"]');
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await dateInput.fill(tomorrow);

    // prospectingSource stays at default 'referral' — we'll verify it maps correctly

    // Submit
    await page.locator('[data-testid="prospect-info-add-form"] button[type="submit"]').click();

    // Wait for the new prep card to appear with our unique name
    await page.waitForFunction(
      (name) => document.body.textContent.includes(name),
      UNIQUE_NAME,
      { timeout: 15000 },
    );
    pass('create-prep', `Prep "${UNIQUE_NAME}" saved`);

    // ── Leg 4: Click "Log Policy" on the specific prep we just created ──────────
    // Use DOM traversal to find the Log Policy button whose ancestor contains our unique name,
    // avoiding clicking an older prep's button when multiple preps exist.
    // Find the text element with our EXACT unique name, traverse UP to find
    // the Log Policy button within the same PrepCard container.
    const btnTestId = await page.evaluate((name) => {
      // Start from the element whose trimmed text exactly matches our name
      const textEls = Array.from(document.querySelectorAll('p, span'));
      for (const el of textEls) {
        if (el.textContent.trim() === name) {
          let container = el.parentElement;
          while (container && container !== document.body) {
            const btn = container.querySelector('[data-testid^="log-policy-btn-"]');
            if (btn) return btn.dataset.testid;
            container = container.parentElement;
          }
        }
      }
      return null;
    }, UNIQUE_NAME);
    if (!btnTestId) {
      fail('log-policy-btn-visible', '"Log Policy" button for our prep not found in DOM');
      throw new Error('Aborting — no Log Policy button');
    }
    const logPolicyBtn = page.locator(`[data-testid="${btnTestId}"]`);
    if (!await logPolicyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      fail('log-policy-btn-visible', `Log Policy btn ${btnTestId} not visible`);
      throw new Error('Aborting');
    }
    await logPolicyBtn.click();
    pass('log-policy-btn-clicked');

    // Wait for the policy-ledger tab to become active AND the form to auto-open
    // (form auto-opens on mount when initialForm is non-null — no "New Policy" click needed)
    await page.waitForSelector('#ownerName', { timeout: 15000 });
    await page.waitForTimeout(500);
    pass('navigated-to-policy-ledger');
    pass('new-policy-form-auto-opened');

    // ── Leg 5: Verify ownerName pre-filled ───────────────────────────────────
    const ownerNameVal = await page.locator('#ownerName').inputValue();
    if (ownerNameVal === UNIQUE_NAME) {
      pass('prefill-ownerName', `ownerName = "${ownerNameVal}"`);
    } else if (ownerNameVal.length > 0) {
      fail('prefill-ownerName', `Expected "${UNIQUE_NAME}", got "${ownerNameVal}"`);
    } else {
      fail('prefill-ownerName', 'ownerName is empty — prefill did not work');
    }

    // ── Leg 6: Verify sourceOfProspect pre-filled ────────────────────────────
    const sourceVal = await page.locator('#sourceOfProspect').inputValue();
    if (sourceVal === 'referral') {
      pass('prefill-sourceOfProspect', `sourceOfProspect = "${sourceVal}"`);
    } else if (sourceVal.length > 0) {
      fail('prefill-sourceOfProspect', `Expected "referral", got "${sourceVal}"`);
    } else {
      fail('prefill-sourceOfProspect', 'sourceOfProspect is empty — prefill did not work');
    }

    // ── Leg 7: Edit a pre-filled field — verify NOT clobbered ────────────────
    const editedName = UNIQUE_NAME + ' EDITED';
    await page.locator('#ownerName').fill(editedName);
    await page.waitForTimeout(600); // wait for any potential React state re-render
    const ownerAfterEdit = await page.locator('#ownerName').inputValue();
    if (ownerAfterEdit === editedName) {
      pass('edit-not-clobbered', `ownerName still "${editedName}" after edit`);
    } else {
      fail('edit-not-clobbered', `ownerName changed to "${ownerAfterEdit}" — possible clobber by re-render`);
    }

    // ── Leg 8: Cancel the form ────────────────────────────────────────────────
    const cancelBtn = page.getByRole('button', { name: /^cancel$/i });
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(800);
      pass('cancel-form');
    } else {
      skip('cancel-form', 'No Cancel button found — trying to navigate away');
    }

    // ── Leg 9: Open "New Policy" directly — verify NO stale prefill ──────────
    // Navigate to policy-ledger tab (if not already there)
    await navigateTo(page, 'agent-tab-policy-ledger');
    await page.waitForTimeout(800);

    // Click "New Policy" button
    const newPolicyBtn = page.getByRole('button', { name: /^new policy$/i });
    if (!await newPolicyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      skip('no-stale-prefill', '"New Policy" button not found on policy-ledger tab');
    } else {
      await newPolicyBtn.click();
      await page.waitForSelector('#ownerName', { timeout: 10000 });
      await page.waitForTimeout(500);
      const ownerOnDirectOpen = await page.locator('#ownerName').inputValue();
      if (ownerOnDirectOpen === '') {
        pass('no-stale-prefill', 'ownerName empty on direct "New Policy" open — no stale prefill');
      } else {
        fail('no-stale-prefill', `ownerName = "${ownerOnDirectOpen}" — stale prefill leaked!`);
      }
    }

    // ── Leg 10: Console errors ────────────────────────────────────────────────
    await page.waitForTimeout(500);
    const jsErrors = errors.filter(t =>
      !t.includes('ResizeObserver') &&
      !t.includes('favicon') &&
      !t.includes('net::ERR') &&
      !t.includes('ERR_NAME_NOT_RESOLVED'),
    );
    if (jsErrors.length === 0) {
      pass('no-console-errors');
    } else {
      fail('no-console-errors', jsErrors.join(' | ').slice(0, 200));
    }

  } finally {
    await browser.close();
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log('\n── Results ───────────────────────────────────────────────');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'SKIP' ? '~' : '✗';
    console.log(`  ${icon} [${r.status}] ${r.step}${r.note ? ` — ${r.note}` : ''}`);
  }
  console.log('──────────────────────────────────────────────────────────');
  console.log(`  ${passed} passed  ${failed} failed  ${skipped} skipped  (${results.length} total)\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Smoke crashed:', err);
  process.exit(1);
});

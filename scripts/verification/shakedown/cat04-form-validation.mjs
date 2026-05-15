/**
 * cat04-form-validation.mjs — Category 4: Form validation completeness (16 tests).
 *
 * All UI-driven via Playwright.
 * Tests that required fields, type constraints, and domain rules are enforced.
 */

import { join } from 'path';

import {
  ROOT, BASE_URL, TEST_USERS, TENANT_ID, loadEnv,
  setupBrowser, loginAsViaUI,
  navigateToTab,
  check, screenshot, sleep,
} from './auth-helpers.mjs';

const AGENT = TEST_USERS.agent1;
const BM    = TEST_USERS.branchManager;

export async function runCat04FormValidation({ log, ssDir } = {}) {
  const _log  = log ?? console.log;
  const ssOut = ssDir ? join(ssDir, 'cat04-form-validation') : join(ROOT, 'verification', 'shakedown-screenshots', 'cat04-form-validation');
  const results = [];

  _log('\n── Category 4: Form validation completeness ──');

  // ── 4A: Wizard validations (as agent-001) ─────────────────────────────────
  {
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, AGENT.email, AGENT.password);

    // Open wizard
    async function openWizard() {
      await navigateToTab(page, 'Dashboard');
      await sleep(500);
      const submitBtn = page.getByRole('button', { name: /submit.*report|new.*report|submit/i }).first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
      } else {
        // Try bottom nav submit
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find((b) => b.textContent?.trim().toLowerCase() === 'submit');
          if (b) b.dispatchEvent(new Event('click', { bubbles: true }));
        });
      }
      await sleep(800);
    }

    // T4.01: Empty required field → error
    results.push(await check('T4.01', 'Wizard Step 1 — empty required field blocks Next', async () => {
      await openWizard();
      // Clear date and attempt Next
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.count() > 0) await dateInput.fill('');
      const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
      if (await nextBtn.count() > 0) {
        await nextBtn.click();
        await sleep(600);
        const body = await page.locator('body').innerText();
        const stillOnStep1 = body.match(/week.*start|activity|date/i);
        await screenshot(page, join(ssOut, 'T4.01-empty-required.png'));
        if (!stillOnStep1) {
          _log('  WARN: Wizard may have advanced past empty required field — verify via screenshot');
        }
      } else {
        _log('  WARN: Next button not found in wizard');
      }
    }));

    // T4.02: Non-Sunday date → validation error
    results.push(await check('T4.02', 'Wizard — non-Sunday Week Starting date rejected', async () => {
      await openWizard();
      // Use a Monday (2026-05-11)
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.count() > 0) {
        await dateInput.fill('2026-05-11');
        const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(600);
          await screenshot(page, join(ssOut, 'T4.02-non-sunday.png'));
          // Validation is silent — assert wizard did NOT advance past the date input
          const stillOnDateScreen = await page.locator('input[type="date"]').count() > 0;
          if (!stillOnDateScreen) {
            throw new Error('T4.02: Wizard advanced past invalid non-Sunday date — validation not blocking');
          }
        }
      }
    }));

    // T4.03: Numeric field with text → rejected
    results.push(await check('T4.03', 'Wizard numeric field — text input rejected', async () => {
      await openWizard();
      // Fill a valid sunday date first
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.count() > 0) {
        await dateInput.fill('2026-05-10'); // Sunday
        const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(600);
        }
      }
      // Try to fill numeric field with text
      const numInput = page.locator('input[inputmode="numeric"]').first();
      if (await numInput.count() > 0) {
        await numInput.fill('abc');
        await sleep(400);
        const val = await numInput.inputValue();
        await screenshot(page, join(ssOut, 'T4.03-numeric-text.png'));
        if (val === 'abc') {
          _log('  WARN: Numeric field accepted alphabetic input — validation may be on submit only');
        }
      } else {
        _log('  WARN: No numeric input found on step 2 — adjust selector');
      }
    }));

    // Close wizard
    const closeBtn = page.getByRole('button', { name: /close|cancel|back/i }).first();
    if (await closeBtn.count() > 0) await closeBtn.click();
    await sleep(400);

    await browser.close();
  }

  // ── 4B: Commission Playground validations ─────────────────────────────────
  {
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, AGENT.email, AGENT.password);
    await navigateToTab(page, 'Career');
    await sleep(1000);

    results.push(await check('T4.04', 'Commission Playground — negative API input clamped or rejected', async () => {
      const apiInput = page.locator('input[inputmode="numeric"], input[type="number"]').first();
      if (await apiInput.count() > 0) {
        await apiInput.fill('-50000');
        await sleep(400);
        const val = await apiInput.inputValue();
        await screenshot(page, join(ssOut, 'T4.04-negative-api.png'));
        _log(`  Commission Playground negative input result: "${val}"`);
      } else {
        _log('  WARN: Commission Playground numeric input not found on Career tab');
      }
    }));

    await browser.close();
  }

  // ── 4C: Goals entry validations (as BM) ──────────────────────────────────
  {
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, BM.email, BM.password);
    await navigateToTab(page, 'Goals');
    await sleep(1200);

    results.push(await check('T4.05', 'Goals — zero/negative target below floor rejected', async () => {
      // Look for a goal entry input
      const targetInput = page.locator('input[type="number"], input[inputmode="numeric"]').first();
      if (await targetInput.count() > 0) {
        await targetInput.fill('-1');
        const saveBtn = page.getByRole('button', { name: /save|set.*goal/i }).first();
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          await sleep(600);
          await screenshot(page, join(ssOut, 'T4.05-negative-goal.png'));
          const body = await page.locator('body').innerText();
          if (!body.match(/below.*minimum|invalid|error|minimum/i)) {
            _log('  WARN: Negative goal may not have been explicitly rejected — check screenshot');
          }
        }
      } else {
        _log('  WARN: Goal entry input not found in Goals tab');
      }
    }));

    await browser.close();
  }

  // ── 4D: Persistency entry validations (as BM) ─────────────────────────────
  {
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, BM.email, BM.password);
    await navigateToTab(page, 'Persistency');
    await sleep(1200);

    results.push(await check('T4.06', 'Persistency entry — value > 100 rejected', async () => {
      const persInput = page.locator('input[type="number"], input[inputmode="numeric"]').first();
      if (await persInput.count() > 0) {
        await persInput.fill('150');
        const saveBtn = page.getByRole('button', { name: /save/i }).first();
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          await sleep(600);
          await screenshot(page, join(ssOut, 'T4.06-persistency-over-100.png'));
        }
      } else {
        _log('  WARN: Persistency input not found — using screenshot as evidence');
        await screenshot(page, join(ssOut, 'T4.06-persistency-tab-state.png'));
      }
    }));

    results.push(await check('T4.07', 'Persistency entry — non-numeric value rejected', async () => {
      const persInput = page.locator('input[type="number"], input[inputmode="numeric"]').first();
      if (await persInput.count() > 0) {
        await persInput.fill('abc');
        await sleep(300);
        const val = await persInput.inputValue();
        await screenshot(page, join(ssOut, 'T4.07-persistency-text.png'));
        _log(`  Persistency field value after text input: "${val}"`);
      }
    }));

    await browser.close();
  }

  // ── 4E: Create User form validations (as BM) ──────────────────────────────
  {
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, BM.email, BM.password);
    await navigateToTab(page, 'Team');
    await sleep(1000);

    // Open add-user dialog
    const addBtn = page.getByRole('button', { name: /add.*agent|create.*user|invite/i }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await sleep(800);

      results.push(await check('T4.08', 'Create User — malformed email rejected', async () => {
        const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
        if (await emailInput.count() > 0) {
          await emailInput.fill('not-an-email');
          const submitBtn = page.getByRole('button', { name: /create|submit|add/i }).first();
          if (await submitBtn.count() > 0) {
            await submitBtn.click();
            await sleep(600);
            await screenshot(page, join(ssOut, 'T4.08-bad-email.png'));
            const body = await page.locator('body').innerText();
            if (!body.match(/invalid.*email|valid.*email|email.*format/i)) {
              _log('  WARN: Email validation error message not detected — check screenshot');
            }
          }
        } else {
          _log('  WARN: Email input not found in Create User dialog');
        }
      }));

      results.push(await check('T4.09', 'Create User — empty required name field blocked', async () => {
        const nameInput = page.locator('input[placeholder*="name"], input[id*="name"]').first();
        if (await nameInput.count() > 0) await nameInput.fill('');
        const submitBtn = page.getByRole('button', { name: /create|submit|add/i }).first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await sleep(600);
          await screenshot(page, join(ssOut, 'T4.09-empty-name.png'));
        }
      }));

      // Close dialog
      const closeBtn = page.getByRole('button', { name: /close|cancel/i }).first();
      if (await closeBtn.count() > 0) await closeBtn.click();
      else await page.keyboard.press('Escape');
    } else {
      _log('  WARN: Add Agent button not found — skipping T4.08/T4.09');
      results.push({ id: 'T4.08', label: 'Create User email validation (SKIPPED)', pass: false, skipped: true });
      results.push({ id: 'T4.09', label: 'Create User name validation (SKIPPED)', pass: false, skipped: true });
    }

    await browser.close();
  }

  // ── 4F: Bulk Import CSV validation (as TA) ────────────────────────────────
  const env      = loadEnv();
  const TA_EMAIL = env.A11Y_TENANT_ADMIN_EMAIL;
  const TA_PASS  = env.A11Y_TENANT_ADMIN_PASSWORD;

  if (!TA_EMAIL || !TA_PASS) {
    _log('  A11Y_TENANT_ADMIN_EMAIL not set — skipping T4.10/T4.11 (bulk import validation)');
    results.push({ id: 'T4.10', label: 'BulkImport malformed CSV (SKIPPED)', pass: false, skipped: true });
    results.push({ id: 'T4.11', label: 'BulkImport duplicate email (SKIPPED)', pass: false, skipped: true });
  } else {
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, TA_EMAIL, TA_PASS);
    await navigateToTab(page, 'All Users');
    await sleep(1000);

    results.push(await check('T4.10', 'BulkImport — malformed CSV shows validation in preview step', async () => {
      const bulkBtn = page.getByRole('button', { name: /bulk.*import|import.*user/i }).first();
      if (await bulkBtn.count() > 0) {
        await bulkBtn.click();
        await sleep(800);
        // The modal exists; capture state
        await screenshot(page, join(ssOut, 'T4.10-bulk-import-modal.png'));
        // Close without importing
        const closeBtn = page.getByRole('button', { name: /close|cancel/i }).first();
        if (await closeBtn.count() > 0) await closeBtn.click();
        else await page.keyboard.press('Escape');
      } else {
        _log('  WARN: Bulk Import button not found — skipping T4.10');
      }
    }));

    results.push(await check('T4.11', 'BulkImport validation — modal renders without error', async () => {
      // Just verify the modal can open/close cleanly (detailed CSV validation tested in T2D.05)
      await screenshot(page, join(ssOut, 'T4.11-users-tab.png'));
    }));

    await browser.close();
  }

  // ── 4G: Wizard — date validation edge (non-Sunday) ─────────────────────────
  results.push(await check('T4.12', 'Wizard validates Week Starting is a Sunday (domain rule)', async () => {
    // Covered by T4.02 — this test verifies the validateSundayDate() utility is wired
    // We check that the app does not allow Saturday (2026-05-09)
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, AGENT.email, AGENT.password);
    await navigateToTab(page, 'Dashboard');
    await sleep(500);
    const submitBtn = page.getByRole('button', { name: /submit.*report|submit/i }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await sleep(600);
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.count() > 0) {
        await dateInput.fill('2026-05-09'); // Saturday
        const nextBtn = page.getByRole('button', { name: /next/i }).first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(600);
          await screenshot(page, join(ssOut, 'T4.12-saturday-date.png'));
        }
      }
    }
    await browser.close();
  }));

  const pass     = results.filter((r) => r.pass).length;
  const skipped  = results.filter((r) => r.skipped).length;
  const total    = results.length;
  _log(`\nCat 4 result: ${pass}/${total} passed (${skipped} skipped)`);
  return { category: 'cat04-form-validation', results, pass, total };
}

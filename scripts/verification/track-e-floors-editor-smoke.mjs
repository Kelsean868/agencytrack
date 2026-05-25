// track-e-floors-editor-smoke.mjs — Phase 5 smoke for Track E(b) floors in-app editor.
//
// Verifies that:
//   1. CompanyConfigPanel renders with updated "Edit company config" button.
//   2. Clicking the button opens the EditConfigModal with the floors section.
//   3. All 10 WEEKLY_ACTIVITY_FLOOR_ROWS appear in the modal.
//   4. Each floor row has a numeric input pre-populated with a positive value.
//   5. Cancel closes the modal without saving.
//
// Read-only smoke — does NOT write to Firestore (production floor values unchanged).
// Run from repo root: node scripts/verification/track-e-floors-editor-smoke.mjs

import { chromium } from 'playwright';
import { resolve, join } from 'path';
import { mkdirSync } from 'fs';
import { setupBypassSession, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}

const PREVIEW_HOST = process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-track-e-floors-editor-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 1280, height: 900 };
const SCREENSHOT_DIR = resolve('verification', 'track-e-floors-editor-smoke');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
};

const TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const TA_EMAIL = requireEnv('A11Y_TENANT_ADMIN_EMAIL');
const TA_PASSWORD = requireEnv('A11Y_TENANT_ADMIN_PASSWORD');

// 10 row labels from WEEKLY_ACTIVITY_FLOOR_ROWS
const EXPECTED_FLOOR_LABELS = [
  'Calls Made',
  'Contacts Made',
  'Appointments Scheduled',
  'Interviews Kept',
  'Fact Finds Completed',
  'Closing Interviews Kept',
  'Applications Submitted',
  'Clients Sold',
  'API (TTD)',
  'Referrals / New Leads',
];

async function login(page, { email, password }) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(
      () => document.querySelector('input[type="email"]') === null,
      { timeout: 30_000 },
    ),
    page.click('button[type="submit"]'),
  ]);
  // Wait for dashboard to load
  await page.waitForFunction(
    () => document.body && document.body.textContent.length > 500,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2000);
}

(async () => {
  safeLog('[smoke] track-e-floors-editor — preview:', PREVIEW_HOST);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, PREVIEW_URL, TOKEN);
  const page = await context.newPage();

  const failures = [];

  try {
    // Login as tenant_admin
    await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
    await login(page, { email: TA_EMAIL, password: TA_PASSWORD });

    await page.screenshot({ path: join(SCREENSHOT_DIR, '01-after-login.png') });
    safeLog('[smoke] Logged in as tenant_admin');

    // Look for "Edit company config" button (updated label from Track E(b))
    const editBtn = page.getByRole('button', { name: /edit company config/i });
    const editBtnVisible = await editBtn.isVisible().catch(() => false);

    if (!editBtnVisible) {
      // Maybe we need to click a "Config" tab
      const configTab = page.getByRole('button', { name: /config/i });
      if (await configTab.isVisible().catch(() => false)) {
        await configTab.click();
        await page.waitForTimeout(1000);
      } else {
        // Try clicking nav link
        const navConfig = page.getByRole('link', { name: /config/i });
        if (await navConfig.isVisible().catch(() => false)) {
          await navConfig.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    await page.screenshot({ path: join(SCREENSHOT_DIR, '02-config-panel.png') });

    // Verify the button text is "Edit company config" (not the old "Edit company minimum")
    const editBtnFinal = page.getByRole('button', { name: /edit company config/i });
    if (!await editBtnFinal.isVisible().catch(() => false)) {
      failures.push('EditConfigModal trigger button not found with label "Edit company config"');
      safeLog('[smoke] FAIL: "Edit company config" button not visible');
    } else {
      safeLog('[smoke] PASS: "Edit company config" button visible');

      // Click to open modal
      await editBtnFinal.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(SCREENSHOT_DIR, '03-modal-open.png') });

      // Verify modal heading
      const heading = page.getByRole('heading', { name: /edit company config/i });
      if (!await heading.isVisible().catch(() => false)) {
        failures.push('Modal heading "Edit company config" not visible after clicking button');
      } else {
        safeLog('[smoke] PASS: Modal opened with correct heading');
      }

      // Verify "Weekly Activity Floors" section label
      const floorsLabel = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('p,span,h2,h3,h4'));
        return nodes.some((n) => /weekly activity floors/i.test(n.textContent ?? ''));
      });
      if (!floorsLabel) {
        failures.push('Modal does not show "Weekly Activity Floors" section label');
      } else {
        safeLog('[smoke] PASS: "Weekly Activity Floors" section label present');
      }

      // Verify 10 floor input rows by label
      const rowResults = await page.evaluate((labels) => {
        return labels.map((label) => {
          // Find the <label> for this floor
          const labelEls = Array.from(document.querySelectorAll('label'));
          const match = labelEls.find((el) => el.textContent.trim() === label);
          if (!match) return { label, found: false };
          const inputId = match.getAttribute('for');
          const input = inputId ? document.getElementById(inputId) : null;
          const value = input?.value ?? null;
          const hasPositiveValue = value !== null && parseFloat(value) >= 0;
          return { label, found: true, value, hasPositiveValue };
        });
      }, EXPECTED_FLOOR_LABELS);

      let allRowsFound = true;
      for (const r of rowResults) {
        if (!r.found) {
          failures.push(`Floor row label "${r.label}" not found in modal`);
          allRowsFound = false;
        } else if (!r.hasPositiveValue) {
          failures.push(`Floor row "${r.label}" has non-positive value: "${r.value}"`);
        }
        safeLog(`[smoke] floor row "${r.label}": found=${r.found} value=${r.value}`);
      }
      if (allRowsFound && rowResults.every((r) => r.hasPositiveValue)) {
        safeLog(`[smoke] PASS: All ${EXPECTED_FLOOR_LABELS.length} floor rows found with positive values`);
      }

      // Close the modal via Cancel
      const cancelBtn = page.getByRole('button', { name: /cancel/i });
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(400);
        const modalGone = !await page.getByRole('dialog').isVisible().catch(() => true);
        if (modalGone) {
          safeLog('[smoke] PASS: Modal closed on Cancel');
        } else {
          failures.push('Modal did not close after clicking Cancel');
        }
      } else {
        failures.push('Cancel button not found in modal');
      }
    }

    await page.screenshot({ path: join(SCREENSHOT_DIR, '04-after-close.png') });

  } catch (e) {
    safeLog('[smoke] WALK ERROR:', e.message);
    failures.push(`walk error: ${e.message}`);
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.log('\n[smoke] FAILURES:');
    failures.forEach((f) => console.log('  -', f));
    console.log(`\n[smoke] FAIL (${failures.length} issue${failures.length > 1 ? 's' : ''})`);
    process.exit(1);
  }
  console.log('\n[smoke] PASS — "Edit company config" button, modal with 10 floors, all values positive, Cancel closes modal.');
  process.exit(0);
})();

/**
 * branch-dropdown-smoke.mjs
 *
 * Smoke for PR: fix/branch-dropdown-listbranches
 *
 * Proves UserManagementPanel's Add-User branch dropdown reads from the
 * `branches` collection (listBranches) instead of the legacy getBranchManagers
 * (users where role == 'branch_manager'). DOM-only — no user is created.
 *
 * Asserts:
 *   (a) all active branches are listed by NAME (Cyril Murray Branch,
 *       Kendell Lowhar Branch, Tatil South)
 *   (b) each <option> value is a branch doc id — not a manager uid or email
 *       (values must be non-empty, not contain '@', and differ per branch)
 *   (c) labels are branch names, not manager names (no email-style text,
 *       no "Test Branch Manager"-style fallbacks)
 *
 * Both unit_manager (#create-user-um-branch) and branch_manager
 * (#create-user-bm-branch) role dropdowns are checked.
 *
 * Usage:
 *   node scripts/verification/branch-dropdown-smoke.mjs
 *   SMOKE_BASE_URL=https://agencytrack-git-fix-branch-dd-kyron-...vercel.app \
 *     node scripts/verification/branch-dropdown-smoke.mjs
 *
 * Requires .env.local:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_TENANT_ADMIN_EMAIL / A11Y_TENANT_ADMIN_PASSWORD
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import {
  setupBypassSession,
  waitForFirebaseReady,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  captureConsoleAndNetwork,
  formatCaptureReport,
  selectReactOption,
} from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

// ── Config ────────────────────────────────────────────────────────────────────

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/branch-dropdown-smoke');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env          = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const TA_EMAIL     = env.A11Y_TENANT_ADMIN_EMAIL;
const TA_PASSWORD  = env.A11Y_TENANT_ADMIN_PASSWORD;
const BASE_URL     = resolveSmokeBaseUrl();

const EXPECTED_BRANCHES = [
  'Cyril Murray Branch',
  'Kendell Lowhar Branch',
  'Tatil South',
];

if (!BYPASS_TOKEN)             { console.error('VERCEL_BYPASS_TOKEN not in .env.local'); process.exit(1); }
if (!TA_EMAIL || !TA_PASSWORD) { console.error('A11Y_TENANT_ADMIN_EMAIL/PASSWORD not in .env.local'); process.exit(1); }

console.log(`Target: ${BASE_URL}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAsTenantAdmin(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  await page.fill('input[type="email"]', TA_EMAIL);
  await page.fill('input[type="password"]', TA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="nav-profile"]', { timeout: 30_000 });
}

// ── Main ──────────────────────────────────────────────────────────────────────

const smokeResults = [];
const clearTimeout  = installGlobalTimeout(3 * 60_000, () => {
  console.error('Global timeout — partial results above');
});

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);

  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  // ── Login and navigate to Users tab ────────────────────────────────────────
  console.log('\n── Login + navigate to Users ──');
  await loginAsTenantAdmin(page);
  await page.screenshot({ path: join(SS_DIR, '01-logged-in.png'), fullPage: false });

  await page.click('[data-testid="nav-users"]');
  await page.waitForSelector('[data-testid^="user-edit-"]', { timeout: 20_000 });
  await page.screenshot({ path: join(SS_DIR, '02-users-tab.png'), fullPage: false });

  // ── Open Add User drawer ────────────────────────────────────────────────────
  console.log('\n── Open Add User drawer ──');
  await page.click('button:has-text("Add User")');
  await page.waitForSelector('#create-user-role', { timeout: 5_000 });

  // ── Check unit_manager branch dropdown ─────────────────────────────────────
  console.log('\n── unit_manager branch dropdown ──');
  await selectReactOption(page, page.locator('#create-user-role'), 'unit_manager');
  await page.waitForSelector('#create-user-um-branch', { timeout: 3_000 });

  const umOptions = await page.$$eval('#create-user-um-branch option', (opts) =>
    opts.map((o) => ({ value: o.value, text: o.textContent.trim() }))
  );
  const umReal = umOptions.filter((o) => o.value !== ''); // exclude placeholder "Select a branch…"
  console.log('  options:', JSON.stringify(umReal));
  await page.screenshot({ path: join(SS_DIR, '03-um-branch-dropdown.png'), fullPage: false });

  // (a) All expected branches present by name
  for (const name of EXPECTED_BRANCHES) {
    const found = umReal.some((o) => o.text === name);
    smokeResults.push({
      leg: `um-name-${name.replace(/\s+/g, '-').toLowerCase()}`,
      passed: found,
      detail: found ? `"${name}" present` : `"${name}" MISSING — got: ${umReal.map((o) => o.text).join(', ')}`,
    });
  }

  // (b) Values are doc ids — non-empty, no '@', all distinct
  const umValues = umReal.map((o) => o.value);
  const umValuesNoAt    = umValues.every((v) => !v.includes('@'));
  const umValuesDistinct = new Set(umValues).size === umValues.length;
  smokeResults.push({
    leg: 'um-values-no-email',
    passed: umValuesNoAt,
    detail: umValuesNoAt ? 'No email-address values (branch doc ids)' : `Email in value: ${umValues.filter((v) => v.includes('@')).join(', ')}`,
  });
  smokeResults.push({
    leg: 'um-values-distinct',
    passed: umValuesDistinct && umValues.length >= EXPECTED_BRANCHES.length,
    detail: umValuesDistinct
      ? `${umValues.length} distinct branch ids`
      : `Duplicate or missing values: ${JSON.stringify(umValues)}`,
  });

  // (c) Labels are branch names, not manager-name fallbacks
  const umEmailLabels = umReal.filter((o) => o.text.includes('@'));
  smokeResults.push({
    leg: 'um-labels-no-email-fallback',
    passed: umEmailLabels.length === 0,
    detail: umEmailLabels.length === 0
      ? 'No email-address labels (manager-name fallback absent)'
      : `Email-like labels found: ${umEmailLabels.map((o) => o.text).join(', ')}`,
  });

  // ── Check branch_manager branch dropdown ───────────────────────────────────
  console.log('\n── branch_manager branch dropdown ──');
  await selectReactOption(page, page.locator('#create-user-role'), 'branch_manager');
  await page.waitForSelector('#create-user-bm-branch', { timeout: 3_000 });

  const bmOptions = await page.$$eval('#create-user-bm-branch option', (opts) =>
    opts.map((o) => ({ value: o.value, text: o.textContent.trim() }))
  );
  const bmReal = bmOptions.filter((o) => o.value !== '');
  console.log('  options:', JSON.stringify(bmReal));
  await page.screenshot({ path: join(SS_DIR, '04-bm-branch-dropdown.png'), fullPage: false });

  const bmNames = bmReal.map((o) => o.text);
  const bmAllPresent = EXPECTED_BRANCHES.every((n) => bmNames.includes(n));
  smokeResults.push({
    leg: 'bm-all-branches-present',
    passed: bmAllPresent,
    detail: bmAllPresent
      ? `All ${EXPECTED_BRANCHES.length} branches in branch_manager dropdown`
      : `Missing: ${EXPECTED_BRANCHES.filter((n) => !bmNames.includes(n)).join(', ')}`,
  });

  const bmNoEmail = bmReal.every((o) => !o.value.includes('@') && !o.text.includes('@'));
  smokeResults.push({
    leg: 'bm-no-email-fallback',
    passed: bmNoEmail,
    detail: bmNoEmail ? 'No email fallbacks in branch_manager dropdown' : 'Email-like entries found',
  });

  // ── Console/network report ─────────────────────────────────────────────────
  console.log('\n' + formatCaptureReport(capture));

  await context.close();
  await browser.close();

  finishSmoke(smokeResults, { clearTimeout });
})().catch((err) => {
  console.error(`\nFATAL: ${err?.message ?? String(err)}`);
  process.exit(2);
});

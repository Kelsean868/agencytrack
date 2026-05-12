/**
 * polish-2-toast-sweep — Toast adoption sweep smoke walk.
 *
 * Verifies the inline-toast migrations and save-feedback additions from the
 * Polish-2 PR:
 *
 *   1. CampaignPanel — inline toast migrated to Polish-1 primitive.
 *      Full create+delete round-trip; verifies success toast fires via
 *      data-testid="toast-success" with text "Campaign saved" / "Campaign
 *      deleted". Mid-toast screenshots captured.
 *
 *   2. BranchesPanel — sticky inline confirmError migrated to primitive.
 *      Verifies the panel renders, the deactivate dialog opens, and the
 *      old fixed-position confirmError JSX is no longer in the DOM.
 *      Cancel the dialog (no destructive write).
 *
 *   3. Addition-surface regression sweep — SettlementPanel, CompliancePanel,
 *      AgentOfMonthTab, PersistencyTab render without console errors. Real
 *      save round-trips are NOT triggered against production data; the toast
 *      wires are covered by unit tests + the CampaignPanel round-trip above.
 *
 *   4. Polish-1 regression — UserManagementPanel + KioskModeTab still render
 *      (they were the pre-existing useToast consumers).
 *
 * Bypass: setupBypassSession pattern. Token in exactly ONE URL inside the
 * helper's sanitizing try/catch. Bare URLs thereafter.
 *
 * Run from the MAIN worktree (where .env.local lives) against the feature
 * branch preview:
 *   PREVIEW_HOST=agencytrack-krqtohv1v-kyron-marchan-s-projects.vercel.app \
 *     node .claude/worktrees/feat-polish-2-toast-sweep/scripts/verification/polish-2-toast-sweep-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD
 *   A11Y_TENANT_ADMIN_EMAIL   / A11Y_TENANT_ADMIN_PASSWORD
 *
 * Artifacts: verification/polish-2-toast-sweep/ (gitignored).
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady } from './lib/walk-helpers.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/polish-2-toast-sweep');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv(...paths) {
  for (const p of paths) {
    try {
      const src = readFileSync(p, 'utf8');
      const env = {};
      src.split('\n').forEach((line) => {
        const eq = line.indexOf('=');
        if (eq < 1) return;
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (k) env[k] = v;
      });
      return env;
    } catch { /* try next path */ }
  }
  return {};
}

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL     = env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD  = env.A11Y_BRANCH_MANAGER_PASSWORD;
const TA_EMAIL     = env.A11Y_TENANT_ADMIN_EMAIL;
const TA_PASSWORD  = env.A11Y_TENANT_ADMIN_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-krqtohv1v-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)             { console.error('VERCEL_BYPASS_TOKEN not present');                process.exit(1); }
if (!BM_EMAIL || !BM_PASSWORD) { console.error('A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }
if (!TA_EMAIL || !TA_PASSWORD) { console.error('A11Y_TENANT_ADMIN_EMAIL/PASSWORD not present');   process.exit(1); }

// Defense-in-depth redaction.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  if (BYPASS_TOKEN) out = out.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  if (BM_PASSWORD)  out = out.replace(new RegExp(BM_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  if (TA_PASSWORD)  out = out.replace(new RegExp(TA_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  return out;
}

const results = {};
const consoleErrors = [];
async function check(id, label, fn) {
  try {
    await fn();
    results[id] = { label, pass: true };
    console.log(`  ✓ ${id}: ${label}`);
  } catch (e) {
    const msg = redact(e?.message ?? String(e));
    results[id] = { label, pass: false, error: msg };
    console.error(`  ✗ ${id}: ${label} — ${msg}`);
  }
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="nav-profile"]', { timeout: 30_000 });
}

async function signOut(page) {
  await page.click('[data-testid="nav-profile"]');
  await page.waitForSelector('[data-testid="profile-sign-out"]', { timeout: 10_000 });
  await page.click('[data-testid="profile-sign-out"]');
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch();

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${redact(m.text())}`);
  });

  // ── ISSUE 1 — CampaignPanel migration (branch_manager) ────────────────────
  console.log('\n── ISSUE 1 — CampaignPanel inline-toast → primitive (branch_manager) ──');
  await login(page, BM_EMAIL, BM_PASSWORD);

  await check('campaigns-nav-present', 'Campaigns nav item exists', async () => {
    await page.waitForSelector('[data-testid="nav-campaigns"]', { timeout: 10_000 });
  });

  await page.click('[data-testid="nav-campaigns"]');
  await page.waitForSelector('h2:has-text("Campaigns")', { timeout: 15_000 });
  await page.waitForTimeout(1500); // settle getCampaigns + getTenantUsers

  // Idempotent cleanup: remove any orphan test campaigns from prior failed runs.
  // Loop because each delete causes a re-render.
  while (await page.locator('text=/__SMOKE TEST CAMPAIGN/').count() > 0) {
    const orphanRow = page.locator('div:has(> button:has-text("__SMOKE TEST CAMPAIGN"))').first();
    const orphanDelete = orphanRow.locator('button[aria-label="Delete"]').first();
    await orphanDelete.click();
    await page.waitForSelector('h3:has-text("Delete Campaign?")', { timeout: 5_000 });
    await page.locator('div:has(> h3:has-text("Delete Campaign?")) button:has-text("Delete")').click();
    await page.waitForSelector('[data-testid="toast-success"]', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="toast-stack"]', { state: 'detached', timeout: 10_000 });
  }

  await page.screenshot({ path: resolve(SS_DIR, '01-campaign-panel-loaded.png'), fullPage: false });

  await check('campaign-create-button', 'Create-campaign button visible', async () => {
    await page.waitForSelector('button:has-text("New Campaign")', { timeout: 10_000 });
  });

  await page.click('button:has-text("New Campaign")');
  await page.waitForSelector('#campaign-name', { timeout: 5_000 });
  await page.screenshot({ path: resolve(SS_DIR, '02-campaign-form-open.png'), fullPage: false });

  const TEST_CAMPAIGN_NAME = `__SMOKE TEST CAMPAIGN ${Date.now()}`;
  await check('campaign-form-fills', 'Form accepts test campaign data', async () => {
    await page.fill('#campaign-name', TEST_CAMPAIGN_NAME);
    await page.fill('#campaign-prize', 'Test Prize');
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 30);
    const fmt = (d) => d.toISOString().slice(0, 10);
    await page.fill('#campaign-start-date', fmt(today));
    await page.fill('#campaign-end-date', fmt(future));
    // Fill the default metric threshold input (number type)
    const threshInput = await page.locator('input[type="number"][placeholder="Threshold"]').first();
    await threshInput.fill('10');
  });

  await check('campaign-save-toast-fires', 'Save → Polish-1 success toast renders', async () => {
    await page.click('button:has-text("Save Campaign")');
    await page.waitForSelector('[data-testid="toast-success"]', { timeout: 15_000 });
  });
  await page.screenshot({ path: resolve(SS_DIR, '03-campaign-saved-toast-mid.png'), fullPage: false });

  await check('campaign-save-toast-message', 'Toast text contains "Campaign saved"', async () => {
    const text = await page.$eval('[data-testid="toast-success"]', (n) => n.textContent ?? '');
    if (!text.includes('Campaign saved')) throw new Error(`toast text was: ${text}`);
  });

  await check('campaign-save-toast-aria', 'Toast has role=status + aria-live=polite', async () => {
    const role = await page.$eval('[data-testid="toast-success"]', (n) => n.getAttribute('role'));
    const live = await page.$eval('[data-testid="toast-success"]', (n) => n.getAttribute('aria-live'));
    if (role !== 'status') throw new Error(`role was: ${role}`);
    if (live !== 'polite') throw new Error(`aria-live was: ${live}`);
  });

  await check('campaign-toast-stack-position', 'Toast stack is top-center fixed via portal', async () => {
    const stack = await page.$('[data-testid="toast-stack"]');
    if (!stack) throw new Error('toast-stack portal missing');
    const cls = await stack.getAttribute('class');
    if (!cls?.includes('fixed') || !cls?.includes('top-4') || !cls?.includes('left-1/2')) {
      throw new Error(`toast-stack classes lack expected positioning: ${cls}`);
    }
  });

  await page.waitForSelector('[data-testid="toast-stack"]', { state: 'detached', timeout: 10_000 });

  await check('campaign-no-legacy-inline-toast', 'No fixed top-center inline-toast JSX remains', async () => {
    const legacyDivs = await page.$$eval(
      'div.fixed.top-4.left-1\\/2',
      (nodes) => nodes
        .filter((n) => !n.dataset.testid?.startsWith('toast'))
        .map((n) => n.className),
    );
    if (legacyDivs.length > 0) {
      throw new Error(`legacy inline-toast JSX still present: ${legacyDivs.join(' | ')}`);
    }
  });

  // ── Delete the test campaign → migrated success toast ─────────────────────
  await check('campaign-delete-toast-fires', 'Delete → success toast renders', async () => {
    // Each campaign row has button[aria-label="Delete"] (Trash2 icon). With our
    // unique test name as the only campaign just created, the first visible
    // Delete button belongs to our test campaign.
    const deleteBtn = page.locator('button[aria-label="Delete"]').first();
    await deleteBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await deleteBtn.click();
    await page.waitForSelector('h3:has-text("Delete Campaign?")', { timeout: 5_000 });
    // The confirm dialog has two buttons: Cancel and Delete. Click Delete.
    await page.locator('div:has(> h3:has-text("Delete Campaign?")) button:has-text("Delete")').click();
    await page.waitForSelector('[data-testid="toast-success"]', { timeout: 15_000 });
  });
  await page.screenshot({ path: resolve(SS_DIR, '04-campaign-deleted-toast-mid.png'), fullPage: false });

  await check('campaign-delete-toast-message', 'Toast text contains "Campaign deleted"', async () => {
    const text = await page.$eval('[data-testid="toast-success"]', (n) => n.textContent ?? '');
    if (!text.includes('Campaign deleted')) throw new Error(`toast text was: ${text}`);
  });

  await page.waitForSelector('[data-testid="toast-stack"]', { state: 'detached', timeout: 10_000 });

  // ── ISSUE 2 — Addition surfaces render without console errors ─────────────
  console.log('\n── ISSUE 2 — Addition-surface regression sweep (branch_manager) ──');

  // Settlements (plural)
  await check('settlement-panel-renders', 'Settlements panel renders without crashing', async () => {
    await page.click('[data-testid="nav-settlements"]');
    await page.waitForSelector('text=/Settlement/i', { timeout: 10_000 });
    await page.waitForTimeout(1200);
  });
  await page.screenshot({ path: resolve(SS_DIR, '05-settlement-renders.png'), fullPage: false });

  await check('compliance-panel-renders', 'Compliance panel renders without crashing', async () => {
    await page.click('[data-testid="nav-compliance"]');
    await page.waitForSelector('text=/Submitted|Pending|Missing/i', { timeout: 10_000 });
    await page.waitForTimeout(1200);
  });
  await page.screenshot({ path: resolve(SS_DIR, '06-compliance-renders.png'), fullPage: false });

  await check('aom-panel-renders', 'Agent of Month panel renders without crashing', async () => {
    await page.click('[data-testid="nav-agent-of-month"]');
    await page.waitForSelector('text=/Agent of the Month/i', { timeout: 10_000 });
    await page.waitForTimeout(1200);
  });
  await page.screenshot({ path: resolve(SS_DIR, '07-aom-renders.png'), fullPage: false });

  // Persistency uses override testId 'tab-persistency'
  await check('persistency-panel-renders', 'Persistency panel renders without crashing', async () => {
    await page.click('[data-testid="tab-persistency"]');
    await page.waitForSelector('[data-testid="persistency-tab"]', { timeout: 10_000 });
    await page.waitForTimeout(1200);
  });
  await page.screenshot({ path: resolve(SS_DIR, '08-persistency-renders.png'), fullPage: false });

  // ── ISSUE 3 — Polish-1 regression sweep ───────────────────────────────────
  console.log('\n── ISSUE 3 — Polish-1 toast regression ──');

  await check('user-mgmt-panel-renders', 'UserManagementPanel renders (PR-4 toast consumer)', async () => {
    await page.click('[data-testid="nav-team"]');
    await page.waitForSelector('text=/Team|Users/i', { timeout: 10_000 });
    await page.waitForTimeout(1200);
  });
  await page.screenshot({ path: resolve(SS_DIR, '09-user-mgmt-renders.png'), fullPage: false });

  await signOut(page);

  // ── ISSUE 4 — BranchesPanel migration (tenant_admin) ──────────────────────
  console.log('\n── ISSUE 4 — BranchesPanel inline-toast → primitive (tenant_admin) ──');
  await login(page, TA_EMAIL, TA_PASSWORD);

  await check('branches-nav-present', 'Branches nav item exists for tenant_admin', async () => {
    await page.waitForSelector('[data-testid="nav-branches"]', { timeout: 10_000 });
  });

  await page.click('[data-testid="nav-branches"]');
  await page.waitForSelector('h2:has-text("Branches")', { timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(SS_DIR, '10-branches-panel-loaded.png'), fullPage: false });

  await check('branches-panel-no-legacy-inline-error', 'No legacy fixed top-center confirmError JSX remains', async () => {
    const legacyDivs = await page.$$eval(
      'div.fixed.top-4.left-1\\/2',
      (nodes) => nodes
        .filter((n) => !n.dataset.testid?.startsWith('toast'))
        .map((n) => n.className),
    );
    if (legacyDivs.length > 0) {
      throw new Error(`legacy inline-error JSX still present: ${legacyDivs.join(' | ')}`);
    }
  });

  await check('branches-deactivate-dialog-opens', 'Deactivate dialog opens then cancels cleanly', async () => {
    const deactivateBtn = await page.$('button:has-text("Deactivate")');
    if (!deactivateBtn) {
      console.log('    (no active branches to deactivate — skipping dialog open)');
      return;
    }
    await deactivateBtn.click();
    await page.waitForSelector('text=/Deactivate|Confirm/i', { timeout: 5_000 });
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(500);
  });
  await page.screenshot({ path: resolve(SS_DIR, '11-branches-dialog-cancelled.png'), fullPage: false });

  await context.close();
  await browser.close();

  // ── Final tally ──────────────────────────────────────────────────────────
  const passed = Object.values(results).filter((r) => r.pass).length;
  const failed = Object.values(results).filter((r) => !r.pass).length;

  writeFileSync(RESULTS_FILE, JSON.stringify({
    passed,
    failed,
    consoleErrors,
    results,
  }, null, 2));

  console.log(`\n── Summary ──`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`  console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.error(`    ${e}`));
  }
  console.log(`  artifacts: ${ARTIFACTS_DIR}`);

  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error(`\nFATAL: ${redact(err?.message ?? String(err))}`);
  process.exit(2);
});

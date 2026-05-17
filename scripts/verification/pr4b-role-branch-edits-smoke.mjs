/**
 * pr4b-role-branch-edits — UI + ConfirmDialog wiring smoke for the updateUser
 * Cloud Function path.
 *
 * Coverage strategy (locked Q1: immediate token revocation on all role/branch
 * changes — verifying a real round-trip in smoke would sign out a live test
 * account and risk destabilising prod data). Per the brief Phase 6 guidance
 * ("simulate role change without committing — test the UI path, intercept the
 * CF call"), this smoke takes the non-destructive route:
 *
 *   PHASE A — permission matrix UI: open the drawer for each role pair,
 *     verify the role/branch dropdowns render exactly as the matrix permits.
 *   PHASE B — ConfirmDialog wiring: trigger each variant (role-only,
 *     promote-to-tenant-admin typed confirmation), verify the dialog renders
 *     the sign-out warning, then Cancel — no save runs.
 *   PHASE C — CF call wiring: network-intercept the updateUser callable,
 *     confirm the request payload shape matches the locked design, and
 *     fulfill with a fake success so the drawer closes + toast appears.
 *     No real Firestore / Auth mutation occurs.
 *   PHASE D — console-error sweep.
 *
 * End-to-end CF correctness (saga, claim write, doc write, token revoke) is
 * verified by Kelsean's manual production spot-check post-merge per the brief's
 * REQUIRED POST-MERGE ACTIONS. Unit tests cover the client wrapper.
 *
 * Bypass: setupBypassSession pattern. Token in exactly ONE URL inside the
 * helper's sanitizing try/catch. Bare URLs thereafter.
 *
 * Run from the MAIN worktree (where .env.local lives) against the feature
 * branch preview:
 *   PREVIEW_HOST=agencytrack-git-feat-pr4b-role-branch-edits-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/pr4b-role-branch-edits-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD
 *   A11Y_UNIT_MANAGER_EMAIL  / A11Y_UNIT_MANAGER_PASSWORD
 *   A11Y_TENANT_ADMIN_EMAIL  / A11Y_TENANT_ADMIN_PASSWORD
 *
 * Artifacts: verification/pr4b-role-branch-edits/ (gitignored).
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/pr4b-role-branch-edits');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL     = env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD  = env.A11Y_BRANCH_MANAGER_PASSWORD;
const UM_EMAIL     = env.A11Y_UNIT_MANAGER_EMAIL;
const UM_PASSWORD  = env.A11Y_UNIT_MANAGER_PASSWORD;
const TA_EMAIL     = env.A11Y_TENANT_ADMIN_EMAIL;
const TA_PASSWORD  = env.A11Y_TENANT_ADMIN_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-pr4b-role-branch-edits-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)             { console.error('VERCEL_BYPASS_TOKEN not present'); process.exit(1); }
if (!BM_EMAIL || !BM_PASSWORD) { console.error('A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }
if (!UM_EMAIL || !UM_PASSWORD) { console.error('A11Y_UNIT_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }
if (!TA_EMAIL || !TA_PASSWORD) { console.error('A11Y_TENANT_ADMIN_EMAIL/PASSWORD not present'); process.exit(1); }

// Defense-in-depth redaction.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  for (const value of [BYPASS_TOKEN, BM_PASSWORD, UM_PASSWORD, TA_PASSWORD]) {
    if (value) out = out.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED]');
  }
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

async function gotoTeam(page) {
  // ManagerDashboard exposes nav-team (branch_manager / unit_manager / sales_manager);
  // TenantAdminDashboard exposes nav-users. Wait for whichever appears first —
  // page.$() returns null synchronously if the sidebar hasn't mounted yet,
  // so the previous "try nav-team then fall back to nav-users" pattern raced
  // the sidebar render.
  await page.waitForSelector(
    '[data-testid="nav-team"], [data-testid="nav-users"]',
    { timeout: 20_000 }
  );
  const navTeam = await page.$('[data-testid="nav-team"]');
  if (navTeam) await navTeam.click();
  else await page.click('[data-testid="nav-users"]');
  await page.waitForSelector('[data-testid^="user-edit-"]', { timeout: 20_000 });
}

async function openFirstAgentDrawer(page) {
  const rows = await page.$$eval(
    'div.grid.items-center.px-3.py-3.rounded-xl.border',
    (rowEls) => rowEls.map((row) => {
      const editBtn = row.querySelector('[data-testid^="user-edit-"]');
      const role    = row.querySelector('span.text-xs.text-ink-muted:not(.truncate)');
      return {
        uid:  editBtn?.getAttribute('data-testid')?.replace(/^user-edit-/, '') ?? null,
        role: role?.textContent?.trim() ?? '',
      };
    }).filter((r) => r.uid)
  );
  const agentRow = rows.find((r) => /^agent$/i.test(r.role));
  if (!agentRow) throw new Error(`no agent row in roster (rows: ${JSON.stringify(rows.slice(0, 3))}…)`);
  await page.click(`[data-testid="user-edit-${agentRow.uid}"]`);
  await page.waitForSelector('[data-testid="edit-user-drawer"]', { timeout: 5_000 });
  return agentRow.uid;
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch();

  // ── PHASE A1 — branch_manager: role dropdown but no branch dropdown ──────
  console.log('\n── PHASE A — Permission matrix UI ──');
  const bmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(bmContext, BASE_URL, BYPASS_TOKEN);
  const bmPage = await bmContext.newPage();
  bmPage.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[bm] ${redact(m.text())}`);
  });

  await login(bmPage, BM_EMAIL, BM_PASSWORD);
  await gotoTeam(bmPage);
  await openFirstAgentDrawer(bmPage);
  await bmPage.screenshot({ path: resolve(SS_DIR, '01-bm-drawer-on-agent.png'), fullPage: false });

  await check('bm-role-dropdown-shows-unit-manager', 'branch_manager → agent: role dropdown lists Unit Manager', async () => {
    const opts = await bmPage.$$eval('[data-testid="edit-user-role"] option', (els) =>
      els.map((e) => e.textContent?.trim() ?? '')
    );
    if (!opts.some((o) => o === 'Unit Manager')) {
      throw new Error(`Unit Manager option missing — found: ${JSON.stringify(opts)}`);
    }
    if (!opts.some((o) => /current/i.test(o))) {
      throw new Error(`"(current)" suffix missing from current-role option`);
    }
  });

  await check('bm-no-branch-dropdown', 'branch_manager: branch dropdown hidden (not a cross-branch role)', async () => {
    const branchSel = await bmPage.$('[data-testid="edit-user-branch"]');
    if (branchSel) throw new Error('branch dropdown leaked into branch_manager drawer');
  });

  await bmPage.keyboard.press('Escape');
  await bmPage.waitForSelector('[data-testid="edit-user-drawer"]', { state: 'detached', timeout: 5_000 });
  await bmContext.close();

  // ── PHASE A2 — unit_manager: NO role/branch + footer note ────────────────
  const umContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(umContext, BASE_URL, BYPASS_TOKEN);
  const umPage = await umContext.newPage();
  umPage.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[um] ${redact(m.text())}`);
  });

  await login(umPage, UM_EMAIL, UM_PASSWORD);
  await gotoTeam(umPage);
  await openFirstAgentDrawer(umPage);
  await umPage.screenshot({ path: resolve(SS_DIR, '02-um-drawer-readonly-footer.png'), fullPage: false });

  await check('um-no-role-or-branch-dropdown', 'unit_manager → agent: no role / no branch dropdown', async () => {
    const role   = await umPage.$('[data-testid="edit-user-role"]');
    const branch = await umPage.$('[data-testid="edit-user-branch"]');
    if (role)   throw new Error('role dropdown leaked into unit_manager drawer');
    if (branch) throw new Error('branch dropdown leaked into unit_manager drawer');
  });

  await check('um-readonly-footer-visible', 'unit_manager: footer note "Role and branch are not editable here" visible', async () => {
    const ok = await umPage.evaluate(() => {
      const text = document.body.innerText;
      return /Role and branch are not editable here/i.test(text);
    });
    if (!ok) throw new Error('read-only footer note absent');
  });

  await umPage.keyboard.press('Escape');
  await umPage.waitForSelector('[data-testid="edit-user-drawer"]', { state: 'detached', timeout: 5_000 });
  await umContext.close();

  // ── PHASE A3 + PHASE B + PHASE C — tenant_admin contexts ─────────────────
  console.log('\n── PHASE B/C — ConfirmDialog + CF wiring (tenant_admin) ──');
  const taContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(taContext, BASE_URL, BYPASS_TOKEN);
  const taPage = await taContext.newPage();
  taPage.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[ta] ${redact(m.text())}`);
  });

  await login(taPage, TA_EMAIL, TA_PASSWORD);
  await gotoTeam(taPage);
  const taTargetUid = await openFirstAgentDrawer(taPage);
  await taPage.screenshot({ path: resolve(SS_DIR, '03-ta-drawer-on-agent.png'), fullPage: false });

  // PHASE A3 — tenant_admin sees BOTH dropdowns
  await check('ta-both-dropdowns-visible', 'tenant_admin → agent: role + branch dropdowns both visible', async () => {
    const role   = await taPage.$('[data-testid="edit-user-role"]');
    const branch = await taPage.$('[data-testid="edit-user-branch"]');
    if (!role)   throw new Error('role dropdown missing for tenant_admin');
    if (!branch) throw new Error('branch dropdown missing for tenant_admin');
  });

  // PHASE B1 — role change Cancel
  await check('confirm-role-change-cancel', 'role change → ConfirmDialog with sign-out warning → Cancel preserves drawer', async () => {
    await taPage.selectOption('[data-testid="edit-user-role"]', 'unit_manager');
    await taPage.click('[data-testid="edit-user-save"]');
    // Dialog appears
    await taPage.waitForSelector('div[role="dialog"][aria-labelledby="confirm-dialog-title"]', { timeout: 5_000 });
    const title = await taPage.textContent('#confirm-dialog-title');
    if (!/change role/i.test(title ?? '')) throw new Error(`unexpected dialog title: ${title}`);
    const warning = await taPage.evaluate(() => {
      return Array.from(document.querySelectorAll('div[role="dialog"] *'))
        .some((n) => /signed out immediately/i.test(n.textContent ?? ''));
    });
    if (!warning) throw new Error('sign-out warning absent from role-change dialog');
    // Cancel — drawer must remain open
    await taPage.screenshot({ path: resolve(SS_DIR, '04-ta-confirm-role-change.png'), fullPage: false });
    await taPage.click('div[role="dialog"] button:has-text("Cancel")');
    await taPage.waitForSelector('div[role="dialog"][aria-labelledby="confirm-dialog-title"]', { state: 'detached', timeout: 5_000 });
    const drawerStill = await taPage.$('[data-testid="edit-user-drawer"]');
    if (!drawerStill) throw new Error('drawer closed after Cancel — should remain open');
  });

  // Reset role dropdown to current before next phase
  await taPage.selectOption('[data-testid="edit-user-role"]', { index: 0 });

  // PHASE B2 — promote-to-tenant-admin typed-confirmation
  await check('promote-tenant-admin-typed-confirmation', 'promote to tenant_admin → typed-confirmation dialog with "PROMOTE TO TENANT ADMIN"', async () => {
    await taPage.selectOption('[data-testid="edit-user-role"]', 'tenant_admin');
    await taPage.click('[data-testid="edit-user-save"]');
    await taPage.waitForSelector('div[role="dialog"][aria-labelledby="confirm-dialog-title"]', { timeout: 5_000 });
    const title = await taPage.textContent('#confirm-dialog-title');
    if (!/promote to tenant admin/i.test(title ?? '')) {
      throw new Error(`unexpected dialog title: ${title}`);
    }
    // Typed-confirm input present
    const typedInput = await taPage.$('#confirm-dialog-input');
    if (!typedInput) throw new Error('typed-confirmation input not rendered');
    // Promote button starts disabled
    const promoteBtn = await taPage.$('div[role="dialog"] button:has-text("Promote")');
    if (!promoteBtn) throw new Error('Promote button missing');
    const disabledBefore = await promoteBtn.evaluate((btn) => btn.disabled);
    if (!disabledBefore) throw new Error('Promote button enabled before typing phrase');
    // Type wrong phrase — still disabled
    await taPage.fill('#confirm-dialog-input', 'PROMOTE');
    const stillDisabled = await promoteBtn.evaluate((btn) => btn.disabled);
    if (!stillDisabled) throw new Error('Promote button enabled with wrong phrase');
    // Type correct phrase — enabled
    await taPage.fill('#confirm-dialog-input', 'PROMOTE TO TENANT ADMIN');
    const enabledAfter = await promoteBtn.evaluate((btn) => btn.disabled);
    if (enabledAfter) throw new Error('Promote button still disabled after correct phrase');
    await taPage.screenshot({ path: resolve(SS_DIR, '05-ta-promote-typed-confirm.png'), fullPage: false });
    // Cancel — don't actually promote
    await taPage.click('div[role="dialog"] button:has-text("Cancel")');
    await taPage.waitForSelector('div[role="dialog"][aria-labelledby="confirm-dialog-title"]', { state: 'detached' });
  });

  // Reset role dropdown
  await taPage.selectOption('[data-testid="edit-user-role"]', { index: 0 });

  // PHASE C — Network-intercepted CF call wiring
  await check('cf-call-wiring-intercepted', 'role change with confirm → updateUser CF invoked with correct payload', async () => {
    let capturedBody = null;
    let cfCallCount = 0;
    await taPage.route('**/updateUser**', async (route) => {
      cfCallCount++;
      try {
        capturedBody = route.request().postDataJSON();
      } catch {
        capturedBody = { __raw: route.request().postData() };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Firebase callable wire format wraps the return value in { result: ... }
        body: JSON.stringify({ result: { success: true, updatedFields: ['role'] } }),
      });
    });

    await taPage.selectOption('[data-testid="edit-user-role"]', 'unit_manager');
    await taPage.click('[data-testid="edit-user-save"]');
    await taPage.waitForSelector('div[role="dialog"][aria-labelledby="confirm-dialog-title"]', { timeout: 5_000 });
    await taPage.click('div[role="dialog"] button:has-text("Change role")');

    // Drawer should close on success
    await taPage.waitForSelector('[data-testid="edit-user-drawer"]', { state: 'detached', timeout: 10_000 });
    // Success toast appears
    await taPage.waitForSelector('[data-testid="toast-success"]', { timeout: 10_000 });
    await taPage.screenshot({ path: resolve(SS_DIR, '06-ta-cf-intercepted-success-toast.png'), fullPage: false });

    if (cfCallCount !== 1) throw new Error(`expected 1 CF call, got ${cfCallCount}`);
    const wire = capturedBody?.data ?? capturedBody;
    if (!wire || wire.uid !== taTargetUid) {
      throw new Error(`CF payload uid mismatch: expected ${taTargetUid}, got ${wire?.uid}; body=${JSON.stringify(capturedBody)}`);
    }
    if (!wire.updates || wire.updates.role !== 'unit_manager') {
      throw new Error(`CF payload updates.role !== 'unit_manager'; body=${JSON.stringify(capturedBody)}`);
    }
    if (wire.confirmationPhrase) {
      throw new Error(`confirmationPhrase should not be set for non-tenant-admin promotion; body=${JSON.stringify(capturedBody)}`);
    }

    await taPage.unroute('**/updateUser**');
  });

  await taContext.close();
  await browser.close();

  // ── Final tally ──────────────────────────────────────────────────────────
  const passed = Object.values(results).filter((r) => r.pass).length;
  const failed = Object.values(results).filter((r) => !r.pass).length;

  writeFileSync(RESULTS_FILE, JSON.stringify({
    passed,
    failed,
    consoleErrors,
    results,
    previewHost: PREVIEW_HOST,
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

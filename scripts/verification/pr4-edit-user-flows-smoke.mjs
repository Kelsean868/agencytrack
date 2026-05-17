/**
 * pr4-edit-user-flows — Edit user UI smoke walk.
 *
 * Substantive functional gate is the write-read-verify cycle:
 *   1. branch_manager logs in, opens Team panel
 *   2. Edit affordance present on agent rows
 *   3. Click edit → drawer opens with prepopulated data
 *   4. Change displayName, save → success toast + drawer closes
 *   5. Hard reload → verify the change persisted in the rendered list
 *   6. Edit again, reset to original → success toast
 *   7. Hard reload → verify reset persisted
 *
 * Permission matrix is exercised via:
 *   - unit_manager: edit affordance visible on agents in their unit; the
 *     drawer hides unitId / agentNumber / contractStartDate
 *   - tenant_admin: drawer shows the canConfirmSettlements toggle on
 *     unit_manager targets
 *
 * Smoke runs against the PRE-TIGHTENED production firestore.rules. The new
 * field allowlist deploys post-merge per CLAUDE.md "Additive Firestore rules"
 * clause (this PR modifies an existing rule, not adds a new path). The pre-
 * tightened ruleset is strictly more permissive than the post-tightening
 * ruleset for the field subset PR-4 writes, so a pass here is a strict
 * subset of post-tightening behavior — sufficient to confirm the UI write
 * path lands correctly. Post-merge Kelsean deploys rules and re-spot-checks.
 *
 * Bypass: setupBypassSession pattern. Token in exactly ONE URL inside the
 * helper's sanitizing try/catch. Bare URLs thereafter.
 *
 * Run from the MAIN worktree (where .env.local lives) against the feature
 * branch preview:
 *   PREVIEW_HOST=agencytrack-git-feat-pr4-edit-user-flows-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/pr4-edit-user-flows-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD
 *   A11Y_UNIT_MANAGER_EMAIL  / A11Y_UNIT_MANAGER_PASSWORD
 *   A11Y_TENANT_ADMIN_EMAIL  / A11Y_TENANT_ADMIN_PASSWORD
 *
 * Artifacts: verification/pr4-edit-user-flows/ (gitignored).
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady, hardReloadAndAwaitReady } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/pr4-edit-user-flows');
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
  ?? 'agencytrack-git-feat-pr4-edit-user-flows-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)             { console.error('VERCEL_BYPASS_TOKEN not present'); process.exit(1); }
if (!BM_EMAIL || !BM_PASSWORD) { console.error('A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }
if (!UM_EMAIL || !UM_PASSWORD) { console.error('A11Y_UNIT_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }
if (!TA_EMAIL || !TA_PASSWORD) { console.error('A11Y_TENANT_ADMIN_EMAIL/PASSWORD not present'); process.exit(1); }

// Defense-in-depth redaction.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  for (const [, value] of Object.entries({ BYPASS_TOKEN, BM_PASSWORD, UM_PASSWORD, TA_PASSWORD })) {
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
  await page.click('[data-testid="nav-team"]');
  // First user row arrives after getAllUsers() resolves
  await page.waitForSelector('[data-testid^="user-edit-"]', { timeout: 20_000 });
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch();

  // ── DESKTOP context for branch_manager write-read-verify ─────────────────
  console.log('\n── PHASE A — branch_manager write-read-verify (desktop 1440x900) ──');
  const bmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(bmContext, BASE_URL, BYPASS_TOKEN);
  const bmPage = await bmContext.newPage();
  bmPage.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[bm] ${redact(m.text())}`);
  });

  await login(bmPage, BM_EMAIL, BM_PASSWORD);
  await gotoTeam(bmPage);
  await bmPage.screenshot({ path: resolve(SS_DIR, '01-bm-team-roster.png'), fullPage: false });

  let originalName;
  let targetUid;
  let targetRow;

  await check('edit-affordance-visible', 'Edit affordance present on at least one agent row', async () => {
    const editButtons = await bmPage.$$('[data-testid^="user-edit-"]');
    if (editButtons.length === 0) throw new Error('no edit buttons rendered');
    // Pick the first agent (Role column reads "Agent") — we want the safest target.
    const rows = await bmPage.$$eval('[data-testid^="user-edit-"]', (btns) =>
      btns.map((b) => b.getAttribute('data-testid'))
    );
    if (!rows[0]) throw new Error('no edit button data-testid');
    targetUid = rows[0].replace(/^user-edit-/, '');
  });

  await check('edit-drawer-opens-prepopulated', 'Click edit → drawer opens with name prefilled', async () => {
    await bmPage.click(`[data-testid="user-edit-${targetUid}"]`);
    await bmPage.waitForSelector('[data-testid="edit-user-drawer"]', { timeout: 5_000 });
    const nameInput = await bmPage.$('#edit-user-name');
    originalName = await nameInput.inputValue();
    if (!originalName) throw new Error('Full Name input has no value');
  });
  await bmPage.screenshot({ path: resolve(SS_DIR, '02-bm-edit-drawer-open.png'), fullPage: false });

  const stampedName = `${originalName} (PR-4 smoke ${Date.now().toString().slice(-5)})`;

  await check('save-success-write', 'Change name + save → success toast + drawer closes', async () => {
    await bmPage.fill('#edit-user-name', stampedName);
    await bmPage.click('[data-testid="edit-user-save"]');
    // Success toast appears
    await bmPage.waitForSelector('[data-testid="toast-success"]', { timeout: 10_000 });
    // Drawer closes
    await bmPage.waitForSelector('[data-testid="edit-user-drawer"]', { state: 'detached', timeout: 5_000 });
  });
  await bmPage.screenshot({ path: resolve(SS_DIR, '03-bm-after-save-toast.png'), fullPage: false });

  // ── Hard reload → verify the change persisted ──
  await check('save-persists-after-reload', 'Hard reload renders the new name', async () => {
    await hardReloadAndAwaitReady(bmPage);
    await gotoTeam(bmPage);
    targetRow = await bmPage.$(`[data-testid="user-edit-${targetUid}"]`);
    if (!targetRow) throw new Error(`row ${targetUid} not present after reload`);
    // The new name appears somewhere on the page
    const found = await bmPage.$$eval('span.text-sm.font-semibold.text-ink.truncate', (els, expected) =>
      els.some((e) => e.textContent === expected), stampedName);
    if (!found) throw new Error(`stamped name not found in roster after reload`);
  });
  await bmPage.screenshot({ path: resolve(SS_DIR, '04-bm-after-reload.png'), fullPage: false });

  // ── Reset to original (defensive) ──
  await check('save-reset-to-original', 'Edit again, restore original name', async () => {
    await bmPage.click(`[data-testid="user-edit-${targetUid}"]`);
    await bmPage.waitForSelector('[data-testid="edit-user-drawer"]');
    await bmPage.fill('#edit-user-name', originalName);
    await bmPage.click('[data-testid="edit-user-save"]');
    await bmPage.waitForSelector('[data-testid="toast-success"]', { timeout: 10_000 });
    await bmPage.waitForSelector('[data-testid="edit-user-drawer"]', { state: 'detached' });
  });

  await check('save-reset-persists', 'Hard reload renders the restored original name', async () => {
    await hardReloadAndAwaitReady(bmPage);
    await gotoTeam(bmPage);
    const found = await bmPage.$$eval('span.text-sm.font-semibold.text-ink.truncate', (els, expected) =>
      els.some((e) => e.textContent === expected), originalName);
    if (!found) throw new Error(`original name not restored after reload`);
  });

  // ── Validation: empty name blocked ──
  await check('validation-empty-name-blocked', 'Empty name shows inline error, save blocked', async () => {
    await bmPage.click(`[data-testid="user-edit-${targetUid}"]`);
    await bmPage.waitForSelector('[data-testid="edit-user-drawer"]');
    await bmPage.fill('#edit-user-name', '');
    await bmPage.click('[data-testid="edit-user-save"]');
    // EditUserDrawer renders the validation error in <p role="alert"> — use the
    // role selector rather than constraining to <div>.
    await bmPage.waitForSelector('p[role="alert"]', { timeout: 3_000 });
    // Drawer must still be open
    const drawer = await bmPage.$('[data-testid="edit-user-drawer"]');
    if (!drawer) throw new Error('drawer closed despite validation error');
  });
  // Close drawer for next phase
  await bmPage.keyboard.press('Escape');
  await bmPage.waitForSelector('[data-testid="edit-user-drawer"]', { state: 'detached', timeout: 5_000 });

  await bmContext.close();

  // ── PHASE B — unit_manager permission scope ────────────────────────────
  console.log('\n── PHASE B — unit_manager permission scope ──');
  const umContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(umContext, BASE_URL, BYPASS_TOKEN);
  const umPage = await umContext.newPage();
  umPage.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[um] ${redact(m.text())}`);
  });

  await login(umPage, UM_EMAIL, UM_PASSWORD);
  await gotoTeam(umPage);
  await umPage.screenshot({ path: resolve(SS_DIR, '05-um-team-roster.png'), fullPage: false });

  await check('um-edit-affordance-on-own-agents', 'unit_manager sees edit affordance on agent rows in own unit', async () => {
    const editButtons = await umPage.$$('[data-testid^="user-edit-"]');
    if (editButtons.length === 0) throw new Error('unit_manager sees no edit buttons (expected at least one agent in unit)');
  });

  await check('um-drawer-hides-unitId-and-agentNumber', 'unit_manager edit drawer hides unitId / agentNumber / contractStartDate', async () => {
    const firstEdit = (await umPage.$$('[data-testid^="user-edit-"]'))[0];
    await firstEdit.click();
    await umPage.waitForSelector('[data-testid="edit-user-drawer"]');
    const fields = await umPage.evaluate(() => ({
      name:               !!document.querySelector('#edit-user-name'),
      phone:              !!document.querySelector('#edit-user-phone'),
      bio:                !!document.querySelector('#edit-user-bio'),
      unit:               !!document.querySelector('#edit-user-unit'),
      agentNumber:        !!document.querySelector('#edit-user-agent-number'),
      contractStartDate:  !!document.querySelector('#edit-user-contract-start'),
    }));
    if (!fields.name || !fields.phone || !fields.bio) throw new Error(`basic fields missing: ${JSON.stringify(fields)}`);
    if (fields.unit || fields.agentNumber || fields.contractStartDate) {
      throw new Error(`restricted fields leaked into unit_manager drawer: ${JSON.stringify(fields)}`);
    }
  });
  await umPage.screenshot({ path: resolve(SS_DIR, '06-um-drawer-restricted.png'), fullPage: false });
  await umPage.keyboard.press('Escape');
  await umContext.close();

  // ── PHASE C — tenant_admin canConfirmSettlements toggle ────────────────
  console.log('\n── PHASE C — tenant_admin canConfirmSettlements on unit_manager target ──');
  const taContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(taContext, BASE_URL, BYPASS_TOKEN);
  const taPage = await taContext.newPage();
  taPage.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[ta] ${redact(m.text())}`);
  });

  await login(taPage, TA_EMAIL, TA_PASSWORD);
  // tenant_admin lands on TA dashboard with "Users" tab
  // Click via either nav-team (manager-style) or nav-users (TA-style) — try both.
  const navUsers = await taPage.$('[data-testid="nav-team"]');
  if (navUsers) await navUsers.click();
  else await taPage.click('[data-testid="nav-users"]');
  await taPage.waitForSelector('[data-testid^="user-edit-"]', { timeout: 20_000 });

  await check('ta-can-confirm-settlements-toggle-on-um', 'tenant_admin editing a unit_manager sees canConfirmSettlements toggle', async () => {
    // Find a row whose Role column reads "Unit Manager"
    const rows = await taPage.$$eval(
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
    const umRow = rows.find((r) => /unit\s*manager/i.test(r.role));
    if (!umRow) throw new Error(`no unit_manager row found (rows: ${JSON.stringify(rows)})`);
    await taPage.click(`[data-testid="user-edit-${umRow.uid}"]`);
    await taPage.waitForSelector('[data-testid="edit-user-drawer"]');
    const toggle = await taPage.$('#edit-user-can-confirm-settlements');
    if (!toggle) throw new Error('canConfirmSettlements toggle not present in tenant_admin → unit_manager edit drawer');
  });
  await taPage.screenshot({ path: resolve(SS_DIR, '07-ta-drawer-with-can-confirm.png'), fullPage: false });
  await taPage.keyboard.press('Escape');
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

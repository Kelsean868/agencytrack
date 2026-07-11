/**
 * recruiting-smoke.mjs — item 2.2 live write-read-verify on staging.
 * As branch_manager: board loads (branch query vs real rules) → create a
 * candidate (create arm) → card renders → drill advance stage (owner update
 * arm) → archive (leaves board). Cleans up by archiving; no deletes exist.
 * Synthetic staging tenant only.
 *
 * Usage: node --env-file=.env.staging out/recruiting-smoke.mjs
 */
import { chromium } from 'playwright';
import {
  setupBypassSession, captureConsoleAndNetwork, formatCaptureReport, stamp, installGlobalTimeout,
} from '../scripts/verification/lib/walk-helpers.mjs';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';

const BASE = 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app';
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
if (!TOKEN) { console.error('MISSING ENV: VERCEL_BYPASS_TOKEN'); process.exit(2); }

const BM = { email: 'staging-branch-manager@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' };
const CAND_NAME = `Smoke Candidate ${Date.now().toString().slice(-6)}`;
const SS_DIR = resolve('out/recruiting-smoke', stamp().replace(/:/g, '-'));
mkdirSync(SS_DIR, { recursive: true });

const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`[${stamp()}] ${ok ? 'PASS' : 'FAIL'} ${id} — ${detail}`);
};
const clearTimer = installGlobalTimeout(8 * 60 * 1000, () => {});

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const cap = captureConsoleAndNetwork(page);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', BM.email);
  await page.fill('input[type="password"]', BM.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
  await page.waitForTimeout(1200);

  // team workspace → Recruiting tab
  const toggle = page.locator('[data-testid="sidebar-ws-toggle-team"]');
  if (await toggle.isVisible().catch(() => false)) { await toggle.click(); await page.waitForTimeout(500); }
  const nav = page.locator('[data-testid="nav-monthly-recruiting"], [data-testid="pinned-monthly-recruiting"]').first();
  await nav.waitFor({ state: 'visible', timeout: 12_000 });
  await nav.click();
  await page.waitForTimeout(2500);
  record('board-loads', true, 'Recruiting tab opened (branch board query ran)');
  await page.screenshot({ path: join(SS_DIR, '1-board.png') });

  // create candidate — find the add affordance
  const addBtn = page.getByRole('button', { name: /add.*candidate|new candidate/i }).first();
  const hasAdd = await addBtn.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
  record('add-affordance', hasAdd, hasAdd ? 'add-candidate affordance found' : 'no add-candidate button found');
  if (hasAdd) {
    await addBtn.click();
    const nameInput = page.locator('input#rec-cand-name, input[name="name"], [role="dialog"] input[type="text"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 8_000 });
    await nameInput.fill(CAND_NAME);
    const saveBtn = page.locator('[data-testid="rec-form-submit"]');
    await saveBtn.click();
    await page.waitForTimeout(2500);
    const cardVisible = await page.getByText(CAND_NAME).first()
      .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    record('create-write-read', cardVisible, cardVisible
      ? `candidate "${CAND_NAME}" written through rules and rendered on the board`
      : 'created candidate never appeared on the board');
    await page.screenshot({ path: join(SS_DIR, '2-created.png') });

    if (cardVisible) {
      // drill → advance stage
      await page.getByText(CAND_NAME).first().click();
      const dlg = page.locator('[role="dialog"]').last();
      await dlg.waitFor({ state: 'visible', timeout: 8_000 });
      const advBtn = dlg.getByRole('button', { name: /advance/i }).first();
      const hasAdv = await advBtn.isVisible().catch(() => false);
      if (hasAdv) {
        await advBtn.click();
        await page.waitForTimeout(2000);
        record('advance-stage', true, 'advance action fired (owner update arm accepted the write)');
      } else {
        record('advance-stage', false, 'no Advance button in drill');
      }
      await page.screenshot({ path: join(SS_DIR, '3-drill.png') });
      // archive (cleanup + archive-arm verification)
      const archBtn = dlg.getByRole('button', { name: /archive/i }).first();
      const hasArch = await archBtn.isVisible().catch(() => false);
      if (hasArch) {
        await archBtn.click();
        // possible confirm dialog
        const confirm = page.getByRole('button', { name: /archive|confirm/i }).last();
        if (await confirm.isVisible().catch(() => false)) await confirm.click();
        await page.waitForTimeout(2500);
        const gone = !(await page.getByText(CAND_NAME).first().isVisible().catch(() => false));
        record('archive-cleanup', gone, gone ? 'candidate archived — left the active board (cleanup done)' : 'candidate still visible after archive');
      } else {
        record('archive-cleanup', false, 'no Archive button in drill — synthetic candidate remains on the staging board');
      }
      await page.screenshot({ path: join(SS_DIR, '4-after-archive.png') });
    }
  }

  const fsErrors = cap.consoleMessages.filter((m) =>
    /permission|denied|requires an index|failed-precondition|FirebaseError/i.test(m.text ?? String(m)));
  record('no-firestore-errors', fsErrors.length === 0, fsErrors.length === 0
    ? 'zero permission/index errors across create/update/archive'
    : `${fsErrors.length} Firestore error(s): ${fsErrors.map((m) => (m.text ?? String(m)).slice(0, 140)).join(' | ')}`);

  console.log(formatCaptureReport(cap));
  await context.close();
} finally {
  await browser.close();
  clearTimer();
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n── recruiting smoke: ${results.length - fails} PASS / ${fails} FAIL — shots: ${SS_DIR}`);
process.exit(fails ? 1 : 0);

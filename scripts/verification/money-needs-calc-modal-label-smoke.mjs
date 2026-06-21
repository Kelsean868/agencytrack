/**
 * money-needs-calc-modal-label-smoke.mjs — calc-modal LineItemRow label fix (#718 addendum).
 *
 * Verifies the desktop label-truncation fix in the sub-calculator modal on the
 * Vercel PREVIEW (real PROD Firestore via the bypass session). A throwaway line
 * item is added inside the Insurance Industry calc, measured, then DELETED at the
 * end (neutral footprint).
 *
 * Gates:
 *   L1 (desktop, label grows): inside the calc modal, a long-label Description
 *      input is wide — wider than the amount column and ≥150px — i.e. it absorbs
 *      the row's horizontal slack (pre-fix it was pinned narrow).
 *   L2 (desktop, flat row): Description and Amount sit on the SAME visual row
 *      (sm:contents dissolved the numeric wrapper → columns align to the header).
 *   L3 (desktop, no gap before Annual): the gap between the Frequency control's
 *      right edge and the Annual column's left edge is small (slack went into the
 *      label, not a void between freq and annual).
 *   L4 (main-panel regression): a manual row added in an expense group renders
 *      its Description input (the #718 main-panel path still works).
 *   L5 (mobile, stacks): the same modal row stacks — Description sits ABOVE Amount.
 *   L6: axe NO-NEW serious/critical (contrast + labels) with the modal open, both themes.
 *   L7: 0 app console errors across the session.
 *
 * Run: node scripts/verification/money-needs-calc-modal-label-smoke.mjs [previewUrl]
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  safeLog,
  setTheme,
} from './lib/walk-helpers.mjs';
import { loadEnv, loginAs, navigateAgentTab } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const E = loadEnv(ROOT);

const PREVIEW_URL = process.argv[2]
  || 'https://agencytrack-git-feat-money-needs-calc-modal-label-fix-kyron-marchan-s-projects.vercel.app';

const results = [];
const pass = (l, n = '') => { results.push({ ok: true, l }); console.log(`  ✅ ${l}${n ? ': ' + n : ''}`); };
const fail = (l, n = '') => { results.push({ ok: false, l, n }); console.error(`  ❌ ${l}${n ? ': ' + n : ''}`); };

const LONG_LABEL = 'TTAIFA Conference Registration & Professional License Renewal';

// On mobile, navigateAgentTab opens the More drawer to reach a sidebar-only tab;
// the drawer + backdrop can linger and intercept later clicks. Dismiss it.
async function dismissNavDrawer(page) {
  const backdrop = page.locator('[data-testid="nav-drawer-backdrop"]');
  if (await backdrop.count() > 0 && await backdrop.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    if (await backdrop.isVisible().catch(() => false)) {
      await backdrop.click({ position: { x: 5, y: 5 } }).catch(() => {});
    }
    await backdrop.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function navMoneyNeeds(page) {
  await page.waitForSelector('[data-testid="agent-tab-money-needs"]', { state: 'attached', timeout: 25_000 });
  await navigateAgentTab(page, 'money-needs');
  await dismissNavDrawer(page);
  await page.waitForFunction(
    () => document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null
      || /Start\s+\d+\s+worksheet|Start worksheet/.test(document.body.textContent),
    { timeout: 25_000 },
  );
  const startBtn = page.getByRole('button', { name: /start\s+\d+\s+worksheet|start worksheet/i });
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="Share with my Unit Manager and Branch Manager"]') !== null,
      { timeout: 25_000 },
    );
  }
}

async function openGroup(page, nameRe) {
  const btn = page.getByRole('button', { name: nameRe }).first();
  await btn.waitFor({ state: 'visible', timeout: 10_000 });
  if (await btn.getAttribute('aria-expanded') !== 'true') { await btn.click(); await page.waitForTimeout(400); }
}

// Open the Insurance Industry calc modal via its calc-fed trigger ("Build with
// calculator" CTA when empty, "Recalculate" when filled — same aria-label).
async function openIndustryModal(page) {
  await openGroup(page, /^Business Expenses/i);
  const trigger = page.getByRole('button', { name: /Open Professional\/industry expenses calculator/i });
  await trigger.waitFor({ state: 'visible', timeout: 8000 });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Insurance Industry Expenses' });
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  return dialog;
}

// Add one line item inside the open modal and type a long label into it.
async function addLongLabelRow(page, dialog) {
  await dialog.getByRole('button', { name: /Add item/i }).click();
  await page.waitForTimeout(1500); // Firestore write
  const desc = dialog.getByRole('textbox', { name: /Expense description/i }).last();
  await desc.fill(LONG_LABEL);
  await page.waitForTimeout(300);
  return desc;
}

// Delete the throwaway row (neutral footprint). Best-effort.
async function deleteRow(page, dialog) {
  try {
    const del = dialog.getByRole('button', { name: /Delete expense/i }).last();
    if (await del.count() > 0) { await del.click(); await page.waitForTimeout(1800); }
  } catch (e) { console.warn('[cleanup] non-fatal:', e.message); }
}

(async () => {
  const required = ['VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  console.log(`\nPreview: ${PREVIEW_URL}\n`);
  const browser = await chromium.launch({ headless: true });

  try {
    // ════════════════════════ DESKTOP (1280×900) ════════════════════════════
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const capture = captureConsoleAndNetwork(page);

    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PREVIEW_URL}/`);
    await navMoneyNeeds(page);

    console.log('\n── L1/L2/L3 — desktop modal: full-width stacked label, row stacks, no gap before Annual');
    {
      const dialog = await openIndustryModal(page);
      const desc = await addLongLabelRow(page, dialog);
      const amount = dialog.getByRole('spinbutton', { name: /Expense amount/i }).last();
      const freq = dialog.getByRole('combobox', { name: /Frequency/i }).last();
      const annual = dialog.locator('span').filter({ hasText: /\/\s*yr/ }).last();

      const dBox = await desc.boundingBox();
      const aBox = await amount.boundingBox();
      const fBox = await freq.boundingBox();
      const yBox = await annual.boundingBox().catch(() => null);
      safeLog(`[L] desc.w=${dBox && Math.round(dBox.width)} amount.w=${aBox && Math.round(aBox.width)} desc.y=${dBox && Math.round(dBox.y)} amount.y=${aBox && Math.round(aBox.y)}`);

      // L1 — stacked label takes the full row width (renders the long label in full),
      // not pinned to ~89px as the flat layout did.
      if (dBox && dBox.width >= 300) {
        pass('L1: desktop modal Description is full-width (stacked → renders in full)', `w=${Math.round(dBox.width)}`);
      } else {
        fail('L1: desktop modal Description width', dBox ? `w=${Math.round(dBox.width)} (expected ≥300)` : 'no box');
      }

      // L2 — desktop modal row STACKS: Description sits above the numeric row.
      if (dBox && aBox && (aBox.y - dBox.y) > 20) {
        pass('L2: desktop modal row stacks — Description above numeric row', `Δy=${Math.round(aBox.y - dBox.y)}`);
      } else {
        fail('L2: desktop modal stacking', dBox && aBox ? `Δy=${Math.round(aBox.y - dBox.y)}` : 'no box');
      }

      // L3 — within the numeric (2nd) row, no big gap between Frequency and Annual.
      if (fBox && yBox) {
        const gap = yBox.x - (fBox.x + fBox.width);
        if (gap < 40) pass('L3: no gap before Annual in numeric row', `gap=${Math.round(gap)}px`);
        else fail('L3: gap before Annual', `gap=${Math.round(gap)}px`);
      } else {
        fail('L3: gap measurement', 'freq/annual box not found');
      }

      await deleteRow(page, dialog);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // ── L4 — main-panel manual row stays FLAT on desktop (regression vs #718) ──
    console.log('\n── L4 — main-panel manual row stays flat on desktop (regression)');
    {
      await openGroup(page, /^Miscellaneous/i);
      const miscCard = page.locator('.border.rounded-xl').filter({ hasText: /Miscellaneous/i }).last();
      const addBtn = miscCard.getByRole('button', { name: /Add item/i }).first();
      await addBtn.click();
      await page.waitForTimeout(1800);
      const desc = miscCard.getByRole('textbox', { name: /Expense description/i }).last();
      const amount = miscCard.getByRole('spinbutton', { name: /Expense amount/i }).last();
      const dBox = await desc.boundingBox().catch(() => null);
      const aBox = await amount.boundingBox().catch(() => null);
      safeLog(`[L4] desc.y=${dBox && Math.round(dBox.y)} amount.y=${aBox && Math.round(aBox.y)}`);
      // #718 main panel = flat row on desktop: Description + Amount share a line.
      if (dBox && aBox && Math.abs(dBox.y - aBox.y) < 15) {
        pass('L4: main-panel desktop row stays flat (#718 unchanged)', `Δy=${Math.round(Math.abs(dBox.y - aBox.y))}`);
      } else {
        fail('L4: main-panel desktop row', dBox && aBox ? `Δy=${Math.round(Math.abs(dBox.y - aBox.y))}` : 'no box');
      }
      // cleanup
      const del = miscCard.getByRole('button', { name: /Delete expense/i }).last();
      if (await del.count() > 0) { await del.click(); await page.waitForTimeout(1800); }
    }

    // ── L6 — axe both themes with modal open ─────────────────────────────────
    console.log('\n── L6 — axe serious/critical (contrast + labels), both themes, modal open');
    for (const theme of ['light', 'dark']) {
      await setTheme(ctx, theme);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await navMoneyNeeds(page);
      const dialog = await openIndustryModal(page);
      const desc = await addLongLabelRow(page, dialog);
      void desc;
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const relevant = axe.violations.filter(
        (v) => ['serious', 'critical'].includes(v.impact)
          && ['color-contrast', 'button-name', 'aria-command-name', 'link-name', 'aria-required-attr', 'label'].includes(v.id),
      );
      if (relevant.length === 0) pass(`L6: ${theme} — 0 serious/critical contrast/label nodes`);
      else {
        fail(`L6: ${theme} a11y`, `${relevant.reduce((s, v) => s + v.nodes.length, 0)} node(s)`);
        relevant.slice(0, 3).forEach((v) => v.nodes.slice(0, 2).forEach((n) => console.log(`    ${theme} ${v.id}: ${n.target}`)));
      }
      await deleteRow(page, dialog);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
    await setTheme(ctx, 'light');

    await ctx.close();

    // ── L7: console errors ───────────────────────────────────────────────────
    console.log('\n── L7 — console errors');
    const isBenign = (t) => /fontshare/i.test(t) || /Failed to load resource/i.test(t);
    const errs = capture.consoleMessages.filter((m) => m.type === 'error' && !isBenign(m.text));
    if (errs.length === 0) pass('L7: 0 app console errors (font-CDN CORS noise filtered)');
    else { fail('L7: console errors', `${errs.length}`); console.log(formatCaptureReport(capture)); }

    // ════════════════════════ MOBILE (390×844) ══════════════════════════════
    console.log('\n── L5 — mobile: modal row stacks (Description above Amount)');
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mpage = await mctx.newPage();
    await setupBypassSession(mctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(mpage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PREVIEW_URL}/`);
    await navMoneyNeeds(mpage);
    {
      const dialog = await openIndustryModal(mpage);
      const desc = await addLongLabelRow(mpage, dialog);
      const amount = dialog.getByRole('spinbutton', { name: /Expense amount/i }).last();
      const dBox = await desc.boundingBox();
      const aBox = await amount.boundingBox();
      safeLog(`[L5] desc.y=${dBox && Math.round(dBox.y)} amount.y=${aBox && Math.round(aBox.y)}`);
      if (dBox && aBox && (aBox.y - dBox.y) > 20) {
        pass('L5: mobile row stacks — Description above Amount', `Δy=${Math.round(aBox.y - dBox.y)}`);
      } else {
        fail('L5: mobile stacking', dBox && aBox ? `Δy=${Math.round(aBox.y - dBox.y)}` : 'no box');
      }
      await deleteRow(mpage, dialog);
    }
    await mctx.close();
  } finally {
    await browser.close();
  }

  console.log('\n══════════════════════════════════════');
  console.log('MONEY-NEEDS CALC-MODAL LABEL SMOKE SUMMARY');
  console.log('══════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.l}${r.n ? ': ' + r.n : ''}`);
  console.log(`\n${passed}/${results.length} pass${failed ? ` (${failed} FAILED)` : ''}`);
  if (failed) process.exit(1);
})();

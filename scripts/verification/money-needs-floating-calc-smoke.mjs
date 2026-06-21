/**
 * money-needs-floating-calc-smoke.mjs — floating sub-calculators (PR #716).
 *
 * Verifies the floating-calculator conversion on the Vercel PREVIEW (real PROD
 * Firestore via the bypass session). Edits are made to the A11Y agent's own
 * Car Expenses sub-calc and RESTORED at the end (neutral footprint).
 *
 * Gates:
 *   F1: Money Needs renders; a trigger sits next to each calc-fed line (car on
 *       BOTH lines, industry, loans); the read-only car-loan ref has NO trigger;
 *       the trailing "Sub-Calculators" section is gone.
 *   F2 (count-once): change the Car total; the Living "Car expenses, nonbusiness"
 *       line moves by EXACTLY the change in its prefill (delta once, not doubled).
 *   F3 (both car lines prefill): Living personal + Business "Business car expenses"
 *       both populate from the same Car calc.
 *   F4 (persist): reload → the prefilled value persists.
 *   F5 (desktop shape): the calc opens as a CENTRED bounded modal.
 *   F6 (focus): clicking a trigger traps focus into the modal; Escape returns
 *       focus to the originating trigger.
 *   F7 (mobile shape, 390×844): the calc opens as a FULL-SCREEN bottom sheet.
 *   F8 (mobile focus): focus returns to the trigger on close.
 *   F9: axe NO-NEW serious/critical (contrast + labels) with the modal open, both themes.
 *   F10: 0 app console errors across the session.
 *
 * Run: node scripts/verification/money-needs-floating-calc-smoke.mjs [previewUrl]
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
  waitForFirebaseReady,
} from './lib/walk-helpers.mjs';
import { loadEnv, loginAs, navigateAgentTab } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const E = loadEnv(ROOT);

const PREVIEW_URL = process.argv[2]
  || 'https://agencytrack-git-feat-money-needs-floating-calc-kyron-marchan-s-projects.vercel.app';

const results = [];
const pass = (l, n = '') => { results.push({ ok: true, l }); console.log(`  ✅ ${l}${n ? ': ' + n : ''}`); };
const fail = (l, n = '') => { results.push({ ok: false, l, n }); console.error(`  ❌ ${l}${n ? ': ' + n : ''}`); };

const MONEY_YR_RE = /(?:TTD|\$)\s*-?[\d,.]+\s*\/\s*yr/i;
const parseTTD = (s) => {
  const m = (s || '').replace(/[, ]/g, '').match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
};
const parseMoney = (s) => {
  const m = (s || '').replace(/[, ]/g, '').match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
};

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
  // 'attached' (not 'visible') — on mobile the sidebar tab is hidden in the DOM
  // and reached via the More drawer; navigateAgentTab handles that fallback.
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
async function closeGroup(page, nameRe) {
  const btn = page.getByRole('button', { name: nameRe }).first();
  if (await btn.count() === 0) return;
  if (await btn.getAttribute('aria-expanded') === 'true') { await btn.click(); await page.waitForTimeout(300); }
}

async function groupHeaderTotal(page, label) {
  const btn = page.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
  const txt = await btn.textContent();
  const m = (txt || '').match(MONEY_YR_RE);
  return m ? parseTTD(m[0]) : 0;
}

// Open the Car calc modal via the "Business car expenses" trigger; the Business
// group must be open for the trigger to be in the DOM.
async function openCarModal(page) {
  await openGroup(page, /^Business Expenses/i);
  const trigger = page.getByRole('button', { name: /Open Business car expenses calculator/i });
  await trigger.waitFor({ state: 'visible', timeout: 8000 });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Car Expenses' });
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  return { dialog, trigger };
}

// Set the first Car line to a monthly amount inside the modal, save, read the
// Personal/Business split the calc feeds, then close the modal.
async function setCarViaModal(page, monthly) {
  const { dialog } = await openCarModal(page);
  let amt = dialog.locator('input[aria-label="Expense amount"]').first();
  if (await amt.count() === 0) {
    await dialog.getByRole('button', { name: /Add item/i }).click();
    await page.waitForTimeout(1500);
    amt = dialog.locator('input[aria-label="Expense amount"]').first();
  }
  await amt.fill(String(monthly));
  await page.waitForTimeout(200);
  await amt.blur();
  await page.waitForTimeout(2500); // Firestore write + prefill
  const dlgTxt = await dialog.textContent();
  const pm = (dlgTxt || '').match(/Personal\s*\([\d.]+%\):\s*((?:TTD|\$)\s*[\d,]+)/i);
  const bm = (dlgTxt || '').match(/Business\s*\([\d.]+%\):\s*((?:TTD|\$)\s*[\d,]+)/i);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  return { personal: pm ? parseMoney(pm[1]) : NaN, business: bm ? parseMoney(bm[1]) : NaN };
}

// Read the Living calc-fed "Car expenses, nonbusiness" line annual.
async function readLivingPersonalLine(page) {
  await openGroup(page, /^Living Expenses/i);
  // The calc-fed row is the only `.flex.items-center` containing BOTH the label
  // and the "/ yr" annual (the label <span> alone lacks the annual text).
  const row = page.locator('.flex.items-center')
    .filter({ hasText: /Car expenses, nonbusiness/ })
    .filter({ hasText: /\/\s*yr/ })
    .last();
  const rowTxt = await row.textContent().catch(() => '');
  const m = (rowTxt || '').match(MONEY_YR_RE);
  await closeGroup(page, /^Living Expenses/i);
  return m ? parseTTD(m[0]) : NaN;
}

async function reload(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page, 25_000);
  await page.waitForTimeout(1500);
  await navMoneyNeeds(page);
}

(async () => {
  const required = ['VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  console.log(`\nPreview: ${PREVIEW_URL}\n`);
  const browser = await chromium.launch({ headless: true });
  let originalCar = null;

  try {
    // ════════════════════════ DESKTOP (1280×900) ════════════════════════════
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const capture = captureConsoleAndNetwork(page);

    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PREVIEW_URL}/`);
    await navMoneyNeeds(page);

    // ── F1: triggers present, loan-ref has none, trailing section gone ───────
    console.log('\n── F1 — triggers next to each calc-fed line; no loan trigger; trailing section gone');
    await openGroup(page, /^Living Expenses/i);
    await openGroup(page, /^Business Expenses/i);
    await openGroup(page, /^Savings & Accumulation/i);

    const trigCar1 = await page.getByRole('button', { name: /Open Car expenses, nonbusiness calculator/i }).count();
    const trigCar2 = await page.getByRole('button', { name: /Open Business car expenses calculator/i }).count();
    const trigInd  = await page.getByRole('button', { name: /Open Professional\/industry expenses calculator/i }).count();
    const trigLoan = await page.getByRole('button', { name: /Open Debt reduction \(non-mortgage\) calculator/i }).count();
    if (trigCar1 === 1 && trigCar2 === 1 && trigInd === 1 && trigLoan === 1) {
      pass('F1: a trigger sits on all four calc-fed lines (car on both)');
    } else {
      fail('F1: triggers', `car-personal=${trigCar1} car-business=${trigCar2} industry=${trigInd} loans=${trigLoan}`);
    }
    const allTriggers = await page.getByRole('button', { name: /^Open .* calculator$/i }).count();
    if (allTriggers === 4) pass('F1: exactly 4 triggers — read-only car-loan ref has none');
    else fail('F1: trigger count', `${allTriggers} (expected 4)`);
    const bodyTxt = await page.evaluate(() => document.body.textContent);
    if (!/Sub-Calculators/.test(bodyTxt)) pass('F1: trailing "Sub-Calculators" section removed');
    else fail('F1: trailing section still present');
    await closeGroup(page, /^Living Expenses/i);
    await closeGroup(page, /^Savings & Accumulation/i);

    // capture original car-first-line value for restore
    {
      const { dialog } = await openCarModal(page);
      const a = dialog.locator('input[aria-label="Expense amount"]').first();
      originalCar = (await a.count()) ? await a.inputValue().catch(() => '') : '';
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      safeLog(`[MN] original Car first-line value: "${originalCar}"`);
    }

    // ── F2/F3: count-once + both car lines prefill ───────────────────────────
    console.log('\n── F2/F3 — count once + both car lines prefill from one calc');
    const splitA = await setCarViaModal(page, 1000);
    const livingA = await groupHeaderTotal(page, 'Living Expenses');
    const lineA = await readLivingPersonalLine(page);
    safeLog(`[F2] A: personalSplit=${splitA.personal} businessSplit=${splitA.business} livingTotal=${livingA} livingLine=${lineA}`);

    const splitB = await setCarViaModal(page, 2000);
    const livingB = await groupHeaderTotal(page, 'Living Expenses');
    const lineB = await readLivingPersonalLine(page);
    safeLog(`[F2] B: personalSplit=${splitB.personal} businessSplit=${splitB.business} livingTotal=${livingB} livingLine=${lineB}`);

    if (Number.isFinite(splitA.personal) && Number.isFinite(splitB.personal)
      && lineA === splitA.personal && lineB === splitB.personal) {
      pass('F3: Living "Car expenses, nonbusiness" line matches the Car calc personal split', `${lineA} → ${lineB}`);
    } else {
      fail('F3: Living personal prefill', `line ${lineA}/${lineB} vs split ${splitA.personal}/${splitB.personal}`);
    }
    if (Number.isFinite(splitA.business) && splitA.business > 0 && splitB.business > splitA.business) {
      pass('F3: Business "Business car expenses" line also prefills', `${splitA.business} → ${splitB.business}`);
    } else {
      fail('F3: Business prefill', `${splitA.business} → ${splitB.business}`);
    }
    const livingDelta = livingB - livingA;
    const lineDelta = lineB - lineA;
    if (Number.isFinite(livingDelta) && livingDelta === lineDelta && lineDelta !== 0) {
      pass('F2: COUNT-ONCE — Living total delta equals the prefill delta', `Δliving=${livingDelta} == Δline=${lineDelta}`);
    } else {
      fail('F2: COUNT-ONCE', `Δliving=${livingDelta} != Δline=${lineDelta} (doubled?)`);
    }

    // ── F4: persistence ──────────────────────────────────────────────────────
    console.log('\n── F4 — prefilled value persists across reload');
    await reload(page);
    const lineReload = await readLivingPersonalLine(page);
    if (lineReload === lineB) pass('F4: prefilled Living value persisted', `${lineReload}`);
    else fail('F4: persisted value', `got ${lineReload}, expected ${lineB}`);

    // ── F5: desktop shape (centred bounded modal) ────────────────────────────
    console.log('\n── F5 — desktop: centred bounded modal');
    {
      const { dialog } = await openCarModal(page);
      const box = await dialog.boundingBox();
      const centred = box && box.width <= 560 && box.x > 200 && (box.x + box.width) < 1080;
      if (centred) pass('F5: desktop modal is centred + bounded', `w=${Math.round(box.width)} x=${Math.round(box.x)}`);
      else fail('F5: desktop modal shape', box ? `w=${Math.round(box.width)} x=${Math.round(box.x)}` : 'no box');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // ── F6: focus trap + return (desktop) ────────────────────────────────────
    console.log('\n── F6 — focus traps into modal + returns to trigger on close');
    {
      await openGroup(page, /^Business Expenses/i);
      const trigger = page.getByRole('button', { name: /Open Business car expenses calculator/i });
      await trigger.focus();
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Car Expenses' });
      await dialog.waitFor({ state: 'visible', timeout: 8000 });
      const focusInside = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        return !!dlg && dlg.contains(document.activeElement);
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const dialogGone = await page.getByRole('dialog', { name: 'Car Expenses' }).count() === 0;
      const focusReturned = await page.evaluate(() => {
        const el = document.activeElement;
        return !!el && /Open Business car expenses calculator/i.test(el.getAttribute('aria-label') || '');
      });
      if (focusInside && dialogGone && focusReturned) pass('F6: focus trapped in, returned to trigger on Escape');
      else fail('F6: focus', `inside=${focusInside} closed=${dialogGone} returned=${focusReturned}`);
    }

    // ── F9: axe both themes with modal open ──────────────────────────────────
    console.log('\n── F9 — axe serious/critical (contrast + labels), both themes, modal open');
    for (const theme of ['light', 'dark']) {
      await setTheme(ctx, theme);
      await reload(page);
      await openCarModal(page);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const relevant = axe.violations.filter(
        (v) => ['serious', 'critical'].includes(v.impact)
          && ['color-contrast', 'button-name', 'aria-command-name', 'link-name', 'aria-required-attr'].includes(v.id),
      );
      if (relevant.length === 0) pass(`F9: ${theme} — 0 serious/critical contrast/label nodes`);
      else {
        fail(`F9: ${theme} a11y`, `${relevant.reduce((s, v) => s + v.nodes.length, 0)} node(s)`);
        relevant.slice(0, 3).forEach((v) => v.nodes.slice(0, 2).forEach((n) => console.log(`    ${theme} ${v.id}: ${n.target}`)));
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }

    // ── restore original car value ───────────────────────────────────────────
    console.log('\n── cleanup — restore Car first-line value');
    await setTheme(ctx, 'light');
    await reload(page);
    try {
      const { dialog } = await openCarModal(page);
      const a = dialog.locator('input[aria-label="Expense amount"]').first();
      await a.fill(originalCar === '' ? '0' : originalCar);
      await page.waitForTimeout(200); await a.blur(); await page.waitForTimeout(2500);
      await page.keyboard.press('Escape');
      safeLog(`[cleanup] restored Car first-line="${originalCar}"`);
    } catch (e) { console.warn('[cleanup] non-fatal:', e.message); }

    await ctx.close();

    // ── F10: console errors ──────────────────────────────────────────────────
    console.log('\n── F10 — console errors');
    const isBenign = (t) => /fontshare/i.test(t) || /Failed to load resource/i.test(t);
    const errs = capture.consoleMessages.filter((m) => m.type === 'error' && !isBenign(m.text));
    if (errs.length === 0) pass('F10: 0 app console errors (font-CDN CORS noise filtered)');
    else { fail('F10: console errors', `${errs.length}`); console.log(formatCaptureReport(capture)); }

    // ════════════════════════ MOBILE (390×844) ══════════════════════════════
    console.log('\n── F7/F8 — mobile: full-screen sheet + focus return');
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mpage = await mctx.newPage();
    await setupBypassSession(mctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(mpage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PREVIEW_URL}/`);
    await navMoneyNeeds(mpage);

    await openGroup(mpage, /^Business Expenses/i);
    const mTrigger = mpage.getByRole('button', { name: /Open Business car expenses calculator/i });
    await mTrigger.waitFor({ state: 'visible', timeout: 8000 });
    await mTrigger.focus();
    await mTrigger.click();
    const mDialog = mpage.getByRole('dialog', { name: 'Car Expenses' });
    await mDialog.waitFor({ state: 'visible', timeout: 8000 });
    const mBox = await mDialog.boundingBox();
    const fullScreen = mBox && mBox.width >= 386 && mBox.height >= 800;
    if (fullScreen) pass('F7: mobile modal is a full-screen sheet', `w=${Math.round(mBox.width)} h=${Math.round(mBox.height)}`);
    else fail('F7: mobile shape', mBox ? `w=${Math.round(mBox.width)} h=${Math.round(mBox.height)}` : 'no box');

    await mpage.keyboard.press('Escape');
    await mpage.waitForTimeout(500);
    const mGone = await mpage.getByRole('dialog', { name: 'Car Expenses' }).count() === 0;
    const mReturned = await mpage.evaluate(() => {
      const el = document.activeElement;
      return !!el && /Open Business car expenses calculator/i.test(el.getAttribute('aria-label') || '');
    });
    if (mGone && mReturned) pass('F8: mobile focus returned to trigger on close');
    else fail('F8: mobile focus', `closed=${mGone} returned=${mReturned}`);
    await mctx.close();
  } finally {
    await browser.close();
  }

  console.log('\n══════════════════════════════════════');
  console.log('MONEY-NEEDS FLOATING-CALC SMOKE SUMMARY');
  console.log('══════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.l}${r.n ? ': ' + r.n : ''}`);
  console.log(`\n${passed}/${results.length} pass${failed ? ` (${failed} FAILED)` : ''}`);
  if (failed) process.exit(1);
})();

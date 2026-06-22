/**
 * money-needs-group-header-smoke.mjs — ExpenseGroupAccordion header mobile fix (rev-3).
 *
 * Verifies the group-header truncation fix on the Vercel PREVIEW (real PROD
 * Firestore via the bypass session). A throwaway manual line item (long label +
 * amount) is added to the "Savings & Accumulation" group so the header shows the
 * "{filled} of {total} filled" count + "TTD …/yr" total, the header is measured,
 * then the row is DELETED at the end (neutral footprint).
 *
 * Defect (pre-fix): on mobile the single justify-between header row let the
 * shrink-0 count/total/chevron starve the label, truncating the group name to
 * ~3 chars ("Sav…"). Fix stacks the header: flex-col mobile, sm:flex-row desktop.
 *
 * Gates:
 *   G1 (desktop single-row): label and count sit on the SAME visual row
 *      (|Δy| < 15) — the #718/#720 desktop look is unchanged.
 *   G2 (desktop full label): the label is not clip-truncated (scrollWidth ≤
 *      clientWidth), has no `truncate` class, and renders the FULL group name.
 *   G3 (mobile stacks): the count sub-row sits BELOW the label (Δy > 15).
 *   G4 (mobile full label): the long group name renders in FULL on mobile —
 *      not clipped, no `truncate` class, full text present (the actual defect).
 *   G5: axe NO-NEW serious/critical (contrast + labels) on Money Needs, both themes.
 *   G6: 0 app console errors across the session.
 *
 * Run: node scripts/verification/money-needs-group-header-smoke.mjs [previewUrl]
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
  || 'https://agencytrack-git-fix-money-needs-group-header-mobile-kyron-marchan-s-projects.vercel.app';

const GROUP = /Savings & Accumulation/i;
const GROUP_TEXT = 'Savings & Accumulation';
const THROW_LABEL = 'Throwaway long savings goal label for header width regression test';

const results = [];
const pass = (l, n = '') => { results.push({ ok: true, l }); console.log(`  ✅ ${l}${n ? ': ' + n : ''}`); };
const fail = (l, n = '') => { results.push({ ok: false, l, n }); console.error(`  ❌ ${l}${n ? ': ' + n : ''}`); };

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

async function openGroup(page) {
  const btn = page.getByRole('button', { name: GROUP }).first();
  await btn.waitFor({ state: 'visible', timeout: 10_000 });
  if (await btn.getAttribute('aria-expanded') !== 'true') { await btn.click(); await page.waitForTimeout(400); }
}

function groupCard(page) {
  return page.locator('.border.rounded-xl').filter({ hasText: GROUP }).last();
}

// Add one manual line item to the group (long label + amount) so the header shows
// both the "{filled} of {total} filled" count and the "TTD …/yr" total.
async function addThrowawayRow(page) {
  const card = groupCard(page);
  await card.getByRole('button', { name: /Add item/i }).first().click();
  await page.waitForTimeout(1500); // Firestore write
  const desc = card.getByRole('textbox', { name: /Expense description/i }).last();
  await desc.fill(THROW_LABEL);
  const amount = card.getByRole('spinbutton', { name: /Expense amount/i }).last();
  await amount.fill('1200');
  await amount.blur();
  await page.waitForTimeout(1500); // Firestore write on blur
}

async function deleteThrowawayRow(page) {
  try {
    const card = groupCard(page);
    const del = card.getByRole('button', { name: /Delete expense/i }).last();
    if (await del.count() > 0) { await del.click(); await page.waitForTimeout(1800); }
  } catch (e) { console.warn('[cleanup] non-fatal:', e.message); }
}

// Measure the accordion HEADER's label span and count span (rects + clip state).
async function measureHeader(page) {
  return page.evaluate((gt) => {
    const btns = Array.from(document.querySelectorAll('button[aria-expanded]'));
    const header = btns.find((b) => b.textContent.trim().startsWith(gt));
    if (!header) return { found: false };
    const spans = Array.from(header.querySelectorAll('span'));
    const labelEl = spans.find((s) => s.textContent.trim() === gt);
    const countEl = spans.find((s) => /of\s+\d+\s+filled/i.test(s.textContent));
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    return {
      found: true,
      label: rect(labelEl),
      labelClipped: labelEl ? labelEl.scrollWidth > labelEl.clientWidth + 2 : null,
      labelTruncateClass: labelEl ? labelEl.classList.contains('truncate') : null,
      labelText: labelEl ? labelEl.textContent.trim() : null,
      count: rect(countEl),
      countText: countEl ? countEl.textContent.trim() : null,
    };
  }, GROUP_TEXT);
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

    console.log('\n── G1/G2 — desktop: header single-row, full label');
    {
      await openGroup(page);
      await addThrowawayRow(page);
      const m = await measureHeader(page);
      safeLog(`[D] found=${m.found} label=${JSON.stringify(m.label)} count=${JSON.stringify(m.count)} clipped=${m.labelClipped} trunc=${m.labelTruncateClass}`);

      if (m.found && m.label && m.count) {
        const dy = Math.abs(m.label.y - m.count.y);
        if (dy < 15) pass('G1: desktop header is a single row (label + count aligned)', `Δy=${Math.round(dy)}`);
        else fail('G1: desktop single-row', `Δy=${Math.round(dy)} (expected <15)`);
      } else {
        fail('G1: desktop header measurement', `found=${m.found} label=${!!m.label} count=${!!m.count}`);
      }

      if (m.found && m.label && m.labelClipped === false && m.labelTruncateClass === false && m.labelText === GROUP_TEXT) {
        pass('G2: desktop label renders in full (no clip, no truncate class)', `"${m.labelText}"`);
      } else {
        fail('G2: desktop full label', `clipped=${m.labelClipped} trunc=${m.labelTruncateClass} text="${m.labelText}"`);
      }

      await deleteThrowawayRow(page);
    }

    // ── G5 — axe both themes on Money Needs (group open) ─────────────────────
    console.log('\n── G5 — axe serious/critical (contrast + labels), both themes');
    for (const theme of ['light', 'dark']) {
      await setTheme(ctx, theme);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await navMoneyNeeds(page);
      await openGroup(page);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const relevant = axe.violations.filter(
        (v) => ['serious', 'critical'].includes(v.impact)
          && ['color-contrast', 'button-name', 'aria-command-name', 'link-name', 'aria-required-attr', 'label'].includes(v.id),
      );
      if (relevant.length === 0) pass(`G5: ${theme} — 0 serious/critical contrast/label nodes`);
      else {
        fail(`G5: ${theme} a11y`, `${relevant.reduce((s, v) => s + v.nodes.length, 0)} node(s)`);
        relevant.slice(0, 3).forEach((v) => v.nodes.slice(0, 2).forEach((n) => console.log(`    ${theme} ${v.id}: ${n.target}`)));
      }
    }
    await setTheme(ctx, 'light');

    await ctx.close();

    // ── G6: console errors ───────────────────────────────────────────────────
    console.log('\n── G6 — console errors');
    const isBenign = (t) => /fontshare/i.test(t) || /Failed to load resource/i.test(t);
    const errs = capture.consoleMessages.filter((m) => m.type === 'error' && !isBenign(m.text));
    if (errs.length === 0) pass('G6: 0 app console errors (font-CDN CORS noise filtered)');
    else { fail('G6: console errors', `${errs.length}`); console.log(formatCaptureReport(capture)); }

    // ════════════════════════ MOBILE (390×844) ══════════════════════════════
    console.log('\n── G3/G4 — mobile: header stacks, full label (the truncation fix)');
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mpage = await mctx.newPage();
    await setupBypassSession(mctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(mpage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PREVIEW_URL}/`);
    await navMoneyNeeds(mpage);
    {
      await openGroup(mpage);
      await addThrowawayRow(mpage);
      const m = await measureHeader(mpage);
      safeLog(`[M] found=${m.found} label=${JSON.stringify(m.label)} count=${JSON.stringify(m.count)} clipped=${m.labelClipped} trunc=${m.labelTruncateClass}`);

      if (m.found && m.label && m.count) {
        const dy = m.count.y - m.label.y;
        if (dy > 15) pass('G3: mobile header stacks — count sub-row below label', `Δy=${Math.round(dy)}`);
        else fail('G3: mobile stacking', `Δy=${Math.round(dy)} (expected >15)`);
      } else {
        fail('G3: mobile header measurement', `found=${m.found} label=${!!m.label} count=${!!m.count}`);
      }

      if (m.found && m.label && m.labelClipped === false && m.labelTruncateClass === false && m.labelText === GROUP_TEXT) {
        pass('G4: mobile label renders in FULL (no clip, no truncate, full text)', `"${m.labelText}"`);
      } else {
        fail('G4: mobile full label', `clipped=${m.labelClipped} trunc=${m.labelTruncateClass} text="${m.labelText}"`);
      }

      await deleteThrowawayRow(mpage);
    }
    await mctx.close();
  } finally {
    await browser.close();
  }

  console.log('\n══════════════════════════════════════');
  console.log('MONEY-NEEDS GROUP-HEADER SMOKE SUMMARY');
  console.log('══════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.l}${r.n ? ': ' + r.n : ''}`);
  console.log(`\n${passed}/${results.length} pass${failed ? ` (${failed} FAILED)` : ''}`);
  if (failed) process.exit(1);
})();

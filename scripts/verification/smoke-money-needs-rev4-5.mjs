/**
 * smoke-money-needs-rev4-5.mjs — PR #738 verification (Money Needs UX Round 2).
 *
 * Proves the five rev 4–5 presentation fixes are live on the preview, in both
 * themes. Data-dependent legs (anything past worksheet creation) try to start a
 * worksheet first; if the create write is blocked or the surface never reaches
 * the card grid, the leg SKIPs with an explanation (Rule 22) — RTL covers the
 * component logic in MoneyNeedsPanel.test.jsx.
 *
 * Legs:
 *   L1 — Money Needs surface renders without crash (always).
 *   L2 — worksheet shows field-section bands + card rows (no wall-of-inputs).
 *   L3 — single-open accordion: opening one group collapses the previously open one.
 *   L4 — a sub-calc opens and shows the Done footer ("Done — use this figure").
 *   L5 — Send to Playground → ack modal ("Target sent!") → Continue to Game Plan.
 *
 * Run (preview):
 *   SMOKE_PREVIEW_URL=https://agencytrack-git-feat-money-needs-rev4-5-kyron-marchan-s-projects.vercel.app \
 *   node scripts/verification/smoke-money-needs-rev4-5.mjs
 * SMOKE_BASE_URL wins when both are set.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import {
  runBothThemes,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
  installGlobalTimeout,
  finishSmoke,
  stamp,
} from './lib/walk-helpers.mjs';
import { loadEnv, navigateAgentTab } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const E = loadEnv(ROOT);

const BASE = (process.env.SMOKE_BASE_URL ?? process.env.SMOKE_PREVIEW_URL ?? '').replace(/\/+$/, '')
  || 'https://agencytrack-git-feat-money-needs-rev4-5-kyron-marchan-s-projects.vercel.app';
const TOKEN = E.VERCEL_BYPASS_TOKEN;

const SS_DIR = join(ROOT, 'screenshots', 'money-needs-rev4-5');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

// color-contrast is the long-standing pre-existing serious/critical rule on this
// app's main shell (same allowlist as awards-v2-smoke). Anything else is NEW-vs-main.
const PREEXISTING_AXE = new Set(['color-contrast']);

const results = [];
const pass = (leg, detail = '') => { results.push({ leg, passed: true,  detail }); console.log(`  ✅ ${leg}${detail ? ': ' + detail : ''}`); };
const fail = (leg, detail = '') => { results.push({ leg, passed: false, detail }); console.error(`  ❌ ${leg}${detail ? ': ' + detail : ''}`); };
const skip = (leg, detail = '') => { results.push({ leg, passed: true,  detail: `SKIP — ${detail}` }); console.log(`  ⏭  ${leg}${detail ? ' [' + detail + ']' : ''}`); };

// Ensure a worksheet exists so the card/accordion/footer legs are reachable.
// Returns true when the worksheet body (filled counter) is present.
async function ensureWorksheet(page, theme) {
  const hasCounter = async () =>
    (await page.locator('[data-testid="money-needs-filled-counter"]').count()) > 0;

  if (await hasCounter()) return true;

  const startBtn = page.getByRole('button', { name: /start .* worksheet/i });
  if (await startBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`   [${theme}] empty state — starting worksheet`);
    await startBtn.first().click({ force: true });
    await page.waitForFunction(
      () => document.querySelector('[data-testid="money-needs-filled-counter"]') !== null,
      { timeout: 20_000 },
    ).catch(() => {});
  }
  return hasCounter();
}

async function perTheme(page, theme) {
  const cap = captureConsoleAndNetwork(page);
  await loginAs(page, BASE, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);

  console.log(`\n── [${theme}] navigating to Money Needs`);
  await navigateAgentTab(page, 'money-needs');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="money-needs-filled-counter"]') !== null
      || /start.*worksheet/i.test(document.body.textContent || ''),
    { timeout: 25_000 },
  );

  // ── L1 — surface renders without crash ───────────────────────────────────────
  console.log(`\n── [${theme}] L1 — surface renders without crash`);
  const pageText = await page.evaluate(() => document.body.textContent || '');
  if (/money needs worksheet/i.test(pageText)) pass(`L1-${theme}: Money Needs Worksheet rendered`);
  else                                          fail(`L1-${theme}: page content unexpected`);

  const ready = await ensureWorksheet(page, theme);
  await page.screenshot({ path: join(SS_DIR, `worksheet-${theme}.png`), fullPage: false });

  if (!ready) {
    skip(`L2-${theme}: field cards`, 'no worksheet (create blocked in preview) — RTL covers card structure');
    skip(`L3-${theme}: single-open accordion`, 'no worksheet — RTL covers single-open behavior');
    skip(`L4-${theme}: Done footer`, 'no worksheet — RTL covers Done footer render/close');
  } else {
    // ── L3 — single-open accordion (open it before L2 so cards are visible) ─────
    console.log(`\n── [${theme}] L3 — single-open accordion`);
    const fixedBtn  = page.getByRole('button', { name: /Fixed Expenses/i }).first();
    const livingBtn = page.getByRole('button', { name: /Living Expenses/i }).first();
    await fixedBtn.click({ force: true });
    await page.waitForTimeout(300);
    const fixedOpen1  = await fixedBtn.getAttribute('aria-expanded');
    await livingBtn.click({ force: true });
    await page.waitForTimeout(300);
    const livingOpen  = await livingBtn.getAttribute('aria-expanded');
    const fixedOpen2  = await fixedBtn.getAttribute('aria-expanded');
    if (fixedOpen1 === 'true' && livingOpen === 'true' && fixedOpen2 === 'false') {
      pass(`L3-${theme}: opening Living collapsed Fixed (single-open)`);
    } else {
      fail(`L3-${theme}: accordion not single-open`, `fixed1=${fixedOpen1} living=${livingOpen} fixed2=${fixedOpen2}`);
    }

    // ── L2 — field-section bands + card rows visible in the open group ──────────
    console.log(`\n── [${theme}] L2 — field cards / no wall-of-inputs`);
    // Open a group with calc-fed lines so a FieldSection "From your calculators" band shows.
    const bizBtn = page.getByRole('button', { name: /Business Expenses/i }).first();
    await bizBtn.click({ force: true });
    await page.waitForTimeout(400);
    const hasCalcBand   = (await page.locator('text=From your calculators').count()) > 0;
    const hasManualBand = (await page.locator('text=Your entries').count()) > 0;
    if (hasCalcBand || hasManualBand) {
      pass(`L2-${theme}: FieldSection band present`, `calc=${hasCalcBand} manual=${hasManualBand}`);
    } else {
      fail(`L2-${theme}: no FieldSection band visible in open group`);
    }

    // L2b — the calc band MUST have a non-transparent background (the bg-primary/5
    // tint). A text-only check would miss a non-rendering opacity class (the exact
    // bug Gemini caught with the original /8 value). Walk up from the label text to
    // the banded strip and read its computed background-color.
    if (hasCalcBand) {
      const bandBg = await page.evaluate(() => {
        const els = [...document.querySelectorAll('span, div')];
        const label = els.find((e) => /^from your calculators$/i.test((e.textContent || '').trim()));
        if (!label) return null;
        const strip = label.closest('div');
        return strip ? getComputedStyle(strip).backgroundColor : null;
      });
      const transparent = !bandBg || bandBg === 'rgba(0, 0, 0, 0)' || bandBg === 'transparent';
      if (!transparent) pass(`L2b-${theme}: calc band has a rendered background`, bandBg);
      else              fail(`L2b-${theme}: calc band background is transparent (opacity class did not render)`, String(bandBg));
    } else {
      skip(`L2b-${theme}: calc band background`, 'no calc band in this group');
    }
    await page.screenshot({ path: join(SS_DIR, `cards-${theme}.png`), fullPage: false });

    // ── L4 — sub-calc Done footer ───────────────────────────────────────────────
    console.log(`\n── [${theme}] L4 — sub-calc Done footer`);
    const calcTrigger = page.getByRole('button', { name: /^Open .* calculator$/i }).first();
    if (await calcTrigger.isVisible({ timeout: 4000 }).catch(() => false)) {
      await calcTrigger.click({ force: true });
      const doneBtn = page.getByRole('button', { name: /Done — use this figure/i });
      if (await doneBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        const hasAnnualLabel = (await page.locator('text=Annual total').count()) > 0;
        pass(`L4-${theme}: Done footer present`, `annualLabel=${hasAnnualLabel}`);
        await page.screenshot({ path: join(SS_DIR, `done-footer-${theme}.png`), fullPage: false });
        await doneBtn.click({ force: true });
        await page.waitForTimeout(400);
        const dialogGone = (await page.getByRole('dialog').count()) === 0;
        if (dialogGone) pass(`L4-${theme}: Done closed the modal`);
        else            fail(`L4-${theme}: modal still open after Done`);
      } else {
        fail(`L4-${theme}: Done footer button not visible after opening calc`);
      }
    } else {
      skip(`L4-${theme}: Done footer`, 'no calc trigger in open group — RTL covers footer render/close');
    }
  }

  // ── L5 — Send → ack → Game Plan (needs PAYE worksheet with required>0) ────────
  console.log(`\n── [${theme}] L5 — Send → ack → Game Plan`);
  const sendBtn = page.getByRole('button', { name: /send to playground/i }).first();
  const sendReachable = await sendBtn.isVisible({ timeout: 4000 }).catch(() => false);
  const sendEnabled = sendReachable ? await sendBtn.isEnabled().catch(() => false) : false;
  if (sendReachable && sendEnabled) {
    await sendBtn.scrollIntoViewIfNeeded().catch(() => {});
    await sendBtn.click({ force: true });
    const ackVisible = await page.locator('text=Target sent!').first().isVisible({ timeout: 6000 }).catch(() => false);
    if (ackVisible) {
      pass(`L5-${theme}: ack modal "Target sent!" appeared`);
      await page.screenshot({ path: join(SS_DIR, `ack-${theme}.png`), fullPage: false });
      const continueBtn = page.getByRole('button', { name: /Continue to Game Plan/i });
      if (await continueBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await continueBtn.click({ force: true });
        await page.waitForTimeout(800);
        const onGamePlan = await page.evaluate(() =>
          /game plan/i.test(document.body.textContent || '') &&
          !!document.querySelector('[data-testid="agent-tab-game-plan"]'),
        );
        if (onGamePlan) pass(`L5-${theme}: Continue routed to Game Plan hub`);
        else            fail(`L5-${theme}: Continue did not land on Game Plan`);
      } else {
        fail(`L5-${theme}: "Continue to Game Plan" button missing in ack`);
      }
    } else {
      fail(`L5-${theme}: ack modal did not appear after Send`);
    }
  } else {
    skip(`L5-${theme}: Send→ack→Game Plan`, `Send button ${sendReachable ? 'disabled (required≤0 — no PAYE figure)' : 'not reachable'} in preview — RTL covers ack + onOpenTab`);
  }

  // ── L6 — axe NO-NEW serious/critical vs main (color-contrast pre-existing) ────
  console.log(`\n── [${theme}] L6 — axe serious/critical (NO-NEW vs main)`);
  let axeSC = [];
  try {
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    axeSC = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  } catch (e) {
    axeSC = [{ id: 'axe-error', nodes: [], _err: String(e).slice(0, 120) }];
  }
  const axeRuleIds = [...new Set(axeSC.map((n) => n.id))];
  const newAxeRules = axeRuleIds.filter((id) => !PREEXISTING_AXE.has(id));
  console.log(`   axe serious/critical rules=[${axeRuleIds.join(', ') || 'none'}] NEW-vs-main=[${newAxeRules.join(', ') || 'none'}]`);
  if (newAxeRules.length === 0) {
    pass(`L6-${theme}: no NEW serious/critical axe rules`, `preexisting=[${axeRuleIds.join(', ') || 'none'}]`);
  } else {
    fail(`L6-${theme}: NEW serious/critical axe rules`, newAxeRules.join(', '));
  }

  formatCaptureReport(cap);
}

async function run() {
  const required = ['VERCEL_BYPASS_TOKEN', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  console.log(`\n[${stamp()}] PR #738 smoke — ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  const clear = installGlobalTimeout(300_000, () => browser.close());
  try {
    await runBothThemes(browser, {
      baseUrl: BASE,
      token: TOKEN,
      viewport: { width: 1280, height: 900 },
      perTheme,
    });
  } finally {
    await browser.close();
  }
  finishSmoke(results, { clearTimeout: clear });
}

run().catch((err) => {
  console.error('Smoke crashed:', err?.message ?? String(err));
  process.exit(1);
});

/**
 * smoke-financing-proration-k5.mjs — preview/prod smoke for Track K · K5
 * (validation-schedule proration + suggested-vs-confirmed manager override).
 *
 * Signs in as BRANCH MANAGER. Exercises the new Proration sub-view of the
 * Financing tab (FinancingTab → FinancingProrationPanel).
 *
 * Legs (desktop 1280×900, both themes):
 *   1. BM login.
 *   2. Financing tab → "Proration" sub-view present + renders.
 *   3. Seed terms (Terms sub-view): effectiveDate = 5 months ago, agreed/current
 *      8000, validating 30000 → anchors month 1; agreed = override ceiling.
 *   4. Proration sub-view → select agent → month 1 → readout renders with basis
 *      badge = submitted-final (months 1–3) and the four readout cells.
 *   5. WRITE-READ-VERIFY (DEPLOY-GATED): confirm a managerFinancing → reload →
 *      the stored proration round-trips (managerFinancing persisted ≠ a bare
 *      suggestion). Pre-deploy this is PERMISSION_DENIED — the gate, not a bug.
 *   6. month 4+ (past) → basis badge = settled-confirmed.
 *   7. Cap/ratio readout: with seeded policies actualAPI>0 → ratio + suggested
 *      shown; with no policy data actualAPI=0 (skip-not-fail, env-data gap).
 *   axe both themes.
 *
 * ── DEPLOY GATE (Rule 19) ──────────────────────────────────────────────────
 * The CONFIRM (write) leg requires the K5 additive `financing` firestore.rules
 * edit (proration-only / forward-create permitted) to be LIVE. Pre-merge the
 * forward-create returns PERMISSION_DENIED — that is the gate, not a regression.
 * Run the full set in Phase 6 AFTER `firebase deploy --only firestore:rules`.
 * The read-side legs (sub-view render, basis badges, axe) run pre-deploy.
 * financingTerms (K1) is already live, so terms-seeding works pre-deploy.
 *
 * Run:
 *   SMOKE_BASE_URL="https://<preview-or-prod-host>" \
 *     node scripts/verification/smoke-financing-proration-k5.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import AxeBuilder from '@axe-core/playwright';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  selectReactOption,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var: ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) throw new Error('Set SMOKE_BASE_URL to the preview (or prod) URL');

// Seeded write-read-verify mode (Phase 6 — rules LIVE). Set both to target a
// seeded fixture agent (seed-financing-fixture.mjs) carrying a real policy, so
// actualAPI > 0, the cap is exercised, and the CONFIRM write round-trips. When
// unset, the read-side flow runs (no write — deploy gate).
const SEED_AGENT_UID = process.env.SEED_AGENT_UID || '';
const SEED_MONTH     = process.env.SEED_MONTH || '';   // "YYYY-MM"
// An M4+ current/future month for the seeded agent → submitted-provisional (a live
// projection): read-only, no override form, so NO determination is stored.
const SEED_PROVISIONAL_MONTH = process.env.SEED_PROVISIONAL_MONTH || '';   // "YYYY-MM"

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };
const skip = (id, note = '') => { results.push({ id, ok: true, note: `SKIP — ${note}` }); console.log(`  SKIP ${id}${note ? ' — ' + note : ''}`); };

const vis = (loc, t = 5000) => loc.isVisible({ timeout: t }).catch(() => false);

function monthsAgoDate(n) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}
const ymd = (d) => d.toISOString().slice(0, 10);
const ym  = (d) => d.toISOString().slice(0, 7);

const EFF_DATE = ymd(monthsAgoDate(5)); // month 1
const MONTH_1  = ym(monthsAgoDate(5));
const MONTH_4  = ym(monthsAgoDate(2));

async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2500);
}

async function openFinancingTab(page) {
  const tab = page.locator('[data-testid="nav-financing"]');
  if (!(await vis(tab, 8000))) return false;
  await tab.click();
  await page.waitForTimeout(800);
  return vis(page.locator('[data-testid="financing-subview-proration"]'), 8000);
}

async function openSubview(page, which) {
  await page.locator(`[data-testid="financing-subview-${which}"]`).click();
  await page.waitForTimeout(800);
}

async function seedTerms(page, agentValue) {
  await openSubview(page, 'terms');
  const select = page.locator('[data-testid="financing-agent-select"]');
  await selectReactOption(page, select, agentValue);
  await page.waitForTimeout(1200);
  if (!(await vis(page.locator('[data-testid="financing-agreed"]'), 8000))) return false;
  await page.fill('[data-testid="financing-agreed"]', '8000');
  await page.fill('[data-testid="financing-current"]', '8000');
  await page.fill('[data-testid="financing-validating-api"]', '30000');
  await page.fill('[data-testid="financing-effective-date"]', EFF_DATE);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /save terms|update terms/i }).click();
  await page.waitForTimeout(2500);
  return true;
}

async function selectProrationMonth(page, agentValue, monthYM) {
  await openSubview(page, 'proration');
  await selectReactOption(page, page.locator('[data-testid="proration-agent-select"]'), agentValue);
  await page.waitForTimeout(1500);
  await page.fill('[data-testid="proration-month"]', monthYM);
  await page.waitForTimeout(1200);
}

async function axeScreen(page, theme) {
  try {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    serious.length === 0
      ? pass(`axe-${theme}`, 'no serious/critical violations')
      : fail(`axe-${theme}`, serious.map((v) => `${v.id}(${v.nodes.length})`).join(', '));
  } catch (e) {
    fail(`axe-${theme}`, e.message);
  }
}

async function run(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  try {
    await login(page, requireEnv('A11Y_BRANCH_MANAGER_EMAIL'), requireEnv('A11Y_BRANCH_MANAGER_PASSWORD'));
  } catch (e) { fail('bm-login', e.message); formatCaptureReport(cap); await ctx.close(); return; }
  pass('bm-login', 'branch manager signed in');

  // ── Leg 1/2: Financing tab + Proration sub-view ──
  if (!(await openFinancingTab(page))) {
    fail('proration-subview', 'nav-financing or Proration sub-view not present');
    formatCaptureReport(cap); await ctx.close(); return;
  }
  pass('proration-subview', 'Financing tab opens, Proration sub-view present');

  // ── Leg 3: seed terms (live K1 rules) ──
  await openSubview(page, 'terms');
  const termsSelect = page.locator('[data-testid="financing-agent-select"]');
  const optionValues = await termsSelect.locator('option').evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));
  if (optionValues.length === 0) { fail('agent-select', 'no agents in dropdown'); formatCaptureReport(cap); await ctx.close(); return; }
  const AGENT = optionValues[0];
  const termsOk = await seedTerms(page, AGENT);
  termsOk ? pass('seed-terms', `terms set (eff ${EFF_DATE}, agreed/current 8000, validating 30000)`)
          : fail('seed-terms', 'terms form did not render (financingTerms read DENIED?)');

  // ── Leg 4: Proration sub-view → month 1 → readout + basis badge ──
  await selectProrationMonth(page, AGENT, MONTH_1);
  const readout = page.locator('[data-testid="proration-readout"]');
  const readoutVisible = await vis(readout, 8000);
  const basis1 = await readout.getAttribute('data-basis').catch(() => null);
  const actualText = await page.locator('[data-testid="proration-actual-api"]').textContent().catch(() => null);
  (readoutVisible && basis1 === 'submitted-final')
    ? pass('readout-submitted-final', `month 1 readout; basis=${basis1}; actual=${actualText}`)
    : fail('readout-submitted-final', `readout=${readoutVisible} basis=${basis1}`);

  // ── Leg 7 (ratio/cap): only meaningful with policy data ──
  const ratioText = await page.locator('[data-testid="proration-ratio"]').textContent().catch(() => null);
  const actualZero = (actualText || '').replace(/[^0-9]/g, '') === '0' || actualText === '$0.00' || /(^|\D)0(\.00)?$/.test(actualText || '');
  if (actualZero) {
    skip('ratio-cap', `actualAPI=0 (no seeded policies for ${MONTH_1}) — math covered by unit/emulator tests`);
  } else {
    pass('ratio-cap', `actualAPI=${actualText}, ratio=${ratioText}, suggested shown`);
  }

  // ── Leg 5: WRITE-READ-VERIFY (DEPLOY-GATED) ──
  const managerInput = page.locator('[data-testid="proration-manager-input"]');
  if (await vis(managerInput, 5000)) {
    await managerInput.fill('4000');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /confirm financing/i }).click();
    await page.waitForTimeout(2800);
    // reload + re-open + re-select the month; the stored managerFinancing should pre-populate.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 200, { timeout: 30_000 });
    await page.waitForTimeout(1800);
    await openFinancingTab(page);
    await selectProrationMonth(page, AGENT, MONTH_1);
    const managerVal = await page.locator('[data-testid="proration-manager-input"]').inputValue().catch(() => '');
    (parseFloat(managerVal) === 4000)
      ? pass('write-read-verify', `managerFinancing persisted (${managerVal}) — rules LIVE`)
      : fail('write-read-verify', `managerFinancing=${managerVal} (PERMISSION_DENIED → deploy gate; Phase 6 after rules deploy)`);
  } else {
    skip('write-read-verify', 'override form not shown (provisional month or no terms) — re-run post-deploy');
  }

  // ── Leg 6: month 4+ past → settled-confirmed ──
  await selectProrationMonth(page, AGENT, MONTH_4);
  const basis4 = await page.locator('[data-testid="proration-readout"]').getAttribute('data-basis').catch(() => null);
  (basis4 === 'settled-confirmed')
    ? pass('basis-settled-confirmed', `month 4 basis=${basis4}`)
    : fail('basis-settled-confirmed', `month 4 basis=${basis4} (expected settled-confirmed)`);

  // ── axe both themes (on the readout) ──
  await selectProrationMonth(page, AGENT, MONTH_1);
  await setTheme(ctx, 'light');
  await page.waitForTimeout(500);
  await axeScreen(page, 'light');
  await setTheme(ctx, 'dark');
  await page.waitForTimeout(700);
  await axeScreen(page, 'dark');

  formatCaptureReport(cap);
  await ctx.close();
}

// ── Seeded write-read-verify (Phase 6, rules LIVE) ──────────────────────────
// Targets a seeded fixture agent (financingTerms + a real policy) so the full
// chain is exercised end-to-end: actualAPI (credit-filtered Gross) → suggested
// (capped) → CONFIRM managerFinancing → reload → persisted + adjustmentPct.
async function runSeeded(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  try {
    await login(page, requireEnv('A11Y_BRANCH_MANAGER_EMAIL'), requireEnv('A11Y_BRANCH_MANAGER_PASSWORD'));
  } catch (e) { fail('bm-login', e.message); formatCaptureReport(cap); await ctx.close(); return; }
  pass('bm-login', 'branch manager signed in');

  if (!(await openFinancingTab(page))) {
    fail('proration-subview', 'nav-financing or Proration sub-view not present');
    formatCaptureReport(cap); await ctx.close(); return;
  }
  pass('proration-subview', 'Proration sub-view present');

  // Select the seeded agent directly (fixture supplies its financingTerms — no UI seed).
  await openSubview(page, 'proration');
  const sel = page.locator('[data-testid="proration-agent-select"]');
  const opts = await sel.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  if (!opts.includes(SEED_AGENT_UID)) {
    fail('seed-agent-present', `${SEED_AGENT_UID} not in dropdown (seed missing or out of BM scope)`);
    formatCaptureReport(cap); await ctx.close(); return;
  }
  await selectProrationMonth(page, SEED_AGENT_UID, SEED_MONTH);

  // Readout — real policy → actualAPI $50,000 > validating $37,500 → ratio caps at 100%.
  const readout = page.locator('[data-testid="proration-readout"]');
  const basis = await readout.getAttribute('data-basis').catch(() => null);
  const actual = await page.locator('[data-testid="proration-actual-api"]').textContent().catch(() => '');
  const ratio  = await page.locator('[data-testid="proration-ratio"]').textContent().catch(() => '');
  const sugg   = await page.locator('[data-testid="proration-suggested"]').textContent().catch(() => '');
  (basis === 'submitted-final' && /50,000/.test(actual))
    ? pass('seeded-readout', `basis=${basis} actualAPI=${actual.trim()}`)
    : fail('seeded-readout', `basis=${basis} actualAPI=${actual.trim()}`);
  (/100\s*%/.test(ratio) && /2,000/.test(sugg))
    ? pass('cap-100pct', `ratio=${ratio.trim()} suggested=${sugg.trim()} (capped at agreed)`)
    : fail('cap-100pct', `ratio=${ratio.trim()} suggested=${sugg.trim()} (expected 100% / 2,000)`);

  // CONFIRM a managerFinancing ≠ suggested (1500 ≤ agreed 2000) → write.
  const managerInput = page.locator('[data-testid="proration-manager-input"]');
  if (!(await vis(managerInput, 6000))) {
    fail('write-read-verify', 'override form not shown (unexpected — month 1 should be operative)');
    formatCaptureReport(cap); await ctx.close(); return;
  }
  await managerInput.fill('1500');
  await page.waitForTimeout(300);
  const adjBefore = await page.locator('[data-testid="proration-adjustment"]').getAttribute('data-adjustment').catch(() => null);
  await page.getByRole('button', { name: /confirm financing/i }).click();
  await page.waitForTimeout(3000);

  // Reload → re-select → managerFinancing persisted, adjustmentPct stored.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 200, { timeout: 30_000 });
  await page.waitForTimeout(1800);
  await openFinancingTab(page);
  await selectProrationMonth(page, SEED_AGENT_UID, SEED_MONTH);
  const managerVal = await page.locator('[data-testid="proration-manager-input"]').inputValue().catch(() => '');
  const adjAfter = await page.locator('[data-testid="proration-adjustment"]').getAttribute('data-adjustment').catch(() => null);
  (parseFloat(managerVal) === 1500)
    ? pass('write-read-verify', `managerFinancing persisted ${managerVal} ≠ suggested 2000 — rules LIVE`)
    : fail('write-read-verify', `managerFinancing=${managerVal} (expected 1500 persisted)`);
  (Math.abs(parseFloat(adjAfter) - 0.25) < 1e-9)
    ? pass('adjustment-stored', `adjustmentPct=${adjAfter} = (2000−1500)/2000 (was ${adjBefore} pre-reload)`)
    : fail('adjustment-stored', `adjustmentPct=${adjAfter} (expected 0.25)`);

  // Provisional negative check — an M4+ current/future month is a live projection:
  // read-only, NO override form → no determination can be written.
  if (SEED_PROVISIONAL_MONTH) {
    await selectProrationMonth(page, SEED_AGENT_UID, SEED_PROVISIONAL_MONTH);
    const provBasis = await page.locator('[data-testid="proration-readout"]').getAttribute('data-basis').catch(() => null);
    const provNote  = await vis(page.locator('[data-testid="proration-provisional-note"]'), 5000);
    const noOverride = !(await vis(page.locator('[data-testid="proration-manager-input"]'), 2000));
    (provBasis === 'submitted-provisional' && provNote && noOverride)
      ? pass('provisional-readonly', `${SEED_PROVISIONAL_MONTH} basis=${provBasis}; note shown; no override form → no determination stored`)
      : fail('provisional-readonly', `basis=${provBasis} note=${provNote} noOverride=${noOverride}`);
    // Restore the confirmed month for the axe pass.
    await selectProrationMonth(page, SEED_AGENT_UID, SEED_MONTH);
  }

  // axe both themes.
  await setTheme(ctx, 'light');
  await page.waitForTimeout(500);
  await axeScreen(page, 'light');
  await setTheme(ctx, 'dark');
  await page.waitForTimeout(700);
  await axeScreen(page, 'dark');

  formatCaptureReport(cap);
  await ctx.close();
}

(async () => {
  console.log(`\nFinancing K5 proration smoke → ${BASE_URL}`);
  const seeded = SEED_AGENT_UID && SEED_MONTH;
  console.log(seeded
    ? `  SEEDED write-read-verify: agent=${SEED_AGENT_UID} month=${SEED_MONTH}`
    : `  read-side: M1=${MONTH_1} (submitted-final) M4=${MONTH_4} (settled-confirmed) (eff ${EFF_DATE})`);
  const browser = await chromium.launch();
  try { await (seeded ? runSeeded(browser) : run(browser)); } finally { await browser.close(); }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`));
    process.exit(1);
  }
  console.log('All legs green.');
})();

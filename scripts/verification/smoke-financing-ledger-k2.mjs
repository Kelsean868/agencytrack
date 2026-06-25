/**
 * smoke-financing-ledger-k2.mjs — preview/prod smoke for Track K · K2
 * (financing monthly ledger + statement entry + basisBadge + 6× ceiling).
 *
 * Signs in as BRANCH MANAGER. Exercises the Monthly Ledger sub-view of the
 * Financing tab (FinancingTab → MonthlyStatementEntry).
 *
 * Legs (desktop 1280×900, both themes):
 *   1. BM login.
 *   2. Financing tab → "Monthly Ledger" sub-view renders.
 *   3. Seed terms (Terms sub-view): effectiveDate = 5 months ago, current 8000
 *      → the ledger anchors to month 1 and the 6× ceiling = 48000.
 *   4. Ledger sub-view → select agent → entry form renders.
 *   5. WRITE-READ-VERIFY (month 1, positive): save → reload → history row +
 *      basis badge = submitted-final (months 1–3) + ceiling meter = 48000.
 *   6. month 4 (positive) → basis badge = settled-confirmed (month 4+); the
 *      skipped months 2–3 raise the reconciliation flag.
 *   7. month 5 NEGATIVE runningBalance → surplus note + ceiling meter surplus.
 *
 * ── DEPLOY GATE (Rule 19) ──────────────────────────────────────────────────
 * The write/read legs require the additive `financing` firestore.rules block to
 * be LIVE. Pre-merge (rules not deployed) the writes return PERMISSION_DENIED —
 * that is the gate, not a regression. Run the full set in Phase 6 AFTER
 * `firebase deploy --only firestore:rules`. (financingTerms — K1 — is already live.)
 *
 * Run:
 *   SMOKE_BASE_URL="https://<preview-or-prod-host>" \
 *     node scripts/verification/smoke-financing-ledger-k2.mjs
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

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };

const vis = (loc, t = 5000) => loc.isVisible({ timeout: t }).catch(() => false);

// Month math — UTC month-1 anchors; ledger months are whole-calendar.
function monthsAgoDate(n) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}
const ymd = (d) => d.toISOString().slice(0, 10);
const ym  = (d) => d.toISOString().slice(0, 7);
const ymKey = (s) => s.replace('-', '_');

const EFF_DATE  = ymd(monthsAgoDate(5)); // month 1
const MONTH_1   = ym(monthsAgoDate(5));
const MONTH_4   = ym(monthsAgoDate(2));
const MONTH_5   = ym(monthsAgoDate(1));

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
  return vis(page.locator('[data-testid="financing-subview-ledger"]'), 8000);
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

async function enterMonth(page, monthYM, { paid, net, bonus, balance }) {
  await page.fill('[data-testid="financing-month"]', monthYM);
  await page.fill('[data-testid="financing-paid"]', String(paid));
  await page.fill('[data-testid="financing-net-commission"]', String(net));
  await page.fill('[data-testid="financing-bonus-offset"]', String(bonus));
  await page.fill('[data-testid="financing-running-balance"]', String(balance));
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /save statement|replace statement/i }).click();
  await page.waitForTimeout(2800);
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

  // ── Leg 1/2: Financing tab + Monthly Ledger sub-view ──
  if (!(await openFinancingTab(page))) {
    fail('financing-tab', 'nav-financing not present or FinancingTab did not render');
    formatCaptureReport(cap); await ctx.close(); return;
  }
  pass('financing-tab', 'Financing tab opens, sub-view toggle present');

  // ── Leg 3: seed terms (effectiveDate anchors month 1; current 8000 → ceiling 48000) ──
  // Find the first agent from the Terms dropdown.
  await openSubview(page, 'terms');
  const termsSelect = page.locator('[data-testid="financing-agent-select"]');
  const optionValues = await termsSelect.locator('option').evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));
  if (optionValues.length === 0) { fail('agent-select', 'no agents in dropdown'); formatCaptureReport(cap); await ctx.close(); return; }
  const AGENT = optionValues[0];
  const termsOk = await seedTerms(page, AGENT);
  termsOk ? pass('seed-terms', `terms set (eff ${EFF_DATE}, current 8000)`)
          : fail('seed-terms', 'terms form did not render (financingTerms read DENIED?)');

  // ── Leg 4: Ledger sub-view → select agent ──
  await openSubview(page, 'ledger');
  const ledgerSelect = page.locator('[data-testid="financing-ledger-agent-select"]');
  await selectReactOption(page, ledgerSelect, AGENT);
  await page.waitForTimeout(1500);
  const formVisible = await vis(page.locator('[data-testid="financing-month"]'), 8000);
  formVisible ? pass('ledger-form', 'statement entry form rendered')
              : fail('ledger-form', 'entry form did not render (terms missing or read DENIED — deploy gate)');

  if (formVisible) {
    // ── Leg 5: month 1 write-read-verify ──
    await enterMonth(page, MONTH_1, { paid: 4000, net: 6200, bonus: 0, balance: 8000 });
    // reload + re-open + re-select
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 200, { timeout: 30_000 });
    await page.waitForTimeout(1800);
    await openFinancingTab(page);
    await openSubview(page, 'ledger');
    await selectReactOption(page, page.locator('[data-testid="financing-ledger-agent-select"]'), AGENT);
    await page.waitForTimeout(1800);

    const row1 = page.locator(`[data-testid="financing-row-${ymKey(MONTH_1)}"]`);
    const row1Visible = await vis(row1, 8000);
    const basis1 = await row1.locator('[data-testid="financing-basis-badge"]').getAttribute('data-basis').catch(() => null);
    const ceiling = await page.locator('[data-testid="financing-ceiling-meter"]').getAttribute('data-ceiling').catch(() => null);
    (row1Visible && basis1 === 'submitted-final')
      ? pass('write-read-verify', `month 1 persisted; basis=${basis1}; ceiling=${ceiling}`)
      : fail('write-read-verify', `row=${row1Visible} basis=${basis1} ceiling=${ceiling} (PERMISSION_DENIED → deploy gate?)`);
    (ceiling === '48000')
      ? pass('ceiling-6x-current', 'ceiling = 6 × current (48000)')
      : fail('ceiling-6x-current', `ceiling=${ceiling} (expected 48000 = 6 × 8000 current)`);

    // ── Leg 6: month 4 → settled-confirmed + gap flag (months 2–3 skipped) ──
    await enterMonth(page, MONTH_4, { paid: 4000, net: 6200, bonus: 0, balance: 22400 });
    await page.waitForTimeout(800);
    const row4 = page.locator(`[data-testid="financing-row-${ymKey(MONTH_4)}"]`);
    const basis4 = await row4.locator('[data-testid="financing-basis-badge"]').getAttribute('data-basis').catch(() => null);
    (basis4 === 'settled-confirmed')
      ? pass('basis-confirmed', `month 4 basis=${basis4}`)
      : fail('basis-confirmed', `month 4 basis=${basis4} (expected settled-confirmed)`);

    const skipFlag = page.locator('[data-testid="financing-skipped-flag"]');
    (await vis(skipFlag, 5000))
      ? pass('skipped-flag', `gap flagged (count=${await skipFlag.getAttribute('data-gap-count')})`)
      : fail('skipped-flag', 'skipped-month flag did not appear for the 2-month gap');

    // ── Leg 7: month 5 NEGATIVE runningBalance → surplus ──
    await enterMonth(page, MONTH_5, { paid: 0, net: 6200, bonus: 0, balance: -1500 });
    await page.waitForTimeout(800);
    const meter = page.locator('[data-testid="financing-ceiling-meter"]');
    const surplus = await meter.getAttribute('data-surplus').catch(() => null);
    const surplusNote = await vis(page.locator('[data-testid="financing-surplus-note"]'), 4000);
    (surplus === 'true' && surplusNote)
      ? pass('negative-surplus', 'negative balance → surplus band + note')
      : fail('negative-surplus', `data-surplus=${surplus} note=${surplusNote}`);
  }

  // ── axe both themes ──
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
  console.log(`\nFinancing K2 ledger smoke → ${BASE_URL}`);
  console.log(`  months: M1=${MONTH_1} M4=${MONTH_4} M5=${MONTH_5} (eff ${EFF_DATE})`);
  const browser = await chromium.launch();
  try { await run(browser); } finally { await browser.close(); }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`));
    process.exit(1);
  }
  console.log('All legs green.');
})();

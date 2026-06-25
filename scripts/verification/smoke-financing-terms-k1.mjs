/**
 * smoke-financing-terms-k1.mjs — preview/prod smoke for Track K · K1
 * (financingTerms collection + manager FinancingTermsSetup + status machine).
 *
 * Signs in as BRANCH MANAGER (financing setup is BM-and-up; UM excluded).
 *
 * Legs (desktop 1280×900, both themes):
 *   1. nav-financing renders + opens the Financing tab (BM sidebar).
 *   2. Agent select → terms form renders.
 *   3. WRITE-READ-VERIFY: set terms (agreed 8000 / current 8000 / validatingAPI
 *      30000 / effectiveDate today) → Save → hard-reload → assert the values
 *      round-trip + a status badge renders.
 *   4. current > agreed → inline validation fires + Save disabled (no write).
 *   5. TRANSITION: if a forward transition is offered for the current status,
 *      click it + confirm → reload → assert the badge advanced.
 *   6. axe (serious/critical) on the Financing screen, light + dark.
 *
 * ── DEPLOY GATE (Rule 19) ──────────────────────────────────────────────────
 * Legs 3 + 5 (and the read in leg 2) require the additive `financingTerms`
 * firestore.rules block to be LIVE on the project the target host talks to.
 * Pre-merge (rules not yet deployed) the read/write legs return PERMISSION_DENIED
 * — that is the gate, not a regression. Run the full write-read-verify in Phase 6
 * AFTER `firebase deploy --only firestore:rules`. Legs 1/2(render)/4/6 run pre-merge.
 *
 * Run:
 *   SMOKE_BASE_URL="https://<preview-or-prod-host>" \
 *     node scripts/verification/smoke-financing-terms-k1.mjs
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

// ── env loading ──────────────────────────────────────────────────────────────
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

function todayISO() {
  // TT-local calendar day as YYYY-MM-DD (matches getTodayTT in the app).
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date());
}

async function openFinancingTab(page) {
  const tab = page.locator('[data-testid="nav-financing"]');
  if (!(await vis(tab, 8000))) return false;
  await tab.click();
  await page.waitForTimeout(1000);
  return vis(page.locator('[data-testid="financing-agent-select"]'), 8000);
}

async function axeScreen(page, theme) {
  try {
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
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

  // ── Leg 1: nav + open Financing ──
  if (!(await openFinancingTab(page))) {
    fail('financing-tab', 'nav-financing not present or Financing screen did not render');
    formatCaptureReport(cap); await ctx.close(); return;
  }
  pass('financing-tab', 'Financing tab opens, agent select rendered');

  // ── Leg 2: select first agent ──
  const select = page.locator('[data-testid="financing-agent-select"]');
  const optionValues = await select.locator('option').evaluateAll(
    (opts) => opts.map((o) => o.value).filter(Boolean),
  );
  if (optionValues.length === 0) { fail('agent-select', 'no agents in dropdown'); formatCaptureReport(cap); await ctx.close(); return; }
  await selectReactOption(page, select, optionValues[0]);
  await page.waitForTimeout(1500);
  const formVisible = await vis(page.locator('[data-testid="financing-agreed"]'), 8000);
  formVisible ? pass('agent-select', 'terms form rendered for selected agent')
              : fail('agent-select', 'terms form did not render after agent select (read may be DENIED — deploy gate)');

  // ── Leg 4: current > agreed validation (no write — safe pre-deploy) ──
  if (formVisible) {
    await page.fill('[data-testid="financing-agreed"]', '8000');
    await page.fill('[data-testid="financing-current"]', '9000');
    await page.waitForTimeout(400);
    const errVisible = await vis(page.locator('[data-testid="financing-current-over-agreed"]'), 3000);
    const saveBtn = page.getByRole('button', { name: /save terms|update terms/i });
    const saveDisabled = await saveBtn.isDisabled().catch(() => false);
    (errVisible && saveDisabled)
      ? pass('current-over-agreed', 'inline error shown + Save disabled')
      : fail('current-over-agreed', `err=${errVisible} saveDisabled=${saveDisabled}`);
  }

  // ── Leg 3: WRITE-READ-VERIFY (DEPLOY-GATED — rules must be live) ──
  if (formVisible) {
    await page.fill('[data-testid="financing-agreed"]', '8000');
    await page.fill('[data-testid="financing-current"]', '8000');
    await page.fill('[data-testid="financing-validating-api"]', '30000');
    await page.fill('[data-testid="financing-effective-date"]', todayISO());
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /save terms|update terms/i }).click();
    await page.waitForTimeout(3000);

    // hard reload + re-open + re-select
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 200, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    await openFinancingTab(page);
    await selectReactOption(page, page.locator('[data-testid="financing-agent-select"]'), optionValues[0]);
    await page.waitForTimeout(1800);

    const agreedVal = await page.locator('[data-testid="financing-agreed"]').inputValue().catch(() => '');
    const badge = page.locator('[data-testid="financing-status-badge"]').first();
    const badgeStatus = await badge.getAttribute('data-status').catch(() => null);
    (parseFloat(agreedVal) === 8000 && badgeStatus)
      ? pass('write-read-verify', `terms persisted (agreed=${agreedVal}); status badge=${badgeStatus}`)
      : fail('write-read-verify', `agreed=${agreedVal} badge=${badgeStatus} (PERMISSION_DENIED → deploy gate: financingTerms rules not live)`);

    // ── Leg 5: transition (if a forward step is offered) ──
    const nextBtns = page.locator('[data-testid^="financing-transition-"]:not([data-testid="financing-transition-confirm"])');
    const nextCount = await nextBtns.count().catch(() => 0);
    if (nextCount > 0 && badgeStatus) {
      await nextBtns.first().click();
      await page.waitForTimeout(400);
      const confirm = page.locator('[data-testid="financing-transition-confirm"]');
      if (await vis(confirm, 3000)) {
        await confirm.click();
        await page.waitForTimeout(2500);
        const newStatus = await badge.getAttribute('data-status').catch(() => null);
        (newStatus && newStatus !== badgeStatus)
          ? pass('transition', `status advanced ${badgeStatus} → ${newStatus}`)
          : fail('transition', `status did not advance (was ${badgeStatus}, now ${newStatus})`);
      } else {
        fail('transition', 'confirm control did not appear');
      }
    } else {
      pass('transition', `no forward transition offered (terminal or read-gated; status=${badgeStatus})`);
    }
  }

  // ── Leg 6: axe both themes ──
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
  console.log(`\nFinancing K1 smoke → ${BASE_URL}`);
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

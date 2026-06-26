/**
 * smoke-financing-recon-gapfill-k6.mjs — Phase 6 seeded write-read-verify for the
 * Track K · K6 reconciliation gap-fill guard (no silent assume-zero).
 *
 * Signs in as BRANCH MANAGER, drives the Reconciliation sub-view for the seeded agent
 * `smoke_k6_gap` (seed-financing-recon-gap.mjs --apply), and verifies — against the
 * DEPLOYED financingReconciliation rules — the full gap-fill → reconcile flow with
 * value-level (not non-null) assertions read back from Firestore via the Admin SDK.
 *
 * Legs (desktop 1280×900):
 *   1. BM login.
 *   2. Financing tab → Reconciliation sub-view → select the seeded agent.
 *   3. Gap detected: recon-gaps card + recon-gap-2025_06 surfaced.
 *   4. Settle gated: "Start garnish" disabled while the gap is unconfirmed (recon-gated-owing).
 *   5. Pre-fill: gap-2025_06-rb == 5000 (carry from 2025_05), gap-2025_06-fp == 0.
 *   6. axe light + dark (gap-fill surface).
 *   7. Confirm the gap inline → Admin read-back: financing/{uid}_2025_06 runningBalance==5000,
 *      financingPaid==0, source=='reconciliation_gap_fill'.
 *   8. Settle re-enables (gap cleared).
 *   9. Reconcile → Admin read-back: financingReconciliation/{uid}_2025 reconciledPosition==9000,
 *      outcome=='owing', closingBalance==12000, waiverApplied==3000, totalFinancingDrawn==11000.
 *
 * Requires the seed applied + the K6 rules LIVE (Rule 23/24 gate). Run:
 *   SMOKE_BASE_URL="https://<k6-preview-host>" \
 *     node scripts/verification/smoke-financing-recon-gapfill-k6.mjs
 */
import { chromium } from 'playwright';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import AxeBuilder from '@axe-core/playwright';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  selectReactOption,
} from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadEnv() {
  try {
    const src = readFileSync(resolve(__dirname, '../../.env.local'), 'utf8');
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
if (!BASE_URL) throw new Error('Set SMOKE_BASE_URL to the K6 preview URL');

const TENANT_ID = process.env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const UID = 'smoke_k6_gap';
const GAP = '2025_06';
const YEAR = '2025';

// ── Admin SDK (read-backs) ──
const keyPath = resolve(__dirname, '../../functions/service-account-key.json');
if (!existsSync(keyPath)) throw new Error('functions/service-account-key.json not found');
const admin = require(resolve(__dirname, '../../functions/node_modules/firebase-admin'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };
const vis = (loc, t = 6000) => loc.isVisible({ timeout: t }).catch(() => false);

async function readDoc(path, { retries = 8, delayMs = 1500, until } = {}) {
  for (let i = 0; i < retries; i++) {
    const snap = await db.doc(path).get();
    const data = snap.exists ? snap.data() : null;
    if (!until || (data && until(data))) return data;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  const snap = await db.doc(path).get();
  return snap.exists ? snap.data() : null;
}

async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 200, { timeout: 30_000 });
  await page.waitForTimeout(2500);
}

async function openReconciliation(page) {
  const tab = page.locator('[data-testid="nav-financing"]');
  if (!(await vis(tab, 8000))) return false;
  await tab.click();
  await page.waitForTimeout(800);
  const sub = page.locator('[data-testid="financing-subview-reconciliation"]');
  if (!(await vis(sub, 8000))) return false;
  await sub.click();
  await page.waitForTimeout(800);
  return true;
}

async function axeScreen(page, theme) {
  try {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    serious.length === 0
      ? pass(`axe-${theme}`, 'no serious/critical violations')
      : fail(`axe-${theme}`, serious.map((v) => `${v.id}(${v.nodes.length})`).join(', '));
  } catch (e) { fail(`axe-${theme}`, e.message); }
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

  // Leg 2 — Reconciliation sub-view + select seeded agent.
  if (!(await openReconciliation(page))) { fail('recon-subview', 'nav-financing or Reconciliation sub-view absent'); formatCaptureReport(cap); await ctx.close(); return; }
  const sel = page.locator('[data-testid="recon-agent-select"]');
  const opts = await sel.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  if (!opts.includes(UID)) { fail('seed-agent-present', `${UID} not in dropdown (seed missing / out of BM scope)`); formatCaptureReport(cap); await ctx.close(); return; }
  await selectReactOption(page, sel, UID);
  await page.waitForTimeout(2000);
  pass('recon-subview', 'Reconciliation sub-view; seeded agent selected');

  // Leg 3 — gap detected.
  const gapsCard = page.locator('[data-testid="recon-gaps"]');
  const gapRow = page.locator(`[data-testid="recon-gap-${GAP}"]`);
  (await vis(gapsCard, 8000) && await vis(gapRow, 6000))
    ? pass('gap-detected', `recon-gaps + recon-gap-${GAP} surfaced`)
    : fail('gap-detected', `recon-gaps=${await vis(gapsCard, 1000)} gap-${GAP}=${await vis(gapRow, 1000)}`);

  // Leg 4 — settle gated while gap unconfirmed.
  const settle = page.getByRole('button', { name: /start garnish/i });
  const gatedNote = page.locator('[data-testid="recon-gated-owing"]');
  const settleDisabled = await settle.isDisabled().catch(() => null);
  (settleDisabled === true && await vis(gatedNote, 4000))
    ? pass('settle-gated', 'Start-garnish disabled + gated note while gap unconfirmed')
    : fail('settle-gated', `disabled=${settleDisabled} gatedNote=${await vis(gatedNote, 1000)}`);

  // Leg 5 — carry-forward pre-fill.
  const rbVal = await page.locator(`[data-testid="gap-${GAP}-rb"]`).inputValue().catch(() => '');
  const fpVal = await page.locator(`[data-testid="gap-${GAP}-fp"]`).inputValue().catch(() => '');
  (parseFloat(rbVal) === 5000 && parseFloat(fpVal) === 0)
    ? pass('prefill-carryforward', `runningBalance=${rbVal} (carry from 2025_05), financingPaid=${fpVal}`)
    : fail('prefill-carryforward', `rb=${rbVal} (expected 5000) fp=${fpVal} (expected 0)`);

  // Leg 6 — axe both themes on the gap-fill surface.
  await setTheme(ctx, 'light'); await page.waitForTimeout(400); await axeScreen(page, 'light');
  await setTheme(ctx, 'dark'); await page.waitForTimeout(600); await axeScreen(page, 'dark');
  await setTheme(ctx, 'light'); await page.waitForTimeout(400);

  // Leg 7 — confirm the gap; read the persisted statement back from Firestore.
  await page.locator(`[data-testid="recon-gap-${GAP}"]`).getByRole('button', { name: /confirm month/i }).click();
  await page.waitForTimeout(1500);
  const stmt = await readDoc(`tenants/${TENANT_ID}/financing/${UID}_${GAP}`, { until: (d) => d.source === 'reconciliation_gap_fill' });
  (stmt && stmt.source === 'reconciliation_gap_fill' && Number(stmt.runningBalance) === 5000 && Number(stmt.financingPaid) === 0)
    ? pass('gap-statement-persisted', `financing/${UID}_${GAP}: rb=${stmt.runningBalance} fp=${stmt.financingPaid} source=${stmt.source}`)
    : fail('gap-statement-persisted', `doc=${JSON.stringify(stmt)}`);

  // Leg 8 — settle re-enables (gap cleared after reload).
  await page.waitForTimeout(2500);
  const gapGone = !(await vis(page.locator('[data-testid="recon-gaps"]'), 3000));
  const settleNow = page.getByRole('button', { name: /start garnish/i });
  const settleEnabled = await settleNow.isEnabled().catch(() => null);
  (gapGone && settleEnabled === true)
    ? pass('settle-reenabled', 'gap card cleared; Start-garnish enabled over the complete ledger')
    : fail('settle-reenabled', `gapGone=${gapGone} settleEnabled=${settleEnabled}`);

  // Leg 9 — reconcile; read the persisted record back from Firestore (value-level).
  await settleNow.click();
  await page.waitForTimeout(2000);
  const rec = await readDoc(`tenants/${TENANT_ID}/financingReconciliation/${UID}_${YEAR}`, { until: (d) => d.outcome != null });
  const ok = rec
    && rec.outcome === 'owing'
    && Number(rec.reconciledPosition) === 9000
    && Number(rec.closingBalance) === 12000
    && Number(rec.waiverApplied) === 3000
    && Number(rec.totalFinancingDrawn) === 11000;
  ok
    ? pass('reconcile-record-persisted', `reconciledPosition=${rec.reconciledPosition} owing; closing=${rec.closingBalance} waiver=${rec.waiverApplied} drawn=${rec.totalFinancingDrawn}`)
    : fail('reconcile-record-persisted', `record=${JSON.stringify(rec)}`);

  formatCaptureReport(cap);
  await ctx.close();
}

(async () => {
  console.log(`\nK6 reconciliation gap-fill smoke → ${BASE_URL}`);
  console.log(`  seeded agent=${UID} gap=${GAP} (expect reconciledPosition=9000 OWING)`);
  const browser = await chromium.launch();
  try { await run(browser); } finally { await browser.close(); }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
  if (failed.length) { failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`)); process.exit(1); }
  console.log('All legs green.');
})();

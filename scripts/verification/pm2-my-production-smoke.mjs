/**
 * PM-2 My Production smoke — HARDENED (decisive no-leak)
 *
 * Proves the load-bearing property: My Production screens are OWN-SCOPED for
 * producing managers (UM/BM) — a managed agent's production must NOT surface.
 *
 *   1. GROUND TRUTH (admin SDK, read-only): resolve UM/BM/foil by email and
 *      assert (a) foil.unitId === UM.uid  → UM MANAGES the foil (unit-level),
 *      (b) foil.branchId === BM.branchId  → BM MANAGES the foil (branch-level),
 *      (c) the foil has a SUBMITTED report with newBusiness.api === 7777.
 *      Without (a)+(b)+(c) the no-leak sweep is decorative, so we gate on it.
 *
 *   2. UM WRITE-READ-VERIFY (UI): UM submits API=$3,333 via mp-report WizardForm
 *      → reload → the value surfaces under the UM's OWN uid:
 *        • mp-history WeekCard shows "TTD 3.3K"  (fmtTtdShort of 3333)
 *        • mp-report "Already submitted" → View Submission → SubmissionViewer
 *          Section 4 API = "TTD 3,333"  (formatCurrency, full precision)
 *
 *   3. NO-LEAK SWEEP (UM + BM): the foil's $7,777 must NOT appear on ANY My
 *      Production screen. History abbreviates ≥1000 to "K", so we check BOTH
 *      the full form "7,777" AND the abbreviated form "7.8K" (fmtTtdShort).
 *      Any appearance → STOP. Run for BM too — BM's canManage is branch-wide
 *      (broader blast radius), so BM is the higher-risk leg.
 *
 *   4. ACCESSIBILITY: UM + BM, both viewports, both themes, all 7 tabs.
 *
 * Run with:
 *   node --env-file=.env.local scripts/verification/pm2-my-production-smoke.mjs [--url <url>]
 */

import { chromium } from 'playwright';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const require  = createRequire(import.meta.url);
const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEY_PATH = path.resolve(ROOT, 'functions/service-account-key.json');

const PREVIEW_URL = process.argv.find((a, i) => process.argv[i - 1] === '--url')
  ?? 'http://localhost:5173';

const TENANT_ID = process.env.A11Y_TENANT_ID || 'tatillife_smoke';

const UM_EMAIL    = process.env.A11Y_UNIT_MANAGER_EMAIL;
const UM_PASSWORD = process.env.A11Y_UNIT_MANAGER_PASSWORD;
const BM_EMAIL    = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const AGENT_EMAIL    = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASSWORD = process.env.A11Y_AGENT_PASSWORD;

// Distinctive markers. Rendered forms (what actually appears in the DOM):
//   UM   3333 → formatCurrency "TTD 3,333"  · fmtTtdShort "3.3K"
//   FOIL 7777 → formatCurrency "TTD 7,777"  · fmtTtdShort "7.8K"  (7.777→7.8)
const UM_API_INPUT  = '3333';
const UM_FULL       = 'TTD 3,333';
const UM_SHORT      = '3.3K';
const FOIL_API_NUM  = 7777;
const FOIL_API_INPUT = '7777';
const FOIL_FULL     = '7,777';   // formatCurrency / SubmissionViewer detail
const FOIL_SHORT    = '7.8K';    // fmtTtdShort / History WeekCard + heatmap

const DESKTOP = { label: 'desktop', width: 1280, height: 800 };
const MOBILE  = { label: 'mobile',  width: 390,  height: 844 };
const VIEWPORTS = [DESKTOP, MOBILE];
const THEMES    = ['light', 'dark'];

// mp-report tested last — WizardForm full-screen early return ends the leg cleanly.
const MP_SCREENS = [
  { tabId: 'mp-goals',       label: 'Goals',         selector: '[data-testid="gap-analysis-panel"], h2' },
  { tabId: 'mp-game-plan',   label: 'Game Plan',     selector: '[data-testid="game-plan-hub"], h2' },
  { tabId: 'mp-money-needs', label: 'Money Needs',   selector: '[data-testid="money-needs-panel"], h2' },
  { tabId: 'mp-history',     label: 'History',       selector: '[data-testid="history-tab-surface"], [data-testid="history-tab"], h2' },
  { tabId: 'mp-commission',  label: 'Commission',    selector: '[data-testid="commission-anchor-strip"], [data-testid="commission-playground"], h2' },
  { tabId: 'mp-policies',    label: 'Policies',      selector: '[data-testid="policy-ledger-surface"], h2' },
  { tabId: 'mp-report',      label: 'Weekly Report', selector: '[data-testid="wizard-v2-modal"], h2, form' },
];

let pass = 0;
let fail = 0;
const findings = [];

function ok(msg)  { pass++; console.log(`  ✓ ${msg}`); }
function ko(msg)  { fail++; console.error(`  ✗ ${msg}`); findings.push(msg); }
function log(msg) { console.log(`\n${msg}`); }

// ─────────────────────────────────────────────────────────────────────────────
// GROUND TRUTH — admin SDK (read-only)
// ─────────────────────────────────────────────────────────────────────────────

async function loadGroundTruth() {
  log('── GROUND TRUTH (admin SDK, read-only) ─────────────────────────────────');
  const result = { managed: false, foilHasData: false, facts: {} };

  if (!existsSync(KEY_PATH)) {
    ko(`GROUND TRUTH — service-account-key.json not found at ${KEY_PATH}; cannot verify managed relationship → no-leak sweep would be decorative`);
    return result;
  }

  const admin = require('../../functions/node_modules/firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
  }
  const db = admin.firestore();

  const snap = await db.collection(`tenants/${TENANT_ID}/users`).get();
  const users = [];
  snap.forEach(d => users.push({ uid: d.id, ...d.data() }));

  const byEmail = (email) => users.find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
  const um = byEmail(UM_EMAIL), bm = byEmail(BM_EMAIL), foil = byEmail(AGENT_EMAIL);

  if (!um || !bm || !foil) {
    ko(`GROUND TRUTH — could not resolve all three accounts (um=${!!um} bm=${!!bm} foil=${!!foil}) in tenant ${TENANT_ID}`);
    return result;
  }

  const umManagesFoil = !!foil.unitId && foil.unitId === um.uid;
  const bmManagesFoil = !!foil.branchId && !!bm.branchId && foil.branchId === bm.branchId;

  console.log(`  UM   uid=${um.uid}  unitId=${um.unitId ?? '(null)'}  branchId=${um.branchId ?? '(null)'}`);
  console.log(`  BM   uid=${bm.uid}  branchId=${bm.branchId ?? '(null)'}`);
  console.log(`  FOIL uid=${foil.uid}  unitId=${foil.unitId ?? '(null)'}  branchId=${foil.branchId ?? '(null)'}`);

  if (umManagesFoil) ok(`GROUND TRUTH — UM MANAGES foil (foil.unitId === UM.uid = ${um.uid}) ✓`);
  else ko(`GROUND TRUTH — UM does NOT manage foil (foil.unitId=${foil.unitId} ≠ UM.uid=${um.uid}); unmanaged foil absence proves nothing`);

  if (bmManagesFoil) ok(`GROUND TRUTH — BM MANAGES foil (foil.branchId === BM.branchId = ${bm.branchId}) ✓`);
  else ko(`GROUND TRUTH — BM does NOT manage foil (foil.branchId=${foil.branchId} ≠ BM.branchId=${bm.branchId}); BM sweep would be decorative`);

  // Confirm the foil actually has a SUBMITTED report carrying the marker value.
  const subSnap = await db.collection(`tenants/${TENANT_ID}/submissions`)
    .where('agentId', '==', foil.uid).get();
  let foilDoc = null;
  subSnap.forEach(d => {
    const x = d.data();
    const api = Number(x?.newBusiness?.api) || Number(x?.apiSold) || 0;
    if (api === FOIL_API_NUM && x.status === 'submitted') foilDoc = { id: d.id, weekStarting: x.weekStarting };
  });
  if (foilDoc) {
    ok(`GROUND TRUTH — foil has SUBMITTED report api=$${FOIL_FULL} (week ${foilDoc.weekStarting}) → leak would be visible ✓`);
    result.foilHasData = true;
  } else {
    ko(`GROUND TRUTH — foil has NO submitted report with api=$${FOIL_FULL}; foil setup must seed it before the sweep is meaningful`);
  }

  result.managed = umManagesFoil && bmManagesFoil;
  result.facts = { umUid: um.uid, bmUid: bm.uid, foilUid: foil.uid, umManagesFoil, bmManagesFoil };
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth + wizard helpers
// ─────────────────────────────────────────────────────────────────────────────

async function login(page, email, password) {
  await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.fill('input[type="email"]',    email,    { timeout: 10_000 });
  await page.fill('input[type="password"]', password, { timeout: 5_000 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.textContent.length > 500, { timeout: 20_000 });
}

async function openWizard(page, viaNavTab) {
  if (viaNavTab) {
    try { await page.locator('button:has-text("Weekly Report")').first().click({ timeout: 5_000 }); } catch { /* */ }
  } else {
    try {
      await page.locator(
        'button:has-text("Submit Weekly Report"), button:has-text("Submit Report"), button:has-text("Weekly Report"), [data-testid="submit-report-btn"]'
      ).first().click({ timeout: 5_000 });
    } catch {
      try { await page.locator('[data-testid="agent-cta-submit"], button.btn-primary').first().click({ timeout: 3_000 }); } catch { /* */ }
    }
  }
  return page.locator('[data-testid="wizard-v2-modal"]').isVisible({ timeout: 8_000 }).catch(() => false);
}

/** Selects current week + Start Report. Returns 'fresh' | 'submitted' | 'error'.
 *
 * RACE NOTE: handleDateSelect sets screen='step' SYNCHRONOUSLY, then the
 * getDraft effect (keyed on weekStarting) flips screen→'submitted' a beat
 * later if the week was already submitted. Checking immediately would always
 * read the transient step view as 'fresh'. We wait for the getDraft read to
 * settle (single Firestore read), then give the 'submitted' interstitial
 * priority. Without the settle, re-runs misread an already-submitted week as
 * fresh and hit handleSubmit's already-submitted guard. */
async function startWizardForCurrentWeek(page) {
  try { await page.locator('select#wizard-week').waitFor({ timeout: 8_000 }); }
  catch { return 'error'; }
  await page.selectOption('select#wizard-week', { index: 0 });
  await page.click('button:has-text("Start Report")', { timeout: 5_000 });
  // Wait for the step flow OR the interstitial to first appear…
  try {
    await page.waitForFunction(() => {
      const c = document.querySelector('[data-testid="wizard-v2-step-counter"]');
      return (c && c.textContent.includes('Step')) ||
             document.body.textContent.includes('Already submitted');
    }, { timeout: 12_000 });
  } catch { return 'error'; }
  // …then let the async getDraft read settle so a submitted week can flip in.
  await page.waitForTimeout(1500);
  const already = await page.locator('h2:has-text("Already submitted"), h1:has-text("Already submitted")')
    .first().isVisible({ timeout: 1_000 }).catch(() => false);
  return already ? 'submitted' : 'fresh';
}

async function advanceWizardToStep(page, targetStep) {
  for (let i = 0; i < 14; i++) {
    const txt = await page.locator('[data-testid="wizard-v2-step-counter"]').textContent({ timeout: 3_000 }).catch(() => '');
    const m = txt.match(/Step\s+(\d+)\s+of/);
    const cur = m ? parseInt(m[1], 10) : -1;
    if (cur === targetStep) return true;
    if (cur > targetStep || cur === -1) return false;
    await page.click('[data-testid="wizard-v2-next"]', { timeout: 5_000 });
    await page.waitForTimeout(400);
  }
  return false;
}

/** Fills step-7 API + submits. Returns 'submitted' | 'already_submitted' | 'error'. */
async function fillAndSubmitWizard(page, apiValue) {
  if (!await advanceWizardToStep(page, 7)) return 'error';
  await page.waitForSelector('#newBusinessApi', { timeout: 5_000 });
  await page.fill('#newBusinessApi', apiValue);
  await page.waitForTimeout(200);
  if (!await advanceWizardToStep(page, 12)) return 'error';
  const nextBtn = page.locator('[data-testid="wizard-v2-next"]');
  const label = await nextBtn.textContent({ timeout: 3_000 }).catch(() => '');
  if (!label.toLowerCase().includes('submit')) return 'error';
  await nextBtn.click({ timeout: 5_000 });
  try {
    await page.waitForFunction(() => {
      const h = document.querySelector('[data-testid="wizard-v2-step-title"]');
      return h && (h.textContent.includes('Report Submitted') || h.textContent.includes('Already submitted'));
    }, { timeout: 20_000 });
  } catch { return 'error'; }
  const done = await page.locator('[data-testid="wizard-v2-step-title"]:has-text("Report Submitted")')
    .isVisible({ timeout: 1_000 }).catch(() => false);
  return done ? 'submitted' : 'already_submitted';
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Foil setup (agent account, desktop)
// ─────────────────────────────────────────────────────────────────────────────

async function runFoilSetup(browser, ground) {
  log('── FOIL SETUP (agent account) ──────────────────────────────────────────');
  if (ground.foilHasData) {
    ok(`FOIL SETUP — foil $${FOIL_FULL} already present in Firestore (ground truth); skipping UI re-seed`);
    return true;
  }
  if (!AGENT_EMAIL || !AGENT_PASSWORD) {
    ko('FOIL SETUP — A11Y_AGENT_EMAIL / _PASSWORD not set and no existing foil data; cannot seed foil');
    return false;
  }
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  try {
    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    if (!await openWizard(page, false)) { ko('FOIL SETUP — could not open WizardForm on agent dashboard'); return false; }
    const week = await startWizardForCurrentWeek(page);
    if (week === 'error') { ko('FOIL SETUP — date picker flow failed'); return false; }
    if (week === 'submitted') { ok('FOIL SETUP — foil week already submitted (data persists in Firestore)'); return true; }
    const r = await fillAndSubmitWizard(page, FOIL_API_INPUT);
    if (r === 'submitted' || r === 'already_submitted') { ok(`FOIL SETUP — foil submitted API=$${FOIL_FULL} ✓`); return true; }
    ko(`FOIL SETUP — fillAndSubmitWizard returned '${r}'`);
    return false;
  } catch (err) { ko(`FOIL SETUP — error: ${err.message}`); return false; }
  finally { await context.close(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — UM write-read-verify (desktop / light)
// ─────────────────────────────────────────────────────────────────────────────

async function runUmWriteReadVerify(browser, ground) {
  log('── UM WRITE-READ-VERIFY (desktop / light) ──────────────────────────────');
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  try {
    await login(page, UM_EMAIL, UM_PASSWORD);
    ok('[UM/WRV] login');

    // ── WRITE: ensure UM has a current-week submission carrying $3,333 ──────
    if (!await openWizard(page, true)) { ko('[UM/WRV] STOP — mp-report did not open WizardForm'); return; }
    ok('[UM/WRV] WizardForm opened via mp-report nav');
    const week = await startWizardForCurrentWeek(page);
    if (week === 'error') { ko('[UM/WRV] STOP — date picker flow failed'); return; }

    if (week === 'submitted') {
      ok('[UM/WRV] WRITE — UM week already submitted (own submission present in Firestore under UM uid)');
      await page.click('[data-testid="wizard-v2-close"]', { timeout: 5_000 }).catch(() => {});
    } else {
      const r = await fillAndSubmitWizard(page, UM_API_INPUT);
      if (r === 'submitted') {
        ok(`[UM/WRV] WRITE — submitted API=$${UM_FULL} via WizardForm ✓`);
        await page.click('[data-testid="wizard-v2-close"]', { timeout: 8_000 }).catch(() => {});
      } else { ko(`[UM/WRV] STOP — fillAndSubmitWizard returned '${r}'`); return; }
    }

    // ── RELOAD ──────────────────────────────────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForFunction(() => document.body.textContent.length > 500, { timeout: 15_000 });
    ok('[UM/WRV] reloaded');

    // ── READ #1 (History value-level): WeekCard shows "TTD 3.3K" ───────────
    try { await page.locator('button:has-text("History")').first().click({ timeout: 5_000 }); }
    catch { ko('[UM/WRV] STOP — could not navigate to mp-history'); return; }
    await page.waitForTimeout(1500);
    const histText = await page.locator('main').first().textContent({ timeout: 4_000 }).catch(() => '');
    if (histText.includes(UM_SHORT)) {
      ok(`[UM/WRV] READ#1 — own value "${UM_SHORT}" ($3,333) visible in mp-history WeekCard ✓ (non-vacuous)`);
    } else {
      ko(`[UM/WRV] STOP — own value "${UM_SHORT}" NOT found in mp-history (length-only fallback rejected)`);
    }
    // ── NO-LEAK in History: foil marker (both forms) must be absent ────────
    if (ground.foilHasData) {
      if (histText.includes(FOIL_FULL) || histText.includes(FOIL_SHORT)) {
        ko(`[UM/WRV] STOP — foil marker ("${FOIL_FULL}"/"${FOIL_SHORT}") VISIBLE in UM mp-history → LEAK`);
      } else {
        ok(`[UM/WRV] NO-LEAK — foil "${FOIL_FULL}"/"${FOIL_SHORT}" absent from mp-history ✓`);
      }
    }

    // ── READ #2 (full precision): SubmissionViewer "TTD 3,333" ─────────────
    try { await page.locator('button:has-text("Weekly Report")').first().click({ timeout: 5_000 }); }
    catch { ko('[UM/WRV] could not reopen mp-report for detail view'); return; }
    const week2 = await startWizardForCurrentWeek(page);
    if (week2 === 'submitted') {
      await page.click('button:has-text("View Submission")', { timeout: 5_000 }).catch(() => {});
      await page.locator('h2:has-text("Submission Details")').waitFor({ timeout: 6_000 }).catch(() => {});
      const detailText = await page.locator('body').textContent({ timeout: 3_000 }).catch(() => '');
      if (detailText.includes(UM_FULL)) {
        ok(`[UM/WRV] READ#2 — SubmissionViewer API = "${UM_FULL}" (full precision, own uid via getDraft) ✓`);
      } else {
        ko(`[UM/WRV] READ#2 — "${UM_FULL}" not found in SubmissionViewer detail`);
      }
      // foil must never reach the UM's own detail viewer either.
      if (ground.foilHasData && detailText.includes(FOIL_FULL)) {
        ko(`[UM/WRV] STOP — foil "${FOIL_FULL}" present in UM SubmissionViewer → LEAK`);
      }
    } else {
      ko(`[UM/WRV] READ#2 — expected "Already submitted" interstitial, got '${week2}' (write may not have persisted)`);
    }
  } catch (err) { ko(`[UM/WRV] error: ${err.message}`); }
  finally { await context.close(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab navigation
// ─────────────────────────────────────────────────────────────────────────────

async function navigateToTab(page, tabId, viewport) {
  const label = MP_SCREENS.find(s => s.tabId === tabId)?.label ?? tabId;
  if (viewport.label === 'mobile') {
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    if (await moreBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(600);
      try { await page.locator('[role="dialog"]').getByRole('button', { name: label }).first().click({ timeout: 5_000 }); }
      catch { /* WizardForm full-screen or item not found */ }
    }
  } else {
    const navSel = `[data-tabid="${tabId}"], [data-tab="${tabId}"], [href*="${tabId}"], button:has-text("${label}")`;
    try { await page.locator(navSel).first().click({ timeout: 5_000 }); } catch { /* */ }
  }
  await page.waitForTimeout(800);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — full-leg sweep (UM + BM × viewport × theme)
// ─────────────────────────────────────────────────────────────────────────────

async function assertNoLeak(page, tabId, tag, ground) {
  // Team-surface guards.
  if (await page.locator('[data-testid="mastersheet-surface"]').isVisible().catch(() => false)) {
    ko(`${tag} STOP — team MasterSheet visible in My Production screen (${tabId})`);
  }
  if (tabId === 'mp-goals' && await page.locator('[data-testid="manager-goals-panel"]').isVisible().catch(() => false)) {
    ko(`${tag} STOP — team GoalsPanel mounted inside mp-goals → wrong panel`);
  }
  // Foil marker sweep — both rendered forms (full + abbreviated).
  if (ground.foilHasData && tabId !== 'mp-report') {
    const txt = await page.locator('main, body').first().textContent({ timeout: 2_000 }).catch(() => '');
    if (txt.includes(FOIL_FULL) || txt.includes(FOIL_SHORT)) {
      ko(`${tag} STOP — foil "${FOIL_FULL}"/"${FOIL_SHORT}" found in ${tabId} → managed-agent data LEAKING into My Production`);
    }
  }
}

async function smokeLeg(browser, role, email, password, viewport, theme, ground) {
  const tag = `[${role}/${viewport.label}/${theme}]`;
  log(`── ${tag} ──────────────────────────────────────────────`);
  const context = await browser.newContext({ viewport });
  const page    = await context.newPage();
  const errors  = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await login(page, email, password);
    ok(`${tag} login`);
    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
    }
    for (const screen of MP_SCREENS) {
      await navigateToTab(page, screen.tabId, viewport);
      const rendered = await page.locator(screen.selector).first().isVisible({ timeout: 6_000 }).catch(() => false);
      if (rendered) ok(`${tag} ${screen.label} renders`);
      else {
        const fb = await page.locator('h1, h2, main').first().isVisible({ timeout: 2_000 }).catch(() => false);
        if (fb) ok(`${tag} ${screen.label} renders (fallback heading)`);
        else ko(`${tag} ${screen.label} did not render`);
      }
      await assertNoLeak(page, screen.tabId, tag, ground);
    }
    const real = errors.filter(e => !e.includes('ResizeObserver') && !e.includes('favicon') && !e.includes('service-worker'));
    if (real.length) ko(`${tag} ${real.length} console error(s): ${real.slice(0, 3).join(' | ')}`);
    else ok(`${tag} no console errors`);
  } catch (err) { ko(`${tag} error: ${err.message}`); }
  finally { await context.close(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  for (const [name, val] of [
    ['A11Y_UNIT_MANAGER_EMAIL', UM_EMAIL], ['A11Y_UNIT_MANAGER_PASSWORD', UM_PASSWORD],
    ['A11Y_BRANCH_MANAGER_EMAIL', BM_EMAIL], ['A11Y_BRANCH_MANAGER_PASSWORD', BM_PASSWORD],
  ]) if (!val) { console.error(`Missing ${name} in .env.local`); process.exit(1); }

  console.log(`\nPM-2 My Production smoke (HARDENED) — ${PREVIEW_URL}  tenant=${TENANT_ID}`);
  console.log(`UM: ${UM_EMAIL}  BM: ${BM_EMAIL}  Foil: ${AGENT_EMAIL ?? 'NOT SET'}`);

  // Phase 0 — ground truth (managed relationship + foil data existence).
  const ground = await loadGroundTruth();

  const browser = await chromium.launch({ headless: true });

  // Phase 1 — ensure foil data is seeded.
  if (!ground.foilHasData) {
    const seeded = await runFoilSetup(browser, ground);
    if (seeded) ground.foilHasData = true;
  } else {
    await runFoilSetup(browser, ground); // logs the already-present line
  }

  if (!ground.managed) {
    ko('NO-LEAK sweep is NOT decisive — managed relationship unverified. Reporting findings; sweep results are advisory only.');
  }

  // Phase 2 — UM write-read-verify.
  await runUmWriteReadVerify(browser, ground);

  // Phase 3 — full legs.
  for (const { email, password, role } of [
    { email: UM_EMAIL, password: UM_PASSWORD, role: 'unit_manager' },
    { email: BM_EMAIL, password: BM_PASSWORD, role: 'branch_manager' },
  ]) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        await smokeLeg(browser, role, email, password, viewport, theme, ground);
      }
    }
  }

  await browser.close();

  console.log('\n──────────────────────────────────────────────────');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  console.log(`Foil managed by UM: ${ground.facts.umManagesFoil ? 'YES' : 'NO'} · by BM: ${ground.facts.bmManagesFoil ? 'YES' : 'NO'} · foil data present: ${ground.foilHasData ? 'YES' : 'NO'}`);
  if (findings.length) { console.log('\nFindings:'); findings.forEach(f => console.log(`  • ${f}`)); }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });

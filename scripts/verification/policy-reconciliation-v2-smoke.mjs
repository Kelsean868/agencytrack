/**
 * policy-reconciliation-v2-smoke.mjs — Policy Reconciliation v2 (Slice 1) manager smoke.
 *
 * Verifies the v2 manager reconciliation surface against the PR's Vercel preview,
 * both themes, via the shared harness:
 *   1. Login as the test BM; open the Policy Reconciliation tab.
 *   2. At-risk hero shows a non-zero figure; the 3 tiles render; the compare
 *      reads "Confirmed · from circular" and "Tatil Report" appears NOWHERE.
 *   3. Lapse tab present (BM seat).
 *   4. Write-read-verify: confirm one clean policy (key the figure → Confirm),
 *      reload, assert it persisted (confirmedAt + managerSettledAPI written).
 *   5. Both themes; axe NO-NEW serious/critical (surface-scoped).
 *
 * Admin-SDK seed (test-tenant-only, idempotent, cleaned in finally): one flagged
 * (confirmed + hasDiscrepancy), one confirmed-clean, and per-theme unconfirmed
 * targets — enough to populate the worklist, the tiles, and the at-risk hero.
 *
 * Run: SMOKE_PREVIEW_URL=<preview> node scripts/verification/policy-reconciliation-v2-smoke.mjs
 * Requires .env.local: VERCEL_BYPASS_TOKEN, A11Y_BRANCH_MANAGER_EMAIL/PASSWORD,
 *   A11Y_AGENT_EMAIL. Requires functions/service-account-key.json.
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resolvePreviewUrl, setupBypassSession, setTheme, runBothThemes } from './lib/walk-helpers.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');

function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = loadEnv();

const PREVIEW_URL = resolvePreviewUrl();
const TAG = `SMOKE-PREC-${Date.now()}`;

const results = [];
const pass = (s, n = '') => { results.push({ status: 'PASS', s }); console.log(`  ✓ ${s}${n ? ` — ${n}` : ''}`); };
const fail = (s, n = '') => { results.push({ status: 'FAIL', s }); console.log(`  ✗ ${s}${n ? ` — ${n}` : ''}`); };

admin.initializeApp({ credential: admin.credential.cert(require('../../functions/service-account-key.json')) });
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

let tenantId = null;
let bmBranchId = null;
let agentUid = null;
const ids = {}; // tag suffix → docId

function basePolicy(owner, extra) {
  const d = new Date();
  const mid = new Date(d.getFullYear(), d.getMonth(), 14, 12, 0, 0); // current month → in default period
  return {
    tenantId,
    agentId: agentUid,
    agentNumber: null,
    unitId: null,
    branchId: bmBranchId,
    status: 'settled',
    statusDate: FieldValue.serverTimestamp(),
    ownerName: owner,
    insuredName: owner,
    policyNumber: `${owner}-NO`,
    productLine: 'life',
    newBusinessType: 'nb_ordinary',
    policyClass: 'whole_life',
    planId: null,
    planName: 'Tatil Whole Life Premier',
    proposedPremium: 3000,
    proposedFrequency: 'M',
    proposedAPI: 36000,
    proposedCoverage: null,
    dateWritten: Timestamp.fromDate(new Date(d.getFullYear(), d.getMonth(), 2, 12)),
    dateSubmitted: Timestamp.fromDate(new Date(d.getFullYear(), d.getMonth(), 3, 12)),
    notes: null,
    isSelfOrFamily: false,
    replacedPolicyAPI: null,
    sourceOfProspect: 'referral',
    socialPlatform: null,
    cashWithApp: { collected: false, amount: null },
    dateIssued: Timestamp.fromDate(mid),
    issuedCoverage: 300000,
    initialPremium: 3000,
    earnedCommission: 1500,
    policyDeliveryDate: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: agentUid,
    ...extra,
  };
}

async function cleanupTag(prefix) {
  const snap = await db.collection(`tenants/${tenantId}/policies`).where('branchId', '==', bmBranchId).get();
  let n = 0;
  for (const d of snap.docs) {
    if (!String(d.data().ownerName || '').startsWith(prefix)) continue;
    const hist = await d.ref.collection('history').get();
    for (const h of hist.docs) await h.ref.delete();
    await d.ref.delete();
    n += 1;
  }
  return n;
}

async function seed() {
  const bm = await admin.auth().getUserByEmail(E.A11Y_BRANCH_MANAGER_EMAIL);
  tenantId = bm.customClaims?.tenantId;
  if (!tenantId) throw new Error('BM tenantId not resolvable from claims');
  const bmDoc = await db.doc(`tenants/${tenantId}/users/${bm.uid}`).get();
  bmBranchId = bmDoc.data()?.branchId;
  if (!bmBranchId) throw new Error('BM branchId not resolvable from user doc');
  const agent = await admin.auth().getUserByEmail(E.A11Y_AGENT_EMAIL);
  agentUid = agent.uid;

  const cleaned = await cleanupTag('SMOKE-PREC-');
  pass('admin-seed-preclean', `removed ${cleaned} prior smoke doc(s)`);

  const col = db.collection(`tenants/${tenantId}/policies`);
  // Flagged: confirmed + hasDiscrepancy (drives at-risk hero + flagged tile).
  const flagged = await col.add(basePolicy(`${TAG}-FLAG`, {
    settledAPI: 32400, proposedAPI: 32400,
    confirmedAt: Timestamp.now(), confirmedByManager: 'SMOKE BM', confirmedByUid: bm.uid,
    managerSettledAPI: 29800, managerNote: 'settled under submission', hasDiscrepancy: true,
  }));
  ids.FLAG = flagged.id;
  // Confirmed-clean tile.
  const conf = await col.add(basePolicy(`${TAG}-CONF`, {
    settledAPI: 18600, proposedAPI: 18600,
    confirmedAt: Timestamp.now(), confirmedByManager: 'SMOKE BM', confirmedByUid: bm.uid,
    managerSettledAPI: 18600, managerNote: '', hasDiscrepancy: false,
  }));
  ids.CONF = conf.id;
  // Per-theme unconfirmed clean targets (each theme confirms its own).
  const cl = await col.add(basePolicy(`${TAG}-CL`, { settledAPI: 24000, proposedAPI: 24000 }));
  ids.CL = cl.id;
  const cd = await col.add(basePolicy(`${TAG}-CD`, { settledAPI: 27000, proposedAPI: 27000 }));
  ids.CD = cd.id;
  pass('admin-seed', `${TAG}: FLAG(disc) + CONF(clean) + CL/CD unconfirmed`);
}

async function loginAsBM(page) {
  await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', E.A11Y_BRANCH_MANAGER_EMAIL);
  await page.fill('input[type="password"]', E.A11Y_BRANCH_MANAGER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.getByRole('button', { name: /Policy Reconciliation/i }).first().waitFor({ timeout: 45000 });
}

async function openReconciliation(page) {
  await page.getByRole('button', { name: /Policy Reconciliation/i }).first().click();
  await page.waitForSelector('[data-testid="tab-confirm"]', { timeout: 20000 });
  await page.waitForSelector('[data-testid="at-risk-hero"]', { timeout: 20000 });
}

async function runTheme(page, theme) {
  await loginAsBM(page);
  pass(`[${theme}] login-bm`);

  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((theme === 'dark') === isDark) pass(`[${theme}] theme-applied`);
  else fail(`[${theme}] theme-applied`, `dark=${isDark}`);

  await openReconciliation(page);
  pass(`[${theme}] reconciliation-opens`);

  // Tiles + at-risk hero
  for (const k of ['toReconcile', 'flagged', 'confirmed']) {
    const ok = await page.locator(`[data-testid="recon-tile-${k}"]`).first().isVisible().catch(() => false);
    if (!ok) { fail(`[${theme}] tile-${k}`); return; }
  }
  const atRisk = await page.locator('[data-testid="at-risk-value"]').first().innerText();
  if (/[1-9]/.test(atRisk)) pass(`[${theme}] at-risk-nonzero`, atRisk);
  else fail(`[${theme}] at-risk-nonzero`, `value="${atRisk}"`);

  // Honest framing: "from circular" present, "Tatil Report" absent (whole page).
  const body = await page.locator('body').innerText();
  if (/from circular/i.test(body) && !/tatil report/i.test(body)) pass(`[${theme}] honest-framing (from-circular; no Tatil Report)`);
  else fail(`[${theme}] honest-framing`, `fromCircular=${/from circular/i.test(body)} tatilReport=${/tatil report/i.test(body)}`);

  // Lapse tab present (BM seat)
  const lapseTab = await page.locator('[data-testid="tab-lapse"]').first().isVisible().catch(() => false);
  if (lapseTab) pass(`[${theme}] lapse-tab-present`);
  else fail(`[${theme}] lapse-tab-present`);

  // axe NO-NEW serious/critical (surface-scoped). Exclude the two established
  // baseline patterns (bg-gold-tint text-gold pill; bg-primary text-white button
  // in dark) — pre-existing app-wide, per the #432 LOW a11y FU.
  const isKnownBaseline = (n) =>
    n.id === 'color-contrast' &&
    ((/bg-gold-tint/.test(n.html) && /text-gold/.test(n.html)) ||
     (/bg-primary/.test(n.html) && /text-white/.test(n.html)));
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = (axe.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
  const newNodes = serious.flatMap((v) => v.nodes.map((n) => ({ id: v.id, html: n.html })).filter((n) => !isKnownBaseline(n)));
  if (newNodes.length === 0) pass(`[${theme}] axe-no-NEW-serious-critical`);
  else {
    for (const n of newNodes.slice(0, 4)) console.log(`      ↳ ${n.id}: ${n.html.slice(0, 150)}`);
    fail(`[${theme}] axe-no-new-serious-critical`, newNodes.map((n) => n.id).slice(0, 4).join(', '));
  }

  // ── Write-read-verify: confirm a clean per-theme policy ──
  const targetId = theme === 'dark' ? ids.CD : ids.CL;
  const input = page.locator(`[data-testid="manager-api-input-${targetId}"]`).first();
  if (!(await input.isVisible().catch(() => false))) { fail(`[${theme}] confirm-target-visible`); return; }
  await input.fill(theme === 'dark' ? '27000' : '24000'); // matching figure → clean
  await page.locator(`[data-testid="confirm-btn-${targetId}"]`).first().click();
  await page.waitForTimeout(2500); // confirm + loadData refresh

  // Read-back via Admin SDK
  const doc = await db.doc(`tenants/${tenantId}/policies/${targetId}`).get();
  const d = doc.data();
  if (d?.confirmedAt && Number(d.managerSettledAPI) === (theme === 'dark' ? 27000 : 24000)) {
    pass(`[${theme}] confirm-persisted`, `managerSettledAPI=${d.managerSettledAPI} hasDiscrepancy=${d.hasDiscrepancy}`);
  } else {
    fail(`[${theme}] confirm-persisted`, `confirmedAt=${!!d?.confirmedAt} managerSettledAPI=${d?.managerSettledAPI}`);
  }
}

async function main() {
  console.log(`\n=== policy-reconciliation-v2-smoke ===\nTarget: ${PREVIEW_URL}`);
  let browser;
  try {
    await seed();
    browser = await chromium.launch({ headless: true });
    await runBothThemes(browser, {
      baseUrl: PREVIEW_URL,
      token: E.VERCEL_BYPASS_TOKEN,
      viewport: { width: 1280, height: 900 },
      perTheme: async (page, theme) => {
        try { await runTheme(page, theme); }
        catch (err) { fail(`[${theme}] error`, String(err?.message ?? err).slice(0, 200)); }
      },
    });
  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 240));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (tenantId && bmBranchId) {
      const removed = await cleanupTag('SMOKE-PREC-').catch(() => null);
      if (removed != null) pass('admin-cleanup', `deleted ${removed} doc(s)`);
    }
    await admin.app().delete().catch(() => {});
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const ok = failed === 0;
  console.log(`\n=== RESULT: ${passed}/${results.length} passed, ${failed} failed — ${ok ? 'OK ✓' : 'FAILED ✗'} ===\n`);
  if (!ok) process.exit(1);
}

main().catch((err) => { console.error('Fatal:', err?.stack ?? err); process.exit(1); });

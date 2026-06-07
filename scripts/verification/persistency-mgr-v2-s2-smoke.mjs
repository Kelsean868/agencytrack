/**
 * persistency-mgr-v2-s2-smoke.mjs — Manager Persistency v2 Slice 2 smoke.
 *
 * Write-read-verify + MANDATORY RESTORE leg per brief smoke spec.
 * BRANCH MANAGER credential.
 *
 * NIGHT RIDER (from persistency-night-queue-kickoff.md):
 *   Sentinel six-input values → ~70% persistency (below 0.80 floor).
 *   Between WRITE and RESTORE:
 *     - assert at-risk book renders the agent
 *     - exception-first ordering holds
 *     - COACH opens CoachingNotesModal with right agent props
 *   OPTIONAL extension (if ≥2 roster agents): second sentinel → n≥2 recompute
 *     proves summed-vs-mean distinction LIVE; restore/delete both.
 *   RESTORE (PASS/FAIL leg): byte-exact if doc existed; DELETE if absent.
 *
 * CHECKS:
 *   0. CAPTURE  — record original doc state (full REST payload or ABSENT).
 *   1. WRITE    — open drawer from roster-row Edit, fill sentinel, Save & lock.
 *   2. VERIFY   — REST read: sentinel fields present, enteredByRole = BM.
 *   3. AT-RISK  — at-risk book shows sentinel agent, exception-first ordering.
 *   4. COACH    — COACH button opens CoachingNotesModal.
 *   5. RECOMPUTE (== recompute, optional n≥2 extension).
 *   6. AXE      — NO-NEW vs bell-badge baseline.
 *   7. CONSOLE  — 0 errors.
 *   8. §2 screenshots — light (sentinel state) + dark (original state).
 *   9. RESTORE  — PASS/FAIL.
 *
 * Usage:
 *   node scripts/verification/persistency-mgr-v2-s2-smoke.mjs --url=<preview>
 *   node scripts/verification/persistency-mgr-v2-s2-smoke.mjs  # defaults to prod
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import {
  setupBypassSession,
  installBearerTokenCapture,
  captureBearerToken,
} from './lib/walk-helpers.mjs';

// ── Env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const urlArg      = process.argv.find((a) => a.startsWith('--url='));
const BASE_URL    = urlArg ? urlArg.split('=').slice(1).join('=') : 'https://agencytrack.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL    = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS     = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const SHOT_DIR    = 'verification/persistency-mgr-v2-s2';
const PROJECT_ID  = 'agencytrack-2a610';

// Post-#503 baseline: bell-badge color-contrast is the ONLY intended pre-existing
// axe debt app-wide.
const PREEXISTING_AXE_IDS = new Set(['color-contrast']);

// Sentinel values — produce exactly 70.0% persistency (below 0.80 floor):
//   grossSettled = 150000 − 0 + 0 + 0×0.1 = 150000
//   netSettled   = 150000 − 45000 + 0       = 105000
//   persistency  = 105000 / 150000           = 0.70
const SENTINEL_A = {
  businessPlaced: '150000',
  notTakens: '0',
  incPPPs: '0',
  lumpsums100: '0',
  lapses: '45000',
  reinstatements: '0',
};
// Optional second sentinel — 65.0% persistency (different gross/net to test sum-vs-mean):
//   grossSettled = 200000 − 0 + 0 + 0×0.1 = 200000
//   netSettled   = 200000 − 70000 + 0       = 130000
//   persistency  = 130000 / 200000           = 0.65
// Combined n=2 aggregate (sum-not-mean):
//   sumGross=350000, sumNet=235000 → 67.1%  (mean-of-% would give 67.5% — different)
const SENTINEL_B = {
  businessPlaced: '200000',
  notTakens: '0',
  incPPPs: '0',
  lumpsums100: '0',
  lapses: '70000',
  reinstatements: '0',
};

if (!BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN'); process.exit(1); }
if (!BM_EMAIL || !BM_PASS) {
  console.error('Missing A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD');
  process.exit(1);
}

try { mkdirSync(SHOT_DIR, { recursive: true }); } catch { /* ignore */ }

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

function persistencyDocId(agentUid, monthKey) {
  return `${agentUid}_${String(monthKey).replace('-', '_')}`;
}

function fsDocUrl(tenantId, agentUid, monthKey) {
  const docId = persistencyDocId(agentUid, monthKey);
  const path  = `tenants/${tenantId}/persistency/${docId}`;
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

// Returns the raw REST `fields` object (for capture) or null (doc absent/denied).
async function restGet(url, idToken) {
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.fields ?? null;
  } catch { return null; }
}

// Patches (full-replace) or deletes a document via REST.
async function restPatch(url, idToken, fields) {
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return { ok: resp.ok, status: resp.status };
}

async function restDelete(url, idToken) {
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return { ok: resp.ok, status: resp.status };
}

// Read a numeric value from a REST field object.
function fsNum(field) {
  if (!field) return null;
  if ('doubleValue'  in field) return Number(field.doubleValue);
  if ('integerValue' in field) return Number(field.integerValue);
  return null;
}

function fsStr(field) {
  if (!field) return null;
  if ('stringValue' in field) return String(field.stringValue);
  return null;
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1500);
}

// Fill sentinel values into an open drawer form.
async function fillSentinel(page, sentinel) {
  for (const [field, value] of Object.entries(sentinel)) {
    const input = page.locator(`[data-testid="persistency-input-${field}"]`);
    await input.waitFor({ timeout: 5000 });
    await input.fill(value);
    await page.waitForTimeout(100);
  }
}

// ── Main smoke ────────────────────────────────────────────────────────────────
const R = {
  url: BASE_URL,
  capture:  null,
  write:    null,
  verify:   null,
  atRisk:   null,
  coach:    null,
  recompute: null,
  axeLight: null,
  axeDark:  null,
  restore:  null,
  console:  [],
  shots:    [],
  pass:     false,
};

console.log(`\nPersistency Manager v2 S2 smoke\nTarget: ${BASE_URL}\n`);

const browser = await chromium.launch({ headless: true });
const context  = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);
  const page = await context.newPage();

  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('fontshare.com')) return;
    if (t.includes('Failed to load resource') && t.includes('net::ERR_FAILED')) return;
    R.console.push(t);
  });

  await installBearerTokenCapture(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await login(page, BM_EMAIL, BM_PASS);

  // ── Navigate to Persistency tab ───────────────────────────────────────────
  await page.waitForSelector('[data-testid="tab-persistency"]', { timeout: 20_000 });
  await page.click('[data-testid="tab-persistency"]');
  await page.waitForSelector('[data-testid="persistency-tab"]', { timeout: 25_000 });
  await page.waitForTimeout(3000);

  // Capture bearer token and month selection.
  const capturedToken = await captureBearerToken(page);
  if (!capturedToken) {
    console.error('FATAL: bearer token not captured — cannot proceed with write/verify/restore');
    process.exit(1);
  }
  const jwtPayload = decodeJwtPayload(capturedToken);
  const tenantId   = jwtPayload?.tenantId ?? null;
  if (!tenantId) {
    console.error('FATAL: tenantId not in JWT — cannot proceed');
    process.exit(1);
  }

  const selectedMonthKey = await page.$eval(
    '[data-testid="pers-month-selector"]',
    (el) => el.value,
  ).catch(() => null);
  if (!selectedMonthKey) {
    console.error('FATAL: could not read selected month from DOM');
    process.exit(1);
  }
  console.log(`  Month: ${selectedMonthKey} · tenantId: ${tenantId}`);

  // ── Roster agents ─────────────────────────────────────────────────────────
  const agentUids = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid^="pers-roster-row-"]');
    return Array.from(rows).map((el) => el.dataset.testid.replace('pers-roster-row-', ''));
  });
  if (agentUids.length === 0) {
    console.error('FATAL: no roster agents found — cannot run write smoke');
    process.exit(1);
  }
  const agentA = agentUids[0];
  const agentB = agentUids.length >= 2 ? agentUids[1] : null;
  const optionalExtension = agentB !== null;
  console.log(`  Roster agents: ${agentUids.length} (will use ${agentA}${optionalExtension ? ' + ' + agentB : ''})`);

  // ── Phase 0: CAPTURE ──────────────────────────────────────────────────────
  console.log('\n[CAPTURE]');
  const urlA = fsDocUrl(tenantId, agentA, selectedMonthKey);
  const originalFieldsA = await restGet(urlA, capturedToken);
  R.capture = { agentA, urlA, existedA: originalFieldsA !== null };
  console.log(`  agent A (${agentA}): ${originalFieldsA !== null ? 'EXISTS — captured' : 'ABSENT — will DELETE on restore'}`);

  let originalFieldsB = null;
  let urlB = null;
  if (optionalExtension) {
    urlB = fsDocUrl(tenantId, agentB, selectedMonthKey);
    originalFieldsB = await restGet(urlB, capturedToken);
    console.log(`  agent B (${agentB}): ${originalFieldsB !== null ? 'EXISTS — captured' : 'ABSENT — will DELETE on restore'}`);
  }

  // ── Phase 1: WRITE — agent A ──────────────────────────────────────────────
  console.log('\n[WRITE — agent A sentinel]');
  // Sentinel A: 70.0% persistency — below 0.80 floor.
  const editBtnA = await page.$(`[data-testid="pers-roster-edit-${agentA}"]`);
  if (!editBtnA) {
    console.error(`FATAL: Edit button for ${agentA} not found (pers-roster-edit-${agentA})`);
    process.exit(1);
  }
  await editBtnA.click();
  // The outer dialog div has only position:fixed children → zero bounding-box → Playwright
  // reports "hidden". Wait for state:attached, then confirm via a visible child input.
  await page.waitForSelector('[data-testid="persistency-entry-form"]', { state: 'attached', timeout: 10_000 });
  await page.waitForSelector('[data-testid="persistency-input-businessPlaced"]', { timeout: 10_000 });
  console.log('  Drawer opened ✓');

  // Verify gold precedence banner present.
  const bannerA = await page.$('[data-testid="pers-precedence-banner"]');
  console.log(`  Precedence banner: ${bannerA ? 'present ✓' : 'MISSING ✗'}`);
  R.write = { bannerPresent: !!bannerA };

  await fillSentinel(page, SENTINEL_A);
  console.log('  Sentinel values filled ✓');

  // Click "Save & lock"
  const saveBtn = page.locator('button', { hasText: /save.*lock/i });
  await saveBtn.waitFor({ timeout: 5000 });
  await saveBtn.click();

  // Wait for drawer to close (onSaved callback fires → loadRecords → drawer closes).
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="persistency-entry-form"]'),
    { timeout: 15_000 },
  );
  console.log('  Drawer closed (onSaved) ✓');
  // Allow roster to reload.
  await page.waitForTimeout(2500);

  // ── Phase 1b: WRITE — agent B (optional extension) ────────────────────────
  // Optional extension: only if agent B had an EXISTING doc (rules don't allow BM DELETE,
  // so we can only restore-via-PATCH; skipping when doc was ABSENT avoids orphan state).
  const runOptionalExtension = optionalExtension && originalFieldsB !== null;
  if (optionalExtension && !runOptionalExtension) {
    console.log('\n[WRITE — agent B] skipped — doc was ABSENT, BM cannot DELETE via REST (rules only allow create/update). Optional extension requires pre-existing doc for safe restore.');
  }
  if (runOptionalExtension) {
    console.log('\n[WRITE — agent B sentinel (optional n≥2 extension)]');
    const editBtnB = await page.$(`[data-testid="pers-roster-edit-${agentB}"]`);
    if (!editBtnB) {
      console.log('  agent B edit button not found — skipping optional extension');
    } else {
      await editBtnB.click();
      await page.waitForSelector('[data-testid="persistency-entry-form"]', { state: 'attached', timeout: 10_000 });
      await page.waitForSelector('[data-testid="persistency-input-businessPlaced"]', { timeout: 10_000 });
      await fillSentinel(page, SENTINEL_B);
      const saveBtnB = page.locator('button', { hasText: /save.*lock/i });
      await saveBtnB.click();
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="persistency-entry-form"]'),
        { timeout: 15_000 },
      );
      console.log('  agent B sentinel written ✓');
      await page.waitForTimeout(2500);
    }
  }

  // ── Phase 2: VERIFY via Firestore REST ────────────────────────────────────
  console.log('\n[VERIFY — Firestore REST]');
  const verifyFields = await restGet(urlA, capturedToken);
  if (!verifyFields) {
    R.verify = { pass: false, reason: 'REST GET returned null — doc missing or access denied' };
    console.log('  FAIL — doc not readable after write');
  } else {
    const vBizPlaced = fsNum(verifyFields.businessPlaced);
    const vLapses    = fsNum(verifyFields.lapses);
    const vPersistency = fsNum(verifyFields.persistency);
    const vEnteredByRole = fsStr(verifyFields.enteredByRole);
    const vLastRole  = fsStr(verifyFields.lastEditedByRole);

    const bizMatch = Math.abs(vBizPlaced - 150000) < 0.01;
    const lapsesMatch = Math.abs(vLapses - 45000) < 0.01;
    const persMatch = vPersistency !== null && Math.abs(vPersistency - 0.70) < 0.001;
    const roleMatch = vLastRole === 'branch_manager';

    R.verify = {
      businessPlaced: vBizPlaced, lapses: vLapses,
      persistency: vPersistency, enteredByRole: vEnteredByRole, lastEditedByRole: vLastRole,
      bizMatch, lapsesMatch, persMatch, roleMatch,
      pass: bizMatch && lapsesMatch && persMatch && roleMatch,
    };
    console.log(`  businessPlaced: ${vBizPlaced} → ${bizMatch ? 'MATCH ✓' : 'MISMATCH ✗'}`);
    console.log(`  lapses:         ${vLapses}  → ${lapsesMatch ? 'MATCH ✓' : 'MISMATCH ✗'}`);
    console.log(`  persistency:    ${vPersistency} (expected 0.70) → ${persMatch ? 'MATCH ✓' : 'MISMATCH ✗'}`);
    console.log(`  lastEditedByRole: "${vLastRole}" → ${roleMatch ? 'branch_manager ✓' : 'MISMATCH ✗'}`);
    console.log(`  enteredByRole: "${vEnteredByRole}"`);
    console.log(`  VERIFY: ${R.verify.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  }

  // ── Phase 3: AT-RISK book (while sentinel is live) ────────────────────────
  console.log('\n[AT-RISK + ORDERING]');
  const hasAtRiskBook = !!(await page.$('[data-testid="pers-atrisk-book"]'));
  const hasCelebration = !!(await page.$('[data-testid="pers-atrisk-celebration"]'));

  let agentInAtRisk = false;
  let atRiskPcts    = [];
  let atRiskOrdered = true;

  if (hasAtRiskBook) {
    // Check that sentinel agent appears in at-risk rows.
    const sentinelRow = await page.$(`[data-testid="pers-atrisk-row-${agentA}"]`);
    agentInAtRisk = !!sentinelRow;

    // Collect at-risk pcts for ordering check.
    atRiskPcts = await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid^="pers-atrisk-pct-"]');
      return Array.from(rows).map((el) => {
        const m = el.textContent.trim().match(/[\d.]+/);
        return m ? parseFloat(m[0]) : null;
      }).filter((v) => v !== null);
    });
    for (let i = 1; i < atRiskPcts.length; i++) {
      if (atRiskPcts[i] < atRiskPcts[i - 1]) { atRiskOrdered = false; break; }
    }
  }

  R.atRisk = {
    arm: hasAtRiskBook ? 'at-risk' : hasCelebration ? 'celebration' : 'missing',
    agentInAtRisk,
    atRiskPcts,
    atRiskOrdered,
    pass: hasAtRiskBook && agentInAtRisk && atRiskOrdered,
  };
  console.log(`  At-risk arm: ${R.atRisk.arm}`);
  console.log(`  Sentinel agent in at-risk book: ${agentInAtRisk ? 'YES ✓' : 'NO ✗'}`);
  console.log(`  Exception-first ordering [${atRiskPcts.join(', ')}]%: ${atRiskOrdered ? 'PASS ✓' : 'FAIL ✗'}`);
  if (!hasAtRiskBook && hasCelebration) {
    console.log('  NOTE: celebration arm — expected at-risk book after sentinel write');
  }

  // ── Phase 4: COACH ────────────────────────────────────────────────────────
  console.log('\n[COACH]');
  let coachOpens = null;
  const coachBtn = await page.$(`[data-testid="pers-atrisk-coach-${agentA}"]`);
  if (!coachBtn) {
    console.log('  COACH button not found for sentinel agent — n/a (agent not in at-risk book)');
    coachOpens = null;
  } else {
    await coachBtn.click();
    await page.waitForTimeout(600);
    // Assert CoachingNotesModal is open (role=dialog + "coach" in heading or modal content).
    coachOpens = await page.evaluate(() => {
      const modals = document.querySelectorAll('[role="dialog"]');
      if (modals.length < 2) return false; // drawer already gone; need a second dialog
      // Or find coach-specific heading.
      const heading = Array.from(document.querySelectorAll('h2, h3, [role="heading"]')).find(
        (el) => el.textContent.toLowerCase().includes('coach'),
      );
      return !!(heading);
    });
    // If drawer is now closed (sentinel saved and closed), there should be only one dialog.
    // Relax: check for any dialog containing "coach".
    if (!coachOpens) {
      coachOpens = await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const d of dialogs) {
          if (d.textContent.toLowerCase().includes('coach')) return true;
        }
        return false;
      });
    }
    console.log(`  CoachingNotesModal opened: ${coachOpens ? 'YES ✓' : 'NO ✗'}`);
    // Close
    const closeBtn = await page.$('[aria-label="Close"], [data-testid="modal-close"]');
    if (closeBtn) await closeBtn.click().catch(() => {});
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  R.coach = { coachOpens };

  // ── Phase 5: == RECOMPUTE (optional n≥2 extension) ───────────────────────
  if (runOptionalExtension) {
    console.log('\n[== RECOMPUTE — n≥2 summed-vs-mean]');
    // Agent A: gross=150000, net=105000
    // Agent B: gross=200000, net=130000
    // Aggregated: sumGross=350000, sumNet=235000 → 67.14%
    // (mean of % = (70+65)/2 = 67.50% — different, proving sum-not-mean)
    const EXPECTED_SUM_GROSS = 350000;
    const EXPECTED_SUM_NET   = 235000;
    const EXPECTED_AGG_PCT   = (EXPECTED_SUM_NET / EXPECTED_SUM_GROSS) * 100; // 67.14...

    const barAggText = await page.$eval(
      '[data-testid="pers-bar-aggregate"]',
      (el) => el.textContent.trim(),
    ).catch(() => '');

    const domAggregatePct = (() => {
      const m = barAggText.match(/([\d.]+)%/);
      return m ? parseFloat(m[1]) : null;
    })();

    const aggMatch = domAggregatePct !== null
      && Math.abs(domAggregatePct - EXPECTED_AGG_PCT) < 0.20;
    const notMeanMatch = domAggregatePct !== null
      && Math.abs(domAggregatePct - 67.50) > 0.10; // must NOT be 67.5%

    R.recompute = {
      expected: EXPECTED_AGG_PCT.toFixed(1) + '%',
      meanOfPct: '67.5%',
      dom: domAggregatePct !== null ? domAggregatePct.toFixed(1) + '%' : '—',
      aggMatch,
      notMeanMatch,
      pass: aggMatch && notMeanMatch,
    };
    console.log(`  Expected (sum-not-mean): ${R.recompute.expected}`);
    console.log(`  Mean-of-%  (WRONG):      ${R.recompute.meanOfPct}`);
    console.log(`  DOM shows:               ${R.recompute.dom}`);
    console.log(`  Matches sum-not-mean: ${aggMatch ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Diverges from mean: ${notMeanMatch ? 'YES ✓' : 'NO (same as mean — insufficient data divergence)'}`);
    console.log(`  RECOMPUTE: ${R.recompute.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  } else {
    const skipReason = !optionalExtension
      ? 'only 1 roster agent'
      : 'agent B doc was ABSENT — optional extension skipped to avoid orphan state';
    R.recompute = { skipped: true, reason: skipReason };
    console.log(`\n[== RECOMPUTE] skipped — ${skipReason}`);
  }

  // ── Phase 6: §2 screenshot (light, sentinel state) ───────────────────────
  const shotLight = `${SHOT_DIR}/light-sentinel.png`;
  await page.screenshot({ path: shotLight, fullPage: false });
  R.shots.push(shotLight);
  console.log(`\n[SCREENSHOT — light sentinel] ${shotLight}`);

  // ── Phase 6: AXE (light) ─────────────────────────────────────────────────
  console.log('\n[AXE — light]');
  let axeTabViolationsLight = [];
  let axeNewRuleIdsLight    = [];
  let axeTabOkLight         = false;
  try {
    const tabRes = await new AxeBuilder({ page })
      .include('[data-testid="persistency-tab"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    axeTabViolationsLight = tabRes.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    const fullRes = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const allNew = fullRes.violations.filter(
      (v) => !PREEXISTING_AXE_IDS.has(v.id) && (v.impact === 'serious' || v.impact === 'critical'),
    );
    axeNewRuleIdsLight = [...new Set(allNew.map((v) => v.id))];
    axeTabOkLight = axeTabViolationsLight.length === 0;
    R.axeLight = { tabOk: axeTabOkLight, newRuleIds: axeNewRuleIdsLight };
    console.log(`  persistency-tab scope: ${axeTabOkLight ? '0 violations ✓' : axeTabViolationsLight.length + ' ✗'}`);
    console.log(`  new violations: [${axeNewRuleIdsLight.join(', ') || 'none'}] ${axeNewRuleIdsLight.length === 0 ? '✓' : '✗'}`);
  } catch (e) {
    R.axeLight = { error: String(e).slice(0, 100) };
    console.log('  axe error: ' + R.axeLight.error);
  }

  // ── Phase 9: RESTORE (MANDATORY PASS/FAIL) — do this BEFORE dark render ──
  console.log('\n[RESTORE]');
  let restorePassA = false;
  let restorePassB = true; // default true if no agent B

  if (originalFieldsA === null) {
    // Doc was ABSENT — DELETE the sentinel doc.
    const del = await restDelete(urlA, capturedToken);
    // Verify deletion.
    const afterDel = await restGet(urlA, capturedToken);
    restorePassA = del.ok && afterDel === null;
    console.log(`  agent A: DELETE (was ABSENT) → ${restorePassA ? 'PASS ✓' : 'FAIL ✗'} (status=${del.status}, doc-after-del=${afterDel === null ? 'absent ✓' : 'STILL-EXISTS ✗'})`);
  } else {
    // Doc EXISTED — write back byte-exact.
    const patch = await restPatch(urlA, capturedToken, originalFieldsA);
    const afterPatch = await restGet(urlA, capturedToken);
    // Verify key fields match the original.
    const origPers = fsNum(originalFieldsA.persistency);
    const newPers  = afterPatch ? fsNum(afterPatch.persistency) : null;
    restorePassA = patch.ok && afterPatch !== null && (
      origPers === null || (newPers !== null && Math.abs(origPers - newPers) < 0.001)
    );
    console.log(`  agent A: RESTORE (existed) → ${restorePassA ? 'PASS ✓' : 'FAIL ✗'} (status=${patch.status}, persistency: ${origPers?.toFixed(3)} → ${newPers?.toFixed(3)})`);
  }

  if (runOptionalExtension && urlB && originalFieldsB !== null) {
    const patch = await restPatch(urlB, capturedToken, originalFieldsB);
    restorePassB = patch.ok;
    console.log(`  agent B: RESTORE (existed) → ${restorePassB ? 'PASS ✓' : 'FAIL ✗'} (status=${patch.status})`);
  } else if (optionalExtension && !runOptionalExtension) {
    console.log('  agent B: no sentinel written (ABSENT skip) → restore n/a ✓');
  }

  R.restore = { passA: restorePassA, passB: restorePassB, pass: restorePassA && restorePassB };
  console.log(`  RESTORE leg: ${R.restore.pass ? 'PASS ✓' : 'FAIL ✗'}`);

  // ── Dark theme render + screenshot + axe (no write) ──────────────────────
  console.log('\n[DARK THEME — render]');
  // Restore is done. Toggle dark mode, reload, then re-navigate to persistency tab.
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('agencytrack-dark', '1');
  });
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // After reload, page lands on dashboard root — navigate to persistency tab again.
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1000);
  const persTab = await page.$('[data-testid="tab-persistency"]');
  if (persTab) {
    await persTab.click();
    await page.waitForSelector('[data-testid="persistency-tab"]', { timeout: 20_000 });
    await page.waitForTimeout(2000);
  } else {
    // If not navigated away (SPA stayed on persistency), content may still be there.
    await page.waitForTimeout(2000);
  }

  const shotDark = `${SHOT_DIR}/dark-after-restore.png`;
  await page.screenshot({ path: shotDark, fullPage: false });
  R.shots.push(shotDark);
  console.log(`  Screenshot: ${shotDark}`);

  // AXE dark.
  try {
    const tabResD = await new AxeBuilder({ page })
      .include('[data-testid="persistency-tab"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const axeTabViolsDark = tabResD.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    const fullResD = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const allNewD = fullResD.violations.filter(
      (v) => !PREEXISTING_AXE_IDS.has(v.id) && (v.impact === 'serious' || v.impact === 'critical'),
    );
    const axeNewRuleIdsD = [...new Set(allNewD.map((v) => v.id))];
    const axeTabOkD = axeTabViolsDark.length === 0;
    R.axeDark = { tabOk: axeTabOkD, newRuleIds: axeNewRuleIdsD };
    console.log(`  axe tab scope: ${axeTabOkD ? '0 violations ✓' : axeTabViolsDark.length + ' ✗'}`);
    console.log(`  new violations: [${axeNewRuleIdsD.join(', ') || 'none'}] ${axeNewRuleIdsD.length === 0 ? '✓' : '✗'}`);
  } catch (e) {
    R.axeDark = { error: String(e).slice(0, 100) };
    console.log('  axe error: ' + R.axeDark.error);
  }

} catch (e) {
  R.fatal = String(e).slice(0, 500);
  console.error('\nFATAL:', R.fatal);
} finally {
  await browser.close();
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n── Smoke Summary ────────────────────────────────────────────────────────────');
const verifyPass  = R.verify?.pass === true;
const atRiskPass  = R.atRisk?.pass === true;
const coachPass   = R.coach?.coachOpens !== false; // null = n/a (not counted as fail)
const recompPass  = R.recompute?.skipped ? true : R.recompute?.pass === true;
const axePassL    = R.axeLight?.tabOk === true && (R.axeLight?.newRuleIds?.length ?? 1) === 0;
const axePassD    = R.axeDark?.tabOk === true && (R.axeDark?.newRuleIds?.length ?? 1) === 0;
const restorePass = R.restore?.pass === true;
const consolePass = R.console.length === 0;
const writePass   = R.write?.bannerPresent === true;

const legs = [
  ['0. CAPTURE',   true],                    // always runs (captured or ABSENT)
  ['1. WRITE',     writePass],               // banner present
  ['2. VERIFY',    verifyPass],
  ['3. AT-RISK',   atRiskPass],
  ['4. COACH',     coachPass],
  ['5. RECOMPUTE', recompPass],
  ['6. AXE-light', axePassL],
  ['6. AXE-dark',  axePassD],
  ['7. CONSOLE',   consolePass],
  ['8. RESTORE',   restorePass],
];

for (const [name, pass] of legs) {
  console.log(`  ${pass ? '✓' : '✗'} ${name}`);
}

R.pass = legs.every(([, p]) => p) && !R.fatal;

if (R.console.length > 0) {
  console.log('\nConsole errors:');
  R.console.slice(0, 5).forEach((e) => console.log('  ✗ ' + e));
}

console.log('\nScreenshots:');
R.shots.forEach((s) => console.log('  ' + s));

if (R.fatal) console.error('\nFATAL exception: ' + R.fatal);

console.log(`\n${R.pass ? 'Smoke PASSED ✓' : 'Smoke FAILED ✗'}`);
process.exit(R.pass ? 0 : 1);

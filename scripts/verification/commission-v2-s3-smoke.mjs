// commission-v2-s3-smoke.mjs — Phase 5 smoke for Commission v2 Slice 3
// (feat/commission-v2-s3 — "Set as my goal" write + confirm affordance).
//
// E3 credential (AGENT). Write-read-verify with MANDATORY RESTORATION.
//
// Leg CAPTURE (Admin SDK)  : read agent's current personalAnnualAPI + company minimums.
// Leg WRITE (light UI)     : Goal Decomposition → set sentinel income → click "Save as My Goals"
//                            → verify confirm dialog (current / new values) → click "Set as my goal"
//                            → success state appears.
// Leg VERIFY (Admin SDK)   : SDK read confirms sentinel was written to Firestore doc.
// Leg STRIP-REDERIVE (both themes) : AnchorStrip gap chip re-derives against the sentinel goal
//                            (displayed == independent SDK recompute ±1 TTD).
// Leg AXE                  : NO-NEW vs bell-badge baseline (both themes).
// Leg SS                   : §2 screenshots (light: confirm dialog open; dark: strip re-derived).
// Leg RESTORE (Admin SDK)  : write back originalAPI + originalApps directly via Admin SDK.
//                            UI restore is not feasible: originalAPI maps to fewer apps than the
//                            company minimum when using default avgPolicyAPI (12000).
//                            *** RESTORE IS A PASS/FAIL LEG ***
//
//   node scripts/verification/commission-v2-s3-smoke.mjs [--url=<preview-url>]
//   node scripts/verification/commission-v2-s3-smoke.mjs --prod

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  safeLog,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  stamp,
} from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const GLOBAL_TIMEOUT_MS = 14 * 60 * 1000;
installGlobalTimeout(GLOBAL_TIMEOUT_MS);

const require = createRequire(import.meta.url);

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}
const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

const TOKEN       = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS  = requireEnv('A11Y_AGENT_PASSWORD');

const BASE_URL = resolveSmokeBaseUrl({
  defaultHost: 'agencytrack-git-feat-commission-v2-s3-kyron-marchan-s-projects.vercel.app',
});
const VIEWPORT = { width: 1280, height: 900 };
const SS_DIR = resolve('verification', 'commission-v2-s3-smoke');
mkdirSync(SS_DIR, { recursive: true });

const { AxeBuilder } = require('../../node_modules/@axe-core/playwright');

// ── Recompute helpers (mirrors commissionAnchor.js arithmetic inline) ──────
function _tsToDate(ts) { return ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null); }
function _ttYear(ts) { const d = _tsToDate(ts); return d ? d.getUTCFullYear() : null; }
function _weekStartMs(ts) {
  const d = _tsToDate(ts);
  if (!d) return 0;
  return d.getTime() - d.getUTCDay() * 86400000;
}
function _todayWeekMs(today) {
  const ttStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(today);
  const tt = new Date(`${ttStr}T04:00:00Z`);
  return tt.getTime() - tt.getUTCDay() * 86400000;
}
function recomputeYtdEarned(policies, year) {
  return policies
    .filter((p) => p.status === 'settled' && p.dateIssued && _ttYear(p.dateIssued) === year)
    .reduce((sum, p) => sum + (parseFloat(p.earnedCommission) || 0), 0);
}
function recomputeRunRate(policies, today) {
  const WEEK_MS = 7 * 86400000;
  const maxWK   = _todayWeekMs(today);
  const settled = policies.filter((p) => p.status === 'settled' && p.dateIssued && p.earnedCommission != null);
  const byWeek  = new Map();
  for (const p of settled) {
    const wk = _weekStartMs(p.dateIssued);
    if (wk > maxWK) continue;
    byWeek.set(wk, (byWeek.get(wk) || 0) + (parseFloat(p.earnedCommission) || 0));
  }
  if (byWeek.size === 0) return { value: 0, weekCount: 0, isLinear: true };
  const weekCount       = byWeek.size;
  const firstSettledWk  = Math.min(...byWeek.keys());
  const spanWeeks       = (maxWK - firstSettledWk) / WEEK_MS;
  if (spanWeeks >= 8) {
    let t8 = 0;
    for (let i = 0; i < 8; i++) t8 += byWeek.get(maxWK - i * WEEK_MS) || 0;
    return { value: (t8 / 8) * 52, weekCount, isLinear: false };
  }
  const ttStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(today);
  const year  = parseInt(ttStr.split('-')[0], 10);
  const jan1  = new Date(`${year}-01-01T04:00:00Z`);
  const jan1WkMs = jan1.getTime() - jan1.getUTCDay() * 86400000;
  const elapsed  = (maxWK - jan1WkMs) / WEEK_MS + 1;
  const ytd      = [...byWeek.values()].reduce((s, v) => s + v, 0);
  return { value: (ytd / elapsed) * 52, weekCount, isLinear: true };
}
function recomputeGapToGoal(committedAnnualAPI, runRateValue, commissionRate) {
  if (!committedAnnualAPI || committedAnnualAPI <= 0) return null;
  const goalAsCommission = committedAnnualAPI * (commissionRate / 100) * 1.0;
  return { goalAsCommission, gap: runRateValue - goalAsCommission };
}
function parseTTD(str) {
  if (!str) return null;
  const cleaned = (str + '').replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ── Result tracking ─────────────────────────────────────────────────────────
const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

// ── Axe allowlist (bell-badge baseline — pre-existing, approved) ─────────────
const SERIOUS_ALLOWLIST = [
  { name: 'pre-existing notification-bell badge', test: (h) => /\babsolute\b/.test(h) && /bg-danger/.test(h) && /text-white/.test(h) },
];
function isAllowlisted(node) {
  const html = (node.html || '') + ' ' + (node.target || []).join(' ');
  return SERIOUS_ALLOWLIST.some((e) => e.test(html));
}

// ── Admin SDK helpers ────────────────────────────────────────────────────────
async function initAdmin() {
  const adminModPath = resolve(process.cwd(), 'functions', 'node_modules', 'firebase-admin');
  const admin = require(adminModPath);
  if (!admin.apps.length) {
    const { existsSync } = require('fs');
    const keyPath = resolve(process.cwd(), 'functions', 'service-account-key.json');
    const initOpts = existsSync(keyPath) ? { credential: admin.credential.cert(keyPath) } : {};
    admin.initializeApp(initOpts);
  }
  return admin;
}

async function captureGoal(admin) {
  const adminAuth = admin.auth();
  const adminDb   = admin.firestore();
  const userRecord = await adminAuth.getUserByEmail(AGENT_EMAIL);
  const uid        = userRecord.uid;
  const tenantId   = userRecord.customClaims?.tenantId;
  if (!tenantId) throw new Error(`No tenantId claim on agent user — cannot scope reads`);
  const [goalDoc, minimsDoc] = await Promise.all([
    adminDb.doc(`tenants/${tenantId}/goals/${uid}`).get(),
    adminDb.doc(`tenants/${tenantId}/config/companyMinimums`).get(),
  ]);
  const personalAnnualAPI  = goalDoc.exists ? goalDoc.data().personalAnnualAPI  : null;
  const personalAnnualApps = goalDoc.exists ? goalDoc.data().personalAnnualApps : null;
  const annualApps = minimsDoc.exists ? (minimsDoc.data().annualApps ?? 42) : 42;
  return { uid, tenantId, personalAnnualAPI, personalAnnualApps, annualApps };
}

async function sdkRestoreGoal(admin, tenantId, uid, api, apps) {
  await admin.firestore().doc(`tenants/${tenantId}/goals/${uid}`).set({
    personalAnnualAPI:  api,
    personalAnnualApps: apps ?? 0,
    setBy:     uid,
    setByName: 'smoke-restore',
    updatedAt: admin.firestore.Timestamp.now(),
  }, { merge: true });
}

async function sdkReadGoal(admin, tenantId, uid) {
  const goalDoc = await admin.firestore().doc(`tenants/${tenantId}/goals/${uid}`).get();
  return goalDoc.exists ? goalDoc.data().personalAnnualAPI : null;
}

async function sdkReadPolicies(admin, tenantId, uid) {
  const snap = await admin.firestore().collection(`tenants/${tenantId}/policies`)
    .where('agentId', '==', uid).get();
  return snap.docs.map((d) => d.data());
}

async function sdkReadUserCommRate(admin, tenantId, uid) {
  const userDoc = await admin.firestore().doc(`tenants/${tenantId}/users/${uid}`).get();
  return parseFloat(userDoc.data()?.commissionRate) || 35;
}

// ── Browser helpers ──────────────────────────────────────────────────────────
async function loginAsAgent(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 25_000 });
  safeLog('[Auth] Agent logged in');
}

async function navigateToCommission(page) {
  const commTab = await page.$('[data-testid="agent-tab-commission"]');
  if (commTab) { await commTab.click(); }
  else {
    // mobile: look for Commission in nav text
    const navItems = await page.$$('nav a, nav button');
    for (const item of navItems) {
      const txt = (await item.textContent()) ?? '';
      if (/commission/i.test(txt)) { await item.click(); break; }
    }
  }
  await page.waitForTimeout(3000);
}

async function navigateToGoalDecomp(page) {
  const tabs = await page.$$('[role="tablist"] [role="tab"]');
  for (const tab of tabs) {
    const txt = (await tab.textContent()) ?? '';
    if (/decomp|goal/i.test(txt)) { await tab.click(); break; }
  }
  await page.waitForTimeout(1500);
}

async function fillIncomeGoal(page, value) {
  // NumField id = gdt-income-goal-ttd  (derived from label "Income Goal (TTD)")
  await page.waitForSelector('#gdt-income-goal-ttd', { timeout: 8000 });
  await page.fill('#gdt-income-goal-ttd', String(value));
  await page.waitForTimeout(600); // let reactive computation settle
}

async function openConfirmDialog(page) {
  // Verify Save as My Goals button is present and clickable
  await page.waitForSelector('[data-testid="commission-save-goal-btn"]', { timeout: 8000 });
  await page.click('[data-testid="commission-save-goal-btn"]');
  await page.waitForTimeout(800);
}

async function confirmWrite(page) {
  await page.waitForSelector('[data-testid="commission-confirm-btn"]', { timeout: 5000 });
  await page.click('[data-testid="commission-confirm-btn"]');
  // Wait for success state (button changes to "Goal Saved") or loading to clear
  try {
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="commission-save-goal-btn"]');
        return btn && /goal saved/i.test(btn.textContent || '');
      },
      { timeout: 8000 },
    );
  } catch (_) {
    // fallback: wait a moment for async write to complete
    await page.waitForTimeout(3000);
  }
}

async function waitForStripState(page) {
  for (let i = 0; i < 15; i++) {
    const s = await page.evaluate(() => {
      if (document.querySelector('[data-testid="commission-anchor-strip"]'))         return 'normal';
      if (document.querySelector('[data-testid="commission-anchor-strip-no-goal"]')) return 'no-goal';
      if (document.querySelector('[data-testid="commission-anchor-strip-error"]'))   return 'error';
      if (document.querySelector('[data-testid="commission-anchor-strip-loading"]')) return 'loading';
      return 'absent';
    });
    if (s !== 'loading') return s;
    await page.waitForTimeout(500);
  }
  return 'loading'; // timeout
}

// Strip re-derive check: given sentinelAPI, verify displayed gap == recomputed gap ±1 TTD
async function verifyStripRederive(page, admin, tenantId, uid, sentinelAPI, label) {
  const [policies, commRate] = await Promise.all([
    sdkReadPolicies(admin, tenantId, uid),
    sdkReadUserCommRate(admin, tenantId, uid),
  ]);
  const today   = new Date();
  const year    = today.getUTCFullYear();
  const ytd     = recomputeYtdEarned(policies, year);
  const rr      = recomputeRunRate(policies, today);
  const gapData = recomputeGapToGoal(sentinelAPI, rr.value, commRate);

  safeLog(`[SDK-recompute] ytd=${ytd.toFixed(2)} rate=${rr.value.toFixed(2)} goal=${(gapData?.goalAsCommission ?? 0).toFixed(2)} gap=${(gapData?.gap ?? 0).toFixed(2)}`);

  const displayed = await page.evaluate(() => {
    const strip = document.querySelector('[data-testid="commission-anchor-strip"]');
    if (!strip) return null;
    const chips = {};
    strip.querySelectorAll('.rounded-xl.border').forEach((el) => {
      const spans = el.querySelectorAll('span');
      if (spans.length >= 2) {
        const lbl = spans[0].textContent.trim().toLowerCase().replace(/[·•]/g, '').trim();
        chips[lbl] = spans[spans.length - 1].textContent.trim();
      }
    });
    let gapText = null;
    for (const el of strip.querySelectorAll('*')) {
      if (!el.children.length && el.textContent.trim() === 'Gap to goal') {
        gapText = el.nextElementSibling?.textContent?.trim() ?? null;
        break;
      }
    }
    return { chips, gapText };
  });

  if (!displayed) {
    record(`${label}-strip-rederive`, false, 'could not read strip DOM');
    return;
  }

  const dispGoal = parseTTD(displayed.chips['goal']);
  const gapRaw   = displayed.gapText ?? '';
  const gapSign  = gapRaw.startsWith('−') ? -1 : 1;
  const dispGap  = gapSign * (parseTTD(gapRaw) ?? 0);
  const TOL = 1;
  const goalOk = gapData !== null && dispGoal !== null
    && Math.abs(dispGoal - gapData.goalAsCommission) < TOL;
  const gapOk  = gapData !== null
    && Math.abs(dispGap  - gapData.gap) < TOL;
  const ok = goalOk && gapOk;

  record(`${label}-strip-rederive`,
    ok,
    ok
      ? `goal TTD${dispGoal} == recompute ${(gapData?.goalAsCommission ?? 0).toFixed(2)} · gap TTD${dispGap} == ${(gapData?.gap ?? 0).toFixed(2)} ✓`
      : `goal or gap mismatch: dispGoal=${dispGoal} recGoal=${(gapData?.goalAsCommission ?? 0).toFixed(2)} dispGap=${dispGap} recGap=${(gapData?.gap ?? 0).toFixed(2)}`);
}

// ── Main smoke ───────────────────────────────────────────────────────────────
async function runSmoke() {
  const browser = await chromium.launch({ headless: true });

  // ── Admin SDK setup ──────────────────────────────────────────────────────
  let admin;
  let capturedUID;
  let capturedTenantId;
  let originalAPI;
  let capturedOriginalApps;
  let capturedMinimums;

  try {
    admin = await initAdmin();
    const captured = await captureGoal(admin);
    capturedUID          = captured.uid;
    capturedTenantId     = captured.tenantId;
    originalAPI          = captured.personalAnnualAPI;
    capturedOriginalApps = captured.personalAnnualApps;
    capturedMinimums     = { annualApps: captured.annualApps };
    record('sdk-capture',
      originalAPI !== null,
      originalAPI !== null
        ? `personalAnnualAPI = ${originalAPI} (personalAnnualApps = ${capturedOriginalApps}, annualAppsMin = ${capturedMinimums.annualApps})`
        : `no committed goal on doc (annualAppsMin = ${capturedMinimums?.annualApps ?? 42})`);
  } catch (err) {
    record('sdk-capture', false, `Admin SDK init/capture failed: ${err.message}`);
    safeLog('[WARN] SDK capture failed — verify/restore legs will be skipped; UI legs continue');
  }

  // Decomposition defaults (src/utils/goalDecomposition.js DEFAULT_DECOMPOSITION_INPUTS):
  //   taxRate=25, persistencyRate=90, commissionRate=35, avgPolicyAPI=12000
  // apiToWrite = incomeGoal / ((1-taxRate/100) * (persistencyRate/100) * (commissionRate/100))
  //            = incomeGoal / (0.75 * 0.90 * 0.35) = incomeGoal / 0.23625
  const DECOMP_FACTOR = 0.75 * 0.90 * 0.35; // 0.23625
  const DEFAULT_AVG_POLICY_API = 12000;

  // Sentinel must exceed both the API floor (200k fallback) and the apps minimum.
  // apps = apiToWrite / DEFAULT_AVG_POLICY_API → need apiToWrite ≥ minAnnualApps * 12000
  const minAnnualApps = capturedMinimums?.annualApps ?? 42;
  const SENTINEL_API_TARGET = Math.max(200000, minAnnualApps * DEFAULT_AVG_POLICY_API) * 1.25;
  const SENTINEL_INCOME = Math.ceil(SENTINEL_API_TARGET * DECOMP_FACTOR / 5000) * 5000;
  const SENTINEL_API_APPROX = SENTINEL_INCOME / DECOMP_FACTOR;
  safeLog(`[Sentinel] income=${SENTINEL_INCOME} → apiToWrite≈${Math.round(SENTINEL_API_APPROX)} (apps≈${(SENTINEL_API_APPROX/DEFAULT_AVG_POLICY_API).toFixed(1)} vs min=${minAnnualApps})`);

  // ── Phase B: Light context — write sentinel ────────────────────────────
  console.log('\n=== LIGHT MODE — WRITE CYCLE ===');
  const lightCtx = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(lightCtx, BASE_URL, TOKEN);
  const lightPage = await lightCtx.newPage();
  const lightCapture = captureConsoleAndNetwork(lightPage);

  try {
    await loginAsAgent(lightPage);
    await setTheme(lightPage, false);

    await navigateToCommission(lightPage);
    const stripBeforeWrite = await waitForStripState(lightPage);
    record('light-strip-before-write',
      stripBeforeWrite !== 'absent',
      `AnchorStrip state before write: ${stripBeforeWrite}`);

    await navigateToGoalDecomp(lightPage);

    // Fill sentinel income goal
    await fillIncomeGoal(lightPage, SENTINEL_INCOME);

    // Open confirm dialog
    await openConfirmDialog(lightPage);

    // Verify confirm dialog visible
    const dialogVisible = await lightPage.isVisible('[data-testid="commission-confirm-dialog"]');
    record('light-confirm-dialog-opens', dialogVisible,
      dialogVisible ? 'confirm dialog opened after clicking "Save as My Goals"' : 'confirm dialog NOT visible');

    // Read current/new values from dialog
    let confirmCurrentText = '';
    let confirmNewText = '';
    if (dialogVisible) {
      try {
        confirmCurrentText = await lightPage.textContent('[data-testid="commission-confirm-current"]');
        confirmNewText     = await lightPage.textContent('[data-testid="commission-confirm-new"]');
        safeLog(`[Confirm dialog] current="${confirmCurrentText}" new="${confirmNewText}"`);

        const sentinelInDialog = parseTTD(confirmNewText);
        // Dialog shows formatCurrency(Math.round(apiToWrite)) — compare to nearest integer
        const sentinelOk = sentinelInDialog !== null
          && Math.abs(sentinelInDialog - Math.round(SENTINEL_API_APPROX)) < 2;
        record('light-confirm-new-value',
          sentinelOk,
          sentinelOk
            ? `confirm-new TTD${sentinelInDialog} == rounded sentinel ${Math.round(SENTINEL_API_APPROX)} ✓`
            : `confirm-new "${confirmNewText}" (parsed=${sentinelInDialog}) vs expected ${Math.round(SENTINEL_API_APPROX)}`);

        // Verify current shows original goal (if captured)
        if (originalAPI !== null) {
          const displayedCurrent = parseTTD(confirmCurrentText);
          const currentOk = displayedCurrent !== null
            && Math.abs(displayedCurrent - originalAPI) < 10;
          record('light-confirm-current-value',
            currentOk,
            currentOk
              ? `confirm-current TTD${displayedCurrent} ≈ captured original ${originalAPI} ✓`
              : `confirm-current "${confirmCurrentText}" (parsed=${displayedCurrent}) vs captured ${originalAPI}`);
        }
      } catch (e) {
        record('light-confirm-dialog-values', false, `error reading dialog values: ${e.message}`);
      }
    }

    // §2 screenshot: light mode with confirm dialog open
    await lightPage.screenshot({ path: resolve(SS_DIR, 'light-confirm-dialog.png'), fullPage: false });

    // Click "Set as my goal" to confirm write
    if (dialogVisible) {
      await confirmWrite(lightPage);
    }

    const successVisible = await lightPage.evaluate(() => {
      const btn = document.querySelector('[data-testid="commission-save-goal-btn"]');
      return btn ? /goal saved/i.test(btn.textContent || '') : false;
    });
    record('light-write-success-state',
      successVisible,
      successVisible ? '"Goal Saved" success state appeared after confirm write' : 'success state not detected (may have timed out)');

    // Wait for onGoalSaved → goals state refresh → strip re-render
    await lightPage.waitForTimeout(2500);

    // SDK verify sentinel was written (tolerance 2 — float arithmetic on repeating decimals)
    if (admin && capturedUID) {
      try {
        const written = await sdkReadGoal(admin, capturedTenantId, capturedUID);
        const writtenOk = written !== null
          && Math.abs(written - SENTINEL_API_APPROX) < 2;
        record('sdk-verify-write',
          writtenOk,
          writtenOk
            ? `Firestore personalAnnualAPI = ${written} ≈ sentinel ${SENTINEL_API_APPROX.toFixed(2)} ✓`
            : `Firestore personalAnnualAPI = ${written} — expected ~${SENTINEL_API_APPROX.toFixed(2)}`);
      } catch (e) {
        record('sdk-verify-write', false, `SDK read after write failed: ${e.message}`);
      }
    }

    // Strip re-derives against sentinel (light)
    // Navigate to commission tab to see the updated strip
    await navigateToCommission(lightPage);
    await lightPage.waitForTimeout(2000);
    const stripAfterWrite = await waitForStripState(lightPage);
    record('light-strip-after-write',
      stripAfterWrite === 'normal',
      `AnchorStrip state after write: ${stripAfterWrite} (expect "normal" since sentinel > 0)`);

    if (stripAfterWrite === 'normal' && admin && capturedUID) {
      await verifyStripRederive(lightPage, admin, capturedTenantId, capturedUID, SENTINEL_API_APPROX, 'light');
    }

    // Axe — light
    const axeLight = await new AxeBuilder({ page: lightPage })
      .withTags(['wcag2a', 'wcag2aa']).analyze();
    const newSeriousLight = axeLight.violations.filter(
      (v) => v.impact === 'serious' && v.nodes.some((n) => !isAllowlisted(n)),
    );
    record('light-axe-no-new',
      newSeriousLight.length === 0,
      newSeriousLight.length === 0
        ? 'axe: 0 new serious violations vs bell-badge baseline ✓'
        : `${newSeriousLight.length} new serious: ${newSeriousLight.map((v) => v.id).join(', ')}`);

    // RESTORE — Admin SDK (UI restore not feasible: originalAPI maps to fewer apps than the
    // company minimum with the playground's default avgPolicyAPI=12000)
    if (originalAPI !== null && capturedUID && capturedTenantId) {
      console.log('\n=== SDK RESTORE ===');
      try {
        await sdkRestoreGoal(admin, capturedTenantId, capturedUID, originalAPI, capturedOriginalApps);
        record('sdk-restore-write', true, `Admin SDK restore submitted: personalAnnualAPI=${originalAPI}, personalAnnualApps=${capturedOriginalApps}`);

        await lightPage.waitForTimeout(1000); // let Firestore propagate

        const restored = await sdkReadGoal(admin, capturedTenantId, capturedUID);
        const restoreOk = restored !== null && Math.abs(restored - originalAPI) < 1;
        record('sdk-verify-restore',
          restoreOk,
          restoreOk
            ? `*** RESTORE VERIFIED — Firestore personalAnnualAPI = ${restored} == original ${originalAPI} ✓ ***`
            : `*** RESTORE FAILED — Firestore personalAnnualAPI = ${restored}; expected ${originalAPI} ***`);
        if (!restoreOk) {
          safeLog('[CRITICAL] RESTORE LEG FAILED — MANUAL INTERVENTION REQUIRED');
          safeLog(`[CRITICAL] Run: firebase firestore update tenants/${capturedTenantId}/goals/${capturedUID} personalAnnualAPI=${originalAPI}`);
        }
      } catch (e) {
        record('sdk-verify-restore', false, `*** RESTORE EXCEPTION: ${e.message} ***`);
        safeLog('[CRITICAL] RESTORE EXCEPTION — MANUAL INTERVENTION REQUIRED');
      }
    } else {
      record('restore-skipped', true, 'RESTORE skipped — no pre-existing goal to restore');
    }

    console.log(formatCaptureReport(lightCapture));
  } finally {
    await lightCtx.close();
  }

  // ── Phase C: Dark context — strip re-derives + axe + screenshot ───────────
  console.log('\n=== DARK MODE ===');
  const darkCtx = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(darkCtx, BASE_URL, TOKEN);
  const darkPage = await darkCtx.newPage();
  const darkCapture = captureConsoleAndNetwork(darkPage);

  try {
    await loginAsAgent(darkPage);
    await setTheme(darkPage, true);

    await navigateToCommission(darkPage);
    await darkPage.waitForTimeout(2000);
    const stripStateDark = await waitForStripState(darkPage);
    record('dark-strip-state',
      stripStateDark !== 'absent',
      `AnchorStrip state in dark: ${stripStateDark} (original restored — expect "normal")`);

    if (stripStateDark === 'normal' && admin && capturedUID && originalAPI !== null) {
      await verifyStripRederive(darkPage, admin, capturedTenantId, capturedUID, originalAPI, 'dark');
    }

    // §2 screenshot: dark mode strip after restore
    await darkPage.screenshot({ path: resolve(SS_DIR, 'dark-strip-restored.png'), fullPage: false });

    // Axe — dark
    const axeDark = await new AxeBuilder({ page: darkPage })
      .withTags(['wcag2a', 'wcag2aa']).analyze();
    const newSeriousDark = axeDark.violations.filter(
      (v) => v.impact === 'serious' && v.nodes.some((n) => !isAllowlisted(n)),
    );
    record('dark-axe-no-new',
      newSeriousDark.length === 0,
      newSeriousDark.length === 0
        ? 'axe: 0 new serious violations vs bell-badge baseline ✓'
        : `${newSeriousDark.length} new serious: ${newSeriousDark.map((v) => v.id).join(', ')}`);

    console.log(formatCaptureReport(darkCapture));
  } finally {
    await darkCtx.close();
  }

  await browser.close();

  // ── Summary ──────────────────────────────────────────────────────────────
  const total  = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`commission-v2-s3-smoke: ${passed}/${total}`);
  if (failed.length > 0) {
    console.log('\nFailed legs:');
    for (const r of failed) console.log(`  ✗ ${r.leg}: ${r.detail}`);
  }

  const restoreResult = results.find((r) => r.leg === 'sdk-verify-restore');
  if (restoreResult && !restoreResult.passed) {
    console.log('\n*** CRITICAL: RESTORE LEG FAILED — MANUAL INTERVENTION REQUIRED ***');
    console.log(`    Agent ${AGENT_EMAIL}: set personalAnnualAPI=${originalAPI} personalAnnualApps=${capturedOriginalApps}`);
    console.log(`    Firestore path: tenants/${capturedTenantId}/goals/${capturedUID}`);
  }

  finishSmoke(results);
}

runSmoke().catch((err) => {
  console.error('[smoke CRASH]', err);
  process.exit(1);
});

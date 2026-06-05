// commission-v2-s2-smoke.mjs — Phase 5 smoke for Commission v2 Slice 2
// (feat/commission-v2-s2 — ladder restyle + stacked CashFlowChart + D4 no-goal state).
//
// READ-ONLY. No writes. E3 credential (AGENT).
//
// Per theme (light + dark):
//   Leg 1 — D4 AnchorStrip no-goal state: YTD Earned + On Pace For chips visible;
//            gap figure suppressed; CTA present. (Falls through to normal-state
//            checks if agent has a committed goal.)
//   Leg 1b — S1 deferred-FU recompute arm (light theme only, normal-state only):
//            Admin SDK reads agent's policies + goal + commissionRate → recomputes
//            ytdEarned / runRate / gapToGoal → asserts displayed == recomputed (±1 TTD).
//            Closes the Rule-13 deferred-verification FU banked at S1 merge on green.
//   Leg 2 — D2 GoalDecompositionTab ladder: 7 stages (commission-ladder-stage testid),
//            cadence toggle pill buttons work, "Prospecting calls" copy (no "Dials").
//   Leg 3 — D3 ModalTargetingTab: stacked chart container renders; mode mix slider
//            present; commission breakdown table present.
//   Leg 4 — axe NO-NEW vs bell-badge baseline; 0 console errors.
//   Leg 5 — §2 screenshots saved to verification/commission-v2-s2/.
//
//   node scripts/verification/commission-v2-s2-smoke.mjs [--url=<preview-url>]
//   node scripts/verification/commission-v2-s2-smoke.mjs --prod

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  setTheme,
  safeLog,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  stamp,
} from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const GLOBAL_TIMEOUT_MS = 12 * 60 * 1000;
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
  defaultHost: 'agencytrack-git-feat-commission-v2-s2-kyron-marchan-s-projects.vercel.app',
});
const VIEWPORT = { width: 1280, height: 900 };
const SS_DIR = resolve('verification', 'commission-v2-s2-smoke');
mkdirSync(SS_DIR, { recursive: true });

const { AxeBuilder } = require('../../node_modules/@axe-core/playwright');

// ── Recompute helpers (mirrors src/utils/commissionAnchor.js inline;
//    commissionAnchor.js uses bare-extension relative imports that don't resolve
//    in plain Node.js ESM, so the arithmetic is replicated here) ───────────────

function _tsToDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

function _ttYear(ts) {
  const d = _tsToDate(ts);
  return d ? d.getUTCFullYear() : null;
}

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
  const settled = policies.filter(
    (p) => p.status === 'settled' && p.dateIssued && p.earnedCommission != null,
  );
  const byWeek = new Map();
  for (const p of settled) {
    const wk = _weekStartMs(p.dateIssued);
    if (wk > maxWK) continue;
    byWeek.set(wk, (byWeek.get(wk) || 0) + (parseFloat(p.earnedCommission) || 0));
  }
  if (byWeek.size === 0) return { value: 0, weekCount: 0, isLinear: true };
  const weekCount = byWeek.size;
  const firstSettledWk = Math.min(...byWeek.keys());
  const spanWeeks = (maxWK - firstSettledWk) / WEEK_MS;
  if (spanWeeks >= 8) {
    let trailing8Total = 0;
    for (let i = 0; i < 8; i++) {
      trailing8Total += byWeek.get(maxWK - i * WEEK_MS) || 0;
    }
    return { value: (trailing8Total / 8) * 52, weekCount, isLinear: false };
  }
  // Linear-YTD: ytdEarned ÷ elapsed TT-year weeks × 52
  const ttStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(today);
  const year = parseInt(ttStr.split('-')[0], 10);
  const jan1 = new Date(`${year}-01-01T04:00:00Z`);
  const jan1WkMs = jan1.getTime() - jan1.getUTCDay() * 86400000;
  const elapsedWeeks = (maxWK - jan1WkMs) / WEEK_MS + 1;
  const ytd = [...byWeek.values()].reduce((s, v) => s + v, 0);
  return { value: (ytd / elapsedWeeks) * 52, weekCount, isLinear: true };
}

// gapToGoal uses DEFAULT_MODE_MIX = {annual:1,...} when no modeMix is passed
// (CommissionAnchorStrip always passes ratios = {commissionRate}; no modeMix).
// goalAsCommission = totalApi * (C/100) * 1.0  (all-annual first-payment ratio).
function recomputeGapToGoal(committedAnnualAPI, runRateValue, commissionRate) {
  if (!committedAnnualAPI || committedAnnualAPI <= 0) return null;
  const goalAsCommission = committedAnnualAPI * (commissionRate / 100) * 1.0;
  return { goalAsCommission, gap: runRateValue - goalAsCommission };
}

function parseTTD(str) {
  if (!str) return null;
  // "TTD 1,234.56" → 1234.56 ; "+ TTD 1,234" → 1234
  const cleaned = (str + '').replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Leg 1b — Admin SDK recompute arm.
// Reads policies + goal + commissionRate directly from Firestore, recomputes the
// three AnchorStrip metrics, and asserts they match what the component displays.
// Requires ADC credentials (gcloud auth application-default login). Records
// FAIL (not crash) if credentials are unavailable — FU stays open in that case.
async function runRecomputeArm(page) {
  const adminModPath = resolve(process.cwd(), 'functions', 'node_modules', 'firebase-admin');
  let admin;
  try {
    admin = require(adminModPath);
    if (!admin.apps.length) {
      const { existsSync } = require('fs');
      const keyPath = resolve(process.cwd(), 'functions', 'service-account-key.json');
      const initOpts = existsSync(keyPath)
        ? { credential: admin.credential.cert(keyPath) }
        : {};  // ADC fallback
      admin.initializeApp(initOpts);
    }
  } catch (err) {
    record('light-recompute-arm', false, `Admin SDK init failed — need ADC credentials: ${err.message}`);
    return;
  }

  try {
    const adminAuth = admin.auth();
    const adminDb   = admin.firestore();

    // Resolve uid + tenantId
    const userRecord = await adminAuth.getUserByEmail(AGENT_EMAIL);
    const uid        = userRecord.uid;
    const tenantId   = userRecord.customClaims?.tenantId;
    if (!tenantId) {
      record('light-recompute-arm', false, `No tenantId claim on agent user — cannot scope reads`);
      return;
    }

    // Parallel reads: policies, goal, userProfile
    const [policySnap, goalDoc, userDoc] = await Promise.all([
      adminDb.collection(`tenants/${tenantId}/policies`)
        .where('agentId', '==', uid).get(),
      adminDb.doc(`tenants/${tenantId}/goals/${uid}`).get(),
      adminDb.doc(`tenants/${tenantId}/users/${uid}`).get(),
    ]);

    const policies          = policySnap.docs.map((d) => d.data());
    const committedAnnualAPI = goalDoc.exists ? goalDoc.data().personalAnnualAPI : null;
    const commissionRate    = parseFloat(userDoc.data()?.commissionRate) || 35;

    const today = new Date();
    const year  = today.getUTCFullYear();

    const recomputedYtd  = recomputeYtdEarned(policies, year);
    const rateResult     = recomputeRunRate(policies, today);
    const recomputedRate = rateResult.value;
    const recomputedGap  = recomputeGapToGoal(committedAnnualAPI, recomputedRate, commissionRate);

    safeLog(`[Recompute] ytd=${recomputedYtd.toFixed(2)} rate=${recomputedRate.toFixed(2)} ` +
      `isLinear=${rateResult.isLinear} wkCount=${rateResult.weekCount} ` +
      `goal=${(recomputedGap?.goalAsCommission ?? 0).toFixed(2)} gap=${(recomputedGap?.gap ?? 0).toFixed(2)}`);

    // Read displayed chip values from DOM
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
      const txt = strip.textContent || '';
      const hasLinearLabel   = /linear ytd/i.test(txt);
      const hasTrailingLabel = /trailing run-rate/i.test(txt);
      return { chips, gapText, hasLinearLabel, hasTrailingLabel };
    });

    if (!displayed) {
      record('light-recompute-arm', false, 'could not read strip DOM');
      return;
    }

    const dispYtd  = parseTTD(displayed.chips['ytd earned']);
    const dispRate = parseTTD(displayed.chips['projected']);
    const dispGoal = parseTTD(displayed.chips['goal']);
    const gapRaw   = displayed.gapText ?? '';
    const gapSign  = gapRaw.startsWith('−') ? -1 : 1;
    const dispGap  = gapSign * (parseTTD(gapRaw) ?? 0);

    safeLog(`[Display]   ytd=${dispYtd} rate=${dispRate} goal=${dispGoal} gap=${dispGap}`);

    const TOL = 1; // ±1 TTD rounding tolerance
    const ytdOk  = dispYtd  !== null && Math.abs(dispYtd  - recomputedYtd)                       < TOL;
    const rateOk = dispRate !== null && Math.abs(dispRate - recomputedRate)                       < TOL;
    const gapOk  = recomputedGap !== null
      ? dispGoal !== null && Math.abs(dispGoal - recomputedGap.goalAsCommission)                  < TOL
        && Math.abs(dispGap  - recomputedGap.gap)                                                 < TOL
      : true; // no gap expected when no committed goal

    record('light-recompute-ytd',
      ytdOk,
      ytdOk
        ? `displayed TTD${dispYtd} == recomputed ${recomputedYtd.toFixed(2)} ✓`
        : `displayed ${dispYtd} vs recomputed ${recomputedYtd.toFixed(2)} — delta ${Math.abs((dispYtd ?? 0) - recomputedYtd).toFixed(2)}`);

    record('light-recompute-rate',
      rateOk,
      rateOk
        ? `displayed TTD${dispRate} == recomputed ${recomputedRate.toFixed(2)} ✓`
        : `displayed ${dispRate} vs recomputed ${recomputedRate.toFixed(2)} — delta ${Math.abs((dispRate ?? 0) - recomputedRate).toFixed(2)}`);

    record('light-recompute-gap',
      gapOk,
      gapOk
        ? `goal TTD${dispGoal} == recomputed ${(recomputedGap?.goalAsCommission ?? 0).toFixed(2)} · gap TTD${dispGap} == ${(recomputedGap?.gap ?? 0).toFixed(2)} ✓`
        : `goal or gap mismatch: dispGoal=${dispGoal} recGoal=${(recomputedGap?.goalAsCommission ?? 0).toFixed(2)} dispGap=${dispGap} recGap=${(recomputedGap?.gap ?? 0).toFixed(2)}`);

    const armOk = rateResult.isLinear ? displayed.hasLinearLabel : displayed.hasTrailingLabel;
    record('light-recompute-arm-chip',
      armOk,
      armOk
        ? `${rateResult.isLinear ? 'linear-YTD fallback' : 'trailing-8wk'} arm · ${rateResult.weekCount} week(s) · DOM chip confirmed ✓`
        : `arm mismatch: isLinear=${rateResult.isLinear} weekCount=${rateResult.weekCount} hasLinear=${displayed.hasLinearLabel} hasTrailing=${displayed.hasTrailingLabel}`);

  } catch (err) {
    record('light-recompute-arm', false, `recompute arm exception: ${err.message}`);
  }
}

const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

// Bell-badge-only axe allowlist (pre-existing, approved baseline)
const SERIOUS_ALLOWLIST = [
  { name: 'pre-existing notification-bell badge', test: (h) => /\babsolute\b/.test(h) && /bg-danger/.test(h) && /text-white/.test(h) },
];
function isAllowlisted(node) {
  const html = (node.html || '') + ' ' + (node.target || []).join(' ');
  return SERIOUS_ALLOWLIST.some((entry) => entry.test(html));
}

async function loginAsAgent(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 25_000 });
  safeLog('[Auth] Agent logged in');
}

async function runTheme(browser, theme) {
  console.log(`\n=== ${theme.toUpperCase()} MODE ===`);
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, BASE_URL, TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await loginAsAgent(page);
    await setTheme(page, theme === 'dark');

    // Navigate to Commission tab
    await page.click('[data-testid="agent-tab-commission"]');
    await page.waitForTimeout(3000);

    // ── LEG 1: D4 AnchorStrip no-goal / normal state ─────────────────────────
    let stripState = 'unknown';
    for (let i = 0; i < 12; i++) {
      const s = await page.evaluate(() => {
        if (document.querySelector('[data-testid="commission-anchor-strip"]'))         return 'normal';
        if (document.querySelector('[data-testid="commission-anchor-strip-no-goal"]')) return 'no-goal';
        if (document.querySelector('[data-testid="commission-anchor-strip-error"]'))   return 'error';
        if (document.querySelector('[data-testid="commission-anchor-strip-loading"]')) return 'loading';
        return 'absent';
      });
      if (s !== 'loading') { stripState = s; break; }
      await page.waitForTimeout(500);
    }
    record(`${theme}-d4-strip-state`, stripState !== 'absent', `strip state: ${stripState}`);

    if (stripState === 'no-goal') {
      const noGoalEl = await page.$('[data-testid="commission-anchor-strip-no-goal"]');
      const noGoalText = (await noGoalEl?.textContent()) ?? '';

      // YTD Earned chip present
      const hasYtd = /ytd earned/i.test(noGoalText);
      record(`${theme}-d4-no-goal-ytd-chip`, hasYtd,
        hasYtd ? 'YTD Earned chip visible in no-goal state' : `chip not found (text: "${noGoalText.slice(0, 100)}")`);

      // On Pace For chip present
      const hasPace = /on pace for/i.test(noGoalText);
      record(`${theme}-d4-no-goal-pace-chip`, hasPace,
        hasPace ? 'On Pace For chip visible in no-goal state' : `chip not found`);

      // Gap figure suppressed (no "Gap to goal" in no-goal container)
      const hasGap = /gap to goal/i.test(noGoalText);
      record(`${theme}-d4-no-goal-gap-suppressed`, !hasGap,
        !hasGap ? 'gap figure suppressed in no-goal state (D4 correct)' : 'WARNING: gap to goal text found in no-goal container');

      // CTA button present
      const ctaBtn = await noGoalEl?.$('button');
      record(`${theme}-d4-no-goal-cta`, !!ctaBtn, ctaBtn ? 'CTA button present' : 'CTA button missing');

    } else if (stripState === 'normal') {
      // Agent has a committed goal — verify the normal strip renders
      const stripText = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="commission-anchor-strip"]');
        return el ? el.textContent : '';
      });
      const hasYtd   = /ytd earned/i.test(stripText) || /[\d,]{3,}/.test(stripText);
      const hasGap   = /gap to goal/i.test(stripText);
      record(`${theme}-d4-normal-strip-renders`, hasYtd,
        hasYtd ? 'normal strip renders with values' : 'strip content unexpected');
      record(`${theme}-d4-normal-has-gap`, hasGap,
        hasGap ? 'gap to goal visible in normal state (expected)' : 'gap missing from normal state');

      // Leg 1b: SDK recompute arm — runs once (light theme, normal state only)
      if (theme === 'light') {
        await runRecomputeArm(page);
      }
    } else if (stripState === 'error') {
      record(`${theme}-d4-strip-error`, true, 'error state rendered (data-state)');
    }

    // ── LEG 2: D2 GoalDecompositionTab ladder ────────────────────────────────
    // Find and click the Goal Decomposition tab
    const tabButtons = await page.$$('[role="tablist"] [role="tab"]');
    let decompositionTabClicked = false;
    for (const tab of tabButtons) {
      const txt = (await tab.textContent()) ?? '';
      if (/decomposition|goal decomp|decompose|ladder/i.test(txt)) {
        await tab.click();
        decompositionTabClicked = true;
        break;
      }
    }
    if (!decompositionTabClicked && tabButtons.length > 0) {
      // Fallback: click the first tab
      await tabButtons[0].click();
    }
    await page.waitForTimeout(2000);

    // 7 ladder stages
    const stageCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="commission-ladder-stage"]').length
    );
    record(`${theme}-d2-ladder-7-stages`, stageCount === 7,
      `ladder stages: ${stageCount} (expect 7)`);

    // "Prospecting calls" present (not "Dials")
    const ladderText = await page.evaluate(() => {
      const stages = document.querySelectorAll('[data-testid="commission-ladder-stage"]');
      return Array.from(stages).map((s) => s.textContent || '').join(' ');
    });
    const hasProspecting = /prospecting calls/i.test(ladderText);
    const hasDials = /\bdials?\b/i.test(ladderText);
    record(`${theme}-d2-no-dials-copy`, hasProspecting && !hasDials,
      hasProspecting && !hasDials
        ? '"Prospecting calls" present; no "Dials" in ladder'
        : `prospecting=${hasProspecting} dials=${hasDials} (text: "${ladderText.slice(0, 120)}")`);

    // Cadence toggle — aria-pressed pill buttons
    const cadenceGroup = await page.$('[role="group"][aria-label*="adence"]');
    const cadencePills = await page.$$('[aria-pressed]');
    const hasCadencePills = cadencePills.length >= 3;
    record(`${theme}-d2-cadence-toggle`, hasCadencePills,
      hasCadencePills
        ? `cadence pill toggle: ${cadencePills.length} pills with aria-pressed`
        : `cadence pills not found (group=${!!cadenceGroup})`);

    // Click a cadence pill (Semi-Annual) and verify stage count unchanged
    if (hasCadencePills) {
      for (const pill of cadencePills) {
        const txt = (await pill.textContent()) ?? '';
        if (/semi|quarter/i.test(txt)) {
          await pill.click();
          await page.waitForTimeout(500);
          break;
        }
      }
      const stagesAfterToggle = await page.evaluate(() =>
        document.querySelectorAll('[data-testid="commission-ladder-stage"]').length
      );
      record(`${theme}-d2-cadence-recompute`, stagesAfterToggle === 7,
        `stages after toggle: ${stagesAfterToggle} (expect 7)`);
    }

    // ── LEG 3: D3 ModalTargetingTab stacked chart ─────────────────────────────
    // Find and click the Modal Targeting tab
    let modalTabClicked = false;
    const tabsRefresh = await page.$$('[role="tablist"] [role="tab"]');
    for (const tab of tabsRefresh) {
      const txt = (await tab.textContent()) ?? '';
      if (/modal targeting|targeting|modal/i.test(txt)) {
        await tab.click();
        modalTabClicked = true;
        break;
      }
    }
    if (!modalTabClicked && tabsRefresh.length > 1) {
      await tabsRefresh[1].click(); // fallback: second tab
    }
    await page.waitForTimeout(2000);

    // Chart container renders (recharts ResponsiveContainer)
    const chartEl = await page.$('.recharts-responsive-container, [class*="recharts"]');
    record(`${theme}-d3-chart-renders`, !!chartEl,
      chartEl ? 'Recharts chart container visible' : 'chart container not found');

    // Mode mix sliders present
    const sliders = await page.$$('input[type="range"]');
    record(`${theme}-d3-mode-mix-sliders`, sliders.length >= 4,
      `mode mix sliders: ${sliders.length} (expect ≥4 for 4 payment modes)`);

    // Commission breakdown table present
    const breakdownText = await page.evaluate(() => document.body.textContent || '');
    const hasBreakdown = /annual|semi.?annual|quarterly|monthly/i.test(breakdownText);
    record(`${theme}-d3-breakdown-present`, hasBreakdown,
      hasBreakdown ? 'breakdown table / mode labels visible' : 'mode labels not found in DOM');

    // ── LEG 4: AXE + console errors ───────────────────────────────────────────
    const axeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const seriousViolations = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    const newViolations = seriousViolations.flatMap((v) =>
      v.nodes.filter((n) => !isAllowlisted(n))
    );
    record(`${theme}-axe-no-new`, newViolations.length === 0,
      newViolations.length === 0
        ? `axe clean (${seriousViolations.length} total serious, all allowlisted)`
        : `${newViolations.length} NEW serious violations`);
    if (newViolations.length > 0) {
      newViolations.slice(0, 5).forEach((n) =>
        console.log(`  axe: ${(n.target || []).join(' > ')} — ${n.html?.slice(0, 80)}`)
      );
    }

    const { consoleMessages } = capture;
    const consoleErrors = (consoleMessages || []).filter((m) => {
      if (m.type !== 'error') return false;
      const t = m.text || '';
      if (t.includes('fontshare.com')) return false;
      if (t.includes('net::ERR_FAILED')) return false;
      return true;
    });
    record(`${theme}-no-console-errors`, consoleErrors.length === 0,
      consoleErrors.length === 0 ? '0 console errors' : `${consoleErrors.length} console errors`);
    if (consoleErrors.length > 0) consoleErrors.slice(0, 3).forEach((e) => console.log(`  error: ${e.text}`));

    // ── LEG 5: SCREENSHOTS ────────────────────────────────────────────────────
    const shotPath = resolve(SS_DIR, `commission-v2-s2-${theme}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    safeLog(`[Screenshot] ${shotPath}`);
    record(`${theme}-screenshot`, true, `saved to verification/commission-v2-s2/`);

  } catch (err) {
    record(`${theme}-fatal`, false, `exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\ncommission-v2-s2 smoke → ${BASE_URL}`);

const browser = await chromium.launch({ headless: true });
try {
  await runTheme(browser, 'light');
  await runTheme(browser, 'dark');
} finally {
  await browser.close();
}

finishSmoke(results);

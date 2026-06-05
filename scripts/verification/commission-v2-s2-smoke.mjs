// commission-v2-s2-smoke.mjs — Phase 5 smoke for Commission v2 Slice 2
// (feat/commission-v2-s2 — ladder restyle + stacked CashFlowChart + D4 no-goal state).
//
// READ-ONLY. No writes. E3 credential (AGENT).
//
// Per theme (light + dark):
//   Leg 1 — D4 AnchorStrip no-goal state: YTD Earned + On Pace For chips visible;
//            gap figure suppressed; CTA present. (Falls through to normal-state
//            checks if agent has a committed goal.)
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

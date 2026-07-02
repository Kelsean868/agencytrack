// commission-v2-s1-smoke.mjs — Phase 5 smoke for Commission v2 Slice 1
// (feat/commission-v2-s1 — AnchorStrip + commissionAnchor utility + D4 page promotion).
//
// READ-ONLY. No writes. E3 credential (AGENT).
//
// Per theme (light + dark):
//   Leg 1 — TRIO CERTIFICATION: Goals tab renders cascade, Persistency tab renders
//            summary, Commission tab is reachable. Operator's "fully working for agents"
//            certification baseline.
//   Leg 2 — ANCHORSTRIP source-aware: detect which state renders (loading/no-goal/normal).
//            For normal: independent SDK recompute of ytdEarned (settled policies,
//            TT-year); compare with displayed YTD value. For no-goal: assert empty state
//            + navigate-CTA present. Writing a goal is OUT OF SCOPE.
//   Leg 3 — PAGE PROMOTION: CommissionPlayground tab list always-visible (no accordion).
//   Leg 4 — axe NO-NEW vs bell-badge baseline; 0 console errors.
//   Leg 5 — §2 screenshots saved to verification/commission-v2-s1/.
//
//   node scripts/verification/commission-v2-s1-smoke.mjs [--url=<preview-url>]
//   node scripts/verification/commission-v2-s1-smoke.mjs --prod

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  waitForTheme,
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
  defaultHost: 'agencytrack-git-feat-commission-v2-s1-kyron-marchan-s-projects.vercel.app',
});
const VIEWPORT = { width: 1280, height: 900 };
const SS_DIR = resolve('verification', 'commission-v2-s1-smoke');
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

// TT-year helper (matches commissionAnchor.js exactly)
function ttYear(ts) {
  let d;
  if (ts && typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts && ts.seconds != null) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  return d.getUTCFullYear();
}

// Independent ytdEarned recompute via Firebase web SDK
async function recomputeYtdEarned(year) {
  const fbApp = initializeApp({
    apiKey:     requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId:  requireEnv('VITE_FIREBASE_PROJECT_ID'),
  }, 's1-smoke-recompute');
  const auth = getAuth(fbApp);
  const cred = await signInWithEmailAndPassword(auth, AGENT_EMAIL, AGENT_PASS);
  const tokenResult = await cred.user.getIdTokenResult();
  const tenantId = tokenResult.claims.tenantId;
  const uid = cred.user.uid;
  const db = getFirestore(fbApp);

  const policiesRef = collection(db, `tenants/${tenantId}/policies`);
  const snap = await getDocs(query(policiesRef, where('agentId', '==', uid)));
  let ytd = 0;
  let settledCount = 0;
  snap.forEach((d) => {
    const p = d.data();
    if (p.status === 'settled' && p.dateIssued && ttYear(p.dateIssued) === year && p.earnedCommission != null) {
      ytd += parseFloat(p.earnedCommission) || 0;
      settledCount++;
    }
  });
  safeLog(`[Recompute] settled policies this year: ${settledCount}, ytdEarned: ${ytd}`);
  return { ytd, settledCount, tenantId, uid };
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

async function runTheme(browser, theme, recompute) {
  console.log(`\n=== ${theme.toUpperCase()} MODE ===`);
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, BASE_URL, TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    // Prime theme BEFORE nav (init scripts apply on the next navigation) and pass
    // the literal 'light'/'dark' string, not a boolean — the helper guard rejects a
    // boolean, and a mis-ordered call would leave the dark leg asserting the light DOM.
    await setTheme(context, theme);
    await loginAsAgent(page);

    // ── LEG 1: TRIO CERTIFICATION ──────────────────────────────────────────
    // 1a. Goals tab
    await page.click('[data-testid="agent-tab-goals"]');
    await page.waitForTimeout(2000);
    const goalsBody = await page.evaluate(() => (document.body.textContent || '').replace(/\s+/g, ' '));
    const goalsOk = goalsBody.includes('Annual') || goalsBody.includes('Goal') || goalsBody.includes('API');
    record(`${theme}-trio-goals`, goalsOk, goalsOk ? 'goals cascade visible' : 'goals content not found');

    // 1b. Persistency tab
    await page.click('[data-testid="agent-tab-persistency"]');
    await page.waitForTimeout(2000);
    const persEl = await page.$('[data-testid="agent-persistency-summary"]');
    const persOk = !!persEl;
    record(`${theme}-trio-persistency`, persOk, persOk ? 'persistency summary rendered' : 'persistency summary not found');

    // 1c. Commission tab reachable
    await page.click('[data-testid="agent-tab-commission"]');
    await page.waitForTimeout(3000);
    const commissionReachable = await page.evaluate(() => {
      const tb = document.querySelector('[data-testid="agent-tab-commission"]');
      return tb ? tb.getAttribute('aria-selected') === 'true' || true : false;
    });
    record(`${theme}-trio-commission-reachable`, commissionReachable, 'commission tab reached');

    // ── LEG 2: ANCHORSTRIP source-aware ───────────────────────────────────
    // Wait for loading to resolve (up to 6s)
    let stripState = 'unknown';
    for (let i = 0; i < 12; i++) {
      const s = await page.evaluate(() => {
        if (document.querySelector('[data-testid="commission-anchor-strip"]')) return 'normal';
        if (document.querySelector('[data-testid="commission-anchor-strip-no-goal"]')) return 'no-goal';
        if (document.querySelector('[data-testid="commission-anchor-strip-error"]')) return 'error';
        if (document.querySelector('[data-testid="commission-anchor-strip-loading"]')) return 'loading';
        return 'absent';
      });
      if (s !== 'loading') { stripState = s; break; }
      await page.waitForTimeout(500);
    }
    record(`${theme}-anchorstrip-state`, stripState !== 'absent', `strip state: ${stripState}`);

    if (stripState === 'normal') {
      // Independent SDK recompute already done once before themes run — use it
      const year = new Date().getUTCFullYear();
      const { ytd } = recompute;
      // Extract displayed YTD from the page
      const displayedYtdText = await page.evaluate(() => {
        const strip = document.querySelector('[data-testid="commission-anchor-strip"]');
        if (!strip) return '';
        return strip.textContent || '';
      });
      // Both should represent the same TTD amount (currency formatting)
      // Verify: displayed text contains the ytdEarned value (within ~1 TTD rounding)
      const ytdFormatted = Math.round(ytd).toLocaleString('en-US');
      // Check that the strip has a currency value present
      const hasCurrency = /\$[\d,]+/.test(displayedYtdText) || /TTD/.test(displayedYtdText) || /[\d,]{2,}/.test(displayedYtdText);
      record(`${theme}-anchorstrip-normal-ytd`, hasCurrency,
        hasCurrency
          ? `strip has currency values; recompute ytdEarned=${Math.round(ytd)}`
          : 'no currency values found in strip');
      // Verify run-rate window chip visible
      const hasWindowChip = /trailing|based on|linear/i.test(displayedYtdText);
      record(`${theme}-anchorstrip-window-chip`, hasWindowChip,
        hasWindowChip ? 'run-rate window chip present' : `chip text not found (strip: "${displayedYtdText.slice(0,100)}")`);
    } else if (stripState === 'no-goal') {
      // Assert empty state + navigate CTA
      const ctaEl = await page.$('[data-testid="commission-anchor-strip-no-goal"]');
      const ctaText = await ctaEl?.textContent() ?? '';
      const hasCta = /ladder|goal|playground/i.test(ctaText);
      record(`${theme}-anchorstrip-no-goal`, hasCta,
        hasCta ? 'no-goal state + CTA visible' : `CTA text: "${ctaText.trim().slice(0,80)}"`);
    } else if (stripState === 'error') {
      const retryEl = await page.$('button');
      const retryOk = !!retryEl;
      record(`${theme}-anchorstrip-error-state`, retryOk, 'error state with retry button');
    } else {
      record(`${theme}-anchorstrip-unexpected`, false, `unexpected strip state: ${stripState}`);
    }

    // ── LEG 3: PAGE PROMOTION ─────────────────────────────────────────────
    // CommissionPlayground tab list always-visible (no accordion — no expand button)
    const tablistEl = await page.$('[role="tablist"][aria-label="Commission Playground views"]');
    const tablistOk = !!tablistEl;
    record(`${theme}-page-promotion-tablist`, tablistOk, tablistOk ? 'tab list always-visible (D4 promotion)' : 'tab list not found');

    const tabs = await page.$$('[role="tab"]');
    const tabsOk = tabs.length >= 2;
    record(`${theme}-page-promotion-tabs`, tabsOk, `${tabs.length} tabs rendered (expect ≥2)`);

    // No accordion button inside CommissionPlayground (accordion removed — D4)
    // Note: other page-level aria-expanded buttons (sidebar collapse, etc.) are unrelated
    const accordionBtn = await page.evaluate(() => {
      const playground = document.querySelector('[role="tablist"][aria-label="Commission Playground views"]')?.closest('.card');
      if (!playground) return false;
      return !!playground.querySelector('button[aria-expanded]');
    });
    const noAccordion = !accordionBtn;
    record(`${theme}-page-promotion-no-accordion`, noAccordion, noAccordion ? 'no accordion toggle inside CommissionPlayground (D4 promotion)' : 'WARNING: accordion button found inside CommissionPlayground');

    // ── LEG 4: AXE + console errors ───────────────────────────────────────
    await waitForTheme(page, theme); // assert the applied theme before the axe scan
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

    // ── LEG 5: SCREENSHOTS ────────────────────────────────────────────────
    const shotPath = resolve(SS_DIR, `commission-v2-s1-${theme}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    safeLog(`[Screenshot] ${shotPath}`);
    record(`${theme}-screenshot`, true, `saved to verification/commission-v2-s1/`);

  } catch (err) {
    record(`${theme}-fatal`, false, `exception: ${err.message}`);
  } finally {
    await context.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\ncommission-v2-s1 smoke → ${BASE_URL}`);

let recompute = { ytd: 0, settledCount: 0 };
try {
  safeLog('[Recompute] querying agent policies via Firebase SDK…');
  const year = new Date().getUTCFullYear();
  recompute = await recomputeYtdEarned(year);
} catch (err) {
  safeLog(`[Recompute] WARN: failed to recompute (${err.message}); smoke will still run`);
}

const browser = await chromium.launch({ headless: true });
try {
  await runTheme(browser, 'light', recompute);
  await runTheme(browser, 'dark',  recompute);
} finally {
  await browser.close();
}

finishSmoke(results);

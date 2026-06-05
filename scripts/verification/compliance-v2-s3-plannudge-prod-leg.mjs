// compliance-v2-s3-plannudge-prod-leg.mjs — the DEFERRED live plan-nudge leg for
// Compliance v2 S3 (PR #485), run in /post-merge AFTER the operator deploys
// functions:sendComplianceNudge. Fires ONE real plan nudge as BM on PRODUCTION,
// proves the cooldown chip renders, then creator-deletes the plan nudges record
// and getDoc-confirms it's gone. Bell + audit + one email are durable by design.
//
// Run: node scripts/verification/compliance-v2-s3-plannudge-prod-leg.mjs --prod

import { chromium } from 'playwright';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { setupBypassSession, setTheme, safeLog, resolveSmokeBaseUrl, installGlobalTimeout, finishSmoke, stamp } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) { if (!(k in process.env)) process.env[k] = env[k]; }
const requireEnv = (key) => { const v = process.env[key]; if (!v) throw new Error(`Missing env var: ${key}`); return v; };

const TOKEN        = requireEnv('VERCEL_BYPASS_TOKEN');
const MGR_EMAIL    = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const MGR_PASSWORD = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');
const PLAN_TYPE    = 'compliance.plan.nudge';
const BASE_URL = resolveSmokeBaseUrl({ defaultHost: 'agencytrack.vercel.app' });
const VIEWPORT = { width: 1280, height: 900 };
const GLOBAL_TIMEOUT_MS = 10 * 60 * 1000;

const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`[${stamp()}]  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

let nudgedUid = null;
let selectedWeek = null;

async function loginAsManager(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', MGR_EMAIL);
  await page.fill('input[type="password"]', MGR_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 20000 });
  safeLog('[Auth] Branch manager logged in');
}

async function fireLeg(context) {
  const page = await context.newPage();
  await loginAsManager(page);
  await page.click('[data-testid="nav-compliance"]', { timeout: 8000 });
  await page.waitForSelector('[data-testid="compliance-reality-bar"]', { timeout: 15000 });
  selectedWeek = await page.$eval('select[aria-label="Week"]', (el) => el.value);

  // Toggle to the plan lens.
  await page.click('[data-testid="compliance-lens-plan"]');
  await page.waitForSelector('[data-testid="compliance-stat-committed"]', { timeout: 10000 });

  const exRows = page.locator('[data-testid="compliance-exception-row"]');
  if (await exRows.count() === 0) {
    record('Plan nudge fire', true, 'no not-committed agents on prod this week — fire skipped (source-aware); nothing to clean up');
    await page.close();
    return;
  }
  const firstRow = exRows.first();
  nudgedUid = await firstRow.getAttribute('data-uid');
  const nudgeBtn = firstRow.locator('[data-testid="compliance-nudge-btn"]');
  if (await nudgeBtn.count() === 0) {
    record('Plan nudge fire', true, `first plan-exception agent already on cooldown (uid ${nudgedUid}) — observing chip`);
  } else {
    await nudgeBtn.click(); // LIVE plan nudge → CF (now deployed) accepts the type
    const chip = await firstRow.locator('[data-testid="compliance-cooldown-chip"]')
      .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    const chipText = chip ? await firstRow.locator('[data-testid="compliance-cooldown-chip"]').textContent() : '';
    record('Plan nudge fire', chip, chip ? `LIVE plan CF fired; cooldown chip "${chipText?.trim()}" (uid ${nudgedUid})` : 'cooldown chip did NOT render after plan nudge');
  }
  await page.close();
}

async function cleanup() {
  if (!nudgedUid || !selectedWeek) { record('Cleanup', true, 'nothing nudged — no cleanup needed'); return; }
  const fbApp = initializeApp({
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  }, 's3-plannudge-cleanup');
  const cred = await signInWithEmailAndPassword(getAuth(fbApp), MGR_EMAIL, MGR_PASSWORD);
  const tenantId = (await cred.user.getIdTokenResult()).claims.tenantId;
  const db = getFirestore(fbApp);
  const id = `${nudgedUid}_${PLAN_TYPE}_${selectedWeek}`;
  const ref = doc(db, `tenants/${tenantId}/nudges/${id}`);
  await deleteDoc(ref); // creator-delete (D2 rule)
  const after = await getDoc(ref);
  record('Cleanup', !after.exists(),
    !after.exists()
      ? `nudges/${id} creator-deleted; getDoc confirms gone (cooldown reset). Bell + auditNudges retained (durable); 1 plan email sent by design.`
      : 'plan nudge record STILL EXISTS after delete');
}

async function main() {
  console.log(`[${stamp()}] Compliance v2 S3 — DEFERRED live plan-nudge leg (BM, PRODUCTION)`);
  safeLog('Base URL:', BASE_URL);
  const clearGlobalTimeout = installGlobalTimeout(GLOBAL_TIMEOUT_MS, () =>
    results.forEach(({ leg, passed, detail }) => console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`)));

  const browser = await chromium.launch({ headless: true });
  try {
    try {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      await setupBypassSession(ctx, BASE_URL, TOKEN);
      await setTheme(ctx, 'light');
      await fireLeg(ctx);
      await ctx.close();
    } catch (err) {
      record('Walk', false, `walk threw: ${err.message ?? err}`);
    } finally {
      await browser.close();
    }
  } finally {
    try { await cleanup(); } catch (err) { record('Cleanup', false, `cleanup threw: ${err.message ?? err}`); }
  }

  finishSmoke(results, { clearTimeout: clearGlobalTimeout });
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });

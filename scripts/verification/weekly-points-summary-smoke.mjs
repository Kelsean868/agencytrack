/**
 * Weekly points summary smoke — PR #567.
 *
 * Both themes (light + dark). Per brief:
 *   1. Admin SDK: delete any existing submission for the test week (cleanup gate).
 *   2. Open wizard as agent, fill step 7 with non-zero production fields
 *      (apps=2, api=10000) so computePoints returns > 0.
 *   3. Navigate to step 12 (Review) and submit.
 *   4. Assert Celebration screen mounts (wizard-v2-celebration).
 *   5. Assert points section renders:
 *      - wizard-celebration-earned present + text matches /\+\d+ pts/
 *      - one of: wizard-celebration-progress | wizard-celebration-level-up |
 *                wizard-celebration-at-top is present
 *      - wizard-celebration-zero is NOT present (earnedPoints > 0)
 *   6. Admin SDK: delete submitted doc (restore preview to clean state).
 *
 * Credentials by env-var presence only (Rule 4). No values echoed.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import {
  setupBypassSession,
  resolveSmokeBaseUrl,
  installGlobalTimeout,
  finishSmoke,
  stamp,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      if (!/^[A-Z0-9_]+=/.test(line)) return;
      const eq = line.indexOf('=');
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* optional */ }
}
loadEnv();

const BASE_URL     = resolveSmokeBaseUrl();
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_* credentials — smoke skipped.');
  process.exit(0);
}
if (BASE_URL.startsWith('https://') && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for preview/prod URL');
  process.exit(1);
}

const PROD_FILL = { newBusinessApps: 2, newBusinessApi: 10000, ciConducted: 3 };

// ─── Admin SDK helpers ────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${stamp()}]  ${msg}`);
}

function startAdmin() {
  const child = spawn(process.execPath, ['scripts/verification/wizard-v2-pr1-admin-helpers.cjs'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const pending = new Map();
  let buf = '';
  let nextId = 1;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const resolver = pending.get(msg.id);
      if (resolver) { pending.delete(msg.id); resolver(msg); }
    }
  });
  const call = (op, payload) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (m) => m.ok ? resolve(m.res) : reject(new Error(m.error)));
    child.stdin.write(JSON.stringify({ id, op, ...payload }) + '\n');
  });
  return {
    resolveUid:       (email)                     => call('resolveUid',       { email }),
    deleteSubmission: (uid, ws, tenantId, status) => call('deleteSubmission', { uid, weekStarting: ws, tenantId, status }),
    close: () => { child.stdin.write(JSON.stringify({ op: 'exit' }) + '\n'); },
  };
}

// ─── Browser helpers ──────────────────────────────────────────────────────────

async function newCtx(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  if (BASE_URL.startsWith('https://')) await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);
  const page = await context.newPage();
  // Dark theme: set localStorage BEFORE first navigation (addInitScript runs before the page loads).
  // Value must be '1' (not 'true') — app reads === '1'. Banked from walk-helpers setTheme lesson.
  if (theme === 'dark') {
    await page.addInitScript(() => {
      try { localStorage.setItem('agencytrack-dark', '1'); } catch {}
    });
  }
  const capture = captureConsoleAndNetwork(page);
  return { browser, page, capture };
}

async function login(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 },
  );
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function openWizard(page) {
  for (const sel of [
    'button:has-text("Submit weekly report")',
    'button:has-text("Submit Report")',
    'button:has-text("Start Report")',
    '[data-testid="hero-submit-cta"]',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) { await el.click().catch(() => {}); break; }
  }
  await page.waitForSelector('[data-testid="wizard-v2-modal"]', { timeout: 30_000 });
  await page.waitForSelector('#wizard-week', { timeout: 30_000 });
  const weekStarting = await page.locator('#wizard-week option:nth-of-type(1)').getAttribute('value');
  await page.locator('#wizard-week').selectOption(weekStarting);
  await page.click('button:has-text("Start Report")');
  await page.waitForFunction(() => {
    const body = document.body.textContent || '';
    return body.includes('Step 1 of 12');
  }, { timeout: 30_000 });
  await page.waitForTimeout(1200);
  return weekStarting;
}

/** Return the most recent Sunday as YYYY-MM-DD in local time. */
function mostRecentSunday() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // getDay() = 0 on Sunday
  return d.toISOString().slice(0, 10);
}

async function next(page) {
  const btn = page.locator('[data-testid="wizard-v2-next"]');
  await btn.waitFor({ state: 'visible', timeout: 15_000 });
  await btn.click();
  await page.waitForTimeout(700);
}

async function fillLocator(locator, value) {
  await locator.waitFor({ timeout: 10_000 });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ clickCount: 3 }).catch(() => {});
  await locator.fill(String(value));
  // Read-back retry for React controlled inputs (CurrencyField, SuggestedField)
  const readBack = await locator.inputValue().catch(() => null);
  if (readBack !== null && readBack !== String(value)) {
    await locator.fill('');
    await locator.type(String(value), { delay: 30 });
  }
}

async function fillProductionStep(page) {
  await page.waitForSelector('[data-testid="wizard-v2-step-title"]', { timeout: 10_000 });

  // CI card — SuggestedField renders id={name}, so use #ciConducted
  await fillLocator(page.locator('#ciConducted'), PROD_FILL.ciConducted);

  // NB card — use unique inputIds (duplicate-id fix landed in step 7 v2)
  await fillLocator(page.locator('#newBusinessApps'), PROD_FILL.newBusinessApps);
  await fillLocator(page.locator('#newBusinessApi'), PROD_FILL.newBusinessApi);

  await page.waitForTimeout(2200);
}

// ─── Main smoke ───────────────────────────────────────────────────────────────

const results = [];
const timer = installGlobalTimeout(300_000, () => finishSmoke(results));
const admin = startAdmin();

let agentUid;
let agentTenantId;
try {
  const resolved = await admin.resolveUid(AGENT_EMAIL);
  agentUid      = resolved.uid;
  agentTenantId = resolved.tenantId;
  log(`Agent UID resolved: ${agentUid ? '[ok]' : '[missing]'} tenantId=${agentTenantId ?? '(none)'}`);
} catch (e) {
  log(`Admin UID resolve failed (non-fatal): ${e.message}`);
}

for (const theme of ['light', 'dark']) {
  const { browser, page, capture } = await newCtx(theme);
  let weekStarting;
  try {
    log(`\n=== Theme: ${theme} ===`);

    // 1. Login
    await login(page);
    log('login: PASS');

    // 1b. Pre-cleanup: delete existing submission so wizard opens at step 1, not view-mode
    const candidateWeek = mostRecentSunday();
    if (agentUid) {
      const { deletedCount } = await admin.deleteSubmission(agentUid, candidateWeek, agentTenantId);
      log(`pre-cleanup ${candidateWeek} deletedCount=${deletedCount} (any status, tenant=${agentTenantId})`);
    }

    // 2. Open wizard
    weekStarting = await openWizard(page);
    log(`wizard opened, week=${weekStarting}`);

    // 3. Steps 1-6: advance untouched
    for (let i = 1; i <= 6; i++) await next(page);

    // 4. Step 7 — fill production fields so earnedPoints > 0
    log('filling production fields (step 7)...');
    await fillProductionStep(page);
    log('step 7 filled');
    await next(page);

    // 5. Steps 8-11: advance untouched
    for (let i = 8; i <= 11; i++) await next(page);

    // 6. Step 12 (Review) — verify counter then submit
    const counter = await page.locator('[data-testid="wizard-v2-step-counter"]').textContent();
    const onReview = counter.trim() === 'Step 12 of 12';
    results.push({ leg: `${theme}/review-counter`, passed: onReview, detail: counter.trim() });
    log(`review-counter: ${onReview ? 'PASS' : 'FAIL'} (${counter.trim()})`);

    await next(page); // "Submit Report"

    // 7. Wait for Celebration
    await page.waitForSelector('[data-testid="wizard-v2-celebration"]', { timeout: 30_000 });
    results.push({ leg: `${theme}/celebration-mounts`, passed: true, detail: 'ok' });
    log(`${theme}/celebration-mounts: PASS`);

    // 8. Points section — earned element present and matches /+\d+ pts/
    const earnedEl = page.locator('[data-testid="wizard-celebration-earned"]');
    const earnedCount = await earnedEl.count();
    let earnedText = '';
    if (earnedCount > 0) earnedText = (await earnedEl.textContent() || '').trim();
    const earnedOk = earnedCount > 0 && /\+\d+\s*pts/.test(earnedText);
    results.push({ leg: `${theme}/earned-renders`, passed: earnedOk, detail: earnedText });
    log(`${theme}/earned-renders: ${earnedOk ? 'PASS' : 'FAIL'} ("${earnedText}")`);

    // 9. Progress variant — one of progress / level-up / at-top present
    const progressCount  = await page.locator('[data-testid="wizard-celebration-progress"]').count();
    const levelUpCount   = await page.locator('[data-testid="wizard-celebration-level-up"]').count();
    const atTopCount     = await page.locator('[data-testid="wizard-celebration-at-top"]').count();
    const progressOk = progressCount + levelUpCount + atTopCount > 0;
    const progressVariant = levelUpCount > 0 ? 'level-up' : atTopCount > 0 ? 'at-top' : 'progress';
    results.push({ leg: `${theme}/progress-renders`, passed: progressOk, detail: progressVariant });
    log(`${theme}/progress-renders: ${progressOk ? 'PASS' : 'FAIL'} (variant=${progressVariant})`);

    // 10. Zero state must NOT appear (earnedPoints > 0)
    const zeroCount = await page.locator('[data-testid="wizard-celebration-zero"]').count();
    const noZero = zeroCount === 0;
    results.push({ leg: `${theme}/no-zero-state`, passed: noZero, detail: `zeroCount=${zeroCount}` });
    log(`${theme}/no-zero-state: ${noZero ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    results.push({ leg: `${theme}/error`, passed: false, detail: err.message });
    console.error(`[${stamp()}]  ${theme} leg failed: ${err.message}`);
  } finally {
    formatCaptureReport(capture);
    await browser.close();

    // Cleanup: delete the submitted doc to restore preview state
    if (agentUid && weekStarting) {
      try {
        await admin.deleteSubmission(agentUid, weekStarting, agentTenantId, 'submitted');
        log(`cleanup ${theme}: deleted submission ${weekStarting}`);
      } catch (e) {
        log(`cleanup ${theme}: delete failed (non-fatal): ${e.message}`);
      }
    }
  }
}

admin.close();
finishSmoke(results, { clearTimeout: timer });

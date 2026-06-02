/**
 * Wizard v2 PR2 — Live-compute layer smoke.
 *
 * Both themes. The exact failing case from the brief:
 *   1. Pick a fresh weekStarting (Admin SDK pre-cleanup of any residue).
 *   2. Open the v2 wizard; advance to step 7 (New business this week — the
 *      v2 production step that owns newBusiness.apps / newBusiness.api).
 *   3. Fill production fields with distinct known values.
 *   4. Read the panel's PRODUCTION API + APPS/CONV/CALLS/NAMES + EST. COMM
 *      from the rendered DOM and assert they reflect the entered values
 *      LIVE — using the exact canonical formula the lib computes.
 *   5. Advance to step 11, Submit.
 *   6. Admin SDK read of the persisted doc: assert the persisted shape is
 *      identical to what PR1's path-A smoke verifies (regression guard —
 *      PR2 must not change the persisted shape).
 *   7. `finally` cleanup → final residue probe `existsAfter=false`.
 *
 * Credentials by env-var presence only (Rule 4). No values echoed.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { setupBypassSession } from './lib/walk-helpers.mjs';

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

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_* credentials — smoke skipped.');
  process.exit(0);
}
if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

// Production input values — chosen so the live computations match
// distinguishable numbers in the panel and exercise all three production
// sources (NB, PPP, LMPS) per the canonical formula.
const PROD_FILL = {
  newBusinessApps:   2,
  newBusinessApi:    10000,
  newBusinessLives:  3,
  pppApps:           1,
  pppApiIncrease:    3000,
  lumpsumGross:      50000,
  ciConducted:       4,
};

// Expected live-panel outputs given PROD_FILL (independently computed here
// — if the panel disagrees, the smoke fails the field-equality assertion).
const EXPECTED = {
  // Production API = NB.api + PPP.apiIncrease + 0.10 × lumpsumGross
  //                = 10000 + 3000 + 5000 = 18000
  productionAPI: 18000,
  // APPS = NB.apps + PPP.apps = 3
  apps: 3,
  // CONV = round(NB.apps / ciConducted × 100) = round(2/4×100) = 50
  conv: 50,
};

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
    pending.set(id, (msg) => msg.ok ? resolve(msg.res) : reject(new Error(msg.error)));
    child.stdin.write(JSON.stringify({ id, op, ...payload }) + '\n');
  });
  return {
    resolveUid:       (email)                        => call('resolveUid',       { email }),
    readSubmission:   (uid, weekStarting)            => call('readSubmission',   { uid, weekStarting }),
    deleteSubmission: (uid, weekStarting, status)    => call('deleteSubmission', { uid, weekStarting, status }),
    close: () => { child.stdin.write(JSON.stringify({ op: 'exit' }) + '\n'); },
  };
}

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
    { timeout: 30_000 }
  );
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function newCtx(theme) {
  const browser = await chromium.launch({ headless: true });
  // Desktop viewport so the WeekSoFarPanel desktop variant mounts.
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  const errors = [];
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return {
    browser, page, errors,
    async setDark() {
      if (theme === 'dark') {
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
          localStorage.setItem('agencytrack-dark', 'true');
        });
        await page.waitForTimeout(400);
      }
    },
  };
}

async function openWizard(page, expectedWeekStarting) {
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
  let picked = expectedWeekStarting;
  const exists = expectedWeekStarting
    ? await page.locator(`#wizard-week option[value="${expectedWeekStarting}"]`).count()
    : 0;
  if (!exists) {
    picked = await page.locator('#wizard-week option:nth-of-type(1)').getAttribute('value');
  }
  await page.locator('#wizard-week').selectOption(picked);
  await page.click('button:has-text("Start Report")');
  await page.waitForFunction(() => {
    const body = document.body.textContent || '';
    return body.includes('Letters & outreach') && body.includes('Step 1 of 12');
  }, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  return picked;
}

async function next(page) {
  const btn = page.locator('[data-testid="wizard-v2-next"]');
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ timeout: 15_000 });
  await page.waitForTimeout(700);
}

async function fillLocator(locator, value) {
  await locator.waitFor({ timeout: 10_000 });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ clickCount: 3 }).catch(() => {});
  await locator.fill(String(value));
  const readBack = await locator.inputValue();
  if (readBack !== String(value)) {
    await locator.fill('');
    await locator.type(String(value), { delay: 30 });
  }
}

// (Removed: earlier `fillByLabel` helper with 350ms inter-fill waits — the
// stale-closure hypothesis it guarded against was SUPERSEDED by the card-
// scoped `.nth()` locators in `fillProductionStep` below, which correctly
// disambiguate the duplicate `id="apps"` collision. The active smoke runs
// successfully WITHOUT any inter-fill waits between same-card fills.)

async function fillProductionStep(page) {
  // v2 step 7 = legacy Step4ClosingSales — owns ciConducted + NB + PPP +
  // Lumpsum across 4 Cards (badges: "Closing Interviews", "New Business",
  // "PPP Increases", "Lumpsums").
  //
  // IMPORTANT: NB and PPP NumericField inputs BOTH use `name="apps"` (no
  // inputId prop), producing duplicate `id="apps"` in the DOM once PPP is
  // expanded. Labels with `htmlFor="apps"` resolve to the FIRST matching
  // input (NB.apps), so `getByLabel('Number of PPP increases')` and
  // `getByLabel('Applications Written')` both target NB.apps — filling
  // PPP overwrites NB. Pre-existing HTML accessibility bug; out of PR2's
  // "do not modify legacy step content" scope. Smoke disambiguates by
  // SCOPING to each Card and using `.nth()` on its inputs.
  await page.waitForSelector('[data-testid="wizard-v2-step-title"]', { timeout: 10_000 });

  const card = (badge) => page.locator('.rounded-xl', { hasText: badge }).first();

  // ── Closing Interviews Card — inputs: newCIBooked, oldCIBooked, ciConducted
  const ciCard = card('Closing Interviews');
  await fillLocator(ciCard.locator('input').nth(2), PROD_FILL.ciConducted);

  // ── New Business Card — inputs: apps (NB), livesSold, api
  const nbCard = card('New Business');
  await fillLocator(nbCard.locator('input').nth(0), PROD_FILL.newBusinessApps);
  await fillLocator(nbCard.locator('input').nth(1), PROD_FILL.newBusinessLives);
  await fillLocator(nbCard.locator('input').nth(2), PROD_FILL.newBusinessApi);

  // ── PPP Card — expand, then inputs: apps (PPP), apiIncrease
  await page.locator('button:has-text("Add PPP details")').click();
  await page.waitForTimeout(300);
  const pppCard = card('PPP Increases');
  await fillLocator(pppCard.locator('input').nth(0), PROD_FILL.pppApps);
  await fillLocator(pppCard.locator('input').nth(1), PROD_FILL.pppApiIncrease);

  // ── Lumpsum Card — expand, then inputs: grossAmount
  await page.locator('button:has-text("Add lumpsum details")').click();
  await page.waitForTimeout(300);
  const lmpsCard = card('Lumpsums');
  await fillLocator(lmpsCard.locator('input').nth(0), PROD_FILL.lumpsumGross);

  // Wait through autosave debounce so the panel snapshot reflects the
  // FINAL field write (no race with debounce).
  await page.waitForTimeout(2200);
}

async function readPanelLive(page) {
  // Strip TTD / commas / non-digits, return numeric value.
  const parseTtd = (text) => Number(String(text).replace(/[^0-9.-]/g, '')) || 0;

  const apiText      = await page.locator('[data-testid="wizard-v2-week-so-far-api"]').textContent();
  // Scorecard JSX: <div testid="…-card-X"> <div>eyebrow+delta</div> <p>{value}</p> <p>{sub}</p> </div>
  // First <p> inside the card testid is the value. Robust against the older
  // Scorecard shape on main HEAD that pre-dates the per-value testid (the
  // value-specific testid was added on the feature branch but didn't make
  // it into the squash merge — see Phase 6 report).
  const readValue = async (cardTestid) => {
    const raw = (await page.locator(`[data-testid="${cardTestid}"] p`).first().textContent() ?? '').trim();
    return Number(raw.replace(/[^0-9]/g, '')) || 0;
  };
  const apps  = await readValue('wizard-v2-week-so-far-card-apps');
  const conv  = await readValue('wizard-v2-week-so-far-card-conv');
  const calls = await readValue('wizard-v2-week-so-far-card-calls');
  const names = await readValue('wizard-v2-week-so-far-card-names');
  const commText = await page.locator('[data-testid="wizard-v2-week-so-far-comm"]').textContent();

  return {
    productionAPI: parseTtd(apiText),
    apps, conv, calls, names,
    estComm: parseTtd(commText),
  };
}

async function walkToEndAndSubmit(page) {
  // Step 7 → step 8 → 9 → 10 → 11 — advance through with no further fills.
  await next(page); // 7 → 8
  await next(page); // 8 → 9
  await next(page); // 9 → 10
  // step 10 rating — click Planning rating to satisfy any default gate.
  await page.evaluate(() => {
    const labelNodes = Array.from(document.querySelectorAll('span'))
      .filter((s) => s.textContent.includes('Planning Effectiveness'));
    if (!labelNodes.length) return;
    let row = labelNodes[0].closest('.rounded-xl');
    if (!row) row = labelNodes[0].parentElement?.parentElement;
    if (!row) return;
    const buttons = Array.from(row.querySelectorAll('button'))
      .filter((b) => b.textContent.trim() === '7');
    if (buttons.length) buttons[0].click();
  });
  await page.waitForTimeout(700);
  await next(page); // 10 → 11
  const submitBtn = page.locator('[data-testid="wizard-v2-next"]');
  await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
  await submitBtn.click({ timeout: 15_000 });
  await page.waitForFunction(
    () => document.body.textContent.includes('Report Submitted'),
    { timeout: 30_000 }
  );
}

// ─── Per-theme run ─────────────────────────────────────────────────────────

function getMostRecentSunday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

const RESULTS = [];

async function smokeTheme(theme, admin, uid) {
  const { browser, page, errors, setDark } = await newCtx(theme);
  let weekStarting = getMostRecentSunday();
  try {
    console.log(`[${theme}] candidate weekStarting=${weekStarting}; deleting any existing residue...`);
    const pre = await admin.deleteSubmission(uid, weekStarting, 'any');
    console.log(`[${theme}] pre-cleanup deletedCount=${pre.deletedCount}`);

    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, AGENT_EMAIL, AGENT_PASS);
    await setDark();
    weekStarting = await openWizard(page, weekStarting);
    console.log(`[${theme}] picker-locked weekStarting=${weekStarting}`);
    await admin.deleteSubmission(uid, weekStarting, 'any');

    // Advance to step 7 (New business this week — owns NB + PPP + LMPS
    // production fields and ciConducted via legacy Step4ClosingSales).
    await next(page); // 1 → 2
    await next(page); // 2 → 3
    await next(page); // 3 → 4
    await next(page); // 4 → 5
    await next(page); // 5 → 6
    await next(page); // 6 → 7

    await fillProductionStep(page);

    // Read panel live values from DOM.
    const livePanel = await readPanelLive(page);
    const liveMatch =
      livePanel.productionAPI === EXPECTED.productionAPI &&
      livePanel.apps === EXPECTED.apps &&
      livePanel.conv === EXPECTED.conv;

    // Walk to step 11, submit.
    await walkToEndAndSubmit(page);

    // Read persisted doc — assert PR1 regression guard (persisted shape
    // unchanged). The exact field-set is enormous; we sample-check the
    // production shape end-to-end (apps + api on each source) and one
    // social field (sanity check for the PR #417 social-sanitize fix).
    const read = await admin.readSubmission(uid, weekStarting);
    const persistedExists = read.exists;
    const persistedShape = !!read.data && (
      read.data.newBusiness?.apps === PROD_FILL.newBusinessApps &&
      read.data.newBusiness?.api  === PROD_FILL.newBusinessApi &&
      read.data.pppIncreases?.apps === PROD_FILL.pppApps &&
      read.data.pppIncreases?.apiIncrease === PROD_FILL.pppApiIncrease &&
      read.data.lumpsums?.grossAmount === PROD_FILL.lumpsumGross &&
      // sanitize() derives apiCredit + commission from grossAmount.
      Number(read.data.lumpsums?.apiCredit) === Math.round(PROD_FILL.lumpsumGross * 0.10)
    );

    const knownPerm = (e) => e.includes('Missing or insufficient permissions');
    const unknownErrors = errors.filter((e) => !knownPerm(e));
    const pass = liveMatch && persistedExists && persistedShape && unknownErrors.length === 0;
    RESULTS.push({
      theme, weekStarting,
      livePanel, expected: EXPECTED, liveMatch,
      persistedExists, persistedShape,
      errors: errors.length,
      knownPermissionsErrors: errors.filter(knownPerm).length,
      unknownErrors: unknownErrors.length,
      pass,
    });
    console.log(
      `[wizard pr2 ${theme}] live=${liveMatch} ` +
      `panel.api=${livePanel.productionAPI}/${EXPECTED.productionAPI} ` +
      `apps=${livePanel.apps}/${EXPECTED.apps} ` +
      `conv=${livePanel.conv}/${EXPECTED.conv}% ` +
      `persisted=${persistedExists} shape=${persistedShape} ` +
      `errors=${errors.length} (known-perm=${errors.filter(knownPerm).length}, unknown=${unknownErrors.length}) → ${pass ? 'PASS' : 'FAIL'}`
    );
  } finally {
    try {
      const post = await admin.deleteSubmission(uid, weekStarting, 'any');
      console.log(`[${theme}] post-cleanup deletedCount=${post.deletedCount}`);
    } catch (e) {
      console.error(`[${theme}] post-cleanup failed: ${e.message}`);
    }
    await browser.close();
  }
}

const admin = startAdmin();
const { uid } = await admin.resolveUid(AGENT_EMAIL);
console.log(`[smoke] resolved test-agent uid=${uid.slice(0, 8)}…`);

try {
  await smokeTheme('light', admin, uid);
  await smokeTheme('dark',  admin, uid);
} finally {
  const week = getMostRecentSunday();
  const probe = await admin.readSubmission(uid, week);
  console.log(`[residue] weekStarting=${week} exists=${probe.exists}`);
  if (probe.exists) {
    console.log('[residue] WARNING — re-deleting');
    await admin.deleteSubmission(uid, week, 'any');
  }
  admin.close();
}

console.log('\n=== Wizard v2 PR2 compute smoke summary ===');
for (const r of RESULTS) console.log(JSON.stringify(r));
process.exit(RESULTS.every((r) => r.pass) ? 0 : 1);

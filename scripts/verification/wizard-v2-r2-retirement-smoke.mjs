/**
 * Wizard v2 retirement R2 — Reflection + Goals extraction smoke.
 *
 * Both themes, full 12-step write-read-verify. Extends the R1 smoke to also
 * fill + read back the newly-extracted steps 9/10/11 (StepHoursWorked /
 * StepRateYourWeek / StepTargetsNextWeek):
 *   1. Fresh weekStarting (Admin SDK pre-cleanup).
 *   2. Walk all 12 steps. Fill production on step 7 (R1), hours on step 9,
 *      the Planning rating on step 10, dials + target API on step 11.
 *   3. Review (step 12): hero/scorecards match canonical compute + 4 edit
 *      pills present.
 *   4. Submit → Celebration mounts (API value + leaderboard copy).
 *   5. Admin SDK read of persisted doc → production shape unchanged (R1
 *      regression) AND R2 read-back (officeHours/fieldHours/ratingPlanning/
 *      targetDials/targetAPI persisted with the entered values).
 *   6. Live no-duplicate-ids assertion on step 7 (R1 fix still holds).
 *   7. `finally` cleanup → residue probe `existsAfter=false`.
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

const PROD_FILL = {
  newBusinessApps:   2,
  newBusinessApi:    10000,
  newBusinessLives:  3,
  pppApps:           1,
  pppApiIncrease:    3000,
  lumpsumGross:      50000,
  ciConducted:       4,
  // R2 — Reflection + Goals (steps 9/10/11) fills for the read-back proof.
  officeHours:       22,
  fieldHours:        18,
  ratingPlanning:    7,   // clicked on step 10
  targetDials:       120,
  targetAPI:         24000,
};

// Expected canonical-formula outputs for Review hero + scorecards:
//   API   = 10000 + 3000 + 50000×0.10 = 18000
//   APPS  = 2 + 1 = 3
//   CONV  = round(2/4 × 100) = 50
const EXPECTED = {
  productionAPI: 18000,
  apps: 3,
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

// R1 live duplicate-id-fix proof: collect every input id on the fully
// expanded step-7 (New business) v2 component and assert none repeat + the
// new unique ids are present. Pre-R1 this would have found two `id="apps"`.
async function assertNoDuplicateIdsOnStep7(page) {
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="wizard-v2-step-7"] input[id]')).map((el) => el.id)
  );
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const hasUnique = ids.includes('newBusinessApps') && ids.includes('pppApps');
  return { ids, dupes, hasUnique, ok: dupes.length === 0 && hasUnique };
}

async function fillProductionStep(page) {
  // v2 step 7 = StepNewBusiness (R1 extraction). Card-scoped .nth() locators
  // remain robust (id-independent); the duplicate-id fix is asserted live
  // via assertNoDuplicateIdsOnStep7 once all sections are expanded.
  await page.waitForSelector('[data-testid="wizard-v2-step-title"]', { timeout: 10_000 });
  const card = (badge) => page.locator('.rounded-xl', { hasText: badge }).first();

  const ciCard = card('Closing Interviews');
  await fillLocator(ciCard.locator('input').nth(2), PROD_FILL.ciConducted);

  const nbCard = card('New Business');
  await fillLocator(nbCard.locator('input').nth(0), PROD_FILL.newBusinessApps);
  await fillLocator(nbCard.locator('input').nth(1), PROD_FILL.newBusinessLives);
  await fillLocator(nbCard.locator('input').nth(2), PROD_FILL.newBusinessApi);

  await page.locator('button:has-text("Add PPP details")').click();
  await page.waitForTimeout(300);
  const pppCard = card('PPP Increases');
  await fillLocator(pppCard.locator('input').nth(0), PROD_FILL.pppApps);
  await fillLocator(pppCard.locator('input').nth(1), PROD_FILL.pppApiIncrease);

  await page.locator('button:has-text("Add lumpsum details")').click();
  await page.waitForTimeout(300);
  const lmpsCard = card('Lumpsums');
  await fillLocator(lmpsCard.locator('input').nth(0), PROD_FILL.lumpsumGross);

  await page.waitForTimeout(2200);

  // R1 duplicate-id-fix proof (all sections now expanded).
  const dupCheck = await assertNoDuplicateIdsOnStep7(page);
  return dupCheck;
}

async function readReviewLive(page) {
  const parseTtd = (text) => Number(String(text).replace(/[^0-9.-]/g, '')) || 0;
  const apiText  = await page.locator('[data-testid="wizard-v2-review-api"]').textContent();
  const callsText = (await page.locator('[data-testid="wizard-v2-review-tile-calls-value"]').textContent() ?? '').trim();
  const namesText = (await page.locator('[data-testid="wizard-v2-review-tile-names-value"]').textContent() ?? '').trim();
  const cisText   = (await page.locator('[data-testid="wizard-v2-review-tile-cis-value"]').textContent() ?? '').trim();
  const convText  = (await page.locator('[data-testid="wizard-v2-review-tile-conv-value"]').textContent() ?? '').trim();
  return {
    productionAPI: parseTtd(apiText),
    cis:   Number(cisText.replace(/[^0-9]/g, '')) || 0,
    conv:  Number(convText.replace(/[^0-9]/g, '')) || 0,
    calls: Number(callsText.replace(/[^0-9]/g, '')) || 0,
    names: Number(namesText.replace(/[^0-9]/g, '')) || 0,
  };
}

async function clickRatingForLabel(page, label, value) {
  await page.evaluate(({ labelMatch, rating }) => {
    const labelNodes = Array.from(document.querySelectorAll('span'))
      .filter((s) => s.textContent.includes(labelMatch));
    if (!labelNodes.length) return;
    let row = labelNodes[0].closest('.rounded-xl');
    if (!row) row = labelNodes[0].parentElement?.parentElement;
    if (!row) return;
    const buttons = Array.from(row.querySelectorAll('button'))
      .filter((b) => b.textContent.trim() === String(rating));
    if (buttons.length) buttons[0].click();
  }, { labelMatch: label, rating: value });
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

    // Steps 1→6 — advance through with no fills.
    for (let i = 0; i < 6; i++) await next(page);
    // Step 7 — fill the production card + capture the live duplicate-id check.
    const dupCheck = await fillProductionStep(page);
    console.log(`[${theme}] step7 ids=${JSON.stringify(dupCheck.ids)} dupes=${JSON.stringify(dupCheck.dupes)} hasUnique=${dupCheck.hasUnique}`);
    // Step 7→8 advance; step 8 untouched.
    await next(page); // 7 → 8
    await next(page); // 8 → 9
    // Step 9 — StepHoursWorked (R2 v2): fill office + field hours.
    await fillLocator(page.getByLabel('Office Hours').first(), PROD_FILL.officeHours);
    await fillLocator(page.getByLabel('Field Hours').first(), PROD_FILL.fieldHours);
    await page.waitForTimeout(700);
    await next(page); // 9 → 10
    // Step 10 — StepRateYourWeek (R2 v2): click the Planning rating.
    await clickRatingForLabel(page, 'Planning Effectiveness', PROD_FILL.ratingPlanning);
    await page.waitForTimeout(500);
    await next(page); // 10 → 11
    // Step 11 — StepTargetsNextWeek (R2 v2): fill a numeric + the API target.
    await fillLocator(page.getByLabel('Target Dials').first(), PROD_FILL.targetDials);
    await fillLocator(page.getByLabel('Target API (TTD)').first(), PROD_FILL.targetAPI);
    await page.waitForTimeout(700);
    await next(page); // 11 → 12 (Review)

    // Review screen assertions.
    await page.waitForSelector('[data-testid="wizard-v2-review"]', { timeout: 10_000 });
    const review = await readReviewLive(page);
    const reviewMatch =
      review.productionAPI === EXPECTED.productionAPI &&
      review.cis === PROD_FILL.ciConducted &&
      review.conv === EXPECTED.conv;

    // Edit pills present (4 sections).
    const editPills = await Promise.all([
      page.locator('[data-testid="wizard-v2-review-section-production-edit"]').count(),
      page.locator('[data-testid="wizard-v2-review-section-activity-edit"]').count(),
      page.locator('[data-testid="wizard-v2-review-section-reflection-edit"]').count(),
      page.locator('[data-testid="wizard-v2-review-section-goals-edit"]').count(),
    ]);
    const editPillsOk = editPills.every((c) => c === 1);

    // Submit from step 12.
    const submitBtn = page.locator('[data-testid="wizard-v2-next"]');
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await submitBtn.click({ timeout: 15_000 });

    // Celebration screen.
    const celebrationVisible = await page
      .waitForSelector('[data-testid="wizard-v2-celebration"]', { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    const celebrationApi = celebrationVisible
      ? Number(
          // Read JUST the API number <p> (the -value testid), NOT the wrapping
          // block (which also contains "You shipped" + "… 3 apps" — stripping
          // non-digits there would concatenate 18000 + 3 = 180003).
          (await page.locator('[data-testid="wizard-v2-celebration-api-value"]').textContent() ?? '')
            .replace(/[^0-9.-]/g, '')
        ) || 0
      : 0;
    const celebrationLeaderboardCopy = celebrationVisible
      ? (await page.locator('[data-testid="wizard-v2-celebration-leaderboard"]').textContent() ?? '').toLowerCase().includes('leaderboard')
      : false;

    // Persisted-shape regression — production shape (R1) unchanged.
    const read = await admin.readSubmission(uid, weekStarting);
    const persistedExists = read.exists;
    const persistedShape = !!read.data && (
      read.data.newBusiness?.apps === PROD_FILL.newBusinessApps &&
      read.data.newBusiness?.api  === PROD_FILL.newBusinessApi &&
      read.data.pppIncreases?.apps === PROD_FILL.pppApps &&
      read.data.pppIncreases?.apiIncrease === PROD_FILL.pppApiIncrease &&
      read.data.lumpsums?.grossAmount === PROD_FILL.lumpsumGross &&
      Number(read.data.lumpsums?.apiCredit) === Math.round(PROD_FILL.lumpsumGross * 0.10)
    );
    // R2 read-back proof — the newly-extracted steps 9/10/11 persisted their
    // entered values (hours, the Planning rating, the goal targets).
    const r2Persisted = !!read.data && (
      read.data.officeHours    === PROD_FILL.officeHours &&
      read.data.fieldHours     === PROD_FILL.fieldHours &&
      read.data.ratingPlanning === PROD_FILL.ratingPlanning &&
      read.data.targetDials    === PROD_FILL.targetDials &&
      read.data.targetAPI      === PROD_FILL.targetAPI
    );

    const knownPerm = (e) => e.includes('Missing or insufficient permissions');
    const unknownErrors = errors.filter((e) => !knownPerm(e));
    const pass = reviewMatch && editPillsOk && celebrationVisible
      && celebrationApi === EXPECTED.productionAPI && celebrationLeaderboardCopy
      && persistedExists && persistedShape && r2Persisted && dupCheck.ok && unknownErrors.length === 0;

    RESULTS.push({
      theme, weekStarting,
      review, expected: EXPECTED, reviewMatch,
      editPillsOk,
      celebrationVisible, celebrationApi, celebrationLeaderboardCopy,
      persistedExists, persistedShape, r2Persisted,
      r2Values: read.data ? {
        officeHours: read.data.officeHours, fieldHours: read.data.fieldHours,
        ratingPlanning: read.data.ratingPlanning,
        targetDials: read.data.targetDials, targetAPI: read.data.targetAPI,
      } : null,
      step7NoDuplicateIds: dupCheck.ok, step7Ids: dupCheck.ids, step7Dupes: dupCheck.dupes,
      errors: errors.length,
      knownPermissionsErrors: errors.filter(knownPerm).length,
      unknownErrors: unknownErrors.length,
      pass,
    });
    console.log(
      `[wizard r2 ${theme}] reviewMatch=${reviewMatch} ` +
      `(api=${review.productionAPI}/${EXPECTED.productionAPI} cis=${review.cis}/${PROD_FILL.ciConducted} conv=${review.conv}/${EXPECTED.conv}%) ` +
      `editPills=${editPillsOk} step7NoDupIds=${dupCheck.ok} ` +
      `celebration=${celebrationVisible} celebApi=${celebrationApi}/${EXPECTED.productionAPI} leaderboardCopy=${celebrationLeaderboardCopy} ` +
      `persisted=${persistedExists} shape=${persistedShape} r2Persisted=${r2Persisted} ` +
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

console.log('\n=== Wizard v2 R2 retirement smoke summary ===');
for (const r of RESULTS) console.log(JSON.stringify(r));
process.exit(RESULTS.every((r) => r.pass) ? 0 : 1);

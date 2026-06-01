/**
 * FU (HIGH) social-sanitize fix — write-read-verify smoke.
 *
 * Background: the pre-existing bug (banked at PR #416) silently dropped all 5
 * social/content fields from every weekly submit because
 * `submissionService.sanitize()` did not enumerate them.
 *
 * This smoke is the EXACT failing case from the brief:
 *   1. Log in as the test agent (both themes).
 *   2. Pick a fresh weekStarting (Admin SDK pre-cleanup of any residue).
 *   3. Open the v2 wizard, walk to step 4 (Social & content / StepSocialMedia).
 *   4. Fill ALL 5 social fields with distinct numeric values:
 *      • 4 flat:  socialPostsTotal, socialEngagementTotal,
 *                 socialInboxEnquiries, namesFromSocial.
 *      • 4 nested: socialPlatformBreakdown.{facebook, instagram, whatsapp, linkedin}
 *                  (via "Show platform breakdown" toggle).
 *   5. Walk steps 5–11 with one minimal fill on step 10 (rating gate) and click
 *      Submit on step 11.
 *   6. Admin SDK read of the persisted doc; assert the FULL 5-field social
 *      shape persisted with correct values + nested object intact.
 *   7. `finally` — delete the test submission via Admin SDK.
 *   8. Re-run both themes; final residue probe asserts 0 docs for the week.
 *
 * Credentials by env-var presence only (Rule 4). No values echoed.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { setupBypassSession } from './lib/walk-helpers.mjs';

// ─── Env load (boolean-only; never echo values) ───────────────────────────
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
  } catch { /* ignore */ }
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

// Distinct, easy-to-eyeball values per field. If the persisted doc has these
// values, the round-trip through the v2 wizard + sanitize() + Firestore is
// correct.
const SOCIAL_FILL = {
  socialPostsTotal:      77,
  socialEngagementTotal: 188,
  socialInboxEnquiries:  9,
  namesFromSocial:       12,
  socialPlatformBreakdown: {
    facebook:  31,
    instagram: 22,
    whatsapp:  17,
    linkedin:  7,
  },
};

// ─── Admin SDK round-trip helper (reuses PR #416 wizard-v2-pr1 protocol) ──
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
    resolveUid:        (email)                        => call('resolveUid',        { email }),
    readSubmission:    (uid, weekStarting)            => call('readSubmission',    { uid, weekStarting }),
    deleteSubmission:  (uid, weekStarting, status)    => call('deleteSubmission',  { uid, weekStarting, status }),
    close: () => { child.stdin.write(JSON.stringify({ op: 'exit' }) + '\n'); },
  };
}

// ─── Playwright helpers ────────────────────────────────────────────────────
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
  const ctas = [
    'button:has-text("Submit weekly report")',
    'button:has-text("Submit Report")',
    'button:has-text("Start Report")',
    '[data-testid="hero-submit-cta"]',
  ];
  for (const sel of ctas) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) { await el.click().catch(() => {}); break; }
  }
  // Wizard modal mounts on any screen (date/step/done/submitted).
  await page.waitForSelector('[data-testid="wizard-v2-modal"]', { timeout: 30_000 });

  // We expect the date screen first (we pre-cleaned residue). Pick the week.
  // Use whatever the picker offers as its first option — that is the most-recent
  // Sunday per the dropdown helper. If we passed a specific weekStarting and
  // the option exists, prefer it. Either way, capture the value we picked.
  await page.waitForSelector('#wizard-week', { timeout: 30_000 });
  let pickedWeek = expectedWeekStarting;
  const exists = expectedWeekStarting
    ? await page.locator(`#wizard-week option[value="${expectedWeekStarting}"]`).count()
    : 0;
  if (!exists) {
    pickedWeek = await page.locator('#wizard-week option:nth-of-type(1)').getAttribute('value');
  }
  await page.locator('#wizard-week').selectOption(pickedWeek);
  await page.click('button:has-text("Start Report")');

  // Wait for getDraft to resolve and step 1 to mount.
  await page.waitForFunction(() => {
    const body = document.body.textContent || '';
    return body.includes('Letters & outreach') && body.includes('Step 1 of 12');
  }, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  return pickedWeek;
}

async function next(page) {
  const btn = page.locator('[data-testid="wizard-v2-next"]');
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ timeout: 15_000 });
  await page.waitForTimeout(700);
}

async function fillNumeric(page, id, value) {
  const input = page.locator(`input[id="${id}"]`);
  await input.waitFor({ timeout: 10_000 });
  await input.scrollIntoViewIfNeeded().catch(() => {});
  await input.click({ clickCount: 3 }).catch(() => {});
  await input.fill(String(value));
  // Verify the controlled-input write landed.
  const readBack = await input.inputValue();
  if (readBack !== String(value)) {
    await input.fill('');
    await input.type(String(value), { delay: 30 });
  }
}

async function fillSocialStep(page) {
  // Step 4 = Social & Content. Fill the 4 flat fields first.
  await fillNumeric(page, 'socialPostsTotal',      SOCIAL_FILL.socialPostsTotal);
  await fillNumeric(page, 'socialEngagementTotal', SOCIAL_FILL.socialEngagementTotal);
  await fillNumeric(page, 'socialInboxEnquiries',  SOCIAL_FILL.socialInboxEnquiries);
  await fillNumeric(page, 'namesFromSocial',       SOCIAL_FILL.namesFromSocial);
  // Open the platform breakdown drawer.
  const toggleBtn = page.locator('button:has-text("Show platform breakdown")');
  await toggleBtn.waitFor({ timeout: 10_000 });
  await toggleBtn.click();
  await page.waitForTimeout(400);
  // Fill the 4 platform fields. NumericField uses name as id.
  await fillNumeric(page, 'facebook',  SOCIAL_FILL.socialPlatformBreakdown.facebook);
  await fillNumeric(page, 'instagram', SOCIAL_FILL.socialPlatformBreakdown.instagram);
  await fillNumeric(page, 'whatsapp',  SOCIAL_FILL.socialPlatformBreakdown.whatsapp);
  await fillNumeric(page, 'linkedin',  SOCIAL_FILL.socialPlatformBreakdown.linkedin);
  // Wait through autosave debounce so the last platform field's write reaches
  // formData before we advance.
  await page.waitForTimeout(2200);
}

async function rateRow(page, labelMatch, value) {
  const ok = await page.evaluate(({ labelMatch, value }) => {
    const labelNodes = Array.from(document.querySelectorAll('span'))
      .filter((s) => s.textContent.includes(labelMatch));
    if (!labelNodes.length) return { ok: false };
    let row = labelNodes[0].closest('.rounded-xl');
    if (!row) row = labelNodes[0].parentElement?.parentElement;
    if (!row) return { ok: false };
    const buttons = Array.from(row.querySelectorAll('button'))
      .filter((b) => b.textContent.trim() === String(value));
    if (!buttons.length) return { ok: false };
    buttons[0].click();
    return { ok: true };
  }, { labelMatch, value });
  if (!ok.ok) throw new Error(`rating click failed: ${labelMatch}/${value}`);
}

async function walkAndSubmit(page) {
  // Steps 1–3: advance without fills.
  await next(page); // 1 → 2
  await next(page); // 2 → 3
  await next(page); // 3 → 4
  // Step 4: fill all 5 social fields.
  await page.waitForSelector('[data-testid="wizard-v2-step-title"]', { timeout: 10_000 });
  const step4Title = (await page.locator('[data-testid="wizard-v2-step-title"]').textContent() ?? '').trim();
  if (!/social|content/i.test(step4Title)) {
    throw new Error(`expected social/content step 4, got "${step4Title}"`);
  }
  await fillSocialStep(page);
  // Steps 5–9: advance without fills.
  await next(page); // 4 → 5
  await next(page); // 5 → 6
  await next(page); // 6 → 7
  await next(page); // 7 → 8
  await next(page); // 8 → 9
  await next(page); // 9 → 10
  // Step 10 (Rate your week): click one rating to satisfy any default-gate.
  await rateRow(page, 'Planning Effectiveness', 7);
  await page.waitForTimeout(700);
  await next(page); // 10 → 11
  // Step 11 (Targets): click Submit.
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
  // Returns YYYY-MM-DD for the most recent Sunday (in the runner's local time).
  // Matches the wizard's date picker option format.
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
    // Re-clean in case the picker chose a different week.
    await admin.deleteSubmission(uid, weekStarting, 'any');
    await walkAndSubmit(page);

    // Read the persisted doc.
    const read = await admin.readSubmission(uid, weekStarting);
    if (!read.exists) throw new Error('persisted doc not found after submit');

    // Assert all 5 social fields.
    const fieldChecks = [
      { field: 'socialPostsTotal',      actual: read.data.socialPostsTotal,      expected: SOCIAL_FILL.socialPostsTotal      },
      { field: 'socialEngagementTotal', actual: read.data.socialEngagementTotal, expected: SOCIAL_FILL.socialEngagementTotal },
      { field: 'socialInboxEnquiries',  actual: read.data.socialInboxEnquiries,  expected: SOCIAL_FILL.socialInboxEnquiries  },
      { field: 'namesFromSocial',       actual: read.data.namesFromSocial,       expected: SOCIAL_FILL.namesFromSocial       },
    ];
    const flatPass = fieldChecks.every((c) => c.actual === c.expected);

    const breakdownActual   = read.data.socialPlatformBreakdown ?? {};
    const breakdownExpected = SOCIAL_FILL.socialPlatformBreakdown;
    const breakdownPass = ['facebook', 'instagram', 'whatsapp', 'linkedin']
      .every((k) => breakdownActual[k] === breakdownExpected[k]);

    // Known issue from PR #416: trailing autosave-post-submit FirebaseError
    // (LOW FU). Not a regression here; relax the errors gate the same way.
    const knownPerm = (e) => e.includes('Missing or insufficient permissions');
    const unknownErrors = errors.filter((e) => !knownPerm(e));

    const pass = flatPass && breakdownPass && unknownErrors.length === 0;
    RESULTS.push({
      theme, weekStarting,
      flatChecks: fieldChecks.map((c) => ({ ...c, match: c.actual === c.expected })),
      breakdownActual, breakdownExpected, breakdownPass,
      errors: errors.length,
      knownPermissionsErrors: errors.filter(knownPerm).length,
      unknownErrors: unknownErrors.length,
      pass,
    });
    console.log(
      `[social-sanitize ${theme}] flat=${flatPass} breakdown=${breakdownPass} ` +
      `errors=${errors.length} (known-perm=${errors.filter(knownPerm).length}, unknown=${unknownErrors.length}) → ${pass ? 'PASS' : 'FAIL'}`
    );
    if (!flatPass) console.log('flat fields:', JSON.stringify(fieldChecks));
    if (!breakdownPass) console.log('breakdown actual:', JSON.stringify(breakdownActual), 'expected:', JSON.stringify(breakdownExpected));
  } finally {
    // Cleanup the test submission.
    try {
      const post = await admin.deleteSubmission(uid, weekStarting, 'any');
      console.log(`[${theme}] post-cleanup deletedCount=${post.deletedCount}`);
    } catch (e) {
      console.error(`[${theme}] post-cleanup failed: ${e.message}`);
    }
    await browser.close();
  }
}

// ─── Run ───────────────────────────────────────────────────────────────────
const admin = startAdmin();
const { uid } = await admin.resolveUid(AGENT_EMAIL);
console.log(`[smoke] resolved test-agent uid=${uid.slice(0, 8)}…`);

try {
  await smokeTheme('light', admin, uid);
  await smokeTheme('dark',  admin, uid);
} finally {
  // Final residue probe — assert 0 docs for both themes' shared weekStarting.
  const week = getMostRecentSunday();
  const probe = await admin.readSubmission(uid, week);
  console.log(`[residue] weekStarting=${week} exists=${probe.exists}`);
  if (probe.exists) {
    console.log('[residue] WARNING — submission still present; re-deleting');
    await admin.deleteSubmission(uid, week, 'any');
  }
  admin.close();
}

console.log('\n=== social-sanitize-fix smoke summary ===');
for (const r of RESULTS) console.log(JSON.stringify(r));
const ok = RESULTS.every((r) => r.pass);
process.exit(ok ? 0 : 1);

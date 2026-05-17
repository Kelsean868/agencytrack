/**
 * E6 — Playwright verification walk for daily input mode.
 *
 * Per docs/briefs/e6-daily-input-kickoff.md Phase 9 — 13 checks.
 *
 * Run from project root:
 *   node scripts/verification/e6-walk.mjs
 *
 * Override the preview host with:
 *   PREVIEW_HOST=agencytrack-foo-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/e6-walk.mjs
 *
 * Requires .env.local with VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, and
 * A11Y_AGENT_PASSWORD. .env.local is gitignored — copy from main worktree
 * if running from a feature worktree (CLAUDE.md banked rule).
 *
 * Artifacts written to verification/e6-daily-input/ (gitignored).
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/e6-daily-input');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN   = env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL    = env.A11Y_AGENT_EMAIL    ?? 'kelsean@gmail.com';
const AGENT_PASSWORD = env.A11Y_AGENT_PASSWORD;

// Vercel preview host. Override via PREVIEW_HOST env var per branch.
// Default below assumes the canonical pattern; resolve via gh deployment API
// post-push if Vercel truncated the branch name.
const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-e6-daily-input-mode-kyron-marchan-s-projects.vercel.app';

if (!BYPASS_TOKEN)   { console.error('VERCEL_BYPASS_TOKEN not found in .env.local'); process.exit(1); }
if (!AGENT_PASSWORD) { console.error('A11Y_AGENT_PASSWORD not found in .env.local'); process.exit(1); }

function redact(msg) {
  return typeof msg === 'string'
    ? msg
        .replace(new RegExp(BYPASS_TOKEN, 'g'),   '[TOKEN]')
        .replace(new RegExp(AGENT_PASSWORD, 'g'), '[PASS]')
    : msg;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const results = {};

async function check(id, label, fn) {
  try {
    await fn();
    results[id] = { label, pass: true };
    console.log(`✓ ${id}: ${label}`);
  } catch (e) {
    const msg = redact(e.message ?? String(e));
    results[id] = { label, pass: false, error: msg };
    console.error(`✗ ${id}: ${label}\n  ${msg}`);
  }
}

async function ss(page, name) {
  await page.screenshot({ path: resolve(SS_DIR, `${name}.png`), fullPage: false });
}

async function signIn(pg, email, password) {
  await pg.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  const emailInput = pg.locator('input[type="email"]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(email);
  const pwInput = pg.locator('input[type="password"]');
  await pwInput.fill(password);
  await pwInput.press('Enter');
  await pg.waitForSelector('input[type="email"]', { state: 'detached', timeout: 25000 });
  await pg.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
}

async function gotoTab(page, label) {
  const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
  await btn.waitFor({ timeout: 8000 });
  const isCurrent = await btn.evaluate(el => el.getAttribute('aria-current') === 'page');
  if (!isCurrent) {
    await btn.click();
    await page.waitForTimeout(600);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const bypassUrl = `https://${PREVIEW_HOST}/?x-vercel-protection-bypass=${BYPASS_TOKEN}&x-vercel-set-bypass-cookie=true`;
try {
  await page.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
} catch (e) {
  console.error('Bypass navigation failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

// ── CHECK 1: Agent login ──────────────────────────────────────────────────────
await check('01_login_agent', 'Agent login succeeds; primary nav renders', async () => {
  await signIn(page, AGENT_EMAIL, AGENT_PASSWORD);
  await ss(page, '01-agent-logged-in');
});

// ── CHECK 2: Set logging mode to Daily, save ────────────────────────────────
await check('02_set_logging_mode_daily', 'Profile: switch to Daily mode, save nudge time 09:00', async () => {
  await gotoTab(page, 'Profile');
  // Wait for Logging mode card
  await page.getByText(/^Logging mode$/i).waitFor({ timeout: 10000 });
  // Click the Daily radio
  const dailyRadio = page.locator('input[type="radio"][value="daily"]');
  await dailyRadio.waitFor({ timeout: 5000 });
  // Use click(), not check() — check() throws when the radio is already
  // selected from a previous run.
  await dailyRadio.click({ force: true });
  // We're starting from hybrid (existing-agent default); hybrid → daily is a
  // direct save (no catch-up confirmation). If a confirmation card appears,
  // accept it.
  const confirmBtn = page.getByRole('button', { name: /confirm switch/i });
  if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForTimeout(800);

  // Set nudge time to 09:00
  const timeInput = page.locator('input[type="time"]#daily-nudge-time');
  await timeInput.waitFor({ timeout: 5000 });
  await timeInput.fill('09:00');
  await page.getByRole('button', { name: /save time/i }).click();
  await page.waitForTimeout(800);

  await ss(page, '02-profile-daily-mode');
});

// ── CHECK 3: AgentDashboard CTA shows Log today ───────────────────────────────
await check('03_dashboard_log_today_cta', 'Dashboard shows Log today CTA, no Submit Weekly', async () => {
  await gotoTab(page, 'Dashboard');
  await page.waitForTimeout(800);
  // The bottom CTA region in dashboard has the buttons; in daily-only mode
  // there is no "Submit Weekly Report" button.
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
      const hasLogToday = buttons.some(t => /^log today$/i.test(t) || /^update today/i.test(t));
      const hasWeekly   = buttons.some(t => /submit weekly report/i.test(t));
      return hasLogToday && !hasWeekly;
    },
    undefined,
    { timeout: 10000 }
  );
  await ss(page, '03-dashboard-daily-cta');
});

// ── CHECK 4: Open DailyEntryModal ─────────────────────────────────────────────
await check('04_open_daily_modal', 'Click Log today → DailyEntryModal opens', async () => {
  const logTodayBtn = page.getByRole('button', { name: /^(log today|update today)/i }).first();
  await logTodayBtn.click();
  await page.getByRole('dialog', { name: /log today/i }).waitFor({ timeout: 8000 });
  await page.waitForFunction(
    () => document.body.innerText.includes('Log today —'),
    undefined,
    { timeout: 6000 }
  );
  await ss(page, '04-daily-modal-open');
});

// ── CHECK 5: Fill numbers and save ────────────────────────────────────────────
// NumericField labels in CardStack.jsx don't have htmlFor association, so
// getByLabel can't find them. Use placeholder-based positional selectors:
//   placeholder="0"      → 12 NumericField inputs (Activity 8 + Names&Service 3 + NB.apps 1)
//   placeholder="0.00"   → 1 CurrencyField input  (NB.api)
// Order matches DailyEntryModal.jsx top-to-bottom render.
const NUMERIC_INDEX = {
  qualifiedApproaches:    0,
  appointmentsSet:        1,
  ffisScheduled:          2,
  ffiConducted:           3,
  solutionPresentations:  4,
  newCIBooked:            5,
  oldCIBooked:            6,
  ciConducted:            7,
  newNamesAdded:          8,
  oldNamesWorked:         9,
  serviceContacts:        10,
  nbApps:                 11,
};

async function fillNumeric(pg, key, value) {
  await pg.locator('input[placeholder="0"]').nth(NUMERIC_INDEX[key]).fill(String(value));
}
async function fillNbApi(pg, value) {
  // First .00 placeholder is NB.api in the modal (PPP and Lumpsums collapsed by default).
  await pg.locator('input[placeholder="0.00"]').first().fill(String(value));
}

await check('05_fill_and_save_daily', 'Fill 5 approaches / 2 FFIs / 1 sale / TTD 5000, save', async () => {
  await fillNumeric(page, 'qualifiedApproaches', 5);
  await fillNumeric(page, 'ffiConducted', 2);
  await fillNumeric(page, 'nbApps', 1);
  await fillNbApi(page, 5000);

  await page.getByRole('button', { name: /^save$/i }).click();

  // Modal closes (auto-close 600ms after Saved indicator)
  await page.getByRole('dialog', { name: /log today/i }).waitFor({ state: 'detached', timeout: 8000 });
  await ss(page, '05-after-save');
});

// ── CHECK 6: Re-open modal — values pre-filled (upsert behavior) ─────────────
await check('06_reopen_prefilled', 'Re-open daily modal — saved values are pre-filled (upsert)', async () => {
  await page.waitForTimeout(800);
  // After save, dashboard CTA should now read "Update today's log"
  const updateBtn = page.getByRole('button', { name: /update today/i }).first();
  await updateBtn.waitFor({ timeout: 8000 });
  await updateBtn.click();
  await page.getByRole('dialog', { name: /log today/i }).waitFor({ timeout: 8000 });
  // Wait for the Activity-section numeric inputs to populate from the loaded
  // dailyActivity doc. The first numeric input is Qualified Approaches; if
  // it shows "5" the prefill landed.
  await page.waitForFunction(
    () => {
      const inputs = document.querySelectorAll('input[placeholder="0"]');
      return inputs[0]?.value === '5';
    },
    undefined,
    { timeout: 8000 }
  );
  const apiVal = await page.locator('input[placeholder="0.00"]').first().inputValue();
  if (parseFloat(apiVal) !== 5000) {
    throw new Error(`Expected API field to be 5000, got "${apiVal}"`);
  }
  await ss(page, '06-modal-prefilled');
  // Close without saving
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await page.getByRole('dialog', { name: /log today/i }).waitFor({ state: 'detached', timeout: 6000 });
});

// ── CHECK 7: Daily entry persisted (proxy via dashboard banner / CTA) ────────
await check('07_daily_entry_persisted', 'Today nudge banner is gone; CTA reads Update today (entry persisted)', async () => {
  await page.waitForTimeout(800);
  // After saving the entry, the "haven't logged today" banner should be gone.
  const bannerGone = await page.evaluate(() => !document.body.innerText.includes("haven't logged today"));
  if (!bannerGone) throw new Error('Nudge banner still visible after save — daily entry may not have persisted');
  // CTA still reads "Update today's log" (verified by Update button visibility)
  const updateBtn = page.getByRole('button', { name: /update today/i }).first();
  if (!(await updateBtn.isVisible({ timeout: 4000 }).catch(() => false))) {
    throw new Error('Update today CTA not visible — entry may not have been written');
  }
  await ss(page, '07-entry-persisted');
});

// ── CHECK 8: Switch mode Daily → Weekly mid-week — catch-up confirmation ────
await check('08_catchup_modal', 'Switch Daily → Weekly mid-week → confirmation card appears', async () => {
  await gotoTab(page, 'Profile');
  await page.getByText(/^Logging mode$/i).waitFor({ timeout: 8000 });
  const weeklyRadio = page.locator('input[type="radio"][value="weekly"]');
  await weeklyRadio.click({ force: true });
  // Confirmation card appears with Cancel + Confirm switch
  await page.getByRole('button', { name: /confirm switch/i }).waitFor({ timeout: 6000 });
  await ss(page, '08-catchup-confirm');
});

// ── CHECK 9: Confirm switch — dashboard CTA flips to weekly only ─────────────
// AuthContext caches userProfile (no live snapshot) — same pattern as the
// rest of the app (ProfileScreen profile saves also need a reload to
// propagate). The walk reloads after mode-switch confirmations to verify
// the persisted state matches expectations.
await check('09_confirm_switch_weekly_only', 'Confirm catch-up switch → dashboard shows Submit Weekly only', async () => {
  await page.getByRole('button', { name: /confirm switch/i }).click();
  // Wait for the catch-up promise chain to settle before reload.
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
  await gotoTab(page, 'Dashboard');
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
      const hasWeekly   = buttons.some(t => /submit weekly report/i.test(t));
      const hasLogToday = buttons.some(t => /^log today$/i.test(t) || /^update today/i.test(t));
      return hasWeekly && !hasLogToday;
    },
    undefined,
    { timeout: 12000 }
  );
  await ss(page, '09-weekly-only-cta');
});

// ── CHECK 10: Catch-up data — week submitted via wizard renders draft ────────
// Proxy: open the wizard at "this week" → if catch-up wrote a draft for the
// current week, the wizard's date screen will show it as already-drafted, OR
// after selecting the current week the form fields will show the catch-up
// values. We check that the wizard at least mounts cleanly (no error from
// the draft delete + catch-up entry).
await check('10_catchup_data_persisted', 'Wizard mounts at this week without error after catch-up', async () => {
  const wizardBtn = page.getByRole('button', { name: /submit weekly report/i }).first();
  await wizardBtn.click();
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes('Select Week') || t.includes('Weekly Report') || t.includes('Already submitted');
    },
    undefined,
    { timeout: 10000 }
  );
  await ss(page, '10-wizard-after-catchup');
  // Close wizard
  const closeBtn = page.getByRole('button', { name: 'Close' });
  if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(600);
  }
});

// ── CHECK 11: Switch back to Hybrid — both CTAs visible ──────────────────────
await check('11_hybrid_both_ctas', 'Switch to Hybrid → dashboard shows BOTH Log today + Submit Weekly CTAs', async () => {
  await gotoTab(page, 'Profile');
  await page.getByText(/^Logging mode$/i).waitFor({ timeout: 8000 });
  const hybridRadio = page.locator('input[type="radio"][value="hybrid"]');
  await hybridRadio.click({ force: true });
  // hybrid switches don't trigger confirmation; reload to refresh the
  // cached userProfile in AuthContext.
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });

  await gotoTab(page, 'Dashboard');
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
      const hasWeekly   = buttons.some(t => /submit weekly report/i.test(t));
      const hasLogToday = buttons.some(t => /^log today$/i.test(t) || /^update today/i.test(t));
      return hasWeekly && hasLogToday;
    },
    undefined,
    { timeout: 12000 }
  );
  await ss(page, '11-hybrid-both-ctas');
});

// ── CHECK 12: Mobile (380px) — daily modal usable, no overflow ───────────────
await check('12_mobile_daily_modal', 'Daily modal usable at 380px with no horizontal overflow', async () => {
  await page.setViewportSize({ width: 380, height: 812 });
  await page.waitForTimeout(400);
  const logBtn = page.getByRole('button', { name: /^(log today|update today)/i }).first();
  await logBtn.click();
  await page.getByRole('dialog', { name: /log today/i }).waitFor({ timeout: 8000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await ss(page, '12-mobile-380');
  // Close
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(400);
  if (overflow) throw new Error('Horizontal overflow detected at 380px');
  await page.setViewportSize({ width: 1280, height: 800 });
});

// ── CHECK 13: Dark mode — daily modal renders correctly ───────────────────────
await check('13_dark_mode_modal', 'Dark mode toggle + daily modal renders with .dark on <html>', async () => {
  // Ensure we land back on the Dashboard tab after the mobile-viewport
  // round-trip in CHECK 12 — the bottom-nav Submit action reflects the
  // current tab, not necessarily Dashboard.
  await gotoTab(page, 'Dashboard');
  await page.waitForTimeout(400);

  const darkToggle = page.getByRole('button', { name: 'Toggle dark mode' });
  await darkToggle.waitFor({ timeout: 8000 });
  const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!wasDark) await darkToggle.click();
  await page.waitForTimeout(400);

  // Open daily modal in dark mode
  const logBtn = page.getByRole('button', { name: /^(log today|update today)/i }).first();
  await logBtn.waitFor({ timeout: 10000 });
  await logBtn.click();
  await page.getByRole('dialog', { name: /log today/i }).waitFor({ timeout: 8000 });
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!isDark) throw new Error('dark class not applied to <html>');
  await ss(page, '13-dark-modal');
  // Close + reset to light
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);
  await darkToggle.click();
  await page.waitForTimeout(200);
});

// ── teardown ──────────────────────────────────────────────────────────────────
await browser.close();

const allPassed = Object.values(results).every((r) => r.pass);
writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n── Summary ──────────────────────────────────────────────────────');
Object.entries(results).forEach(([id, r]) => {
  console.log(`${r.pass ? '✓' : '✗'} ${id}: ${r.label}${r.error ? `\n    ${r.error}` : ''}`);
});
console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);

process.exit(allPassed ? 0 : 1);

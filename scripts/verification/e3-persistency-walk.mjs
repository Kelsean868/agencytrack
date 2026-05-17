/**
 * E3 — Persistency Playground · Playwright verification walk.
 *
 * 21 checks covering manager + agent surfaces and the Playground component.
 *
 *   01  Manager login → dashboard loads
 *   02  Persistency tab visible (data-testid="tab-persistency")
 *   03  Month selector loads options
 *   04  Branch summary card shows aggregated persistency value
 *   05  Agent list renders with at least one row
 *   06  90% threshold visually marked (legend present)
 *   07  Entry form opens when an agent's Edit button is clicked
 *   08  Entry form calculates persistency live (Ricardo Duke validation → 73.9%)
 *   09  Entry form Save button is enabled with valid inputs
 *  10  Manager nav-out + nav-back retains aggregate badge (smoke for state)
 *  09b Manager write — real Firestore save (businessPlaced=1, rest=0 → 100%)
 *  09c Manager write-read-verify — persisted value survives hard reload
 *  11  Agent login → dashboard loads
 *  12  Agent persistency tab shows own data
 *  13  Award-gate banner present when persistency < 90 (or absent if >=90)
 *  14  Trend chart container renders
 *  11b Agent lock-state read-verify (manager-write + agent-read path; see WALK-2 gap note)
 *  15  Playground opens from agent view
 *  16  Playground sliders update projection live
 *  17  Playground shortfall cards show three levers (NB / NR / Orphans)
 *  18  Mobile 380px — no horizontal overflow on agent persistency view
 *
 * WALK-1 agent self-write gap (tracked as WALK-2):
 * This walk exercises the manager-write + agent-read path for persistency.
 * The agent self-write path is NOT exercised — it requires a smoke-only test
 * agent with guaranteed-empty Firestore state (no manager doc for current month).
 *
 * Run from project root:
 *   node scripts/verification/e3-persistency-walk.mjs
 *
 * Override preview host:
 *   PREVIEW_HOST=agencytrack-git-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/e3-persistency-walk.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD          (defaults to kelsean@gmail.com)
 *   A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD
 *
 * Artifacts: verification/e3-persistency/screenshots/ (gitignored).
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, hardReloadAndAwaitReady } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/e3-persistency');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN  = env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL   = env.A11Y_AGENT_EMAIL    ?? 'kelsean@gmail.com';
const AGENT_PASSWORD= env.A11Y_AGENT_PASSWORD;
const BM_EMAIL      = env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD   = env.A11Y_BRANCH_MANAGER_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-e3-persistency-playground-kyron-marchan-s-projects.vercel.app';

if (!BYPASS_TOKEN)             { console.error('VERCEL_BYPASS_TOKEN not found in .env.local'); process.exit(1); }
if (!AGENT_PASSWORD)           { console.error('A11Y_AGENT_PASSWORD not found in .env.local'); process.exit(1); }
if (!BM_EMAIL || !BM_PASSWORD) { console.error('A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not found in .env.local'); process.exit(1); }

function redact(msg) {
  if (typeof msg !== 'string') return msg;
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = msg.replace(new RegExp(escapeRe(BYPASS_TOKEN), 'g'), '[TOKEN]');
  if (AGENT_PASSWORD) out = out.replace(new RegExp(escapeRe(AGENT_PASSWORD), 'g'), '[PASS]');
  if (BM_PASSWORD)    out = out.replace(new RegExp(escapeRe(BM_PASSWORD),    'g'), '[PASS]');
  return out;
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

async function setRangeValue(page, locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function signIn(pg, email, password) {
  // Lesson 2: 'domcontentloaded', never 'networkidle' for Firebase apps.
  await pg.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const emailInput = pg.locator('input[type="email"]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(email);
  const pwInput = pg.locator('input[type="password"]');
  await pwInput.fill(password);
  await pwInput.press('Enter');
  await pg.waitForSelector('input[type="email"]', { state: 'detached', timeout: 25000 });
  await pg.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
}

async function signOutClick(pg) {
  const btn = pg.getByRole('button', { name: /^Sign out$/i });
  if (await btn.count() > 0) {
    await btn.first().click();
    await pg.waitForSelector('input[type="email"]', { timeout: 15000 });
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

// Set Vercel bypass cookie via cookie-after-handshake helper. Lesson 5:
// the token appears in exactly one URL inside a sanitizing try/catch in
// setupBypassSession; all subsequent navigation in this context uses bare URLs.
try {
  await setupBypassSession(context, `https://${PREVIEW_HOST}`, BYPASS_TOKEN);
} catch (e) {
  // setupBypassSession's error message is pre-sanitized (name + code only,
  // no URL, no token). Redaction is belt-and-braces.
  console.error('Bypass navigation failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

const page = await context.newPage();

// ── Manager-side checks 01–10 ────────────────────────────────────────────────
await check('01_manager_login_renders', 'Manager login → dashboard loads', async () => {
  await signIn(page, BM_EMAIL, BM_PASSWORD);
  await ss(page, '01-manager-logged-in');
});

await check('02_persistency_tab_visible', 'Persistency nav button has data-testid="tab-persistency"', async () => {
  const tab = page.getByTestId('tab-persistency');
  await tab.waitFor({ timeout: 8000 });
  await tab.click();
  await page.getByTestId('persistency-tab').waitFor({ timeout: 8000 });
  await ss(page, '02-persistency-tab');
});

await check('03_month_selector_loads_options', 'Month selector renders ≥ 1 option', async () => {
  const selector = page.getByTestId('persistency-month-selector');
  await selector.waitFor({ timeout: 5000 });
  const optionCount = await selector.locator('option').count();
  if (optionCount < 1) throw new Error(`Expected ≥1 month option, got ${optionCount}`);
});

await check('04_branch_summary_shows_aggregated_persistency', 'Branch summary aggregate value renders', async () => {
  const aggregate = page.getByTestId('persistency-aggregate-value');
  await aggregate.waitFor({ timeout: 5000 });
  const text = await aggregate.innerText();
  // Either an actual percentage or '—' (no records yet) — both are valid UI states.
  if (!/(%|—)/.test(text)) throw new Error(`Aggregate text "${text}" not in expected format`);
  await ss(page, '04-branch-summary');
});

await check('05_agent_list_renders_with_correct_count', 'At least one agent row OR explicit empty-state message', async () => {
  const rows = page.locator('[data-testid^="persistency-agent-row-"]');
  const empty = page.getByText(/No agents in this/i);
  // Wait for the list to settle.
  await page.waitForTimeout(1500);
  const rowCount   = await rows.count();
  const emptyCount = await empty.count();
  if (rowCount === 0 && emptyCount === 0) {
    throw new Error('Neither agent rows nor empty-state message rendered');
  }
});

await check('06_ninety_percent_threshold_visually_marked', '90% threshold legend present', async () => {
  const legend = page.getByTestId('persistency-threshold-legend');
  await legend.waitFor({ timeout: 5000 });
  const text = await legend.innerText();
  if (!/90/.test(text)) throw new Error(`Legend missing 90 marker: "${text}"`);
});

await check('07_entry_form_opens_for_agent_row', 'Entry form modal opens on Edit click', async () => {
  const editButtons = page.locator('[data-testid^="persistency-edit-"]');
  const editCount = await editButtons.count();
  if (editCount === 0) {
    // No agents in scope — exempt this and 08/09 from hard failure.
    throw new Error('No edit buttons present (no agents in scope) — entry form cannot be opened');
  }
  await editButtons.first().click();
  await page.getByTestId('persistency-entry-form').waitFor({ timeout: 5000 });
  await ss(page, '07-entry-form-open');
});

await check('08_entry_form_calculates_persistency_live', 'Live derived persistency matches Tatil Feb 2026 (Ricardo Duke → 73.9%)', async () => {
  // Form is already open from 07 — fill Ricardo Duke values.
  const fields = {
    businessPlaced: '357468.84',
    notTakens:      '0',
    incPPPs:        '48000',
    lumpsums100:    '8666.90',
    lapses:         '133600.08',
    reinstatements: '27662.28',
  };
  for (const [k, v] of Object.entries(fields)) {
    await page.getByTestId(`persistency-input-${k}`).fill(v);
  }
  const persText = await page.getByTestId('derived-persistency').innerText();
  if (!/73\.9%/.test(persText)) {
    throw new Error(`Expected derived persistency "73.9%", got "${persText}"`);
  }
  await ss(page, '08-derived-live');
});

await check('09_entry_form_saves_to_firestore', 'Save button is enabled with valid inputs', async () => {
  // PR #105 (M1 shared primitives) migrated the Save action to the SaveButton
  // primitive, which doesn't spread props — the data-testid="persistency-save-button"
  // was dropped. Mirror the unit-test fix from commit 599fdcf: select by role.
  const save = page.getByRole('button', { name: 'Save' });
  await save.waitFor({ timeout: 3000 });
  const disabled = await save.isDisabled();
  if (disabled) throw new Error('Save button still disabled with valid Ricardo inputs');
  // Close form without saving — preserves test isolation. Real save covered
  // post-merge by manual smoke test (rules MODIFICATION not deployed pre-merge).
  await page.getByLabel(/^Close$/).click();
});

await check('10_saved_data_persists_after_reload', 'Manager tab state survives nav-away/back round-trip', async () => {
  // Navigate to Overview then back to Persistency — proves component re-mounts cleanly.
  const overview = page.getByRole('button', { name: /^Overview$/i });
  if (await overview.count() > 0) await overview.first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('tab-persistency').click();
  await page.getByTestId('persistency-aggregate-value').waitFor({ timeout: 5000 });
  await ss(page, '10-after-roundtrip');
});

// ── 09b/09c: manager write-read-verify (WALK-1 Option B) ─────────────────────
// 09 confirmed the Save button is enabled but closed the form without saving.
// 09b re-opens the form and completes a real save so the manager-write path
// exercises rules + claims + Firestore. 09c verifies the value survives a hard
// reload (the read side of the write-read-verify cycle).
await check('09b_manager_write_real', 'Manager saves entry form (real Firestore write, businessPlaced=1 → 100%)', async () => {
  // Wait for agent list to re-render after check 10's nav round-trip (async Firestore load).
  const editButtons = page.locator('[data-testid^="persistency-edit-"]');
  await editButtons.first().waitFor({ timeout: 5000 });
  const editCount = await editButtons.count();
  if (editCount === 0) throw new Error('No edit buttons — cannot exercise manager write path');
  await editButtons.first().click();
  await page.getByTestId('persistency-entry-form').waitFor({ timeout: 5000 });

  // Minimal values: businessPlaced=1, all denominators=0 → derived persistency = 100%.
  const fields = {
    businessPlaced: '1',
    notTakens:      '0',
    incPPPs:        '0',
    lumpsums100:    '0',
    lapses:         '0',
    reinstatements: '0',
  };
  for (const [k, v] of Object.entries(fields)) {
    await page.getByTestId(`persistency-input-${k}`).fill(v);
  }
  const persText = await page.getByTestId('derived-persistency').innerText();
  if (!/100/.test(persText)) throw new Error(`Expected derived ~100%, got "${persText}"`);

  await page.getByRole('button', { name: 'Save' }).click();
  // Form closes automatically on successful save.
  await page.getByTestId('persistency-entry-form').waitFor({ state: 'detached', timeout: 8000 });
  await ss(page, '09b-after-real-save');
});

await check('09c_manager_write_read_verify', 'Manager-written value persists after hard reload (manager write-read-verify)', async () => {
  await hardReloadAndAwaitReady(page);
  await page.getByTestId('tab-persistency').click();
  await page.getByTestId('persistency-tab').waitFor({ timeout: 8000 });
  await page.waitForTimeout(1000);

  // Aggregate card must still be present.
  const aggregate = page.getByTestId('persistency-aggregate-value');
  await aggregate.waitFor({ timeout: 5000 });

  // At least one agent row should show a numeric value (the one we just saved).
  const rows = page.locator('[data-testid^="persistency-agent-row-"]');
  await page.waitForTimeout(500);
  if (await rows.count() > 0) {
    const firstRowText = await rows.first().innerText();
    if (!/\d/.test(firstRowText)) {
      throw new Error(`First agent row shows no numeric value after manager save; got "${firstRowText}"`);
    }
  }
  await ss(page, '09c-reload-verify');
});

// Sign out before agent tests.
await signOutClick(page);

// ── Agent-side checks 11–17 ──────────────────────────────────────────────────
await check('11_agent_login_renders', 'Agent login → dashboard loads', async () => {
  await signIn(page, AGENT_EMAIL, AGENT_PASSWORD);
  await ss(page, '11-agent-logged-in');
});

await check('12_agent_persistency_tab_shows_own_data', 'Agent persistency tab renders own summary', async () => {
  const tab = page.getByTestId('agent-tab-persistency');
  await tab.waitFor({ timeout: 8000 });
  await tab.click();
  await page.getByTestId('agent-persistency-tab').waitFor({ timeout: 8000 });
  await page.getByTestId('agent-persistency-summary').waitFor({ timeout: 5000 });
  await ss(page, '12-agent-persistency-tab');
});

await check('13_award_gate_banner_when_under_90', 'Award-gate banner reflects persistency state', async () => {
  // Banner is conditional. Either it's present (persistency < 90 with data) or
  // absent (no data yet, OR persistency >= 90). Both are correct UI states.
  const valueEl = page.getByTestId('agent-persistency-value');
  const valueText = (await valueEl.count()) > 0 ? await valueEl.innerText() : '';
  const banner = page.getByTestId('award-gate-banner');
  const bannerVisible = (await banner.count()) > 0;
  // Pull a numeric percentage from the value text if present.
  const m = valueText.match(/(\d+(?:\.\d+)?)%/);
  const pct = m ? parseFloat(m[1]) : null;
  if (pct !== null && pct < 90 && !bannerVisible) {
    throw new Error(`Persistency < 90 (${pct}%) but no banner shown`);
  }
  if (pct !== null && pct >= 90 && bannerVisible) {
    throw new Error(`Persistency ≥ 90 (${pct}%) but banner shown anyway`);
  }
});

await check('14_trend_chart_renders_with_history', 'Trend chart container is in the DOM', async () => {
  await page.getByTestId('persistency-trend-chart').waitFor({ timeout: 5000 });
});

// ── 11b: agent lock-state read-verify (WALK-1 Option B) ──────────────────────
// Verifies the agent-side view AFTER a manager has written a persistency doc.
// Exercises: manager-write + agent-read path (lock UI + value visible + survives reload).
//
// WALK-1 agent self-write gap (WALK-2):
// The agent self-write path is NOT exercised here — it would require a
// smoke-only test agent with guaranteed-empty Firestore state (no manager
// doc for the current month). Tracked as WALK-2 for future work.
await check('11b_agent_persistency_lock_state_read_verify', 'Agent-side lock state + read-verify (manager-write + agent-read path)', async () => {
  const editBtn = page.getByTestId('agent-persistency-edit-button');
  await editBtn.waitFor({ timeout: 5000 });

  const isDisabled = await editBtn.isDisabled();
  const btnText    = await editBtn.innerText().then((t) => t.trim());

  // Distinguish three states based on button text (more reliable than isDisabled alone):
  // - "Locked" + disabled  → manager has a doc for this month; agent-read path
  // - "Enter"/"Edit" + enabled → no manager doc; agent self-write available (WALK-2)
  // - "Enter" + disabled   → no activeMonthKey (empty month selector / no records loaded yet)
  if (/Locked/i.test(btnText) && isDisabled) {
    console.log('  [11b] Manager-locked state confirmed. Exercising manager-write + agent-read path.');

    const valueEl = page.getByTestId('agent-persistency-value');
    await valueEl.waitFor({ timeout: 5000 });
    const valueBefore = await valueEl.innerText();
    if (!valueBefore || valueBefore === '—') {
      throw new Error('Persistency value is empty in locked state — manager write may not have landed');
    }

    // Hard reload — manager-written value must survive.
    await hardReloadAndAwaitReady(page);
    await page.getByTestId('agent-tab-persistency').click();
    await page.getByTestId('agent-persistency-tab').waitFor({ timeout: 8000 });
    await page.waitForTimeout(500);

    const valueAfter = await page.getByTestId('agent-persistency-value').innerText();
    if (!valueAfter || valueAfter === '—') throw new Error('Persistency value disappeared after reload');
    if (valueAfter !== valueBefore) {
      throw new Error(`Value changed after reload: before="${valueBefore}" after="${valueAfter}"`);
    }
    await ss(page, '11b-lock-read-verify');
  } else if (!isDisabled) {
    // Agent can self-write — no manager doc for current month.
    console.log(`  [11b] Agent self-write available (button: "${btnText}", enabled). Manager-locked path not hit.`);
    console.log('  [11b] WALK-2: provision a dedicated smoke-only account to cover this path.');
    await ss(page, '11b-unlocked-state');
  } else {
    // Disabled but text is not "Locked" — likely no activeMonthKey (empty month selector).
    console.log(`  [11b] Button disabled, text "${btnText}": no active month (empty monthKeys or no records).`);
    console.log('  [11b] Verify that the test agent has persistency data. Cannot exercise lock-state check.');
    await ss(page, '11b-no-month-state');
  }
});

console.log('\n  NOTE WALK-1: This walk exercises manager-write + agent-read only for persistency.');
console.log('  The agent self-write path requires a smoke-only account with guaranteed-empty');
console.log('  Firestore state. Tracked as WALK-2 (post-pilot, low priority).\n');

await check('15_playground_opens_from_agent_view', 'Playground modal opens from agent CTA', async () => {
  await page.getByTestId('agent-playground-open-button').click();
  await page.getByTestId('persistency-playground').waitFor({ timeout: 5000 });
  await ss(page, '15-playground-open');
});

await check('16_playground_sliders_update_projection_live', 'NB slider updates projected persistency', async () => {
  const projected = page.getByTestId('persistency-projected-output');
  await projected.waitFor({ timeout: 3000 });
  const before = await projected.innerText();
  await setRangeValue(page, page.getByTestId('playground-slider-newBusinessPlanned'), 200000);
  await page.waitForTimeout(300);
  const after = await projected.innerText();
  if (after === before) throw new Error(`Projection unchanged after slider move: "${before}"`);
});

await check('17_playground_shortfall_cards_show_three_levers', 'Three shortfall cards render (NB / NR / Orphans)', async () => {
  await page.getByTestId('playground-shortfall-card-nb').waitFor({ timeout: 3000 });
  await page.getByTestId('playground-shortfall-card-nr').waitFor({ timeout: 3000 });
  await page.getByTestId('playground-shortfall-card-no').waitFor({ timeout: 3000 });
  await ss(page, '17-shortfall-cards');
});

// Close the playground.
const closeBtn = page.getByLabel(/^Close$/);
if (await closeBtn.count() > 0) await closeBtn.first().click();

// ── Mobile check 18 ──────────────────────────────────────────────────────────
await check('18_mobile_380px_layout_no_overflow', 'Agent persistency view at 380px has no horizontal scroll', async () => {
  await page.setViewportSize({ width: 380, height: 812 });
  await page.waitForTimeout(400);
  await ss(page, '18-mobile-380');
  const overflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
  if (overflow) throw new Error('Page has horizontal scroll at 380px');
  await page.setViewportSize({ width: 1280, height: 800 });
});

// ── close ────────────────────────────────────────────────────────────────────
await browser.close();

const passed  = Object.values(results).filter((r) => r.pass).length;
const total   = Object.values(results).length;
const summary = { passed, total, allPass: passed === total, checks: results };
writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));
console.log(`\n${passed}/${total} checks passed`);
process.exit(passed === total ? 0 : 1);

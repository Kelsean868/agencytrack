/**
 * smoke-unit-financing-k10a.mjs — UM-signed-in, unit-scoped, value-level smoke for
 * Track K · K10a (UnitFinancingRoster, read-only view + coach).
 *
 * Prereq: seed first (resolves the UM uid, stamps in-unit agents' unitId) —
 *   node scripts/verification/seed-unit-financing-k10a.mjs --apply
 * then run (from the main worktree, .env.local present):
 *   SMOKE_BASE_URL="https://agencytrack-git-feat-k10a-unit-financing-roster-kyron-marchan-s-projects.vercel.app" \
 *     node scripts/verification/smoke-unit-financing-k10a.mjs
 * and clean up:
 *   node scripts/verification/seed-unit-financing-k10a.mjs --cleanup
 *
 * Signs in AS THE UNIT MANAGER (never a BM/admin) and asserts, value-level, both themes:
 *   5.1 roster shows ONLY the unit's agents — the out-of-unit foil is ABSENT.
 *   5.2 the UM's OWN row is ABSENT (role filter) — asserted via exact row count = 3.
 *   5.3 the miss agent shows the MONTHLY-miss count (2); the provisional month never counts.
 *   5.4 adjustmentPct + confirmed draw are LOCKED — NO proration input, NO Confirm button.
 *   5.5 the >10% flag is a STATUS pill ("with Branch Manager"), not an actionable control.
 *   5.6 the surplus row renders success-green "owed to agent", not an error.
 *   5.7 CoachNote write→read cycle (exercises the coachingNotes UM-scope rule w/ agentUnitId).
 *   5.8 no confirmed figure renders without its basisSource badge.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  waitForLoaded,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var: ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) throw new Error('Set SMOKE_BASE_URL to the preview (or prod) URL');

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };
const count = (page, sel) => page.locator(sel).count();
const NOTE_BODY = `K10A-SMOKE-NOTE-${process.pid}-${Date.now()}`;

// FIX 2 (FU financing-display-polish) — expected 1-BASED draw-month chip value.
// Mirrors the seed's effectiveDate math (seed-unit-financing-k10a.mjs: eff = 1st of
// the month 6 calendar months back → 6 whole months elapsed → 1-based month 7).
// Same UTC-vs-TT month-boundary caveat as the K9 smoke's month keys.
const _now = new Date();
const _eff = new Date(Date.UTC(_now.getUTCFullYear(), _now.getUTCMonth() - 6, 1));
const _elapsed = (_now.getUTCFullYear() - _eff.getUTCFullYear()) * 12 + (_now.getUTCMonth() - _eff.getUTCMonth());
const EXPECTED_DRAW_MONTH = Math.min(_elapsed + 1, 12); // = 7

async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2000);
}

async function gotoUnitFinancing(page) {
  const tryClick = async () => {
    for (const id of ['pinned-unit-financing', 'nav-unit-financing']) {
      const loc = page.locator(`[data-testid="${id}"]`);
      if (await loc.count() > 0) { await loc.first().click(); return true; }
    }
    return false;
  };
  if (await tryClick()) return true;
  // workspace-layout fallback: switch to the My Team workspace, then retry.
  const toggle = page.locator('[data-testid="sidebar-ws-team"], [data-testid="sidebar-ws-toggle-team"]');
  if (await toggle.count() > 0) { await toggle.first().click(); await page.waitForTimeout(400); }
  return tryClick();
}

async function assertRoster(page, theme) {
  const t = (id) => `${id}[${theme}]`;

  // 5.1 + 5.2 — exactly the 3 in-unit agents; foil + UM own row absent.
  const rows = await count(page, '[data-testid^="unit-financing-row-"]');
  rows === 3 ? pass(t('5.2-row-count'), 'exactly 3 in-unit agents (UM own row + foil absent)')
    : fail(t('5.2-row-count'), `expected 3 rows, saw ${rows}`);
  (await count(page, '[data-testid="unit-financing-row-k10a_foil"]')) === 0
    ? pass(t('5.1-foil-absent'), 'out-of-unit foil not surfaced')
    : fail(t('5.1-foil-absent'), 'k10a_foil leaked into the UM roster');
  for (const uid of ['k10a_miss', 'k10a_adj', 'k10a_surplus']) {
    (await count(page, `[data-testid="unit-financing-row-${uid}"]`)) === 1
      ? pass(t(`present-${uid}`)) : fail(t(`present-${uid}`), `${uid} row missing`);
  }

  // 5.3 — monthly-miss count = 2 (provisional tail does not advance it).
  const miss = page.locator('[data-testid="unit-financing-miss-k10a_miss"]');
  if (await miss.count() > 0) {
    const c = await miss.getAttribute('data-count');
    const sev = await miss.getAttribute('data-severity');
    (c === '2' && sev === 'amber') ? pass(t('5.3-miss-count'), `count=${c} severity=${sev} (provisional not counted)`)
      : fail(t('5.3-miss-count'), `data-count=${c} data-severity=${sev}`);
  } else { fail(t('5.3-miss-count'), 'miss monitor for k10a_miss not rendered'); }

  // 5.4 — confirmed draw + adjustmentPct LOCKED; NO write affordances in the DOM.
  const draw = page.locator('[data-testid="unit-financing-draw-k10a_adj"]');
  (await draw.count() > 0 && /4,300/.test((await draw.textContent()) ?? ''))
    ? pass(t('5.4-draw-locked'), 'confirmed draw renders read-only (TTD 4,300)')
    : fail(t('5.4-draw-locked'), `draw cell=${await draw.textContent().catch(() => null)}`);
  const noInput = (await count(page, '[data-testid="proration-manager-input"]')) === 0;
  const noConfirm = (await count(page, 'text=Confirm financing')) === 0;
  (noInput && noConfirm) ? pass(t('5.4-no-write'), 'no proration input, no Confirm button')
    : fail(t('5.4-no-write'), `input=${!noInput} confirmBtn=${!noConfirm}`);

  // 5.5 — >10% flag is a STATUS pill, not an actionable notify.
  const status = page.locator('[data-testid="unit-financing-notify-status-k10a_adj"]');
  (await status.count() > 0 && /with Branch Manager/i.test((await status.textContent()) ?? ''))
    ? pass(t('5.5-adj-status'), 'shown as "with Branch Manager" status')
    : fail(t('5.5-adj-status'), `status pill=${await status.textContent().catch(() => null)}`);
  (await count(page, '[data-testid="financing-notify-btn"]')) === 0
    ? pass(t('5.5-no-notify-btn'), 'BM Notify button absent on the UM surface')
    : fail(t('5.5-no-notify-btn'), 'financing-notify-btn present — UM must not fire the 5.3 notify');

  // 5.6 — surplus row is success-green "owed to agent", not an error.
  const surplus = page.locator('[data-testid="unit-financing-row-k10a_surplus"]');
  (await surplus.count() > 0 && /owed to agent/i.test((await surplus.textContent()) ?? ''))
    ? pass(t('5.6-surplus'), 'negative balance → "owed to agent"')
    : fail(t('5.6-surplus'), 'surplus row did not render the owed-to-agent note');

  // 5.9 (FIX 2) — the term chip is 1-BASED (effectiveDate's own month = month 1;
  // the shipped MONTH-n convention). Value-level against the seed's effectiveDate.
  const term = page.locator('[data-testid="unit-financing-term-k10a_adj"]');
  const termText = (await term.count()) > 0 ? ((await term.textContent()) ?? '') : null;
  (termText !== null && termText.includes(`Fin. month ${EXPECTED_DRAW_MONTH} / 12`))
    ? pass(t('5.9-month-chip-1based'), `term chip reads "Fin. month ${EXPECTED_DRAW_MONTH} / 12"`)
    : fail(t('5.9-month-chip-1based'), `expected "Fin. month ${EXPECTED_DRAW_MONTH} / 12", got ${JSON.stringify(termText)}`);
}

// 5.8 — a confirmed figure never renders without its basisSource badge (drawer).
async function assertBasisBadge(page) {
  await page.locator('[data-testid="unit-financing-view-k10a_adj"]').first().click();
  const drawer = page.locator('[data-testid="unit-financing-drawer"]');
  await drawer.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  (await count(page, '[data-testid="unit-financing-drawer"] [data-testid="financing-basis-badge"]')) > 0
    ? pass('5.8-basis-badge', 'confirmed figure carries its basisSource badge')
    : fail('5.8-basis-badge', 'no basis badge in the read-only drawer');
  // 5.4 (drawer scope) — the read-only detail drawer itself carries no write affordances.
  const drawerNoInput = (await drawer.locator('[data-testid="proration-manager-input"]').count()) === 0;
  const drawerNoConfirm = (await drawer.locator('text=Confirm financing').count()) === 0;
  (drawerNoInput && drawerNoConfirm)
    ? pass('5.4-drawer-no-write', 'read-only drawer has no proration input / Confirm button')
    : fail('5.4-drawer-no-write', `drawer input=${!drawerNoInput} confirm=${!drawerNoConfirm}`);
  // K10b: Flag-to-BM is now a LIVE control (the escalation form), no longer disabled.
  const flag = page.locator('[data-testid="unit-financing-drawer-flag"]');
  (await flag.count() > 0 && !(await flag.isDisabled()))
    ? pass('k10b-flag-live', 'Flag to BM is a live control (K10b), not a disabled button')
    : fail('k10b-flag-live', 'Flag-to-BM affordance not a live control');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// 5.7 — CoachNote write→read cycle through the coachingNotes UM-scope rule.
async function assertCoachNote(page) {
  await page.locator('[data-testid="unit-financing-coach-k10a_miss"]').first().click();
  const modal = page.locator('[role="dialog"]');
  await modal.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  const textarea = page.locator('textarea[aria-label="Coaching note body"]');
  if (await textarea.count() === 0) { fail('5.7-coach-write', 'coaching note textarea not found'); return; }
  await textarea.fill(NOTE_BODY);
  await page.locator('button:has-text("Add Note")').first().click();
  // The modal reloads notes after the server-set createdAt — the note re-fetches
  // through the rules layer (agentUnitId == UM uid), proving the write + read.
  const persisted = await page.locator(`text=${NOTE_BODY}`).first()
    .waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
  persisted ? pass('5.7-coach-write-read', 'note persisted + re-read via UM-scope rule')
    : fail('5.7-coach-write-read', 'coaching note did not persist/re-read');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function run(browser, theme) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  // setTheme only registers a context init script (localStorage), so it must be
  // primed BEFORE the app's first navigation — otherwise the document loads on the
  // default (light) theme and the dark leg never actually exercises dark mode.
  await setTheme(ctx, theme);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try {
    await login(page, requireEnv('A11Y_UNIT_MANAGER_EMAIL'), requireEnv('A11Y_UNIT_MANAGER_PASSWORD'));
    pass(`um-login[${theme}]`, 'unit manager signed in');
  } catch (e) { fail(`um-login[${theme}]`, e.message); formatCaptureReport(cap); await ctx.close(); return; }

  if (!(await gotoUnitFinancing(page))) {
    fail(`nav[${theme}]`, 'Unit Financing nav (nav-unit-financing) not reachable');
    formatCaptureReport(cap); await ctx.close(); return;
  }
  const loaded = await waitForLoaded(page, 'unit-financing-roster', 20_000).then(() => true).catch(() => false);
  if (!loaded) { fail(`load[${theme}]`, 'unit-financing-roster did not load'); formatCaptureReport(cap); await ctx.close(); return; }
  await page.waitForTimeout(800);

  await assertRoster(page, theme);
  await assertBasisBadge(page);
  // CoachNote write-read only once (light) — a Firestore write, not a per-theme render check.
  if (theme === 'light') await assertCoachNote(page);

  formatCaptureReport(cap);
  await ctx.close();
}

(async () => {
  console.log(`\nK10a Unit Financing roster smoke → ${BASE_URL}`);
  const browser = await chromium.launch();
  try {
    await run(browser, 'light');
    await run(browser, 'dark');
  } finally { await browser.close(); }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`));
    process.exit(1);
  }
  console.log('All legs green.');
})();

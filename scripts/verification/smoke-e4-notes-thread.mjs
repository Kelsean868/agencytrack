/**
 * smoke-e4-notes-thread.mjs — Planner v2 E4 acceptance smoke (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-e4-notes-thread.mjs
 *
 * TABLET viewport (900×800 — single-column planner, sidebar-rail nav) exercising
 * the notes thread from the mobile card → churn → Edit path. Two legs per the
 * Option-1 ruling:
 *   1. addAppointmentNote write-read-verify: add a note on an appointment →
 *      RELOAD → the note persists in the thread (real Firestore round-trip).
 *   2. This-week prospect surfacing: booking a NEW appointment for the same
 *      prospect shows that prior note on the booking sheet (prospect-note-history).
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 * MUTATES appointments (residue: one sentinel appt for a seeded prospect with a
 * note; re-seed resets). Prospect "Marsha Toussaint" is seeded by seed-fixtures.
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene, TABLET_VIEWPORT } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

// Banked lesson #7: a DATA-PRESENCE check must not use isVisible() — Playwright
// treats content scrolled out of view inside an overflow container (a day column,
// the sheet's max-h/overflow-y body) as not visible, so a persisted card/note
// that merely sat below the fold read as a FAIL. Assert DOM attachment instead
// (also timing-robust right after a reload). Use isVisible() only when the
// human-visible viewport itself is the assertion.
const inDom = async (loc, timeout = 8_000) => {
  try { await loc.first().waitFor({ state: 'attached', timeout }); return true; } catch { return false; }
};
const PROSPECT = 'Marsha';
const SENTINEL_TIME = '15:45';
const SENTINEL_12 = '3:45 PM';
const NOTE = 'e4-marsha-note';

async function openPlanner(p) {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });
}
async function openSentinelEdit(p) {
  const card = p.locator('button[data-testid^="appt-card-"]').filter({ hasText: SENTINEL_12 }).first();
  await card.click();
  await p.locator(tsel('churn-dialog')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator(tsel('churn-action-edit')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
}
async function pickProspect(p) {
  await p.locator('#appt-prospect-search').fill(PROSPECT);
  await p.waitForTimeout(400);
  await p.locator('ul li button', { hasText: PROSPECT }).first().click();
}

const browser = await chromium.launch();
const ctx = await newLegContext(browser, { viewport: TABLET_VIEWPORT });
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  await login(p, 'agent1');
  await openPlanner(p);

  // Book a sentinel appointment for the seeded prospect on today.
  await p.locator(tsel('planner-book')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await pickProspect(p);
  await p.locator('#appt-time').fill(SENTINEL_TIME);
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await p.waitForTimeout(1200);

  // ── Leg 1: add a note → reload → persists ──
  await openSentinelEdit(p);
  await p.locator(tsel('note-add-input')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator(tsel('note-add-input')).fill(NOTE);
  await p.locator(tsel('note-add-btn')).click();
  await p.waitForTimeout(1500);
  const addedNow = await inDom(p.locator(tsel('notes-thread')).getByText(NOTE).first());
  log(addedNow ? 'PASS' : 'FAIL', `note appears in thread immediately (${addedNow})`);
  // close the sheet
  await p.keyboard.press('Escape');
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});

  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await openPlanner(p);
  await openSentinelEdit(p);
  const persisted = await inDom(p.locator(tsel('notes-thread')).getByText(NOTE).first());
  log(persisted ? 'PASS' : 'FAIL', `note persisted in thread after reload (${persisted})`);
  await p.keyboard.press('Escape');
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});

  // ── Leg 2: this-week prospect surfacing on the booking sheet ──
  await p.locator(tsel('planner-book')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await pickProspect(p);
  await p.waitForTimeout(400);
  const historyShown = await inDom(p.locator(tsel('prospect-note-history')));
  const historyHasNote = historyShown && /e4-marsha-note/.test(await p.locator(tsel('prospect-note-history')).innerText());
  log(historyHasNote ? 'PASS' : 'FAIL', `prior note surfaces on booking sheet for the same prospect (shown=${historyShown} hasNote=${historyHasNote})`);
  await p.keyboard.press('Escape');

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ E4 NOTES-THREAD SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

/**
 * smoke-e3-running-late.mjs — Planner v2 E3 acceptance smoke (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-e3-running-late.mjs
 *
 * TABLET viewport (900×800 — single-column planner). Drives the running-late
 * cascade via the deterministic churn "Running late" action, write-read-verify:
 *   1. Book two afternoon appointments today (A 4:35 PM, B 5:05 PM) so B is
 *      unambiguously the NEXT after A (no business-hours fixtures collide).
 *   2. Churn A → "Running late" → the cascade sheet previews B shifting +20
 *      (5:05 → 5:25 PM), next-scope default.
 *   3. Push +20 → bulkUpdate shifts B → RELOAD → B now reads 5:25 PM, A
 *      unchanged.
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 * MUTATES appointments (residue: two afternoon appts in the free 16:15–19:00 band,
 * B pushed; sweep-nonfixture-appointments.mjs --apply clears it).
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
// SLOT BAND: 16:35 / 17:05 — deliberately inside the free 16:15–19:00 window.
// The staging planner-smoke slot map (each booking defaults to 30 min, so each
// entry occupies start→start+30). Pick from a gap, and never leave residue that
// overlaps another smoke's ASSERTED slot:
//   a4 10:40 · a1 11:10 13:40 14:20 · e1 14:25 · e2 15:35 · e4 15:45
//   >>> free: 16:15–19:00 <<<   a5 19:00 19:40 20:20 · a3 21:00 21:10 →23:00
// Previously this smoke used 22:05/22:35 — and 22:35+30 = 23:05 OVERLAPPED the
// 23:00 slot that run9-a3 moves its appointment to and then asserts "conflict
// warning cleared". A3 correctly warned about this smoke's leftover, so A3 failed
// on a real overlap (2026-07-25 rerun). Nothing between A and B keeps B the
// cascade's `following[0]`, which the +20 push assertion depends on.
const A_TIME = '16:35'; const A_12 = '4:35 PM';
const B_TIME = '17:05'; const B_12 = '5:05 PM';
const B_PUSHED_12 = '5:25 PM';

async function openPlanner(p) {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });
}
async function book(p, time) {
  await p.locator(tsel('planner-book')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator('#appt-time').fill(time);
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await p.waitForTimeout(1000);
}
const cardAt = (p, t12) => p.locator('button[data-testid^="appt-card-"]').filter({ hasText: t12 }).first();

const browser = await chromium.launch();
const ctx = await newLegContext(browser, { viewport: TABLET_VIEWPORT });
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  await login(p, 'agent1');
  await openPlanner(p);

  await book(p, A_TIME);
  await book(p, B_TIME);
  const bBefore = await inDom(cardAt(p, B_12));
  log(bBefore ? 'PASS' : 'FAIL', `booked A ${A_12} + B ${B_12} (B present ${bBefore})`);

  // Churn A → Running late → cascade sheet.
  await cardAt(p, A_12).click();
  await p.locator(tsel('churn-dialog')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator(tsel('churn-running-late')).click();
  await p.locator(tsel('running-late-sheet')).waitFor({ state: 'visible', timeout: 8_000 });

  // Default +20 / next: preview should show B shifting to 5:25 PM.
  const sheetTxt = await p.locator(tsel('running-late-sheet')).innerText();
  const previews = sheetTxt.includes(B_12) && sheetTxt.includes(B_PUSHED_12);
  log(previews ? 'PASS' : 'FAIL', `preview shows B ${B_12} → ${B_PUSHED_12} (${previews})`);

  await p.locator(tsel('late-push-apply')).click();
  await p.locator(tsel('running-late-sheet')).waitFor({ state: 'detached', timeout: 12_000 }).catch(() => {});
  await p.waitForTimeout(1200);

  // RELOAD → B persisted at 5:25 PM, A unchanged at 4:35 PM.
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await openPlanner(p);
  const bPushed = await inDom(cardAt(p, B_PUSHED_12));
  const aSame = await inDom(cardAt(p, A_12));
  log(bPushed ? 'PASS' : 'FAIL', `B persisted at ${B_PUSHED_12} after reload (${bPushed})`);
  log(aSame ? 'PASS' : 'FAIL', `A unchanged at ${A_12} (${aSame})`);

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ E3 RUNNING-LATE SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

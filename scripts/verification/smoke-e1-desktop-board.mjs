/**
 * smoke-e1-desktop-board.mjs — Planner v2 E1 acceptance smoke (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-e1-desktop-board.mjs
 *
 * DESKTOP viewport (1280×800 — vh default) so the E1 board renders (lg=1024).
 * Full write-read-verify through the real service path:
 *   1. Board renders at desktop (planner-desktop-board) with the Day/3-day/Week
 *      /Follow-ups toggle.
 *   2. Toggle drives the column count: Day → 1, 3 days → 3, Week → 7.
 *   3. Book a sentinel appointment via a day column's Add button → save through
 *      createAppointment → RELOAD → the board renders it in the matching day
 *      column (the board reads the same appointments the mobile views do).
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 * MUTATES appointments (residue: one 2:25 PM sentinel on today; re-seed resets).
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

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

async function openBoard(p) {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-desktop-board')).waitFor({ state: 'visible', timeout: 15_000 });
}
async function colCount(p) {
  return p.locator('[data-testid^="planner-day-col-"]').count();
}

const browser = await chromium.launch();
const ctx = await newLegContext(browser); // default 1280×800 (desktop)
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  await login(p, 'agent1');
  await openBoard(p);

  // 0. Board is the desktop layer (not the single-column mobile views).
  const board = await inDom(p.locator(tsel('planner-desktop-board')));
  // Negative check → short timeout (an absent element must not cost the full wait).
  const mobilePillsGone = !(await inDom(p.locator(tsel('planner-view-today')), 1_500));
  log(board && mobilePillsGone ? 'PASS' : 'FAIL', `desktop board renders, mobile pills absent (board=${board} pills-absent=${mobilePillsGone})`);
  for (const id of ['planner-span-day', 'planner-span-3day', 'planner-span-week', 'planner-span-followups']) {
    const present = await inDom(p.locator(tsel(id)));
    log(present ? 'PASS' : 'FAIL', `toggle option present: ${id} (${present})`);
  }

  // 1. Toggle drives column count.
  await p.locator(tsel('planner-span-day')).click();
  await p.waitForTimeout(300);
  const nDay = await colCount(p);
  log(nDay === 1 ? 'PASS' : 'FAIL', `Day span → 1 column (${nDay})`);

  await p.locator(tsel('planner-span-3day')).click();
  await p.waitForTimeout(300);
  const n3 = await colCount(p);
  log(n3 === 3 ? 'PASS' : 'FAIL', `3-day span → 3 columns (${n3})`);

  await p.locator(tsel('planner-span-week')).click();
  await p.waitForTimeout(300);
  const nWeek = await colCount(p);
  log(nWeek === 7 ? 'PASS' : 'FAIL', `Week span → 7 columns (${nWeek})`);

  // 2. Follow-ups toggle renders the follow-ups slot, not day columns.
  await p.locator(tsel('planner-span-followups')).click();
  await p.waitForTimeout(300);
  const fuCols = await colCount(p);
  log(fuCols === 0 ? 'PASS' : 'FAIL', `Follow-ups view → 0 day columns (${fuCols})`);

  // 3. Write-read-verify: book a sentinel on today's column via the board.
  await p.locator(tsel('planner-span-day')).click(); // Day span → single today column
  await p.waitForTimeout(300);
  await p.locator('[data-testid^="planner-day-add-"]').first().click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator('#appt-time').fill('14:25');
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await p.waitForTimeout(1200);

  const todayCol = p.locator('[data-testid^="planner-day-col-"]').first();
  const beforeReload = await inDom(todayCol.locator('button[data-testid^="appt-card-"]:has-text("2:25 PM")').first());
  log(beforeReload ? 'PASS' : 'FAIL', `sentinel 2:25 PM card in today column pre-reload (${beforeReload})`);

  // RELOAD → the board must re-render the persisted appointment.
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await openBoard(p);
  await p.locator(tsel('planner-span-day')).click();
  await p.waitForTimeout(400);
  const persisted = await inDom(p.locator('[data-testid^="planner-day-col-"]').first()
    .locator('button[data-testid^="appt-card-"]:has-text("2:25 PM")'));
  log(persisted ? 'PASS' : 'FAIL', `sentinel 2:25 PM card persisted in board after reload (${persisted})`);

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ E1 DESKTOP-BOARD SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

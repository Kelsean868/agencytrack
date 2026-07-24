/**
 * smoke-e2-drag-reschedule.mjs — Planner v2 E2 acceptance smoke (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-e2-drag-reschedule.mjs
 *
 * DESKTOP viewport (1280×800) so the E1 board renders (lg=1024). Board-native
 * drag-drop reschedule, write-read-verify through the REAL service path:
 *   1. Book a sentinel appointment on today's column.
 *   2. Drag it across to the +1-day column (HTML5 DnD dispatched with a real
 *      DataTransfer so React's onDragStart/onDrop fire).
 *   3. On drop the board calls the EXISTING postponeWithRebook → RELOAD → the
 *      +1-day column shows the moved appointment (new doc) AND today's original
 *      is tombstoned as 'postponed'.
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 * MUTATES appointments (residue: one 3:35 PM sentinel moved to tomorrow +
 * a postponed original; re-seed resets).
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

// TT "today" + tomorrow as the board renders them (America/Port_of_Spain, UTC-4).
const todayTT = () => {
  const now = new Date(Date.now() - 4 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
};
const addDays = (d, n) => {
  const dt = new Date(`${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

async function openBoard(p) {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-desktop-board')).waitFor({ state: 'visible', timeout: 15_000 });
}

const browser = await chromium.launch();
const ctx = await newLegContext(browser); // default 1280×800 (desktop)
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  const TODAY = todayTT();
  const NEXT = addDays(TODAY, 1);

  await login(p, 'agent1');
  await openBoard(p);
  await p.locator(tsel('planner-span-3day')).click(); // today + next two columns
  await p.waitForTimeout(300);

  // 1. Book a sentinel (3:35 PM) on today's column.
  await p.locator(tsel(`planner-day-add-${TODAY}`)).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator('#appt-time').fill('15:35');
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await p.waitForTimeout(1200);

  const todayCol = () => p.locator(tsel(`planner-day-col-${TODAY}`));
  const nextCol = () => p.locator(tsel(`planner-day-col-${NEXT}`));
  const sentinelInToday = await todayCol().locator('button[data-testid^="appt-card-"]:has-text("3:35 PM")').first().isVisible().catch(() => false);
  log(sentinelInToday ? 'PASS' : 'FAIL', `sentinel 3:35 PM booked on today column (${sentinelInToday})`);

  // 2. Drag the sentinel card → the +1-day column (HTML5 DnD via real DataTransfer).
  const dragEl = p.locator('[data-testid^="planner-drag-"]').filter({ hasText: '3:35 PM' }).first();
  const dragTestid = await dragEl.getAttribute('data-testid');
  await p.evaluate(({ srcTestid, tgtTestid }) => {
    const s = document.querySelector(`[data-testid="${srcTestid}"]`);
    const t = document.querySelector(`[data-testid="${tgtTestid}"]`);
    const dt = new DataTransfer();
    s.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    t.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    t.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    s.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { srcTestid: dragTestid, tgtTestid: `planner-day-col-${NEXT}` });
  await p.waitForTimeout(1500);

  const movedBanner = /moved/i.test(await p.locator('body').innerText());
  log(movedBanner ? 'PASS' : 'FAIL', `"Appointment moved" toast after drop (${movedBanner})`);

  // 3. RELOAD → the move must have persisted through postponeWithRebook.
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await openBoard(p);
  await p.locator(tsel('planner-span-3day')).click();
  await p.waitForTimeout(500);

  const movedToNext = await nextCol().locator('button[data-testid^="appt-card-"]:has-text("3:35 PM")').first().isVisible().catch(() => false);
  log(movedToNext ? 'PASS' : 'FAIL', `moved appt (3:35 PM) now on the +1-day column after reload (${movedToNext})`);

  // Original tombstone: today still holds a 3:35 PM card, now marked Postponed.
  const todayText = await todayCol().innerText().catch(() => '');
  const originalPostponed = /3:35\s*PM/i.test(todayText) && /postpon/i.test(todayText);
  log(originalPostponed ? 'PASS' : 'FAIL', `original on today tombstoned as Postponed (${originalPostponed})`);

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ E2 DRAG-RESCHEDULE SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

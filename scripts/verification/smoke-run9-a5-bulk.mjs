/**
 * smoke-run9-a5-bulk.mjs — Run 9 A5 live smoke (staging): bulk operations
 * write-read-verify as agent1 through deployed rules, with ADMIN-READ
 * (rules-bypassing, staging-guarded) value-level Firestore assertions.
 *
 *   node --env-file=.env.staging scripts/verification/smoke-run9-a5-bulk.mjs
 *
 * Legs (mirrors the run brief's A5 acceptance):
 *   1. create 3 appts (19:00/19:40/20:20) → Select mode → select all 3 →
 *      Bulk cancel → confirm → toast.
 *   2. ADMIN READ: all 3 docs status='cancelled' in Firestore (R5 soft-delete).
 *   3. Ctrl+Z (A1 bulk undo) → ADMIN READ: all 3 back to 'scheduled'.
 *   4. Select 2 → Bulk move (+1 day shift) → ADMIN READ: dates shifted, ids
 *      unchanged (update-in-place) → Ctrl+Z → dates restored.
 * Hygiene: console-clean + zero prod requests.
 * MUTATES appointments (residue: 3 scheduled appts; sweeper resets).
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene, TABLET_VIEWPORT, assertSingleColumnPlanner } from './vh/vh-helpers.mjs';
import { getAdminDb, ADMIN_TENANT_ID } from './vh/admin-read.mjs';

const tsel = (id) => `[data-testid="${id}"]`;
const TIMES = ['19:00', '19:40', '20:20'];
const LABELS = ['7:00 PM', '7:40 PM', '8:20 PM'];

const browser = await chromium.launch();
const ctx = await newLegContext(browser, { viewport: TABLET_VIEWPORT });
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

async function adminStatuses(ids) {
  const db = getAdminDb();
  const out = {};
  for (const id of ids) {
    const snap = await db.doc(`tenants/${ADMIN_TENANT_ID}/appointments/${id}`).get();
    out[id] = snap.exists ? { status: snap.get('status'), date: snap.get('date') } : null;
  }
  return out;
}

try {
  await login(p, 'agent1');
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });

  // E1 drift guard: assert the preserved single-column layer (not the desktop board)
  const layer = await assertSingleColumnPlanner(p);
  log(layer.ok ? 'PASS' : 'FAIL', `E1 drift guard: single-column layer (pills=${layer.pillsPresent} board-absent=${layer.boardAbsent})`);

  // 1. Create 3 appointments
  const ids = [];
  for (let i = 0; i < TIMES.length; i++) {
    await p.locator(tsel('planner-book')).click();
    await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
    await p.locator('#appt-time').fill(TIMES[i]);
    await p.locator(tsel('appt-save')).click();
    await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
    await p.waitForTimeout(1000);
    const card = p.locator(`button[data-testid^="appt-card-"]:has-text("${LABELS[i]}")`).first();
    await card.waitFor({ state: 'visible', timeout: 8_000 });
    ids.push((await card.getAttribute('data-testid')).replace('appt-card-', ''));
  }
  log(ids.length === 3 ? 'PASS' : 'FAIL', `created 3 appointments (${ids.length})`);

  // Select mode → select all 3 → bulk cancel
  await p.locator(tsel('planner-select-toggle')).click();
  for (const id of ids) await p.locator(tsel(`appt-card-${id}`)).click();
  const barText = await p.locator(tsel('planner-bulk-bar')).innerText();
  log(/3 selected/i.test(barText) ? 'PASS' : 'FAIL', `bulk bar shows 3 selected ("${barText.slice(0, 30)}")`);
  await p.locator(tsel('bulk-cancel')).click();
  await p.locator(tsel('bulk-cancel-confirm')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator(tsel('bulk-cancel-confirm-apply')).click();
  await p.waitForTimeout(2500);

  // 2. Admin read: all cancelled
  let st = await adminStatuses(ids);
  const allCancelled = ids.every((id) => st[id]?.status === 'cancelled');
  log(allCancelled ? 'PASS' : 'FAIL', `Firestore: all 3 status='cancelled' (${ids.map((i) => st[i]?.status).join(',')})`);

  // 3. Bulk undo via A1
  await p.keyboard.press('Control+z');
  await p.waitForTimeout(2500);
  st = await adminStatuses(ids);
  const allRestored = ids.every((id) => st[id]?.status === 'scheduled');
  log(allRestored ? 'PASS' : 'FAIL', `Firestore after Ctrl+Z: all 3 back to 'scheduled' (${ids.map((i) => st[i]?.status).join(',')})`);

  // 4. Bulk move +1 day on first two — select mode persists? re-enter to be safe
  const preDates = ids.map((id) => st[id]?.date);
  const selectOn = await p.locator(tsel('planner-bulk-bar')).isVisible().catch(() => false);
  if (!selectOn) await p.locator(tsel('planner-select-toggle')).click();
  await p.locator(tsel(`appt-card-${ids[0]}`)).click();
  await p.locator(tsel(`appt-card-${ids[1]}`)).click();
  await p.locator(tsel('bulk-move')).click();
  await p.locator(tsel('bulk-move-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator(tsel('bulk-move-mode-shift')).click();
  await p.locator(tsel('bulk-move-shift-plus')).click();
  await p.locator(tsel('bulk-move-apply')).click();
  await p.waitForTimeout(2500);
  st = await adminStatuses(ids);
  const movedOk = st[ids[0]]?.date > preDates[0] && st[ids[1]]?.date > preDates[1] && st[ids[2]]?.date === preDates[2];
  log(movedOk ? 'PASS' : 'FAIL', `Firestore: 2 moved +1d in place (ids preserved), 3rd untouched (${ids.map((i) => st[i]?.date).join(',')})`);

  await p.keyboard.press('Control+z');
  await p.waitForTimeout(2500);
  st = await adminStatuses(ids);
  const movedBack = ids.every((id, i) => st[id]?.date === preDates[i]);
  log(movedBack ? 'PASS' : 'FAIL', `Firestore after Ctrl+Z: dates restored (${ids.map((i) => st[i]?.date).join(',')})`);

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ A5 SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

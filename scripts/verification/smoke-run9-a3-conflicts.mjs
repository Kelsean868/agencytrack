/**
 * smoke-run9-a3-conflicts.mjs — Run 9 A3 live smoke (staging): conflict
 * detection value-level as agent1 — create two overlapping appointments via the
 * UI, assert BOTH THEIR OWN warn-badges render; move one away, assert both
 * clear. Assertions are scoped to the two cards this smoke creates (the loaded
 * week may carry unrelated overlapping residue from other smokes — global
 * zero-badge assertions are NOT valid on staging).
 * R7: also asserts save stayed enabled while the sheet showed the warning.
 *
 *   node --env-file=.env.staging scripts/verification/smoke-run9-a3-conflicts.mjs
 *
 * Uses a 21:00/21:10 slot pair (late evening — clear of vhfix fixtures and
 * common residue; the sheet's DEFAULT durationMin is 30, so :00/:30 pairs only
 * TOUCH under half-open semantics — :10 offset guarantees a real overlap).
 * MUTATES appointments (residue: two non-overlapping appts).
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene, TABLET_VIEWPORT, assertSingleColumnPlanner } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

// ── SLOT MAP for TODAY on the staging test tenant (each entry = start→start+dur).
// The overlapping pair stays 21:00/21:10; FREE_SLOT is where B moves to prove the
// badges clear, so it MUST be free of every fixture AND every other smoke's band.
//
//   FIXTURES (scripts/staging/seed-fixtures.mjs, today):
//     t1 09:00-09:30 · t2 10:30-11:30 · t3 12:00-13:00 · t4 14:00-15:00
//     t5 16:00-16:45 · d2a 22:30-23:30  ← ON TODAY **ONLY ON SATURDAY RUNS**
//   SMOKES (residue if run the same day):
//     a4 10:40-11:10 · a1 11:10-11:40, 13:40-14:10, 14:20-14:50 · e1 14:25-14:55
//     e2 15:35-16:05 · e4 15:45-16:15 · e3 16:35-17:35 · a5 19:00-20:50
//     a3 21:00-21:40 (this file's pair)
//   >>> FREE: 17:35-19:00 · 21:40-22:30 · 23:30+ <<<
//
// WHY 18:00 AND NOT 23:00 (the 2026-07-25 failure, all 3 legs, ONE cause):
// `d2aOff = Math.min(2, 6 - ttNow().getUTCDay())` is 0 on a SATURDAY, which the
// seeder deliberately clamps so vhfix-appt-d2a stays upcoming — landing it on
// TODAY at 22:30 with dur 60 = 22:30-23:30. That CONTAINS the old 23:00 target,
// so on Saturday runs: the sheet warning correctly did NOT clear, and B correctly
// KEPT its badge (A correctly cleared — the reported "A=false" means "no badge",
// i.e. the right answer). The app's conflict logic was correct in all three legs;
// only this slot choice was wrong. 18:00 sits mid-gap in 17:35-19:00, free every
// day of the week with margin on both sides.
const FREE_SLOT = '18:00';

const browser = await chromium.launch();
const ctx = await newLegContext(browser, { viewport: TABLET_VIEWPORT });
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

async function createAt(pg, hhmm) {
  await pg.locator(tsel('planner-book')).click();
  await pg.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await pg.locator('#appt-time').fill(hhmm);
  await pg.waitForTimeout(400);
  // DOM-presence (conditional render): leg 1 asserts this is ABSENT, where an
  // isVisible()-based false would pass spuriously if the node existed off-view.
  const warn = await inDom(pg.locator(tsel('appt-conflict-warning')), 1_500);
  const saveEnabled = await pg.locator(tsel('appt-save')).isEnabled();
  await pg.locator(tsel('appt-save')).click();
  await pg.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await pg.waitForTimeout(1200);
  return { warn, saveEnabled };
}

/** Find the appt-card id of the (single) card whose text contains `timeText`. */
async function cardIdByTime(pg, timeText) {
  const cards = pg.locator(`button[data-testid^="appt-card-"]:has-text("${timeText}")`);
  const n = await cards.count();
  if (n !== 1) throw new Error(`expected exactly 1 card containing "${timeText}", found ${n}`);
  return (await cards.first().getAttribute('data-testid')).replace('appt-card-', '');
}
/**
 * Conflict badge + sheet-warning presence. Both are CONDITIONAL renders
 * (`{conflicted && …}` in AgentPlannerPanel, `{conflict && …}` in
 * AppointmentSheet), so DOM attachment — not isVisible() — is the authoritative
 * signal: absent === unmounted === "no conflict". isVisible() additionally
 * returns false for a card scrolled out of the 900×800 viewport inside the
 * planner's scroll region, which is a latent false-NEGATIVE on a long day list
 * (banked lesson #7). NOTE: this was NOT the cause of the 2026-07-25 failures —
 * leg 2 passed, proving both badges were visible — it is hardening only.
 */
const inDom = async (loc, timeout = 8_000) => {
  try { await loc.first().waitFor({ state: 'attached', timeout }); return true; } catch { return false; }
};
const badgeVisible = (pg, id) => inDom(pg.locator(tsel(`appt-conflict-${id}`)), 2_500);

try {
  await login(p, 'agent1');
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });

  // E1 drift guard: assert the preserved single-column layer (not the desktop board)
  const layer = await assertSingleColumnPlanner(p);
  log(layer.ok ? 'PASS' : 'FAIL', `E1 drift guard: single-column layer (pills=${layer.pillsPresent} board-absent=${layer.boardAbsent})`);

  // 1. Two overlapping creates (21:00 + 21:10, default 30min)
  const first = await createAt(p, '21:00');
  log(!first.warn ? 'PASS' : 'FAIL', 'first booking (21:00) shows no conflict warning');
  const idA = await cardIdByTime(p, '9:00 PM');
  const second = await createAt(p, '21:10');
  log(second.warn ? 'PASS' : 'FAIL', 'sheet warned live while choosing overlapping 21:10');
  log(second.saveEnabled ? 'PASS' : 'FAIL', 'R7: save stayed ENABLED with the warning showing');
  const idB = await cardIdByTime(p, '9:10 PM');

  // 2. Both OUR cards badged
  await p.waitForTimeout(500);
  const aBadged = await badgeVisible(p, idA);
  const bBadged = await badgeVisible(p, idB);
  log(aBadged && bBadged ? 'PASS' : 'FAIL', `both created cards carry the warn badge (A=${aBadged} B=${bBadged})`);

  // 3. Move B to FREE_SLOT via churn→Edit — both OUR badges clear
  await p.locator(tsel(`appt-card-${idB}`)).click();
  await p.locator(tsel('churn-dialog')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.getByRole('button', { name: /edit details/i }).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator('#appt-time').fill(FREE_SLOT);
  await p.waitForTimeout(400);
  const warnGone = !(await inDom(p.locator(tsel('appt-conflict-warning')), 1_500));
  log(warnGone ? 'PASS' : 'FAIL', `sheet warning cleared when time moved to ${FREE_SLOT}`);
  if (!warnGone) {
    // Self-diagnosing: FREE_SLOT is no longer free. Dump today's slots so the
    // collision names itself instead of costing another staging round-trip —
    // this failure class (band collision vs a fixture or another smoke) has now
    // bitten twice. Catches duration overlaps too, not just equal start times.
    // Reads the DOM with the sheet still OPEN — allInnerTexts() has no visibility
    // requirement, and closing the sheet here would break the appt-save click
    // below, turning one honest failure into a cascade.
    const times = await p.locator('button[data-testid^="appt-card-"]').allInnerTexts().catch(() => []);
    const slots = times.map((t) => (t.match(/\d{1,2}:\d{2}\s*[AP]M/) || ['?'])[0]);
    console.log(`     diag: ${FREE_SLOT} is NOT free — today's booked slots: ${slots.join(' · ') || 'none read'}`);
    console.log('     diag: re-pick FREE_SLOT from a gap in the slot map at the top of this file');
    console.log('     diag: remember vhfix-appt-d2a sits on TODAY 22:30-23:30 on SATURDAY runs only');
  }
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await p.waitForTimeout(1200);
  const aAfter = await badgeVisible(p, idA);
  const bAfter = await badgeVisible(p, idB);
  log(!aAfter && !bAfter ? 'PASS' : 'FAIL', `our badges cleared after move (A=${aAfter} B=${bAfter})`);

  // 4. Reload — clean state persists for OUR cards
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.waitForTimeout(1200);
  const aReload = await badgeVisible(p, idA);
  const bReload = await badgeVisible(p, idB);
  log(!aReload && !bReload ? 'PASS' : 'FAIL', `no badges on our cards after reload (A=${aReload} B=${bReload})`);

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ A3 SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

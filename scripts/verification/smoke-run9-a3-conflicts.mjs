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
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

const browser = await chromium.launch();
const ctx = await newLegContext(browser);
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

async function createAt(pg, hhmm) {
  await pg.locator(tsel('planner-book')).click();
  await pg.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await pg.locator('#appt-time').fill(hhmm);
  await pg.waitForTimeout(400);
  const warn = await pg.locator(tsel('appt-conflict-warning')).isVisible().catch(() => false);
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
const badgeVisible = (pg, id) => pg.locator(tsel(`appt-conflict-${id}`)).isVisible().catch(() => false);

try {
  await login(p, 'agent1');
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });

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

  // 3. Move B to 23:00 via churn→Edit — both OUR badges clear
  await p.locator(tsel(`appt-card-${idB}`)).click();
  await p.locator(tsel('churn-dialog')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.getByRole('button', { name: /edit details/i }).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator('#appt-time').fill('23:00');
  await p.waitForTimeout(400);
  const warnGone = !(await p.locator(tsel('appt-conflict-warning')).isVisible().catch(() => false));
  log(warnGone ? 'PASS' : 'FAIL', 'sheet warning cleared when time moved to 23:00');
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

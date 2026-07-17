/**
 * smoke-run9-f3e-series.mjs — Run 9 F3e live smoke (staging): series edit
 * propagation end-to-end through the deployed app + rules + composite index,
 * with admin-read value-level Firestore assertions.
 *
 *   node --env-file=.env.staging scripts/verification/smoke-run9-f3e-series.mjs
 *
 * SEED (admin, staging-guarded): a 5-instance cross-week series 'run9-f3e-*'
 * (2 PAST instances, today, Saturday, next Monday) — the UI cannot create past
 * instances, and R1's past-fence can only be proven against real past docs.
 * (UI series creation + seriesId stamping is separately covered live by VH leg
 * t3-appt-recurrence.) NOTE: assumes today(TT) < Saturday; on a Saturday run
 * instance 4 collapses onto today — run another day.
 *
 * Legs:
 *   0. index poll: (agentId, seriesId, date) query serves (composite Enabled).
 *   1. R2 setup: this-only edit on Sat instance (note→'custom-sat').
 *   2. EDIT ALL from today's instance (note→'series-wide'):
 *      R1: past 2 untouched ('base') · R2: Sat's per-instance edit overwritten ·
 *      today/Sat/next-Mon updated · dates unchanged.
 *   3. THIS-AND-FUTURE from Sat (startTime→09:45): today preserved 09:00,
 *      Sat + next-Mon 09:45 (earlier instances preserved).
 *   4. R4: Reschedule today's instance (time→10:30): SAME doc id mutated,
 *      seriesId intact, series still 5 docs (no new doc, no tombstone).
 *   5. undo (Ctrl+Z) of the reschedule: startTime back to series value.
 * Hygiene: console-clean + zero prod requests.
 * MUTATES appointments (residue: run9-f3e-* docs; sweeper removes).
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';
import { getAdminDb, ADMIN_TENANT_ID } from './vh/admin-read.mjs';

const tsel = (id) => `[data-testid="${id}"]`;
const SERIES_ID = 'run9-f3e-series';
const IDS = ['run9-f3e-1', 'run9-f3e-2', 'run9-f3e-3', 'run9-f3e-4', 'run9-f3e-5'];

// TT (UTC-4, no DST) date helpers
const ttNow = () => new Date(Date.now() - 4 * 3600 * 1000);
const iso = (d) => d.toISOString().slice(0, 10);
const addD = (d, n) => new Date(d.getTime() + n * 86400 * 1000);

const today = ttNow();
const DATES = [iso(addD(today, -4)), iso(addD(today, -2)), iso(today), iso(addD(today, 1)), iso(addD(today, 3))];

const db = getAdminDb();
const T = db.collection(`tenants/${ADMIN_TENANT_ID}/appointments`);

async function seedSeries() {
  const users = db.collection(`tenants/${ADMIN_TENANT_ID}/users`);
  const agents = await users.where('role', '==', 'agent').get();
  const a1 = agents.docs.find((d) => (d.get('email') || '').includes('agent-1')) || agents.docs[0];
  const agentId = a1.id, agentUnitId = a1.get('unitId'), agentBranchId = a1.get('branchId');
  for (let i = 0; i < 5; i++) {
    await T.doc(IDS[i]).set({
      tenantId: ADMIN_TENANT_ID, agentId, agentUnitId, agentBranchId,
      date: DATES[i], startTime: '09:00', durationMin: 30, type: 'PC',
      status: 'scheduled', note: 'base',
      seriesId: SERIES_ID, repeatRule: 'daily', seriesPos: i + 1, seriesTotal: 5,
      createdAt: new Date(), updatedAt: new Date(),
    });
  }
  return agentId;
}
async function readAll() {
  const out = {};
  for (const id of IDS) {
    const s = await T.doc(id).get();
    out[id] = s.exists ? { note: s.get('note'), startTime: s.get('startTime'), date: s.get('date'), seriesId: s.get('seriesId'), status: s.get('status') } : null;
  }
  return out;
}

let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

const agentId = await seedSeries();
console.log(`  seeded 5-instance series (${DATES.join(', ')}) for ${agentId}`);

// Leg 0: composite index serves
let indexOk = false;
for (let i = 0; i < 12; i++) {
  try {
    await T.where('agentId', '==', agentId).where('seriesId', '==', SERIES_ID).orderBy('date', 'asc').get();
    indexOk = true; break;
  } catch { await new Promise((r) => setTimeout(r, 15_000)); }
}
log(indexOk ? 'PASS' : 'FAIL', 'leg0: (agentId, seriesId, date) composite serves the series query');
if (!indexOk) process.exit(1);

const browser = await chromium.launch();
const ctx = await newLegContext(browser);
const p = ctx.page;

async function openWeek() {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-view-week')).waitFor({ state: 'visible', timeout: 15_000 });
  await p.locator(tsel('planner-view-week')).click();
  await p.waitForTimeout(900);
}
async function editVia(cardId, scopeTid, fill) {
  const card = p.locator(tsel(`appt-card-${cardId}`));
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await p.locator(tsel('churn-dialog')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.getByRole('button', { name: /edit details/i }).click();
  await p.locator(tsel('series-edit-choice')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator(tsel(scopeTid)).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await fill();
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 15_000 });
  await p.waitForTimeout(2500);
}

try {
  await login(p, 'agent1');
  await openWeek();

  // Leg 1: this-only edit on Sat instance (R2 setup)
  await editVia(IDS[3], 'series-edit-this-only', async () => {
    await p.locator('#appt-note').fill('custom-sat');
  });
  let st = await readAll();
  log(st[IDS[3]].note === 'custom-sat' && st[IDS[2]].note === 'base' ? 'PASS' : 'FAIL',
    `leg1: this-only edit isolated (sat='${st[IDS[3]].note}', today='${st[IDS[2]].note}')`);

  // Leg 2: EDIT ALL from today — note → 'series-wide'
  await editVia(IDS[2], 'series-edit-all', async () => {
    await p.locator('#appt-note').fill('series-wide');
  });
  st = await readAll();
  const r1 = st[IDS[0]].note === 'base' && st[IDS[1]].note === 'base';
  const r2 = st[IDS[3]].note === 'series-wide';
  const fwd = st[IDS[2]].note === 'series-wide' && st[IDS[4]].note === 'series-wide';
  const datesOk = IDS.every((id, i) => st[id].date === DATES[i]);
  log(r1 ? 'PASS' : 'FAIL', `leg2/R1: PAST instances untouched (${st[IDS[0]].note}, ${st[IDS[1]].note})`);
  log(r2 ? 'PASS' : 'FAIL', `leg2/R2: per-instance edit overwritten by ALL (sat='${st[IDS[3]].note}')`);
  log(fwd ? 'PASS' : 'FAIL', `leg2: current+future updated (today='${st[IDS[2]].note}', nextMon='${st[IDS[4]].note}')`);
  log(datesOk ? 'PASS' : 'FAIL', 'leg2: dates never propagate (all 5 unchanged)');

  // Leg 3: THIS-AND-FUTURE from Sat — startTime → 09:45
  await editVia(IDS[3], 'series-edit-future', async () => {
    await p.locator('#appt-time').fill('09:45');
  });
  st = await readAll();
  const earlierKept = st[IDS[2]].startTime === '09:00';
  const futureMoved = st[IDS[3]].startTime === '09:45' && st[IDS[4]].startTime === '09:45';
  log(earlierKept ? 'PASS' : 'FAIL', `leg3: earlier instance preserved (today=${st[IDS[2]].startTime})`);
  log(futureMoved ? 'PASS' : 'FAIL', `leg3: anchor+future moved (sat=${st[IDS[3]].startTime}, nextMon=${st[IDS[4]].startTime})`);

  // Leg 4: R4 — Reschedule today's instance in place
  const card = p.locator(tsel(`appt-card-${IDS[2]}`));
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await p.locator(tsel('churn-dialog')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.getByRole('button', { name: /^reschedule$/i }).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  const noteRow = await p.locator(tsel('reschedule-series-note')).isVisible().catch(() => false);
  await p.locator('#appt-time').fill('10:30');
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 15_000 });
  await p.waitForTimeout(2500);
  st = await readAll();
  const sameDoc = st[IDS[2]] && st[IDS[2]].startTime === '10:30' && st[IDS[2]].seriesId === SERIES_ID && st[IDS[2]].status === 'scheduled';
  const stillFive = (await T.where('seriesId', '==', SERIES_ID).get()).size === 5;
  log(sameDoc ? 'PASS' : 'FAIL', `leg4/R4: SAME doc id mutated in place (startTime=${st[IDS[2]]?.startTime}, seriesId intact, status=${st[IDS[2]]?.status})`);
  log(stillFive ? 'PASS' : 'FAIL', 'leg4/R4: series still exactly 5 docs (no new doc, no tombstone)');
  log(noteRow ? 'PASS' : 'FAIL', 'leg4: series note row shown in reschedule sheet');

  // Leg 5: undo the reschedule
  await p.keyboard.press('Control+z');
  await p.waitForTimeout(2500);
  st = await readAll();
  log(st[IDS[2]].startTime === '09:00' ? 'PASS' : 'FAIL', `leg5: Ctrl+Z restored startTime (${st[IDS[2]].startTime})`);

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ F3e SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

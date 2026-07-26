/**
 * smoke-r06-scenario-chips.mjs — Tier 3b R-06 acceptance smoke (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-r06-scenario-chips.mjs
 *
 * Full WRITE-READ-VERIFY through the real service path:
 *   1. open Commission Playground → Goal Decomposition, change the income goal
 *      and the cadence so the saved scenario is DISTINGUISHABLE from defaults;
 *   2. save it as a named chip (setCommissionScenarios → users/{uid}/prefs/app);
 *   3. RELOAD, then mutate the inputs again so a restore is observable;
 *   4. apply the chip → the saved income goal AND cadence are restored;
 *   5. delete the chip → it disappears, and stays gone after a second RELOAD
 *      (proves the delete persisted, not just optimistic UI).
 *
 * Agent account (R-06 is an agent-private slice — `users/{uid}/prefs/{prefId}`
 * is own-uid read+write with NO manager arm, so there is no cross-role leg to
 * run: a manager physically cannot read it).
 *
 * MUTATES only the agent's own prefs doc, and SELF-CLEANS (step 5 removes the
 * chip it created). It books NO appointments, so the sweeper HARD RULE does not
 * apply — but running it after a sweep is harmless.
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;
const inDom = async (loc, timeout = 8_000) => {
  try { await loc.first().waitFor({ state: 'attached', timeout }); return true; } catch { return false; }
};

const LABEL = 'r06-smoke-scenario';
const GOAL = '424242';        // distinctive, not a default (default is 300000)
const CADENCE = 'Week';       // saved cadence must survive the round-trip

// Verified, not assumed: AgentDashboard renders CommissionPlayground under
// `activeTab === 'commission'`, and `agent-tab-commission` is the live nav
// testid already exercised by other smokes.
async function openPlayground(p) {
  await p.locator(tsel('agent-tab-commission')).first().click({ timeout: 15_000 });
  await p.locator(tsel('scenario-chips')).waitFor({ state: 'attached', timeout: 15_000 });
}
const goalField = (p) => p.getByLabel(/Income Goal/i).first();

const browser = await chromium.launch();
const ctx = await newLegContext(browser);
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  await login(p, 'agent1');
  await openPlayground(p);
  log('PASS', 'Commission Playground + scenario chip row mounted');

  // 1. Distinguishable state: goal + cadence.
  await goalField(p).fill(GOAL);
  await p.getByRole('button', { name: new RegExp(`^${CADENCE}$`) }).first().click().catch(() => {});
  await p.waitForTimeout(300);

  // 2. Save as a named chip.
  await p.locator(tsel('scenario-save-open')).click();
  await p.locator(tsel('scenario-name-input')).fill(LABEL);
  await p.locator(tsel('scenario-save-confirm')).click();
  await p.waitForTimeout(1500);
  const chip = p.locator('[data-testid^="scenario-apply-"]').filter({ hasText: LABEL });
  log(await inDom(chip) ? 'PASS' : 'FAIL', `chip "${LABEL}" appears after save`);

  // 3. RELOAD → the chip must come back from Firestore, not memory.
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await openPlayground(p);
  const persisted = await inDom(p.locator('[data-testid^="scenario-apply-"]').filter({ hasText: LABEL }));
  log(persisted ? 'PASS' : 'FAIL', `chip persisted after reload — write reached prefs/app (${persisted})`);

  // 4. Mutate away, then APPLY → inputs + cadence restore.
  await goalField(p).fill('111111');
  await p.waitForTimeout(300);
  await p.locator('[data-testid^="scenario-apply-"]').filter({ hasText: LABEL }).first().click();
  await p.waitForTimeout(800);
  const restoredGoal = await goalField(p).inputValue().catch(() => '');
  log(String(restoredGoal).replace(/[^\d]/g, '') === GOAL ? 'PASS' : 'FAIL',
    `apply restored the saved income goal (${restoredGoal} — expected ${GOAL})`);
  const cadenceOn = await p.getByRole('button', { name: new RegExp(`^${CADENCE}$`) }).first()
    .evaluate((el) => el.className.includes('bg-primary') || el.getAttribute('aria-pressed') === 'true')
    .catch(() => false);
  log(cadenceOn ? 'PASS' : 'FAIL', `apply restored the saved cadence "${CADENCE}" (${cadenceOn})`);

  // 5. Delete → gone now AND after a reload (persisted delete, self-clean).
  const chipId = await p.locator('[data-testid^="scenario-apply-"]').filter({ hasText: LABEL })
    .first().getAttribute('data-testid');
  const id = String(chipId).replace('scenario-apply-', '');
  await p.locator(tsel(`scenario-delete-${id}`)).click();
  await p.waitForTimeout(1500);
  const goneNow = !(await inDom(p.locator('[data-testid^="scenario-apply-"]').filter({ hasText: LABEL }), 1_500));
  log(goneNow ? 'PASS' : 'FAIL', `chip removed after delete (${goneNow})`);

  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await openPlayground(p);
  const goneAfterReload = !(await inDom(p.locator('[data-testid^="scenario-apply-"]').filter({ hasText: LABEL }), 2_000));
  log(goneAfterReload ? 'PASS' : 'FAIL', `delete persisted after reload — 0 residue (${goneAfterReload})`);

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  // GUARANTEED CLEANUP — a smoke that fails mid-run must not strand the chip it
  // created. This is the residue lesson banked as a HARD RULE this run (a failed
  // A3 run's leftovers broke the next attempt); the happy path deletes the chip
  // in step 5, this covers every OTHER exit path. Best-effort and silent: it
  // must never mask the real failure above.
  try {
    const leftover = p.locator('[data-testid^="scenario-apply-"]').filter({ hasText: LABEL });
    if (await leftover.count()) {
      const tid = await leftover.first().getAttribute('data-testid');
      await p.locator(tsel(`scenario-delete-${String(tid).replace('scenario-apply-', '')}`)).click();
      await p.waitForTimeout(1200);
      console.log(`     cleanup: removed stranded chip "${LABEL}"`);
    }
  } catch { /* best-effort — never mask the primary failure */ }
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ R-06 SCENARIO-CHIPS SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

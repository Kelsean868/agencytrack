/**
 * smoke-run9-a1-undo.mjs — Run 9 A1 live smoke (staging): undo/redo with REAL
 * persistence inverses, exercised as the owning agent through deployed rules.
 *
 *   node --env-file=.env.staging scripts/verification/smoke-run9-a1-undo.mjs
 *
 * History is client-session state (a reload clears it), so redo legs run
 * in-session; reloads prove PERSISTENCE of each inverse write only.
 *
 * Legs (single browser, fresh context):
 *   1. create → Ctrl+Z (in-session: toast + gone) → Ctrl+Y redo (back) →
 *      RELOAD → redo's re-created doc persisted.
 *   2. edit startTime via churn→Edit → Ctrl+Z → RELOAD → prior value persisted.
 *   3. create #2 → Ctrl+Z → RELOAD → gone (undo-create delete persisted
 *      through the deployed owner-delete arm).
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 * MUTATES appointments (residue: one 11:10 AM sentinel; re-seed resets).
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

async function openPlanner(p) {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });
}
async function bodyText(p) { return p.locator('body').innerText(); }
async function reloadPlanner(p) {
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await openPlanner(p);
  await p.waitForTimeout(1000);
}
async function createAt(p, hhmm) {
  await p.locator(tsel('planner-book')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator('#appt-time').fill(hhmm);
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await p.waitForTimeout(1200);
}

const browser = await chromium.launch();
const ctx = await newLegContext(browser);
const p = ctx.page;
let failed = 0;
const results = [];
const log = (s, d) => { results.push(`${s} ${d}`); console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  await login(p, 'agent1');
  await openPlanner(p);

  // ── Leg 1: create → undo (in-session) → redo → reload → persisted ──
  await createAt(p, '11:10');
  if (!/11:10\s*AM/i.test(await bodyText(p))) {
    log('FAIL', 'leg1: created 11:10 AM appt did not render');
  } else {
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(2000);
    const b1 = await bodyText(p);
    const undone = !/11:10\s*AM/i.test(b1);
    const toastSeen = /undid[:\s]/i.test(b1);
    if (!undone) {
      log('FAIL', 'leg1: undo did not remove the created appt in-session');
    } else {
      await p.keyboard.press('Control+y');
      await p.waitForTimeout(2500);
      const redone = /11:10\s*AM/i.test(await bodyText(p));
      if (!redone) {
        log('FAIL', 'leg1: redo did not restore the appt in-session');
      } else {
        await reloadPlanner(p);
        const persisted = /11:10\s*AM/i.test(await bodyText(p));
        log(persisted ? 'PASS' : 'FAIL',
          persisted
            ? `leg1: create→undo(toast=${toastSeen})→redo cycle; redo's re-created doc persisted after reload`
            : 'leg1: redo appt vanished after reload');
      }
    }
  }

  // ── Leg 2: edit → undo → reload → prior value persisted ──
  const card = p.locator('button:has-text("11:10 AM")').first();
  if (await card.count()) {
    await card.click();
    await p.locator(tsel('churn-dialog')).waitFor({ state: 'visible', timeout: 8_000 });
    await p.getByRole('button', { name: /edit details/i }).click();
    await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
    await p.locator('#appt-time').fill('13:40');
    await p.locator(tsel('appt-save')).click();
    await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
    await p.waitForTimeout(1200);
    if (!/1:40\s*PM/i.test(await bodyText(p))) {
      log('FAIL', 'leg2: edit to 1:40 PM did not render');
    } else {
      await p.keyboard.press('Control+z');
      await p.waitForTimeout(2000);
      await reloadPlanner(p);
      const body = await bodyText(p);
      const restored = /11:10\s*AM/i.test(body) && !/1:40\s*PM/i.test(body);
      log(restored ? 'PASS' : 'FAIL',
        restored ? 'leg2: undo-edit wrote prior startTime back; persisted after reload'
                 : 'leg2: undo-edit did not restore prior startTime');
    }
  } else {
    log('FAIL', 'leg2: no 11:10 AM card to edit (leg1 residue expected)');
  }

  // ── Leg 3: create #2 → undo → reload → gone (delete persisted) ──
  await createAt(p, '14:20');
  if (!/2:20\s*PM/i.test(await bodyText(p))) {
    log('FAIL', 'leg3: created 2:20 PM appt did not render');
  } else {
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(2000);
    await reloadPlanner(p);
    const gone = !/2:20\s*PM/i.test(await bodyText(p));
    log(gone ? 'PASS' : 'FAIL',
      gone ? 'leg3: undo-create hard-deleted through deployed owner-delete arm; gone after reload'
           : 'leg3: appt STILL PRESENT after undo + reload');
  }

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}

console.log(`\n══ A1 SMOKE: ${results.filter(r => r.startsWith('PASS')).length} PASS / ${failed} FAIL ══`);
process.exit(failed ? 1 : 0);

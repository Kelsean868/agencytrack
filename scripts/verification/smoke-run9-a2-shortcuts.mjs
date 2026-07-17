/**
 * smoke-run9-a2-shortcuts.mjs — Run 9 A2 live smoke (staging): planner keyboard
 * shortcuts as agent1 through the deployed app.
 *
 *   node --env-file=.env.staging scripts/verification/smoke-run9-a2-shortcuts.mjs
 *
 * Legs: n opens booking sheet · ? opens reference sheet (+ header button) ·
 * ArrowRight cycles Today→Week · ArrowDown roves card focus · e opens edit
 * (churn-equivalent path) · guard: 'n' typed inside the sheet's form does NOT
 * open a second surface. READ-ONLY (no saves). Hygiene asserted.
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

const browser = await chromium.launch();
const ctx = await newLegContext(browser);
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  await login(p, 'agent1');
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });
  await p.locator('body').click({ position: { x: 5, y: 5 } }); // ensure no form focus

  // n → booking sheet
  await p.keyboard.press('n');
  const sheetOpen = await p.locator(tsel('appointment-sheet')).isVisible({ timeout: 5_000 }).catch(() => false);
  log(sheetOpen ? 'PASS' : 'FAIL', `n opens booking sheet (${sheetOpen})`);

  // guard: typing 'n' inside the open sheet's time field must not stack surfaces
  if (sheetOpen) {
    await p.locator('#appt-time').click();
    await p.keyboard.press('n');
    await p.waitForTimeout(400);
    const stacked = await p.locator(tsel('planner-shortcuts-sheet')).isVisible().catch(() => false);
    log(!stacked ? 'PASS' : 'FAIL', 'guard: n inside form field is inert');
    await p.keyboard.press('Escape');
    await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 8_000 });
  }

  // ? → shortcuts sheet
  await p.keyboard.press('Shift+?');
  const ref = await p.locator(tsel('planner-shortcuts-sheet')).isVisible({ timeout: 5_000 }).catch(() => false);
  log(ref ? 'PASS' : 'FAIL', `? opens shortcuts reference (${ref})`);
  if (ref) {
    const txt = await p.locator(tsel('planner-shortcuts-sheet')).innerText();
    const listsUndo = /ctrl|cmd|⌘/i.test(txt) && /undo/i.test(txt);
    log(listsUndo ? 'PASS' : 'FAIL', 'reference lists A1 undo bindings');
    await p.keyboard.press('Escape');
    await p.locator(tsel('planner-shortcuts-sheet')).waitFor({ state: 'detached', timeout: 8_000 });
  }

  // header button opens it too
  await p.locator(tsel('planner-shortcuts-open')).click();
  const viaBtn = await p.locator(tsel('planner-shortcuts-sheet')).isVisible({ timeout: 5_000 }).catch(() => false);
  log(viaBtn ? 'PASS' : 'FAIL', 'header ? button opens reference');
  if (viaBtn) { await p.keyboard.press('Escape'); await p.locator(tsel('planner-shortcuts-sheet')).waitFor({ state: 'detached', timeout: 8_000 }); }

  // ArrowRight → Week view
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(600);
  const weekActive = await p.locator(tsel('planner-week-counters')).isVisible({ timeout: 5_000 }).catch(() => false);
  log(weekActive ? 'PASS' : 'FAIL', 'ArrowRight switched Today→Week (counters visible)');

  // ArrowDown roves focus to an appt card; e opens edit path
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(300);
  const focusedTid = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') || '');
  const onCard = focusedTid.startsWith('appt-card-');
  log(onCard ? 'PASS' : 'FAIL', `ArrowDown focused an appointment card (${focusedTid || 'none'})`);

  if (onCard) {
    await p.keyboard.press('e');
    await p.waitForTimeout(800);
    const editOpen = await p.locator(tsel('appointment-sheet')).isVisible().catch(() => false);
    const seriesChoice = await p.locator(tsel('series-edit-choice')).isVisible().catch(() => false);
    log(editOpen || seriesChoice ? 'PASS' : 'FAIL', `e opened edit path (sheet=${editOpen} seriesChoice=${seriesChoice})`);
    await p.keyboard.press('Escape');
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
console.log(`\n══ A2 SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

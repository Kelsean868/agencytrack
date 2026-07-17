/**
 * smoke-run9-a4-templates.mjs — Run 9 A4 live smoke (staging): appointment
 * templates write-read-verify as the owning agent through deployed rules.
 *
 *   node --env-file=.env.staging scripts/verification/smoke-run9-a4-templates.mjs
 *
 * Legs:
 *   1. agent1 books 10:40 SC appt → churn → "Save as template" → name sheet →
 *      save → toast. RELOAD → create-mode sheet shows the picker (template
 *      persisted through deployed owner-CRUD rules).
 *   2. apply template into a fresh booking → form fills (time 10:40) → save →
 *      card renders (write-read-verify of the applied shape).
 *   3. agent2 create-mode sheet: picker ABSENT (owner-only list live).
 *   4. cleanup: agent1 deletes the template via the picker → picker gone.
 * Hygiene: console-clean + zero prod requests (both contexts).
 * MUTATES appointments + appointmentTemplates (net: 2 appts residue; template
 * deleted; sweep-nonfixture-appointments.mjs resets appts).
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

const browser = await chromium.launch();
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

// ── agent1 context ──
const ctx1 = await newLegContext(browser);
const p = ctx1.page;
try {
  await login(p, 'agent1');
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });

  // 1. Book a 10:40 appt, save it as a template
  await p.locator(tsel('planner-book')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator('#appt-time').fill('10:40');
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await p.waitForTimeout(1200);
  const card = p.locator('button[data-testid^="appt-card-"]:has-text("10:40 AM")').first();
  await card.click();
  await p.locator(tsel('churn-dialog')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator(tsel('churn-save-template')).click();
  await p.locator(tsel('template-name-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator(tsel('template-name-input')).fill('Run9 smoke template');
  await p.locator(tsel('template-name-save')).click();
  await p.waitForTimeout(1500);
  const toasted = /template/i.test(await p.locator('body').innerText());
  log(toasted ? 'PASS' : 'FAIL', 'save-as-template flow completed with toast');

  // Persistence: reload, open create sheet, picker present
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });
  await p.locator(tsel('planner-book')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  const pickerVisible = await p.locator(tsel('appt-template-picker')).waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
  log(pickerVisible ? 'PASS' : 'FAIL', 'template persisted: picker present after reload');

  // 2. Apply → form fills → save → card renders
  let applied = false;
  if (pickerVisible) {
    await p.locator('[data-testid^="template-apply-"]').first().click();
    await p.waitForTimeout(400);
    const time = await p.locator('#appt-time').inputValue();
    applied = time === '10:40';
    log(applied ? 'PASS' : 'FAIL', `apply filled the form (startTime=${time})`);
    await p.locator(tsel('appt-save')).click();
    await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
    await p.waitForTimeout(1200);
    const n = await p.locator('button[data-testid^="appt-card-"]:has-text("10:40 AM")').count();
    log(n >= 2 ? 'PASS' : 'FAIL', `applied booking saved (10:40 AM cards: ${n})`);
  } else {
    log('FAIL', 'apply skipped — picker absent');
  }

  assertLegHygiene(ctx1);
  log('PASS', 'agent1 hygiene clean');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR (agent1):', e.message);
} finally { await ctx1.context.close(); }

// ── 3. agent2: picker absent (owner-only live) ──
const ctx2 = await newLegContext(browser);
try {
  const p2 = ctx2.page;
  await login(p2, 'agent2');
  await p2.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p2.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });
  await p2.locator(tsel('planner-book')).click();
  await p2.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p2.waitForTimeout(1000);
  const p2Picker = await p2.locator(tsel('appt-template-picker')).isVisible().catch(() => false);
  log(!p2Picker ? 'PASS' : 'FAIL', 'agent2 sees NO template picker (owner-only list through deployed rules)');
  assertLegHygiene(ctx2);
  log('PASS', 'agent2 hygiene clean');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR (agent2):', e.message);
} finally { await ctx2.context.close(); }

// ── 4. cleanup: agent1 deletes the template ──
const ctx3 = await newLegContext(browser);
try {
  const p3 = ctx3.page;
  await login(p3, 'agent1');
  await p3.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p3.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });
  await p3.locator(tsel('planner-book')).click();
  await p3.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  if (await p3.locator(tsel('appt-template-picker')).waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) {
    await p3.locator('[data-testid^="template-delete-"]').first().click();
    await p3.waitForTimeout(1500);
    const gone = !(await p3.locator(tsel('appt-template-picker')).isVisible().catch(() => false));
    log(gone ? 'PASS' : 'FAIL', 'template deleted; picker hidden again (0 templates)');
  } else {
    log('FAIL', 'cleanup: picker not found for delete');
  }
  assertLegHygiene(ctx3);
  log('PASS', 'cleanup hygiene clean');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR (cleanup):', e.message);
} finally { await ctx3.context.close(); await browser.close(); }

console.log(`\n══ A4 SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

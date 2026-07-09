/**
 * C2 live re-verify — weeklyPlans rules key drift (telContacts vs contactsMade).
 *
 * Recon verdict: telContacts is canonical (weeklyPlanService.js writes it,
 * SuggestedWeekCard/planVariance/etc. all read it). firestore.rules
 * validPlanWrite() previously required contactsMade (hasAll/hasOnly), so any
 * real weekly-plan commit was DENIED live. Fixed in firestore.rules (rules-only
 * change, deployed to agencytrack-staging) and red/green-verified against the
 * Firestore emulator (tests/rules/weeklyPlans.rules.test.mjs cases 30/31).
 *
 * This script proves the fix live, on the real staging deploy, as
 * staging-agent-1, through the real "Plan this week" edit/commit UI:
 *   1. Log in, open Game Plan hub — a committed plan already exists (seed A3).
 *   2. Read the current committed telContacts value.
 *   3. Edit -> increment telContacts by 1 -> Commit (UPDATE path through
 *      validPlanWrite(), the exact rule that was denying this write).
 *   4. Reload -> confirm the incremented value persisted and SuggestedWeekCard
 *      renders it (proves both the write AND the read/render path).
 *   5. Edit -> decrement back to the original value -> Commit (restores
 *      staging to its pre-probe state — net-zero, no seed drift).
 *
 * node scripts/verification/c2-weeklyplans-live-reverify.mjs
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

async function gotoGamePlan(page) {
  await page.locator(tsel('agent-tab-game-plan')).first().click();
  await page.locator(tsel('game-plan-hub')).first().waitFor({ state: 'attached', timeout: 15_000 });
  await page.locator(tsel('suggested-week-card')).first().waitFor({ state: 'attached', timeout: 15_000 });
  await page.waitForTimeout(800);
}

async function readCommittedTelContacts(page) {
  await page.locator(tsel('weekly-plan-committed')).first().waitFor({ state: 'attached', timeout: 15_000 });
  const el = page.locator(tsel('plan-committed-telContacts-value')).first();
  const txt = await el.textContent();
  return parseInt((txt ?? '').trim(), 10);
}

async function run() {
  console.log('\nC2 live re-verify — weeklyPlans telContacts rules fix (staging)\n');
  const browser = await chromium.launch({ headless: true });
  const { context, page, capture, prodRequests, pageErrors } = await newLegContext(browser);
  const r = {};

  try {
    await login(page, 'agent1');
    await gotoGamePlan(page);

    const before = await readCommittedTelContacts(page);
    r.before = before;
    console.log(`  committed telContacts BEFORE = ${before}`);

    // ── Edit -> increment -> Commit (real UPDATE write through deployed rules) ──
    await page.locator(tsel('weekly-plan-edit-btn')).first().click();
    await page.locator(tsel('weekly-plan-edit')).first().waitFor({ state: 'attached', timeout: 10_000 });
    await page.locator(tsel('plan-step-telContacts-inc')).first().click();
    const editedValue = parseInt((await page.locator(tsel('plan-step-telContacts-value')).first().textContent()).trim(), 10);
    r.editedValue = editedValue;

    await page.locator(tsel('weekly-plan-commit')).first().click();

    // Previously DENIED writes surface as weekly-plan-error and stay in edit mode.
    const outcome = await Promise.race([
      page.locator(tsel('weekly-plan-committed')).first().waitFor({ state: 'attached', timeout: 15_000 }).then(() => 'committed'),
      page.locator(tsel('weekly-plan-error')).first().waitFor({ state: 'attached', timeout: 15_000 }).then(() => 'denied'),
    ]).catch(() => 'timeout');
    r.commitOutcome = outcome;
    if (outcome !== 'committed') throw new Error(`Commit did not succeed: outcome=${outcome} (expected 'committed')`);

    // ── Reload -> confirm persistence + render through the real rules read path ──
    await page.reload({ waitUntil: 'domcontentloaded' });
    await login(page, 'agent1').catch(() => {});
    await gotoGamePlan(page);
    const afterReload = await readCommittedTelContacts(page);
    r.afterReload = afterReload;
    r.persisted = afterReload === editedValue && afterReload === before + 1;
    console.log(`  committed telContacts AFTER commit + reload = ${afterReload} (expected ${before + 1})`);

    // ── Restore: decrement back to the original value, re-commit (pristine) ──
    await page.locator(tsel('weekly-plan-edit-btn')).first().click();
    await page.locator(tsel('weekly-plan-edit')).first().waitFor({ state: 'attached', timeout: 10_000 });
    await page.locator(tsel('plan-step-telContacts-dec')).first().click();
    await page.locator(tsel('weekly-plan-commit')).first().click();
    await page.locator(tsel('weekly-plan-committed')).first().waitFor({ state: 'attached', timeout: 15_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await login(page, 'agent1').catch(() => {});
    await gotoGamePlan(page);
    const restored = await readCommittedTelContacts(page);
    r.restored = restored;
    r.restoredClean = restored === before;
    console.log(`  committed telContacts RESTORED = ${restored} (expected ${before})`);

    assertLegHygiene({ capture, prodRequests, pageErrors });
    r.hygieneClean = true;
  } catch (e) {
    r.fatal = String(e).slice(0, 400);
  } finally {
    await context.close();
    await browser.close();
  }

  const pass = r.commitOutcome === 'committed' && r.persisted && r.restoredClean && r.hygieneClean && !r.fatal;
  console.log(`\n  before=${r.before} edited=${r.editedValue} commitOutcome=${r.commitOutcome} afterReload=${r.afterReload} persisted=${r.persisted} restored=${r.restored} restoredClean=${r.restoredClean} hygieneClean=${r.hygieneClean}`);
  if (r.fatal) console.log(`  FATAL: ${r.fatal}`);
  console.log(`\nC2 live re-verify: ${pass ? '✓ PASS' : '✗ FAIL'}`);
  process.exit(pass ? 0 : 1);
}

run();

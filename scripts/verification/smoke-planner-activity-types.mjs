/**
 * smoke-planner-activity-types.mjs — the nine added activity types (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-planner-activity-types.mjs
 *
 * VIEWPORT 900×800 (single-column planner), NOT 1280 desktop. Two reasons, both
 * learned from the first real run:
 *   1. `planner-week-counters` renders ONLY when `!isDesktop && view === 'week'`
 *      — the counters live in the single-column branch of AgentPlannerPanel's
 *      `isDesktop ? board : column` switch. At 1280 the desktop board renders
 *      instead and the counter leg cannot find its target at all. There is no
 *      desktop equivalent to assert, so the leg is driven below the lg (1024)
 *      breakpoint rather than adding a testid to production code to suit a smoke.
 *   2. 900 is the established planner-smoke viewport (SMOKES.md run-mode note):
 *      sidebar rail at ≥768 so `agent-tab-planner` works, below 1024 so the
 *      preserved single-column views render. `assertSingleColumnPlanner()` fails
 *      loudly if either breakpoint ever moves across 900.
 *
 * LEG ORDER IS LOAD-BEARING. The write-read-verify leg runs FIRST, and every leg
 * is independently try/caught. On the first real run the suite aborted at a
 * rendering check BEFORE the write leg — so the run "completed" while leaving
 * the rules deploy unverified end-to-end. The write is the only assertion that
 * proves a new type can reach Firestore through the client; it must never sit
 * behind a cosmetic check.
 *
 * ⚠ DEPLOY-GATED. `firestore.rules` gates the appointment `type` VALUE via two
 * literal allowlists. Until `firebase deploy --only firestore:rules` has run
 * against the target project, Leg 1's write is rejected server-side. The smoke
 * detects that explicitly and names it. Do NOT relax the assertion to make it
 * pass — the FAIL is the point.
 *
 * Legs (each independent; a throw fails only its own leg):
 *   1. WRITE-READ-VERIFY (load-bearing, runs first): counters baseline → book an
 *      ADMIN block at a 06:15 sentinel through the real service path → renders →
 *      RELOAD → still there → counters UNCHANGED (a non-selling booking must not
 *      move booked-vs-floor). Persistence + counter assertions are gated on the
 *      write having landed and report FAIL — never a silent pass — when it did not.
 *   2. Grouped picker: Prospect / Support / Block, each showing only its own
 *      types; `A.I` never rendered beside `Admin`.
 *   3. Chip tone: SEM/TRADE solid (they count), support + blocks dashed.
 *   4. MANAGER: headline labelled selling-only; drill still shows BOTH excluded
 *      non-selling types.
 *   Legs 2 + 3 run in BOTH themes; leg 1 runs once (light).
 *
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 * MUTATES appointments (residue: one 6:15 AM ADMIN sentinel — an early band no
 * other smoke or fixture uses; `sweep-nonfixture-appointments.mjs --apply`
 * clears it).
 *
 * SWEEPER IS AN UNCONDITIONAL PREREQUISITE (SMOKES.md hard rule):
 *   node --env-file=.env.staging scripts/staging/sweep-nonfixture-appointments.mjs --apply
 *   node --env-file=.env.staging scripts/staging/seed-fixtures.mjs --apply
 */
import { chromium } from 'playwright';
import {
  newLegContext, login, gotoTab, assertLegHygiene, assertSingleColumnPlanner,
} from './vh/vh-helpers.mjs';
// NOTE: formatCaptureReport lives in lib/walk-helpers, NOT vh/vh-helpers, and it
// PRINTS (returns void) — do not wrap it in console.log.
import { formatCaptureReport } from './lib/walk-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;
const SENTINEL_TIME_24 = '06:15';
const SENTINEL_TIME_12 = '6:15 AM';

// Tone expectations by MEANING rather than hue: everything that counts as
// selling activity renders SOLID, everything that does not renders DASHED.
// (AI/FFI/CI/SALE are teal/gold — still solid-bordered, so they belong here.)
const SOLID_EXPECTED  = ['PC', 'SC', 'AI', 'FFI', 'CI', 'SALE', 'SEM', 'TRADE'];
const DASHED_EXPECTED = ['PROP', 'PAPER', 'COLL', 'DEL', 'MTG', 'TRAIN', 'ADMIN', 'FREE'];
// Non-vacuity floor. TODAY's fixtures alone guarantee 6 solid (PC t1 · FFI t2 ·
// CI t4 · SALE t5 · SEM t8 · TRADE t9) and 3 dashed (FREE t3 · DEL t6 · ADMIN
// t7), so 3 holds whichever weekday the run lands on. WITHOUT this floor an
// EMPTY tone map satisfies `.every()` vacuously — the exact trap the previous
// version of this leg fell into in the other direction.
const MIN_TONE_SAMPLES = 3;

// Banked lesson #7: a DATA-PRESENCE check must not use isVisible() — a card
// scrolled below the fold reads as not-visible. Assert attachment.
const inDom = async (loc, timeout = 8_000) => {
  try { await loc.first().waitFor({ state: 'attached', timeout }); return true; } catch { return false; }
};

async function openPlanner(p) {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-book')).waitFor({ state: 'visible', timeout: 15_000 });
  // Positive: a view pill exists. Negative: the desktop board root does NOT.
  // If the 768 or 1024 breakpoint ever crosses 900 this must fail loudly rather
  // than silently verifying the wrong layer — and `assertSingleColumnPlanner`
  // RETURNS `{pillsPresent, boardAbsent, ok}`, it does NOT throw. Awaiting it
  // without reading `ok` would assert precisely nothing, so throw here.
  const layer = await assertSingleColumnPlanner(p);
  if (!layer.ok) {
    throw new Error(
      `wrong planner layer at 900×800 — expected single-column (pillsPresent=${layer.pillsPresent}, `
      + `boardAbsent=${layer.boardAbsent}). The counters this smoke reads exist ONLY below lg (1024).`,
    );
  }
}
/** The booked-vs-floor counters — single-column Week view only. */
async function weekCounterText(p) {
  await p.locator(tsel('planner-view-week')).click();
  await p.waitForTimeout(500);
  return p.locator(tsel('planner-week-counters')).innerText();
}
async function setTheme(p, dark) {
  await p.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('agencytrack-dark', d ? 'true' : 'false'); } catch { /* ignore */ }
  }, dark);
  await p.waitForTimeout(250);
}
/** Every rendered activity chip's border style, keyed by type. */
const readTone = (p) => p.evaluate(() => {
  const out = {};
  document.querySelectorAll('[data-type]').forEach((el) => {
    const t = el.getAttribute('data-type');
    if (!out[t]) out[t] = getComputedStyle(el).borderStyle;
  });
  return out;
});

let browser;
let ctx;
let mgrCtx;   // second context for the manager role switch (Leg 4)
try {
  browser = await chromium.launch();
  ctx = await newLegContext(browser, { viewport: { width: 900, height: 800 } });
} catch (e) {
  console.error('SMOKE SETUP ERROR:', e.message);
  if (browser) await browser.close();
  process.exit(1);
}
const p = ctx.page;

// Firebase project ids observed on the wire (URL-ENCODED on Firestore channels —
// decode before matching, and watch real requests not performance entries).
const seenProjects = new Set();
p.on('request', (req) => {
  let u = req.url();
  try { u = decodeURIComponent(u); } catch { /* keep raw */ }
  const m = /projects\/([a-z0-9-]+)/.exec(u);
  if (m) seenProjects.add(m[1]);
});

// A rules rejection surfaces as a console/page error rather than a thrown
// exception, so watch for it explicitly — it is the signal that the deploy gate
// has not been crossed, and must be reported as such rather than as a defect.
let sawPermissionDenied = false;
p.on('console', (m) => {
  if (/permission[- ]denied|Missing or insufficient permissions/i.test(m.text())) {
    sawPermissionDenied = true;
  }
});

let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

/**
 * Run one leg in isolation. A throw fails ONLY that leg — the remaining legs
 * still run. This exists because the first real run aborted at a rendering
 * check before the load-bearing write leg ever executed.
 */
async function runLeg(name, fn) {
  console.log(`\n── leg: ${name} ──`);
  try {
    await fn();
  } catch (e) {
    failed++;
    console.error(`  FAIL [${name}] threw: ${e.message}`);
  }
}

try {
  await login(p, 'agent1');
  await openPlanner(p);

  // ── LEG 1 — WRITE-READ-VERIFY (+ counter inflation). RUNS FIRST. ──────────
  // The only assertion that proves a new type can reach Firestore through the
  // client, i.e. that the rules deploy actually worked.
  await runLeg('1 write-read-verify + counters', async () => {
    const before = await weekCounterText(p);
    const counterShapeOk = /\d+\s*\/\s*(\d+|–)/.test(before);
    log(counterShapeOk ? 'PASS' : 'FAIL',
      `booked-vs-floor counters render as <booked>/<target> (${JSON.stringify(before)})`);

    await p.locator(tsel('planner-book')).click({ timeout: 15_000 });
    await p.locator(tsel('appt-type-group-block')).waitFor({ state: 'visible', timeout: 10_000 });
    await p.locator(tsel('appt-type-group-block')).click();
    await p.waitForTimeout(200);
    await p.locator(tsel('appt-type-ADMIN')).click();
    await p.getByLabel('Start time').fill(SENTINEL_TIME_24);
    await p.getByRole('button', { name: /^Save$/ }).click();
    await p.waitForTimeout(2_500);

    const sentinel = () => p.locator(`:text("${SENTINEL_TIME_12}")`);
    const wrote = await inDom(sentinel(), 10_000);
    const deployGated = !wrote && sawPermissionDenied;

    if (deployGated) {
      log('FAIL', 'DEPLOY-GATED: the write was rejected by firestore.rules. '
        + 'EXPECTED until `firebase deploy --only firestore:rules` has run against this project. '
        + 'Re-run after the deploy; no code change is required.');
    } else {
      log(wrote ? 'PASS' : 'FAIL', `ADMIN block written through the real service path and rendered (${wrote})`);
    }

    await p.reload({ waitUntil: 'domcontentloaded' });
    await openPlanner(p);
    await p.waitForTimeout(1_200);

    // ⚠ BOTH assertions below are GATED ON `wrote` and report FAIL — never a
    // silent pass — when the write never landed. An earlier version compared
    // `persisted === wrote` and `before === after`, which are BOTH trivially
    // true when nothing was written: a deploy-gated run reported them green
    // having proved nothing. Do not "simplify" these back.
    if (!wrote) {
      log('FAIL', `persistence NOT VERIFIED — the write never landed (deployGated=${deployGated}). `
        + 'Reported as FAIL rather than skipped: this leg cannot be green without a real write.');
      log('FAIL', 'counter-inflation NOT VERIFIED — needs a real non-selling booking to be meaningful.');
      return;
    }
    const persisted = await inDom(sentinel(), 10_000);
    log(persisted ? 'PASS' : 'FAIL',
      `sentinel survives a reload — written, then re-read from Firestore (persisted=${persisted})`);

    const after = await weekCounterText(p);
    log(before === after ? 'PASS' : 'FAIL',
      `booked-vs-floor counters UNCHANGED by a real non-selling booking (${JSON.stringify(before)} → ${JSON.stringify(after)})`);
  });

  // ── LEGS 2 + 3 — grouped picker + chip tone, both themes ─────────────────
  for (const dark of [false, true]) {
    const theme = dark ? 'dark' : 'light';

    await runLeg(`2 grouped picker [${theme}]`, async () => {
      await setTheme(p, dark);
      await p.locator(tsel('planner-book')).click({ timeout: 15_000 });
      await p.locator(tsel('appt-type-group-prospect')).waitFor({ state: 'visible', timeout: 10_000 });

      const groupsUp = await inDom(p.locator(tsel('appt-type-group-support')))
        && await inDom(p.locator(tsel('appt-type-group-block')));
      log(groupsUp ? 'PASS' : 'FAIL', `[${theme}] picker offers all three groups (${groupsUp})`);

      const aiUp = await inDom(p.locator(tsel('appt-type-AI')), 2_000);
      const adminHidden = !(await inDom(p.locator(tsel('appt-type-ADMIN')), 1_200));
      log(aiUp && adminHidden ? 'PASS' : 'FAIL',
        `[${theme}] Prospect group shows A.I and NOT Admin — mis-click hazard closed (AI=${aiUp}, adminHidden=${adminHidden})`);

      await p.locator(tsel('appt-type-group-support')).click();
      await p.waitForTimeout(200);
      const supportUp = await inDom(p.locator(tsel('appt-type-PAPER')), 3_000);
      const pcHidden = !(await inDom(p.locator(tsel('appt-type-PC')), 1_200));
      log(supportUp && pcHidden ? 'PASS' : 'FAIL',
        `[${theme}] Support group swaps the visible types (PAPER=${supportUp}, pcHidden=${pcHidden})`);

      await p.locator(tsel('appt-type-group-block')).click();
      await p.waitForTimeout(200);
      const blockUp = await inDom(p.locator(tsel('appt-type-SEM')), 3_000)
        && await inDom(p.locator(tsel('appt-type-FREE')), 3_000);
      log(blockUp ? 'PASS' : 'FAIL', `[${theme}] Block group carries SEM + legacy FREE (${blockUp})`);

      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);
    });

    await runLeg(`3 chip tone [${theme}]`, async () => {
      await setTheme(p, dark);
      const tone = await readTone(p);

      // SYMMETRIC + INTERSECTION-BASED. Assert over the types actually RENDERED,
      // not the full expected set: which chips are on screen depends on the
      // view's date window, and a fixture outside it (the only SC fixture sits on
      // +3d) is not a tone defect — that asymmetry is what failed the first real
      // run, since the DASHED side happened to have all its fixtures on TODAY.
      // MIN_TONE_SAMPLES is what stops the leniency becoming vacuity: an empty
      // map now FAILS instead of satisfying `.every()` trivially. Same shape
      // both directions.
      const solidSeen  = SOLID_EXPECTED.filter((t) => tone[t] !== undefined);
      const dashedSeen = DASHED_EXPECTED.filter((t) => tone[t] !== undefined);

      // Both sides assert an EXACT value. `tone[t] !== 'dashed'` would have been
      // the asymmetry the comment above denies: it passes for 'none', 'hidden',
      // 'dotted', 'double', 'groove', 'ridge', 'inset' and 'outset' — so a
      // selling chip losing its border entirely (computed 'none') would have
      // silently PASSED. The first real run confirms 'solid' is the literal
      // computed value for all seven selling chips in both themes.
      const solidOk = solidSeen.length >= MIN_TONE_SAMPLES
        && solidSeen.every((t) => tone[t] === 'solid');
      const dashedOk = dashedSeen.length >= MIN_TONE_SAMPLES
        && dashedSeen.every((t) => tone[t] === 'dashed');

      log(solidOk ? 'PASS' : 'FAIL',
        `[${theme}] selling-activity chips render SOLID — ${solidSeen.length}/${SOLID_EXPECTED.length} rendered, `
        + `min ${MIN_TONE_SAMPLES} (seen: ${solidSeen.join(',') || 'NONE'}) ${JSON.stringify(tone)}`);
      log(dashedOk ? 'PASS' : 'FAIL',
        `[${theme}] non-counting chips render DASHED — ${dashedSeen.length}/${DASHED_EXPECTED.length} rendered, `
        + `min ${MIN_TONE_SAMPLES} (seen: ${dashedSeen.join(',') || 'NONE'})`);
    });
  }

  // ── LEG 4 — manager headline + drill ─────────────────────────────────────
  await runLeg('4 manager headline + drill', async () => {
    // A role switch gets its OWN context — clearing cookies mid-context leaves
    // the Firebase SDK's in-memory auth behind and the next login races it.
    // UM/BM reach TeamPlannerPanel via PRODUCING_MANAGER_NAV, where the item is
    // labelled "Planner" (only the sales_manager entry is "Team Planner").
    mgrCtx = await newLegContext(browser, { viewport: { width: 900, height: 800 } });
    const mp = mgrCtx.page;
    await login(mp, 'unit_manager');
    await gotoTab(mp, 'Planner');
    await mp.locator(tsel('team-planner-rows')).waitFor({ state: 'visible', timeout: 15_000 });

    // SCOPE — read before trusting this. It verifies the headline is LABELLED
    // selling-only and renders a real integer. It does NOT verify the exclusion
    // ARITHMETIC: there is no independent expected value here, and deriving one
    // from the fixtures would just restate the implementation. The arithmetic is
    // covered by a value-level unit test with a negative control
    // (TeamPlannerPanel.test.jsx). SMOKES.md is worded to match; keep in step.
    const headline = await mp.locator(tsel('team-planner-rows')).innerText();
    const headlineMatch = /(\d+) selling booked this week/.exec(headline);
    log(headlineMatch ? 'PASS' : 'FAIL',
      `manager headline is labelled selling-only and renders an integer count (${headlineMatch ? headlineMatch[0] : headline.slice(0, 80)})`);

    await mp.locator('[data-testid^="team-row-"]').first().click();
    await mp.locator(tsel('coaching-drill')).waitFor({ state: 'visible', timeout: 10_000 });
    // Read the drill's chips by `data-type`, not by regex over innerText: the old
    // check was `/Admin|Del/`, an OR (so one type satisfied a claim about two)
    // and substring-prone (a prospect named "Delroy" would have matched).
    const drillTypes = await mp.locator(tsel('coaching-drill')).evaluate(
      (el) => [...el.querySelectorAll('[data-type]')].map((c) => c.getAttribute('data-type')),
    );
    const drillShowsExcluded = drillTypes.includes('ADMIN') && drillTypes.includes('DEL');
    log(drillShowsExcluded ? 'PASS' : 'FAIL',
      `coaching drill still shows BOTH excluded non-selling types — nothing is hidden (${JSON.stringify(drillTypes)})`);
  });

  console.log('');
  formatCaptureReport(ctx.capture);
  assertLegHygiene(ctx);
  if (mgrCtx) {
    formatCaptureReport(mgrCtx.capture);
    assertLegHygiene(mgrCtx);
  }
  log('PASS', `hygiene: console-clean + zero prod requests (projects seen: ${[...seenProjects].join(',') || 'none'})`);
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
  if (sawPermissionDenied) {
    console.error('       ↑ a permission-denied was observed on the wire. If this run predates '
      + '`firebase deploy --only firestore:rules`, that is the DEPLOY GATE, not a defect.');
  }
  if (ctx?.capture) formatCaptureReport(ctx.capture);
  if (mgrCtx?.capture) formatCaptureReport(mgrCtx.capture);
} finally {
  if (mgrCtx) await mgrCtx.context.close();
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ PLANNER ACTIVITY-TYPES SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
if (failed && sawPermissionDenied) {
  console.log('   NOTE: deploy-gated. Run `firebase deploy --only firestore:rules`, then re-run.');
}
process.exit(failed ? 1 : 0);

/**
 * smoke-planner-activity-types.mjs — the nine added activity types (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-planner-activity-types.mjs
 *
 * ⚠ DEPLOY-GATED — THIS SMOKE FAILS BY DESIGN UNTIL THE RULES ARE DEPLOYED.
 * `firestore.rules` validates the appointment `type` VALUE against two literal
 * allowlists (validApptWrite + validTemplateWrite). Merging the PR ships the
 * client code but NOT the rules: until a human runs
 *
 *   firebase deploy --only firestore:rules
 *
 * against the target project, every write of a new type is rejected server-side
 * and Leg 2 below fails with a permission error. That is the EXPECTED pre-deploy
 * state, not a defect — the smoke detects it explicitly and says so rather than
 * reporting a generic failure. Do not "fix" it by relaxing the assertion.
 *
 * DESKTOP viewport (1280×800) so the E1 board renders (lg=1024).
 *
 * Legs:
 *   1. The grouped picker exists: Prospect / Support / Block tabs, each showing
 *      only its own types, and `A.I` is never rendered beside `Admin`.
 *   2. WRITE-READ-VERIFY through the REAL service path: book an ADMIN block at a
 *      sentinel time via the sheet → it renders → RELOAD → it is still there.
 *      (The Admin-SDK seeder bypasses rules; only this leg proves the app can
 *      actually write a new type through the rule layer.)
 *   3. The new type does NOT inflate the agent's booked-vs-floor counters —
 *      C.I / F.F.I / P.C read the same before and after the write.
 *   4. Chip tone contract: SEM/TRADE render SOLID (they count as selling), the
 *      support + non-production types render DASHED (they do not).
 *   5. MANAGER: the Team Planner headline counts selling types only, while the
 *      coaching drill still shows the excluded appointment (nothing is hidden).
 *   Legs 1 + 4 run in BOTH themes; the write leg runs once (light).
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
import { newLegContext, login, gotoTab, assertLegHygiene } from './vh/vh-helpers.mjs';
// NOTE: formatCaptureReport lives in lib/walk-helpers, NOT vh/vh-helpers, and it
// PRINTS (returns void) — do not wrap it in console.log.
import { formatCaptureReport } from './lib/walk-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;
const SENTINEL_TIME_24 = '06:15';
const SENTINEL_TIME_12 = '6:15 AM';

// Banked lesson #7: a DATA-PRESENCE check must not use isVisible() — a card
// scrolled below a day column's fold reads as not-visible. Assert attachment.
const inDom = async (loc, timeout = 8_000) => {
  try { await loc.first().waitFor({ state: 'attached', timeout }); return true; } catch { return false; }
};

async function openBoard(p) {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-desktop-board')).waitFor({ state: 'visible', timeout: 15_000 });
}
async function setTheme(p, dark) {
  await p.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('agencytrack-dark', d ? 'true' : 'false'); } catch { /* ignore */ }
  }, dark);
  await p.waitForTimeout(250);
}
// The booked-vs-floor counters render as ONE container (`planner-week-counters`,
// AgentPlannerPanel.jsx) holding the three C.I / F.F.I / P.C readings — there is
// no per-counter testid, so compare the container's text as a whole.
const counterText = (p) => p.locator(tsel('planner-week-counters')).innerText();
// The Book CTA is a plain labelled button, not a testid'd node.
const bookCta = (p) => p.getByRole('button', { name: /^Book$/ }).first();

let browser;
let ctx;
let mgrCtx;   // second context for the manager role switch (Leg 5)
try {
  browser = await chromium.launch();
  ctx = await newLegContext(browser); // default 1280×800 (desktop)
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
// exception in the app, so watch for it explicitly — it is the signal that the
// deploy gate has not been crossed, and it must be reported as such.
let sawPermissionDenied = false;
p.on('console', (m) => {
  if (/permission[- ]denied|Missing or insufficient permissions/i.test(m.text())) {
    sawPermissionDenied = true;
  }
});

let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  await login(p, 'agent1');
  await openBoard(p);

  // ── Legs 1 + 4: grouped picker + chip tone, both themes ──────────────────
  for (const dark of [false, true]) {
    const theme = dark ? 'dark' : 'light';
    await setTheme(p, dark);

    await bookCta(p).click({ timeout: 15_000 });
    await p.locator(tsel('appt-type-group-prospect')).waitFor({ state: 'visible', timeout: 10_000 });

    const groupsUp = await inDom(p.locator(tsel('appt-type-group-support')))
      && await inDom(p.locator(tsel('appt-type-group-block')));
    log(groupsUp ? 'PASS' : 'FAIL', `[${theme}] picker offers all three groups (${groupsUp})`);

    // Prospect group shows selling types only.
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

    // Leg 4 — tone contract read off the rendered chips. SOLID vs DASHED is the
    // semantic carrier (solid = counts as selling), so a regression that made
    // SEM dashed would silently mis-state the activity model.
    const tone = await p.evaluate(() => {
      const out = {};
      document.querySelectorAll('[data-type]').forEach((el) => {
        const t = el.getAttribute('data-type');
        if (!out[t]) out[t] = getComputedStyle(el).borderStyle;
      });
      return out;
    });
    // STRICT — a missing key FAILS rather than being filtered out. Filtering
    // absent types made this vacuously true whenever the board happened not to
    // render one, which is precisely the case the assertion exists to catch.
    // Every type named here is seeded on TODAY by seed-fixtures.mjs
    // (PC t1 · SC d3b · SEM t8 · TRADE t9 · DEL t6 · ADMIN t7 · FREE t3), so
    // "not rendered" means a real regression or a missing prereq sweep+seed.
    const solidOk = ['SEM', 'TRADE', 'PC', 'SC']
      .every((t) => tone[t] !== undefined && tone[t] !== 'dashed');
    const dashedOk = ['ADMIN', 'DEL', 'FREE']
      .every((t) => tone[t] !== undefined && tone[t] === 'dashed');
    log(solidOk ? 'PASS' : 'FAIL', `[${theme}] selling-activity chips render SOLID (${JSON.stringify(tone)})`);
    log(dashedOk ? 'PASS' : 'FAIL', `[${theme}] non-counting chips render DASHED (${JSON.stringify(tone)})`);
  }

  await setTheme(p, false);

  // ── Legs 2 + 3: write-read-verify + counters do not inflate ──────────────
  const before = await counterText(p);
  // Assert the SHAPE, not merely non-emptiness — `before.length > 0` passed on
  // any content at all, including an error string, while claiming the counters
  // render. Each counter reads "<booked>/<target>" with an en-dash when no floor
  // is configured, so require at least one such pair.
  const counterShapeOk = /\d+\s*\/\s*(\d+|–)/.test(before);
  log(counterShapeOk ? 'PASS' : 'FAIL',
    `booked-vs-floor counters render as <booked>/<target> (${JSON.stringify(before)})`);

  await bookCta(p).click({ timeout: 15_000 });
  await p.locator(tsel('appt-type-group-block')).waitFor({ state: 'visible', timeout: 10_000 });
  await p.locator(tsel('appt-type-group-block')).click();
  await p.waitForTimeout(200);
  await p.locator(tsel('appt-type-ADMIN')).click();
  await p.getByLabel('Start time').fill(SENTINEL_TIME_24);
  await p.getByRole('button', { name: /^Save$/ }).click();
  await p.waitForTimeout(2_500);

  const sentinel = () => p.locator(`${tsel('planner-desktop-board')} :text("${SENTINEL_TIME_12}")`);
  const wrote = await inDom(sentinel(), 10_000);
  const deployGated = !wrote && sawPermissionDenied;

  if (deployGated) {
    // THE DEPLOY GATE. Name it precisely so nobody spends a debugging cycle on it.
    log('FAIL', 'DEPLOY-GATED: the write was rejected by firestore.rules. '
      + 'This is EXPECTED until `firebase deploy --only firestore:rules` has run against this project. '
      + 'Re-run this smoke after the deploy; no code change is required.');
  } else {
    log(wrote ? 'PASS' : 'FAIL', `ADMIN block written through the real service path and rendered (${wrote})`);
  }

  await p.reload({ waitUntil: 'domcontentloaded' });
  await openBoard(p);
  await p.waitForTimeout(1_200);

  // ⚠ BOTH assertions below are GATED ON `wrote`, and report FAIL — never a
  // silent pass — when the write never landed. Previously they compared
  // `persisted === wrote` and `before === after`, which are BOTH trivially
  // satisfied when nothing was written: a deploy-gated run reported them green
  // having proved nothing. Since this smoke is the evidence that the rules
  // deploy worked, an assertion that can pass without a successful write is
  // worse than no assertion. Do not "simplify" these back.
  if (!wrote) {
    log('FAIL', `persistence NOT VERIFIED — the write never landed (deployGated=${deployGated}). `
      + 'Reported as FAIL rather than skipped: this leg cannot be green without a real write.');
    log('FAIL', 'counter-inflation NOT VERIFIED — needs a real non-selling booking to be meaningful. '
      + 'Reported as FAIL rather than skipped, for the same reason.');
  } else {
    const persisted = await inDom(sentinel(), 10_000);
    log(persisted ? 'PASS' : 'FAIL',
      `sentinel survives a reload — written, then re-read from Firestore (persisted=${persisted})`);

    const after = await counterText(p);
    const countersUnchanged = before === after;
    log(countersUnchanged ? 'PASS' : 'FAIL',
      `booked-vs-floor counters UNCHANGED by a real non-selling booking (${JSON.stringify(before)} → ${JSON.stringify(after)})`);
  }

  // ── Leg 5: manager headline excludes it, drill still shows it ────────────
  // A role switch gets its OWN context — clearing cookies mid-context leaves the
  // Firebase SDK's in-memory auth state behind and the next login races it.
  // UM/BM reach TeamPlannerPanel via PRODUCING_MANAGER_NAV, where the item is
  // labelled "Planner" (only the sales_manager entry in ManagerDashboard is
  // labelled "Team Planner") — navigate by label, there is no testid on it.
  mgrCtx = await newLegContext(browser);
  const mp = mgrCtx.page;
  await login(mp, 'unit_manager');
  await gotoTab(mp, 'Planner');
  await mp.locator(tsel('team-planner-rows')).waitFor({ state: 'visible', timeout: 15_000 });

  const headline = await mp.locator(tsel('team-planner-rows')).innerText();
  // SCOPE OF THIS ASSERTION — read before trusting it. It verifies the headline
  // is LABELLED selling-only and renders a real integer. It does NOT verify the
  // exclusion ARITHMETIC: the smoke has no independent expected value here, and
  // deriving one from the fixtures would just restate the implementation. The
  // arithmetic is covered by the value-level unit test with a negative control
  // (TeamPlannerPanel.test.jsx — "counts only selling types in the per-agent
  // headline total"). SMOKES.md is worded to match this scope; keep them in step.
  const headlineMatch = /(\d+) selling booked this week/.exec(headline);
  log(headlineMatch ? 'PASS' : 'FAIL',
    `manager headline is labelled selling-only and renders an integer count (${headlineMatch ? headlineMatch[0] : headline.slice(0, 80)})`);

  await mp.locator('[data-testid^="team-row-"]').first().click();
  await mp.locator(tsel('coaching-drill')).waitFor({ state: 'visible', timeout: 10_000 });
  // Read the drill's chips by their `data-type`, not by regex over its text.
  // The old check was `/Admin|Del/` over innerText: an OR (so one type present
  // satisfied a claim about two) and substring-prone (a prospect named "Delroy"
  // would have matched). Require BOTH non-selling types, by exact type key.
  const drillTypes = await mp.locator(tsel('coaching-drill')).evaluate(
    (el) => [...el.querySelectorAll('[data-type]')].map((c) => c.getAttribute('data-type')),
  );
  const drillShowsExcluded = drillTypes.includes('ADMIN') && drillTypes.includes('DEL');
  log(drillShowsExcluded ? 'PASS' : 'FAIL',
    `coaching drill still shows BOTH excluded non-selling types — nothing is hidden (${JSON.stringify(drillTypes)})`);

  formatCaptureReport(ctx.capture);
  assertLegHygiene(ctx);
  formatCaptureReport(mgrCtx.capture);
  assertLegHygiene(mgrCtx);
  log('PASS', 'hygiene: console-clean + zero prod requests (both contexts)');
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

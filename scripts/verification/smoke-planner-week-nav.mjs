/**
 * smoke-planner-week-nav.mjs — planner week-navigation + dense-card acceptance (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-planner-week-nav.mjs
 *
 * DESKTOP viewport (1280×800 — vh default) so the E1 board renders (lg=1024).
 *
 * Legs:
 *   1. Board + week nav render; "Today" is ABSENT while already on this week.
 *   2. Next → the label advances, Today appears, and the columns are the NEXT
 *      week's dates (data loading is keyed to the VIEWED week, not today).
 *   3. WRITE-READ-VERIFY across a week boundary: book a 7:45 PM sentinel into a
 *      FUTURE-week day column → it renders there → RELOAD → navigate forward
 *      again → the sentinel is still there (it persisted, and the navigated
 *      week really re-queries rather than reusing the current week's data).
 *   4. Today snaps home and the future-week sentinel is NOT in the current
 *      week's columns (proof the two weeks are genuinely distinct queries).
 *   5. GEOMETRY GUARD (the item-2 regression gate, real layout engine): at Week
 *      span every dense card must sit INSIDE its day column and must not
 *      overflow its own box. Before the fix the status pill spilled 48.9px past
 *      the card and 36.1px past the column at a 131px column width.
 *   6. Dense contract: cards are data-dense, carry no status-pill label, and the
 *      day header is stacked (DOW + number) rather than a clipping single line.
 *   7. Postponed toggle defaults to SHOWING (retained-churn design authority)
 *      and hiding reports its count rather than truncating silently.
 *   Legs 1-2 + 5-7 run in BOTH themes; the write leg runs once (light).
 *
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 * MUTATES appointments (residue: one 7:45 PM sentinel in the NEXT week — a slot
 * band no other smoke or fixture uses; `sweep-nonfixture-appointments.mjs
 * --apply` clears it).
 *
 * SWEEPER IS AN UNCONDITIONAL PREREQUISITE (SMOKES.md hard rule):
 *   node --env-file=.env.staging scripts/staging/sweep-nonfixture-appointments.mjs --apply
 *   node --env-file=.env.staging scripts/staging/seed-fixtures.mjs --apply
 */
import { chromium } from 'playwright';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';
// NOTE: formatCaptureReport lives in lib/walk-helpers, NOT vh/vh-helpers, and it
// PRINTS (returns void) — do not wrap it in console.log.
import { formatCaptureReport } from './lib/walk-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;
const SENTINEL_TIME_24 = '19:45';
const SENTINEL_TIME_12 = '7:45 PM';

// Banked lesson #7: a DATA-PRESENCE check must not use isVisible() — a card
// scrolled below a day column's fold reads as not-visible. Assert attachment.
const inDom = async (loc, timeout = 8_000) => {
  try { await loc.first().waitFor({ state: 'attached', timeout }); return true; } catch { return false; }
};

async function openBoard(p) {
  await p.locator(tsel('agent-tab-planner')).first().click({ timeout: 15_000 });
  await p.locator(tsel('planner-desktop-board')).waitFor({ state: 'visible', timeout: 15_000 });
}
const weekLabel = (p) => p.locator(tsel('planner-week-label')).innerText();
const colDates = async (p) => (
  await p.locator('[data-testid^="planner-day-col-"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-testid').replace('planner-day-col-', '')),
  )
);
async function setTheme(p, dark) {
  await p.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('agencytrack-dark', d ? 'true' : 'false'); } catch { /* ignore */ }
  }, dark);
  await p.waitForTimeout(250);
}

// Setup sits OUTSIDE the main try/finally, so a throw from newLegContext (context
// creation or setupBypassSession) would otherwise leak an already-launched
// browser process. Guard it explicitly.
let browser;
let ctx;
try {
  browser = await chromium.launch();
  ctx = await newLegContext(browser); // default 1280×800 (desktop)
} catch (e) {
  console.error('SMOKE SETUP ERROR:', e.message);
  if (browser) await browser.close();
  process.exit(1);
}
const p = ctx.page;

// Firebase project ids observed on the wire. Firestore's Listen/Write channels
// carry the project URL-ENCODED (`projects%2F<id>%2Fdatabases`), so a naive
// `/projects/([a-z0-9-]+)/` regex over resource entries finds NOTHING — decode
// first and watch real requests rather than performance entries (WebChannel
// streams do not reliably appear as resource entries).
const seenProjects = new Set();
p.on('request', (req) => {
  let u = req.url();
  try { u = decodeURIComponent(u); } catch { /* keep raw */ }
  const m = /projects\/([a-z0-9-]+)/.exec(u);
  if (m) seenProjects.add(m[1]);
});
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  await login(p, 'agent1');
  await openBoard(p);

  for (const dark of [false, true]) {
    const theme = dark ? 'dark' : 'light';
    await setTheme(p, dark);

    // ── Leg 1: nav present, Today absent while home ────────────────────────
    await p.locator(tsel('planner-span-week')).click();
    await p.waitForTimeout(350);
    const navUp = await inDom(p.locator(tsel('planner-week-nav')));
    log(navUp ? 'PASS' : 'FAIL', `[${theme}] week nav renders on the board (${navUp})`);

    const homeLabel = await weekLabel(p);
    const todayAbsentHome = !(await inDom(p.locator(tsel('planner-week-today')), 1_200));
    log(todayAbsentHome ? 'PASS' : 'FAIL', `[${theme}] Today snap-back hidden on the current week (${todayAbsentHome})`);

    const homeCols = await colDates(p);
    log(homeCols.length === 7 ? 'PASS' : 'FAIL', `[${theme}] week span → 7 columns (${homeCols.length})`);

    // ── Leg 2: next week re-anchors ────────────────────────────────────────
    await p.locator(tsel('planner-week-next')).click();
    await p.waitForTimeout(900);
    const nextLabel = await weekLabel(p);
    const nextCols = await colDates(p);
    const advanced = nextLabel !== homeLabel && nextCols[0] > homeCols[0];
    log(advanced ? 'PASS' : 'FAIL', `[${theme}] next week advances label + columns ("${homeLabel}" → "${nextLabel}")`);

    const todayShown = await inDom(p.locator(tsel('planner-week-today')));
    log(todayShown ? 'PASS' : 'FAIL', `[${theme}] Today snap-back offered once navigated away (${todayShown})`);

    // Exactly 7 days forward — no drift.
    const deltaDays = Math.round(
      (Date.parse(`${nextCols[0]}T12:00:00Z`) - Date.parse(`${homeCols[0]}T12:00:00Z`)) / 86_400_000,
    );
    log(deltaDays === 7 ? 'PASS' : 'FAIL', `[${theme}] one click = exactly 7 days (${deltaDays})`);

    await p.locator(tsel('planner-week-today')).click();
    await p.waitForTimeout(800);
    const backLabel = await weekLabel(p);
    log(backLabel === homeLabel ? 'PASS' : 'FAIL', `[${theme}] Today returns to the current week (${backLabel})`);

    // ── Leg 7: postponed toggle defaults to SHOWING ────────────────────────
    const toggle = p.locator(tsel('planner-toggle-postponed'));
    const togglePressed = await toggle.getAttribute('aria-pressed');
    log(togglePressed === 'true' ? 'PASS' : 'FAIL', `[${theme}] postponed default = SHOWING (aria-pressed=${togglePressed})`);

    // ── Legs 5 + 6: geometry guard + dense contract ────────────────────────
    const geo = await p.evaluate(() => {
      const out = {
        cards: 0, cardOverflow: 0, colSpill: 0, missingDense: 0, withPill: 0, headerClipped: 0,
        offenders: [],
      };
      const PILL = /^(Scheduled|Confirmed|Kept|Postponed|Cancelled|Done)$/;
      document.querySelectorAll('[data-testid^="planner-day-col-"]').forEach((col) => {
        const colR = col.getBoundingClientRect();
        // Scope the clip check to the HEADER ONLY. A day column also contains
        // card NAME spans, which are `truncate` BY DESIGN (graceful ellipsis) —
        // counting those as "clipped headers" is a false positive.
        const head = col.querySelector('[data-testid^="planner-day-head-"]');
        if (head) {
          head.querySelectorAll('span').forEach((s) => {
            if (s.scrollWidth > s.clientWidth + 1) {
              out.headerClipped += 1;
              out.offenders.push(`header:${head.getAttribute('data-testid')}:"${s.textContent.trim()}":${s.scrollWidth}v${s.clientWidth}`);
            }
          });
        }
        col.querySelectorAll('button[data-testid^="appt-card-"]').forEach((card) => {
          out.cards += 1;
          const id = card.getAttribute('data-testid');
          if (card.getAttribute('data-dense') !== 'true') out.missingDense += 1;
          if (card.scrollWidth > card.clientWidth + 1) {
            out.cardOverflow += 1;
            // Name the widest offending descendant so the cause is diagnosable
            // from the log alone, without a second investigation run.
            let worst = null;
            card.querySelectorAll('*').forEach((el) => {
              const w = el.getBoundingClientRect().width;
              if (!worst || w > worst.w) worst = { w: Math.round(w), t: el.textContent.trim().slice(0, 24), c: el.className };
            });
            out.offenders.push(`card:${id}:${card.scrollWidth}v${card.clientWidth}:widest="${worst?.t}"(${worst?.w}px)`);
          }
          if (card.getBoundingClientRect().right > colR.right + 1) out.colSpill += 1;
          const visible = [...card.querySelectorAll('*')]
            .filter((el) => !el.classList.contains('sr-only'))
            .map((el) => (el.children.length === 0 ? el.textContent.trim() : ''));
          if (visible.some((t) => PILL.test(t))) out.withPill += 1;
        });
      });
      return out;
    });
    if (geo.offenders.length) console.log(`       offenders[${theme}]: ${geo.offenders.join(' | ')}`);
    if (geo.cards === 0) {
      log('FAIL', `[${theme}] geometry guard had NO cards to measure — seed fixtures first (sweeper + seed-fixtures)`);
    } else {
      log(geo.cardOverflow === 0 ? 'PASS' : 'FAIL', `[${theme}] no dense card overflows its own box (${geo.cardOverflow}/${geo.cards})`);
      log(geo.colSpill === 0 ? 'PASS' : 'FAIL', `[${theme}] no dense card spills past its day column (${geo.colSpill}/${geo.cards})`);
      log(geo.missingDense === 0 ? 'PASS' : 'FAIL', `[${theme}] all week-span cards use the dense layout (${geo.cards - geo.missingDense}/${geo.cards})`);
      log(geo.withPill === 0 ? 'PASS' : 'FAIL', `[${theme}] no status pill in dense cards (${geo.withPill} offenders)`);
      log(geo.headerClipped === 0 ? 'PASS' : 'FAIL', `[${theme}] no day header clipped (${geo.headerClipped} clipped)`);
    }
  }

  // ── PRE-WRITE PROJECT GUARD ───────────────────────────────────────────────
  // `assertLegHygiene` checks "zero prod requests" only at the END — i.e. AFTER
  // this smoke has already booked an appointment. When it is pointed at a
  // feature-branch preview (STAGING_BASE_URL=<preview>) rather than the staging
  // branch deploy, whether that preview inherits staging Firebase env is a
  // Vercel-config question this script must not assume. So: prove the target is
  // staging BEFORE writing anything, and abort loudly if it is not.
  const projects = [...seenProjects];
  const sawProd = ctx.prodRequests.length > 0 || projects.includes('agencytrack-2a610');
  const sawStaging = projects.includes('agencytrack-staging');
  if (sawProd) {
    throw new Error(
      `ABORT BEFORE WRITE: production project traffic detected (projects=${projects.join(',')}). `
      + 'Refusing to book an appointment — this target is not staging.',
    );
  }
  if (!sawStaging) {
    throw new Error(
      `ABORT BEFORE WRITE: could not positively confirm the staging project (projects=${projects.join(',') || 'none observed'}). `
      + 'Refusing to mutate an unidentified backend.',
    );
  }
  log('PASS', `pre-write project guard: staging confirmed, zero prod (${projects.join(',')})`);

  // ── Legs 3 + 4: cross-week write-read-verify (light only) ────────────────
  await setTheme(p, false);
  await p.locator(tsel('planner-span-week')).click();
  await p.waitForTimeout(350);
  const thisWeekLabel = await weekLabel(p);

  await p.locator(tsel('planner-week-next')).click();
  await p.waitForTimeout(900);
  const futureLabel = await weekLabel(p);
  const futureCols = await colDates(p);
  const targetDate = futureCols[3]; // mid-week of the future week

  // Book into the FUTURE week via that day column's Add button.
  await p.locator(tsel(`planner-day-add-${targetDate}`)).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'visible', timeout: 8_000 });
  await p.locator('#appt-time').fill(SENTINEL_TIME_24);
  await p.locator(tsel('appt-save')).click();
  await p.locator(tsel('appointment-sheet')).waitFor({ state: 'detached', timeout: 12_000 });
  await p.waitForTimeout(1400);

  const card = (date) => p.locator(tsel(`planner-day-col-${date}`))
    .locator(`button[data-testid^="appt-card-"]:has-text("${SENTINEL_TIME_12}")`);

  const preReload = await inDom(card(targetDate));
  log(preReload ? 'PASS' : 'FAIL', `sentinel ${SENTINEL_TIME_12} renders in the future week pre-reload (${preReload})`);

  // RELOAD — the planner reopens on the CURRENT week (anchor is session state).
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1600);
  await openBoard(p);
  await p.locator(tsel('planner-span-week')).click();
  await p.waitForTimeout(500);
  const afterReloadLabel = await weekLabel(p);
  log(afterReloadLabel === thisWeekLabel ? 'PASS' : 'FAIL',
    `reload reopens on the current week (${afterReloadLabel})`);

  // Leg 4: the future-week sentinel must NOT appear in the current week.
  const leakedIntoThisWeek = await inDom(
    p.locator(`button[data-testid^="appt-card-"]:has-text("${SENTINEL_TIME_12}")`), 1_500,
  );
  log(!leakedIntoThisWeek ? 'PASS' : 'FAIL',
    `future-week sentinel absent from the current week (leaked=${leakedIntoThisWeek})`);

  // Navigate forward again → it must be there (persisted + re-queried).
  await p.locator(tsel('planner-week-next')).click();
  await p.waitForTimeout(1100);
  const backLabelFuture = await weekLabel(p);
  const persisted = await inDom(card(targetDate));
  log(persisted ? 'PASS' : 'FAIL',
    `sentinel persisted in ${backLabelFuture} after reload + re-navigation (${persisted})`);
  log(backLabelFuture === futureLabel ? 'PASS' : 'FAIL',
    `re-navigation lands on the same week (${futureLabel} → ${backLabelFuture})`);

  // LOCALHOST-ONLY hygiene allowance. `/_vercel/insights/script.js` and
  // `/_vercel/speed-insights/script.js` are injected by the Vercel PLATFORM, so
  // they 404 whenever this build is served off-platform (the documented fallback
  // when a feature-branch preview does not carry staging Firebase env). The
  // shared CONSOLE_ALLOWLIST already intends to ignore `/_vercel/`, but a 404
  // surfaces as the generic "Failed to load resource…" string with no URL in it,
  // so the existing pattern cannot match. Scoped THREE ways so a real staging
  // run stays fully strict: localhost target only, 404s only, and only when the
  // matching network failure is a `_vercel` insights script.
  const isLocal = /^https?:\/\/localhost[:/]/.test(process.env.STAGING_BASE_URL ?? '');
  if (isLocal && ctx.capture?.consoleMessages) {
    const vercelOnly404 = (ctx.capture.networkFailures ?? [])
      .filter((f) => /\/_vercel\/(insights|speed-insights)\/script\.js/.test(typeof f === 'string' ? f : (f.url ?? '')))
      .length;
    if (vercelOnly404 > 0) {
      // BOUNDED removal: drop at most as many 404 messages as there were
      // _vercel-insights network failures. A console message carries no URL, so
      // an unbounded filter would also swallow an UNRELATED local 404 that
      // merely co-occurred — masking a real regression under this allowance.
      let budget = vercelOnly404;
      const kept = [];
      for (const m of ctx.capture.consoleMessages) {
        const text = typeof m === 'string' ? m : (m.text ?? '');
        if (budget > 0 && /Failed to load resource.*404/.test(text)) { budget -= 1; continue; }
        kept.push(m);
      }
      const dropped = ctx.capture.consoleMessages.length - kept.length;
      ctx.capture.consoleMessages = kept;
      console.log(`       NOTE: dropped ${dropped} of ${vercelOnly404} allowed localhost-only 404 console error(s) `
        + '(_vercel insights scripts, absent off-platform). Any FURTHER 404 still fails. Strict on a real staging URL.');
    }
  }

  formatCaptureReport(ctx.capture);
  assertLegHygiene(ctx);
  log('PASS', `hygiene: console-clean + zero prod requests${isLocal ? ' (localhost run — see NOTE above)' : ''}`);
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
  // Print the full capture on the failure path too — "Failed to load resource"
  // alone is not diagnosable, and a hygiene failure otherwise costs an extra run.
  if (ctx?.capture) formatCaptureReport(ctx.capture);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ PLANNER WEEK-NAV SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

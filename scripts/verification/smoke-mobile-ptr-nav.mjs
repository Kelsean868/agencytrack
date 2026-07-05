/**
 * smoke-mobile-ptr-nav.mjs
 * Mobile-nav PTR fix smoke (re-scoped fu-mobile-nav brief, 2026-07-05).
 *
 * 380×844 mobile viewport (hasTouch), both themes, signed in as the A11Y agent.
 *
 * PTR legs (the fix — PULL_THRESHOLD 72→110 + overscroll-behavior-y: contain):
 *   1. normal downward-scroll gesture (finger up) does NOT trigger refresh
 *   2. 90px pull (would have fired at old 72px threshold) does NOT trigger
 *   3. deliberate ≥110px pull from top STILL triggers (PTR retained)
 *   4. .shell-content computed overscroll-behavior-y === 'contain'
 *
 * More-drawer + plus/FAB legs (behavioral confirmation of the Bug-2
 * falsification — NO code change to MobileNavDrawer / QuickAddMenu):
 *   5. More opens; dismiss via X close button, focus returns to trigger
 *   6. More dismiss via backdrop tap
 *   7. More dismiss via Escape, focus returns to trigger
 *   8. plus/FAB (Create) opens Quick-Add; dismiss via backdrop tap
 *   9. plus/FAB dismiss via Escape
 *  10. bottom-nav tab navigation regression (History ⇄ Home active state)
 *
 * Run: node scripts/verification/smoke-mobile-ptr-nav.mjs [previewUrl]
 *   Base URL: argv[2] || SMOKE_BASE_URL || SMOKE_PREVIEW_URL || prod.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* .env.local optional if env already set */ }
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL  = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS   = requireEnv('A11Y_AGENT_PASSWORD');
const BASE_URL = process.argv[2] || process.env.SMOKE_BASE_URL || process.env.SMOKE_PREVIEW_URL || 'https://agencytrack.vercel.app';

const SPINNER = '[aria-label="Refreshing content"]';
const MAIN = 'main.shell-content';

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true,  note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };

async function loginAndWait(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  // Mobile-friendly login confirmation (sidebar selector is CSS-hidden <768px)
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(2000);
}

async function setDarkMode(page, wantDark) {
  await page.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('agencytrack-dark', d ? '1' : '0'); } catch { /* private mode */ }
  }, wantDark);
  await page.waitForTimeout(400);
}

// Synthetic TouchEvent dispatch on the scroll container — targets the app's
// own usePullToRefresh listeners (the surface under test). Separate calls so
// mid-gesture UI state (the 'pulling' spinner) can be asserted between them.
async function touchStart(page, y) {
  await page.evaluate(({ sel, y }) => {
    const el = document.querySelector(sel);
    const t = new Touch({ identifier: 1, target: el, clientX: 190, clientY: y });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, { sel: MAIN, y });
}
async function touchMove(page, y) {
  await page.evaluate(({ sel, y }) => {
    const el = document.querySelector(sel);
    const t = new Touch({ identifier: 1, target: el, clientX: 190, clientY: y });
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, { sel: MAIN, y });
}
async function touchEnd(page) {
  await page.evaluate(({ sel }) => {
    const el = document.querySelector(sel);
    const t = new Touch({ identifier: 1, target: el, clientX: 190, clientY: 0 });
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
  }, { sel: MAIN });
}

const spinnerVisible = (page) => page.locator(SPINNER).isVisible().catch(() => false);

async function activeTestId(page) {
  return page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? 'none');
}

async function runTheme(browser, theme) {
  console.log(`\n=== ${theme.toUpperCase()} MODE (380×844, hasTouch) ===`);
  const context = await browser.newContext({ viewport: { width: 380, height: 844 }, hasTouch: true });
  // Guard like loginAndWait below — an unguarded throw would abort the whole
  // run (other theme + final summary) on one transient bypass failure
  // (CodeRabbit, PR #795). setupBypassSession sanitizes its own errors.
  try {
    await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);
  } catch (e) {
    fail(`${theme}-bypass`, e.message);
    await context.close();
    return;
  }
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try { await loginAndWait(page); } catch (e) { fail(`${theme}-login`, e.message); await context.close(); return; }
  console.log('  login: ok');
  await setDarkMode(page, theme === 'dark');

  // Dashboard tab is PTR-enabled (PTR_AGENT_TABS) and is the default tab.
  // Ensure the container is at scroll-top before each PTR leg.
  const resetScroll = () => page.evaluate((sel) => { document.querySelector(sel).scrollTop = 0; }, MAIN);

  // ── Leg 1: normal downward-scroll gesture (finger moves UP) — no refresh ──
  await resetScroll();
  await touchStart(page, 500);
  await touchMove(page, 380);
  await touchMove(page, 250); // finger up = scrolling DOWN the list
  await touchEnd(page);
  await page.waitForTimeout(400);
  (await spinnerVisible(page))
    ? fail(`${theme}-ptr-normal-scroll`, 'refresh spinner appeared during a normal downward scroll gesture')
    : pass(`${theme}-ptr-normal-scroll`, 'no refresh on normal scroll gesture');

  // ── Leg 2: 90px pull — below new 110px threshold (fired at old 72px) ──
  await resetScroll();
  await touchStart(page, 200);
  await touchMove(page, 250);
  await touchMove(page, 290); // delta 90 — 72 < 90 < 110
  const midSub = await spinnerVisible(page);
  await touchEnd(page);
  await page.waitForTimeout(400);
  const postSub = await spinnerVisible(page);
  (!midSub && !postSub)
    ? pass(`${theme}-ptr-sub-threshold`, '90px pull (old-threshold trigger) does not fire')
    : fail(`${theme}-ptr-sub-threshold`, `spinner mid=${midSub} post=${postSub} on a 90px pull`);

  // ── Leg 3: deliberate ≥110px pull from top STILL triggers (PTR retained) ──
  await resetScroll();
  await touchStart(page, 150);
  await touchMove(page, 220);
  await touchMove(page, 300); // delta 150 ≥ 110 → 'pulling'
  let pulling = false;
  try {
    await page.waitForSelector(SPINNER, { state: 'visible', timeout: 3000 });
    pulling = true;
  } catch { /* asserted below */ }
  await touchEnd(page); // → 'refreshing' → onRefresh() → back to idle
  if (pulling) {
    pass(`${theme}-ptr-deliberate-pull`, 'deliberate 150px pull shows pulling/refresh indicator (PTR retained)');
  } else {
    fail(`${theme}-ptr-deliberate-pull`, 'no pulling indicator on a deliberate 150px pull from top');
  }
  // refresh should settle (indicator clears) — generous timeout for the refetch
  try {
    await page.waitForSelector(SPINNER, { state: 'hidden', timeout: 20_000 });
    pass(`${theme}-ptr-refresh-settles`, 'refresh indicator clears after refetch');
  } catch {
    fail(`${theme}-ptr-refresh-settles`, 'refresh indicator still visible 20s after pull');
  }

  // ── Leg 4: overscroll-behavior-y: contain on .shell-content ──
  const overscroll = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).overscrollBehaviorY, MAIN);
  overscroll === 'contain'
    ? pass(`${theme}-overscroll-contain`, `computed overscroll-behavior-y = ${overscroll}`)
    : fail(`${theme}-overscroll-contain`, `computed overscroll-behavior-y = ${overscroll}, expected contain`);

  // ── Legs 5–7: More drawer dismissal (Bug-2 falsification evidence) ──
  // Leg isolation (CodeRabbit, PR #795): force-close any lingering overlay
  // before each open so a failed dismissal in one leg can't corrupt the next
  // leg's result — failures stay attributable to the right interaction.
  const ensureOverlaysClosed = async () => {
    for (let i = 0; i < 3; i++) {
      const open = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
      if (!open) return;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  };
  const openMore = async () => {
    await ensureOverlaysClosed();
    await page.locator('[data-testid="bottomnav-more"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(350); // drawer slide-up animation
  };
  const drawerGone = () => page.locator('[data-testid="nav-drawer-backdrop"]').isHidden().catch(() => true);

  // 5 — X close button + focus return
  try {
    await openMore();
    await page.locator('button[aria-label="Close menu"]').click();
    await page.waitForTimeout(400);
    const gone = await drawerGone();
    const focusId = await activeTestId(page);
    (gone && focusId === 'bottomnav-more')
      ? pass(`${theme}-more-close-x`, 'X dismisses; focus returned to More trigger')
      : fail(`${theme}-more-close-x`, `gone=${gone} focus=${focusId}`);
  } catch (e) { fail(`${theme}-more-close-x`, e.message); }

  // 6 — backdrop tap. dispatchEvent('click') targets the backdrop element
  // directly — a coordinate mouse click passes through to whatever occupies
  // the point after the drawer unmounts mid-gesture (caught live: (190,80)
  // landed on the TopBar's Sunday "Review week" CTA and opened DailyCaptureV2,
  // which early-returns before the Shell and removes the bottom nav).
  try {
    await openMore();
    await page.locator('[data-testid="nav-drawer-backdrop"]').dispatchEvent('click');
    await page.waitForTimeout(400);
    (await drawerGone())
      ? pass(`${theme}-more-close-backdrop`, 'backdrop tap dismisses')
      : fail(`${theme}-more-close-backdrop`, 'drawer still open after backdrop tap');
  } catch (e) { fail(`${theme}-more-close-backdrop`, e.message); }

  // 7 — Escape + focus return
  try {
    await openMore();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const gone = await drawerGone();
    const focusId = await activeTestId(page);
    (gone && focusId === 'bottomnav-more')
      ? pass(`${theme}-more-close-escape`, 'Escape dismisses; focus returned to More trigger')
      : fail(`${theme}-more-close-escape`, `gone=${gone} focus=${focusId}`);
  } catch (e) { fail(`${theme}-more-close-escape`, e.message); }

  // ── Legs 8–9: plus/FAB (Create → Quick-Add sheet) reachable + dismissable ──
  const quickAdd = '[role="dialog"][aria-label="Quick add"]';
  // 8 — open + backdrop tap (backdrop has no testid; dispatch on the element —
  // see the pass-through note on the More backdrop leg above)
  try {
    await ensureOverlaysClosed();
    await page.locator('[data-testid="bottomnav-create"]').click();
    await page.waitForSelector(quickAdd, { state: 'visible', timeout: 5000 });
    await page.locator('div.fixed.inset-0.z-40').first().dispatchEvent('click');
    await page.waitForTimeout(400);
    (await page.locator(quickAdd).isHidden().catch(() => true))
      ? pass(`${theme}-fab-close-backdrop`, 'Quick-Add opens from ＋ and backdrop tap dismisses')
      : fail(`${theme}-fab-close-backdrop`, 'Quick-Add still open after backdrop tap');
  } catch (e) { fail(`${theme}-fab-close-backdrop`, e.message); }

  // 9 — Escape
  try {
    await ensureOverlaysClosed();
    await page.locator('[data-testid="bottomnav-create"]').click();
    await page.waitForSelector(quickAdd, { state: 'visible', timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    (await page.locator(quickAdd).isHidden().catch(() => true))
      ? pass(`${theme}-fab-close-escape`, 'Escape dismisses Quick-Add')
      : fail(`${theme}-fab-close-escape`, 'Quick-Add still open after Escape');
  } catch (e) { fail(`${theme}-fab-close-escape`, e.message); }

  // ── Leg 10: bottom-nav tab navigation regression ──
  try {
    await ensureOverlaysClosed();
    await page.locator('[data-testid="bottomnav-history"]').click();
    await page.waitForTimeout(1200);
    const histActive = await page.evaluate(() =>
      document.querySelector('[data-testid="bottomnav-history"]')?.getAttribute('aria-current') === 'page');
    const crash = await page.evaluate(() => (document.body.textContent || '').includes('Something went wrong'));
    await page.locator('[data-testid="bottomnav-home"]').click();
    await page.waitForTimeout(800);
    const homeActive = await page.evaluate(() =>
      document.querySelector('[data-testid="bottomnav-home"]')?.getAttribute('aria-current') === 'page');
    (histActive && homeActive && !crash)
      ? pass(`${theme}-tab-nav`, 'History ⇄ Home active state moves, no crash')
      : fail(`${theme}-tab-nav`, `histActive=${histActive} homeActive=${homeActive} crash=${crash}`);
  } catch (e) { fail(`${theme}-tab-nav`, e.message); }

  formatCaptureReport(capture);
  await context.close();
}

console.log(`Base URL: ${BASE_URL}`);
const browser = await chromium.launch({ headless: true });
try {
  await runTheme(browser, 'light');
  await runTheme(browser, 'dark');
} finally {
  await browser.close();
}

const PASS = results.filter(r => r.ok);
const FAIL = results.filter(r => !r.ok);
console.log('\n══════════════════════════════════════════');
console.log(`SMOKE SUMMARY: ${PASS.length} PASS  /  ${FAIL.length} FAIL`);
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.id}${r.note ? ' — ' + r.note : ''}`);
console.log('══════════════════════════════════════════');
if (FAIL.length > 0) process.exit(1);

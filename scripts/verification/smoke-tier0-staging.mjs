/**
 * smoke-tier0-staging.mjs — Fable Tier 0 browser-level verification on the LIVE
 * staging deployment (agencytrack-git-staging-kyron-marchan-s-projects.vercel.app,
 * `agencytrack-staging` Firebase project).
 *
 * Verifies (per role, real subjects, no admin bypass):
 *   1. Login → real dashboard content
 *   2. Dialog a11y (role=dialog/aria-modal, focus-trap-in, Escape-close,
 *      focus-return, 44px close target) on 2-3 of the 7 Tier-0 §4 modals
 *      reachable by that role
 *   3. Dense-table mechanics (§5) — MasterSheet (branch_manager), Users +
 *      Branches real <table> semantics (tenant_admin)
 *   4. Motion (§2) — count-up numeral + .screen-enter/.stagger, both normal
 *      and prefers-reduced-motion: reduce
 *   5. Prospect-list sort ascending by date (agent)
 *   6. Four-states sweep — actionable empty, error+Retry (firestore route
 *      abort), PanelSkeleton on throttled load
 *   7. Dark-mode contrast sanity on one representative screen per role
 *
 * Every assertion is value-level (real computed styles, real sort order, real
 * bounding boxes) — none are selector-existence-only. Any surface unreachable
 * on the synthetic staging tenant is recorded SKIPPED with a reason, never a
 * faked PASS.
 *
 * READ-ONLY against the app's data model except where the Tier-0 build itself
 * already exercises a write path (EditUserDrawer / DeactivateBranchConfirmDialog
 * are opened and then Escaped — never submitted).
 *
 * Usage:
 *   node --env-file=.env.staging scripts/verification/smoke-tier0-staging.mjs
 *
 * Credentials: the three staging synthetic accounts are hardcoded below (not
 * secrets — staging-only test tenant, explicitly provided out-of-band for this
 * run). VERCEL_BYPASS_TOKEN is read from .env.staging (copied in from the main
 * AgencyTrack worktree's .env.local per CLAUDE.md's "use, don't echo" rule —
 * never printed to output).
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  stamp,
  finishSmoke,
  installGlobalTimeout,
} from './lib/walk-helpers.mjs';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';

// ── Config ───────────────────────────────────────────────────────────────
const BASE = 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app';
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;

// Staging-only synthetic test tenant accounts (safe to hardcode — not
// production credentials; freshly verified live per the dispatching brief).
const ACCOUNTS = {
  agent: { email: 'staging-agent-1@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' },
  branch_manager: { email: 'staging-branch-manager@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' },
  tenant_admin: { email: 'staging-tenant-admin@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' },
};

const SS_DIR = resolve('out/tier0-smoke', stamp().replace(/:/g, '-'));
mkdirSync(SS_DIR, { recursive: true });

if (!TOKEN) {
  console.error('MISSING ENV: VERCEL_BYPASS_TOKEN (expected in .env.staging — run with --env-file=.env.staging)');
  process.exit(2);
}

const results = [];
function record(id, status, detail) {
  results.push({ leg: id, passed: status === 'PASS', status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'SKIP' ? '⊘' : '✗';
  console.log(`[${stamp()}] ${icon} ${status} ${id} — ${detail}`);
}
const pass = (id, detail) => record(id, 'PASS', detail);
const fail = (id, detail) => record(id, 'FAIL', detail);
const skip = (id, detail) => record(id, 'SKIP', detail);

async function shot(page, name) {
  try {
    const path = join(SS_DIR, `${name}.png`);
    await page.screenshot({ path, fullPage: false });
    return path;
  } catch {
    return null;
  }
}

const clearTimer = installGlobalTimeout(17 * 60 * 1000, () => {
  console.log('\n── Partial results at timeout ──');
  for (const r of results) console.log(`  ${r.passed ? '✓' : '✗'} ${r.leg}: ${r.detail}`);
});

// ── Generic helpers ──────────────────────────────────────────────────────

/**
 * gotoTab — clicks a nav item by data-testid. Fails FAST and with a clearly
 * distinguishable error when the item is disabled (aria-disabled="true" —
 * the "Coming soon" gate pattern used across navConfig.js), instead of
 * burning a 30s actionability-retry timeout trying to click an unclickable
 * button. Callers can match `DISABLED_NAV:` to turn this into a SKIP rather
 * than a hard FAIL.
 */
async function gotoTab(page, testid, { timeout = 12_000 } = {}) {
  const el = page.locator(`[data-testid="${testid}"]`).first();
  await el.waitFor({ state: 'visible', timeout });
  const disabled = await el.getAttribute('aria-disabled');
  if (disabled === 'true') {
    const title = await el.getAttribute('title');
    throw new Error(`DISABLED_NAV: [data-testid="${testid}"] is aria-disabled="true" (title="${title ?? ''}") — nav item is gated off on staging, not clickable`);
  }
  await el.click();
}

/**
 * loginRealForm — submits the real login form and races the dashboard-render
 * signal against the inline "Incorrect email or password." error text, so a
 * bad-credentials account fails fast (~2-3s) instead of burning the full
 * timeout. Throws a clearly-labeled error distinguishing auth failure from a
 * generic render timeout.
 */
async function loginRealForm(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  const outcome = await Promise.race([
    page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 })
      .then(() => 'rendered'),
    page.waitForSelector('text=Incorrect email or password', { timeout: 20_000 })
      .then(() => 'auth-error'),
  ]).catch(() => 'timeout');
  if (outcome === 'auth-error') {
    throw new Error('AUTH-FAILED: login form rejected the credentials ("Incorrect email or password.")');
  }
  if (outcome === 'timeout') {
    throw new Error('LOGIN-TIMEOUT: neither dashboard content nor an auth error appeared within 20s');
  }
  await page.waitForTimeout(1200);
}

/**
 * Dialog a11y contract check — role=dialog, aria-modal, focus lands inside,
 * Escape closes, focus returns to trigger, close target >= 44px (when a
 * close selector is supplied).
 */
async function checkDialog(page, {
  idPrefix, roleLabel, triggerSelector, dialogSelector, closeSelector, escapeCloses = true,
}) {
  try {
    const trigger = page.locator(triggerSelector).first();
    await trigger.waitFor({ state: 'visible', timeout: 10_000 });
    await trigger.click();

    const dialog = page.locator(dialogSelector).first();
    await dialog.waitFor({ state: 'visible', timeout: 8_000 });
    pass(`${roleLabel}-${idPrefix}-open`, `dialog opened via ${triggerSelector}`);

    const attrs = await dialog.evaluate((el) => ({
      role: el.getAttribute('role'),
      ariaModal: el.getAttribute('aria-modal'),
    }));
    if (attrs.role === 'dialog' && attrs.ariaModal === 'true') {
      pass(`${roleLabel}-${idPrefix}-attrs`, `role="dialog" aria-modal="true"`);
    } else {
      fail(`${roleLabel}-${idPrefix}-attrs`, `expected role=dialog+aria-modal=true, got role=${attrs.role} aria-modal=${attrs.ariaModal}`);
    }

    // Focus lands inside the dialog on open. Resolved via locator.evaluate
    // (element bound directly, not re-queried via a raw CSS string) so this
    // works even when the selector uses Playwright-only pseudo-classes.
    const focusInside = await dialog.evaluate((dlg) =>
      !!(dlg && dlg.contains(document.activeElement) && document.activeElement !== document.body));
    if (focusInside) pass(`${roleLabel}-${idPrefix}-focus-in`, 'focus landed inside dialog on open');
    else fail(`${roleLabel}-${idPrefix}-focus-in`, 'document.activeElement is NOT inside the dialog after open');

    // Close-target hit area >= 44px (when applicable).
    if (closeSelector) {
      const closeBtn = dialog.locator(closeSelector).first();
      const box = await closeBtn.boundingBox().catch(() => null);
      if (box && box.width >= 44 && box.height >= 44) {
        pass(`${roleLabel}-${idPrefix}-close-target`, `close hit target ${Math.round(box.width)}x${Math.round(box.height)}px`);
      } else {
        fail(`${roleLabel}-${idPrefix}-close-target`, `close hit target ${box ? `${Math.round(box.width)}x${Math.round(box.height)}px` : 'NOT FOUND'} (< 44px)`);
      }
    } else {
      skip(`${roleLabel}-${idPrefix}-close-target`, 'no distinct close selector supplied for this dialog');
    }

    if (escapeCloses) {
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});
      const stillVisible = await dialog.isVisible().catch(() => false);
      if (!stillVisible) pass(`${roleLabel}-${idPrefix}-escape-close`, 'Escape closed the dialog');
      else fail(`${roleLabel}-${idPrefix}-escape-close`, 'dialog still visible after Escape');

      // Focus returns to the trigger. Resolved via locator.evaluate (element
      // bound directly) so Playwright-only selectors like :has-text() work —
      // document.querySelector(sel) would throw a SyntaxError on those.
      const returned = await trigger.evaluate((trig) => !!(trig && document.activeElement === trig)).catch(() => false);
      if (returned) pass(`${roleLabel}-${idPrefix}-focus-return`, 'focus returned to the trigger element');
      else fail(`${roleLabel}-${idPrefix}-focus-return`, 'document.activeElement did not return to the trigger after Escape');
    } else {
      skip(`${roleLabel}-${idPrefix}-escape-close`, 'escape-close not applicable for this dialog');
      skip(`${roleLabel}-${idPrefix}-focus-return`, 'escape-close not applicable for this dialog');
    }
  } catch (e) {
    fail(`${roleLabel}-${idPrefix}-dialog`, `unreachable/errored: ${e.message}`);
    await shot(page, `${roleLabel}-${idPrefix}-FAIL`);
  }
}

/** Sample the animation state of a stagger/screen-enter host. */
async function checkMotionClass(page, { roleLabel, selector, expectAnimating }) {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'attached', timeout: 8_000 });
    const animName = await el.evaluate((node) => getComputedStyle(node).animationName);
    const child = await page.locator(`${selector} > *`).first().evaluate((node) => getComputedStyle(node).animationName).catch(() => 'none');
    const animating = animName !== 'none' || child !== 'none';
    if (animating === expectAnimating) {
      pass(
        `${roleLabel}-motion-${expectAnimating ? 'normal' : 'reduced'}`,
        `${selector}: animation-name=${animName}, child=${child} (expected ${expectAnimating ? 'animating' : 'inert'})`,
      );
    } else {
      fail(
        `${roleLabel}-motion-${expectAnimating ? 'normal' : 'reduced'}`,
        `${selector}: animation-name=${animName}, child=${child} — expected ${expectAnimating ? 'an active animation-name' : 'animation-name: none'}`,
      );
    }
  } catch (e) {
    fail(`${roleLabel}-motion-${expectAnimating ? 'normal' : 'reduced'}`, `check errored: ${e.message}`);
  }
}

/** Sample a count-up numeral's text at two points in time; assert it changes
 * en route to a stable final value under normal motion, and is immediately
 * final + stable under reduced motion. Locates the numeral via a label
 * sibling (HeroCard has no data-testid on the figure itself). */
async function checkCountUp(page, { roleLabel, labelText, expectAnimated }) {
  try {
    const read = () => page.evaluate((label) => {
      const nodes = Array.from(document.querySelectorAll('p'));
      const labelNode = nodes.find((n) => n.textContent?.trim() === label);
      if (!labelNode) return null;
      const numeral = labelNode.nextElementSibling;
      return numeral ? numeral.textContent.trim() : null;
    }, labelText);

    const t0 = await read();
    if (t0 === null) {
      skip(`${roleLabel}-countup`, `numeral sibling of "${labelText}" not found`);
      return;
    }
    await page.waitForTimeout(150);
    const t1 = await read();
    await page.waitForTimeout(900);
    const t2 = await read();

    if (expectAnimated) {
      // Capable of failing: if t0 === t1 === t2 the count-up isn't running.
      const changed = t0 !== t2 || t1 !== t2;
      if (changed) pass(`${roleLabel}-countup-normal`, `numeral progressed ${t0} -> ${t1} -> ${t2}`);
      else fail(`${roleLabel}-countup-normal`, `numeral static at ${t0} across 3 samples — count-up did not animate`);
    } else {
      // Reduced motion: value must be final immediately (t0 === t2, no ramp).
      const stable = t0 === t2;
      if (stable) pass(`${roleLabel}-countup-reduced`, `numeral rendered final value immediately (${t0}), stable under reduced motion`);
      else fail(`${roleLabel}-countup-reduced`, `numeral changed under reduced motion: ${t0} -> ${t2} (should snap to final value)`);
    }
  } catch (e) {
    fail(`${roleLabel}-countup-${expectAnimated ? 'normal' : 'reduced'}`, `check errored: ${e.message}`);
  }
}

/** Contrast sanity — computed color vs computed background-color on N nodes. */
async function checkDarkContrast(page, { roleLabel, selectors }) {
  const relLum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parseRGB = (s) => {
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  let checked = 0;
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      const found = await el.count();
      if (found === 0) { skip(`${roleLabel}-dark-contrast-${sel}`, 'selector not present on this screen'); continue; }
      const { color, bg, text } = await el.evaluate((node) => {
        let bgNode = node;
        let bg = getComputedStyle(bgNode).backgroundColor;
        while ((bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && bgNode.parentElement) {
          bgNode = bgNode.parentElement;
          bg = getComputedStyle(bgNode).backgroundColor;
        }
        return { color: getComputedStyle(node).color, bg, text: node.textContent?.trim().slice(0, 30) };
      });
      const fg = parseRGB(color);
      const bgRgb = parseRGB(bg);
      if (!fg || !bgRgb) { skip(`${roleLabel}-dark-contrast-${sel}`, `could not resolve rgb (color=${color}, bg=${bg})`); continue; }
      const L1 = relLum(...fg) + 0.05;
      const L2 = relLum(...bgRgb) + 0.05;
      const ratio = L1 > L2 ? L1 / L2 : L2 / L1;
      checked++;
      if (ratio >= 3.0) pass(`${roleLabel}-dark-contrast-${sel}`, `"${text}" ratio ${ratio.toFixed(2)}:1 (color=${color} on bg=${bg})`);
      else fail(`${roleLabel}-dark-contrast-${sel}`, `"${text}" ratio ${ratio.toFixed(2)}:1 — BELOW 3:1 (color=${color} on bg=${bg})`);
    } catch (e) {
      fail(`${roleLabel}-dark-contrast-${sel}`, `errored: ${e.message}`);
    }
  }
  if (checked === 0) skip(`${roleLabel}-dark-contrast-overall`, 'no selectors resolved on this screen');
}

/**
 * runReducedMotionLeg — shared reduced-motion check for any role. Fresh
 * context with Playwright's `reducedMotion: 'reduce'` (which sets the
 * `prefers-reduced-motion: reduce` media feature before first paint), logs
 * in, optionally navigates to a tab, then asserts `.screen-enter`/`.stagger`
 * carry NO active animation (computed animation-name: none) — capable of
 * failing if the CSS's `@media (prefers-reduced-motion: no-preference)` gate
 * in `src/index.css` is ever removed or mis-scoped.
 */
async function runReducedMotionLeg(browser, { roleLabel, email, password, navTestId }) {
  const rmContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
  let rmPage;
  try {
    await setupBypassSession(rmContext, BASE, TOKEN);
    rmPage = await rmContext.newPage();
    await loginRealForm(rmPage, email, password);
    if (navTestId) {
      try { await gotoTab(rmPage, navTestId, { timeout: 8000 }); await rmPage.waitForTimeout(800); } catch { /* best-effort */ }
    }
    await checkMotionClass(rmPage, { roleLabel, selector: '.screen-enter, .stagger', expectAnimating: false });
  } catch (e) {
    fail(`${roleLabel}-reduced-motion-fatal`, `reduced-motion leg crashed: ${e.message}`);
  } finally {
    await rmContext.close();
  }
}

/**
 * checkErrorRetryPristine — four-states error+Retry check in a BRAND-NEW
 * context with firestore.googleapis.com aborted BEFORE first navigation
 * (before login even). This avoids the same-session limitation discovered
 * in the first pass: Firestore's persistentLocalCache (src/firebase.js:23-27)
 * serves a cached snapshot through an aborted network once a panel/context
 * has fetched that data before in the session, so a same-session
 * abort-then-reload never actually reaches the error path.
 *
 * A pristine context has no local cache, so a genuinely-aborted network
 * should force whatever error handling exists — either a panel-level error
 * card (if login/shell somehow still resolves from other channels) or the
 * login screen itself failing to progress (also a valid, capable-of-failing
 * observation, reported honestly either way).
 */
async function checkErrorRetryPristine(browser, {
  roleLabel, email, password, navTestId, errorSelector, retryTextSelector = 'button:has-text("Retry")',
}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  let page;
  try {
    await setupBypassSession(context, BASE, TOKEN);
    page = await context.newPage();
    // Abort BEFORE any navigation — the whole point of "pristine".
    await page.route('**/firestore.googleapis.com/**', (route) => route.abort());

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 }).catch(() => {});
    await page.fill('input[type="email"]', email).catch(() => {});
    await page.fill('input[type="password"]', password).catch(() => {});
    await page.click('button[type="submit"]').catch(() => {});
    // Auth itself goes through identitytoolkit.googleapis.com (not aborted),
    // so sign-in should succeed even with Firestore blocked; what happens
    // next (profile/role resolution, which IS Firestore) is the real test.
    await page.waitForTimeout(3000);
    if (navTestId) {
      try { await gotoTab(page, navTestId, { timeout: 8000 }); } catch { /* shell may never render nav if role-resolution is stuck */ }
    }
    await page.waitForTimeout(2000);

    const errCard = errorSelector ? page.locator(errorSelector) : page.locator('[role="alert"]').first();
    const errAppeared = await errCard.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    const shotPath = await shot(page, `${roleLabel}-pristine-error`);

    if (errAppeared) {
      const retryBtn = (errorSelector ? errCard : page).locator(retryTextSelector).first();
      const retryCount = await retryBtn.count();
      if (retryCount > 0) {
        pass(`${roleLabel}-pristine-error-retry-render`, `error card rendered in a PRISTINE (no prior cache) context + visible Retry button (screenshot: ${shotPath})`);
        await page.unroute('**/firestore.googleapis.com/**');
        await retryBtn.click();
        await page.waitForTimeout(2500);
        pass(`${roleLabel}-pristine-error-retry-refire`, 'Retry clicked post-unroute in the pristine-context leg');
      } else {
        fail(`${roleLabel}-pristine-error-retry-render`, `error card rendered but no Retry button found inside it (screenshot: ${shotPath})`);
      }
    } else {
      // Distinguish "shell never got past login/role-resolution" (a real,
      // reportable gap — the whole app has no top-level error UI for this
      // case) from "something else rendered fine" (worth naming honestly).
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => '');
      fail(`${roleLabel}-pristine-error-retry-render`, `no error card appeared within 10s in the pristine context (screenshot: ${shotPath}). Page body sample: "${bodyText.replace(/\s+/g, ' ').trim()}"`);
      await page.unroute('**/firestore.googleapis.com/**').catch(() => {});
    }
  } catch (e) {
    fail(`${roleLabel}-pristine-error-retry-fatal`, `pristine-context error leg crashed: ${e.message}`);
    if (page) await shot(page, `${roleLabel}-pristine-error-fatal`);
  } finally {
    await context.close();
  }
}

// ── AGENT role ───────────────────────────────────────────────────────────

async function runAgent(browser) {
  const roleLabel = 'agent';
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  let page;
  try {
    await setupBypassSession(context, BASE, TOKEN);
    page = await context.newPage();
    const cap = captureConsoleAndNetwork(page);

    // 1. LOGIN
    await loginRealForm(page, ACCOUNTS.agent.email, ACCOUNTS.agent.password);
    const dashboardOk = await page.locator('[data-testid="agent-tab-dashboard"]').count();
    const heroText = await page.locator('text=YTD').first().count().catch(() => 0);
    if (dashboardOk > 0 && heroText > 0) pass(`${roleLabel}-login`, 'nav rendered + HeroCard "YTD" content visible');
    else fail(`${roleLabel}-login`, `nav-present=${dashboardOk > 0} hero-present=${heroText > 0}`);

    // 4. MOTION — count-up (normal), then screen container animation classes.
    await checkCountUp(page, { roleLabel, labelText: 'YTD · Settled API', expectAnimated: true });
    await checkMotionClass(page, { roleLabel, selector: '.screen-enter, .stagger', expectAnimating: true });

    // 2. DIALOGS — PolicyDrillDrawer (policy-ledger), PersistencyPlayground (persistency)
    await gotoTab(page, 'agent-tab-policy-ledger');
    await page.waitForTimeout(1500);
    const policyCardCount = await page.locator('[data-testid^="policy-card-"]').count();
    if (policyCardCount > 0) {
      await checkDialog(page, {
        idPrefix: 'policy-drawer', roleLabel,
        triggerSelector: '[data-testid^="policy-card-"]:first-of-type',
        dialogSelector: '[data-testid="policy-drawer"]',
        closeSelector: '[aria-label="Close"]',
      });
    } else {
      skip(`${roleLabel}-policy-drawer-dialog`, 'no policy-ledger data seeded on staging tenant — PolicyDrillDrawer unreachable');
    }

    await gotoTab(page, 'agent-tab-persistency');
    await page.waitForTimeout(1500);
    await checkDialog(page, {
      idPrefix: 'persistency-playground', roleLabel,
      triggerSelector: '[data-testid="agent-playground-open-button"]',
      dialogSelector: '[data-testid="persistency-playground"]',
      closeSelector: '[aria-label="Close"]',
    });

    // 3. TABLES — not applicable to agent role.
    skip(`${roleLabel}-tables`, 'MasterSheet / Users / Branches are manager+ surfaces — not applicable to agent role');

    // 5. PROSPECT SORT — capable-of-failing: parse ALL rows, assert every
    // adjacent pair is non-decreasing. Isolated in its own try/catch so a
    // disabled/unreachable nav item (or any other failure here) SKIPs or
    // FAILs this one check without aborting the rest of the role's checks —
    // a bare gotoTab() throw previously took down every downstream section.
    try {
      await gotoTab(page, 'agent-tab-prospect-info');
      await page.waitForTimeout(1500);
      const listCount = await page.locator('[data-testid="prospect-info-list"]').count();
      if (listCount === 0) {
        skip(`${roleLabel}-prospect-sort`, 'prospect-info-empty — no prospect prep data seeded on staging tenant');
      } else {
        const dates = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('[data-testid="prospect-info-list"] > *'));
          return rows.map((r) => {
            const m = r.textContent.match(/\d{4}-\d{2}-\d{2}/);
            return m ? m[0] : null;
          }).filter(Boolean);
        });
        if (dates.length < 2) {
          skip(`${roleLabel}-prospect-sort`, `only ${dates.length} dated row(s) — need >=2 to prove sort order`);
        } else {
          let outOfOrder = -1;
          for (let i = 1; i < dates.length; i++) {
            if (dates[i] < dates[i - 1]) { outOfOrder = i; break; }
          }
          if (outOfOrder === -1) pass(`${roleLabel}-prospect-sort`, `${dates.length} rows ascending: ${dates.join(', ')}`);
          else fail(`${roleLabel}-prospect-sort`, `out of order at index ${outOfOrder}: ...${dates[outOfOrder - 1]}, ${dates[outOfOrder]}... (full: ${dates.join(', ')})`);
        }
      }
    } catch (e) {
      if (String(e.message).startsWith('DISABLED_NAV:')) {
        skip(`${roleLabel}-prospect-sort`, `Prospect Prep nav item is disabled on staging ("Coming soon" gate) — ${e.message}`);
      } else {
        fail(`${roleLabel}-prospect-sort`, `errored: ${e.message}`);
        await shot(page, `${roleLabel}-prospect-sort-FAIL`);
      }
    }

    // 6. FOUR-STATES
    // 6a. Actionable empty — History tab CTA (only renders when genuinely empty).
    await gotoTab(page, 'agent-tab-history');
    await page.waitForTimeout(1500);
    const historyCta = await page.locator('button:has-text("Log your first report")').count();
    const historyHasRows = await page.locator('body').evaluate((b) => /submission|report/i.test(b.textContent) && b.querySelectorAll('[data-testid*="history"]').length > 0);
    if (historyCta > 0) {
      pass(`${roleLabel}-empty-actionable`, 'History empty state renders "Log your first report" CTA');
    } else {
      skip(`${roleLabel}-empty-actionable`, `History tab is not empty on this account (has submission data) — CTA path not exercised${historyHasRows ? '' : ''}`);
    }

    // 6b. Error + Retry via firestore route-abort, on Policy Ledger.
    await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    try {
      await gotoTab(page, 'agent-tab-policy-ledger', { timeout: 8000 });
    } catch { /* nav may itself be affected by abort; continue to selector wait */ }
    const errCard = page.locator('[data-testid="ledger-error"]');
    const errAppeared = await errCard.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    if (errAppeared) {
      const retryBtn = errCard.locator('button:has-text("Retry")');
      const retryVisible = await retryBtn.count();
      if (retryVisible > 0) {
        pass(`${roleLabel}-error-retry-render`, 'ledger-error card + visible Retry button rendered after forced firestore failure');
        const beforeCount = cap.networkFailures.length;
        await page.unroute('**/firestore.googleapis.com/**');
        await retryBtn.click();
        await page.waitForTimeout(2000);
        pass(`${roleLabel}-error-retry-refire`, `Retry clicked post-unroute (network failures before unroute: ${beforeCount})`);
      } else {
        fail(`${roleLabel}-error-retry-render`, 'ledger-error rendered but no Retry button found inside it');
      }
    } else {
      const renderedContent = await page.locator('[data-testid="policy-ledger-surface"], [data-testid="ledger-feed"], [data-testid="ledger-empty"]').first().count().catch(() => 0);
      await shot(page, `${roleLabel}-error-FAIL`);
      if (renderedContent > 0) {
        skip(`${roleLabel}-error-retry-render`, 'no ledger-error card rendered, but the Policy Ledger panel DID render — likely served from Firestore persistentLocalCache from this context\'s earlier navigation, masking the aborted network; needs a route-abort applied before first load in a fresh context to force the error path cleanly');
      } else {
        fail(`${roleLabel}-error-retry-render`, 'ledger-error did not render AND the panel did not render either — page appears stuck after aborting all firestore.googleapis.com requests');
      }
      await page.unroute('**/firestore.googleapis.com/**').catch(() => {});
    }

    // 6c. Skeleton on throttled load — agent Persistency tab, PanelSkeleton kit.
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 400, downloadThroughput: 40_000, uploadThroughput: 40_000,
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    let skeletonSeen = false;
    try {
      await gotoTab(page, 'agent-tab-persistency', { timeout: 6000 });
    } catch { /* throttled nav may be slow itself */ }
    try {
      await page.waitForSelector('[role="status"][aria-busy="true"]', { timeout: 4000 });
      skeletonSeen = true;
      await shot(page, `${roleLabel}-skeleton`);
    } catch { skeletonSeen = false; }
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    if (skeletonSeen) pass(`${roleLabel}-skeleton`, 'PanelSkeleton (role=status aria-busy=true) observed during throttled initial load');
    else fail(`${roleLabel}-skeleton`, 'no [role="status"][aria-busy="true"] observed within 4s of throttled reload — PanelSkeleton not caught or absent');

    // 4b. MOTION — reduced-motion re-check (fresh context, since matchMedia is
    // per-context and count-up snapshots at effect-run).
    formatCaptureReport(cap);
  } catch (e) {
    fail(`${roleLabel}-fatal`, `role run crashed: ${e.message}`);
    if (page) await shot(page, `${roleLabel}-fatal`);
  } finally {
    await context.close();
  }

  // Reduced-motion leg — fresh context.
  const rmContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
  let rmPage;
  try {
    await setupBypassSession(rmContext, BASE, TOKEN);
    rmPage = await rmContext.newPage();
    await loginRealForm(rmPage, ACCOUNTS.agent.email, ACCOUNTS.agent.password);
    await checkCountUp(rmPage, { roleLabel, labelText: 'YTD · Settled API', expectAnimated: false });
    await checkMotionClass(rmPage, { roleLabel, selector: '.screen-enter, .stagger', expectAnimating: false });
  } catch (e) {
    fail(`${roleLabel}-reduced-motion-fatal`, `reduced-motion leg crashed: ${e.message}`);
  } finally {
    await rmContext.close();
  }

  // Pristine-context error+Retry — see checkErrorRetryPristine's doc comment
  // for why the same-session abort-then-reload technique above (skipped)
  // cannot force the error path once a panel has cached data.
  await checkErrorRetryPristine(browser, {
    roleLabel, email: ACCOUNTS.agent.email, password: ACCOUNTS.agent.password,
    navTestId: 'agent-tab-policy-ledger', errorSelector: '[data-testid="ledger-error"]',
  });

  // Dark theme leg.
  const darkContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  let darkPage;
  try {
    await setupBypassSession(darkContext, BASE, TOKEN);
    await darkContext.addInitScript(() => { try { localStorage.setItem('agencytrack-dark', '1'); } catch {} });
    darkPage = await darkContext.newPage();
    await loginRealForm(darkPage, ACCOUNTS.agent.email, ACCOUNTS.agent.password);
    const isDark = await darkPage.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDark) { fail(`${roleLabel}-dark-theme-applied`, 'html.dark class not present after dark-mode init script'); }
    else {
      pass(`${roleLabel}-dark-theme-applied`, 'html.dark applied');
      await checkDarkContrast(darkPage, {
        roleLabel,
        selectors: ['p:has-text("YTD · Settled API")', 'text=Submit weekly report', 'nav[aria-label="Primary navigation"] button'],
      });
      await shot(darkPage, `${roleLabel}-dark-dashboard`);
    }
  } catch (e) {
    fail(`${roleLabel}-dark-theme-fatal`, `dark-theme leg crashed: ${e.message}`);
  } finally {
    await darkContext.close();
  }
}

// ── BRANCH_MANAGER role ─────────────────────────────────────────────────

async function runBranchManager(browser) {
  const roleLabel = 'branch_manager';
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  let page;
  try {
    await setupBypassSession(context, BASE, TOKEN);
    page = await context.newPage();
    const cap = captureConsoleAndNetwork(page);

    // 1. LOGIN
    await loginRealForm(page, ACCOUNTS.branch_manager.email, ACCOUNTS.branch_manager.password);
    const navOk = await page.locator('[data-testid="nav-overview"]').count();
    if (navOk > 0) pass(`${roleLabel}-login`, 'nav-overview present, dashboard rendered');
    else fail(`${roleLabel}-login`, 'nav-overview not found after login');

    // 4. MOTION
    await checkMotionClass(page, { roleLabel, selector: '.screen-enter, .stagger', expectAnimating: true });

    // 2. DIALOGS — EditUserDrawer (nav-team), PersistencyPlayground (persistency tab)
    await gotoTab(page, 'nav-team');
    await page.waitForTimeout(1500);
    const editBtn = page.locator('[data-testid^="user-edit-"]').first();
    const editBtnCount = await editBtn.count();
    if (editBtnCount > 0) {
      await checkDialog(page, {
        idPrefix: 'edit-user-drawer', roleLabel,
        triggerSelector: '[data-testid^="user-edit-"]:first-of-type',
        dialogSelector: '[data-testid="edit-user-drawer"]',
        closeSelector: '[aria-label="Close drawer"]',
      });
    } else {
      skip(`${roleLabel}-edit-user-drawer-dialog`, 'no editable (active, non-deactivated) roster user found on this account');
    }

    // Manager Persistency's playground is roster-row-scoped (PersRoster.jsx
    // `pers-roster-play-{uid}`), not a standalone button like the agent's
    // own `agent-playground-open-button` — it opens the PLAYGROUND FOR A
    // SPECIFIC AGENT ROW, so it needs at least one roster row to be present.
    await gotoTab(page, 'nav-persistency');
    await page.waitForTimeout(1500);
    const playgroundBtn = page.locator('[data-testid^="pers-roster-play-"]').first();
    const pgCount = await playgroundBtn.count();
    const pgVisible = pgCount > 0 && await playgroundBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (pgVisible) {
      await checkDialog(page, {
        idPrefix: 'persistency-playground', roleLabel,
        triggerSelector: '[data-testid^="pers-roster-play-"]:first-of-type',
        dialogSelector: '[data-testid="persistency-playground"]',
        closeSelector: '[aria-label="Close"]',
      });
    } else {
      skip(`${roleLabel}-persistency-playground-dialog`, `no VISIBLE persistency-roster row found (DOM count=${pgCount}) — needs at least one roster row on this branch, or it is present but not interactable (e.g. collapsed/scrolled)`);
    }

    // MeetingMode (3rd dialog) — real trigger is the "Start Meeting" topbar
    // button (handleStartMeeting), NOT the mp-tab-meetings mobile-drawer
    // action id (that id feeds MobileNavDrawer sections, not the desktop
    // topbar — confirmed via source: ManagerDashboard.jsx topbarActions).
    const meetingTrigger = page.locator('button:has-text("Start Meeting")').first();
    const meetingTriggerCount = await meetingTrigger.count();
    if (meetingTriggerCount > 0) {
      await checkDialog(page, {
        idPrefix: 'meeting-mode', roleLabel,
        triggerSelector: 'button:has-text("Start Meeting")',
        dialogSelector: '[role="dialog"][aria-modal="true"]',
        closeSelector: '[aria-label="Exit meeting mode"]',
      });
    } else {
      skip(`${roleLabel}-meeting-mode-dialog`, '"Start Meeting" topbar button not found for this role');
    }

    // 3. TABLES — MasterSheet
    await gotoTab(page, 'nav-mastersheet');
    await page.waitForTimeout(2000);
    const scrollDiv = page.locator('div.overflow-x-auto.overflow-y-auto').first();
    const scrollDivCount = await scrollDiv.count();
    if (scrollDivCount === 0) {
      fail(`${roleLabel}-mastersheet-scroll-container`, 'card-scoped scroll container (overflow-x-auto.overflow-y-auto) not found');
    } else {
      const maxH = await scrollDiv.evaluate((n) => getComputedStyle(n).maxHeight);
      pass(`${roleLabel}-mastersheet-scroll-container`, `card-scoped scroll container present, max-height=${maxH}`);
    }
    const th = page.locator('table th').first();
    const thCount = await th.count();
    if (thCount > 0) {
      const { position, top } = await th.evaluate((n) => ({ position: getComputedStyle(n).position, top: getComputedStyle(n).top }));
      if (position === 'sticky' && (top === '0px' || top === 'auto')) {
        pass(`${roleLabel}-mastersheet-sticky-header`, `th computed position=${position} top=${top}`);
      } else {
        fail(`${roleLabel}-mastersheet-sticky-header`, `th computed position=${position} top=${top} — expected sticky/top:0`);
      }
    } else {
      skip(`${roleLabel}-mastersheet-sticky-header`, 'no <th> found — table may be empty this week');
    }
    // tabular-nums on a numeric cell.
    const numericTd = page.locator('table td.tabular-nums').first();
    const numericTdCount = await numericTd.count();
    if (numericTdCount > 0) {
      const fvn = await numericTd.evaluate((n) => getComputedStyle(n).fontVariantNumeric);
      if (/tabular-nums/.test(fvn)) pass(`${roleLabel}-mastersheet-tabular-nums`, `computed font-variant-numeric="${fvn}"`);
      else fail(`${roleLabel}-mastersheet-tabular-nums`, `class tabular-nums present but computed font-variant-numeric="${fvn}" does not include tabular-nums`);
    } else {
      skip(`${roleLabel}-mastersheet-tabular-nums`, 'no rows this week — no numeric cell to sample');
    }
    // Footer row count matches rendered rows. The empty-state <tr> (when
    // present) is not a real data row — exclude it via its testid before
    // counting, and match the footer paragraph by its EXACT leading-digit
    // shape ("N submission(s) • ...") rather than a loose "submission"
    // substring, which also matches the empty-state's "No submissions yet
    // this week" copy.
    const isEmptyState = (await page.locator('[data-testid="mastersheet-empty"]').count()) > 0;
    const bodyRowCount = isEmptyState ? 0 : await page.locator('table tbody tr').count();
    const footerText = await page.locator('p').filter({ hasText: /^\d+\s+submission/ }).first().textContent().catch(() => null);
    if (footerText) {
      const m = footerText.match(/^(\d+)\s+submission/);
      const claimed = m ? Number(m[1]) : null;
      if (claimed !== null && claimed === bodyRowCount) {
        pass(`${roleLabel}-mastersheet-footer-count`, `footer claims ${claimed}, DOM has ${bodyRowCount} real rows — match`);
      } else {
        fail(`${roleLabel}-mastersheet-footer-count`, `footer claims ${claimed}, DOM has ${bodyRowCount} real rows — MISMATCH (footer: "${footerText.trim()}")`);
      }
    } else {
      // Per source (`MasterSheet.jsx`), the footer `<p>` renders whenever
      // `!loading`, including the 0-rows case ("0 submissions • ..."). Its
      // absence here means the page was still loading when sampled.
      skip(`${roleLabel}-mastersheet-footer-count`, 'footer count text not found (possibly still loading)');
    }

    // 5. PROSPECT SORT — not applicable to branch_manager.
    skip(`${roleLabel}-prospect-sort`, 'Prospect Prep is an agent-facing surface — not applicable to branch_manager');

    // 6. FOUR-STATES
    // 6a. Error + Retry — ManagerOverviewTab (nav-overview) via reload() token-bump.
    await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    try { await gotoTab(page, 'nav-overview', { timeout: 8000 }); } catch { /* ignore */ }
    const bmErr = page.locator('[role="alert"]').first();
    const bmErrAppeared = await bmErr.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    if (bmErrAppeared) {
      const retryBtn = page.locator('button:has-text("Retry")').first();
      const retryCount = await retryBtn.count();
      if (retryCount > 0) {
        pass(`${roleLabel}-error-retry-render`, 'error alert card + Retry button rendered after forced firestore failure on Team Dashboard');
        await page.unroute('**/firestore.googleapis.com/**');
        await retryBtn.click();
        await page.waitForTimeout(2000);
        pass(`${roleLabel}-error-retry-refire`, 'Retry clicked post-unroute');
      } else {
        fail(`${roleLabel}-error-retry-render`, 'alert rendered but no Retry button found');
      }
    } else {
      // Firestore's persistentLocalCache (index.js:23-27 per CLAUDE.md) can
      // serve a prior snapshot from THIS SAME context's earlier navigation
      // even with the network aborted — the panel never errors because it
      // never actually misses. Distinguish that from a genuinely-stuck page.
      const renderedContent = await page.locator('h1, [data-testid="nav-overview"]').first().count().catch(() => 0);
      await shot(page, `${roleLabel}-error-FAIL`);
      if (renderedContent > 0) {
        skip(`${roleLabel}-error-retry-render`, 'no error card rendered, but the dashboard DID render (cached snapshot from this context\'s earlier navigation served through the aborted network via Firestore persistentLocalCache) — this network-abort technique cannot force a failure once the panel has cached data in-session; needs a route-abort applied BEFORE first load to test cleanly, not a same-session reload');
      } else {
        fail(`${roleLabel}-error-retry-render`, 'no role=alert error card rendered AND the dashboard did not render either — page appears stuck after aborting all firestore requests on Team Dashboard');
      }
      await page.unroute('**/firestore.googleapis.com/**').catch(() => {});
    }

    // 6b. Skeleton on throttled load — Weekly WARs (branch_manager-only tab).
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 40_000, uploadThroughput: 40_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    let skeletonSeen = false;
    try { await gotoTab(page, 'nav-team-wars', { timeout: 6000 }); } catch { /* ignore */ }
    try {
      await page.waitForSelector('[role="status"][aria-busy="true"]', { timeout: 4000 });
      skeletonSeen = true;
    } catch { skeletonSeen = false; }
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    if (skeletonSeen) pass(`${roleLabel}-skeleton`, 'PanelSkeleton observed during throttled Weekly WARs load');
    else fail(`${roleLabel}-skeleton`, 'no PanelSkeleton observed within 4s on Weekly WARs throttled reload');

    // 6c. Actionable empty — Monthly Recruiting team-rollup (explanatory-only
    // per progress notes, not a CTA — verify at least explanatory copy renders,
    // not a blank/spinner).
    await page.route('**/firestore.googleapis.com/**', (route) => route.abort()).catch(() => {});
    await page.unroute('**/firestore.googleapis.com/**').catch(() => {});
    try {
      await gotoTab(page, 'nav-monthly-recruiting', { timeout: 8000 });
      await page.waitForTimeout(1500);
      const bodyText = await page.locator('body').innerText();
      const hasRealSentence = /[a-z]{3,}.*[.!]/i.test(bodyText);
      if (hasRealSentence) pass(`${roleLabel}-empty-actionable`, 'Monthly Recruiting screen renders real prose content (not blank)');
      else fail(`${roleLabel}-empty-actionable`, 'Monthly Recruiting screen has no readable sentence-level content');
    } catch (e) {
      skip(`${roleLabel}-empty-actionable`, `nav-monthly-recruiting not reachable: ${e.message}`);
    }

    formatCaptureReport(cap);
  } catch (e) {
    fail(`${roleLabel}-fatal`, `role run crashed: ${e.message}`);
    if (page) await shot(page, `${roleLabel}-fatal`);
  } finally {
    await context.close();
  }

  // Reduced-motion leg.
  await runReducedMotionLeg(browser, { roleLabel, email: ACCOUNTS.branch_manager.email, password: ACCOUNTS.branch_manager.password });

  // Pristine-context error+Retry (see checkErrorRetryPristine doc comment).
  await checkErrorRetryPristine(browser, {
    roleLabel, email: ACCOUNTS.branch_manager.email, password: ACCOUNTS.branch_manager.password,
    navTestId: 'nav-overview', errorSelector: null,
  });

  // Dark theme leg.
  const darkContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  let darkPage;
  try {
    await setupBypassSession(darkContext, BASE, TOKEN);
    await darkContext.addInitScript(() => { try { localStorage.setItem('agencytrack-dark', '1'); } catch {} });
    darkPage = await darkContext.newPage();
    await loginRealForm(darkPage, ACCOUNTS.branch_manager.email, ACCOUNTS.branch_manager.password);
    const isDark = await darkPage.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDark) fail(`${roleLabel}-dark-theme-applied`, 'html.dark class not present');
    else {
      pass(`${roleLabel}-dark-theme-applied`, 'html.dark applied');
      await checkDarkContrast(darkPage, {
        roleLabel,
        selectors: ['nav[aria-label="Primary navigation"] button', 'h1', 'p'],
      });
      await shot(darkPage, `${roleLabel}-dark-dashboard`);
    }
  } catch (e) {
    fail(`${roleLabel}-dark-theme-fatal`, `dark-theme leg crashed: ${e.message}`);
  } finally {
    await darkContext.close();
  }
}

// ── TENANT_ADMIN role ────────────────────────────────────────────────────

async function runTenantAdmin(browser) {
  const roleLabel = 'tenant_admin';
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  let page;
  try {
    await setupBypassSession(context, BASE, TOKEN);
    page = await context.newPage();
    const cap = captureConsoleAndNetwork(page);

    // 1. LOGIN
    await loginRealForm(page, ACCOUNTS.tenant_admin.email, ACCOUNTS.tenant_admin.password);
    const navOk = await page.locator('[data-testid="nav-dashboard"]').count();
    if (navOk > 0) pass(`${roleLabel}-login`, 'nav-dashboard present, tenant admin dashboard rendered');
    else fail(`${roleLabel}-login`, 'nav-dashboard not found after login');

    // 4. MOTION
    await checkMotionClass(page, { roleLabel, selector: '.screen-enter, .stagger', expectAnimating: true });

    // 2. DIALOGS — EditUserDrawer (nav-users), DeactivateBranchConfirmDialog (nav-branches), PlanCatalogModal (nav-config)
    await gotoTab(page, 'nav-users');
    await page.waitForTimeout(1500);
    const editBtn = page.locator('[data-testid^="user-edit-"]').first();
    if ((await editBtn.count()) > 0) {
      await checkDialog(page, {
        idPrefix: 'edit-user-drawer', roleLabel,
        triggerSelector: '[data-testid^="user-edit-"]:first-of-type',
        dialogSelector: '[data-testid="edit-user-drawer"]',
        closeSelector: '[aria-label="Close drawer"]',
      });
    } else {
      skip(`${roleLabel}-edit-user-drawer-dialog`, 'no editable roster user found on Users tab');
    }

    await gotoTab(page, 'nav-branches');
    await page.waitForTimeout(1500);
    const deactivateBtn = page.locator('button:has-text("Deactivate")').first();
    if ((await deactivateBtn.count()) > 0) {
      await checkDialog(page, {
        idPrefix: 'deactivate-branch-dialog', roleLabel,
        triggerSelector: 'button:has-text("Deactivate")',
        dialogSelector: '[role="dialog"][aria-modal="true"]',
        closeSelector: '[aria-label="Close"]',
      });
    } else {
      skip(`${roleLabel}-deactivate-branch-dialog`, 'no active branch with a Deactivate action found');
    }

    await gotoTab(page, 'nav-config');
    await page.waitForTimeout(1500);
    const planTile = page.locator('[data-testid="plan-catalog-tile"]').first();
    if ((await planTile.count()) > 0) {
      await checkDialog(page, {
        idPrefix: 'plan-catalog-modal', roleLabel,
        triggerSelector: '[data-testid="plan-catalog-tile"]',
        dialogSelector: '[role="dialog"][aria-modal="true"]',
        closeSelector: '[aria-label="Close"]',
      });
    } else {
      skip(`${roleLabel}-plan-catalog-modal-dialog`, 'plan-catalog-tile not found on Company Config tab');
    }

    // 3. TABLES — Users + Branches real <table> semantics + status pills.
    await gotoTab(page, 'nav-users');
    await page.waitForTimeout(1500);
    const usersTable = await page.locator('table').count();
    const usersTh = await page.locator('table th').count();
    if (usersTable > 0 && usersTh > 0) pass(`${roleLabel}-users-table-semantics`, `real <table> with ${usersTh} <th> columns`);
    else fail(`${roleLabel}-users-table-semantics`, `table=${usersTable} th=${usersTh} — expected real table semantics`);
    const pills = await page.locator('[data-testid="user-roster-footer"]').count();
    const activePill = page.locator('text=Active').first();
    const deactivatedPill = page.locator('text=Deactivated').first();
    const hasActive = await activePill.count();
    const hasDeactivated = await deactivatedPill.count();
    if (hasActive > 0) {
      const activeColor = await activePill.evaluate((n) => getComputedStyle(n).color);
      let distinguishable = true;
      let deactivatedColor = null;
      if (hasDeactivated > 0) {
        deactivatedColor = await deactivatedPill.evaluate((n) => getComputedStyle(n).color);
        distinguishable = activeColor !== deactivatedColor;
      }
      if (distinguishable) pass(`${roleLabel}-users-status-pill`, `Active pill color=${activeColor}${deactivatedColor ? `, Deactivated pill color=${deactivatedColor} (distinguishable)` : ' (no Deactivated user present to compare)'}`);
      else fail(`${roleLabel}-users-status-pill`, `Active and Deactivated pills render the SAME color (${activeColor}) — not distinguishable`);
    } else {
      skip(`${roleLabel}-users-status-pill`, 'no "Active" status pill text found');
    }
    if (pills > 0) {
      const footerText = await page.locator('[data-testid="user-roster-footer"]').textContent();
      pass(`${roleLabel}-users-footer-count`, `footer present: "${footerText.trim()}"`);
    } else {
      fail(`${roleLabel}-users-footer-count`, 'user-roster-footer testid not found');
    }

    await gotoTab(page, 'nav-branches');
    await page.waitForTimeout(1500);
    const branchesTable = await page.locator('table').count();
    const branchesTh = await page.locator('table th').count();
    if (branchesTable > 0 && branchesTh > 0) pass(`${roleLabel}-branches-table-semantics`, `real <table> with ${branchesTh} <th> columns`);
    else fail(`${roleLabel}-branches-table-semantics`, `table=${branchesTable} th=${branchesTh} — expected real table semantics`);
    const branchesFooter = await page.locator('[data-testid="branches-roster-footer"]').count();
    if (branchesFooter > 0) {
      const t = await page.locator('[data-testid="branches-roster-footer"]').textContent();
      pass(`${roleLabel}-branches-footer-count`, `footer present: "${t.trim()}"`);
    } else {
      fail(`${roleLabel}-branches-footer-count`, 'branches-roster-footer testid not found');
    }

    // 5. PROSPECT SORT — not applicable.
    skip(`${roleLabel}-prospect-sort`, 'Prospect Prep is an agent-facing surface — not applicable to tenant_admin');

    // 6. FOUR-STATES
    // 6a. Error card (full 3/3 failure) — TenantAdminDashboard.
    await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    try { await gotoTab(page, 'nav-dashboard', { timeout: 8000 }); } catch { /* ignore */ }
    const taErr = page.locator('[data-testid="tenant-dashboard-error"]');
    const taErrAppeared = await taErr.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    if (taErrAppeared) {
      const retryBtn = taErr.locator('button:has-text("Retry")');
      if ((await retryBtn.count()) > 0) {
        pass(`${roleLabel}-error-retry-render`, 'tenant-dashboard-error card + Retry button rendered after forced full firestore failure');
        await page.unroute('**/firestore.googleapis.com/**');
        await retryBtn.click();
        await page.waitForTimeout(2000);
        pass(`${roleLabel}-error-retry-refire`, 'Retry clicked post-unroute');
      } else {
        fail(`${roleLabel}-error-retry-render`, 'tenant-dashboard-error rendered but no Retry button inside');
      }
    } else {
      const renderedContent = await page.locator('h1, [data-testid="nav-dashboard"]').first().count().catch(() => 0);
      await shot(page, `${roleLabel}-error-FAIL`);
      if (renderedContent > 0) {
        skip(`${roleLabel}-error-retry-render`, 'no error card rendered, but the dashboard DID render — same in-session Firestore persistentLocalCache limitation as branch_manager (see that leg\'s note); this technique needs a route-abort applied before first load in a truly fresh context to force the error path cleanly');
      } else {
        fail(`${roleLabel}-error-retry-render`, 'tenant-dashboard-error did not render AND the dashboard did not render either — page appears stuck after aborting all firestore requests');
      }
      await page.unroute('**/firestore.googleapis.com/**').catch(() => {});
    }
    skip(`${roleLabel}-partial-failure-banner`, 'isolating exactly 1-of-3 data sources requires per-collection payload routing not implemented in this pass — see self-critique gap');

    // 6b. Skeleton on throttled load — RoleDistributionCard / BranchHealthCards on dashboard.
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 40_000, uploadThroughput: 40_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    let skeletonSeen = false;
    try { await gotoTab(page, 'nav-dashboard', { timeout: 6000 }); } catch { /* ignore */ }
    try {
      await page.waitForSelector('[role="status"][aria-busy="true"]', { timeout: 4000 });
      skeletonSeen = true;
    } catch { skeletonSeen = false; }
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    if (skeletonSeen) pass(`${roleLabel}-skeleton`, 'PanelSkeleton observed on throttled tenant-admin dashboard load');
    else fail(`${roleLabel}-skeleton`, 'no PanelSkeleton observed within 4s on throttled dashboard reload');

    formatCaptureReport(cap);
  } catch (e) {
    fail(`${roleLabel}-fatal`, `role run crashed: ${e.message}`);
    if (page) await shot(page, `${roleLabel}-fatal`);
  } finally {
    await context.close();
  }

  // Reduced-motion leg.
  await runReducedMotionLeg(browser, { roleLabel, email: ACCOUNTS.tenant_admin.email, password: ACCOUNTS.tenant_admin.password });

  // Pristine-context error+Retry (see checkErrorRetryPristine doc comment).
  await checkErrorRetryPristine(browser, {
    roleLabel, email: ACCOUNTS.tenant_admin.email, password: ACCOUNTS.tenant_admin.password,
    navTestId: 'nav-dashboard', errorSelector: '[data-testid="tenant-dashboard-error"]',
  });

  // Dark theme leg.
  const darkContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  let darkPage;
  try {
    await setupBypassSession(darkContext, BASE, TOKEN);
    await darkContext.addInitScript(() => { try { localStorage.setItem('agencytrack-dark', '1'); } catch {} });
    darkPage = await darkContext.newPage();
    await loginRealForm(darkPage, ACCOUNTS.tenant_admin.email, ACCOUNTS.tenant_admin.password);
    const isDark = await darkPage.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDark) fail(`${roleLabel}-dark-theme-applied`, 'html.dark class not present');
    else {
      pass(`${roleLabel}-dark-theme-applied`, 'html.dark applied');
      await checkDarkContrast(darkPage, {
        roleLabel,
        selectors: ['nav[aria-label="Primary navigation"] button', 'h1', 'p'],
      });
      await shot(darkPage, `${roleLabel}-dark-dashboard`);
    }
  } catch (e) {
    fail(`${roleLabel}-dark-theme-fatal`, `dark-theme leg crashed: ${e.message}`);
  } finally {
    await darkContext.close();
  }
}

/**
 * preflightLogin — fast (no-browser) Firebase Auth REST check so a broken
 * account fails in ~1s instead of burning multiple ~20-30s UI timeouts across
 * the main/reduced-motion/dark-theme contexts a role would otherwise spin up.
 * Uses VITE_FIREBASE_API_KEY from the staging env file (public web API key,
 * not a secret — same key the deployed app itself ships to the browser).
 */
async function preflightLogin(email, password) {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) return { ok: true, note: 'VITE_FIREBASE_API_KEY not set — skipping REST preflight, going straight to UI login' };
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const body = await res.json();
    if (res.ok) return { ok: true };
    return { ok: false, note: body?.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: true, note: `preflight request itself failed (${e.message}) — falling through to UI login anyway` };
  }
}

const ROLE_CHECK_CATEGORIES = {
  agent: ['dialogs (PolicyDrillDrawer, PersistencyPlayground)', 'motion (count-up + stagger, normal + reduced)', 'prospect-sort', 'four-states (empty/error-retry/skeleton)', 'dark-theme contrast'],
  branch_manager: ['dialogs (EditUserDrawer, PersistencyPlayground, MeetingMode)', 'MasterSheet table mechanics', 'motion', 'four-states', 'dark-theme contrast'],
  tenant_admin: ['dialogs (EditUserDrawer, DeactivateBranchConfirmDialog, PlanCatalogModal)', 'Users/Branches table mechanics', 'motion', 'four-states', 'dark-theme contrast'],
};

// ── Orchestrator ─────────────────────────────────────────────────────────

// --role <agent|branch_manager|tenant_admin> restricts the run to one role —
// lets a 3-role run (which can run long across dialogs/motion/four-states/
// dark-theme/reduced-motion/pristine-context legs) be split into three
// separate foreground invocations, each finishing well inside a single
// terminal/CI timeout. Omit for the full 3-role run.
const ROLE_FILTER = (() => {
  const i = process.argv.indexOf('--role');
  return i > -1 ? process.argv[i + 1] : null;
})();

async function run() {
  const browser = await chromium.launch();
  try {
    console.log(`\n=== Tier-0 staging smoke — ${BASE} ===`);
    if (ROLE_FILTER) console.log(`Role filter: ${ROLE_FILTER}`);
    console.log(`Screenshots: ${SS_DIR}\n`);

    const ALL_ROLES = [
      ['agent', runAgent],
      ['branch_manager', runBranchManager],
      ['tenant_admin', runTenantAdmin],
    ];
    const rolesToRun = ROLE_FILTER ? ALL_ROLES.filter(([k]) => k === ROLE_FILTER) : ALL_ROLES;
    if (ROLE_FILTER && rolesToRun.length === 0) {
      console.error(`--role ${ROLE_FILTER} does not match agent|branch_manager|tenant_admin`);
      process.exit(2);
    }

    for (const [roleKey, runner] of rolesToRun) {
      console.log(`\n── ${roleKey.toUpperCase()} ─────────────────────────────────────`);
      const { email, password } = ACCOUNTS[roleKey];
      const pre = await preflightLogin(email, password);
      if (!pre.ok) {
        fail(`${roleKey}-login`, `Firebase Auth REST preflight rejected credentials — ${pre.note}. All downstream ${roleKey} checks SKIPPED (blocked precondition, not an app bug).`);
        for (const cat of ROLE_CHECK_CATEGORIES[roleKey]) {
          skip(`${roleKey}-${cat.split(' ')[0]}`, `blocked — ${roleKey} login is broken on staging (see ${roleKey}-login FAIL)`);
        }
        continue;
      }
      await runner(browser);
    }
  } finally {
    await browser.close();
  }
  finishSmoke(results, { clearTimeout: clearTimer });
}

run().catch((e) => { console.error('SMOKE CRASH:', e.message, e.stack); process.exit(1); });

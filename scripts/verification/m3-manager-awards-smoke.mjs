/**
 * M3 — Manager Awards medal smoke walk.
 *
 * Verifies the Manager Awards revamp:
 *   - All 3 tabs (Annual, Activity, Recruiting) render at desktop + mobile
 *     in both light and dark mode.
 *   - Medal coins use the shared `.badge-medal` primitive (no legacy hex
 *     colors `#f59e0b` / `#94a3b8` / `#b45309` in any inline style).
 *   - Regression: manager Overview (M2), Goals, Persistency still render.
 *   - Regression: agent dashboard and BadgeGrid still render.
 *
 * Bypass: uses the WALK-3 setupBypassSession pattern. The token appears in
 * exactly ONE URL inside the helper's sanitizing try/catch. After session
 * setup all navigation uses bare URLs — no token in any URL, anywhere.
 *
 * Run from this worktree:
 *   node scripts/verification/m3-manager-awards-smoke.mjs
 *
 * Override preview host:
 *   PREVIEW_HOST=agencytrack-git-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/m3-manager-awards-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_SALES_MANAGER_EMAIL / A11Y_SALES_MANAGER_PASSWORD
 *   A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD
 *
 * Artifacts: verification/m3/screenshots/ (gitignored).
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/m3');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const SM_EMAIL     = env.A11Y_SALES_MANAGER_EMAIL;
const SM_PASSWORD  = env.A11Y_SALES_MANAGER_PASSWORD;
const AG_EMAIL     = env.A11Y_AGENT_EMAIL;
const AG_PASSWORD  = env.A11Y_AGENT_PASSWORD;

// NOTE: the long `agencytrack-git-feat-m3-manager-awards-medals-...` alias
// exceeds DNS label limits and is not minted by Vercel for this branch. The
// deployment-specific hash URL below is what Vercel actually emits — verified
// via `gh api repos/.../deployments/<id>/statuses`. Override via PREVIEW_HOST
// env var if Vercel re-deploys with a new hash.
const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-49bhnc65k-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)              { console.error('VERCEL_BYPASS_TOKEN not present in .env.local'); process.exit(1); }
if (!SM_EMAIL || !SM_PASSWORD)  { console.error('A11Y_SALES_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }
if (!AG_EMAIL || !AG_PASSWORD)  { console.error('A11Y_AGENT_EMAIL/PASSWORD not present');         process.exit(1); }

// Defense-in-depth: redact any token-shaped substring + the actual password
// from anything we might log. The setupBypassSession helper already sanitizes
// its own error messages, but we also handle errors from login flow / page
// interactions here.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  if (BYPASS_TOKEN) {
    out = out.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  }
  if (SM_PASSWORD) out = out.replace(new RegExp(SM_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  if (AG_PASSWORD) out = out.replace(new RegExp(AG_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const results = {};

async function check(id, label, fn) {
  try {
    await fn();
    results[id] = { label, pass: true };
    console.log(`PASS ${id}: ${label}`);
  } catch (e) {
    const msg = redact(e.message ?? String(e));
    results[id] = { label, pass: false, error: msg };
    console.error(`FAIL ${id}: ${label}\n  ${msg}`);
  }
}

async function ss(page, name) {
  await page.screenshot({ path: resolve(SS_DIR, `${name}.png`), fullPage: false });
}

async function signIn(pg, email, password) {
  await pg.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForFirebaseReady(pg, 25000);
  const emailInput = pg.locator('input[type="email"]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(email);
  const pwInput = pg.locator('input[type="password"]');
  await pwInput.fill(password);
  await pwInput.press('Enter');
  await pg.waitForSelector('input[type="email"]', { state: 'detached', timeout: 25000 });
  await pg.waitForSelector('nav[aria-label="Primary navigation"], [data-testid="mobile-bottom-nav"]', { timeout: 15000 });
}

// Label-based nav clicker that handles both desktop sidebar and mobile bottom-
// nav + "More" drawer. The desktop sidebar buttons carry `data-testid="nav-<id>"`
// but the MobileNavDrawer items don't, so we route by visible label.
//
// `bottomLabel` (optional): used when the item appears in BOTTOM_NAV with a
// different label than NAV_ITEMS (e.g., NAV_ITEMS "Overview" → BOTTOM_NAV
// "Dashboard"; NAV_ITEMS "Master Sheet" → BOTTOM_NAV "Reports").
async function clickManagerNavTab(pg, label, bottomLabel = null) {
  const isMobile = (await pg.viewportSize())?.width < 900;
  if (isMobile) {
    // Items in BOTTOM_NAV: Dashboard (Overview), Team, Reports (Master Sheet),
    // Campaigns, Profile. All other items live behind the "More" drawer.
    const inBottom = bottomLabel
      ? await pg.locator(`[data-testid^="bottomnav-"]:has-text("${bottomLabel}")`).count() > 0
      : false;
    if (inBottom) {
      await pg.locator(`[data-testid^="bottomnav-"]:has-text("${bottomLabel}")`).first().click();
      await pg.waitForTimeout(700);
      return;
    }
    // Open the "More" drawer and click the matching item.
    const more = pg.locator('[data-testid="bottomnav-more"]');
    await more.waitFor({ timeout: 10000 });
    await more.click();
    const drawer = pg.locator('nav[aria-label="More navigation options"]');
    await drawer.waitFor({ timeout: 5000 });
    await drawer.locator(`button:has-text("${label}")`).first().click();
    await pg.waitForTimeout(800);
    return;
  }
  // Desktop sidebar
  const sidebarBtn = pg
    .locator('nav[aria-label="Primary navigation"] button')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .first();
  await sidebarBtn.waitFor({ timeout: 10000 });
  await sidebarBtn.click();
  await pg.waitForTimeout(800);
}

async function clickAwardsTabPill(pg, label) {
  const tab = pg.locator(`[role="tab"]:has-text("${label}")`).first();
  await tab.waitFor({ timeout: 8000 });
  await tab.click();
  await pg.waitForTimeout(500);
}

async function setDarkMode(pg, enabled) {
  await pg.evaluate((on) => {
    if (on) {
      localStorage.setItem('agencytrack-dark', '1');
      document.documentElement.classList.add('dark');
    } else {
      localStorage.setItem('agencytrack-dark', '0');
      document.documentElement.classList.remove('dark');
    }
  }, enabled);
  await pg.waitForTimeout(200);
}

// ── browser + bypass setup ───────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });

// SALES MANAGER context — desktop, light mode initial.
const smCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  // ── single token-bearing handshake — happens INSIDE the helper ─────────────
  await setupBypassSession(smCtx, BASE_URL, BYPASS_TOKEN);
} catch (e) {
  // setupBypassSession already sanitized; pass through.
  console.error('Bypass session setup failed:', e.message);
  await browser.close();
  process.exit(1);
}

const smPage = await smCtx.newPage();

// ── CHECK 01: sales_manager login ────────────────────────────────────────────
await check('01_sm_login', 'Login as sales_manager — dashboard loads', async () => {
  await signIn(smPage, SM_EMAIL, SM_PASSWORD);
  await ss(smPage, '01-sm-dashboard-overview');
});

// ── CHECK 02: navigate to Awards tab ─────────────────────────────────────────
await check('02_awards_nav', 'Click Awards tab → ManagerAwardsPanel renders', async () => {
  await clickManagerNavTab(smPage, 'Awards');
  // The Annual tab is default — wait for either the tablist or the "No awards"
  // empty card to confirm panel mounted.
  await smPage.waitForFunction(
    () => document.querySelector('[role="tablist"]') != null ||
          document.body.innerText.includes('No agents in your unit yet'),
    { timeout: 20000 }
  );
  await ss(smPage, '02-awards-panel-mounted');
});

// ── CHECK 03: tab list has Annual / Activity / Recruiting ────────────────────
await check('03_three_tabs', 'Tab list shows Annual, Activity, Recruiting', async () => {
  const tabText = await smPage.locator('[role="tablist"]').first().innerText().catch(() => '');
  if (!tabText.includes('Annual'))     throw new Error(`"Annual" tab missing — tablist text: "${tabText}"`);
  if (!tabText.includes('Activity'))   throw new Error(`"Activity" tab missing — tablist text: "${tabText}"`);
  if (!tabText.includes('Recruiting')) throw new Error(`"Recruiting" tab missing — tablist text: "${tabText}"`);
});

// ── CHECK 04: Annual tab desktop light — medal coins render ──────────────────
await check('04_annual_desktop_light', 'Annual tab (desktop 1440, light) — .badge-medal coins render', async () => {
  await clickAwardsTabPill(smPage, 'Annual');
  // Wait for either medal cards or "No awards in this category"
  await smPage.waitForFunction(
    () => document.querySelectorAll('.badge-medal').length > 0 ||
          document.body.innerText.includes('No awards in this category'),
    { timeout: 15000 }
  );
  const medalCount = await smPage.locator('.badge-medal').count();
  if (medalCount === 0) {
    safeLog('  (No medals in Annual category — empty state is acceptable)');
  } else {
    safeLog(`  Annual tab rendered ${medalCount} .badge-medal coins`);
  }
  await ss(smPage, '04-annual-desktop-light');
});

// ── CHECK 05: Activity tab desktop light ─────────────────────────────────────
await check('05_activity_desktop_light', 'Activity tab (desktop, light) renders', async () => {
  await clickAwardsTabPill(smPage, 'Activity');
  await smPage.waitForFunction(
    () => document.querySelectorAll('.badge-medal').length > 0 ||
          document.body.innerText.includes('No awards in this category'),
    { timeout: 10000 }
  );
  await ss(smPage, '05-activity-desktop-light');
});

// ── CHECK 06: Recruiting tab desktop light ───────────────────────────────────
await check('06_recruit_desktop_light', 'Recruiting tab (desktop, light) renders', async () => {
  await clickAwardsTabPill(smPage, 'Recruiting');
  await smPage.waitForFunction(
    () => document.querySelectorAll('.badge-medal').length > 0 ||
          document.body.innerText.includes('No awards in this category'),
    { timeout: 10000 }
  );
  await ss(smPage, '06-recruit-desktop-light');
});

// ── CHECK 07: programmatic check — no forbidden hex colors in inline styles ──
await check('07_no_forbidden_inline_hex', 'No #f59e0b / #94a3b8 / #b45309 hex strings in any inline style on awards panel', async () => {
  // Sweep all 3 tabs and check every element's style attribute.
  const forbidden = ['#f59e0b', '#94a3b8', '#b45309'];
  const findings = [];

  for (const tabLabel of ['Annual', 'Activity', 'Recruiting']) {
    await clickAwardsTabPill(smPage, tabLabel);
    await smPage.waitForTimeout(400);
    const hits = await smPage.evaluate((forbiddenColors) => {
      const all = document.querySelectorAll('*');
      const matches = [];
      all.forEach((el) => {
        const styleAttr = el.getAttribute('style');
        if (!styleAttr) return;
        for (const c of forbiddenColors) {
          if (styleAttr.toLowerCase().includes(c.toLowerCase())) {
            matches.push({ tag: el.tagName, color: c, snippet: styleAttr.slice(0, 100) });
          }
        }
      });
      return matches;
    }, forbidden);
    if (hits.length > 0) {
      findings.push({ tab: tabLabel, hits });
    }
  }

  if (findings.length > 0) {
    throw new Error(`Forbidden hex colors found in inline styles: ${JSON.stringify(findings, null, 2)}`);
  }
  safeLog('  All 3 tabs free of forbidden hex colors in inline styles');
});

// ── CHECK 08: programmatic check — .badge-medal class present somewhere ──────
await check('08_badge_medal_class', '.badge-medal class present on at least one tab', async () => {
  let totalMedals = 0;
  for (const tabLabel of ['Annual', 'Activity', 'Recruiting']) {
    await clickAwardsTabPill(smPage, tabLabel);
    await smPage.waitForTimeout(400);
    const c = await smPage.locator('.badge-medal').count();
    totalMedals += c;
  }
  if (totalMedals === 0) {
    throw new Error('No .badge-medal coins rendered across any of the 3 tabs — empty data or class lost');
  }
  safeLog(`  Total .badge-medal coins across 3 tabs: ${totalMedals}`);
});

// ── CHECK 09–11: dark mode pass across all 3 tabs ────────────────────────────
await check('09_annual_desktop_dark', 'Annual tab (desktop 1440, dark) renders', async () => {
  await setDarkMode(smPage, true);
  await clickAwardsTabPill(smPage, 'Annual');
  await smPage.waitForTimeout(400);
  await ss(smPage, '09-annual-desktop-dark');
});

await check('10_activity_desktop_dark', 'Activity tab (desktop, dark) renders', async () => {
  await clickAwardsTabPill(smPage, 'Activity');
  await smPage.waitForTimeout(400);
  await ss(smPage, '10-activity-desktop-dark');
});

await check('11_recruit_desktop_dark', 'Recruiting tab (desktop, dark) renders', async () => {
  await clickAwardsTabPill(smPage, 'Recruiting');
  await smPage.waitForTimeout(400);
  await ss(smPage, '11-recruit-desktop-dark');
});

await setDarkMode(smPage, false); // back to light for regression sweep

// ── CHECK 12: regression — Overview (M2) ─────────────────────────────────────
await check('12_overview_regression', 'Manager Overview (M2) still renders', async () => {
  await clickManagerNavTab(smPage, 'Overview', 'Dashboard');
  await smPage.waitForFunction(
    () => document.body.innerText.length > 100,
    { timeout: 10000 }
  );
  await ss(smPage, '12-overview-regression');
});

// ── CHECK 13: regression — Goals tab ─────────────────────────────────────────
await check('13_goals_regression', 'Goals tab still renders', async () => {
  await clickManagerNavTab(smPage, 'Goals');
  await smPage.waitForFunction(
    () => document.body.innerText.length > 100,
    { timeout: 10000 }
  );
  await ss(smPage, '13-goals-regression');
});

// ── CHECK 14: regression — Persistency tab ───────────────────────────────────
await check('14_persistency_regression', 'Persistency tab still renders', async () => {
  await clickManagerNavTab(smPage, 'Persistency');
  await smPage.waitForFunction(
    () => document.body.innerText.length > 100,
    { timeout: 10000 }
  );
  await ss(smPage, '14-persistency-regression');
});

// ── CHECK 15–17: mobile 390px — Awards tabs ──────────────────────────────────
await check('15_annual_mobile_light', 'Annual tab (mobile 390, light) renders', async () => {
  await smPage.setViewportSize({ width: 390, height: 844 });
  await smPage.waitForTimeout(300);
  await clickManagerNavTab(smPage, 'Awards');
  await smPage.waitForFunction(
    () => document.querySelector('[role="tablist"]') != null ||
          document.body.innerText.includes('No agents in your unit yet'),
    { timeout: 12000 }
  );
  await clickAwardsTabPill(smPage, 'Annual');
  await smPage.waitForTimeout(400);
  // Check no horizontal overflow
  const bodyWidth = await smPage.evaluate(() => document.body.scrollWidth);
  if (bodyWidth > 410) {
    throw new Error(`Horizontal overflow at 390px: scrollWidth=${bodyWidth}`);
  }
  await ss(smPage, '15-annual-mobile-light');
});

await check('16_activity_mobile_light', 'Activity tab (mobile, light) renders', async () => {
  await clickAwardsTabPill(smPage, 'Activity');
  await smPage.waitForTimeout(400);
  await ss(smPage, '16-activity-mobile-light');
});

await check('17_recruit_mobile_light', 'Recruiting tab (mobile, light) renders', async () => {
  await clickAwardsTabPill(smPage, 'Recruiting');
  await smPage.waitForTimeout(400);
  await ss(smPage, '17-recruit-mobile-light');
});

// ── CHECK 18–20: mobile dark mode ────────────────────────────────────────────
await check('18_annual_mobile_dark', 'Annual tab (mobile, dark) renders', async () => {
  await setDarkMode(smPage, true);
  await clickAwardsTabPill(smPage, 'Annual');
  await smPage.waitForTimeout(400);
  await ss(smPage, '18-annual-mobile-dark');
});

await check('19_activity_mobile_dark', 'Activity tab (mobile, dark) renders', async () => {
  await clickAwardsTabPill(smPage, 'Activity');
  await smPage.waitForTimeout(400);
  await ss(smPage, '19-activity-mobile-dark');
});

await check('20_recruit_mobile_dark', 'Recruiting tab (mobile, dark) renders', async () => {
  await clickAwardsTabPill(smPage, 'Recruiting');
  await smPage.waitForTimeout(400);
  await ss(smPage, '20-recruit-mobile-dark');
});

await setDarkMode(smPage, false);

// ── CHECK 21: agent dashboard + BadgeGrid still render ───────────────────────
await check('21_agent_regression', 'Agent dashboard + BadgeGrid still render', async () => {
  const agCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(agCtx, BASE_URL, BYPASS_TOKEN);
  const agPage = await agCtx.newPage();
  try {
    await signIn(agPage, AG_EMAIL, AG_PASSWORD);
    // Agent default landing is the dashboard. Look for BadgeGrid or its container.
    // BadgeGrid uses `.badge-medal` class too — the same coin primitive Manager
    // Awards reuses. Wait for either some badge-medal coins or a heading.
    await agPage.waitForFunction(
      () => document.querySelectorAll('.badge-medal').length > 0 ||
            /Weekly Champions|Recognition|Badges/.test(document.body.innerText),
      { timeout: 15000 }
    );
    await ss(agPage, '21-agent-dashboard');
    const medals = await agPage.locator('.badge-medal').count();
    safeLog(`  Agent dashboard rendered ${medals} .badge-medal coins (BadgeGrid)`);
  } finally {
    await agCtx.close();
  }
});

// ── teardown + summary ───────────────────────────────────────────────────────
await browser.close();

const passed = Object.values(results).filter((r) => r.pass).length;
const total  = Object.values(results).length;
const failed = total - passed;

writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n' + '='.repeat(60));
console.log(`M3 Manager Awards smoke walk complete: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed checks:');
  for (const [id, r] of Object.entries(results)) {
    if (!r.pass) console.log(`  ${id}: ${r.label}\n    ${r.error}`);
  }
}
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);
process.exit(failed > 0 ? 1 : 0);

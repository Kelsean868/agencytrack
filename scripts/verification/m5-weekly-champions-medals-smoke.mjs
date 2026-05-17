/**
 * M5 — WeeklyChampionsBanner medal upgrade smoke walk.
 *
 * Verifies the Leaderboard banner refactor:
 *   - Banner renders 3 medal coins (.badge-medal), not the old count cards.
 *   - Medal class mapping: Top API → medal-1, Top Apps → medal-2,
 *     Top Activity → medal-3 (.glow when champion present, .medal-locked
 *     when category empty).
 *   - Mobile (390px) stacks via grid-cols-1 sm:grid-cols-3 — no horizontal
 *     overflow.
 *   - Light + dark parity at desktop (1440x900) and mobile (390x844).
 *   - No console.error events on Leaderboard tab.
 *   - Regression: Overview (M2), Awards (M3), Goals (M4), Persistency still
 *     render for SM. Agent BadgeGrid still renders (shared medal CSS).
 *
 * Bypass: setupBypassSession + cookie-after-handshake. Direct buildBypassUrl
 * calls forbidden — see CLAUDE.md.
 *
 * Run:
 *   node scripts/verification/m5-weekly-champions-medals-smoke.mjs
 * Override host:
 *   PREVIEW_HOST=agencytrack-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/m5-weekly-champions-medals-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_SALES_MANAGER_EMAIL / A11Y_SALES_MANAGER_PASSWORD
 *   A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD
 *
 * Artifacts: verification/m5/screenshots/ (gitignored).
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/m5');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN  = env.VERCEL_BYPASS_TOKEN;
const SM_EMAIL      = env.A11Y_SALES_MANAGER_EMAIL;
const SM_PASSWORD   = env.A11Y_SALES_MANAGER_PASSWORD;
const AGENT_EMAIL   = env.A11Y_AGENT_EMAIL;
const AGENT_PASSWORD = env.A11Y_AGENT_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-m5-weekly-ab7c76-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)                  { console.error('VERCEL_BYPASS_TOKEN not present in .env.local'); process.exit(1); }
if (!SM_EMAIL || !SM_PASSWORD)      { console.error('A11Y_SALES_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }
if (!AGENT_EMAIL || !AGENT_PASSWORD) { console.error('A11Y_AGENT_EMAIL/PASSWORD not present'); process.exit(1); }

// Defense-in-depth: redact tokens + passwords from anything we might log.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  if (BYPASS_TOKEN) {
    out = out.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  }
  for (const pw of [SM_PASSWORD, AGENT_PASSWORD]) {
    if (pw) out = out.replace(new RegExp(pw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  }
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

async function clickNavTab(pg, label, bottomLabel = null) {
  const isMobile = (await pg.viewportSize())?.width < 900;
  if (isMobile) {
    const inBottom = bottomLabel
      ? await pg.locator(`[data-testid^="bottomnav-"]:has-text("${bottomLabel}")`).count() > 0
      : false;
    if (inBottom) {
      await pg.locator(`[data-testid^="bottomnav-"]:has-text("${bottomLabel}")`).first().click();
      await pg.waitForTimeout(700);
      return;
    }
    const more = pg.locator('[data-testid="bottomnav-more"]');
    await more.waitFor({ timeout: 10000 });
    await more.click();
    const drawer = pg.locator('nav[aria-label="More navigation options"]');
    await drawer.waitFor({ timeout: 5000 });
    await drawer.locator(`button:has-text("${label}")`).first().click();
    await pg.waitForTimeout(800);
    return;
  }
  const sidebarBtn = pg
    .locator('nav[aria-label="Primary navigation"] button')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .first();
  await sidebarBtn.waitFor({ timeout: 10000 });
  await sidebarBtn.click();
  await pg.waitForTimeout(800);
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

// Wait for the banner to be rendered with at least one .badge-medal coin.
async function waitForBanner(pg, timeout = 15000) {
  await pg.waitForFunction(
    () => document.querySelectorAll('.badge-medal').length >= 1,
    { timeout },
  );
}

// ── browser + bypass setup ───────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const smCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  await setupBypassSession(smCtx, BASE_URL, BYPASS_TOKEN);
} catch (e) {
  console.error('Bypass session setup failed:', e.message);
  await browser.close();
  process.exit(1);
}

const smPage = await smCtx.newPage();

// ── CHECK 01: SM login ──────────────────────────────────────────────────────
await check('01_sm_login', 'Login as sales_manager — dashboard loads', async () => {
  await signIn(smPage, SM_EMAIL, SM_PASSWORD);
  await ss(smPage, '01-sm-dashboard');
});

// ── CHECK 02: navigate to Leaderboard tab ───────────────────────────────────
await check('02_leaderboard_nav', 'Click Leaderboard tab → component mounts', async () => {
  await clickNavTab(smPage, 'Leaderboard');
  // Banner mounts with at least one medal coin (could be locked if no data yet).
  await waitForBanner(smPage, 25000);
  await ss(smPage, '02-leaderboard-mounted');
});

// ── CHECK 03: banner DOM has 3 medal coins ──────────────────────────────────
await check('03_three_medals_present', 'WeeklyChampionsBanner renders 3 .badge-medal coins', async () => {
  const counts = await smPage.evaluate(() => {
    // Scope to the banner — find the "Last Week's Champions" container.
    const headers = Array.from(document.querySelectorAll('p'));
    const header = headers.find((p) => /Last Week's Champions/.test(p.textContent ?? ''));
    if (!header) return { found: false };
    const banner = header.closest('div');
    const medals = banner.querySelectorAll('.badge-medal');
    const m1 = banner.querySelectorAll('.medal-1').length;
    const m2 = banner.querySelectorAll('.medal-2').length;
    const m3 = banner.querySelectorAll('.medal-3').length;
    const locked = banner.querySelectorAll('.medal-locked').length;
    return { found: true, total: medals.length, m1, m2, m3, locked };
  });
  if (!counts.found) throw new Error('"Last Week\'s Champions" banner not found');
  if (counts.total !== 3) throw new Error(`Expected 3 medal coins, found ${counts.total}`);
  safeLog(`  Banner medal counts: total=${counts.total} m1=${counts.m1} m2=${counts.m2} m3=${counts.m3} locked=${counts.locked}`);
});

// ── CHECK 04: medal class mapping per category ─────────────────────────────
await check('04_medal_class_mapping', 'Medal classes map: Top API→medal-1, Top Apps→medal-2, Top Activity→medal-3 (or medal-locked if empty)', async () => {
  const mapping = await smPage.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('p'));
    const header = headers.find((p) => /Last Week's Champions/.test(p.textContent ?? ''));
    if (!header) return null;
    const banner = header.closest('div');
    const cards = Array.from(banner.querySelectorAll('[data-testid="champion-card"]'));
    if (cards.length !== 3) return null;
    return cards.map((card) => {
      const label = (card.textContent ?? '').match(/(Top API|Top Apps|Top Activity)/)?.[1] ?? null;
      const medal = card.querySelector('.badge-medal');
      const cls = medal ? Array.from(medal.classList) : [];
      return { label, classes: cls };
    });
  });
  if (!mapping) throw new Error('Could not extract champion card mapping');
  const expected = { 'Top API': 'medal-1', 'Top Apps': 'medal-2', 'Top Activity': 'medal-3' };
  for (const card of mapping) {
    const want = expected[card.label];
    if (!want) throw new Error(`Unexpected card label: ${card.label}`);
    const hasMatching = card.classes.includes(want);
    const hasLocked   = card.classes.includes('medal-locked');
    if (!hasMatching && !hasLocked) {
      throw new Error(`${card.label} card has neither ${want} nor medal-locked (classes: ${card.classes.join(' ')})`);
    }
    safeLog(`  ${card.label} → ${card.classes.filter((c) => c.startsWith('medal-') || c === 'glow').join(' ')}`);
  }
});

// ── CHECK 05: no count-card hex strings in inline styles inside the banner ─
// The old ChampionCard used no inline hex either, but verify nothing has
// regressed into hardcoded styles that bypass the theme system.
await check('05_no_inline_hex_in_banner', 'No inline hex color strings in banner DOM (theme-system parity)', async () => {
  const hits = await smPage.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('p'));
    const header = headers.find((p) => /Last Week's Champions/.test(p.textContent ?? ''));
    if (!header) return [];
    const banner = header.closest('div');
    const out = [];
    banner.querySelectorAll('[style]').forEach((el) => {
      const s = el.getAttribute('style') ?? '';
      if (/#[0-9a-fA-F]{3,8}\b/.test(s)) out.push(s);
    });
    return out;
  });
  if (hits.length > 0) {
    throw new Error(`Inline hex found in banner: ${hits.slice(0, 3).join(' | ')}`);
  }
});

// ── CHECK 06: desktop light screenshot (full banner area) ───────────────────
await check('06_desktop_light_screenshot', 'Desktop 1440x900 light — capture banner', async () => {
  await ss(smPage, '06-desktop-light');
});

// ── CHECK 07: desktop dark ───────────────────────────────────────────────────
await check('07_desktop_dark_screenshot', 'Desktop 1440x900 dark — capture banner', async () => {
  await setDarkMode(smPage, true);
  await smPage.waitForTimeout(300);
  await ss(smPage, '07-desktop-dark');
});

// ── CHECK 08: mobile light — verify stacking + screenshot ──────────────────
await check('08_mobile_light_stacks', 'Mobile 390x844 light — grid stacks, no horizontal overflow', async () => {
  await setDarkMode(smPage, false);
  await smPage.setViewportSize({ width: 390, height: 844 });
  await smPage.waitForTimeout(300);
  // Refresh banner DOM after viewport change.
  await waitForBanner(smPage, 10000);
  const bodyWidth = await smPage.evaluate(() => document.body.scrollWidth);
  if (bodyWidth > 410) throw new Error(`Horizontal overflow at 390px viewport: scrollWidth=${bodyWidth}`);
  // Confirm grid is stacked at mobile: cards should each take ~full width.
  const stacked = await smPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="champion-card"]'));
    if (cards.length < 2) return false;
    const w0 = cards[0].getBoundingClientRect().width;
    const w1 = cards[1].getBoundingClientRect().width;
    // At 390px each stacked card should be ~330px wide; if grid is still 3-col
    // each card would be ~110px. Use 200px as the divider.
    return w0 > 200 && w1 > 200;
  });
  if (!stacked) throw new Error('Champion cards do not appear stacked at mobile viewport');
  await ss(smPage, '08-mobile-light');
});

// ── CHECK 09: mobile dark ────────────────────────────────────────────────────
await check('09_mobile_dark_screenshot', 'Mobile 390x844 dark — capture banner', async () => {
  await setDarkMode(smPage, true);
  await smPage.waitForTimeout(300);
  await ss(smPage, '09-mobile-dark');
});

// Reset viewport + theme for regression checks.
await setDarkMode(smPage, false);
await smPage.setViewportSize({ width: 1440, height: 900 });
await smPage.waitForTimeout(300);

// ── CHECK 10: console-error sweep on Leaderboard tab ────────────────────────
const consoleErrors = [];
smPage.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
await check('10_no_console_errors', 'No console.error events on Leaderboard tab', async () => {
  consoleErrors.length = 0;
  await clickNavTab(smPage, 'Leaderboard');
  await waitForBanner(smPage, 15000);
  await smPage.waitForTimeout(800);
  const real = consoleErrors.filter((e) => !/_vercel|favicon|workbox|sw\.js/i.test(e));
  if (real.length > 0) {
    throw new Error(`${real.length} console.error events:\n  ${real.slice(0, 5).join('\n  ')}`);
  }
});

// ── CHECK 11–14: regression sweep on M2 / M3 / M4 / Persistency surfaces ───
await check('11_overview_regression', 'Manager Overview (M2) still renders', async () => {
  await clickNavTab(smPage, 'Overview', 'Dashboard');
  await smPage.waitForFunction(() => document.body.innerText.length > 100, { timeout: 10000 });
  await ss(smPage, '11-overview-regression');
});

await check('12_awards_regression', 'Manager Awards (M3) still renders', async () => {
  await clickNavTab(smPage, 'Awards');
  await smPage.waitForFunction(() => document.body.innerText.length > 100, { timeout: 10000 });
  await ss(smPage, '12-awards-regression');
});

await check('13_goals_regression', 'Manager Goals (M4) still renders — sub-tab row + Goal Cascade present', async () => {
  await clickNavTab(smPage, 'Goals');
  await smPage.waitForSelector('[role="tablist"] [role="tab"]', { timeout: 15000 });
  const sane = await smPage.evaluate(() => {
    const t = document.body.textContent ?? '';
    return /Self/.test(t) && /Agent/.test(t) && /Unit/.test(t) && /Branch/.test(t) && /Goal Cascade/i.test(t);
  });
  if (!sane) throw new Error('M4 Goals surface missing expected sub-tabs or Goal Cascade');
  await ss(smPage, '13-goals-regression');
});

await check('14_persistency_regression', 'Persistency still renders', async () => {
  await clickNavTab(smPage, 'Persistency');
  await smPage.waitForFunction(() => document.body.innerText.length > 100, { timeout: 10000 });
  await ss(smPage, '14-persistency-regression');
});

// ── CHECK 15: agent portal BadgeGrid regression (shared medal CSS) ──────────
const agentCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
try {
  await setupBypassSession(agentCtx, BASE_URL, BYPASS_TOKEN);
} catch (e) {
  console.error('Agent bypass session setup failed:', e.message);
  await browser.close();
  process.exit(1);
}
const agentPage = await agentCtx.newPage();

await check('15_agent_badgegrid_regression', 'Agent BadgeGrid still renders (shared medal CSS unchanged)', async () => {
  await signIn(agentPage, AGENT_EMAIL, AGENT_PASSWORD);
  // BadgeGrid lives in AgentDashboard — should be on the default landing.
  // Look for any .badge-medal coin (the agent's badge grid uses the same CSS).
  const found = await agentPage
    .waitForFunction(
      () => document.querySelectorAll('.badge-medal').length > 0,
      { timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!found) throw new Error('Agent dashboard has no .badge-medal coins (BadgeGrid regression)');
  await ss(agentPage, '15-agent-badgegrid');
});

// ── teardown + summary ───────────────────────────────────────────────────────
await browser.close();

const passed = Object.values(results).filter((r) => r.pass).length;
const total  = Object.values(results).length;
const failed = total - passed;

writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n' + '='.repeat(60));
console.log(`M5 WeeklyChampionsBanner medal smoke walk complete: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed checks:');
  for (const [id, r] of Object.entries(results)) {
    if (!r.pass) console.log(`  ${id}: ${r.label}\n    ${r.error}`);
  }
}
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);
process.exit(failed > 0 ? 1 : 0);

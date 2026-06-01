/**
 * Track J — Manager Awards v2 carve-out smoke.
 *
 * Both UM + BM credentials, both themes. Asserts:
 *   1. Manager Awards panel mounts on the Awards tab.
 *   2. Either the monthly-bonus hero card OR an empty "No awards in this
 *      category" card renders (preview tenant may not have bonus data — both
 *      states are acceptable proof the restyle rendered).
 *   3. Category tabs are present (3 tabs: Annual / Activity / Recruiting).
 *   4. If any AwardCard is present, clicking it opens the AwardDrillDrawer.
 *   5. For BM, the BmAtRiskPanel mounts below the awards grid.
 *   6. 0 console errors.
 *
 * Credentials by boolean presence only (Rule 4).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

const CREDENTIALS = {
  unit_manager:   { email: process.env.A11Y_UNIT_MANAGER_EMAIL,   pass: process.env.A11Y_UNIT_MANAGER_PASSWORD },
  branch_manager: { email: process.env.A11Y_BRANCH_MANAGER_EMAIL, pass: process.env.A11Y_BRANCH_MANAGER_PASSWORD },
};

if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

const RESULTS = [];

async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(1500);
}

async function newCtx(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  const errors = [];
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });
  return {
    browser, page, errors,
    async setDark() {
      if (theme === 'dark') {
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
          localStorage.setItem('agencytrack-dark', 'true');
        });
        await page.waitForTimeout(400);
      }
    },
  };
}

async function clickAwardsNav(page) {
  const testIdNode = await page.locator('[data-testid="nav-awards"]').count();
  if (testIdNode > 0) {
    await page.click('[data-testid="nav-awards"]');
    return true;
  }
  // Fallback: sidebar link by text
  const fallback = page.getByRole('button', { name: /^awards$/i });
  if (await fallback.count() > 0) {
    await fallback.first().click();
    return true;
  }
  return false;
}

async function smokeRole(role, theme) {
  const c = CREDENTIALS[role];
  if (!c.email || !c.pass) {
    RESULTS.push({ role, theme, skip: true, reason: 'no credential' });
    return;
  }
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, c.email, c.pass);
    await setDark();

    const navOk = await clickAwardsNav(page);
    if (!navOk) throw new Error(`${role} awards nav not found`);

    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="manager-awards-panel"]').length > 0
         || document.querySelectorAll('[data-testid="manager-awards-loading"]').length > 0,
      { timeout: 15_000 }
    );

    // Wait for loading to clear.
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="manager-awards-loading"]').length === 0,
      { timeout: 20_000 }
    );

    // (1) Manager Awards panel mounted.
    const panelCount  = await page.locator('[data-testid="manager-awards-panel"]').count();
    // (2) Either bonus hero or empty-card present.
    const heroCount   = await page.locator('[data-testid="monthly-bonus-hero"]').count();
    const emptyCount  = await page.locator('[data-testid="award-empty"]').count();
    const noAgentsCount = await page.getByText('No agents in your unit yet.').count();
    // (3) Category tabs (3 tabs).
    const tabsCount   = await page.locator('[role="tab"]').filter({ hasText: /^(Annual|Activity|Recruiting)$/ }).count();
    // (4) AwardCard click → drill drawer (only if a card exists).
    const cardCount   = await page.locator('[data-testid^="award-card-"]').count();
    let drawerOpened  = null;
    if (cardCount > 0) {
      const firstCard = page.locator('[data-testid^="award-card-"]').first();
      await firstCard.click();
      await page.waitForTimeout(400);
      drawerOpened = await page.locator('[data-testid="award-drill-drawer"]').count() > 0;
      // Close it
      if (drawerOpened) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
    // (5) BmAtRiskPanel (BM only).
    const atRiskCount = await page.locator('[data-testid="bm-at-risk-panel"]').count();

    const renderedAny = (heroCount + emptyCount + noAgentsCount + cardCount) > 0;
    const tabsOk = tabsCount === 3 || noAgentsCount > 0;
    const bmRiskOk = role === 'branch_manager' ? atRiskCount > 0 : true;
    const cardClickOk = cardCount === 0 || drawerOpened === true;

    const pass = (
      (panelCount > 0 || noAgentsCount > 0) &&
      renderedAny &&
      tabsOk &&
      bmRiskOk &&
      cardClickOk &&
      errors.length === 0
    );

    RESULTS.push({
      role, theme,
      panelCount, heroCount, emptyCount, noAgentsCount, tabsCount,
      cardCount, drawerOpened, atRiskCount,
      errors: errors.length, pass,
    });
    console.log(
      `[${role} ${theme}] panel=${panelCount} hero=${heroCount} empty=${emptyCount} noAgents=${noAgentsCount} ` +
      `tabs=${tabsCount} cards=${cardCount} drawer=${drawerOpened} atRisk=${atRiskCount} ` +
      `errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`
    );
  } finally {
    await browser.close();
  }
}

await smokeRole('unit_manager',   'light');
await smokeRole('unit_manager',   'dark');
await smokeRole('branch_manager', 'light');
await smokeRole('branch_manager', 'dark');

console.log('\n=== Manager Awards v2 smoke summary ===');
for (const r of RESULTS) console.log(JSON.stringify(r));
const allPass = RESULTS.every(r => r.pass || r.skip);
process.exit(allPass ? 0 : 1);

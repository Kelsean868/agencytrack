/**
 * pilot-prod-smoke.mjs — Priority 1A: Production READ-ONLY smoke.
 * Tests agent + tenant_admin on all nav surfaces, both themes.
 * No writes — observe only.
 *
 * Run: node scripts/pilot-prod-smoke.mjs
 * Requires: .env.local with A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD,
 *           A11Y_TENANT_ADMIN_EMAIL, A11Y_TENANT_ADMIN_PASSWORD
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, readFileSync } from 'fs';

function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* no .env.local — rely on real env */ }
}
loadEnv();

const __dir = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dir, '..', 'tmp', 'pilot-smoke-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE_URL = 'https://agencytrack.vercel.app';

const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const ADMIN_EMAIL  = process.env.A11Y_TENANT_ADMIN_EMAIL;
const ADMIN_PASS   = process.env.A11Y_TENANT_ADMIN_PASSWORD;
const BM_EMAIL     = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS      = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS || !ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('Missing A11Y credentials in .env.local');
  process.exit(1);
}
if (!BM_EMAIL || !BM_PASS) {
  console.log('NOTE: A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not set — ManagerDashboard smoke skipped');
}

const results = [];
function pass(label) { results.push({ label, status: 'PASS' }); console.log(`  ✓ ${label}`); }
function fail(label, reason) { results.push({ label, status: 'FAIL', reason }); console.log(`  ✗ ${label}: ${reason}`); }
function note(msg) { results.push({ label: msg, status: 'NOTE' }); console.log(`  ℹ ${msg}`); }

async function signIn(page, email, password) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

async function waitForDashboard(page, testid, timeout = 20000) {
  try {
    await page.waitForSelector(`[data-testid="${testid}"]`, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function clickTab(page, testid) {
  try {
    const btn = page.locator(`[data-testid="${testid}"]`).first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(1200);
    return true;
  } catch {
    return false;
  }
}

async function screenshot(page, name) {
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

// ─── AGENT SMOKE ────────────────────────────────────────────────────────────
async function smokeAgent(browser, theme) {
  console.log(`\n── Agent / ${theme} ──`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // Set theme before sign-in
    if (theme === 'dark') {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('agencytrack-dark', 'true');
        document.documentElement.classList.add('dark');
      });
    }

    await signIn(page, AGENT_EMAIL, AGENT_PASS);
    const loaded = await waitForDashboard(page, 'agent-tab-dashboard');
    if (!loaded) { fail(`agent-${theme} sign-in`, 'dashboard not loaded'); await context.close(); return; }
    pass(`agent-${theme} sign-in + dashboard loaded`);
    await screenshot(page, `agent-${theme}-01-dashboard`);

    // Nav tabs to verify
    const agentTabs = [
      { testId: 'agent-tab-history',           label: 'History' },
      { testId: 'agent-tab-game-plan',         label: 'Game Plan' },
      { testId: 'agent-tab-money-needs',        label: 'Money Needs' },
      { testId: 'agent-tab-goals',             label: 'Goals' },
      { testId: 'agent-tab-commission',        label: 'Commission' },
      { testId: 'agent-tab-persistency',       label: 'Persistency' },
      { testId: 'agent-tab-policy-ledger',     label: 'Policy Ledger' },
      { testId: 'agent-tab-prospect-info',     label: 'Prospect Prep' },
      { testId: 'agent-tab-production-report', label: 'Production Report' },
      { testId: 'agent-tab-awards',            label: 'Awards' },
      { testId: 'agent-tab-career',            label: 'Career Portal' },
      { testId: 'agent-tab-leaderboard',       label: 'Leaderboard' },
    ];

    for (const { testId, label } of agentTabs) {
      const ok = await clickTab(page, testId);
      if (ok) {
        pass(`agent-${theme} nav: ${label}`);
        await screenshot(page, `agent-${theme}-${label.replace(/\s+/g, '-').toLowerCase()}`);
      } else {
        fail(`agent-${theme} nav: ${label}`, 'tab not found or not clickable');
      }
    }

    // Check for console errors
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    if (errors.length > 0) note(`agent-${theme} console errors: ${errors.slice(0, 3).join(' | ')}`);

  } catch (e) {
    fail(`agent-${theme} smoke`, e.message.slice(0, 120));
  } finally {
    await context.close();
  }
}

// ─── TENANT ADMIN SMOKE ──────────────────────────────────────────────────────
async function smokeTenantAdmin(browser, theme) {
  console.log(`\n── Tenant Admin / ${theme} ──`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    if (theme === 'dark') {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.setItem('agencytrack-dark', 'true'); document.documentElement.classList.add('dark'); });
    }
    await signIn(page, ADMIN_EMAIL, ADMIN_PASS);
    const loaded = await waitForDashboard(page, 'nav-dashboard', 15000);
    if (!loaded) { fail(`tenant-admin-${theme} sign-in`, 'dashboard not loaded'); await context.close(); return; }
    pass(`tenant-admin-${theme} sign-in + dashboard loaded`);
    await screenshot(page, `tenant-admin-${theme}-01-dashboard`);

    // TenantAdminDashboard nav: Dashboard, Branches, All Users, Company Config, Campaigns, Profile
    const adminTabs = [
      { label: 'Branches',       selector: '[data-testid="nav-branches"]' },
      { label: 'All Users',      selector: '[data-testid="nav-users"]' },
      { label: 'Company Config', selector: '[data-testid="nav-config"]' },
      { label: 'Campaigns',      selector: '[data-testid="nav-campaigns"]' },
    ];

    for (const { label, selector } of adminTabs) {
      try {
        const el = page.locator(selector).first();
        await el.waitFor({ state: 'visible', timeout: 5000 });
        await el.click();
        await page.waitForTimeout(1200);
        pass(`tenant-admin-${theme} nav: ${label}`);
        await screenshot(page, `tenant-admin-${theme}-${label.replace(/\s+/g, '-').toLowerCase()}`);
      } catch {
        fail(`tenant-admin-${theme} nav: ${label}`, 'not found or not clickable');
      }
    }
  } catch (e) {
    fail(`tenant-admin-${theme} smoke`, e.message.slice(0, 120));
  } finally {
    await context.close();
  }
}

// ─── MANAGER (BRANCH_MANAGER) SMOKE ─────────────────────────────────────────
async function smokeManager(browser, theme) {
  if (!BM_EMAIL || !BM_PASS) { note(`manager-${theme} skipped (no BM credentials)`); return; }
  console.log(`\n── Manager (branch_manager) / ${theme} ──`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    if (theme === 'dark') {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.setItem('agencytrack-dark', 'true'); document.documentElement.classList.add('dark'); });
    }
    await signIn(page, BM_EMAIL, BM_PASS);
    const loaded = await waitForDashboard(page, 'tab-persistency', 15000);
    if (!loaded) { fail(`manager-${theme} sign-in`, 'ManagerDashboard not loaded'); await context.close(); return; }
    pass(`manager-${theme} sign-in + dashboard loaded`);
    await screenshot(page, `manager-${theme}-01-overview`);

    const managerTabs = [
      { label: 'Team',              selector: '[data-testid="nav-team"]' },
      { label: 'Master Sheet',      selector: '[data-testid="nav-mastersheet"]' },
      { label: 'Compliance',        selector: '[data-testid="nav-compliance"]' },
      { label: 'Persistency',       selector: '[data-testid="tab-persistency"]' },
      { label: 'Goals',             selector: '[data-testid="nav-goals"]' },
      { label: 'Settlements',       selector: '[data-testid="nav-settlements"]' },
      { label: 'Campaigns',         selector: '[data-testid="nav-campaigns"]' },
      { label: 'Awards',            selector: '[data-testid="nav-awards"]' },
      { label: 'Leaderboard',       selector: '[data-testid="nav-leaderboard"]' },
      { label: 'Production Report', selector: '[data-testid="nav-production-report"]' },
      { label: 'Policy Recon',      selector: '[data-testid="nav-policy-reconciliation"]' },
      { label: 'Kiosk',             selector: '[data-testid="nav-kiosk"]' },
    ];

    for (const { label, selector } of managerTabs) {
      try {
        const el = page.locator(selector).first();
        await el.waitFor({ state: 'visible', timeout: 5000 });
        await el.click();
        await page.waitForTimeout(1200);
        pass(`manager-${theme} nav: ${label}`);
        await screenshot(page, `manager-${theme}-${label.replace(/\s+/g, '-').toLowerCase()}`);
      } catch {
        fail(`manager-${theme} nav: ${label}`, 'not found or not clickable');
      }
    }
  } catch (e) {
    fail(`manager-${theme} smoke`, e.message.slice(0, 120));
  } finally {
    await context.close();
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });

try {
  await smokeAgent(browser, 'light');
  await smokeAgent(browser, 'dark');
  await smokeTenantAdmin(browser, 'light');
  await smokeTenantAdmin(browser, 'dark');
  await smokeManager(browser, 'light');
  await smokeManager(browser, 'dark');
} finally {
  await browser.close();
}

console.log('\n=== PILOT PROD SMOKE SUMMARY ===');
const passes = results.filter((r) => r.status === 'PASS').length;
const fails  = results.filter((r) => r.status === 'FAIL');
const notes  = results.filter((r) => r.status === 'NOTE');
console.log(`PASS: ${passes}  FAIL: ${fails.length}  NOTE: ${notes.length}`);
if (fails.length > 0) {
  console.log('\nFAILURES:');
  fails.forEach((f) => console.log(`  ✗ ${f.label}: ${f.reason}`));
}
if (notes.length > 0) {
  console.log('\nNOTES:');
  notes.forEach((n) => console.log(`  ℹ ${n.label}`));
}
console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
process.exit(fails.length > 0 ? 1 : 0);

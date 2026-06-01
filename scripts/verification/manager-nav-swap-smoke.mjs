/**
 * Track J P5 manager nav swap smoke — role-conditional Leaderboard tab.
 *
 * Closes the deferred P5a manager-scope verification. Four roles × both themes:
 *
 *   1. AGENT (test agent) — sanity: AgentDashboard nav still mounts the
 *      surface (PR #404), agent sees NO scope control (regression check
 *      that this PR didn't break #404 or #408).
 *
 *   2. UNIT_MANAGER — reach Leaderboard tab; assert the surface mounts
 *      (data-testid="production-leaderboard-surface"); scope control
 *      shows My Unit + My Branch; toggle My Unit → subtitle re-scopes
 *      to data-scope="unit" + count <= branch-N. THIS IS P5a's deferred
 *      live verification.
 *
 *   3. BRANCH_MANAGER — reach Leaderboard tab; assert the surface mounts;
 *      scope control shows My Branch + unit-picker; pick a unit →
 *      subtitle re-scopes.
 *
 *   4. SALES_MANAGER — reach Leaderboard tab; assert the OLD points
 *      board mounts (NOT the production surface). REGRESSION GUARD —
 *      SM must NOT break.
 *
 * Both themes. Credentials by boolean presence only (Rule 4).
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

// Boolean presence only — never echo values (Rule 4).
const CREDENTIALS = {
  agent:          { email: process.env.A11Y_AGENT_EMAIL,           pass: process.env.A11Y_AGENT_PASSWORD },
  unit_manager:   { email: process.env.A11Y_UNIT_MANAGER_EMAIL,    pass: process.env.A11Y_UNIT_MANAGER_PASSWORD },
  branch_manager: { email: process.env.A11Y_BRANCH_MANAGER_EMAIL,  pass: process.env.A11Y_BRANCH_MANAGER_PASSWORD },
  sales_manager:  { email: process.env.A11Y_SALES_MANAGER_EMAIL,   pass: process.env.A11Y_SALES_MANAGER_PASSWORD },
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
  return { browser, page, errors, async setDark() {
    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }
  }};
}

// Find and click the Leaderboard nav tab — agent uses agent-tab-leaderboard;
// managers use nav-leaderboard (Sidebar fallback testid: `nav-${item.id}`
// when the NAV_ITEMS entry has no explicit testId — see Sidebar.jsx).
async function clickLeaderboardNav(page) {
  const agentTestId = await page.locator('[data-testid="agent-tab-leaderboard"]').count();
  if (agentTestId > 0) {
    await page.click('[data-testid="agent-tab-leaderboard"]');
    return true;
  }
  const managerTestId = await page.locator('[data-testid="nav-leaderboard"]').count();
  if (managerTestId > 0) {
    await page.click('[data-testid="nav-leaderboard"]');
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Agent — sanity (regression that this PR didn't break #404/#408)
// ─────────────────────────────────────────────────────────────────────────────

async function smokeAgent(theme) {
  const c = CREDENTIALS.agent;
  if (!c.email || !c.pass) {
    RESULTS.push({ role: 'agent', theme, skip: true, reason: 'no credential' });
    return;
  }
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, c.email, c.pass);
    await setDark();

    const navOk = await clickLeaderboardNav(page);
    if (!navOk) throw new Error('agent leaderboard nav not found');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="production-leaderboard-surface"]').length > 0,
      { timeout: 15_000 }
    );

    const surfaceCount = await page.locator(
      '[data-testid="production-leaderboard-surface"]'
    ).count();
    const scopeControl = await page.locator(
      '[data-testid="leaderboard-scope-control"]'
    ).count();

    const pass = (
      surfaceCount > 0 &&
      scopeControl === 0 &&
      errors.length === 0
    );

    RESULTS.push({ role: 'agent', theme, surfaceCount, scopeControl, errors: errors.length, pass });
    console.log(`[agent ${theme}] surface=${surfaceCount} scope-control=${scopeControl} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) UM — reach surface + assert scope control + toggle My Unit (P5a live proof)
// ─────────────────────────────────────────────────────────────────────────────

async function smokeUM(theme) {
  const c = CREDENTIALS.unit_manager;
  if (!c.email || !c.pass) {
    RESULTS.push({ role: 'unit_manager', theme, skip: true, reason: 'no credential' });
    return;
  }
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, c.email, c.pass);
    await setDark();

    // Diagnostic: confirm we're on a manager dashboard (sidebar nav present)
    // and report what nav testids exist.
    await page.waitForTimeout(1500);
    const navTestIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="nav-"]')).map(n => n.getAttribute('data-testid'))
    );
    console.log(`  [um/${theme} diag] nav testids: ${navTestIds.slice(0, 8).join(', ')}${navTestIds.length > 8 ? ` (+${navTestIds.length - 8})` : ''}`);

    // Reset persisted scope BEFORE clicking the nav — surface mounts fresh
    // with default scope=branch. (Avoids a reload-after-mount race that
    // proves fragile in Playwright on the manager dashboard.)
    await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('agencytrack-leaderboard-scope-'));
      keys.forEach(k => localStorage.removeItem(k));
    });

    const navOk = await clickLeaderboardNav(page);
    if (!navOk) throw new Error('UM leaderboard nav not found');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="production-leaderboard-surface"]').length > 0,
      { timeout: 15_000 }
    );

    const ctl = page.locator('[data-testid="leaderboard-scope-control"]');
    const ctlCount = await ctl.count();
    const ctlRole  = ctlCount > 0 ? await ctl.first().getAttribute('data-role') : null;
    const myUnitBtn = await page.locator('[data-testid="leaderboard-scope-myunit"]').count();
    const myBranchBtn = await page.locator('[data-testid="leaderboard-scope-mybranch"]').count();
    const pickerCount = await page.locator('[data-testid="leaderboard-scope-unit-picker"]').count();

    const startSub = page.locator('[data-testid="leaderboard-scope-subtitle"]');
    const startScope = await startSub.getAttribute('data-scope');
    const branchCount = Number(await startSub.getAttribute('data-count'));

    // THE P5a LIVE PROOF — toggle My Unit → surface re-scopes
    await page.click('[data-testid="leaderboard-scope-myunit"]');
    await page.waitForTimeout(500);
    const unitScope = await startSub.getAttribute('data-scope');
    const unitCount = Number(await startSub.getAttribute('data-count'));

    // Restore
    await page.click('[data-testid="leaderboard-scope-mybranch"]');
    await page.waitForTimeout(500);
    const restoredScope = await startSub.getAttribute('data-scope');

    const pass = (
      ctlCount > 0 &&
      ctlRole === 'unit_manager' &&
      myUnitBtn === 1 &&
      myBranchBtn === 1 &&
      pickerCount === 0 &&
      startScope === 'branch' &&
      unitScope === 'unit' &&
      unitCount <= branchCount &&
      restoredScope === 'branch' &&
      errors.length === 0
    );

    RESULTS.push({
      role: 'unit_manager', theme,
      ctlRole, myUnitBtn, myBranchBtn, pickerCount,
      branchCount, unitCount, restoredScope,
      errors: errors.length, pass,
    });
    console.log(`[unit_manager ${theme}] ctl-role=${ctlRole} myunit=${myUnitBtn} mybranch=${myBranchBtn} picker=${pickerCount} branch=${branchCount}→unit=${unitCount}→restored=${restoredScope} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) BM — reach surface + assert picker + pick a unit (P5a live proof)
// ─────────────────────────────────────────────────────────────────────────────

async function smokeBM(theme) {
  const c = CREDENTIALS.branch_manager;
  if (!c.email || !c.pass) {
    RESULTS.push({ role: 'branch_manager', theme, skip: true, reason: 'no credential' });
    return;
  }
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, c.email, c.pass);
    await setDark();

    // Reset persisted scope BEFORE clicking the nav (same rationale as UM).
    await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('agencytrack-leaderboard-scope-'));
      keys.forEach(k => localStorage.removeItem(k));
    });

    const navOk = await clickLeaderboardNav(page);
    if (!navOk) throw new Error('BM leaderboard nav not found');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="production-leaderboard-surface"]').length > 0,
      { timeout: 15_000 }
    );

    const ctl = page.locator('[data-testid="leaderboard-scope-control"]');
    const ctlRole  = (await ctl.count()) > 0 ? await ctl.first().getAttribute('data-role') : null;
    const myBranchBtn = await page.locator('[data-testid="leaderboard-scope-mybranch"]').count();
    const pickerCount = await page.locator('[data-testid="leaderboard-scope-unit-picker"]').count();

    const startSub = page.locator('[data-testid="leaderboard-scope-subtitle"]');
    const branchCount = Number(await startSub.getAttribute('data-count'));

    const optionValues = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="leaderboard-scope-unit-picker"] option'))
        .map(o => o.value)
    );
    const pickValue = optionValues.find(v => v !== '');

    let pickedScope = null, pickedCount = null, restoredScope = null;
    if (pickValue) {
      await page.selectOption('[data-testid="leaderboard-scope-unit-picker"]', pickValue);
      await page.waitForTimeout(500);
      pickedScope = await startSub.getAttribute('data-scope');
      pickedCount = Number(await startSub.getAttribute('data-count'));
      await page.selectOption('[data-testid="leaderboard-scope-unit-picker"]', '');
      await page.waitForTimeout(500);
      restoredScope = await startSub.getAttribute('data-scope');
    }

    const pass = (
      ctlRole === 'branch_manager' &&
      myBranchBtn === 1 &&
      pickerCount === 1 &&
      pickValue != null &&
      pickedScope === 'unit' &&
      pickedCount <= branchCount &&
      restoredScope === 'branch' &&
      errors.length === 0
    );

    RESULTS.push({
      role: 'branch_manager', theme,
      ctlRole, myBranchBtn, pickerCount,
      pickerOptionCount: optionValues.length,
      branchCount, pickedCount, restoredScope,
      errors: errors.length, pass,
    });
    console.log(`[branch_manager ${theme}] ctl-role=${ctlRole} mybranch=${myBranchBtn} picker=${pickerCount} options=${optionValues.length} branch=${branchCount}→unit=${pickedCount}→restored=${restoredScope} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) SM — REGRESSION GUARD — must STILL be on the OLD points board
// ─────────────────────────────────────────────────────────────────────────────

async function smokeSM(theme) {
  const c = CREDENTIALS.sales_manager;
  if (!c.email || !c.pass) {
    RESULTS.push({ role: 'sales_manager', theme, skip: true, reason: 'no credential' });
    return;
  }
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, c.email, c.pass);
    await setDark();

    const navOk = await clickLeaderboardNav(page);
    if (!navOk) throw new Error('SM leaderboard nav not found');
    await page.waitForTimeout(1500);

    // SM regression: the production surface MUST NOT mount; the OLD points
    // board mounts. Points board has no canonical testid, so we assert by
    // exclusion: production-leaderboard-surface count = 0, AND a points-
    // board-only signal is present (champion-card from the legacy banner OR
    // body has visible content beyond the shell).
    const surfaceCount = await page.locator(
      '[data-testid="production-leaderboard-surface"]'
    ).count();

    // The legacy points board renders WeeklyChampionsBanner internally —
    // 3 champion-card elements should be present (banner is inside the
    // OLD Leaderboard component).
    const championCards = await page.locator('[data-testid="champion-card"]').count();

    // Scope control MUST NOT render — confirms surface didn't sneak in
    const scopeControl = await page.locator(
      '[data-testid="leaderboard-scope-control"]'
    ).count();

    const pass = (
      surfaceCount === 0 &&
      scopeControl === 0 &&
      championCards >= 3 &&
      errors.length === 0
    );

    RESULTS.push({
      role: 'sales_manager', theme,
      surfaceCount, scopeControl, championCards,
      errors: errors.length, pass,
    });
    console.log(`[sales_manager ${theme}] surface=${surfaceCount} scope-ctl=${scopeControl} champion-cards=${championCards} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
  } finally {
    await browser.close();
  }
}

console.log(`\nTrack J P5 manager-nav-swap smoke`);
console.log(`Target: ${URL}\n`);

await smokeAgent('light');
await smokeAgent('dark');
await smokeUM('light');
await smokeUM('dark');
await smokeBM('light');
await smokeBM('dark');
await smokeSM('light');
await smokeSM('dark');

const passing = RESULTS.filter(r => r.pass === true).length;
const failing = RESULTS.filter(r => r.pass === false).length;
const skipped = RESULTS.filter(r => r.skip === true).length;
console.log(`\nP5 smoke: ${failing === 0 ? '✓' : '✗'} ${passing}/${RESULTS.length} PASS${skipped > 0 ? ` (${skipped} skipped)` : ''}${failing > 0 ? ` — ${failing} FAILED` : ''}`);
process.exit(failing === 0 ? 0 : 1);

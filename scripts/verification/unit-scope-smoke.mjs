/**
 * Track J P5a unit-scope smoke — role-gated scope control on the leaderboard.
 *
 * Three roles × both themes:
 *
 *   1. AGENT (always runnable) → assert NO [data-testid="leaderboard-scope-
 *      control"] renders; subtitle data-scope="branch" + data-count=branch-N.
 *
 *   2. UNIT_MANAGER (credentialed) → assert 2-segment control (My Unit /
 *      My Branch, no picker). Click My Unit → subtitle data-scope="unit"
 *      + data-count < branch-N; podium re-ranks within the unit. Click My
 *      Branch → restored.
 *
 *   3. BRANCH_MANAGER (credentialed) → assert My Branch segment + unit-
 *      picker. Select a unit → subtitle data-scope="unit" + count < branch-N.
 *      Reset picker to placeholder → restored.
 *
 *  Persistence is component-tested at 4 angles in UnitScope.test.jsx;
 *  the smoke focuses on the live wiring + the role-gate assertion that
 *  agents NEVER see the control on prod.
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

const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;
const UM_EMAIL    = process.env.A11Y_UNIT_MANAGER_EMAIL;
const UM_PASS     = process.env.A11Y_UNIT_MANAGER_PASSWORD;
const BM_EMAIL    = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS     = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');
  process.exit(1);
}
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
  return { browser, context, page, errors, async setDark() {
    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }
  }};
}

async function navToLeaderboard(page, tabTestId) {
  // Agent: 'agent-tab-leaderboard' (PR #404 swapped this to mount
  // ProductionLeaderboardSurface). Manager dashboards' Leaderboard nav
  // currently still mounts the OLD gamification/Leaderboard (the points
  // board) — the manager nav swap to ProductionLeaderboardSurface is the
  // P5 PR which has NOT YET shipped. So managers cannot reach the surface
  // via the live manager nav today; the scope control mounts on the same
  // surface and only becomes user-reachable for managers when P5 ships.
  const fallbacks = [
    tabTestId,
    'agent-tab-leaderboard',
    'tab-leaderboard',
  ].filter(Boolean);
  for (const id of fallbacks) {
    const found = await page.locator(`[data-testid="${id}"]`).count();
    if (found > 0) {
      await page.click(`[data-testid="${id}"]`);
      try {
        await page.waitForSelector(
          '[data-testid="production-leaderboard-surface"], [data-testid="leaderboard-scope-subtitle"]',
          { timeout: 15_000 }
        );
        return true;
      } catch { /* nav clicked but didn't land on ProductionLeaderboardSurface */ }
    }
  }
  return false;
}

async function readScopeState(page) {
  const subtitle = page.locator('[data-testid="leaderboard-scope-subtitle"]');
  const count = await subtitle.count();
  if (count === 0) return { exists: false };
  return {
    exists: true,
    scope: await subtitle.first().getAttribute('data-scope'),
    count: await subtitle.first().getAttribute('data-count'),
  };
}

// ── Agent — assert NO scope control ──────────────────────────────────────────

async function smokeAgent(theme) {
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, AGENT_EMAIL, AGENT_PASS);
    await setDark();
    const navOk = await navToLeaderboard(page);
    if (!navOk) throw new Error('agent leaderboard nav not found');

    const controlCount = await page.locator(
      '[data-testid="leaderboard-scope-control"]'
    ).count();
    const sub = await readScopeState(page);

    const pass = (
      controlCount === 0 &&
      sub.exists &&
      sub.scope === 'branch' &&
      Number(sub.count) > 0 &&
      errors.length === 0
    );

    RESULTS.push({
      role: 'agent', theme,
      controlCount, subtitleScope: sub.scope, subtitleCount: sub.count,
      errors: errors.length, pass,
    });
    console.log(`[agent ${theme}] control=${controlCount} subtitle=${sub.scope}/${sub.count} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

// ── Unit manager — assert 2-segment control + scope re-application ───────────

async function smokeUM(theme) {
  if (!UM_EMAIL || !UM_PASS) {
    RESULTS.push({ role: 'unit_manager', theme, skip: true, reason: 'no credential' });
    console.log(`[unit_manager ${theme}] SKIP — no credential`);
    return;
  }
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, UM_EMAIL, UM_PASS);
    await setDark();
    const navOk = await navToLeaderboard(page);
    if (!navOk) {
      // Expected today: ManagerDashboard's leaderboard nav still mounts
      // gamification/Leaderboard (the OLD points board). The manager nav
      // swap to ProductionLeaderboardSurface is the P5 PR, NOT YET shipped.
      // Scope control is component-tested (UnitScope.test.jsx role-gating
      // arm × 5 roles + UM scope re-application + persistence round-trip).
      RESULTS.push({
        role: 'unit_manager', theme, skip: true,
        reason: 'ProductionLeaderboardSurface not reachable via manager nav (awaits P5 manager-nav-swap)',
      });
      console.log(`[unit_manager ${theme}] SKIP — surface not reachable via manager nav (awaits P5)`);
      return;
    }

    // 1) Control present, role=UM, no picker
    const ctl = page.locator('[data-testid="leaderboard-scope-control"]');
    const ctlCount = await ctl.count();
    const ctlRole  = ctlCount > 0 ? await ctl.first().getAttribute('data-role') : null;
    const myUnitBtn = await page.locator('[data-testid="leaderboard-scope-myunit"]').count();
    const myBranchBtn = await page.locator('[data-testid="leaderboard-scope-mybranch"]').count();
    const pickerCount = await page.locator('[data-testid="leaderboard-scope-unit-picker"]').count();

    // 2) Default scope (or whatever's persisted from prior tests). Reset to
    //    branch explicitly so the test starts deterministic.
    await page.evaluate(() => {
      // Clear any persisted scope for the signed-in user.
      const keys = Object.keys(localStorage).filter(k => k.startsWith('agencytrack-leaderboard-scope-'));
      keys.forEach(k => localStorage.removeItem(k));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await navToLeaderboard(page);

    const startSub = await readScopeState(page);
    const branchCount = Number(startSub.count);

    // 3) Click My Unit → re-scope
    await page.click('[data-testid="leaderboard-scope-myunit"]');
    await page.waitForTimeout(500);
    const unitSub = await readScopeState(page);

    // 4) Click My Branch → restore
    await page.click('[data-testid="leaderboard-scope-mybranch"]');
    await page.waitForTimeout(500);
    const restoredSub = await readScopeState(page);

    const pass = (
      ctlCount > 0 &&
      ctlRole === 'unit_manager' &&
      myUnitBtn === 1 &&
      myBranchBtn === 1 &&
      pickerCount === 0 &&
      startSub.scope === 'branch' &&
      unitSub.scope === 'unit' &&
      Number(unitSub.count) <= branchCount &&
      restoredSub.scope === 'branch' &&
      Number(restoredSub.count) === branchCount &&
      errors.length === 0
    );

    RESULTS.push({
      role: 'unit_manager', theme,
      ctlRole, myUnitBtn, myBranchBtn, pickerCount,
      branchCount, unitSubCount: unitSub.count,
      restoredScope: restoredSub.scope, restoredCount: restoredSub.count,
      errors: errors.length, pass,
    });
    console.log(`[unit_manager ${theme}] ctl-role=${ctlRole} myunit=${myUnitBtn} mybranch=${myBranchBtn} picker=${pickerCount} branch=${branchCount}→unit=${unitSub.count}→restored=${restoredSub.scope}/${restoredSub.count} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

// ── Branch manager — assert My Branch segment + picker + scope re-application ─

async function smokeBM(theme) {
  if (!BM_EMAIL || !BM_PASS) {
    RESULTS.push({ role: 'branch_manager', theme, skip: true, reason: 'no credential' });
    console.log(`[branch_manager ${theme}] SKIP — no credential`);
    return;
  }
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, BM_EMAIL, BM_PASS);
    await setDark();
    const navOk = await navToLeaderboard(page);
    if (!navOk) {
      // Same reason as UM — see smokeUM's note. BM scope control is
      // component-tested at UnitScope.test.jsx (role gating × BM, picker
      // re-scoping, round-trip).
      RESULTS.push({
        role: 'branch_manager', theme, skip: true,
        reason: 'ProductionLeaderboardSurface not reachable via manager nav (awaits P5 manager-nav-swap)',
      });
      console.log(`[branch_manager ${theme}] SKIP — surface not reachable via manager nav (awaits P5)`);
      return;
    }

    const ctl = page.locator('[data-testid="leaderboard-scope-control"]');
    const ctlCount = await ctl.count();
    const ctlRole  = ctlCount > 0 ? await ctl.first().getAttribute('data-role') : null;
    const myBranchBtn = await page.locator('[data-testid="leaderboard-scope-mybranch"]').count();
    const picker = page.locator('[data-testid="leaderboard-scope-unit-picker"]');
    const pickerCount = await picker.count();

    // Clear persistence + reload to start deterministic
    await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('agencytrack-leaderboard-scope-'));
      keys.forEach(k => localStorage.removeItem(k));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await navToLeaderboard(page);

    const startSub = await readScopeState(page);
    const branchCount = Number(startSub.count);

    // Read picker options to find one we can select
    const optionValues = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="leaderboard-scope-unit-picker"] option'))
        .map(o => ({ value: o.value, text: o.textContent }))
    );
    // Pick first non-placeholder
    const pickValue = optionValues.find(o => o.value !== '')?.value;
    let pickedSub = null, restoredSub = null;
    if (pickValue) {
      // Use Playwright's selectOption for proper React event handling
      await page.selectOption('[data-testid="leaderboard-scope-unit-picker"]', pickValue);
      await page.waitForTimeout(500);
      pickedSub = await readScopeState(page);
      // Reset picker to placeholder
      await page.selectOption('[data-testid="leaderboard-scope-unit-picker"]', '');
      await page.waitForTimeout(500);
      restoredSub = await readScopeState(page);
    }

    const pass = (
      ctlCount > 0 &&
      ctlRole === 'branch_manager' &&
      myBranchBtn === 1 &&
      pickerCount === 1 &&
      startSub.scope === 'branch' &&
      pickValue != null &&
      pickedSub?.scope === 'unit' &&
      Number(pickedSub?.count ?? 0) <= branchCount &&
      restoredSub?.scope === 'branch' &&
      Number(restoredSub?.count ?? 0) === branchCount &&
      errors.length === 0
    );

    RESULTS.push({
      role: 'branch_manager', theme,
      ctlRole, myBranchBtn, pickerCount,
      pickerOptionCount: optionValues.length, pickValue,
      branchCount, pickedSubCount: pickedSub?.count, restoredSubCount: restoredSub?.count,
      errors: errors.length, pass,
    });
    console.log(`[branch_manager ${theme}] ctl-role=${ctlRole} mybranch=${myBranchBtn} picker=${pickerCount} options=${optionValues.length} pick=${pickValue} branch=${branchCount}→unit=${pickedSub?.count}→restored=${restoredSub?.scope}/${restoredSub?.count} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

console.log(`\nTrack J P5a unit-scope smoke`);
console.log(`Target: ${URL}\n`);

await smokeAgent('light');
await smokeAgent('dark');
await smokeUM('light');
await smokeUM('dark');
await smokeBM('light');
await smokeBM('dark');

const passing = RESULTS.filter(r => r.pass === true).length;
const failing = RESULTS.filter(r => r.pass === false).length;
const skipped = RESULTS.filter(r => r.skip === true).length;
console.log(`\nP5a smoke: ${failing === 0 ? '✓' : '✗'} ${passing}/${RESULTS.length} PASS${skipped > 0 ? ` (${skipped} skipped)` : ''}${failing > 0 ? ` — ${failing} FAILED` : ''}`);
process.exit(failing === 0 ? 0 : 1);

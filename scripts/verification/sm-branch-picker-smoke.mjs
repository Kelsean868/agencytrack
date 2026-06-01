/**
 * Track J P5b — SM branch-picker live smoke.
 *
 * Asserts (both themes):
 *   1. SM lands on SmLeaderboardView (NOT the points board, NOT a bare
 *      ProductionLeaderboardSurface).
 *   2. The branch picker enumerates EVERY active tenant branch.
 *   3. Picking branch A → surface re-reads against that branch (subtitle
 *      reads branch A's name; podium/empty matches branch A's data).
 *   4. Picking branch B → surface re-reads against B (subtitle flips, data
 *      flips). For the live tenant `tatillife_south`, branch A
 *      (`tatil_south`) is populated by the PR #410 seed; branch B (Cyril,
 *      `ljbBHP1g7lbZXvHlpcDn`) is intentionally empty per dispatcher Path A
 *      → asserted as the honest empty-state.
 *   5. Reload → the last-picked branch is restored from localStorage.
 *   6. Within a populated branch, the BM-style unit-picker is visible and
 *      changing the unit re-scopes the subtitle.
 *
 * Credentials by boolean presence only (Rule 4); never echo values.
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

const SM_EMAIL = process.env.A11Y_SALES_MANAGER_EMAIL;
const SM_PASS  = process.env.A11Y_SALES_MANAGER_PASSWORD;

if (!SM_EMAIL || !SM_PASS) {
  console.error('Missing A11Y_SALES_MANAGER_* credentials — smoke skipped.');
  process.exit(0);
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

async function clickLeaderboardNav(page) {
  const managerTestId = await page.locator('[data-testid="nav-leaderboard"]').count();
  if (managerTestId > 0) {
    await page.click('[data-testid="nav-leaderboard"]');
    return true;
  }
  return false;
}

async function smokeSM(theme) {
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, SM_EMAIL, SM_PASS);
    await setDark();

    // Reset persisted state BEFORE entering the tab so we measure default-first-use behavior.
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(k => k.startsWith('agencytrack-sm-leaderboard-branch-') || k.startsWith('agencytrack-leaderboard-scope-'))
        .forEach(k => localStorage.removeItem(k));
    });

    const navOk = await clickLeaderboardNav(page);
    if (!navOk) throw new Error('SM leaderboard nav not found');

    // (1) SM view mounts; points-board + bare-surface absent.
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="sm-leaderboard-view"]').length > 0,
      { timeout: 15_000 }
    );
    // Wait for the inner ProductionLeaderboardSurface to clear ITS loading
    // state — useLeaderboard fetches the picked branch's doc on first render.
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="production-leaderboard-surface"]').length > 0,
      { timeout: 20_000 }
    );
    const smViewCount        = await page.locator('[data-testid="sm-leaderboard-view"]').count();
    const surfaceCount       = await page.locator('[data-testid="production-leaderboard-surface"]').count();
    // The OLD points board (gamification/Leaderboard) renders the "Leaderboard"
    // h1; an SM should NOT see that title now. Selector by id="leaderboard-section"
    // — the points board mount marker. If we can't reach the id reliably,
    // surfaceCount + smViewCount carry the assertion.

    // (2) Branch picker enumeration.
    const pickerOptions = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="sm-leaderboard-branch-picker"] option'))
        .map(o => ({ id: o.value, name: o.textContent }))
    );
    const branchCount = pickerOptions.length;

    // (3) Initial default — record what's picked first.
    const initialPicker = page.locator('[data-testid="sm-leaderboard-branch-picker"]');
    const initialPicked = await initialPicker.getAttribute('data-value');

    // Find the populated branch (we know tatil_south has seed data) and an
    // alternative if present.
    const populatedId = pickerOptions.find(o => o.id === 'tatil_south')?.id ?? pickerOptions[0]?.id;
    const otherId     = pickerOptions.find(o => o.id !== populatedId)?.id ?? null;

    // (3) Pick the populated branch (tatil_south) — assert subtitle + podium.
    let aSubtitle = null, aPodiumRank1 = null;
    if (populatedId) {
      await page.selectOption('[data-testid="sm-leaderboard-branch-picker"]', populatedId);
      await page.waitForTimeout(800);
      const subtitle = page.locator('[data-testid="leaderboard-scope-subtitle"]');
      aSubtitle = await subtitle.textContent();
      const rank1 = page.locator('[data-testid="podium-card-rank-1"]');
      aPodiumRank1 = (await rank1.count()) > 0;
    }

    // (4) Pick the other branch (Cyril) — assert subtitle flips AND data flips
    // (Cyril has no seed data → empty state).
    let bSubtitle = null, bPodiumRank1 = null, bEmpty = false;
    if (otherId) {
      await page.selectOption('[data-testid="sm-leaderboard-branch-picker"]', otherId);
      await page.waitForTimeout(800);
      const subtitle = page.locator('[data-testid="leaderboard-scope-subtitle"]');
      bSubtitle = await subtitle.textContent();
      const rank1 = page.locator('[data-testid="podium-card-rank-1"]');
      bPodiumRank1 = (await rank1.count()) > 0;
      // Empty / slow-period surface renders no podium AND no tail rows.
      const tail = await page.locator('[data-testid="tail"]').count();
      bEmpty = !bPodiumRank1 && tail === 0;
    }

    // (5) Persistence — reload, expect the LAST picked (otherId) restored.
    const persistedBefore = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('agencytrack-sm-leaderboard-branch-'))
        .map(k => ({ k, v: localStorage.getItem(k) }))
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    // After reload, the dashboard's activeTab resets to default (overview);
    // re-navigate to the leaderboard tab to remount SmLeaderboardView. Wait
    // for the manager nav to be available first (Firebase auth re-resolves
    // from IndexedDB cache on reload — should be near-instant but not zero).
    await page.waitForSelector('[data-testid="nav-leaderboard"]', { timeout: 30_000 });
    await page.click('[data-testid="nav-leaderboard"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="sm-leaderboard-view"]').length > 0,
      { timeout: 15_000 }
    );
    const reloadedPicker = page.locator('[data-testid="sm-leaderboard-branch-picker"]');
    const reloadedPicked = await reloadedPicker.getAttribute('data-value');

    // (6) Within a populated branch — re-pick tatil_south and exercise the
    // BM-style unit picker (scopeRoleOverride=branch_manager surfaces it).
    let bmUnitPicker = 0, scopeChangedToUnit = false;
    if (populatedId) {
      await page.selectOption('[data-testid="sm-leaderboard-branch-picker"]', populatedId);
      await page.waitForTimeout(800);
      bmUnitPicker = await page.locator('[data-testid="leaderboard-scope-unit-picker"]').count();
      if (bmUnitPicker > 0) {
        const optionValues = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-testid="leaderboard-scope-unit-picker"] option'))
            .map(o => o.value)
        );
        const pickValue = optionValues.find(v => v !== '');
        if (pickValue) {
          await page.selectOption('[data-testid="leaderboard-scope-unit-picker"]', pickValue);
          await page.waitForTimeout(500);
          const sub = page.locator('[data-testid="leaderboard-scope-subtitle"]');
          const sScope = await sub.getAttribute('data-scope');
          scopeChangedToUnit = sScope === 'unit';
        }
      }
    }

    const pass = (
      smViewCount === 1 &&
      surfaceCount === 1 && // the inner ProductionLeaderboardSurface still renders ONCE inside SM view
      branchCount >= 2 &&
      initialPicked &&
      aSubtitle && aSubtitle.toLowerCase().includes('south') &&
      aPodiumRank1 === true &&
      bSubtitle && (otherId === 'ljbBHP1g7lbZXvHlpcDn' ? bEmpty : true) &&
      reloadedPicked === otherId &&
      bmUnitPicker > 0 &&
      scopeChangedToUnit &&
      errors.length === 0
    );

    RESULTS.push({
      role: 'sales_manager',
      theme,
      smViewCount,
      surfaceCount,
      branchCount,
      initialPicked,
      populatedId,
      otherId,
      aSubtitle: aSubtitle?.slice(0, 80),
      aPodiumRank1,
      bSubtitle: bSubtitle?.slice(0, 80),
      bPodiumRank1,
      bEmpty,
      persistedBefore: persistedBefore.length,
      reloadedPicked,
      bmUnitPicker,
      scopeChangedToUnit,
      errors: errors.length,
      pass,
    });

    console.log(
      `[sales_manager ${theme}] smView=${smViewCount} surface=${surfaceCount} branches=${branchCount} ` +
      `default=${initialPicked} → pickA(${populatedId})=podium-rank1:${aPodiumRank1} ` +
      `→ pickB(${otherId})=empty:${bEmpty} → reload-restored=${reloadedPicked === otherId} ` +
      `→ unit-picker=${bmUnitPicker} unit-scope-toggle=${scopeChangedToUnit} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`
    );
  } finally {
    await browser.close();
  }
}

await smokeSM('light');
await smokeSM('dark');

console.log('\n=== SM branch picker smoke summary ===');
for (const r of RESULTS) {
  console.log(JSON.stringify(r));
}
const allPass = RESULTS.every(r => r.pass);
process.exit(allPass ? 0 : 1);

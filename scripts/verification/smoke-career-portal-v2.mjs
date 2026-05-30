/**
 * smoke-career-portal-v2.mjs
 * Production smoke for Track J v2 — Career Portal (PR #389).
 *
 * Checks (light AND dark):
 *   C1. 7-node career ladder renders (all level numbers visible in DOM)
 *   C2. Teal coin present on achieved nodes (primary CSS var in gradient, no flat fill)
 *   C3. Gold coin + "YOU ARE HERE" pill present on current-level node
 *   C4. Locked node opens LevelDrillDrawer with Criteria content (ESC closes)
 *   C5. 3 CommitmentScorecards render ("Annual API", "Applications", "Persistency")
 *   C6. TimeToNextCard renders ("Next milestone" text)
 *   C7. TrajectoryCard renders ("Trajectory" or "quarters" text)
 *   C8. No crash from removed CommissionPlayground/GapAnalysis
 *        (no "commission" or "gap analysis" error in console)
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  safeLog,
} from './lib/walk-helpers.mjs';

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnvLocal(path) {
  try {
    const src = readFileSync(path, 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* no-op */ }
}
loadEnvLocal('.env.local');

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL  = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS   = requireEnv('A11Y_AGENT_PASSWORD');
const PROD_URL     = 'https://agencytrack.vercel.app';

// ── Result tracking ───────────────────────────────────────────────────────────
const results = [];
function pass(id, note = '') { results.push({ id, ok: true,  note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); }
function fail(id, note = '') { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); }
function skip(id, note = '') { results.push({ id, ok: true,  note: 'SKIP: ' + note }); console.log(`  SKIP ${id} — ${note}`); }

// ── Login ─────────────────────────────────────────────────────────────────────
async function loginAndWait(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2000);
}

// ── Dark mode toggle ──────────────────────────────────────────────────────────
async function setDarkMode(page, wantDark) {
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (isDark === wantDark) return;
  const toggled = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      ['dark', 'light', 'theme', 'mode'].some(kw => (b.getAttribute('aria-label') || '').toLowerCase().includes(kw))
    );
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!toggled) {
    await page.evaluate((d) => {
      document.documentElement.classList.toggle('dark', d);
      try { localStorage.setItem('agencytrack-dark', d ? 'true' : 'false'); } catch { }
    }, wantDark);
  }
  await page.waitForFunction(
    (d) => document.documentElement.classList.contains('dark') === d,
    wantDark, { timeout: 5000 }
  );
  await page.waitForTimeout(400);
}

// ── Navigate to tab ───────────────────────────────────────────────────────────
async function navigateToTab(page, testId, label) {
  const btn = page.locator(`[data-testid="${testId}"]`);
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click();
  } else {
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: new RegExp(label, 'i') }).first().click();
    } else {
      return false;
    }
  }
  await page.waitForTimeout(2000);
  return true;
}

// ── Theme run ─────────────────────────────────────────────────────────────────
async function runTheme(browser, theme) {
  console.log(`\n=== ${theme.toUpperCase()} MODE ===`);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, PROD_URL, BYPASS_TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });

  try {
    await loginAndWait(page);
  } catch (e) {
    fail(`${theme}-login`, `Login failed: ${e.message}`);
    await context.close();
    return;
  }
  console.log('  login: ok');

  await setDarkMode(page, theme === 'dark');
  console.log(`  theme: ${theme}`);

  // ── Navigate to Career tab ───────────────────────────────────────────────
  const careerOk = await navigateToTab(page, 'agent-tab-career', 'Career');
  if (!careerOk) {
    fail(`${theme}-career-nav`, 'Career tab not found');
    await context.close();
    return;
  }

  // C1: 7-node career ladder renders — all 7 level numbers visible in DOM
  const ladderLevels = await page.evaluate(() => {
    const body = document.body.textContent || '';
    const found = [];
    for (let i = 1; i <= 7; i++) {
      // Each LadderNode renders "LEVEL {n}" as an eyebrow label
      if (body.includes(`LEVEL ${i}`) || body.includes(`Level ${i}`)) found.push(i);
    }
    return found;
  });
  ladderLevels.length === 7
    ? pass(`${theme}-C1-ladder`, `All 7 level nodes found in DOM`)
    : fail(`${theme}-C1-ladder`, `Only ${ladderLevels.length} of 7 levels found: [${ladderLevels}]`);

  // C2: Teal coin on achieved nodes uses CSS var gradient (not flat fill)
  // Achieved nodes render with primary-light/primary/primary-dark gradient
  const tealCoinOk = await page.evaluate(() => {
    // Look for a div whose inline style background contains --color-primary
    const allDivs = Array.from(document.querySelectorAll('div[style]'));
    return allDivs.some(el => {
      const bg = el.style.background || el.style.backgroundImage || '';
      return bg.includes('--color-primary-light') || bg.includes('--color-primary)') || bg.includes('--color-primary-dark');
    });
  });
  tealCoinOk
    ? pass(`${theme}-C2-teal-coin`, 'CSS var gradient on achieved (teal) coin')
    : fail(`${theme}-C2-teal-coin`, 'No --color-primary gradient found on coins');

  // C3: Gold coin + "YOU ARE HERE" pill on current-level node
  const youAreHere = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return body.toLowerCase().includes('you are here');
  });
  const goldCoinOk = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div[style]'));
    return allDivs.some(el => {
      const bg = el.style.background || el.style.backgroundImage || '';
      return bg.includes('--color-medal-1-light') || bg.includes('--color-medal-1-mid') || bg.includes('--color-medal-1-deep');
    });
  });
  youAreHere && goldCoinOk
    ? pass(`${theme}-C3-gold-coin`, '"YOU ARE HERE" pill + medal-1 gradient on current coin')
    : youAreHere && !goldCoinOk
      ? fail(`${theme}-C3-gold-coin`, '"YOU ARE HERE" found but no medal-1 gradient detected')
      : !youAreHere && goldCoinOk
        ? fail(`${theme}-C3-gold-coin`, 'medal-1 gradient found but "YOU ARE HERE" missing')
        : fail(`${theme}-C3-gold-coin`, 'Neither "YOU ARE HERE" nor medal-1 gradient found');

  // C4: Locked node opens LevelDrillDrawer with Criteria
  // Find a "View criteria" button (rendered on locked ladder nodes)
  const criteriaBtn = page.getByRole('button', { name: /View criteria/i }).first();
  if (await criteriaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await criteriaBtn.click();
    await page.waitForTimeout(800);
    const drawerOpen = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      const body = document.body.textContent || '';
      return d !== null && (body.includes('Criteria') || body.includes('criteria'));
    });
    drawerOpen
      ? pass(`${theme}-C4-drawer`, 'LevelDrillDrawer opened with Criteria content')
      : fail(`${theme}-C4-drawer`, 'Drawer dialog not found or no Criteria text');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    // Maybe there are no locked nodes (agent is already at level 7?)
    // Try clicking the coin button for a locked level directly
    const lockBtn = page.locator('button[aria-label*="Level"]').first();
    if (await lockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lockBtn.click();
      await page.waitForTimeout(800);
      const drawerOpen = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return d !== null && (document.body.textContent || '').includes('Criteria');
      });
      drawerOpen
        ? pass(`${theme}-C4-drawer`, 'LevelDrillDrawer opened via coin button')
        : fail(`${theme}-C4-drawer`, 'No drawer found after coin button click');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      skip(`${theme}-C4-drawer`, 'No locked-node trigger found (agent may be at max level)');
    }
  }

  // C5: 3 CommitmentScorecards render (look for the 3 metric labels)
  const commitmentOk = await page.evaluate(() => {
    const body = document.body.textContent || '';
    const hasApi  = body.includes('Annual API') || body.includes('annual api');
    const hasApps = body.includes('Applications') || body.includes('applications');
    const hasPers = body.includes('Persistency') || body.includes('persistency');
    return { hasApi, hasApps, hasPers, all: hasApi && hasApps && hasPers };
  });
  commitmentOk.all
    ? pass(`${theme}-C5-scorecards`, 'All 3 CommitmentScorecards present (API / Applications / Persistency)')
    : fail(`${theme}-C5-scorecards`, `Missing: ${[!commitmentOk.hasApi && 'API', !commitmentOk.hasApps && 'Applications', !commitmentOk.hasPers && 'Persistency'].filter(Boolean).join(', ')}`);

  // C6: TimeToNextCard renders ("Next milestone" text)
  const timeToNext = await page.evaluate(() =>
    (document.body.textContent || '').toLowerCase().includes('next milestone')
  );
  timeToNext
    ? pass(`${theme}-C6-time-to-next`, '"Next milestone" card present')
    : fail(`${theme}-C6-time-to-next`, '"Next milestone" text not found');

  // C7: TrajectoryCard renders
  const trajectory = await page.evaluate(() => {
    const body = (document.body.textContent || '').toLowerCase();
    return body.includes('trajectory') || body.includes('quarters') || body.includes('quarterly');
  });
  trajectory
    ? pass(`${theme}-C7-trajectory`, 'TrajectoryCard present')
    : fail(`${theme}-C7-trajectory`, 'No trajectory/quarters text found');

  // C8: No crash from removed CommissionPlayground/GapAnalysis
  // Check for React error boundary text or console errors mentioning commission/gap
  const noCommissionCrash = await page.evaluate(() => {
    const body = document.body.textContent || '';
    // If CommissionPlayground crashed, we'd see an error boundary message
    return !body.includes('Something went wrong') && !body.includes('Unexpected error');
  });
  const consoleErrors = capture.consoleMessages.filter(m =>
    m.type === 'error' &&
    (m.text.toLowerCase().includes('commission') || m.text.toLowerCase().includes('gap') || m.text.toLowerCase().includes('cannot read'))
  );
  noCommissionCrash && consoleErrors.length === 0
    ? pass(`${theme}-C8-no-crash`, 'No crash — removed CommissionPlayground/GapAnalysis safe')
    : fail(`${theme}-C8-no-crash`, `Crash or errors: ${consoleErrors.map(e => e.text.slice(0, 100)).join('; ')}`);

  formatCaptureReport(capture);
  await context.close();
}

// ── Main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  await runTheme(browser, 'light');
  await runTheme(browser, 'dark');
} finally {
  await browser.close();
}

// ── Summary ───────────────────────────────────────────────────────────────────
const PASS = results.filter(r => r.ok);
const FAIL = results.filter(r => !r.ok);
console.log('\n══════════════════════════════════════════');
console.log(`SMOKE SUMMARY: ${PASS.length} PASS/SKIP  /  ${FAIL.length} FAIL`);
for (const r of results) {
  console.log(`  ${r.ok ? (r.note?.startsWith('SKIP') ? '~' : '✓') : '✗'} ${r.id}${r.note ? ' — ' + r.note : ''}`);
}
console.log('══════════════════════════════════════════');
if (FAIL.length > 0) process.exit(1);

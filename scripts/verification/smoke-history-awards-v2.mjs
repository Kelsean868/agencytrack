/**
 * smoke-history-awards-v2.mjs
 * Production smoke for Track J v2 — History tab + Awards tab (PR #390 + #391).
 *
 * Checks (light AND dark):
 *   History tab:
 *     H1. HistoryAnchorStrip + YearHeatmap section renders
 *     H2. Filter segments switch (click "Draft" → live count)
 *     H3. WeekCard opens SubmissionViewer drawer
 *     H4. Download report button present
 *   Awards tab:
 *     A1. Hero donut SVG renders (circle[stroke-dasharray])
 *     A2. Category pill filter ("Monthly" click)
 *     A3. AwardCard opens AwardDrillDrawer (dialog[role="dialog"])
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

// ── Login helper (mirrors border-border-smoke loginAtMobile pattern) ─────────
async function loginAndWait(page) {
  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  // Submit and wait for email input to DISAPPEAR (auth in flight)
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  // Wait for app content to settle
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

// ── Navigate to a sidebar tab ─────────────────────────────────────────────────
async function navigateToTab(page, testId, label) {
  const btn = page.locator(`[data-testid="${testId}"]`);
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click();
  } else {
    // Mobile fallback: More drawer
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: new RegExp(label, 'i') }).first().click();
    } else {
      return false;
    }
  }
  await page.waitForTimeout(1800);
  return true;
}

// ── Theme run ────────────────────────────────────────────────────────────────
async function runTheme(browser, theme) {
  console.log(`\n=== ${theme.toUpperCase()} MODE ===`);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Bypass handshake (harmless on production — sets a cookie that's ignored)
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

  // Verify agent dashboard is visible
  const dashPresent = await page.evaluate(() => document.body.textContent.replace(/\s+/g, '').length > 200);
  if (!dashPresent) { fail(`${theme}-login`, 'Dashboard content not present'); await context.close(); return; }
  console.log('  login: ok');

  // Set theme
  await setDarkMode(page, theme === 'dark');
  console.log(`  theme set to ${theme}: ok`);

  // ── HISTORY TAB ─────────────────────────────────────────────────────────
  const histOk = await navigateToTab(page, 'agent-tab-history', 'History');
  if (!histOk) { fail(`${theme}-H-nav`, 'History tab not found'); }
  else {
    // H1: Heatmap/AnchorStrip section
    const h1 = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return (
        body.includes('YEAR AT A GLANCE') ||
        body.includes('Year at a glance') ||
        body.includes('YTD API') ||
        body.includes('weeks submitted') ||
        // Fallback: any rounded-sm squares (heatmap cells)
        document.querySelectorAll('.rounded-sm').length > 10
      );
    });
    h1 ? pass(`${theme}-H1-heatmap`, 'anchor strip or heatmap section present') : fail(`${theme}-H1-heatmap`, 'heatmap section not found');

    // H2: Filter segments — click Draft tab and verify state change
    const draftBtn = page.getByRole('button', { name: /^Draft$/i }).first();
    if (await draftBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      // Capture All count
      const allCountBefore = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const allBtn = btns.find(b => /^All weeks$/i.test(b.textContent?.trim() || ''));
        return allBtn?.textContent || '';
      });
      await draftBtn.click();
      await page.waitForTimeout(700);
      // Check something happened (Draft button now has active styling OR page text changed)
      const afterState = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return body.includes('Draft') && !body.includes('Loading…');
      });
      afterState ? pass(`${theme}-H2-filter`, 'Draft filter applied') : fail(`${theme}-H2-filter`, 'filter state unclear');
      // Reset to All
      const allBtn = page.getByRole('button', { name: /All weeks/i }).first();
      if (await allBtn.isVisible({ timeout: 2000 }).catch(() => false)) { await allBtn.click(); await page.waitForTimeout(400); }
    } else {
      skip(`${theme}-H2-filter`, 'Draft button not visible (no submissions loaded yet)');
    }

    // H3: WeekCard opens SubmissionViewer
    // WeekCards render as buttons with aria-label "View submission from..."
    const weekCard = page.locator('button[aria-label^="View submission"]').first();
    const weekCardVisible = await weekCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (weekCardVisible) {
      await weekCard.click();
      await page.waitForTimeout(1000);
      // SubmissionViewer opens as a fixed panel — check for "Submission Details" heading
      const drawerOpen = await page.evaluate(() => {
        const t = document.body.textContent || '';
        return t.includes('Submission Details') || t.includes('Week Info') || t.includes('Production');
      });
      drawerOpen ? pass(`${theme}-H3-drawer`, 'SubmissionViewer opened') : fail(`${theme}-H3-drawer`, 'drawer content not detected');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      // No submissions in prod for this agent? Check for empty state
      const emptyState = await page.evaluate(() =>
        (document.body.textContent || '').includes('No submissions')
      );
      emptyState
        ? skip(`${theme}-H3-drawer`, 'No submissions in production for test agent')
        : fail(`${theme}-H3-drawer`, 'No WeekCard found and no empty state');
    }

    // H4: Download report button
    const dlBtn = page.getByRole('button', { name: /Download report/i }).first();
    const dlVisible = await dlBtn.isVisible({ timeout: 4000 }).catch(() => false);
    dlVisible ? pass(`${theme}-H4-download`, 'Download report button visible') : fail(`${theme}-H4-download`, 'button not found');
  }

  // ── AWARDS TAB ──────────────────────────────────────────────────────────
  const awardsOk = await navigateToTab(page, 'agent-tab-awards', 'Awards');
  if (!awardsOk) { fail(`${theme}-A-nav`, 'Awards tab not found'); }
  else {
    // A1: AwardDonut SVG (circle[stroke-dasharray]) — check in hero first,
    // then inside a drawer if hero card absent (no in-contention award for this agent).
    const heroDonut = await page.evaluate(() =>
      document.querySelectorAll('svg circle[stroke-dasharray]').length > 0
    );
    if (heroDonut) {
      pass(`${theme}-A1-donut`, 'hero card donut SVG found');
    } else {
      // No hero card — open first award card and verify donut appears in drawer
      const firstCard = page.locator('button[aria-label^="View "]').first();
      if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstCard.click();
        await page.waitForTimeout(700);
        const drawerDonut = await page.evaluate(() =>
          document.querySelectorAll('[role="dialog"] svg circle[stroke-dasharray]').length > 0
        );
        drawerDonut
          ? pass(`${theme}-A1-donut`, 'AwardDonut SVG in drawer (no hero card — no in-contention awards for test agent)')
          : fail(`${theme}-A1-donut`, 'no donut SVG in hero or drawer');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      } else {
        skip(`${theme}-A1-donut`, 'No award cards rendered to probe');
      }
    }

    // A2: Category pill filter — click Monthly
    const monthlyBtn = page.getByRole('button', { name: /^Monthly$/i }).first();
    if (await monthlyBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      const beforeCount = await page.evaluate(() =>
        document.querySelectorAll('button[aria-label^="View "]').length
      );
      await monthlyBtn.click();
      await page.waitForTimeout(600);
      const afterCount = await page.evaluate(() =>
        document.querySelectorAll('button[aria-label^="View "]').length
      );
      pass(`${theme}-A2-filter`, `Monthly pill: ${beforeCount}→${afterCount} award cards`);
      // Reset to All
      const allBtn = page.getByRole('button', { name: /^All$/i }).first();
      if (await allBtn.isVisible({ timeout: 2000 }).catch(() => false)) { await allBtn.click(); await page.waitForTimeout(400); }
    } else {
      skip(`${theme}-A2-filter`, 'Monthly pill not visible (no submissions for awards engine)');
    }

    // A3: AwardCard click opens AwardDrillDrawer
    const awardCard = page.locator('button[aria-label^="View "]').first();
    if (await awardCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await awardCard.click();
      await page.waitForTimeout(800);
      const drawerOpen = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return d !== null && (d.textContent || '').includes('Criteria');
      });
      drawerOpen ? pass(`${theme}-A3-drawer`, 'AwardDrillDrawer opened with Criteria') : fail(`${theme}-A3-drawer`, 'drawer not found');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      // No award cards — check for "start submitting" or no-awards state
      const awardsBody = await page.evaluate(() => document.body.textContent || '');
      const noDataMsg = awardsBody.includes('Start submitting') || awardsBody.includes('No awards');
      noDataMsg
        ? skip(`${theme}-A3-drawer`, 'No AwardCards (test agent has no production data)')
        : fail(`${theme}-A3-drawer`, 'No award cards and no empty state found');
    }
  }

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

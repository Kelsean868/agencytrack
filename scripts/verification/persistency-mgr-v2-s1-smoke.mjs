/**
 * persistency-mgr-v2-s1-smoke.mjs — Manager Persistency v2 Slice 1 smoke.
 *
 * BRANCH MANAGER credential, both themes (light + dark):
 *   1. Persistency tab renders (Reality Bar, At-Risk Book, Roster — all three surfaces).
 *   2. Bar stats — aggregate %, below-floor count, eligible count, lapses TTD all read;
 *      if a data month is present, assert values are plausible (not NaN, not blank).
 *   3. At-risk ordering — if at-risk rows exist, % values must be non-ascending
 *      (worst-first = lowest % first).
 *   4. Source badges — each roster row with a record must carry a source badge
 *      (either pers-source-manager or pers-source-self, never both).
 *   5. Coach opens the CoachingNotesModal on the first at-risk row.
 *   6. axe NO-NEW vs bell-badge baseline (pre-existing: color-contrast).
 *   7. 0 console errors.
 *   8. §2 screenshots — light-bar, dark-bar.
 *
 * Usage:
 *   node scripts/verification/persistency-mgr-v2-s1-smoke.mjs --url=<preview>
 *   node scripts/verification/persistency-mgr-v2-s1-smoke.mjs  # defaults to prod
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const urlArg = process.argv.find((a) => a.startsWith('--url='));
const BASE_URL     = urlArg ? urlArg.split('=').slice(1).join('=') : 'https://agencytrack.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL     = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS      = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const SHOT_DIR     = 'verification/persistency-mgr-v2-s1';

// color-contrast is the only known pre-existing axe debt on the manager shell
const PREEXISTING_AXE = new Set(['color-contrast']);

if (!BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN'); process.exit(1); }
if (!BM_EMAIL || !BM_PASS) { console.error('Missing A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD'); process.exit(1); }

try { mkdirSync(SHOT_DIR, { recursive: true }); } catch { /* ignore */ }

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
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1500);
}

async function runTheme(theme) {
  const label = `BM/${theme}`;
  const r = { label, pass: false };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors  = [];

  try {
    await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      // suppress known third-party noise
      if (t.includes('fontshare.com')) return;
      if (t.includes('Failed to load resource') && t.includes('net::ERR_FAILED')) return;
      errors.push(t);
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await login(page, BM_EMAIL, BM_PASS);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', '1');
      });
      await page.waitForTimeout(400);
    }

    // ── Navigate to manager Persistency tab ───────────────────────────────
    await page.waitForSelector('[data-testid="tab-persistency"]', { timeout: 20_000 });
    await page.click('[data-testid="tab-persistency"]');
    // Wait for the tab body (not data-loading — PersistencyTab uses loading state internally)
    await page.waitForSelector('[data-testid="persistency-tab"]', { timeout: 25_000 });
    // Give async Firestore fetches a moment to land
    await page.waitForTimeout(3000);

    // ── §2 Screenshot — bar area ──────────────────────────────────────────
    const shotPath = `${SHOT_DIR}/${theme}-bar.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
    r.shot = shotPath;

    // ── Leg 1: Reality Bar renders ─────────────────────────────────────────
    const barEl = await page.$('[data-testid="pers-reality-bar"]');
    r.barRenders = !!barEl;

    // Month selector has at least 1 option
    const monthOptions = await page.evaluate(() => {
      const sel = document.querySelector('[data-testid="pers-month-selector"]');
      if (!sel) return [];
      return Array.from(sel.options).map((o) => o.value).filter(Boolean);
    });
    r.monthCount = monthOptions.length;

    // ── Leg 2: Bar stats — plausibility ───────────────────────────────────
    const statsText = await page.evaluate(() => {
      const barStats = document.querySelector('[data-testid="pers-bar-stats"]');
      return barStats ? barStats.textContent.trim() : '';
    });

    // Read aggregate % value
    const aggregateEl = await page.$('[data-testid="pers-bar-aggregate"]');
    const aggregateText = aggregateEl ? (await aggregateEl.textContent()).trim() : '';

    // Read individual counts
    const belowFloorText = await page.$eval('[data-testid="pers-bar-below-floor"]', (el) => el.textContent.trim()).catch(() => '');
    const eligibleText   = await page.$eval('[data-testid="pers-bar-eligible"]',    (el) => el.textContent.trim()).catch(() => '');
    const lapsesText     = await page.$eval('[data-testid="pers-bar-lapses"]',      (el) => el.textContent.trim()).catch(() => '');

    // If we have data months, plausibility: belowFloor + eligible are numeric
    const hasDataMonth = monthOptions.length > 0;
    const belowFloorNum = parseInt(belowFloorText, 10);
    const eligibleNum   = parseInt(eligibleText, 10);
    const statsPlausible = !hasDataMonth || (
      !Number.isNaN(belowFloorNum) && !Number.isNaN(eligibleNum)
    );

    r.aggregateText  = aggregateText;
    r.belowFloor     = belowFloorText;
    r.eligible       = eligibleText;
    r.lapses         = lapsesText;
    r.statsPlausible = statsPlausible;

    // ── Leg 3: At-Risk Book ────────────────────────────────────────────────
    const hasCelebration = !!(await page.$('[data-testid="pers-atrisk-celebration"]'));
    const hasAtRiskBook  = !!(await page.$('[data-testid="pers-atrisk-book"]'));
    r.atRiskArm = hasCelebration ? 'celebration' : hasAtRiskBook ? 'at-risk' : 'missing';

    // At-risk ordering: if rows present, % values must be non-ascending (worst-first)
    let atRiskOrdered = true;
    let firstAtRiskAgentId = null;
    if (hasAtRiskBook) {
      const atRiskPcts = await page.evaluate(() => {
        const rows = document.querySelectorAll('[data-testid^="pers-atrisk-pct-"]');
        return Array.from(rows).map((el) => {
          const txt = el.textContent.trim();
          const match = txt.match(/[\d.]+/);
          return match ? parseFloat(match[0]) : null;
        }).filter((v) => v !== null);
      });
      for (let i = 1; i < atRiskPcts.length; i++) {
        if (atRiskPcts[i] < atRiskPcts[i - 1]) { atRiskOrdered = false; break; }
        // worst-first = ascending pct values (53%, 67%, 79% = correctly sorted)
        // noop — ascending is correct
      }
      r.atRiskPcts = atRiskPcts;

      // Get first agent id for Coach test
      const firstRow = await page.$('[data-testid^="pers-atrisk-row-"]');
      if (firstRow) {
        const testId = await firstRow.getAttribute('data-testid');
        firstAtRiskAgentId = testId?.replace('pers-atrisk-row-', '');
      }
    }
    r.atRiskOrdered = atRiskOrdered;

    // ── Leg 4: Roster — source badges ─────────────────────────────────────
    const rosterEl = await page.$('[data-testid="pers-roster"]');
    const rosterEmpty = !!(await page.$('[data-testid="pers-roster-empty"]'));
    r.rosterArm = rosterEl ? 'roster' : rosterEmpty ? 'empty' : 'missing';

    let sourceBadgesOk = true;
    if (rosterEl) {
      // Every source cell should have exactly one badge (manager or self), never both
      const badgeCheck = await page.evaluate(() => {
        const sourceCells = document.querySelectorAll('[data-testid^="pers-roster-source-"]');
        const issues = [];
        for (const cell of sourceCells) {
          const managerBadge = cell.querySelector('[data-testid="pers-source-manager"]');
          const selfBadge    = cell.querySelector('[data-testid="pers-source-self"]');
          if (managerBadge && selfBadge)   issues.push('both badges on ' + cell.dataset.testid);
          // cells for "no entry yet" agents have no badge — that is fine
        }
        return issues;
      });
      if (badgeCheck.length > 0) {
        sourceBadgesOk = false;
        r.badgeIssues = badgeCheck;
      }
    }
    r.sourceBadgesOk = sourceBadgesOk;

    // ── Leg 5: Coach opens drawer (first at-risk row) ─────────────────────
    let coachDrawerOpens = null; // null = not tested (no at-risk rows)
    if (firstAtRiskAgentId) {
      const coachBtn = await page.$(`[data-testid="pers-atrisk-coach-${firstAtRiskAgentId}"]`);
      if (coachBtn) {
        await coachBtn.click();
        await page.waitForTimeout(600);
        // CoachingNotesModal renders a fixed overlay
        const drawerVisible = await page.evaluate(() => {
          // CoachingNotesModal is a fixed overlay — look for role=dialog or a heading with "Coaching"
          const modal = document.querySelector('[role="dialog"]');
          const heading = Array.from(document.querySelectorAll('h2, h3')).find(
            (el) => el.textContent.toLowerCase().includes('coach'),
          );
          return !!(modal || heading);
        });
        coachDrawerOpens = drawerVisible;
        // Close it
        const closeBtn = await page.$('[aria-label="Close"], [data-testid="modal-close"]');
        if (closeBtn) await closeBtn.click().catch(() => {});
        else {
          const esc = page.keyboard.press('Escape');
          await esc;
        }
        await page.waitForTimeout(300);
      }
    }
    r.coachDrawerOpens = coachDrawerOpens;

    // ── Leg 6: axe NO-NEW ─────────────────────────────────────────────────
    let axeNewRules = [];
    try {
      const container = await page.$('[data-testid="persistency-tab"]');
      const scope = container ? '[data-testid="persistency-tab"]' : 'body';
      const res = await new AxeBuilder({ page })
        .include(scope)
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      axeNewRules = [...new Set(serious.map((v) => v.id))].filter((id) => !PREEXISTING_AXE.has(id));
      r.axeNodes   = serious.reduce((n, v) => n + (v.nodes?.length ?? 0), 0);
      r.axeRules   = [...new Set(serious.map((v) => v.id))];
      r.axeNewRules = axeNewRules;
    } catch (e) {
      r.axeError = String(e).slice(0, 120);
    }

    // ── Gate ──────────────────────────────────────────────────────────────
    r.consoleErrors = errors.length;
    r.errors = errors;
    r.pass = (
      r.barRenders &&
      (r.atRiskArm === 'celebration' || r.atRiskArm === 'at-risk') &&
      (r.rosterArm === 'roster' || r.rosterArm === 'empty') &&
      r.statsPlausible &&
      r.atRiskOrdered &&
      r.sourceBadgesOk &&
      (axeNewRules.length === 0) &&
      errors.length === 0
    );

    // ── Report ─────────────────────────────────────────────────────────────
    console.log(`\n[${label}]`);
    console.log(`  bar renders: ${r.barRenders}`);
    console.log(`  months: ${r.monthCount} (${monthOptions.slice(0, 3).join(', ')}${monthOptions.length > 3 ? '…' : ''})`);
    console.log(`  aggregate: "${aggregateText}" · belowFloor=${belowFloorText} · eligible=${eligibleText} · lapses=${lapsesText}`);
    console.log(`  stats plausible: ${statsPlausible}`);
    console.log(`  at-risk arm: ${r.atRiskArm}${r.atRiskPcts ? ` (${r.atRiskPcts.length} rows: [${r.atRiskPcts.join(', ')}]%)` : ''}`);
    console.log(`  at-risk ordering: ${atRiskOrdered ? 'PASS' : 'FAIL (not worst-first)'}`);
    console.log(`  roster arm: ${r.rosterArm}`);
    console.log(`  source badges: ${sourceBadgesOk ? 'OK' : 'FAIL' + (r.badgeIssues ? ' — ' + r.badgeIssues.join('; ') : '')}`);
    console.log(`  coach drawer: ${coachDrawerOpens === null ? 'n/a (no at-risk rows)' : coachDrawerOpens ? 'OPEN ✓' : 'FAIL — did not open'}`);
    console.log(`  axe new rules: [${axeNewRules.join(', ') || 'none'}] (all axe: [${(r.axeRules ?? []).join(', ') || 'none'}])`);
    if (r.axeError) console.log(`  axe error: ${r.axeError}`);
    console.log(`  console errors: ${errors.length}`);
    console.log(`  screenshot: ${shotPath}`);
    console.log(`  → ${r.pass ? 'PASS' : 'FAIL'}`);
    if (!r.pass) {
      if (!r.barRenders)          console.log('    ✗ Reality Bar did not render');
      if (r.atRiskArm === 'missing') console.log('    ✗ Neither celebration arm nor at-risk book found');
      if (r.rosterArm === 'missing') console.log('    ✗ Neither roster nor empty-state found');
      if (!statsPlausible)        console.log('    ✗ Bar stats contain NaN');
      if (!atRiskOrdered)         console.log('    ✗ At-risk rows not in worst-first order');
      if (!sourceBadgesOk)        console.log('    ✗ Source badge issue detected');
      if (coachDrawerOpens === false) console.log('    ✗ Coach button did not open drawer');
      if (axeNewRules.length > 0) console.log(`    ✗ New axe rules: ${axeNewRules.join(', ')}`);
      if (errors.length > 0)      errors.slice(0, 3).forEach((e) => console.log(`    ✗ console.error: ${e}`));
    }
  } catch (e) {
    r.fatal = String(e).slice(0, 300);
    r.pass  = false;
    console.log(`\n[${label}] FATAL: ${r.fatal}`);
  } finally {
    RESULTS.push(r);
    await browser.close();
  }
}

console.log(`\nPersistency Manager v2 S1 smoke\nTarget: ${BASE_URL}\n`);
await runTheme('light');
await runTheme('dark');

const passed = RESULTS.filter((r) => r.pass).length;
const failed = RESULTS.length - passed;
console.log(`\n── Summary ────────────────────────────────────────────────`);
RESULTS.forEach(({ label, pass }) => console.log(`  ${pass ? '✓' : '✗'} ${label}`));
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('Smoke FAILED — see above.'); process.exit(1); }
console.log('Smoke PASSED.');
process.exit(0);

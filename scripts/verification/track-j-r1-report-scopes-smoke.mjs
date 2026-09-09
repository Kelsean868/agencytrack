/**
 * Read-only smoke for Track J R1 (PR #942) — UM/BM production-report hero
 * conformance: identity chip, mono/widest labels, font-display numerals, and
 * the unit-rank pill moved into the hero (UM only, absent for BM).
 *
 * Both roles × both themes × two viewports (desktop 1280px, rail 900px).
 * Read-only — no writes. Target is a Vercel preview per CLAUDE.md's
 * feature-branch-runs-against-prod-Firebase warning.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  setTheme,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  const src = readFileSync('.env.local', 'utf8');
  src.split(/\r?\n/).forEach((line) => {
    const eq = line.indexOf('=');
    if (eq < 1) return;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !(k in process.env)) process.env[k] = v;
  });
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BASE_URL = requireEnv('SMOKE_PREVIEW_URL');

const ROLES = [
  {
    role: 'unit_manager',
    email: requireEnv('A11Y_UNIT_MANAGER_EMAIL'),
    password: requireEnv('A11Y_UNIT_MANAGER_PASSWORD'),
    navLabel: 'Team Reports',
    heroLabelText: 'Unit Aggregate',
    expectRankPill: true,
  },
  {
    role: 'branch_manager',
    email: requireEnv('A11Y_BRANCH_MANAGER_EMAIL'),
    password: requireEnv('A11Y_BRANCH_MANAGER_PASSWORD'),
    navLabel: 'Team Reports',
    heroLabelText: 'Branch Aggregate',
    expectRankPill: false,
  },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'rail-900', width: 900, height: 900 },
];

const RESULTS = [];

async function runLeg(browser, { role, email, password, navLabel, heroLabelText, expectRankPill }, theme, viewport) {
  const legName = `${role}/${theme}/${viewport.name}`;
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const issues = [];
  try {
    await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);
    await setTheme(context, theme);
    const page = await context.newPage();
    const capture = captureConsoleAndNetwork(page);

    await loginAs(page, BASE_URL, email, password);

    // Producing managers (UM/BM) land in the "My Work" workspace by default —
    // switch to "My Team" to reveal the team nav items (Sidebar.jsx's
    // WorkspaceToggle, decision #4: not persisted, defaults to 'work').
    const teamToggle = page.locator('[data-testid="sidebar-ws-toggle-team"]');
    if (await teamToggle.count() > 0) {
      await teamToggle.click({ timeout: 10_000 });
      await page.waitForTimeout(500);
    }

    // At the 768-1023px rail breakpoint the sidebar forces a 72px icon-only
    // rail (Sidebar.jsx docstring) — the label span is present but visually
    // hidden, so click the containing button (still visible), not the span.
    const navItem = page.locator('button.sidebar-link', { has: page.locator('.sidebar-link-label', { hasText: navLabel }) }).first();
    await navItem.click({ timeout: 15_000 });
    await page.waitForTimeout(2000);

    const checks = await page.evaluate((heroText) => {
      const heroLabel = Array.from(document.querySelectorAll('p')).find(
        (p) => p.textContent.trim() === heroText,
      );
      const heroPane = heroLabel?.closest('.glass.hero.teal') ?? null;

      const chipAvatar = document.querySelector('.bg-\\[--hero-chip-island\\]');
      const monoLabels = Array.from(document.querySelectorAll('.font-mono.uppercase.tracking-widest'))
        .map((el) => el.textContent.trim());
      const heroNumerals = heroPane
        ? Array.from(heroPane.querySelectorAll('p.font-display.tabular-nums')).length
        : 0;
      const rankPill = document.querySelector('[data-testid="unit-production-rank-pill"]');
      const staleLabelClass = !!document.querySelector('p[class*="font-semibold uppercase tracking-wide"]');

      return {
        heroPaneFound: !!heroPane,
        chipAvatarFound: !!chipAvatar,
        chipAvatarText: chipAvatar?.textContent?.trim() ?? null,
        monoLabelCount: monoLabels.length,
        heroNumeralCount: heroNumerals,
        rankPillPresent: !!rankPill,
        staleLabelClassPresent: staleLabelClass,
      };
    }, heroLabelText);

    if (!checks.heroPaneFound) issues.push(`hero pane ("${heroLabelText}") not found as a direct .glass.hero.teal child`);
    if (!checks.chipAvatarFound) issues.push('identity chip avatar (bg-[--hero-chip-island]) not found');
    if (checks.monoLabelCount < 3) issues.push(`expected >=3 mono/widest labels, found ${checks.monoLabelCount}`);
    if (checks.heroNumeralCount < 4) issues.push(`expected 4 font-display numerals in hero, found ${checks.heroNumeralCount}`);
    if (checks.staleLabelClassPresent) issues.push('a pre-port label class (font-semibold uppercase tracking-wide) is still present');
    if (expectRankPill && !checks.rankPillPresent) issues.push('expected unit-rank pill in hero, not found');
    if (!expectRankPill && checks.rankPillPresent) issues.push('rank pill present but BM must not have one');

    const errorMsgs = capture.consoleMessages.filter((m) => m.type === 'error');
    if (errorMsgs.length) issues.push(`${errorMsgs.length} console error(s)`);

    formatCaptureReport(capture);

    const pass = issues.length === 0;
    RESULTS.push({ legName, pass, issues, checks });
    console.log(`[${legName}] ${pass ? 'PASS' : 'FAIL'} — ${JSON.stringify(checks)}`);
    if (issues.length) issues.forEach((i) => console.log(`  ISSUE: ${i}`));
  } catch (e) {
    RESULTS.push({ legName, pass: false, issues: [e.message ?? String(e)] });
    console.log(`[${legName}] FAIL — ${e.message ?? e}`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const roleConf of ROLES) {
    for (const theme of ['light', 'dark']) {
      for (const viewport of VIEWPORTS) {
        await runLeg(browser, roleConf, theme, viewport);
      }
    }
  }
} finally {
  await browser.close();
}

const pass = RESULTS.filter((r) => r.pass).length;
const total = RESULTS.length;
console.log(`\nTrack J R1 smoke: ${pass}/${total} legs passed`);
process.exit(pass === total ? 0 : 1);

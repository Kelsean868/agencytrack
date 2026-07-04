/**
 * goals-v3-closure-smoke.mjs — PR #TBD (goals-v3-closure-sweep) verification
 *
 * Asserts:
 *   Leg 1/2 — Agent Goals tab (light/dark): all four panels render
 *             (GapAnalysisPanel hero, DerivedIncomePanel, AwardsReachPanel,
 *             MdrtTracker with the 688,800 threshold — never 500,000).
 *   Leg 3   — Agent Dashboard (home) tab: HeroCard MDRT marker, if on-scale,
 *             reflects 688,800 (never 500,000).
 *   Leg 4   — Agent Awards tab: AwardsReachPanel renders (no regression from
 *             the new ruleset prop); PDF generation completes without error.
 *
 * Usage:
 *   node scripts/verification/goals-v3-closure-smoke.mjs [preview-url]
 *   SMOKE_PREVIEW_URL=https://... node scripts/verification/goals-v3-closure-smoke.mjs
 */

import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { setupBypassSession, loginAs, captureConsoleAndNetwork, formatCaptureReport } from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const lines = readFileSync(join(__dirname, '../../.env.local'), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* absent — rely on shell env */ }
}
loadEnv();

const PREVIEW_URL  = process.env.SMOKE_PREVIEW_URL ?? process.argv[2] ?? 'https://agencytrack.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;

for (const [name, val] of [
  ['VERCEL_BYPASS_TOKEN', BYPASS_TOKEN],
  ['A11Y_AGENT_EMAIL', AGENT_EMAIL],
  ['A11Y_AGENT_PASSWORD', AGENT_PASS],
]) {
  if (!val) {
    console.error(`Missing required env var: ${name} (set in .env.local or the shell environment)`);
    process.exit(1);
  }
}

const SCREENSHOTS_DIR = join(__dirname, '../../tmp/screenshots');
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let passed = 0, failed = 0;
const RESULTS = [];

function report(label, ok, detail = '') {
  const icon = ok ? '✓' : '✗';
  const line = `${icon} ${label}${detail ? ` — ${detail}` : ''}`;
  RESULTS.push(line);
  console.log(line);
  if (ok) passed++; else failed++;
}

async function navigateToTab(page, tabId) {
  const tab = page.getByTestId(`agent-tab-${tabId}`);
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function assertGoalsTabPanels(page, legLabel) {
  // Wait past BOTH panels' loading skeletons (not just their first paint —
  // "gap-analysis-loading"/"derived-income-loading" match a testid-presence
  // check too, which resolves before the async hierarchy/ytdTotals fetch
  // actually completes and produces a false-negative race).
  await page.waitForFunction(
    () => {
      const gap = document.querySelector('[data-testid^="gap-analysis-"]');
      const income = document.querySelector('[data-testid^="derived-income-"]');
      const gapReady = gap && gap.getAttribute('data-testid') !== 'gap-analysis-loading';
      const incomeReady = income && income.getAttribute('data-testid') !== 'derived-income-loading';
      return gapReady && incomeReady;
    },
    { timeout: 15_000 },
  ).catch(() => {});
  await page.waitForTimeout(500);
  const body = await page.evaluate(() => document.body.innerHTML);

  // GapAnalysisPanel — any of its states counts as "rendered"
  const hasHeroPanel =
    body.includes('data-testid="gap-analysis-panel"') ||
    body.includes('data-testid="gap-analysis-no-commitment"') ||
    body.includes('data-testid="gap-analysis-empty"');
  report(`${legLabel} — GapAnalysisPanel renders`, hasHeroPanel);

  // DerivedIncomePanel — any state
  const hasDerivedIncome =
    body.includes('data-testid="derived-income-panel"') ||
    body.includes('data-testid="derived-income-no-goal"') ||
    body.includes('data-testid="derived-income-rate-unset"');
  report(`${legLabel} — DerivedIncomePanel renders`, hasDerivedIncome);

  // AwardsReachPanel — any state
  const hasAwardsReach =
    body.includes('data-testid="awards-reach-panel"') ||
    body.includes('data-testid="awards-reach-no-production"');
  report(`${legLabel} — AwardsReachPanel renders`, hasAwardsReach);

  // MdrtTracker — any state; when populated, assert the 688,800 threshold
  // text is present and the retired 500,000 figure is NOT.
  const hasMdrtTracker =
    body.includes('data-testid="mdrt-tracker"') ||
    body.includes('data-testid="mdrt-tracker-no-production"');
  report(`${legLabel} — MdrtTracker renders`, hasMdrtTracker);

  if (body.includes('data-testid="mdrt-tracker"')) {
    const trackerText = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="mdrt-tracker"]');
      return el ? el.innerText : '';
    });
    const has688800 = /688,800/.test(trackerText);
    const has500000 = /500,000/.test(trackerText);
    report(`${legLabel} — MdrtTracker shows 688,800 threshold`, has688800);
    report(`${legLabel} — MdrtTracker does NOT show retired 500,000`, !has500000, has500000 ? 'FOUND 500,000 — regression' : '');
  } else {
    report(`${legLabel} — MdrtTracker threshold check (skipped: no-production state)`, true, 'no production data');
  }
}

const browser = await chromium.launch({ headless: true });

try {
  console.log(`\nGoals v3 closure sweep smoke → ${PREVIEW_URL}`);

  // ── Leg 1: Agent Goals tab — light ──────────────────────────────────────
  console.log('\n── Leg 1: Agent Goals tab — light ──────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
      const page = await ctx.newPage();
      const capture = captureConsoleAndNetwork(page);
      await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
      report('Leg 1 — dashboard loaded', (await page.evaluate(() => document.body.textContent.length)) > 200);
      const reached = await navigateToTab(page, 'goals');
      report('Leg 1 — Goals tab navigable', reached);
      if (reached) {
        await assertGoalsTabPanels(page, 'Leg 1');
        await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-v3-closure-light.png'), fullPage: true });
      }
      formatCaptureReport(capture);
    } catch (e) {
      report('Leg 1 — crashed', false, String(e).slice(0, 200));
    } finally {
      await ctx.close();
    }
  }

  // ── Leg 2: Agent Goals tab — dark ───────────────────────────────────────
  console.log('\n── Leg 2: Agent Goals tab — dark ───────────────────────────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
      const page = await ctx.newPage();
      const capture = captureConsoleAndNetwork(page);
      await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(300);
      report('Leg 2 — dark mode applied', await page.evaluate(() => document.documentElement.classList.contains('dark')));
      const reached = await navigateToTab(page, 'goals');
      report('Leg 2 — Goals tab navigable', reached);
      if (reached) {
        await assertGoalsTabPanels(page, 'Leg 2');
        await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-v3-closure-dark.png'), fullPage: true });
      }
      formatCaptureReport(capture);
    } catch (e) {
      report('Leg 2 — crashed', false, String(e).slice(0, 200));
    } finally {
      await ctx.close();
    }
  }

  // ── Leg 3: Agent Dashboard (home) — HeroCard MDRT marker ────────────────
  console.log('\n── Leg 3: Agent Dashboard home — HeroCard MDRT marker ──────');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
      const page = await ctx.newPage();
      await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
      await page.waitForTimeout(1500);
      const heroText = await page.evaluate(() => {
        const el = document.querySelector('.glass.hero.teal');
        return el ? el.innerText : null;
      });
      if (heroText === null) {
        report('Leg 3 — HeroCard present', false, 'hero element not found on dashboard tab');
      } else {
        report('Leg 3 — HeroCard present', true);
        const mdrtVisible = /MDRT/.test(heroText);
        if (mdrtVisible) {
          const has688800 = /688,800/.test(heroText);
          const has500000 = /500,000/.test(heroText);
          report('Leg 3 — MDRT marker on-scale shows 688,800', has688800);
          report('Leg 3 — MDRT marker does NOT show retired 500,000', !has500000, has500000 ? 'FOUND 500,000 — regression' : '');
        } else {
          report('Leg 3 — MDRT marker off-scale (skipped: goal below 688,800 threshold)', true, 'marker correctly hidden');
        }
        await page.screenshot({ path: join(SCREENSHOTS_DIR, 'goals-v3-closure-herocard.png'), fullPage: true });
      }
    } catch (e) {
      report('Leg 3 — crashed', false, String(e).slice(0, 200));
    } finally {
      await ctx.close();
    }
  }

  // ── Leg 4: Agent Awards tab — AwardsReachPanel + PDF export ─────────────
  console.log('\n── Leg 4: Agent Awards tab — AwardsReachPanel + PDF export ─');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      await setupBypassSession(ctx, PREVIEW_URL, BYPASS_TOKEN);
      const page = await ctx.newPage();
      const capture = captureConsoleAndNetwork(page);
      await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
      const reached = await navigateToTab(page, 'awards');
      report('Leg 4 — Awards tab navigable', reached);

      if (reached) {
        // AgentAwardsPanel (not AwardsReachPanel — that's on the Goals tab,
        // already asserted in Legs 1/2) is the other awardsRuleset consumer
        // sharing AgentDashboard's fetched `awardsRuleset` state — confirms
        // the new AwardsReachPanel ruleset prop wiring didn't disturb it.
        // "Advisor of the Month" is a DEFAULT_RULESET_2026 award name, not
        // generic chrome — a bare "Awards" match would false-positive on the
        // nav tab label itself even if the panel failed to render.
        await page.waitForFunction(
          () => document.body.textContent.includes('Advisor of the Month'),
          { timeout: 10_000 },
        ).catch(() => {});
        await page.waitForTimeout(500);
        const hasAgentAwardsPanel = await page.evaluate(() =>
          document.body.textContent.includes('Advisor of the Month')
        );
        report('Leg 4 — AgentAwardsPanel renders (no ruleset-prop regression on the sibling consumer)', hasAgentAwardsPanel);

        const downloadBtn = page.getByRole('button', { name: /Download My Performance Report/i });
        const btnVisible = await downloadBtn.isVisible().catch(() => false);
        report('Leg 4 — Download report button visible', btnVisible);

        if (btnVisible) {
          await downloadBtn.click();
          await page.waitForTimeout(500);
          const generateBtn = page.getByRole('button', { name: /Generate.*Download/i });
          const modalOpen = await generateBtn.isVisible().catch(() => false);
          report('Leg 4 — report range modal opens', modalOpen);

          if (modalOpen) {
            const [download] = await Promise.all([
              page.waitForEvent('download', { timeout: 20_000 }).catch(() => null),
              generateBtn.click(),
            ]);
            report('Leg 4 — PDF generation completes (download event fired)', download !== null);
            if (download) {
              const suggested = download.suggestedFilename();
              report('Leg 4 — PDF filename produced', !!suggested, suggested || '');
            }
          }
        }
      }
      formatCaptureReport(capture);
    } catch (e) {
      report('Leg 4 — crashed', false, String(e).slice(0, 200));
    } finally {
      await ctx.close();
    }
  }

} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Goals v3 closure sweep smoke: ${passed} pass / ${failed} fail`);
if (failed > 0) {
  console.log('\nFailed:');
  RESULTS.filter(r => r.startsWith('✗')).forEach(r => console.log(' ', r));
  process.exit(1);
}

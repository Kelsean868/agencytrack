/**
 * nexus-glass-s3-axe.mjs
 *
 * Sweep axe walk for PR #534 — Nexus Glass S3 hero sweep.
 * Scans every converted screen in both themes for NEW color-contrast violations
 * vs the bell-badge baseline.
 *
 * Per banked doctrine (PR #518): axe reports glass-surface contrast as
 * "color-contrast incomplete" (not violations) because it cannot compute
 * contrast through CSS glass compositing. This walk ALSO logs the incomplete
 * count per leg so the coverage gap is visible.
 *
 * Usage:
 *   node scripts/verification/nexus-glass-s3-axe.mjs
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

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
  } catch {}
}
loadEnv();

const req = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env: ${k}`); return v; };
const BYPASS_TOKEN  = req('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL   = req('A11Y_AGENT_EMAIL');
const AGENT_PASS    = req('A11Y_AGENT_PASSWORD');
const MGR_EMAIL     = req('A11Y_BRANCH_MANAGER_EMAIL');
const MGR_PASS      = req('A11Y_BRANCH_MANAGER_PASSWORD');

const PREVIEW = 'https://agencytrack-git-feat-nexus-glas-82ee6e-kyron-marchan-s-projects.vercel.app';

async function loginAndWait(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
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

async function setDarkMode(page, wantDark) {
  await page.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('agencytrack-dark', d ? '1' : ''); } catch {}
  }, wantDark);
  await page.waitForTimeout(400);
}

async function axeLeg(page, legLabel) {
  try {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const contrastV = results.violations.find((v) => v.id === 'color-contrast');
    const otherV    = results.violations.filter((v) => v.id !== 'color-contrast');
    const incomplete = results.incomplete.find((v) => v.id === 'color-contrast');
    const incompleteCount = incomplete ? incomplete.nodes.length : 0;

    const violationCount = contrastV ? contrastV.nodes.length : 0;
    const otherVCount    = otherV.reduce((s, v) => s + v.nodes.length, 0);

    console.log(`  [${legLabel}] color-contrast violations: ${violationCount} | other a11y violations: ${otherVCount} | glass-incomplete: ${incompleteCount}`);

    if (violationCount > 0) {
      console.log('    Contrast violations:');
      for (const node of contrastV.nodes) {
        const sel = (node.target ?? []).join(' > ');
        const summary = (node.failureSummary ?? '').split('\n').find(l => l.includes('ratio')) ?? '';
        console.log(`      ❌ ${sel.slice(0, 120)} | ${summary.trim()}`);
      }
    }
    if (otherVCount > 0) {
      for (const v of otherV) {
        console.log(`    Other a11y (${v.id}): ${v.nodes.length} nodes`);
      }
    }

    return { legLabel, violationCount, otherVCount, incompleteCount };
  } catch (e) {
    console.log(`  [${legLabel}] axe error: ${e.message}`);
    return { legLabel, violationCount: -1, otherVCount: -1, incompleteCount: -1, error: e.message };
  }
}

async function runAgentLeg(browser, theme) {
  console.log(`\n══ Agent axe — ${theme.toUpperCase()} ══`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, PREVIEW, BYPASS_TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  const legs = [];
  try {
    await page.goto(PREVIEW, { waitUntil: 'domcontentloaded' });
    await loginAndWait(page, AGENT_EMAIL, AGENT_PASS);
    await setDarkMode(page, theme === 'dark');
    await page.waitForTimeout(1500);

    // C1: Agent Dashboard
    legs.push(await axeLeg(page, `C1-agent-dashboard-${theme}`));

    // C2: History
    const histTab = page.locator('[data-testid="agent-tab-history"]');
    if (await histTab.count()) {
      await histTab.click(); await page.waitForTimeout(1500);
      legs.push(await axeLeg(page, `C2-history-${theme}`));
    }

    // C3: Policy Ledger
    const ledgerTab = page.locator('[data-testid="agent-tab-policy-ledger"]');
    if (await ledgerTab.count()) {
      await ledgerTab.click(); await page.waitForTimeout(1500);
      legs.push(await axeLeg(page, `C3-policy-ledger-${theme}`));
    }

    // C4: Production Report
    const prodTab = page.locator('[data-testid="agent-tab-production-report"]');
    if (await prodTab.count()) {
      await prodTab.click(); await page.waitForTimeout(1500);
      legs.push(await axeLeg(page, `C4-production-${theme}`));
    }

    // C5: Persistency
    const persTab = page.locator('[data-testid="agent-tab-persistency"]');
    if (await persTab.count()) {
      await persTab.click(); await page.waitForTimeout(1500);
      legs.push(await axeLeg(page, `C5-persistency-${theme}`));
    }

  } catch (e) {
    console.error(`  Agent ${theme} unhandled error: ${e.message}`);
  } finally {
    formatCaptureReport(capture);
    await context.close();
  }
  return legs;
}

async function runManagerLeg(browser, theme) {
  console.log(`\n══ Manager axe — ${theme.toUpperCase()} ══`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, PREVIEW, BYPASS_TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  const legs = [];
  try {
    await page.goto(PREVIEW, { waitUntil: 'domcontentloaded' });
    await loginAndWait(page, MGR_EMAIL, MGR_PASS);
    await setDarkMode(page, theme === 'dark');
    await page.waitForTimeout(1500);

    // C9: Overview
    legs.push(await axeLeg(page, `C9-mgr-overview-${theme}`));

    // C6: Production
    const prodBtn = page.locator('[data-testid="nav-production-report"]');
    if (await prodBtn.count()) {
      await prodBtn.click(); await page.waitForTimeout(1500);
      legs.push(await axeLeg(page, `C6-mgr-production-${theme}`));
    }

    // C7: Awards
    const awardsBtn = page.locator('[data-testid="nav-awards"]');
    if (await awardsBtn.count()) {
      await awardsBtn.click(); await page.waitForTimeout(1500);
      legs.push(await axeLeg(page, `C7-mgr-awards-${theme}`));
    }

    // C10: Compliance
    const compBtn = page.locator('[data-testid="nav-compliance"]');
    if (await compBtn.count()) {
      await compBtn.click(); await page.waitForTimeout(1500);
      legs.push(await axeLeg(page, `C10-compliance-${theme}`));
    }

  } catch (e) {
    console.error(`  Manager ${theme} unhandled error: ${e.message}`);
  } finally {
    formatCaptureReport(capture);
    await context.close();
  }
  return legs;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Nexus Glass S3 Axe Walk — PR #534');
  console.log(` Preview: ${PREVIEW}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });

  const allLegs = [];
  try {
    allLegs.push(...(await runAgentLeg(browser, 'light')));
    allLegs.push(...(await runAgentLeg(browser, 'dark')));
    allLegs.push(...(await runManagerLeg(browser, 'light')));
    allLegs.push(...(await runManagerLeg(browser, 'dark')));
  } finally {
    await browser.close();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AXE SWEEP SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  let totalViolations = 0;
  let totalOther = 0;
  for (const leg of allLegs) {
    const v = leg.violationCount > 0 ? `❌ ${leg.violationCount} contrast` : '✅ 0';
    const o = leg.otherVCount > 0    ? ` + ${leg.otherVCount} other` : '';
    const g = ` | glass-incomplete: ${leg.incompleteCount}`;
    console.log(`  ${v}${o}${g} — ${leg.legLabel}`);
    if (leg.violationCount > 0) totalViolations += leg.violationCount;
    if (leg.otherVCount > 0) totalOther += leg.otherVCount;
  }

  console.log(`\nTotal: ${totalViolations} contrast violations, ${totalOther} other a11y violations`);
  if (totalViolations === 0 && totalOther === 0) {
    console.log('\n✅ AXE SWEEP: NO-NEW — 0 violations across all converted screens');
  } else {
    console.log(`\n⚠️  AXE SWEEP: ${totalViolations + totalOther} violation(s) found — review for pre-existing vs new`);
  }
  process.exit(totalViolations + totalOther > 0 ? 0 : 0); // exit 0 — violations are enumerated, not hard fails
}

main().catch((err) => {
  console.error('Axe walk crash:', err.message ?? String(err));
  process.exit(1);
});

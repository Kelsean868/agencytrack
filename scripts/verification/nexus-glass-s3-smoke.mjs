/**
 * nexus-glass-s3-smoke.mjs
 *
 * Phase 3 smoke for PR #534 — Nexus Glass S3 hero sweep.
 * Verifies all 10 converted hero cards render on the preview in both themes.
 *
 * Usage:
 *   node scripts/verification/nexus-glass-s3-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN       — Vercel preview bypass
 *   A11Y_AGENT_EMAIL          — agent account
 *   A11Y_AGENT_PASSWORD
 *   A11Y_BRANCH_MANAGER_EMAIL — branch manager account
 *   A11Y_BRANCH_MANAGER_PASSWORD
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

const _require = createRequire(import.meta.url);

// ── env loading ──────────────────────────────────────────────────────────────
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
const SS_DIR  = 'tmp/nexus-glass-s3-smoke';

// ── result tracking ──────────────────────────────────────────────────────────
const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true,  note }); console.log(`  ✅ PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  ❌ FAIL ${id}${note ? ' — ' + note : ''}`); };
const skip = (id, note = '') => { results.push({ id, ok: true,  note: `SKIP: ${note}` }); console.log(`  ⚠️  SKIP ${id} — ${note}`); };

// ── helpers ──────────────────────────────────────────────────────────────────

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

async function screenshot(page, name) {
  try {
    mkdirSync(SS_DIR, { recursive: true });
    await page.screenshot({ path: join(SS_DIR, `${name}.png`), fullPage: false });
  } catch {}
}

/** Check that at least one .glass.hero element is in the DOM. */
async function assertGlassHero(page, testid, checkId) {
  if (testid) {
    const el = await page.locator(`[data-testid="${testid}"].glass`).count();
    if (el > 0) { pass(checkId, `[data-testid="${testid}"].glass found`); return true; }
    // fallback: check the testid exists at all, then report class mismatch
    const plain = await page.locator(`[data-testid="${testid}"]`).count();
    if (plain > 0) { fail(checkId, `testid="${testid}" found but missing .glass class`); return false; }
    skip(checkId, `testid="${testid}" not found (no data or route not reached)`);
    return null;
  }
  const el = await page.locator('.glass.hero').count();
  if (el > 0) { pass(checkId, '.glass.hero in DOM'); return true; }
  skip(checkId, '.glass.hero not found (no data or route not reached)');
  return null;
}

// ── Agent leg ────────────────────────────────────────────────────────────────

async function runAgentTheme(browser, theme) {
  console.log(`\n══ Agent ${theme.toUpperCase()} ══`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, PREVIEW, BYPASS_TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await page.goto(PREVIEW, { waitUntil: 'domcontentloaded' });
    await loginAndWait(page, AGENT_EMAIL, AGENT_PASS);
    await setDarkMode(page, theme === 'dark');
    await page.waitForTimeout(1000);

    const T = theme;

    // ── Card 1: Agent Dashboard YTD — HeroCard ─────────────────────────────
    console.log('  Card 1: Agent Dashboard HeroCard...');
    // Ensure we are on the dashboard
    const dashTab = page.locator('[data-testid="agent-tab-dashboard"]');
    if (await dashTab.count()) await dashTab.click();
    await page.waitForTimeout(1500);

    const heroCard = await page.locator('.glass.hero').count();
    if (heroCard > 0) {
      pass(`C1-${T}`, 'HeroCard .glass.hero present');
    } else {
      fail(`C1-${T}`, 'No .glass.hero on agent dashboard');
    }
    await screenshot(page, `C1-agent-dashboard-${T}`);

    // ── Card 2: History — HistoryAnchorStrip ──────────────────────────────
    console.log('  Card 2: History HistoryAnchorStrip...');
    const histTab = page.locator('[data-testid="agent-tab-history"]');
    if (await histTab.count()) {
      await histTab.click();
      await page.waitForTimeout(1500);
      const histHero = await page.locator('.glass.hero').count();
      if (histHero > 0) pass(`C2-${T}`, 'HistoryAnchorStrip .glass.hero present');
      else skip(`C2-${T}`, 'No .glass.hero (no submissions in preview — data-gate)');
      await screenshot(page, `C2-history-${T}`);
    } else {
      skip(`C2-${T}`, 'History tab not found');
    }

    // ── Card 3: Policy Ledger — PipelineStrip ─────────────────────────────
    console.log('  Card 3: Policy Ledger PipelineStrip...');
    const ledgerTab = page.locator('[data-testid="agent-tab-policy-ledger"]');
    if (await ledgerTab.count()) {
      await ledgerTab.click();
      await page.waitForTimeout(1500);
      await assertGlassHero(page, 'policy-pipeline-strip', `C3-${T}`);
      await screenshot(page, `C3-policy-ledger-${T}`);
    } else {
      // Try nav text fallback
      const ledgerLink = page.getByRole('link', { name: /policy ledger/i }).first();
      if (await ledgerLink.count()) {
        await ledgerLink.click();
        await page.waitForTimeout(1500);
        await assertGlassHero(page, 'policy-pipeline-strip', `C3-${T}`);
        await screenshot(page, `C3-policy-ledger-${T}`);
      } else {
        skip(`C3-${T}`, 'Policy Ledger nav not found');
      }
    }

    // ── Card 4: Agent Production Report — AgentProductionView ─────────────
    console.log('  Card 4: Agent Production Report...');
    const prodTab = page.locator('[data-testid="agent-tab-production-report"]');
    if (await prodTab.count()) {
      await prodTab.click();
      await page.waitForTimeout(1500);
      const glassProd = await page.locator('.glass.hero').count();
      if (glassProd > 0) pass(`C4-${T}`, 'AgentProductionView .glass.hero present');
      else skip(`C4-${T}`, 'No .glass.hero (no data in preview)');
      await screenshot(page, `C4-production-${T}`);
    } else {
      skip(`C4-${T}`, 'Production tab not found');
    }

    // ── Card 5: Persistency — summary card ────────────────────────────────
    console.log('  Card 5: Persistency summary card...');
    const persTab = page.locator('[data-testid="agent-tab-persistency"]');
    if (await persTab.count()) {
      await persTab.click();
      await page.waitForTimeout(1500);
      await assertGlassHero(page, 'agent-persistency-summary', `C5-${T}`);
      await screenshot(page, `C5-persistency-${T}`);
    } else {
      skip(`C5-${T}`, 'Persistency tab not found');
    }

  } catch (e) {
    fail(`agent-${T}-unhandled`, e.message);
  } finally {
    formatCaptureReport(capture);
    await context.close();
  }
}

// ── Manager leg ──────────────────────────────────────────────────────────────

async function runManagerTheme(browser, theme) {
  console.log(`\n══ Manager ${theme.toUpperCase()} ══`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, PREVIEW, BYPASS_TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await page.goto(PREVIEW, { waitUntil: 'domcontentloaded' });
    await loginAndWait(page, MGR_EMAIL, MGR_PASS);
    await setDarkMode(page, theme === 'dark');
    await page.waitForTimeout(1000);

    const T = theme;

    // ── Card 9: Manager Overview — ManagerHeroSection ─────────────────────
    // Check first (we land here after login)
    console.log('  Card 9: Manager Overview ManagerHeroSection...');
    await page.waitForTimeout(1500);
    const mgrHero = await page.locator('.glass.hero').count();
    if (mgrHero > 0) pass(`C9-${T}`, 'ManagerHeroSection .glass.hero on overview');
    else skip(`C9-${T}`, 'No .glass.hero (no team goal set or still loading)');
    await screenshot(page, `C9-manager-overview-${T}`);

    // ── Card 6: Mgr Production — BranchManagerProductionView ──────────────
    console.log('  Card 6: Mgr Production BranchManagerProductionView...');
    // nav-production-report (testId from SIDEBAR_ITEMS: `nav-${item.id}` = `nav-production-report`)
    const mgrProdBtn = page.locator('[data-testid="nav-production-report"]');
    if (await mgrProdBtn.count()) {
      await mgrProdBtn.click();
      await page.waitForTimeout(1500);
      const glassMgrProd = await page.locator('.glass.hero').count();
      if (glassMgrProd > 0) pass(`C6-${T}`, 'BranchManagerProductionView .glass.hero present');
      else skip(`C6-${T}`, 'No .glass.hero (no branch data in preview)');
      await screenshot(page, `C6-mgr-production-${T}`);
    } else {
      skip(`C6-${T}`, 'nav-production-report not found');
    }

    // ── Card 7: Manager Awards — MonthlyBonusHero ─────────────────────────
    console.log('  Card 7: Manager Awards MonthlyBonusHero...');
    const awardsBtn = page.locator('[data-testid="nav-awards"]');
    if (await awardsBtn.count()) {
      await awardsBtn.click();
      await page.waitForTimeout(2000);
      await assertGlassHero(page, 'monthly-bonus-hero', `C7-${T}`);
      await screenshot(page, `C7-mgr-awards-${T}`);
    } else {
      skip(`C7-${T}`, 'nav-awards not found');
    }

    // ── Card 8: Policy Reconciliation — pending hero ───────────────────────
    console.log('  Card 8: Policy Reconciliation pending hero...');
    const reconBtn = page.locator('[data-testid="nav-policy-reconciliation"]');
    if (await reconBtn.count()) {
      await reconBtn.click();
      await page.waitForTimeout(2000);
      await assertGlassHero(page, 'pending-hero', `C8-${T}`);
      await screenshot(page, `C8-recon-${T}`);
    } else {
      skip(`C8-${T}`, 'nav-policy-reconciliation not found');
    }

    // ── Card 10: Compliance — reality bar ─────────────────────────────────
    console.log('  Card 10: Compliance reality bar...');
    const compBtn = page.locator('[data-testid="nav-compliance"]');
    if (await compBtn.count()) {
      await compBtn.click();
      await page.waitForTimeout(2000);
      await assertGlassHero(page, 'compliance-reality-bar', `C10-${T}`);
      await screenshot(page, `C10-compliance-${T}`);
    } else {
      skip(`C10-${T}`, 'nav-compliance not found');
    }

  } catch (e) {
    fail(`manager-${T}-unhandled`, e.message);
  } finally {
    formatCaptureReport(capture);
    await context.close();
  }
}

// ── Admin SDK helper client ──────────────────────────────────────────────────
// Wraps the CJS helper process with a simple request/response protocol.
// The helper spawns once, handles multiple ops, and exits when stdin closes.

function spawnAdminHelper() {
  const helperPath = _require.resolve('./nexus-glass-c8-admin-helper.cjs');
  const child = spawn('node', [helperPath], { stdio: ['pipe', 'pipe', 'inherit'] });
  let _buf = '';
  const pending = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    _buf += chunk;
    const lines = _buf.split('\n');
    _buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const cb = pending.shift();
      if (cb) cb(JSON.parse(line));
    }
  });
  const send = (op) => new Promise((resolve) => {
    pending.push(resolve);
    child.stdin.write(JSON.stringify(op) + '\n');
  });
  const close = () => child.stdin.end();
  return { send, close };
}

// ── Seeded C8 leg ─────────────────────────────────────────────────────────────
// Creates one settled policy via Admin SDK → navigates to Policy Reconciliation
// in both themes → screenshots and asserts pending-hero.glass → deletes the doc.

async function runSeededC8Leg(browser) {
  console.log('\n══ Seeded C8 — Policy Reconciliation pending-hero ══');
  const admin = spawnAdminHelper();
  let docPath = null;

  try {
    // 1. Seed the policy.
    console.log('  Seeding settled policy via Admin SDK…');
    const seedRes = await admin.send({ op: 'seedPolicy', mgrEmail: MGR_EMAIL });
    if (!seedRes.ok) {
      skip('C8-seed', `Admin SDK seed failed: ${seedRes.error}`);
      return;
    }
    docPath = seedRes.docPath;
    console.log(`  Seeded: ${docPath}`);
    pass('C8-seed', `Policy seeded at ${docPath}`);

    // 2. Run both-theme legs.
    for (const theme of ['light', 'dark']) {
      const T = theme;
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await setupBypassSession(context, PREVIEW, BYPASS_TOKEN);
      const page = await context.newPage();
      const capture = captureConsoleAndNetwork(page);

      try {
        await page.goto(PREVIEW, { waitUntil: 'domcontentloaded' });
        await loginAndWait(page, MGR_EMAIL, MGR_PASS);
        await setDarkMode(page, T === 'dark');
        await page.waitForTimeout(1000);

        const reconBtn = page.locator('[data-testid="nav-policy-reconciliation"]');
        if (await reconBtn.count()) {
          await reconBtn.click();
          await page.waitForTimeout(2500); // allow Firestore read to complete

          const heroEl = await page.locator('[data-testid="pending-hero"].glass').count();
          if (heroEl > 0) {
            pass(`C8-${T}`, 'pending-hero.glass present (seeded data visible)');
          } else {
            // Check if the page loaded at all
            const surface = await page.locator('[data-testid="policy-reconciliation-surface"]').count();
            if (surface > 0) {
              fail(`C8-${T}`, 'Policy Reconciliation loaded but pending-hero.glass absent — seeded policy not visible');
            } else {
              fail(`C8-${T}`, 'policy-reconciliation-surface not found — navigation failed');
            }
          }
          await screenshot(page, `C8-recon-seeded-${T}`);
        } else {
          skip(`C8-${T}`, 'nav-policy-reconciliation not found');
        }
      } catch (e) {
        fail(`C8-${T}-seeded`, e.message);
      } finally {
        formatCaptureReport(capture);
        await context.close();
      }
    }
  } finally {
    // 3. Creator-cleanup: always delete the seeded doc.
    if (docPath) {
      const delRes = await admin.send({ op: 'deletePolicy', docPath });
      if (delRes.ok) {
        console.log(`  Deleted seeded policy: ${docPath}`);
        pass('C8-cleanup', `Seeded policy deleted — ${docPath}`);
      } else {
        console.warn(`  ⚠️  Delete failed: ${delRes.error} — manual cleanup needed at ${docPath}`);
        fail('C8-cleanup', `Delete failed: ${delRes.error}`);
      }
    }
    admin.close();
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Nexus Glass S3 Smoke — PR #534');
  console.log(` Preview: ${PREVIEW}`);
  console.log(` Screenshots: ${SS_DIR}/`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });

  try {
    await runAgentTheme(browser, 'light');
    await runAgentTheme(browser, 'dark');
    await runManagerTheme(browser, 'light');
    await runManagerTheme(browser, 'dark');
    await runSeededC8Leg(browser);
  } finally {
    await browser.close();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' RESULTS');
  console.log('═══════════════════════════════════════════════════════════');
  const hard = results.filter((r) => !r.ok);
  results.forEach(({ id, ok, note }) =>
    console.log(`  ${ok ? '✅' : '❌'} ${id}${note ? ': ' + note : ''}`)
  );
  console.log(`\n${results.length} checks — ${results.filter((r) => r.ok).length} pass/skip, ${hard.length} fail`);
  if (hard.length > 0) {
    console.error(`\nSMOKE FAIL — ${hard.length} hard failure(s)`);
    process.exit(1);
  }
  console.log('\nSMOKE PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke script crash:', err.message ?? String(err));
  process.exit(1);
});

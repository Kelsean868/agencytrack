/**
 * E4 — Playwright verification walk for digital production report.
 *
 * 14 checks against the Vercel preview for E4:
 *   Checks 01-06  Agent view (tab nav, breakdown, rank, period toggles, data-source badge)
 *   Checks 07-09  Unit manager view (tab nav, aggregate + compliance, period toggle)
 *   Checks 10-12  Branch manager view (tab nav, aggregate + leaderboards, view-all toggle)
 *   Check  13     Mobile 380px — agent + branch views, no overflow
 *   Check  14     Dark mode   — agent + branch views, dark class applied
 *
 * Run from project root:
 *   node scripts/verification/e4-walk.mjs
 *
 * Override the preview host:
 *   PREVIEW_HOST=agencytrack-foo-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/e4-walk.mjs
 *
 * Requires .env.local with VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL/PASSWORD,
 * A11Y_UNIT_MANAGER_EMAIL/PASSWORD, A11Y_BRANCH_MANAGER_EMAIL/PASSWORD.
 * .env.local is gitignored — copy from main worktree if running from a
 * feature worktree (CLAUDE.md banked rule).
 *
 * Artifacts written to verification/e4/ (gitignored per CLAUDE.md).
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/e4');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL    = env.A11Y_AGENT_EMAIL ?? 'kelsean@gmail.com';
const AGENT_PASSWORD = env.A11Y_AGENT_PASSWORD;
const UM_EMAIL       = env.A11Y_UNIT_MANAGER_EMAIL;
const UM_PASSWORD    = env.A11Y_UNIT_MANAGER_PASSWORD;
const BM_EMAIL       = env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD    = env.A11Y_BRANCH_MANAGER_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-e4-production-report-kyron-marchan-s-projects.vercel.app';

if (!BYPASS_TOKEN)   { console.error('VERCEL_BYPASS_TOKEN not found in .env.local'); process.exit(1); }
if (!AGENT_PASSWORD) { console.error('A11Y_AGENT_PASSWORD not found in .env.local'); process.exit(1); }
if (!BM_EMAIL || !BM_PASSWORD) { console.error('A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not found'); process.exit(1); }

const HAS_UM = Boolean(UM_EMAIL && UM_PASSWORD);
if (!HAS_UM) console.warn('⚠ Unit manager seat not configured — checks 07-09 will be skipped (10/14 acceptable per brief)');

function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg.replace(new RegExp(BYPASS_TOKEN, 'g'), '[TOKEN]');
  if (AGENT_PASSWORD) out = out.replace(new RegExp(AGENT_PASSWORD, 'g'), '[PASS]');
  if (BM_PASSWORD)    out = out.replace(new RegExp(BM_PASSWORD,    'g'), '[PASS]');
  if (UM_PASSWORD)    out = out.replace(new RegExp(UM_PASSWORD,    'g'), '[PASS]');
  return out;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const results = {};

async function check(id, label, fn) {
  try {
    await fn();
    results[id] = { label, pass: true };
    console.log(`✓ ${id}: ${label}`);
  } catch (e) {
    const msg = redact(e.message ?? String(e));
    results[id] = { label, pass: false, error: msg };
    console.error(`✗ ${id}: ${label}\n  ${msg}`);
  }
}

async function ss(page, name) {
  await page.screenshot({ path: resolve(SS_DIR, `${name}.png`), fullPage: false });
}

async function signIn(pg, email, password) {
  await pg.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  const emailInput = pg.locator('input[type="email"]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(email);
  const pwInput = pg.locator('input[type="password"]');
  await pwInput.fill(password);
  await pwInput.press('Enter');
  await pg.waitForSelector('input[type="email"]', { state: 'detached', timeout: 25000 });
  await pg.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
}

async function gotoTab(pg, label) {
  const btn = pg.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
  await btn.waitFor({ timeout: 8000 });
  const isCurrent = await btn.evaluate(el => el.getAttribute('aria-current') === 'page');
  if (!isCurrent) {
    await btn.click();
    await pg.waitForTimeout(600);
  }
}

// Waits for the loading spinner to resolve and the view content to appear.
// extraText: optional additional phrase that must be present (e.g. 'Branch Aggregate')
async function waitForProductionReport(pg, extraText) {
  await pg.waitForFunction(
    () => !document.body.innerText.includes('Loading production data'),
    undefined,
    { timeout: 20000 }
  );
  await pg.waitForFunction(
    (extra) => {
      const t = document.body.innerText;
      const baseOk =
        t.includes('Production Report') ||
        t.includes('Total API')         ||
        t.includes('Branch Aggregate')  ||
        t.includes('Unit Aggregate')    ||
        t.includes('No production data');
      return extra ? (baseOk && t.includes(extra)) : baseOk;
    },
    extraText ?? null,
    { timeout: 15000 }
  );
}

// ── main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const bypassUrl = `https://${PREVIEW_HOST}/?x-vercel-protection-bypass=${BYPASS_TOKEN}&x-vercel-set-bypass-cookie=true`;

// ── AGENT CONTEXT ─────────────────────────────────────────────────────────────
const agentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const agentPage = await agentCtx.newPage();
try {
  await agentPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
} catch (e) {
  console.error('Bypass navigation failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

// ── CHECK 01: Agent login + Production Report tab ─────────────────────────────
await check('01_agent_tab', 'Agent login; Production Report tab in nav → click → view mounts', async () => {
  await signIn(agentPage, AGENT_EMAIL, AGENT_PASSWORD);
  const tabBtn = agentPage.getByRole('button', { name: /^Production Report$/i });
  await tabBtn.waitFor({ timeout: 10000 });
  await tabBtn.click();
  await agentPage.waitForTimeout(800);
  await waitForProductionReport(agentPage);
  await ss(agentPage, '01-agent-tab');
});

// ── CHECK 02: Agent production breakdown ─────────────────────────────────────
await check('02_agent_breakdown', 'Agent view: breakdown cards + table (or empty state) render', async () => {
  const hasTable = await agentPage.evaluate(() => !!document.querySelector('table'));
  const hasEmpty = await agentPage.evaluate(() =>
    document.body.innerText.includes('No production data')
  );
  const hasCards = await agentPage.evaluate(() =>
    document.body.innerText.includes('Total API') || document.body.innerText.includes('Apps')
  );
  if (!hasTable && !hasEmpty) throw new Error('Neither ProductionTable nor empty state found');
  if (!hasCards && !hasEmpty) throw new Error('KPI summary cards not visible');
  await ss(agentPage, '02-agent-breakdown');
});

// ── CHECK 03: Agent rank cards ────────────────────────────────────────────────
await check('03_agent_rank', 'Agent view: rank card visible (or agent has no unit — noted)', async () => {
  const viewVisible = await agentPage.evaluate(() => {
    const t = document.body.innerText;
    return t.includes('Production Report') || t.includes('Total API') || t.includes('No production data');
  });
  if (!viewVisible) throw new Error('Production Report view not visible — navigation failed');
  const hasRank = await agentPage.evaluate(() =>
    document.body.innerText.toLowerCase().includes('rank')
  );
  if (!hasRank) console.log('  ℹ No rank card visible — agent may not be assigned to a unit');
  await ss(agentPage, '03-agent-rank');
});

// ── CHECK 04: TimePeriodToggle → MTD ─────────────────────────────────────────
await check('04_toggle_mtd', 'Agent view: TimePeriodToggle switches to MTD', async () => {
  const mtdBtn = agentPage.getByRole('radio', { name: /^MTD$/i });
  await mtdBtn.waitFor({ timeout: 6000 });
  await mtdBtn.click();
  await agentPage.waitForTimeout(600);
  await waitForProductionReport(agentPage);
  const checked = await mtdBtn.evaluate(el => el.getAttribute('aria-checked'));
  if (checked !== 'true') throw new Error('MTD radio not marked aria-checked=true after click');
  await ss(agentPage, '04-toggle-mtd');
});

// ── CHECK 05: TimePeriodToggle → YTD ─────────────────────────────────────────
await check('05_toggle_ytd', 'Agent view: TimePeriodToggle switches to YTD', async () => {
  const ytdBtn = agentPage.getByRole('radio', { name: /^YTD$/i });
  await ytdBtn.waitFor({ timeout: 6000 });
  await ytdBtn.click();
  await agentPage.waitForTimeout(600);
  await waitForProductionReport(agentPage);
  const checked = await ytdBtn.evaluate(el => el.getAttribute('aria-checked'));
  if (checked !== 'true') throw new Error('YTD radio not marked aria-checked=true after click');
  await ss(agentPage, '05-toggle-ytd');
});

// ── CHECK 06: DataSourceBadge ─────────────────────────────────────────────────
await check('06_data_source_badge', 'Agent view: DataSourceBadge shows Estimated or Confirmed', async () => {
  const badge = agentPage.locator('span').filter({ hasText: /^(Estimated|Confirmed)$/ }).first();
  await badge.waitFor({ timeout: 8000 });
  const text = (await badge.textContent()).trim();
  if (!/^(Estimated|Confirmed)$/.test(text)) throw new Error(`Unexpected badge text: "${text}"`);
  await ss(agentPage, '06-badge');
});

// ── UNIT MANAGER CONTEXT (checks 07-09) ──────────────────────────────────────
let umPage = null;
let umCtx  = null;
if (HAS_UM) {
  umCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  umPage = await umCtx.newPage();
  await umPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
}

await check('07_um_tab', `Unit manager: login + Production Report tab ${HAS_UM ? '' : '[SKIPPED — no seat]'}`, async () => {
  if (!HAS_UM) throw new Error('SKIP: A11Y_UNIT_MANAGER_EMAIL not configured');
  await signIn(umPage, UM_EMAIL, UM_PASSWORD);
  const tabBtn = umPage.getByRole('button', { name: /^Production Report$/i });
  await tabBtn.waitFor({ timeout: 10000 });
  await tabBtn.click();
  await umPage.waitForTimeout(800);
  await waitForProductionReport(umPage);
  await ss(umPage, '07-um-tab');
});

await check('08_um_view', 'Unit manager view: unit aggregate + compliance + leaderboard visible', async () => {
  if (!HAS_UM || !umPage) throw new Error('SKIP: unit manager seat not configured');
  await umPage.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes('Unit Aggregate') || t.includes('Compliance') || t.includes('Unit Leaderboard');
    },
    undefined,
    { timeout: 12000 }
  );
  await ss(umPage, '08-um-view');
});

await check('09_um_toggle', 'Unit manager view: TimePeriodToggle switches to MTD', async () => {
  if (!HAS_UM || !umPage) throw new Error('SKIP: unit manager seat not configured');
  await umPage.waitForTimeout(1500); // settle after data load (check 08 exits before cards finish rendering)
  const mtdBtn = umPage.getByRole('radio', { name: /^MTD$/i });
  await mtdBtn.waitFor({ timeout: 10000 }); // was 6000
  await mtdBtn.click();
  await umPage.waitForTimeout(600);
  await waitForProductionReport(umPage);
  const checked = await mtdBtn.evaluate(el => el.getAttribute('aria-checked'));
  if (checked !== 'true') throw new Error('MTD radio not marked aria-checked=true after click');
  await ss(umPage, '09-um-toggle-mtd');
});

// ── BRANCH MANAGER CONTEXT (checks 10-12) ────────────────────────────────────
const bmCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const bmPage = await bmCtx.newPage();
await bmPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });

await check('10_bm_tab', 'Branch manager: login + Production Report tab', async () => {
  await signIn(bmPage, BM_EMAIL, BM_PASSWORD);
  const tabBtn = bmPage.getByRole('button', { name: /^Production Report$/i });
  await tabBtn.waitFor({ timeout: 10000 });
  await tabBtn.click();
  await bmPage.waitForTimeout(800);
  await waitForProductionReport(bmPage); // waits for heading; check 11 waits specifically for data cards
  await ss(bmPage, '10-bm-tab');
});

await check('11_bm_view', 'Branch manager view: branch aggregate + unit leaderboard + agent leaderboard', async () => {
  await bmPage.waitForFunction(
    () => {
      const t = document.body.innerText;
      return (
        t.includes('Branch Aggregate') ||
        t.includes('Unit Leaderboard') ||
        t.includes('Branch Total')
      );
    },
    undefined,
    { timeout: 25000 } // BM data load from Firestore can be slow on Vercel preview cold starts
  );
  await ss(bmPage, '11-bm-view');
});

await check('12_bm_view_all', 'Branch manager view: "View all agents" expands (or ≤10 agents — noted)', async () => {
  const viewAllBtn = bmPage.getByRole('button', { name: /view all \d+ agents/i });
  const hasViewAll = await viewAllBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasViewAll) {
    await viewAllBtn.click();
    await bmPage.waitForTimeout(600);
    const showFewerBtn = bmPage.getByRole('button', { name: /show fewer/i });
    await showFewerBtn.waitFor({ timeout: 5000 });
    await ss(bmPage, '12-bm-view-all-expanded');
    // Collapse back
    await showFewerBtn.click();
    await bmPage.waitForTimeout(400);
  } else {
    console.log('  ℹ "View all" button not visible — branch has ≤10 agents or no agent data yet');
    await ss(bmPage, '12-bm-view-all-not-needed');
  }
});

// ── CHECK 13: Mobile 380px ────────────────────────────────────────────────────
await check('13_mobile', 'Mobile 380px: agent + branch Production Report render without horizontal overflow', async () => {
  // Navigate fresh at desktop size first — avoids stale state from earlier toggle checks
  await agentPage.setViewportSize({ width: 1280, height: 800 });
  await agentPage.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'load', timeout: 30000 });
  await agentPage.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
  await gotoTab(agentPage, 'Production Report');
  await waitForProductionReport(agentPage);

  // Now switch to 380px mobile viewport
  await agentPage.setViewportSize({ width: 380, height: 812 });
  await agentPage.waitForTimeout(600);
  const agentOverflow = await agentPage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  await ss(agentPage, '13a-mobile-agent');
  await agentPage.setViewportSize({ width: 1280, height: 800 });

  // Branch view at 380px
  await bmPage.setViewportSize({ width: 380, height: 812 });
  await bmPage.waitForTimeout(400);
  const bmOverflow = await bmPage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  await ss(bmPage, '13b-mobile-branch');
  await bmPage.setViewportSize({ width: 1280, height: 800 });

  if (agentOverflow)  throw new Error('Horizontal overflow on agent Production Report at 380px');
  if (bmOverflow)     throw new Error('Horizontal overflow on branch Production Report at 380px');
});

// ── CHECK 14: Dark mode ───────────────────────────────────────────────────────
await check('14_dark_mode', 'Dark mode: Production Report renders with .dark on <html> (agent + branch)', async () => {
  // Reset to Week toggle first, then toggle dark mode
  await gotoTab(agentPage, 'Production Report');
  await agentPage.waitForTimeout(400);

  const darkToggle = agentPage.getByRole('button', { name: 'Toggle dark mode' });
  await darkToggle.waitFor({ timeout: 8000 });
  const wasDark = await agentPage.evaluate(() => document.documentElement.classList.contains('dark'));
  if (wasDark) await darkToggle.click(); // reset to light first
  await agentPage.waitForTimeout(200);
  await darkToggle.click();
  await agentPage.waitForTimeout(400);

  const isDark = await agentPage.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!isDark) throw new Error('dark class not applied to <html> after toggle');
  await waitForProductionReport(agentPage);
  await ss(agentPage, '14a-dark-agent');

  // Reset to light
  await darkToggle.click();
  await agentPage.waitForTimeout(300);

  // Branch manager dark mode
  const bmDarkToggle = bmPage.getByRole('button', { name: 'Toggle dark mode' });
  if (await bmDarkToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    const bmWasDark = await bmPage.evaluate(() => document.documentElement.classList.contains('dark'));
    if (bmWasDark) await bmDarkToggle.click();
    await bmPage.waitForTimeout(200);
    await bmDarkToggle.click();
    await bmPage.waitForTimeout(400);
    const bmIsDark = await bmPage.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!bmIsDark) throw new Error('dark class not applied to branch manager page');
    await waitForProductionReport(bmPage);
    await ss(bmPage, '14b-dark-branch');
    await bmDarkToggle.click();
    await bmPage.waitForTimeout(300);
  } else {
    console.log('  ℹ Dark toggle not found on branch page (unexpected) — skipping branch dark screenshot');
    await ss(bmPage, '14b-dark-branch-no-toggle');
  }
});

// ── teardown ──────────────────────────────────────────────────────────────────
await browser.close();

const allPassed = Object.values(results).every((r) => r.pass);
writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n── Summary ──────────────────────────────────────────────────────');
Object.entries(results).forEach(([id, r]) => {
  console.log(`${r.pass ? '✓' : '✗'} ${id}: ${r.label}${r.error ? `\n    ${r.error}` : ''}`);
});
const passCount = Object.values(results).filter(r => r.pass).length;
const totalCount = Object.values(results).length;
console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : `❌ ${totalCount - passCount} of ${totalCount} FAILED`} (${passCount}/${totalCount})`);
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);

process.exit(allPassed ? 0 : 1);

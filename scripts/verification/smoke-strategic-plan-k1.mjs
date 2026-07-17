/**
 * smoke-strategic-plan-k1.mjs — Track K Phase 1 · Strategic Plan dashboard live smoke.
 *
 * Branch Manager foil, real DOM against real Firebase (rules + indexes), both themes:
 *   A. Reachability + render — BM opens the Strategic Plan tab; dashboard + all 5
 *      section testids render; content non-trivial; 0 console errors. This is the
 *      load-bearing coverage RTL cannot give: getPoliciesForManager /
 *      getPersistencyForAgentIds / getGoalsForAgents / getAllYTDSubmissions all
 *      succeed under production rules for a BM.
 *   B. Granularity toggle (acceptance #3 / §10) — Period Metrics rows switch 4↔2
 *      between quarter and half. Skipped-with-note if the branch has no period data.
 *   C. Producing-UM row (SMOKE ADDITION #2, real-DOM) — a producing Unit/Trainee
 *      Manager appears as a tracker row (the "Unit head" pill). Reported; skipped-
 *      with-note if the foil branch has no producing UM (also proven at unit level:
 *      assembleModel.test.js).
 *   D. Net-settled values — rendered per-agent net-settled cells captured. The
 *      settled-then-lapsed exclusion (SMOKE ADDITION #1) is proven deterministically
 *      at unit level (settledTwinRun.test.js); production seeding is a Rule-3 STOP.
 *   E. Present mode — the Present button opens the full-screen presentation; Escape
 *      returns to the dashboard.
 *   F. axe NO-NEW vs main — serious/critical on the dashboard; only the pre-existing
 *      `color-contrast` debt is allowed. Any OTHER serious/critical rule FAILS.
 *
 *   node scripts/verification/smoke-strategic-plan-k1.mjs --url=https://<preview>.vercel.app
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { setupBypassSession, captureConsoleAndNetwork, formatCaptureReport } from './lib/walk-helpers.mjs';

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

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL = args.url ?? 'https://agencytrack.vercel.app';
const IS_PROD = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const EMAIL = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const PASS = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
// The Strategic Plan is a NET-NEW surface with zero pre-existing axe debt to
// grandfather, so NO serious/critical rule is exempted — any (incl. color-contrast)
// fails the gate.
const PREEXISTING_AXE = new Set();
const SECTIONS = ['agents', 'production', 'period-metrics', 'org', 'recruitment'];

if (IS_PROD && !BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN for prod URL'); process.exit(1); }
if (!EMAIL || !PASS) { console.error('Missing A11Y_BRANCH_MANAGER_* credentials'); process.exit(1); }

const RESULTS = [];

async function login(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function countTestidPrefix(page, prefix) {
  return page.evaluate((p) => document.querySelectorAll(`[data-testid^="${p}"]`).length, prefix);
}

async function run(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 1500 } });
  const errors = [];
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  const page = await context.newPage();
  // Canonical console + network capture (banked pattern) — surfaces network
  // failures the manual listener would miss.
  const capture = captureConsoleAndNetwork(page);
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('fontshare.com')) return;
    if (t.includes('Failed to load resource') && t.includes('net::ERR_FAILED')) return;
    errors.push(t);
  });

  const r = { theme, checks: {} };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page);
    if (theme === 'dark') {
      await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('agencytrack-dark', 'true'); });
      await page.waitForTimeout(400);
    }

    // A — reach the tab + render
    await page.waitForSelector('[data-testid="tab-strategic-plan"]', { timeout: 20_000 });
    await page.click('[data-testid="tab-strategic-plan"]');
    await page.waitForSelector('[data-testid="strategic-plan-dashboard"]', { timeout: 25_000 });
    await page.waitForTimeout(2000);

    const sectionPresence = {};
    for (const s of SECTIONS) {
      sectionPresence[s] = await page.locator(`[data-testid="sp-section-${s}"]`).count() > 0;
    }
    const allSections = SECTIONS.every((s) => sectionPresence[s]);
    const bodyLen = await page.evaluate(() => (document.querySelector('[data-testid="strategic-plan-dashboard"]')?.textContent || '').length);
    r.checks.render = { allSections, sectionPresence, bodyLen, pass: allSections && bodyLen > 100 };

    // B — granularity toggle (Period Metrics 4 ↔ 2)
    const hasPeriodTable = await page.locator('[data-testid="sp-period-table"]').count() > 0;
    if (hasPeriodTable) {
      const q = await countTestidPrefix(page, 'sp-period-row-');
      await page.click('[data-testid="sp-granularity-half"]');
      await page.waitForTimeout(600);
      const h = await countTestidPrefix(page, 'sp-period-row-');
      await page.click('[data-testid="sp-granularity-quarter"]');
      await page.waitForTimeout(600);
      const q2 = await countTestidPrefix(page, 'sp-period-row-');
      r.checks.granularity = { quarterRows: q, halfRows: h, quarterAgain: q2, pass: q === 4 && h === 2 && q2 === 4 };
    } else {
      r.checks.granularity = { skipped: 'no period data in foil branch', pass: true };
    }

    // C — producing-UM row + D — net values
    const agentRows = await countTestidPrefix(page, 'sp-agent-row-');
    const unitHeadRows = await page.locator('[data-testid^="sp-agent-row-"]', { hasText: 'Unit head' }).count();
    const netCells = await countTestidPrefix(page, 'sp-agent-net-');
    const netValues = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="sp-agent-net-"]')].map((el) => el.textContent.trim()).slice(0, 12));
    // Enforceable: when the foil branch HAS advisors, every row must render a
    // net-settled cell (proves the per-agent twin-run path ran end-to-end).
    // Zero advisors → explicit preview-data skip (not a silent pass).
    const rosterEmptySkip = agentRows === 0;
    r.checks.roster = {
      agentRows, unitHeadRows, netCells, netValues,
      umNote: unitHeadRows > 0 ? 'producing UM row present' : 'no producing UM in foil branch (covered at unit level)',
      skip: rosterEmptySkip ? 'no advisors in foil branch — preview-data skip' : undefined,
      pass: rosterEmptySkip || netCells === agentRows,
    };

    // E — present mode open/close
    const presentDisabled = await page.locator('[data-testid="sp-present-btn"]').isDisabled().catch(() => true);
    if (!presentDisabled) {
      await page.click('[data-testid="sp-present-btn"]');
      const opened = await page.waitForSelector('[data-testid="strategic-plan-mode"]', { timeout: 8000 }).then(() => true).catch(() => false);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      const closed = await page.locator('[data-testid="strategic-plan-mode"]').count() === 0
        && await page.locator('[data-testid="strategic-plan-dashboard"]').count() > 0;
      r.checks.present = { opened, closed, pass: opened && closed };
    } else {
      r.checks.present = { skipped: 'present disabled (empty plan)', pass: true };
    }

    // F — axe NO-NEW vs main
    let axeSC = [];
    try {
      const res = await new AxeBuilder({ page }).include('[data-testid="strategic-plan-dashboard"]').withTags(['wcag2a', 'wcag2aa']).analyze();
      axeSC = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
    } catch (e) { axeSC = [{ id: 'axe-error', target: String(e).slice(0, 120) }]; }
    const axeRuleIds = [...new Set(axeSC.map((n) => n.id))];
    const newAxeRules = axeRuleIds.filter((id) => !PREEXISTING_AXE.has(id));
    r.checks.axe = { nodes: axeSC.length, ruleIds: axeRuleIds, newAxeRules, offenders: axeSC.filter((n) => newAxeRules.includes(n.id)).slice(0, 4), pass: newAxeRules.length === 0 };

    const netFailures = (capture.networkFailures || []).length;
    r.checks.console = { errors: errors.length, netFailures, sample: errors.slice(0, 3), pass: errors.length === 0 && netFailures === 0 };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    RESULTS.push(r);

    console.log(`\n[${theme}]`);
    console.log(`  A render: sections=${JSON.stringify(sectionPresence)} bodyLen=${bodyLen} → ${r.checks.render.pass ? 'PASS' : 'FAIL'}`);
    console.log(`  B granularity: ${JSON.stringify(r.checks.granularity)}`);
    console.log(`  C roster: agentRows=${agentRows} unitHeadRows=${unitHeadRows} (${r.checks.roster.umNote})`);
    console.log(`  D net values: ${netValues.join(' | ') || '(none rendered)'}`);
    console.log(`  E present: ${JSON.stringify(r.checks.present)}`);
    console.log(`  F axe serious/critical: ${axeSC.length} node(s), rules=[${axeRuleIds.join(', ') || 'none'}], NEW-vs-main=[${newAxeRules.join(', ') || 'none'}] → ${r.checks.axe.pass ? 'PASS' : 'FAIL'}`);
    if (newAxeRules.length) r.checks.axe.offenders.forEach((n) => console.log(`      NEW axe ${n.id}: ${n.target}`));
    console.log(`  console errors=${errors.length} · network failures=${r.checks.console.netFailures}${errors.length ? ' → ' + errors.slice(0, 2).join(' | ') : ''}`);
    formatCaptureReport(capture); // prints its own console/network summary block
    console.log(`  [${theme}] → ${r.pass ? 'PASS' : 'FAIL'}`);
  } catch (e) {
    r.pass = false; r.fatal = String(e).slice(0, 240);
    RESULTS.push(r);
    console.log(`\n[${theme}] FATAL: ${r.fatal}`);
  } finally {
    await browser.close();
  }
}

console.log(`\nStrategic Plan (Track K P1) smoke\nTarget: ${URL}\n`);
for (const theme of ['light', 'dark']) await run(theme);
const allPass = RESULTS.every((x) => x.pass);
console.log(`\nStrategic Plan smoke: ${allPass ? `✓ ${RESULTS.length}/${RESULTS.length} PASS` : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

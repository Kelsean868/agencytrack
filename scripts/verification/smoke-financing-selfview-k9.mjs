/**
 * smoke-financing-selfview-k9.mjs — subject-signed-in smoke for Track K · K9
 * (FinancingSelfView, read-only).
 *
 * The FIRST time the financing canAccessOwn read arms fire in production. Signs
 * in AS THE SUBJECT (not a manager) and value-level-asserts the SHOWN field set,
 * PRIVATE-field ABSENCE, and the managerFinancing → "Your draw" relabel.
 *
 * Prereq: seed first —
 *   node scripts/verification/seed-financing-selfview-k9.mjs --apply
 * then run (from the main worktree, .env.local present):
 *   SMOKE_BASE_URL="https://agencytrack-git-k9-financing-self-view-kyron-marchan-s-projects.vercel.app" \
 *     node scripts/verification/smoke-financing-selfview-k9.mjs
 * and clean up:
 *   node scripts/verification/seed-financing-selfview-k9.mjs --cleanup
 *
 * Legs (desktop 1280×900, both themes):
 *   A. Sign in AS THE AGENT → Financing tab (agent-tab-financing) → SHOWN values,
 *      PRIVATE absence, relabel.
 *   B. Sign in AS THE UNIT MANAGER → My Production → mp-financing (nav-mp-financing)
 *      → same assertions (exercises the isProducingManager() canAccessOwn arm).
 *
 * MONTH-BOUNDARY CAVEAT: the seed computes the current month by UTC; getProjectedBonus
 * uses TT-local. Near a month boundary the take-home may read "no bonus" — the smoke
 * does NOT pin the take-home value (the account may also carry other in-quarter
 * policies); the pinned $5,625/$3,750 arithmetic is locked by the unit test instead.
 *
 * BRIEF-vs-STATE-MACHINE note: brief 5.1 said seed on_financing, but on_financing has
 * NO reconciliation record (recon writes at reconciling→terminal). Seed +
 * assertions use post_financing_repayment so the brief's "assert a reconciliation
 * figure" criterion is met with a production-valid state.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import AxeBuilder from '@axe-core/playwright';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  waitForTheme,
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
  } catch { /* ignore */ }
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var: ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) throw new Error('Set SMOKE_BASE_URL to the preview (or prod) URL');

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };
const vis = (loc, t = 8000) => loc.isVisible({ timeout: t }).catch(() => false);

// Month keys — MUST match the seed (UTC-based).
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const M1 = `${now.getUTCFullYear()}_${pad(now.getUTCMonth() + 1)}`;
const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const M2 = `${prev.getUTCFullYear()}_${pad(prev.getUTCMonth() + 1)}`;

async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2500);
}

// The agent dashboard's heavier initial load can push FinancingSelfView's async
// reads past a naive wait — block on the READY signal (a SHOWN value) before
// asserting. Generous timeout; falls through so a genuine empty/error state still
// gets asserted (and fails loudly) rather than hanging.
async function waitReady(page) {
  await page.locator('[data-testid="fsv-current-monthly"]')
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(500);
}

async function textOf(page, testid) {
  const loc = page.locator(`[data-testid="${testid}"]`);
  if (!(await vis(loc, 8000))) return null;
  return (await loc.textContent()) ?? '';
}

// The full rendered self-view innerText — used for PRIVATE-absence assertions.
async function selfViewText(page) {
  const root = page.locator('[data-testid="financing-self-view"]');
  if (!(await vis(root, 10000))) return null;
  return (await root.innerText()) ?? '';
}

async function assertSubject(page, who) {
  // SHOWN — exact seeded values
  const cur = await textOf(page, 'fsv-current-monthly');
  (cur && /4,500/.test(cur)) ? pass(`${who}-current`, `currentMonthlyFinancing ${cur.trim()}`)
    : fail(`${who}-current`, `fsv-current-monthly=${cur}`);

  const bal1 = await textOf(page, `fsv-running-balance-${M1}`);
  (bal1 && /9,000/.test(bal1)) ? pass(`${who}-balance-m1`, `runningBalance ${bal1.trim()}`)
    : fail(`${who}-balance-m1`, `fsv-running-balance-${M1}=${bal1}`);

  const bal2 = await textOf(page, `fsv-running-balance-${M2}`);
  (bal2 && /surplus/i.test(bal2)) ? pass(`${who}-balance-m2-surplus`, `negative → ${bal2.trim()}`)
    : fail(`${who}-balance-m2-surplus`, `fsv-running-balance-${M2}=${bal2}`);

  const draw = await textOf(page, `fsv-your-draw-${M1}`);
  (draw && /4,200/.test(draw)) ? pass(`${who}-your-draw`, `managerFinancing relabeled → ${draw.trim()}`)
    : fail(`${who}-your-draw`, `fsv-your-draw-${M1}=${draw}`);

  const closing = await textOf(page, 'fsv-recon-closing');
  (closing && /7,200/.test(closing)) ? pass(`${who}-recon-closing`, `reconciliation figure ${closing.trim()}`)
    : fail(`${who}-recon-closing`, `fsv-recon-closing=${closing}`);

  const takehome = await textOf(page, 'fsv-takehome');
  (takehome && /TTD/.test(takehome)) ? pass(`${who}-takehome-present`, `derived take-home renders (${takehome.trim()}) — value not pinned`)
    : fail(`${who}-takehome-present`, `fsv-takehome=${takehome}`);

  // Relabel — header present, manager framing absent
  const body = await selfViewText(page);
  if (body == null) { fail(`${who}-selfview`, 'financing-self-view root not visible'); return; }
  /your draw/i.test(body) ? pass(`${who}-relabel-present`, '"Your draw" header present')
    : fail(`${who}-relabel-present`, '"Your draw" not found');
  !/manager financing/i.test(body) ? pass(`${who}-no-manager-label`, 'no "Manager Financing" framing')
    : fail(`${who}-no-manager-label`, '"Manager Financing" leaked into the subject view');

  // PRIVATE absence — every one must be ABSENT from the rendered DOM
  const leaks = [];
  if (/3,333/.test(body)) leaks.push('suggestedFinancing(3,333)');
  if (/6\.67|0\.0667|6\.7%/.test(body)) leaks.push('adjustmentPct');
  if (/K9-PRIVATE-STMT/i.test(body)) leaks.push('statement notes');
  if (/K9 Seed Mgr/i.test(body)) leaks.push('audit byName/enteredByName');
  if (/K9-HIST-NOTE/i.test(body)) leaks.push('statusHistory note');
  leaks.length === 0 ? pass(`${who}-private-absent`, 'adjustmentPct/suggestedFinancing/notes/audit all absent from DOM')
    : fail(`${who}-private-absent`, `LEAKED: ${leaks.join(', ')}`);
}

async function axeScreen(page, tag) {
  try {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    serious.length === 0 ? pass(`axe-${tag}`, 'no serious/critical')
      : fail(`axe-${tag}`, serious.map((v) => `${v.id}(${v.nodes.length})`).join(', '));
  } catch (e) { fail(`axe-${tag}`, e.message); }
}

// Navigate to the agent Financing surface. Generous vis wait absorbs the agent
// dashboard's heavier initial load.
async function gotoAgentFinancing(page) {
  const tab = page.locator('[data-testid="agent-tab-financing"]');
  // waitFor (not the vis() helper): Playwright's locator.isVisible() is an
  // immediate check that ignores its timeout arg, so vis(tab, 15000) would not
  // actually wait for the tab to mount. waitFor auto-waits up to the timeout.
  try {
    await tab.waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    return false;
  }
  await tab.click();
  await waitReady(page);
  return true;
}

// One agent leg per theme, each in its OWN context primed BEFORE the first
// navigation (apply-before-nav) — the robust shape (mirrors runUM and the proven
// per-theme-context pattern). No mid-page reload: the init script is in place when
// main.jsx reads localStorage at first paint, and waitForTheme asserts it took
// effect before axe. Subject VALUE assertions (theme-independent) run once, on light.
async function runAgentTheme(browser, theme) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await setTheme(ctx, theme);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try {
    await login(page, requireEnv('A11Y_AGENT_EMAIL'), requireEnv('A11Y_AGENT_PASSWORD'));
    pass(`agent-login[${theme}]`, 'agent signed in');
  } catch (e) { fail(`agent-login[${theme}]`, e.message); formatCaptureReport(cap); await ctx.close(); return; }

  if (!(await gotoAgentFinancing(page))) { fail(`agent-financing-nav[${theme}]`, 'agent-tab-financing not present'); formatCaptureReport(cap); await ctx.close(); return; }
  if (theme === 'light') await assertSubject(page, 'agent');

  // waitForTheme now throws loudly on mismatch/timeout — record it as a failed leg
  // and still clean up + report, rather than leaking ctx and aborting remaining legs.
  try {
    await waitForTheme(page, theme);
    await axeScreen(page, `agent-${theme}`);
  } catch (e) {
    fail(`agent-theme[${theme}]`, e.message);
  } finally {
    formatCaptureReport(cap);
    await ctx.close();
  }
}

async function runAgent(browser) {
  await runAgentTheme(browser, 'light');
  await runAgentTheme(browser, 'dark');
}

async function runUM(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  // UM runs a dark-only leg: prime dark BEFORE the first navigation.
  await setTheme(ctx, 'dark');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try {
    await login(page, requireEnv('A11Y_UNIT_MANAGER_EMAIL'), requireEnv('A11Y_UNIT_MANAGER_PASSWORD'));
    pass('um-login', 'unit manager signed in');
  } catch (e) { fail('um-login', e.message); formatCaptureReport(cap); await ctx.close(); return; }

  const tab = page.locator('[data-testid="mp-tab-financing"]');
  if (!(await vis(tab, 10000))) { fail('um-financing-nav', 'mp-tab-financing not present (My Production)'); formatCaptureReport(cap); await ctx.close(); return; }
  await tab.click();
  await waitReady(page);
  await assertSubject(page, 'um');

  // waitForTheme now throws loudly on mismatch/timeout — record + clean up gracefully.
  try {
    await waitForTheme(page, 'dark');
    await axeScreen(page, 'um-dark');
  } catch (e) {
    fail('um-theme', e.message);
  } finally {
    formatCaptureReport(cap);
    await ctx.close();
  }
}

(async () => {
  console.log(`\nK9 FinancingSelfView smoke → ${BASE_URL}`);
  console.log(`  months: M1=${M1} (current) M2=${M2} (surplus)`);
  const browser = await chromium.launch();
  try {
    await runAgent(browser);
    await runUM(browser);
  } finally { await browser.close(); }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`));
    process.exit(1);
  }
  console.log('All legs green.');
})();

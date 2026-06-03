/**
 * Game Plan v2 — Slice 1 smoke (agent surface, both themes).
 *
 * Slice 1 ships the Game Plan hub shell + re-homes Money Needs as a nested
 * nav child. Composition-only over the EXISTING moneyNeeds worksheet — no new
 * collection / write / rule / index. This smoke proves the user-visible
 * behavior on a real Vercel preview through real Firebase.
 *
 * Assertions (both themes unless noted):
 *   NAV   1. Game Plan nav item present, with a NEW badge.
 *         2. Money Needs nav item rendered as a CHILD (.sidebar-link-child).
 *         3. Goals nav item present and NOT a child (still a sibling).
 *   HUB   4. game-plan tab renders the hub (anchor + rail + cascade + commit).
 *         5. Anchor shows "Draft" + "Plan Built"; forward steps read "Coming".
 *         6. Commit preview button is DISABLED; Goals link present.
 *         7. Clicking the Goals link routes to the goals tab.
 *   MN    8. Money Needs Step 1 renders (worksheet header or first-run start).
 *   WRV   9. (light only) write-read-verify: add a Fixed Expenses line with a
 *            sentinel amount → save → hard-reload → assert it persisted →
 *            clean up (delete the sentinel line).
 *   A11Y 10. axe: no NEW serious/critical nodes on the game-plan hub surface.
 *        11. 0 console errors.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

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

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const SENTINEL     = 4321;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');
  process.exit(1);
}
if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

const RESULTS = [];

async function login(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(1200);
}

async function gotoTab(page, testId) {
  await page.click(`[data-testid="${testId}"]`);
  await page.waitForTimeout(900);
}

// ── Money Needs write-read-verify helpers ────────────────────────────────
async function ensureWorksheet(page) {
  await gotoTab(page, 'agent-tab-money-needs');
  await page.waitForTimeout(1200);
  const startBtn = page.getByRole('button', { name: /Start\s+\d{4}\s+worksheet/i });
  if (await startBtn.count() > 0 && await startBtn.first().isVisible().catch(() => false)) {
    await startBtn.first().click();
    await page.waitForTimeout(2500); // create round-trip
  }
}

async function addSentinelLine(page) {
  // Expand Fixed Expenses, add an item, set the sentinel amount, blur → save.
  const groupBtn = page.getByRole('button', { name: /Fixed Expenses/i }).first();
  await groupBtn.click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Add item/i }).first().click();
  await page.waitForTimeout(800); // add triggers a save
  const amounts = page.getByLabel('Expense amount');
  const last = amounts.last();
  await last.fill(String(SENTINEL));
  // blur → handleBlur → saveGroup
  await page.keyboard.press('Tab');
  await page.waitForTimeout(2000); // save round-trip
}

async function readSentinelPresent(page) {
  await ensureWorksheet(page);
  const groupBtn = page.getByRole('button', { name: /Fixed Expenses/i }).first();
  await groupBtn.click();
  await page.waitForTimeout(600);
  return page.evaluate((sentinel) => {
    const inputs = Array.from(document.querySelectorAll('input[aria-label="Expense amount"]'));
    return inputs.some((i) => String(i.value).trim() === String(sentinel));
  }, SENTINEL);
}

async function cleanupSentinelLine(page) {
  try {
    const groupBtn = page.getByRole('button', { name: /Fixed Expenses/i }).first();
    if (await groupBtn.count() === 0) return;
    // ensure expanded
    await groupBtn.click().catch(() => {});
    await page.waitForTimeout(300);
    // Find the row whose amount == sentinel and click its delete button.
    const handled = await page.evaluate((sentinel) => {
      const inputs = Array.from(document.querySelectorAll('input[aria-label="Expense amount"]'));
      const target = inputs.find((i) => String(i.value).trim() === String(sentinel));
      if (!target) return false;
      const row = target.closest('div');
      // row delete button has aria-label="Delete expense"
      let el = target.parentElement;
      while (el && el !== document.body) {
        const btn = el.querySelector('button[aria-label="Delete expense"]');
        if (btn) { btn.click(); return true; }
        el = el.parentElement;
      }
      return Boolean(row);
    }, SENTINEL);
    if (handled) await page.waitForTimeout(2000);
  } catch { /* best-effort cleanup */ }
}

async function smokeTheme(theme, { doWriteVerify }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors  = [];

  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });

  const r = { theme };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }

    // ── NAV: re-nest structure ──────────────────────────────────────────
    const nav = await page.evaluate(() => {
      const gp = document.querySelector('[data-testid="agent-tab-game-plan"]');
      const mn = document.querySelector('[data-testid="agent-tab-money-needs"]');
      const gl = document.querySelector('[data-testid="agent-tab-goals"]');
      const badge = gp ? gp.querySelector('.badge-new') : null;
      return {
        gamePlanPresent: Boolean(gp),
        gamePlanHasNewBadge: Boolean(badge) && /new/i.test(badge.textContent || ''),
        moneyNeedsChild: Boolean(mn) && mn.classList.contains('sidebar-link-child'),
        goalsPresent: Boolean(gl),
        goalsNotChild: Boolean(gl) && !gl.classList.contains('sidebar-link-child'),
      };
    });

    // ── HUB: open game-plan tab ─────────────────────────────────────────
    await gotoTab(page, 'agent-tab-game-plan');
    await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 15_000 });
    await page.waitForTimeout(600);

    const hub = await page.evaluate(() => {
      const has = (id) => Boolean(document.querySelector(`[data-testid="${id}"]`));
      const hubEl = document.querySelector('[data-testid="game-plan-hub"]');
      const text = hubEl ? (hubEl.textContent || '') : '';
      const commitBtn = document.querySelector('[data-testid="game-plan-commit-btn"]');
      const goalsLink = document.querySelector('[data-testid="game-plan-goals-link"]');
      return {
        anchor: has('game-plan-anchor'),
        rail: has('game-plan-rail'),
        cascade: has('game-plan-cascade'),
        commit: has('game-plan-commit'),
        draftPill: /draft/i.test(text),
        planBuilt: /plan built/i.test(text),
        comingState: /coming/i.test(text),
        commitDisabled: Boolean(commitBtn) && commitBtn.disabled === true,
        goalsLinkPresent: Boolean(goalsLink),
      };
    });

    // ── Goals link routes to goals tab ──────────────────────────────────
    let goalsRoutes = false;
    try {
      await page.click('[data-testid="game-plan-goals-link"]');
      await page.waitForTimeout(900);
      goalsRoutes = await page.evaluate(() => {
        const gl = document.querySelector('[data-testid="agent-tab-goals"]');
        return Boolean(gl) && gl.getAttribute('aria-current') === 'page';
      });
    } catch { /* leave false */ }

    // ── Money Needs Step 1 renders ──────────────────────────────────────
    await gotoTab(page, 'agent-tab-money-needs');
    await page.waitForTimeout(1000);
    const mnRender = await page.evaluate(() => {
      const t = document.body.textContent || '';
      return /Money Needs Worksheet/i.test(t) || /Start\s+\d{4}\s+worksheet/i.test(t) || /worksheet/i.test(t);
    });

    // ── axe on the hub surface (NO-NEW serious/critical) ────────────────
    await gotoTab(page, 'agent-tab-game-plan');
    await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 15_000 });
    await page.waitForTimeout(400);
    let axeSC = [];
    try {
      const res = await new AxeBuilder({ page })
        .include('[data-testid="game-plan-hub"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      axeSC = res.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
    } catch (e) {
      axeSC = [{ id: 'axe-error', target: String(e).slice(0, 120) }];
    }

    // ── Write-read-verify (light only) ──────────────────────────────────
    let wrv = null;
    if (doWriteVerify) {
      await ensureWorksheet(page);
      await addSentinelLine(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await login(page).catch(() => {}); // reload may drop back to login
      const persisted = await readSentinelPresent(page);
      await cleanupSentinelLine(page);
      wrv = { persisted };
    }

    const pass = (
      nav.gamePlanPresent && nav.gamePlanHasNewBadge && nav.moneyNeedsChild &&
      nav.goalsPresent && nav.goalsNotChild &&
      hub.anchor && hub.rail && hub.cascade && hub.commit &&
      hub.draftPill && hub.planBuilt && hub.comingState &&
      hub.commitDisabled && hub.goalsLinkPresent &&
      goalsRoutes && mnRender &&
      axeSC.length === 0 && errors.length === 0 &&
      (wrv === null || wrv.persisted === true)
    );

    Object.assign(r, { nav, hub, goalsRoutes, mnRender, axe: axeSC.length, errors: errors.length, wrv, pass });
    RESULTS.push(r);

    console.log(`\n[${theme}]`);
    console.log(`  nav: gamePlan=${nav.gamePlanPresent} new=${nav.gamePlanHasNewBadge} mnChild=${nav.moneyNeedsChild} goals=${nav.goalsPresent} goalsSibling=${nav.goalsNotChild}`);
    console.log(`  hub: anchor=${hub.anchor} rail=${hub.rail} cascade=${hub.cascade} commit=${hub.commit} draft=${hub.draftPill} planBuilt=${hub.planBuilt} coming=${hub.comingState} commitDisabled=${hub.commitDisabled} goalsLink=${hub.goalsLinkPresent}`);
    console.log(`  goalsRoutes=${goalsRoutes} moneyNeedsRenders=${mnRender} axe-sc=${axeSC.length} errors=${errors.length}${wrv ? ` wrv.persisted=${wrv.persisted}` : ''} → ${pass ? 'PASS' : 'FAIL'}`);
    if (axeSC.length) axeSC.slice(0, 3).forEach((n) => console.log(`    axe ${n.id}: ${n.target}`));
    if (errors.length) errors.slice(0, 3).forEach((e) => console.log(`    console.error: ${e}`));
  } catch (e) {
    Object.assign(r, { pass: false, fatal: String(e).slice(0, 200) });
    RESULTS.push(r);
    console.log(`\n[${theme}] FATAL: ${r.fatal}`);
  } finally {
    await browser.close();
  }
}

console.log(`\nGame Plan v2 — Slice 1 smoke`);
console.log(`Target: ${URL}\n`);

await smokeTheme('light', { doWriteVerify: true });
await smokeTheme('dark', { doWriteVerify: false });

const allPass = RESULTS.every((x) => x.pass);
console.log(`\nGame Plan v2 Slice 1 smoke: ${allPass ? `✓ ${RESULTS.length}/${RESULTS.length} PASS` : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

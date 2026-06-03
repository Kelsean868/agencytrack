/**
 * Weekly Planner v2 — Slice 1 smoke (agent surface, both themes).
 *
 * Slice 1 ships (a) the extraction of the goal-decomposition engine into
 * utils/goalDecomposition.js and (b) a read-only "Suggested weekly plan" card
 * in the Game Plan hub. This smoke proves the user-visible behavior on a real
 * Vercel preview through real Firebase.
 *
 * Assertions (both themes):
 *   PLAYGROUND (regression — extraction is zero-behavior-change)
 *     1. Commission tab → expand Playground → Goal Decomposition tab renders.
 *     2. With the default income goal (300000), the OutputTable's API-to-Write
 *        annual row reads TTD 1,269,840 (the extracted chain's exact output).
 *   CARD
 *     3. The suggested-week card renders in the Game Plan hub.
 *     4. Exactly one honest state shows (derived / floor / no-anchor / error).
 *     5. If DERIVED: 3 chips (Dials/CIs/Apps); tapping a chip opens the
 *        derivation reveal (which includes the full chain incl. prospects).
 *        If FLOOR: the "company floor" flag renders.
 *        If NO-ANCHOR: the "Set a plan" CTA renders.
 *   A11Y/QUALITY
 *     6. axe: no NEW serious/critical nodes on the game-plan hub vs main.
 *     7. 0 console errors.
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

async function smokeTheme(theme) {
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

    // ── PLAYGROUND regression: extraction is zero-behavior-change ─────────
    await gotoTab(page, 'agent-tab-commission');
    await page.waitForTimeout(600);
    // Expand the Playground accordion (collapsed by default).
    await page.getByRole('button', { name: /Commission Playground/i }).first().click();
    await page.waitForTimeout(500);
    // Goal Decomposition tab is the default active tab; click to be explicit.
    await page.getByRole('tab', { name: /Goal Decomposition/i }).first().click();
    await page.waitForTimeout(500);
    // Drive the income goal to a known value, then read API-to-Write (annual).
    const incomeInput = page.locator('div.flex.flex-col:has(label:has-text("Income Goal (TTD)")) input').first();
    await incomeInput.fill('300000').catch(() => {});
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    const playground = await page.evaluate(() => {
      const t = document.body.textContent || '';
      return {
        renders: /API to Write/i.test(t) && /Activity Required/i.test(t),
        apiToWrite: /1,269,840/.test(t),
      };
    });

    // ── CARD: the suggested-week card in the Game Plan hub ───────────────
    await gotoTab(page, 'agent-tab-game-plan');
    await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="suggested-week-card"]', { timeout: 15_000 });
    await page.waitForTimeout(600);

    const state = await page.evaluate(() => {
      const has = (id) => Boolean(document.querySelector(`[data-testid="${id}"]`));
      return {
        card: has('suggested-week-card'),
        derived: has('suggested-week-derived'),
        floor: has('suggested-week-floor'),
        noAnchor: has('suggested-week-no-anchor'),
        error: has('suggested-week-error'),
      };
    });
    const activeStates = ['derived', 'floor', 'noAnchor', 'error'].filter((k) => state[k]);
    const exactlyOneState = activeStates.length === 1;

    // State-specific assertion.
    let stateDetail = { mode: activeStates[0] ?? 'none', ok: false };
    if (state.derived) {
      // 3 chips → click first → reveal opens; reveal mentions prospects (full chain).
      const chips = await page.locator('[data-testid="suggested-week-derived"] button[aria-expanded]').count();
      await page.locator('[data-testid="suggested-week-derived"] button[aria-expanded]').first().click();
      await page.waitForTimeout(400);
      const revealOpen = await page.evaluate(() => {
        const rv = document.querySelector('[data-testid="suggested-week-reveal"]');
        return Boolean(rv) && /prospects/i.test(rv.textContent || '');
      });
      stateDetail = { mode: 'derived', chips, revealOpen, ok: chips === 3 && revealOpen };
    } else if (state.floor) {
      const ok = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="suggested-week-floor"]');
        return Boolean(el) && /company floor/i.test(el.textContent || '');
      });
      stateDetail = { mode: 'floor', ok };
    } else if (state.noAnchor) {
      const ok = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="suggested-week-no-anchor"]');
        return Boolean(el) && /set a plan/i.test(el.textContent || '');
      });
      stateDetail = { mode: 'no-anchor', ok };
    } else if (state.error) {
      stateDetail = { mode: 'error', ok: true }; // honest error state is a valid render
    }

    // ── axe on the hub surface (NO-NEW serious/critical vs main) ─────────
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

    const pass = (
      playground.renders && playground.apiToWrite &&
      state.card && exactlyOneState && stateDetail.ok &&
      axeSC.length === 0 && errors.length === 0
    );

    Object.assign(r, { playground, state: stateDetail, axe: axeSC.length, errors: errors.length, pass });
    RESULTS.push(r);

    console.log(`\n[${theme}]`);
    console.log(`  playground: renders=${playground.renders} apiToWrite(1,269,840)=${playground.apiToWrite}`);
    console.log(`  card: present=${state.card} state=${stateDetail.mode} ok=${stateDetail.ok}${stateDetail.chips !== undefined ? ` chips=${stateDetail.chips} reveal=${stateDetail.revealOpen}` : ''}`);
    console.log(`  axe-sc=${axeSC.length} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
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

console.log(`\nWeekly Planner v2 — Slice 1 smoke`);
console.log(`Target: ${URL}\n`);

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every((x) => x.pass);
console.log(`\nWeekly Planner v2 Slice 1 smoke: ${allPass ? `✓ ${RESULTS.length}/${RESULTS.length} PASS` : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

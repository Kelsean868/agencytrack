/**
 * Award percent rounding smoke (agent + manager Awards, both themes).
 *
 * Proves the display-only fix: every award progress percentage renders as a
 * WHOLE number — no raw-float digits (e.g. `13.333333333333334%`) anywhere on
 * the agent OR manager Awards tab. Because the award-card primitives are
 * knowingly duplicated (awardPrimitives.jsx + inline copies in
 * AgentAwardsPanel.jsx), this real-DOM walk across BOTH surfaces is what
 * proves the duplication is fully fixed; a formatter-only unit test cannot.
 *
 * Assertions, per role (agent, branch_manager) × theme (light, dark):
 *   1. Awards tab renders.
 *   2. NO displayed percent matches the raw-float pattern /\d+\.\d{3,}\s*%/
 *      anywhere in the <main> content. (All percent tokens found are logged
 *      so the dispatcher can see the real, now-rounded values.)
 *   3. axe NO-NEW vs main: the only serious/critical rule on the Awards
 *      <main> surface is the PRE-EXISTING `color-contrast` debt on the award
 *      cards (text-ink-faint micro-labels + the text-[9px] state pills, whose
 *      contrast comes from accent-on-tint). This debt exists identically on
 *      production main (verified by running this same smoke against
 *      https://agencytrack.vercel.app); it is tracked by the open
 *      faint→muted migration + awardPrimitives dedup FUs and is out of scope
 *      for a display-formatting fix. A numeric-text change cannot introduce a
 *      new violation class, so the gate is "no axe rule OTHER than
 *      color-contrast", not absolute-zero (the per-run node COUNT varies with
 *      how many award cards are in contention at scan time).
 *   4. 0 console errors.
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
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

const ROLES = {
  agent: {
    email: process.env.A11Y_AGENT_EMAIL,
    pass:  process.env.A11Y_AGENT_PASSWORD,
    tabTestId: 'agent-tab-awards',
  },
  branch_manager: {
    email: process.env.A11Y_BRANCH_MANAGER_EMAIL,
    pass:  process.env.A11Y_BRANCH_MANAGER_PASSWORD,
    tabTestId: 'nav-awards',
  },
};

const RAW_FLOAT = /\d+\.\d{3,}\s*%/;          // 3+ decimal digits = unrounded
const ALL_PCT   = /\d+(?:\.\d+)?\s*%/g;        // every percent token

if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

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
    { timeout: 30_000 }
  );
  await page.waitForTimeout(1200);
}

async function smoke(role, theme) {
  const { email, pass, tabTestId } = ROLES[role];
  if (!email || !pass) {
    RESULTS.push({ role, theme, pass: false, fatal: `Missing creds for ${role}` });
    console.log(`\n[${role}/${theme}] FATAL: missing credentials`);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors  = [];

  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('fontshare.com')) return;
    if (t.includes('Failed to load resource') && t.includes('net::ERR_FAILED')) return;
    errors.push(t);
  });

  const r = { role, theme };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, email, pass);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }

    // Navigate to Awards tab.
    await page.waitForSelector(`[data-testid="${tabTestId}"]`, { timeout: 20_000 });
    await page.click(`[data-testid="${tabTestId}"]`);

    // Manager panel resolves async (settlement fetch) → wait for the panel
    // root if present; otherwise settle on a timeout.
    if (role === 'branch_manager') {
      await page.waitForSelector('[data-testid="manager-awards-panel"]', { timeout: 25_000 }).catch(() => {});
    }
    await page.waitForTimeout(1800);

    // Scrape every percent token in <main>; flag any raw float.
    const scan = await page.evaluate(({ allSrc }) => {
      const main = document.querySelector('main.shell-content') || document.querySelector('main') || document.body;
      const text = (main.textContent || '').replace(/\s+/g, ' ');
      const re = new RegExp(allSrc, 'g');
      const tokens = (text.match(re) || []).map((s) => s.replace(/\s+/g, ''));
      return { tokens, len: text.length };
    }, { allSrc: ALL_PCT.source });

    const rawFloats = scan.tokens.filter((t) => RAW_FLOAT.test(t));
    const uniquePct = [...new Set(scan.tokens)];

    // axe on the Awards <main> surface. NO-NEW gate: the only allowed
    // serious/critical rule is the pre-existing awards-card color-contrast
    // debt (verified present on production main). Any OTHER rule = a new
    // regression and fails the smoke.
    const PREEXISTING_AXE = new Set(['color-contrast']);
    let axeSC = [];
    try {
      const res = await new AxeBuilder({ page })
        .include('main.shell-content')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      axeSC = res.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
    } catch (e) {
      axeSC = [{ id: 'axe-error', target: String(e).slice(0, 120) }];
    }
    const axeRuleIds = [...new Set(axeSC.map((n) => n.id))];
    const newAxeRules = axeRuleIds.filter((id) => !PREEXISTING_AXE.has(id));

    const passed = rawFloats.length === 0 && newAxeRules.length === 0 && errors.length === 0 && scan.len > 50;

    Object.assign(r, {
      contentLen: scan.len,
      pctTokens: uniquePct,
      rawFloats,
      axeNodes: axeSC.length,
      axeRuleIds,
      newAxeRules,
      errors: errors.length,
      pass: passed,
    });
    RESULTS.push(r);

    console.log(`\n[${role}/${theme}]`);
    console.log(`  awards <main> chars=${scan.len}`);
    console.log(`  percent tokens (${uniquePct.length} unique): ${uniquePct.slice(0, 30).join(' ') || '(none on this surface)'}`);
    console.log(`  rawFloats=${rawFloats.length}${rawFloats.length ? ' → ' + rawFloats.join(' ') : ''}`);
    console.log(`  axe serious/critical: ${axeSC.length} node(s), rules=[${axeRuleIds.join(', ') || 'none'}], NEW-vs-main=[${newAxeRules.join(', ') || 'none'}]`);
    console.log(`  errors=${errors.length} → ${passed ? 'PASS' : 'FAIL'}`);
    if (newAxeRules.length) axeSC.filter((n) => newAxeRules.includes(n.id)).slice(0, 3).forEach((n) => console.log(`    NEW axe ${n.id}: ${n.target}`));
    if (errors.length) errors.slice(0, 3).forEach((e) => console.log(`    console.error: ${e}`));
  } catch (e) {
    Object.assign(r, { pass: false, fatal: String(e).slice(0, 200) });
    RESULTS.push(r);
    console.log(`\n[${role}/${theme}] FATAL: ${r.fatal}`);
  } finally {
    await browser.close();
  }
}

console.log(`\nAward percent rounding smoke`);
console.log(`Target: ${URL}\n`);

for (const role of ['agent', 'branch_manager']) {
  for (const theme of ['light', 'dark']) {
    await smoke(role, theme);
  }
}

const allPass = RESULTS.every((x) => x.pass);
console.log(`\nAward percent rounding smoke: ${allPass ? `✓ ${RESULTS.length}/${RESULTS.length} PASS` : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

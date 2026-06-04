/**
 * awards-v2-smoke.mjs — Track J item 18. Canonical v2 Awards live smoke.
 *
 * Agent + Branch Manager, both awards tabs, BOTH themes (light/dark):
 *   1. Awards surface renders (non-trivial <main> content).
 *   2. Screenshots saved to verification/awards-v2/ (gitignored output) for
 *      visual review (amendment-v2 §2 screenshot mandate).
 *   3. axe NO-NEW vs main: the only allowed serious/critical rule on the awards
 *      <main> is the PRE-EXISTING `color-contrast` debt (accent-on-tint micro-
 *      labels / state pills), tracked by the faint→muted migration FU. Any
 *      OTHER serious/critical rule = a new regression and FAILS.
 *   4. Every visible award percentage is a rounded integer — no raw-float
 *      tokens (/\d+\.\d{3,}\s*%/). This LIVE-CLOSES the #440 verification now
 *      that AgentAwardsPanel consumes the canonical awardPrimitives (item 17).
 *   5. 0 console errors.
 *
 * NOTE: overlaps the older ad-hoc award-percent-rounding-smoke.mjs (the pre-
 * dedup duplication-proof). Post-item-17 this is the canonical awards smoke;
 * consolidating/retiring the older script is flagged as a MORNING DECISION.
 *
 * Tenant note: goals + policies are seeded, submissions are NOT, so percentages
 * render low/zero — the rounding assertion applies to whatever renders.
 *
 *   node scripts/verification/awards-v2-smoke.mjs --url=https://agencytrack.vercel.app
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

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
const URL          = args.url ?? 'https://agencytrack.vercel.app';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const SHOT_DIR     = 'verification/awards-v2';

const RAW_FLOAT = /\d+\.\d{3,}\s*%/;
const ALL_PCT   = /\d+(?:\.\d+)?\s*%/g;
const PREEXISTING_AXE = new Set(['color-contrast']);

const ROLES = {
  agent:          { email: process.env.A11Y_AGENT_EMAIL,          pass: process.env.A11Y_AGENT_PASSWORD,          tabTestId: 'agent-tab-awards' },
  branch_manager: { email: process.env.A11Y_BRANCH_MANAGER_EMAIL, pass: process.env.A11Y_BRANCH_MANAGER_PASSWORD, tabTestId: 'nav-awards' },
};

if (IS_PROD && !BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN for prod URL'); process.exit(1); }
try { mkdirSync(SHOT_DIR, { recursive: true }); } catch { /* ignore */ }

const RESULTS = [];

async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function smoke(role, theme) {
  const { email, pass, tabTestId } = ROLES[role];
  if (!email || !pass) { RESULTS.push({ role, theme, pass: false, fatal: `Missing creds for ${role}` }); console.log(`\n[${role}/${theme}] FATAL: missing credentials`); return; }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
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
      await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('agencytrack-dark', 'true'); });
      await page.waitForTimeout(400);
    }
    await page.waitForSelector(`[data-testid="${tabTestId}"]`, { timeout: 20_000 });
    await page.click(`[data-testid="${tabTestId}"]`);
    if (role === 'branch_manager') await page.waitForSelector('[data-testid="manager-awards-panel"]', { timeout: 25_000 }).catch(() => {});
    await page.waitForTimeout(1800);

    const shotPath = `${SHOT_DIR}/${role}-${theme}.png`;
    await page.screenshot({ path: shotPath, fullPage: true });

    const scan = await page.evaluate(({ allSrc }) => {
      const main = document.querySelector('main.shell-content') || document.querySelector('main') || document.body;
      const text = (main.textContent || '').replace(/\s+/g, ' ');
      const tokens = (text.match(new RegExp(allSrc, 'g')) || []).map((s) => s.replace(/\s+/g, ''));
      return { tokens, len: text.length };
    }, { allSrc: ALL_PCT.source });
    const rawFloats = scan.tokens.filter((t) => RAW_FLOAT.test(t));
    const uniquePct = [...new Set(scan.tokens)];

    let axeSC = [];
    try {
      const res = await new AxeBuilder({ page }).include('main.shell-content').withTags(['wcag2a', 'wcag2aa']).analyze();
      axeSC = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
    } catch (e) { axeSC = [{ id: 'axe-error', target: String(e).slice(0, 120) }]; }
    const axeRuleIds = [...new Set(axeSC.map((n) => n.id))];
    const newAxeRules = axeRuleIds.filter((id) => !PREEXISTING_AXE.has(id));

    const passed = rawFloats.length === 0 && newAxeRules.length === 0 && errors.length === 0 && scan.len > 50;
    Object.assign(r, { contentLen: scan.len, pctTokens: uniquePct, rawFloats, axeNodes: axeSC.length, axeRuleIds, newAxeRules, errors: errors.length, shot: shotPath, pass: passed });
    RESULTS.push(r);

    console.log(`\n[${role}/${theme}]`);
    console.log(`  awards <main> chars=${scan.len} · screenshot=${shotPath}`);
    console.log(`  percent tokens (${uniquePct.length}): ${uniquePct.slice(0, 30).join(' ') || '(none)'}`);
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

console.log(`\nAwards v2 smoke\nTarget: ${URL}\n`);
for (const role of ['agent', 'branch_manager']) for (const theme of ['light', 'dark']) await smoke(role, theme);
const allPass = RESULTS.every((x) => x.pass);
console.log(`\nAwards v2 smoke: ${allPass ? `✓ ${RESULTS.length}/${RESULTS.length} PASS` : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

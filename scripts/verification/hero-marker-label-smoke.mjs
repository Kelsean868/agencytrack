/**
 * HeroCard marker-label collision smoke (v2 agent dashboard home).
 *
 * Repro: the test agent's goal is 200,000 and MDRT_THRESHOLDS_2026.mdrt is
 * 688,800, so MDRT is OFF-SCALE for this bar. The old code clamped the MDRT marker to the
 * right edge, stacking its label onto the "Goal · TTD 200,000" end label →
 * unreadable interleaved text. The fix hides the off-scale MDRT marker and
 * de-dupes the goal amount (bare "Goal" tick).
 *
 * Assertions (both themes):
 *   1. Hero progress bar renders ([role="progressbar"]).
 *   2. MDRT off-scale → NO "MDRT" marker element present in the hero.
 *   3. Axis labels are structurally non-overlapping — no two same-row label
 *      spans share an overlapping x-range (the bug's signature).
 *   4. Goal amount is NOT duplicated into the axis row — the end label is a
 *      bare "Goal" (the amount lives only in the subtitle).
 *   5. axe: no NEW serious/critical nodes on the hero surface.
 *   6. Screenshot the hero for the PR (the definitive check is visual).
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

const args = Object.fromEntries(process.argv.slice(2).map(a => {
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
  await page.waitForTimeout(1500);
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

    // Home/dashboard tab — hero lives here.
    await page.click('[data-testid="agent-tab-dashboard"]');
    await page.waitForSelector('[role="progressbar"]', { timeout: 15_000 });
    await page.waitForTimeout(800);

    // ── Structural probe: walk the bar container's label spans.
    const probe = await page.evaluate(() => {
      const bar = document.querySelector('[role="progressbar"]');
      if (!bar) return null;
      // Bar wrapper → its parent is the maxWidth container holding the axis labels.
      const container = bar.parentElement;
      if (!container) return null;
      const spans = Array.from(container.querySelectorAll('span'));
      const labels = spans.map((s) => {
        const r = s.getBoundingClientRect();
        return { text: (s.textContent || '').trim(), x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
      }).filter((l) => l.text.length > 0);

      const mdrtPresent = labels.some((l) => /MDRT/i.test(l.text));

      // Same-row x-overlap = collision. Two labels collide if their vertical
      // ranges intersect (same visual row) AND horizontal ranges intersect.
      let overlap = false;
      let overlapPair = null;
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          const vOverlap = a.y0 < b.y1 && b.y0 < a.y1;
          const hOverlap = a.x0 < b.x1 && b.x0 < a.x1;
          if (vOverlap && hOverlap) { overlap = true; overlapPair = [a.text, b.text]; }
        }
      }

      const hasZero = labels.some((l) => /^TTD\s*0$/i.test(l.text) || /^\$?\s*0$/.test(l.text) || /TTD\s*0$/i.test(l.text));
      const bareGoal = labels.some((l) => /^goal$/i.test(l.text));
      const goalWithAmount = labels.some((l) => /goal\s*[·.]/i.test(l.text));

      return {
        labelTexts: labels.map((l) => l.text),
        mdrtPresent, overlap, overlapPair, hasZero, bareGoal, goalWithAmount,
      };
    });

    // ── axe: scope to the hero card; flag new serious/critical only.
    const heroCardHandle = await page.evaluateHandle(() => {
      const bar = document.querySelector('[role="progressbar"]');
      return bar ? bar.closest('.card') : null;
    });
    let axeSeriousCritical = [];
    try {
      const axeResults = await new AxeBuilder({ page })
        .include('.card')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      axeSeriousCritical = axeResults.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
    } catch (e) {
      axeSeriousCritical = [{ id: 'axe-error', target: String(e).slice(0, 120) }];
    }
    await heroCardHandle.dispose();

    // ── Screenshot the hero for the PR.
    const heroCard = page.locator('.card').filter({ has: page.locator('[role="progressbar"]') }).first();
    const shotPath = `scripts/verification/hero-marker-label-${theme}.png`;
    await heroCard.screenshot({ path: shotPath });

    const pass = (
      probe &&
      probe.mdrtPresent === false &&   // off-scale MDRT hidden
      probe.overlap === false &&       // no colliding labels
      probe.bareGoal === true &&       // de-duped goal tick
      probe.goalWithAmount === false &&
      axeSeriousCritical.length === 0 &&
      errors.length === 0
    );

    RESULTS.push({ theme, ...probe, axe: axeSeriousCritical.length, errors: errors.length, pass, shotPath });

    console.log(`[${theme}] labels=${JSON.stringify(probe?.labelTexts)} mdrt=${probe?.mdrtPresent} overlap=${probe?.overlap}${probe?.overlapPair ? ' ' + JSON.stringify(probe.overlapPair) : ''} bareGoal=${probe?.bareGoal} goalAmt=${probe?.goalWithAmount} axe-sc=${axeSeriousCritical.length} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (axeSeriousCritical.length) axeSeriousCritical.slice(0, 3).forEach((n) => console.log(`  axe ${n.id}: ${n.target}`));
    if (errors.length) errors.slice(0, 3).forEach((e) => console.log(`  console.error: ${e}`));
    console.log(`  screenshot → ${shotPath}`);
  } finally {
    await browser.close();
  }
}

console.log(`\nHeroCard marker-label smoke`);
console.log(`Target: ${URL}\n`);

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every((r) => r.pass);
console.log(`\nHero marker-label smoke: ${allPass ? `✓ ${RESULTS.length}/${RESULTS.length} PASS` : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

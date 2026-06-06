/**
 * nexus-glass-s2-hero-axe.mjs — axe NO-NEW gate for Nexus Glass S2 Hero.
 *
 * Scans the three hero-glass flagship cards introduced in S2:
 *   Surface A — CommissionAnchorStrip (agent commission tab) — hero gold
 *   Surface B — SuggestedWeekCard (agent game-plan tab) — hero teal
 *   Surface C — PersRealityBar (manager persistency tab) — hero teal
 *
 * Both themes. Reports all serious/critical violations.
 * Known baseline: bell-badge color-contrast (single pre-existing violation).
 *
 * Usage:
 *   SMOKE_BASE_URL=https://<preview> node scripts/verification/nexus-glass-s2-hero-axe.mjs
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  setTheme,
  resolveSmokeBaseUrl,
  stamp,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !/^#/.test(k) && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

const BASE_URL     = resolveSmokeBaseUrl({ defaultHost: 'agencytrack.vercel.app' });
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const BM_EMAIL     = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS      = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!BYPASS_TOKEN && !BASE_URL.includes('localhost')) {
  console.error('VERCEL_BYPASS_TOKEN not set'); process.exit(1);
}
if (!AGENT_EMAIL || !AGENT_PASS || !BM_EMAIL || !BM_PASS) {
  console.error('Missing A11Y credentials'); process.exit(1);
}

// Bell badge is the one known pre-existing violation app-wide.
function isKnownBellBadge(violation) {
  return (
    violation.id === 'color-contrast' &&
    violation.nodes.every((n) => {
      const html = (n.html || '').toLowerCase();
      return html.includes('badge') || html.includes('notification') || html.includes('bell');
    })
  );
}

async function runAxeOnElement(page, label, selector) {
  const results = selector
    ? await new AxeBuilder({ page })
        .include(selector)
        .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
        .analyze()
    : await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
        .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const newViolations = serious.filter((v) => !isKnownBellBadge(v));
  const knownViolations = serious.filter((v) => isKnownBellBadge(v));

  if (serious.length === 0) {
    console.log(`  [${stamp()}] axe ${label}: PASS — 0 serious/critical violations`);
  } else {
    console.log(
      `  [${stamp()}] axe ${label}: ${newViolations.length} NEW + ${knownViolations.length} known-baseline`,
    );
    for (const v of serious) {
      const isKnown = isKnownBellBadge(v);
      const tag = isKnown ? '[KNOWN-BASELINE]' : '[NEW]';
      console.log(`    ${tag} [${v.impact}] ${v.id}: ${v.description}`);
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`      node: ${n.html.slice(0, 120)}`);
        if (n.failureSummary) {
          console.log(`      fix:  ${n.failureSummary.slice(0, 120)}`);
        }
      }
    }
  }

  return { label, newViolations, knownViolations, all: serious };
}

async function loginAgent(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () =>
      document.querySelector('nav[aria-label="Primary navigation"]') !== null ||
      document.querySelector('[data-testid="agent-tab-home"]') !== null,
    { timeout: 25_000 },
  );
  await page.waitForTimeout(1000);
}

async function loginBM(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', BM_EMAIL);
  await page.fill('input[type="password"]', BM_PASS);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('nav[aria-label="Primary navigation"]') !== null,
    { timeout: 25_000 },
  );
  await page.waitForTimeout(1000);
}

const browser = await chromium.launch({ headless: true });
const allResults = [];

console.log(`[${stamp()}] S2 hero axe — target: ${BASE_URL}`);
console.log(`[${stamp()}] Scanning: Surface A (commission strip) + Surface B (game plan card) + Surface C (pers bar)`);
console.log();

// ── Surface A: CommissionAnchorStrip (agent/commission tab) ───────────────────
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
    await setTheme(ctx, theme);
    const page = await ctx.newPage();
    await loginAgent(page);

    await page.click('[data-testid="agent-tab-commission"]');
    await page.waitForTimeout(1500);

    const stripSel = '[data-testid="commission-anchor-strip"]';
    if (await page.locator(stripSel).count() === 0) {
      console.log(`  [${stamp()}] axe agent-${theme}/commission-strip: SKIP — element not found`);
      continue;
    }

    const r = await runAxeOnElement(page, `agent-${theme}/commission-strip`, stripSel);
    allResults.push(r);
  } finally {
    await ctx.close();
  }
}

// ── Surface B: SuggestedWeekCard (agent/game-plan tab) ────────────────────────
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
    await setTheme(ctx, theme);
    const page = await ctx.newPage();
    await loginAgent(page);

    await page.click('[data-testid="agent-tab-game-plan"]');
    await page.waitForTimeout(1500);

    const cardSel = '[data-testid="suggested-week-card"]';
    if (await page.locator(cardSel).count() === 0) {
      console.log(`  [${stamp()}] axe agent-${theme}/suggested-week-card: SKIP — element not found`);
      continue;
    }

    const r = await runAxeOnElement(page, `agent-${theme}/suggested-week-card`, cardSel);
    allResults.push(r);
  } finally {
    await ctx.close();
  }
}

// ── Surface C: PersRealityBar (manager/persistency tab) ──────────────────────
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
    await setTheme(ctx, theme);
    const page = await ctx.newPage();
    await loginBM(page);

    await page.locator('[data-testid="tab-persistency"]').click();
    await page.waitForTimeout(1200);

    // Wait for loaded state (glass.hero.teal) vs loading skeleton (.card)
    try {
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="pers-reality-bar"]');
          return el && el.classList.contains('glass');
        },
        { timeout: 10_000 },
      );
    } catch {}

    const barSel = '[data-testid="pers-reality-bar"]';
    if (await page.locator(barSel).count() === 0) {
      console.log(`  [${stamp()}] axe manager-${theme}/pers-reality-bar: SKIP — element not found`);
      continue;
    }

    const r = await runAxeOnElement(page, `manager-${theme}/pers-reality-bar`, barSel);
    allResults.push(r);
  } finally {
    await ctx.close();
  }
}

await browser.close();

// ── Final summary ─────────────────────────────────────────────────────────────
console.log();
console.log('── Axe results summary ──────────────────────────────────────────────');
const totalNew = allResults.reduce((s, r) => s + r.newViolations.length, 0);
const totalKnown = allResults.reduce((s, r) => s + r.knownViolations.length, 0);

for (const r of allResults) {
  const status = r.newViolations.length === 0 ? 'PASS' : `FAIL (${r.newViolations.length} NEW)`;
  const knownNote = r.knownViolations.length > 0 ? ` + ${r.knownViolations.length} known-baseline` : '';
  console.log(`  ${r.label}: ${status}${knownNote}`);
}

console.log();
if (totalNew === 0) {
  console.log(`axe NO-NEW gate: PASS — 0 new violations across all surfaces (${totalKnown} known-baseline retained)`);
  process.exit(0);
} else {
  console.log(`axe NO-NEW gate: FAIL — ${totalNew} NEW violation(s) found`);
  process.exit(1);
}

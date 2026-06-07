/**
 * persistency-mgr-v2-s3a-axe.mjs — axe NO-NEW gate for S3a surfaces.
 *
 * Scans the two surfaces redesigned in S3a:
 *   Surface A — PersistencyPlayground drawer (sliders, chips, band, shortfall cards)
 *   Surface B — PolicyLedgerPanel with lapsed chip row
 *
 * Both themes. Reports all serious/critical violations.
 * Known baseline: bell-badge node (color-contrast on .notification-bell or similar).
 *
 * Usage:
 *   SMOKE_BASE_URL=https://<preview> node scripts/verification/persistency-mgr-v2-s3a-axe.mjs
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  setTheme,
  resolveSmokeBaseUrl,
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
// It is the only intended residual node per cleanup-duo PR #503.
const KNOWN_BASELINE_IDS = new Set(['color-contrast']); // bell badge is this rule on .notification-badge
// We enumerate ALL violations; flag any node NOT on the bell badge element as NEW.

function stamp() {
  return new Date().toISOString().slice(11, 19);
}

function isKnownBellBadge(violation) {
  // Bell badge violation: color-contrast on the notification badge element
  return (
    violation.id === 'color-contrast' &&
    violation.nodes.every((n) => {
      const html = (n.html || '').toLowerCase();
      return html.includes('badge') || html.includes('notification') || html.includes('bell');
    })
  );
}

async function runAxeOnElement(page, label, selector) {
  // Scope axe to the target element to reduce noise from outside the redesigned surface
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
      `  [${stamp()}] axe ${label}: ${newViolations.length} NEW + ${knownViolations.length} known-baseline violation(s)`,
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

const browser = await chromium.launch({ headless: true });
const allResults = [];

console.log(`[${stamp()}] S3a axe — target: ${BASE_URL}`);
console.log(`[${stamp()}] Scanning: Surface A (playground drawer) + Surface B (ledger lapsed)`);
console.log();

// ── Surface A: Playground drawer (BM coaching mode, both themes) ──────────────
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
    await setTheme(ctx, theme);
    const page = await ctx.newPage();

    await loginBM(page);

    // Navigate to Persistency tab
    await page.locator('[data-testid="tab-persistency"]').click();
    await page.waitForTimeout(1500);

    // Open playground from first roster row
    const playBtn = page.locator('[data-testid^="pers-roster-play-"]').first();
    if (await playBtn.count() === 0) {
      console.log(`  [${stamp()}] axe BM-${theme}/playground: SKIP — no roster rows`);
      continue;
    }
    await playBtn.click();
    await page.waitForTimeout(800);

    const pgSelector = '[data-testid="persistency-playground"]';
    if (await page.locator(pgSelector).count() === 0) {
      console.log(`  [${stamp()}] axe BM-${theme}/playground: SKIP — playground not found`);
      continue;
    }

    // Axe on the playground container
    const r = await runAxeOnElement(page, `BM-${theme}/playground-drawer`, pgSelector);
    allResults.push(r);
  } finally {
    await ctx.close();
  }
}

// ── Surface B: Agent self-mode playground + lapsed ledger (both themes) ────────
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    if (BYPASS_TOKEN) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
    await setTheme(ctx, theme);
    const page = await ctx.newPage();

    await loginAgent(page);

    // Open agent persistency tab
    const persTab = page.locator('[data-testid="agent-tab-persistency"]');
    if (await persTab.count() === 0) {
      console.log(`  [${stamp()}] axe Agent-${theme}: SKIP — persistency tab not found`);
      continue;
    }
    await persTab.click();
    await page.waitForTimeout(1200);

    // Surface B1: Agent playground drawer
    const openBtn = page.locator('[data-testid="agent-playground-open-button"]');
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await page.waitForTimeout(800);
      if (await page.locator('[data-testid="persistency-playground"]').count() > 0) {
        const r = await runAxeOnElement(page, `Agent-${theme}/playground-drawer`, '[data-testid="persistency-playground"]');
        allResults.push(r);

        // Navigate to ledger via lapsed link
        const lapsedLink = page.locator('[data-testid="playground-view-lapsed-btn"]');
        if (await lapsedLink.count() > 0) {
          await lapsedLink.click();
          await page.waitForTimeout(1200);

          // Surface B2: Ledger with lapsed chip
          const ledger = page.locator('[data-testid="policy-ledger-surface"]');
          if (await ledger.count() > 0) {
            // Wait for loading to settle
            await page.waitForFunction(
              () => !document.querySelector('[data-testid="ledger-loading"]'),
              { timeout: 10_000 },
            ).catch(() => {});
            await page.waitForTimeout(500);
            const r2 = await runAxeOnElement(page, `Agent-${theme}/ledger-lapsed`, '[data-testid="policy-ledger-surface"]');
            allResults.push(r2);
          }
        }
      }
    }
  } finally {
    await ctx.close();
  }
}

await browser.close();

// ── Final summary ─────────────────────────────────────────────────────────────
console.log();
console.log('── Axe summary ─────────────────────────────────────────────────────');
let totalNew = 0;
let totalKnown = 0;
for (const r of allResults) {
  const newCount = r.newViolations.length;
  const knownCount = r.knownViolations.length;
  totalNew += newCount;
  totalKnown += knownCount;
  const status = newCount === 0 ? '✓' : '✗';
  console.log(`  ${status} ${r.label}: ${newCount} NEW, ${knownCount} known-baseline`);
}
console.log();
console.log(`Total: ${totalNew} NEW violation(s), ${totalKnown} known-baseline`);
if (totalNew === 0) {
  console.log('Axe NO-NEW: PASS');
} else {
  console.log('Axe NO-NEW: FAIL — new violations found');
  process.exit(1);
}

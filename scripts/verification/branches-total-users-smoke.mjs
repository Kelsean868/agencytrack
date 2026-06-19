/**
 * branches-total-users-smoke.mjs — Branches table total-users smoke.
 *
 * Proves the Tenant Admin Branches table count now includes non-agent roles
 * (not just that the label changed). Read-only: the smoke tenant already carries
 * a role mix in smoke_branch (agent + UM + BM + SM + TA), so total > agent-only
 * is observable without seeding.
 *
 *   Leg 1 — login as A11Y_TENANT_ADMIN, open Branches.
 *   Leg 2 — smoke_branch row: total user count parsed from the testid; assert
 *           total > agent-only count (non-agents counted) and the per-role
 *           breakdown renders a non-agent role.
 *   Leg 3 — axe NO-NEW serious/critical on the Branches view.
 * Both themes (desktop viewport).
 *
 * Run with:
 *   SMOKE_PREVIEW_URL=https://agencytrack-git-feat-branches-total-users-kyron-marchan-s-projects.vercel.app \
 *   node scripts/verification/branches-total-users-smoke.mjs
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resolvePreviewUrl, runBothThemes } from './lib/walk-helpers.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');

function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = loadEnv();

const PREVIEW_URL = resolvePreviewUrl();
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = join(__dir, `${RUN_TS}-branches-total-users-screenshots`);
const BRANCH_ID = 'smoke_branch';

const results = [];
const pass = (s, n = '') => { results.push({ s, status: 'PASS', n }); console.log(`  ✓ ${s}${n ? ` — ${n}` : ''}`); };
const fail = (s, n = '') => { results.push({ s, status: 'FAIL', n }); console.log(`  ✗ ${s}${n ? ` — ${n}` : ''}`); };

async function shoot(page, name) {
  try { mkdirSync(SHOTS_DIR, { recursive: true }); await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: false }); } catch {}
}

async function loginAsTenantAdmin(page) {
  await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', E.A11Y_TENANT_ADMIN_EMAIL);
  await page.fill('input[type="password"]', E.A11Y_TENANT_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="nav-branches"]', { timeout: 45000 });
}

async function runAxe(page, theme, tag) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = (axe.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
  if (serious.length === 0) pass(`[${theme}] ${tag} axe-no-serious-critical`);
  else fail(`[${theme}] ${tag} axe-no-serious-critical`, serious.slice(0, 3).map((v) => `${v.id}(${v.nodes.length})`).join(', '));
}

async function smokeTheme(page, theme) {
  console.log(`\n── theme: ${theme} ──`);
  try {
    await loginAsTenantAdmin(page);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((theme === 'dark') === isDark) pass(`[${theme}] theme-applied`);
    else fail(`[${theme}] theme-applied`, `documentElement.dark=${isDark}`);

    // ── Leg 1 — open Branches ───────────────────────────────────────────────
    await page.click('[data-testid="nav-branches"]');
    const countCell = page.locator(`[data-testid="branch-user-count-${BRANCH_ID}"]`);
    await countCell.waitFor({ state: 'attached', timeout: 20000 });
    await shoot(page, `${theme}-branches`);
    pass(`[${theme}] leg1-branches-open`, `smoke_branch row rendered`);

    // ── Leg 2 — total includes non-agent roles ──────────────────────────────
    const txt = (await countCell.textContent())?.trim() ?? '';
    const total = (() => { const m = txt.match(/(\d+)\s*users?/); return m ? parseInt(m[1], 10) : null; })();
    const agentCount = (() => { const m = txt.match(/(\d+)\s*agents?/); return m ? parseInt(m[1], 10) : 0; })();
    const hasNonAgentRole = /\b(UM|BM|SM|TA|PA)\b/.test(txt);

    if (total != null && total > 0) pass(`[${theme}] leg2a-total-count`, `total=${total} ("${txt}")`);
    else fail(`[${theme}] leg2a-total-count`, `could not parse a positive total from "${txt}"`);

    if (total != null && total > agentCount) {
      pass(`[${theme}] leg2b-total-gt-agents`, `total ${total} > agents ${agentCount} — non-agent members counted`);
    } else {
      fail(`[${theme}] leg2b-total-gt-agents`, `total ${total} !> agents ${agentCount} — smoke tenant may lack a role mix in ${BRANCH_ID}; fall back to Phase 2 component proof`);
    }

    if (hasNonAgentRole) pass(`[${theme}] leg2c-breakdown-renders`, `breakdown shows non-agent role(s): "${txt}"`);
    else fail(`[${theme}] leg2c-breakdown-renders`, `no non-agent role token in "${txt}"`);

    // ── Leg 3 — axe NO-NEW ──────────────────────────────────────────────────
    await runAxe(page, theme, 'branches');

  } catch (err) {
    fail(`[${theme}] browser-error`, String(err?.message ?? err).slice(0, 280));
    await shoot(page, `${theme}-ERROR`);
  }
}

async function main() {
  console.log(`\n=== branches-total-users-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    await runBothThemes(browser, {
      baseUrl: PREVIEW_URL,
      token: E.VERCEL_BYPASS_TOKEN,
      viewport: { width: 1280, height: 900 },
      perTheme: async (page, theme) => { await smokeTheme(page, theme); },
    });
  } catch (err) {
    fail('fatal', String(err?.message ?? err).slice(0, 280));
    console.error(err);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  const total  = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const ok = failed === 0;
  console.log(`\n=== RESULT: ${passed}/${total} passed, ${failed} failed — ${ok ? 'OK ✓' : 'FAILED ✗'} ===`);
  console.log(`Screenshots: ${SHOTS_DIR}\n`);
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err?.stack ?? err);
  process.exit(1);
});

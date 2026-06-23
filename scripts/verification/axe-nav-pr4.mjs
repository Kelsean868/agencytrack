/**
 * axe-nav-pr4.mjs — a11y delta gate for Nav redesign PR-4 surfaces.
 *
 * Scans the surfaces this PR introduces, light + dark, for NEW serious/critical
 * axe violations:
 *   - UM dashboard in Workspace layout (toggle + My Work groups)
 *   - UM dashboard in Both layout (★ Pinned zone + toggle)
 *   - Agent Settings (Menu-layout radio cards, workspace/both disabled)
 *
 * The toggle (role=group + aria-pressed buttons) and radio cards (fieldset/legend
 * + aria-describedby + aria-disabled) use token colors only (no new hex). Reports
 * any serious/critical violation; PASS = none.
 *
 * Run:
 *   SMOKE_BASE_URL="https://<preview-host>" node scripts/verification/axe-nav-pr4.mjs
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { setupBypassSession, setTheme } from './lib/walk-helpers.mjs';

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

const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
const UM_EMAIL = process.env.A11Y_UNIT_MANAGER_EMAIL;
const UM_PASS  = process.env.A11Y_UNIT_MANAGER_PASSWORD;
const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;
if (!BYPASS_TOKEN || !BASE_URL) { console.error('Missing VERCEL_BYPASS_TOKEN / SMOKE_BASE_URL'); process.exit(1); }

const findings = [];
async function scan(page, label) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'best-practice']).analyze();
  const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length === 0) { console.log(`  axe ${label}: PASS (0 serious/critical)`); return; }
  console.log(`  axe ${label}: ${serious.length} serious/critical`);
  serious.forEach((v) => console.log(`    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`));
  findings.push({ label, serious });
}

async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 200, { timeout: 30_000 });
  await page.waitForTimeout(2500);
}
const openProfile = async (page) => { await page.locator('button[aria-label="Open profile"]').first().click(); await page.waitForTimeout(800); };

(async () => {
  console.log(`\nNav PR-4 axe delta → ${BASE_URL}`);
  const browser = await chromium.launch();

  // ── UM: Workspace + Both, light + dark ──
  if (UM_EMAIL && UM_PASS) {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
      await setTheme(ctx, theme);
      const page = await ctx.newPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await login(page, UM_EMAIL, UM_PASS);
      // Workspace
      await openProfile(page);
      await page.locator('[data-testid="menu-layout-workspace"]').click();
      await page.waitForTimeout(900);
      await scan(page, `UM workspace (${theme})`);
      // Both
      await openProfile(page);
      await page.locator('[data-testid="menu-layout-both"]').click();
      await page.waitForTimeout(900);
      await scan(page, `UM both (${theme})`);
      await ctx.close();
    }
  } else {
    console.log('  SKIP UM scans — A11Y_UNIT_MANAGER_* not set');
    findings.push({ label: 'um-creds-missing', serious: [{ impact: 'n/a', id: 'creds', help: 'UM credentials absent', nodes: [] }] });
  }

  // ── Agent: Settings (Menu-layout cards), light + dark ──
  if (AGENT_EMAIL && AGENT_PASS) {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
      await setTheme(ctx, theme);
      const page = await ctx.newPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await login(page, AGENT_EMAIL, AGENT_PASS);
      await openProfile(page);
      await scan(page, `agent settings (${theme})`);
      await ctx.close();
    }
  } else {
    console.log('  SKIP agent scans — A11Y_AGENT_* not set');
    findings.push({ label: 'agent-creds-missing', serious: [{ impact: 'n/a', id: 'creds', help: 'agent credentials absent', nodes: [] }] });
  }

  await browser.close();
  if (findings.length) {
    console.log(`\nRESULT: ${findings.length} surface(s) with serious/critical (or skipped) — review above.`);
    process.exit(1);
  }
  console.log('\nRESULT: PASS — no serious/critical on any PR-4 surface (light + dark).');
})();

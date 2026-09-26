/**
 * ledger-l1-design-check.mjs — L1 (award lens) design check ritual
 * (docs/briefs/ledger-lens-build.md § Deliverables, item 2).
 *
 * READ-ONLY. Two passes:
 *   1. PREVIEW — the PR's immutable per-deployment URL (SMOKE_PREVIEW_URL),
 *      which runs on PRODUCTION Firebase: sign in as the A11Y test agent,
 *      open the Policy Ledger and the Awards tab, screenshot. Navigation and
 *      screenshots only — nothing is clicked that writes (no tier picker, no
 *      form, no status change). The test agent has no policies and no
 *      campaign, so this documents the empty/absent states; say so, never
 *      read it as coverage of the lens.
 *   2. LOCAL FIXTURES — ledger-l1-fixture-harness.html on a Vite dev server,
 *      one screenshot per case (`?case=<id>`), rendering the real components
 *      with the unit-test fixtures (placeholder names, made-up numbers).
 *
 * 390×844 and 1440×900, light + dark, into
 * docs/reports/screenshots/ledger-2026-09-26/l1/.
 *
 * Run: SMOKE_PREVIEW_URL=<deployment url> node scripts/verification/ledger-l1-design-check.mjs
 *      (add --local-only to skip the preview pass)
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession, setTheme, waitForTheme, loginAs, captureConsoleAndNetwork, resolvePreviewUrl,
} from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(ROOT, 'docs/reports/screenshots/ledger-2026-09-26/l1');
mkdirSync(OUT_DIR, { recursive: true });

function loadEnv() {
  try {
    const src = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* no .env.local — the preview pass will refuse below */ }
}
loadEnv();

const LOCAL_ONLY = process.argv.includes('--local-only');
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];
const THEMES = ['light', 'dark'];
const CASES = ['campaign', 'campaign-vip', 'month', 'quarter', 'annual', 'mdrt', 'closed', 'empty', 'campaign-screen'];

const results = [];
const consoleErrors = [];

async function openTab(page, testId, label) {
  // The desktop sidebar and the mobile bottom nav / More sheet both carry the
  // same testid; only the visible one is clickable at a given viewport.
  const loc = page.locator(`[data-testid="${testId}"]:visible`).first();
  if (await loc.isVisible({ timeout: 4000 }).catch(() => false)) {
    await loc.click();
    return true;
  }
  const more = page.locator('[data-testid="bottomnav-more"]:visible').first();
  if (await more.isVisible({ timeout: 2000 }).catch(() => false)) {
    await more.click();
    // The More sheet's rows carry no testid — match the visible label.
    const inSheet = page.getByText(label, { exact: true }).locator('visible=true').first();
    if (await inSheet.count()) {
      await inSheet.scrollIntoViewIfNeeded().catch(() => {});
      await inSheet.click();
      return true;
    }
    await page.keyboard.press('Escape').catch(() => {});
  }
  return false;
}

// ── Pass 1 — the real preview (read-only) ───────────────────────────────────
async function previewPass(browser) {
  const url = resolvePreviewUrl();
  const token = process.env.VERCEL_BYPASS_TOKEN;
  const email = process.env.A11Y_AGENT_EMAIL;
  const password = process.env.A11Y_AGENT_PASSWORD;
  if (!token || !email || !password) {
    console.log('[skip] preview pass — VERCEL_BYPASS_TOKEN / A11Y_AGENT_* not all present');
    results.push({ pass: 'preview', status: 'SKIP', note: 'credentials absent' });
    return;
  }
  console.log(`\n=== PREVIEW PASS (read-only) — ${url.replace(/^https?:\/\//, '').split('.')[0]}… ===`);
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
        await setupBypassSession(context, url, token);
        await setTheme(context, theme);
        const page = await context.newPage();
        const capture = captureConsoleAndNetwork(page);
        await loginAs(page, url, email, password);
        await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
        await page.waitForTimeout(1500);

        if (await openTab(page, 'agent-tab-policy-ledger', 'Policy Ledger')) {
          await page.locator('[data-testid="policy-ledger-surface"]').waitFor({ timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(1500);
          const lens = await page.locator('[data-testid="award-lens-panel"]').count();
          const empty = await page.locator('[data-testid="ledger-empty"]').count();
          const shot = resolve(OUT_DIR, `preview-ledger-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          results.push({ pass: 'preview', view: 'ledger', vp: vp.name, theme, status: 'SHOT', note: `award-lens-panel=${lens} ledger-empty=${empty}` });
          console.log(`  saved ${shot} (award-lens-panel=${lens}, ledger-empty=${empty})`);
        } else {
          results.push({ pass: 'preview', view: 'ledger', vp: vp.name, theme, status: 'SKIP', note: 'Policy Ledger tab not reachable' });
        }

        if (await openTab(page, 'agent-tab-awards', 'Awards')) {
          await page.waitForTimeout(2500);
          const screen = await page.locator('[data-testid="campaign-screen"]').count();
          const shot = resolve(OUT_DIR, `preview-awards-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          results.push({ pass: 'preview', view: 'awards', vp: vp.name, theme, status: 'SHOT', note: `campaign-screen=${screen} (0 = test agent has no campaign — see FOLLOW_UPS § A11Y test agent has no campaign)` });
          console.log(`  saved ${shot} (campaign-screen=${screen})`);
        } else {
          results.push({ pass: 'preview', view: 'awards', vp: vp.name, theme, status: 'SKIP', note: 'Awards tab not reachable' });
        }

        const errors = capture.consoleMessages.filter((m) => m.type === 'error');
        if (errors.length) consoleErrors.push({ pass: 'preview', vp: vp.name, theme, errors: errors.map((m) => String(m.text).slice(0, 200)) });
      } catch (e) {
        results.push({ pass: 'preview', vp: vp.name, theme, status: 'FAIL', note: e.message });
        console.log(`  [FAIL] preview ${vp.name}-${theme}: ${e.message}`);
      } finally {
        await context.close();
      }
    }
  }
}

// ── Pass 2 — local fixtures ─────────────────────────────────────────────────
async function fixturePass(browser) {
  console.log('\n=== LOCAL FIXTURE PASS ===');
  const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error' });
  await server.listen();
  const { port } = server.httpServer.address();
  const base = `http://localhost:${port}/scripts/verification/ledger-l1-fixture-harness.html`;
  try {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        try {
          await setTheme(context, theme);
          const page = await context.newPage();
          const capture = captureConsoleAndNetwork(page);
          for (const id of CASES) {
            await page.goto(`${base}?case=${id}`, { waitUntil: 'domcontentloaded' });
            await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
            await page.locator(`[data-case="${id}"]`).waitFor({ timeout: 20000 });
            await page.waitForTimeout(900);
            const shot = resolve(OUT_DIR, `local-fixture-${id}-${vp.name}-${theme}.png`);
            await page.screenshot({ path: shot, fullPage: true });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            results.push({ pass: 'fixture', view: id, vp: vp.name, theme, status: overflow ? 'WARN' : 'SHOT', note: overflow ? 'horizontal overflow' : '' });
          }
          const errors = capture.consoleMessages.filter((m) => m.type === 'error');
          if (errors.length) consoleErrors.push({ pass: 'fixture', vp: vp.name, theme, errors: errors.map((m) => String(m.text).slice(0, 200)) });
          console.log(`  ${vp.name}-${theme}: ${CASES.length} cases saved`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await server.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  if (!LOCAL_ONLY) await previewPass(browser);
  await fixturePass(browser);
} finally {
  await browser.close();
}

console.log('\n══════════════════════════════════════════');
for (const r of results) console.log(`${r.status.padEnd(5)} ${r.pass.padEnd(8)} ${(r.view ?? '').padEnd(16)} ${r.vp ?? ''}-${r.theme ?? ''} ${r.note ?? ''}`);
console.log(`Console errors captured: ${consoleErrors.length}`);
for (const e of consoleErrors) console.log(`  ${e.pass} ${e.vp}-${e.theme}: ${JSON.stringify(e.errors).slice(0, 400)}`);
console.log(`Screenshots in: ${OUT_DIR}`);
console.log('══════════════════════════════════════════');
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);

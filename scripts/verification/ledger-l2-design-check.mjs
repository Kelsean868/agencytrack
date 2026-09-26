/**
 * ledger-l2-design-check.mjs — L2 (filter/sort/export) design check ritual
 * (docs/briefs/ledger-lens-build.md § Deliverables, item 2).
 *
 * READ-ONLY. Two passes:
 *   1. PREVIEW — the PR's immutable per-deployment URL (SMOKE_PREVIEW_URL),
 *      which runs on PRODUCTION Firebase: sign in as the A11Y test agent, open
 *      the Policy Ledger. Navigation and screenshots only — never Save view,
 *      never Export, never any control that writes. The test agent has no
 *      policies and no campaign, so this documents the empty state only; say
 *      so, never read it as coverage of the filter/sort/export surfaces.
 *   2. LOCAL FIXTURES — ledger-l2-fixture-harness.html on a Vite dev server,
 *      one screenshot per case (`?case=<id>`), rendering the real L2
 *      components (LedgerFilterSort / LedgerTable / LedgerExportMenu) over the
 *      L1 award-lens fixtures. `useAuth()` is aliased to a fixture double
 *      (scripts/verification/fixtures/mockAuthContext.jsx) that returns
 *      `tenantId: null`, so a saved-view write inside this pass can never
 *      reach real Firestore.
 *
 * 390×844 and 1440×900, light + dark, into
 * docs/reports/screenshots/ledger-2026-09-26/l2/.
 *
 * Run: SMOKE_PREVIEW_URL=<deployment url> node scripts/verification/ledger-l2-design-check.mjs
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
const OUT_DIR = resolve(ROOT, 'docs/reports/screenshots/ledger-2026-09-26/l2');
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
const CASES = ['rail-default', 'rail-filtered', 'sheet-open', 'empty-filters', 'no-policies'];

const results = [];
const consoleErrors = [];

async function openTab(page, testId, label) {
  const loc = page.locator(`[data-testid="${testId}"]:visible`).first();
  if (await loc.isVisible({ timeout: 4000 }).catch(() => false)) {
    await loc.click();
    return true;
  }
  const more = page.locator('[data-testid="bottomnav-more"]:visible').first();
  if (await more.isVisible({ timeout: 2000 }).catch(() => false)) {
    await more.click();
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

// ── Pass 1 — the real preview (read-only, never writes) ─────────────────────
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
          const filterSort = await page.locator('[data-testid="ledger-filter-sort"]').count();
          const empty = await page.locator('[data-testid="ledger-empty"]').count();
          const shot = resolve(OUT_DIR, `preview-ledger-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          results.push({
            pass: 'preview', view: 'ledger', vp: vp.name, theme, status: 'SHOT',
            note: `ledger-filter-sort=${filterSort} ledger-empty=${empty} (agent has no policies — no filter/sort/export coverage here, see local fixture pass)`,
          });
          console.log(`  saved ${shot} (ledger-filter-sort=${filterSort}, ledger-empty=${empty})`);
        } else {
          results.push({ pass: 'preview', view: 'ledger', vp: vp.name, theme, status: 'SKIP', note: 'Policy Ledger tab not reachable' });
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
  // Fixture-harness-ONLY resolver plugin (this ad-hoc dev server, never the
  // shared vite.config.js): any import ending in `/context/AuthContext(.jsx)`
  // — however many `../` it carries — resolves to a fixture double whose
  // useAuth() returns tenantId:null, so useLedgerSavedViews /
  // useLedgerTargetTier can never reach real Firestore even if "Save view" is
  // clicked in this pass. A plain `resolve.alias` entry does NOT work here:
  // Vite/Rollup alias matching runs against the import SPECIFIER as written
  // (e.g. `../../../context/AuthContext`), not the pre-resolved absolute
  // path, so an absolute-path `find` never matches (verified by running this
  // script and seeing the REAL AuthContext still throw — Rule 17).
  const mockAuthPlugin = {
    name: 'ledger-l2-mock-auth-context',
    enforce: 'pre',
    resolveId(source) {
      if (/\/context\/AuthContext(\.jsx)?$/.test(source)) {
        return resolve(__dirname, 'fixtures/mockAuthContext.jsx');
      }
      return null;
    },
  };
  const server = await createServer({
    root: ROOT,
    server: { port: 0 },
    logLevel: 'error',
    plugins: [mockAuthPlugin],
  });
  await server.listen();
  const { port } = server.httpServer.address();
  const base = `http://localhost:${port}/scripts/verification/ledger-l2-fixture-harness.html`;
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

            // 'sheet-open' — the mobile bottom sheet only exists at <lg widths;
            // open it here at 390 so the shot actually shows the sheet, not
            // just the trigger. At 1440 the rail renders instead (no sheet).
            let sheetOpened = false;
            if (id === 'sheet-open' && vp.name === '390') {
              const trigger = page.locator('[data-testid="ledger-filter-sheet-trigger"]').first();
              if (await trigger.isVisible().catch(() => false)) {
                await trigger.click();
                await page.waitForTimeout(400);
                sheetOpened = true;
              }
            }

            const shot = resolve(OUT_DIR, `local-fixture-${id}-${vp.name}-${theme}.png`);
            await page.screenshot({ path: shot, fullPage: true });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            results.push({ pass: 'fixture', view: id, vp: vp.name, theme, status: overflow ? 'WARN' : 'SHOT', note: overflow ? 'horizontal overflow' : '' });

            // The sheet is a `position: fixed` overlay with its OWN internal
            // `overflow-y-auto` scroll container — a `fullPage` screenshot
            // captures the document's scroll height, not the sheet's, so
            // everything below the sheet's own first screenful (Who / Product
            // / Frequency / Date / API) is invisible in the shot above. Scroll
            // the sheet's own scrollable region and take a second shot so
            // those sections are actually reviewed, not just assumed present.
            if (sheetOpened) {
              const scrollable = page.locator('[role="dialog"][aria-label="Filter and sort"] .overflow-y-auto').first();
              await scrollable.evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
              await page.waitForTimeout(300);
              const shot2 = resolve(OUT_DIR, `local-fixture-${id}-scrolled-${vp.name}-${theme}.png`);
              await page.screenshot({ path: shot2, fullPage: true });
              results.push({ pass: 'fixture', view: `${id}-scrolled`, vp: vp.name, theme, status: 'SHOT', note: 'sheet scrolled to bottom (Who/Product/Frequency/Date/API)' });
            }
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

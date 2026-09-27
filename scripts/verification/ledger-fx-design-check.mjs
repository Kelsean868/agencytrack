/**
 * ledger-fx-design-check.mjs — FX (small fixes) design check
 * (docs/briefs/ledger-layout-and-l3.md § FX; ritual in
 * docs/briefs/ledger-lens-build.md § Deliverables item 2).
 *
 * READ-ONLY, local fixtures only — no live data, no client names, no real
 * policy numbers. Reuses the LX and L0 harnesses verbatim (same offline
 * doubles, same dev server), so the screenshots are evidence of the SHIPPED
 * components, not a re-composition of them:
 *
 *   1. FX item 1 — the Policy Ledger filter rail / mobile filter sheet date
 *      boxes, via ledger-lx-fixture-harness.html?case=campaign (the same
 *      offline PolicyLedgerPanel the LX design check already exercises).
 *      Also MEASURES each date input's scrollWidth <= clientWidth.
 *   2. FX item 2 — the Home hero ring legend wording, via
 *      ledger-l0-fixture-harness.html (HeroCard with pending, unchanged).
 *
 * Screenshots at 390×844 and 1440×900, light + dark, into
 * docs/reports/screenshots/ledger-2026-09-26/fx/.
 *
 * Run: node scripts/verification/ledger-fx-design-check.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setTheme, waitForTheme } from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(ROOT, 'docs/reports/screenshots/ledger-2026-09-26/fx');
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];
const THEMES = ['light', 'dark'];

const results = [];
const measurements = [];

// Same offline aliases as ledger-lx-design-check.mjs (LX), reused verbatim.
const FIXTURE_ALIASES = [
  [/\/context\/AuthContext(\.jsx)?$/, 'fixtures/lx/mockAuthContext.jsx'],
  [/\/services\/policiesService(\.js)?$/, 'fixtures/lx/policiesService.js'],
  [/\/services\/planCatalogService(\.js)?$/, 'fixtures/lx/planCatalogService.js'],
  [/\/services\/campaignService(\.js)?$/, 'fixtures/lx/campaignService.js'],
  [/\/services\/userPrefsService(\.js)?$/, 'fixtures/lx/userPrefsService.js'],
  [/\/hooks\/useFeatureFlag(\.js)?$/, 'fixtures/lx/useFeatureFlag.js'],
];
const mockPlugin = {
  name: 'ledger-fx-offline-fixtures',
  enforce: 'pre',
  resolveId(source) {
    for (const [re, target] of FIXTURE_ALIASES) {
      if (re.test(source)) return resolve(__dirname, target);
    }
    if (/\/firebase(\.js)?$/.test(source) && !source.includes('node_modules')) {
      return resolve(ROOT, 'src/__mocks__/firebase.js');
    }
    return null;
  },
};

// ── Measure: scrollWidth <= clientWidth on every date input (Rule "measure, don't look") ──
async function measureDateInputs(page, label) {
  return page.evaluate((lbl) => {
    const rows = [...document.querySelectorAll('[data-testid="ledger-filter-date-from"], [data-testid="ledger-filter-date-to"]')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({
        testid: el.getAttribute('data-testid'),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        fits: el.scrollWidth <= el.clientWidth,
        value: el.value || el.placeholder,
      }));
    return { label: lbl, inputs: rows };
  }, label);
}

// ── FX item 1 — Policy Ledger filter rail / mobile sheet date boxes ──────────
async function fxItem1(browser, base) {
  console.log('\n=== FX item 1 — filter date boxes (rail + mobile sheet) ===');
  const harness = `${base}/scripts/verification/ledger-lx-fixture-harness.html?case=campaign`;
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
        await setTheme(context, theme);
        const page = await context.newPage();
        await page.goto(harness, { waitUntil: 'domcontentloaded' });
        await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
        await page.locator('[data-testid="award-lens-rings"]').waitFor({ timeout: 20000 });
        await page.waitForTimeout(600);

        if (vp.name === '1440') {
          // Desktop: the rail's date boxes are already visible, no interaction needed.
          const shot = resolve(OUT_DIR, `rail-dates-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          const m = await measureDateInputs(page, `rail-${vp.name}-${theme}`);
          measurements.push(m);
          const fail = m.inputs.length === 0 || m.inputs.some((i) => !i.fits);
          results.push({ item: 1, view: 'rail', vp: vp.name, theme, status: fail ? 'FAIL' : 'PASS', note: JSON.stringify(m.inputs) });
          console.log(`  saved ${shot}`);
        } else {
          // Mobile: open the filter sheet, scroll the Date section into view.
          // The rail's copy of the same data-testid also exists off-screen in
          // the DOM below `lg` (just `hidden`), so scope to the open dialog.
          await page.locator('[data-testid="ledger-filter-sheet-trigger"]').click();
          await page.waitForTimeout(400);
          const dialog = page.getByRole('dialog', { name: 'Filter and sort' });
          await dialog.locator('[data-testid="ledger-filter-date-from"]').scrollIntoViewIfNeeded();
          await page.waitForTimeout(200);
          const shot = resolve(OUT_DIR, `sheet-dates-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: false });
          const m = await measureDateInputs(page, `sheet-${vp.name}-${theme}`);
          measurements.push(m);
          const fail = m.inputs.length === 0 || m.inputs.some((i) => !i.fits);
          results.push({ item: 1, view: 'sheet', vp: vp.name, theme, status: fail ? 'FAIL' : 'PASS', note: JSON.stringify(m.inputs) });
          console.log(`  saved ${shot}`);
        }
      } catch (e) {
        results.push({ item: 1, vp: vp.name, theme, status: 'FAIL', note: e.message });
        console.log(`  [FAIL] ${vp.name}-${theme}: ${e.message}`);
      } finally {
        await context.close();
      }
    }
  }
}

// ── FX item 2 — Home hero ring legend, value form ────────────────────────────
async function fxItem2(browser, base) {
  console.log('\n=== FX item 2 — Home hero legend (values, matches C1) ===');
  const harness = `${base}/scripts/verification/ledger-l0-fixture-harness.html`;
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
        await setTheme(context, theme);
        const page = await context.newPage();
        await page.goto(harness, { waitUntil: 'domcontentloaded' });
        await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
        await page.locator('[data-testid="ring-legend"]').first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(500);
        const shot = resolve(OUT_DIR, `hero-legend-${vp.name}-${theme}.png`);
        // Crop to just the first ("pending present") hero section.
        const section = page.locator('section').first();
        await section.screenshot({ path: shot });
        const text = await page.locator('[data-testid="ring-legend"]').first().textContent();
        const ok = /Settled\s+[\d,]+/.test(text) && /Submitted\s+[\d,]+/.test(text) && !/counts|waiting to settle/.test(text);
        results.push({ item: 2, view: 'hero-legend', vp: vp.name, theme, status: ok ? 'PASS' : 'FAIL', note: text });
        console.log(`  saved ${shot} — legend text: "${text}"`);
      } catch (e) {
        results.push({ item: 2, vp: vp.name, theme, status: 'FAIL', note: e.message });
        console.log(`  [FAIL] ${vp.name}-${theme}: ${e.message}`);
      } finally {
        await context.close();
      }
    }
  }
}

const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error', plugins: [mockPlugin] });
await server.listen();
const base = `http://localhost:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  await fxItem1(browser, base);
  await fxItem2(browser, base);
} finally {
  await browser.close();
  await server.close();
}

writeFileSync(resolve(OUT_DIR, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
console.log('\n══════════════════════════════════════════');
for (const r of results) console.log(`${r.status.padEnd(5)} item${r.item} ${(r.view ?? '').padEnd(10)} ${r.vp ?? ''}-${r.theme ?? ''} ${r.note ?? ''}`);
console.log(`Measurements: ${resolve(OUT_DIR, 'measurements.json')}`);
console.log(`Screenshots in: ${OUT_DIR}`);
console.log('══════════════════════════════════════════');
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);

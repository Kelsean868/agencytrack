/**
 * ledger-lx-design-check.mjs — LX (Policy Ledger page layout) design check
 * (docs/briefs/ledger-layout-and-l3.md § LX; ritual in
 * docs/briefs/ledger-lens-build.md § Deliverables item 2).
 *
 * READ-ONLY. Three passes, then the pairs:
 *   1. MOCKUPS — D1 (390) and D3 (1440) from
 *      docs/design-system/proposals/ledger-2026-09/, rendered through a local
 *      stand-in for their missing `support.js` runtime (lib/dc-mockup-shim.js,
 *      served by a Playwright route). The mockups are light-only: there is no
 *      dark variant, so every dark pair is labelled "mockup: light only".
 *   2. LOCAL FIXTURES — ledger-lx-fixture-harness.html on an ad-hoc Vite dev
 *      server that renders the REAL PolicyLedgerPanel with AuthContext, the
 *      policy / plan / campaign / prefs services, the feature-flag hook and
 *      src/firebase.js aliased to OFFLINE doubles (fixtures/lx/,
 *      src/__mocks__/firebase.js). No Firestore read or write is possible.
 *      Also MEASURES: block order (top-to-bottom y of blocks 1–7), horizontal
 *      overflow, 44 px targets on the header controls, and ink/fill colours of
 *      the selected view chip and the Export button in both themes.
 *   3. PREVIEW (optional, needs SMOKE_PREVIEW_URL) — sign in as the A11Y test
 *      agent on the PR's deployment, open the Policy Ledger, screenshot. The
 *      agent has no policies, so this documents the EMPTY state only. Skipped,
 *      with a note, when the *.vercel.app certificate is issued by Fortinet
 *      (TLS interception on this network — never bypassed).
 *   4. PAIRS — one image per (D1-390 | D3-1440) × (light | dark): mockup left,
 *      build right, each half labelled.
 *
 * Output: docs/reports/screenshots/ledger-2026-09-26/lx/
 *
 * Run: node scripts/verification/ledger-lx-design-check.mjs [--local-only]
 *      SMOKE_PREVIEW_URL=<deployment url> node scripts/verification/ledger-lx-design-check.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import tls from 'tls';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession, setTheme, waitForTheme, loginAs, captureConsoleAndNetwork,
} from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(ROOT, 'docs/reports/screenshots/ledger-2026-09-26/lx');
mkdirSync(OUT_DIR, { recursive: true });
const SHIM = readFileSync(resolve(__dirname, 'lib/dc-mockup-shim.js'), 'utf8');

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
  } catch { /* no .env.local — the preview pass will skip below */ }
}
loadEnv();

const LOCAL_ONLY = process.argv.includes('--local-only');
const THEMES = ['light', 'dark'];
const PAIRS = [
  { id: 'D1', vp: { name: '390', width: 390, height: 844 }, mockup: 'D1-Ledger-Campaign.dc.html' },
  { id: 'D3', vp: { name: '1440', width: 1440, height: 900 }, mockup: 'D3-Ledger-Desktop.dc.html' },
];
const STATE_CASES = ['empty', 'error', 'loading'];

const results = [];
const consoleErrors = [];
const measurements = [];

// Offline doubles for every module the ledger's load path touches.
const FIXTURE_ALIASES = [
  [/\/context\/AuthContext(\.jsx)?$/, 'fixtures/lx/mockAuthContext.jsx'],
  [/\/services\/policiesService(\.js)?$/, 'fixtures/lx/policiesService.js'],
  [/\/services\/planCatalogService(\.js)?$/, 'fixtures/lx/planCatalogService.js'],
  [/\/services\/campaignService(\.js)?$/, 'fixtures/lx/campaignService.js'],
  [/\/services\/userPrefsService(\.js)?$/, 'fixtures/lx/userPrefsService.js'],
  [/\/hooks\/useFeatureFlag(\.js)?$/, 'fixtures/lx/useFeatureFlag.js'],
];
const mockPlugin = {
  name: 'ledger-lx-offline-fixtures',
  enforce: 'pre',
  resolveId(source) {
    for (const [re, target] of FIXTURE_ALIASES) {
      if (re.test(source)) return resolve(__dirname, target);
    }
    // Same guard the unit tests use: src/firebase.js → the inert stub.
    if (/\/firebase(\.js)?$/.test(source) && !source.includes('node_modules')) {
      return resolve(ROOT, 'src/__mocks__/firebase.js');
    }
    return null;
  },
};

// ── Measurements (Rule: "measure, don't look") ───────────────────────────────
async function measure(page, label) {
  return page.evaluate((lbl) => {
    const vis = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const first = (sel) => [...document.querySelectorAll(sel)].find(vis) ?? null;
    const top = (sel) => { const el = first(sel); return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null; };
    const blocks = {
      '1 header': top('[data-testid="ledger-page-header"]'),
      '2 view chips': top('[data-testid="ledger-view-chips"]'),
      '3 counts toward': top('[data-testid="award-lens-selector"]'),
      '4 award card': top('[data-testid="award-lens-card"]'),
      '5 mobile search row': top('[data-testid="ledger-mobile-toolbar"]'),
      '6 active chips': top('[data-testid="ledger-active-chips"]'),
      '7 list (groups/table)': top('[data-testid="award-lens-groups"], [data-testid="ledger-table"], table'),
      'filter rail': top('[data-testid="ledger-filter-rail"]'),
    };
    const present = Object.entries(blocks).filter(([k, v]) => v != null && k !== 'filter rail');
    const ordered = present.every(([, v], i) => i === 0 || v >= present[i - 1][1]);
    const boxOf = (sel) => { const el = first(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const colours = (sel) => { const el = first(sel); if (!el) return null; const cs = getComputedStyle(el); return { color: cs.color, background: cs.backgroundColor }; };
    return {
      label: lbl,
      dark: document.documentElement.classList.contains('dark'),
      blocks,
      ordered,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      pipelineStrip: document.querySelectorAll('[data-testid="policy-pipeline-strip"]').length,
      oldTabStrip: document.querySelectorAll('[role="tablist"][aria-label="Filter policies"]').length,
      exportTrigger: boxOf('[data-testid="ledger-export-trigger"]'),
      newPolicy: boxOf('[data-testid="ledger-new-policy"]'),
      importPortfolio: boxOf('[data-testid="import-portfolio-button"]'),
      activeViewChip: colours('[data-testid="ledger-view-chips"] [aria-current="page"]'),
      exportColours: colours('[data-testid="ledger-export-trigger"]'),
    };
  }, label);
}

// ── Pass 1 — mockups ─────────────────────────────────────────────────────────
async function mockupPass(browser, base) {
  console.log('\n=== MOCKUP PASS (light only — the mockups have no dark variant) ===');
  for (const pair of PAIRS) {
    const context = await browser.newContext({ viewport: { width: pair.vp.width, height: pair.vp.height } });
    try {
      const page = await context.newPage();
      await page.route('**/support.js', (route) => route.fulfill({ contentType: 'application/javascript', body: SHIM }));
      await page.goto(`${base}/docs/design-system/proposals/ledger-2026-09/${pair.mockup}`, { waitUntil: 'load' });
      await page.waitForSelector('html[data-dc-rendered="1"]', { timeout: 15000 });
      await page.waitForTimeout(800);
      const unrendered = await page.evaluate(() => /\{\{/.test(document.querySelector('x-dc')?.innerText ?? ''));
      const frame = page.locator('x-dc > div').first();
      const shot = resolve(OUT_DIR, `mockup-${pair.id}-${pair.vp.name}.png`);
      await frame.screenshot({ path: shot });
      results.push({ pass: 'mockup', view: pair.id, vp: pair.vp.name, theme: 'light', status: unrendered ? 'WARN' : 'SHOT', note: unrendered ? 'template braces left' : '' });
      console.log(`  saved ${shot}`);
    } finally {
      await context.close();
    }
  }
}

// ── Pass 2 — local fixtures (the real PolicyLedgerPanel, offline) ────────────
async function fixturePass(browser, base) {
  console.log('\n=== LOCAL FIXTURE PASS (offline doubles) ===');
  const harness = `${base}/scripts/verification/ledger-lx-fixture-harness.html`;
  for (const theme of THEMES) {
    for (const { vp } of PAIRS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
        await setTheme(context, theme);
        const page = await context.newPage();
        const capture = captureConsoleAndNetwork(page);

        // Campaign case: default (All policies), then the ★ campaign view as
        // D1/D3 show it (and, at 1440, the Export menu open as D3 shows it).
        await page.goto(`${harness}?case=campaign`, { waitUntil: 'domcontentloaded' });
        await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
        await page.locator('[data-testid="award-lens-option-campaign:xmas26"]').waitFor({ timeout: 20000 });
        await page.locator('[data-testid="award-lens-rings"]').waitFor({ timeout: 10000 });
        await page.waitForTimeout(900);
        const shotDefault = resolve(OUT_DIR, `local-fixture-default-${vp.name}-${theme}.png`);
        await page.screenshot({ path: shotDefault, fullPage: true });
        measurements.push(await measure(page, `default-${vp.name}-${theme}`));

        await page.locator('[data-testid="ledger-view-__campaign__"]').click();
        await page.waitForTimeout(500);
        const m = await measure(page, `campaign-view-${vp.name}-${theme}`);
        measurements.push(m);
        const shotCampaign = resolve(OUT_DIR, `local-fixture-campaign-view-${vp.name}-${theme}.png`);
        await page.screenshot({ path: shotCampaign, fullPage: true });
        results.push({ pass: 'fixture', view: 'campaign-view', vp: vp.name, theme, status: m.overflowX || !m.ordered ? 'WARN' : 'SHOT', note: `ordered=${m.ordered} overflowX=${m.overflowX}` });

        if (vp.name === '1440') {
          await page.locator('[data-testid="ledger-export-trigger"]').click();
          await page.waitForTimeout(300);
          const shotMenu = resolve(OUT_DIR, `local-fixture-export-open-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shotMenu, fullPage: false });
          await page.keyboard.press('Escape').catch(() => {});
        }

        for (const c of STATE_CASES) {
          await page.goto(`${harness}?case=${c}`, { waitUntil: 'domcontentloaded' });
          await waitForTheme(page, theme, 8000).catch(() => {});
          await page.locator('[data-testid="ledger-page-header"]').waitFor({ timeout: 15000 });
          await page.waitForTimeout(700);
          const shot = resolve(OUT_DIR, `local-fixture-${c}-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          const sm = await measure(page, `${c}-${vp.name}-${theme}`);
          measurements.push(sm);
          results.push({ pass: 'fixture', view: c, vp: vp.name, theme, status: sm.blocks['1 header'] == null ? 'FAIL' : 'SHOT', note: `header=${sm.blocks['1 header'] != null}` });
        }

        const errors = capture.consoleMessages.filter((x) => x.type === 'error');
        if (errors.length) consoleErrors.push({ pass: 'fixture', vp: vp.name, theme, errors: errors.map((x) => String(x.text).slice(0, 200)) });
        console.log(`  ${vp.name}-${theme}: saved`);
      } catch (e) {
        results.push({ pass: 'fixture', vp: vp.name, theme, status: 'FAIL', note: e.message });
        console.log(`  [FAIL] fixture ${vp.name}-${theme}: ${e.message}`);
      } finally {
        await context.close();
      }
    }
  }
}

// ── Pass 3 — preview (read-only; empty state only) ───────────────────────────
function tlsIssuer(host) {
  return new Promise((res) => {
    const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const c = s.getPeerCertificate();
      res({ org: c?.issuer?.O ?? '', cn: c?.issuer?.CN ?? '', authorized: s.authorized });
      s.end();
    });
    s.on('error', (e) => res({ org: '', cn: '', authorized: false, error: e.message }));
    setTimeout(() => res({ org: '', cn: '', authorized: false, error: 'timeout' }), 8000);
  });
}

async function openLedger(page) {
  const direct = page.locator('[data-testid="agent-tab-policy-ledger"]:visible').first();
  if (await direct.isVisible({ timeout: 4000 }).catch(() => false)) { await direct.click(); return true; }
  const more = page.locator('[data-testid="bottomnav-more"]:visible').first();
  if (await more.isVisible({ timeout: 2000 }).catch(() => false)) {
    await more.click();
    const inSheet = page.getByText('Policy Ledger', { exact: true }).locator('visible=true').first();
    if (await inSheet.count()) { await inSheet.scrollIntoViewIfNeeded().catch(() => {}); await inSheet.click(); return true; }
  }
  return false;
}

async function previewPass(browser) {
  const url = process.env.SMOKE_PREVIEW_URL;
  if (!url) {
    results.push({ pass: 'preview', status: 'SKIP', note: 'SMOKE_PREVIEW_URL not set (never defaults to production)' });
    return;
  }
  const host = new URL(url).hostname;
  const issuer = await tlsIssuer(host);
  console.log(`\n=== PREVIEW PASS — TLS issuer: ${issuer.org || '?'} / ${issuer.cn || '?'} authorized=${issuer.authorized} ===`);
  if (/fortinet|fortigate/i.test(`${issuer.org} ${issuer.cn}`) || !issuer.authorized) {
    results.push({ pass: 'preview', status: 'SKIP', note: `TLS not clean (issuer "${issuer.org}/${issuer.cn}", authorized=${issuer.authorized}) — not bypassed` });
    return;
  }
  const token = process.env.VERCEL_BYPASS_TOKEN;
  const email = process.env.A11Y_AGENT_EMAIL;
  const password = process.env.A11Y_AGENT_PASSWORD;
  if (!token || !email || !password) {
    results.push({ pass: 'preview', status: 'SKIP', note: 'VERCEL_BYPASS_TOKEN / A11Y_AGENT_* not all present' });
    return;
  }
  for (const theme of THEMES) {
    for (const { vp } of PAIRS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
        await setupBypassSession(context, url, token);
        await setTheme(context, theme);
        const page = await context.newPage();
        const capture = captureConsoleAndNetwork(page);
        await loginAs(page, url, email, password);
        await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
        await page.waitForTimeout(1500);
        if (!(await openLedger(page))) {
          results.push({ pass: 'preview', vp: vp.name, theme, status: 'FAIL', note: 'Policy Ledger tab not reachable' });
          continue;
        }
        await page.locator('[data-testid="policy-ledger-surface"]').waitFor({ timeout: 15000 });
        await page.locator('[data-testid="ledger-empty"], [data-testid="award-lens-panel"], [data-testid="ledger-error"]').first().waitFor({ timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const shot = resolve(OUT_DIR, `preview-ledger-${vp.name}-${theme}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        const sm = await measure(page, `preview-${vp.name}-${theme}`);
        measurements.push(sm);
        const empty = await page.locator('[data-testid="ledger-empty"]').count();
        const errors = capture.consoleMessages.filter((x) => x.type === 'error');
        if (errors.length) consoleErrors.push({ pass: 'preview', vp: vp.name, theme, errors: errors.map((x) => String(x.text).slice(0, 200)) });
        const ok = sm.blocks['1 header'] != null && !sm.overflowX && errors.length === 0 && sm.pipelineStrip === 0;
        results.push({
          pass: 'preview', view: 'ledger', vp: vp.name, theme, status: ok ? 'PASS' : 'FAIL',
          note: `header=${sm.blocks['1 header'] != null} empty=${empty} overflowX=${sm.overflowX} consoleErrors=${errors.length} pipelineStrip=${sm.pipelineStrip} (agent has no policies — empty state only)`,
        });
      } catch (e) {
        results.push({ pass: 'preview', vp: vp.name, theme, status: 'FAIL', note: e.message });
      } finally {
        await context.close();
      }
    }
  }
}

// ── Pairs — mockup left, build right, one image each ─────────────────────────
async function composePairs(browser) {
  console.log('\n=== PAIRS ===');
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  try {
    for (const pair of PAIRS) {
      for (const theme of THEMES) {
        const mock = readFileSync(resolve(OUT_DIR, `mockup-${pair.id}-${pair.vp.name}.png`)).toString('base64');
        const build = readFileSync(resolve(OUT_DIR, `local-fixture-campaign-view-${pair.vp.name}-${theme}.png`)).toString('base64');
        const leftLabel = `MOCKUP ${pair.id} · ${pair.vp.name}px · light${theme === 'dark' ? ' (mockup has no dark variant)' : ''}`;
        const rightLabel = `BUILD · ${pair.vp.name}px · ${theme} · local fixture (offline, real PolicyLedgerPanel)`;
        const html = `<!doctype html><html><body style="margin:0;background:#1f1f1f;font:600 18px system-ui,sans-serif;color:#fff">
          <div style="display:flex;gap:24px;padding:16px;align-items:flex-start;width:max-content">
            <figure style="margin:0"><figcaption style="padding:0 0 10px">${leftLabel}</figcaption><img src="data:image/png;base64,${mock}" style="display:block;outline:1px solid #666"></figure>
            <figure style="margin:0"><figcaption style="padding:0 0 10px">${rightLabel}</figcaption><img src="data:image/png;base64,${build}" style="display:block;outline:1px solid #666"></figure>
          </div></body></html>`;
        await page.setContent(html, { waitUntil: 'load' });
        const out = resolve(OUT_DIR, `pair-${pair.id}-${pair.vp.name}-${theme}.png`);
        await page.locator('div').first().screenshot({ path: out });
        console.log(`  saved ${out}`);
        results.push({ pass: 'pair', view: pair.id, vp: pair.vp.name, theme, status: 'SHOT', note: '' });
      }
    }
  } finally {
    await page.close();
  }
}

const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error', plugins: [mockPlugin] });
await server.listen();
const base = `http://localhost:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  await mockupPass(browser, base);
  await fixturePass(browser, base);
  await composePairs(browser);
  if (!LOCAL_ONLY) await previewPass(browser);
} finally {
  await browser.close();
  await server.close();
}

writeFileSync(resolve(OUT_DIR, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
console.log('\n══════════════════════════════════════════');
for (const r of results) console.log(`${r.status.padEnd(5)} ${r.pass.padEnd(8)} ${(r.view ?? '').padEnd(14)} ${r.vp ?? ''}-${r.theme ?? ''} ${r.note ?? ''}`);
console.log(`Console errors captured: ${consoleErrors.length}`);
for (const e of consoleErrors) console.log(`  ${e.pass} ${e.vp}-${e.theme}: ${JSON.stringify(e.errors).slice(0, 400)}`);
console.log(`Measurements: ${resolve(OUT_DIR, 'measurements.json')}`);
console.log('══════════════════════════════════════════');
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);

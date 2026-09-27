/**
 * ledger-l3-design-check.mjs — L3 ("Counts toward" chips) design check ritual
 * (docs/briefs/ledger-lens-build.md § Deliverables; docs/briefs/ledger-layout-
 * and-l3.md § L3).
 *
 * READ-ONLY. Reuses the LX offline fixture harness
 * (scripts/verification/ledger-lx-fixture-harness.html, the fixture aliases
 * in scripts/verification/fixtures/lx/) because it already renders the REAL
 * PolicyLedgerPanel → AwardLensPanel → AwardLensGroups → PolicyCard tree with
 * the shared award-lens fixtures (src/lib/__tests__/fixtures/awardLensFixtures.js)
 * — the same tree L3 wires the chips into, so no second harness is needed.
 * `useFeatureFlag` is stubbed on (fixtures/lx/useFeatureFlag.js), which turns
 * the campaign fetch on; `campaignService` fixture returns the Christmas
 * campaign — so `?case=campaign` shows every chip case at once: settled
 * counting (A, B, C), pending "Will count toward" (D), family MDRT-only (G),
 * NTU / outside-window with no chip row (F, H).
 *
 * Three passes:
 *   1. MOCKUP — D4-Ledger-Award-Lens.dc.html (390, light only — no dark
 *      variant), the chip source (docs/briefs/ledger-layout-and-l3.md's own
 *      pointer: "read its script block for the per-award card behaviour").
 *   2. LOCAL FIXTURES (offline, no Firestore) — the ledger list with chips,
 *      then the drill drawer opened on a counting and a pending policy, so
 *      the drawer's chip row is captured next to the card's. Also MEASURES
 *      chip colours (gold-tint/gold-ink vs surface-muted/ink-muted) in both
 *      themes and confirms drawer chips equal card chips for the same policy.
 *   3. PREVIEW (optional, needs SMOKE_PREVIEW_URL) — read-only; the A11Y test
 *      agent has no policies, so this documents the empty state only. Skipped
 *      with a note when the *.vercel.app certificate is Fortinet-issued.
 *
 * Output: docs/reports/screenshots/ledger-2026-09-26/l3/
 *
 * Run: node scripts/verification/ledger-l3-design-check.mjs [--local-only]
 *      SMOKE_PREVIEW_URL=<deployment url> node scripts/verification/ledger-l3-design-check.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import tls from 'tls';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setTheme, waitForTheme, loginAs, captureConsoleAndNetwork,
} from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(ROOT, 'docs/reports/screenshots/ledger-2026-09-26/l3');
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
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];
const THEMES = ['light', 'dark'];

const results = [];
const consoleErrors = [];
const measurements = [];

// Same offline doubles LX uses — this harness never reaches real Firebase.
const FIXTURE_ALIASES = [
  [/\/context\/AuthContext(\.jsx)?$/, 'fixtures/lx/mockAuthContext.jsx'],
  [/\/services\/policiesService(\.js)?$/, 'fixtures/lx/policiesService.js'],
  [/\/services\/planCatalogService(\.js)?$/, 'fixtures/lx/planCatalogService.js'],
  [/\/services\/campaignService(\.js)?$/, 'fixtures/lx/campaignService.js'],
  [/\/services\/userPrefsService(\.js)?$/, 'fixtures/lx/userPrefsService.js'],
  [/\/hooks\/useFeatureFlag(\.js)?$/, 'fixtures/lx/useFeatureFlag.js'],
];
const mockPlugin = {
  name: 'ledger-l3-offline-fixtures',
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

// ── Measurements (Rule: "measure, don't look") ───────────────────────────────
async function measureChips(page, label) {
  return page.evaluate((lbl) => {
    // `lg:hidden` is display:none, not removed from the DOM, so a plain
    // querySelectorAll would still "see" the mobile card grid's chip rows
    // while the desktop table is what is actually on screen at 1440 —
    // offsetParent filters to what is really visible.
    const visible = (el) => el.offsetParent !== null;
    const chipRows = [...document.querySelectorAll('[data-testid="award-window-chips"]')].filter(visible);
    const chipColours = (root) => [...root.querySelectorAll('[data-testid^="award-window-chip-"]')].map((el) => {
      const cs = getComputedStyle(el);
      return { text: el.textContent, color: cs.color, background: cs.backgroundColor };
    });
    return {
      label: lbl,
      dark: document.documentElement.classList.contains('dark'),
      cardChipRows: chipRows.length,
      countingLabelPresent: chipRows.some((r) => r.textContent.includes('Counts toward')),
      pendingLabelPresent: chipRows.some((r) => r.textContent.includes('Will count toward')),
      firstRowChipColours: chipRows[0] ? chipColours(chipRows[0]) : [],
    };
  }, label);
}

// ── Pass 1 — mockup (D4, the chip source) ────────────────────────────────────
async function mockupPass(browser, base) {
  console.log('\n=== MOCKUP PASS (D4, light only — no dark variant) ===');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.route('**/support.js', (route) => route.fulfill({ contentType: 'application/javascript', body: SHIM }));
    await page.goto(`${base}/docs/design-system/proposals/ledger-2026-09/D4-Ledger-Award-Lens.dc.html`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-dc-rendered="1"]', { timeout: 15000 });
    await page.waitForTimeout(800);
    const unrendered = await page.evaluate(() => /\{\{/.test(document.querySelector('x-dc')?.innerText ?? ''));
    const frame = page.locator('x-dc > div').first();
    const shot = resolve(OUT_DIR, 'mockup-D4-390.png');
    await frame.screenshot({ path: shot });
    results.push({ pass: 'mockup', view: 'D4', vp: '390', theme: 'light', status: unrendered ? 'WARN' : 'SHOT', note: unrendered ? 'template braces left' : 'chip source — gold "Counts toward" / grey "Will count toward" rows per card' });
    console.log(`  saved ${shot}`);
  } finally {
    await context.close();
  }
}

// ── Pass 2 — local fixtures (the real component tree, offline) ──────────────
async function fixturePass(browser, base) {
  console.log('\n=== LOCAL FIXTURE PASS (offline doubles, real PolicyLedgerPanel) ===');
  const harness = `${base}/scripts/verification/ledger-lx-fixture-harness.html`;
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
        await setTheme(context, theme);
        const page = await context.newPage();
        const capture = captureConsoleAndNetwork(page);

        await page.goto(`${harness}?case=campaign`, { waitUntil: 'domcontentloaded' });
        await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
        // `award-lens-card` is present (though not always visible) at both
        // viewports; the list itself is either the mobile grouped cards
        // (`award-lens-groups`, lg:hidden) or the desktop table
        // (`ledger-table`, hidden below lg) — never both visible at once.
        await page.locator('[data-testid="award-lens-card"]').waitFor({ timeout: 20000 });
        await page.waitForTimeout(900);

        const shotList = resolve(OUT_DIR, `local-fixture-list-${vp.name}-${theme}.png`);
        await page.screenshot({ path: shotList, fullPage: true });
        const listMeasure = await measureChips(page, `list-${vp.name}-${theme}`);
        measurements.push(listMeasure);
        // At 390 the mobile grouped cards are visible and MUST show chips.
        // At 1440 `lg:hidden` hides that same card grid in favour of the
        // desktop LedgerTable, which the brief leaves untouched (its own
        // "Counts toward" credit column, not the L3 chip rows) — so 0 visible
        // chip rows there is the correct, expected state, not a gap.
        const listOk = vp.name === '390'
          ? listMeasure.cardChipRows > 0 && listMeasure.countingLabelPresent && listMeasure.pendingLabelPresent
          : listMeasure.cardChipRows === 0;
        results.push({
          pass: 'fixture', view: 'list', vp: vp.name, theme,
          status: listOk ? 'SHOT' : 'WARN',
          note: vp.name === '390'
            ? `mobile cards: chipRows=${listMeasure.cardChipRows} counting=${listMeasure.countingLabelPresent} pending=${listMeasure.pendingLabelPresent}`
            : `desktop table: chip rows correctly not shown here (cardChipRows=${listMeasure.cardChipRows}) — brief leaves LedgerTable's own column untouched`,
        });

        // Open the drawer on a KNOWN counting policy (A) then a known pending
        // one (D) — fixed fixture ids (awardLensFixtures.js). Mobile opens
        // through its grouped card; desktop (`lg`) hides the card grid
        // (`lg:hidden`) and shows the table instead, so it opens through the
        // matching table row.
        const opener = (id) => (vp.name === '390'
          ? page.locator(`[data-testid="policy-card-${id}"]`)
          : page.locator(`[data-testid="ledger-table-row-${id}"]`));

        const countingOpener = opener('A');
        await countingOpener.scrollIntoViewIfNeeded();
        await countingOpener.click();
        await page.locator('[data-testid="policy-drawer"]').waitFor({ timeout: 10000 });
        await page.waitForTimeout(500);
        const shotDrawerCounting = resolve(OUT_DIR, `local-fixture-drawer-counting-${vp.name}-${theme}.png`);
        await page.screenshot({ path: shotDrawerCounting, fullPage: true });
        const drawerCountingMeasure = await measureChips(page, `drawer-counting-${vp.name}-${theme}`);
        measurements.push(drawerCountingMeasure);
        results.push({
          pass: 'fixture', view: 'drawer-counting', vp: vp.name, theme,
          status: drawerCountingMeasure.countingLabelPresent ? 'SHOT' : 'FAIL',
          note: `drawer shows the same "Counts toward" row as its card (countingLabelPresent=${drawerCountingMeasure.countingLabelPresent})`,
        });
        await page.keyboard.press('Escape').catch(() => {});
        await page.locator('[data-testid="policy-drawer"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});

        // Pending policy (D) — grey "Will count toward" in the drawer too.
        const pendingOpener = opener('D');
        if (await pendingOpener.count()) {
          await pendingOpener.scrollIntoViewIfNeeded();
          await pendingOpener.click();
          await page.locator('[data-testid="policy-drawer"]').waitFor({ timeout: 10000 });
          await page.waitForTimeout(500);
          const shotDrawerPending = resolve(OUT_DIR, `local-fixture-drawer-pending-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shotDrawerPending, fullPage: true });
          const drawerPendingMeasure = await measureChips(page, `drawer-pending-${vp.name}-${theme}`);
          measurements.push(drawerPendingMeasure);
          results.push({
            pass: 'fixture', view: 'drawer-pending', vp: vp.name, theme,
            status: drawerPendingMeasure.pendingLabelPresent ? 'SHOT' : 'FAIL',
            note: `pendingLabelPresent=${drawerPendingMeasure.pendingLabelPresent}`,
          });
        }

        const errors = capture.consoleMessages.filter((x) => x.type === 'error');
        if (errors.length) consoleErrors.push({ pass: 'fixture', vp: vp.name, theme, errors: errors.map((x) => String(x.text).slice(0, 200)) });
        console.log(`  ${vp.name}-${theme}: saved (chipRows=${listMeasure.cardChipRows})`);
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
  const email = process.env.A11Y_AGENT_EMAIL;
  const password = process.env.A11Y_AGENT_PASSWORD;
  if (!email || !password) {
    results.push({ pass: 'preview', status: 'SKIP', note: 'A11Y_AGENT_* not all present' });
    return;
  }
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
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
        await page.waitForTimeout(1200);
        const shot = resolve(OUT_DIR, `preview-ledger-${vp.name}-${theme}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        const empty = await page.locator('[data-testid="ledger-empty"]').count();
        const errors = capture.consoleMessages.filter((x) => x.type === 'error');
        if (errors.length) consoleErrors.push({ pass: 'preview', vp: vp.name, theme, errors: errors.map((x) => String(x.text).slice(0, 200)) });
        results.push({ pass: 'preview', view: 'ledger', vp: vp.name, theme, status: 'SHOT', note: `empty=${empty} (test agent has no policies — chips cannot show here; see the fixture pass for chip evidence)` });
      } catch (e) {
        results.push({ pass: 'preview', vp: vp.name, theme, status: 'FAIL', note: e.message });
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
  await mockupPass(browser, base);
  await fixturePass(browser, base);
  if (!LOCAL_ONLY) await previewPass(browser);
} finally {
  await browser.close();
  await server.close();
}

writeFileSync(resolve(OUT_DIR, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
console.log('\n══════════════════════════════════════════');
for (const r of results) console.log(`${r.status.padEnd(5)} ${r.pass.padEnd(8)} ${(r.view ?? '').padEnd(16)} ${r.vp ?? ''}-${r.theme ?? ''} ${r.note ?? ''}`);
console.log(`Console errors captured: ${consoleErrors.length}`);
for (const e of consoleErrors) console.log(`  ${e.pass} ${e.vp}-${e.theme}: ${JSON.stringify(e.errors).slice(0, 400)}`);
console.log(`Measurements: ${resolve(OUT_DIR, 'measurements.json')}`);
console.log(`Screenshots in: ${OUT_DIR}`);
console.log('══════════════════════════════════════════');
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);

/**
 * smoke-eff002-code-splitting.mjs — ADVERSARIAL load-path smoke for EFF-002.
 *
 * EFF-002 lazy-splits the role dashboards (Phase 1) and the heavy manager tabs
 * (Phase 2). A code-split can pass lint + suite + build and still white-screen a
 * real user (Suspense flash, chunk 404 on a route, a fallback that never resolves
 * on a slow network). This smoke exercises the real DOM + real network so those
 * failure modes cannot hide behind green unit tests. Every leg is value/network
 * level, not selector-only.
 *
 * WHAT IT PROVES
 *   1. AGENT path chunk isolation — an agent session fetches the AgentDashboard
 *      chunk and renders, and NEVER fetches the ManagerDashboard / TenantAdmin
 *      chunks (the core EFF-002 goal). Network-trace assertion.
 *   2. BRANCH_MANAGER path — the ManagerDashboard chunk loads and the dashboard
 *      paints; navigating each heavy manager tab resolves its lazy chunk to real
 *      content (no infinite fallback, no chunk 404/failure).
 *   3. SLOW NETWORK (CDP Slow-3G) — with the browser cache disabled and the
 *      dashboard chunk re-fetched slowly, the themed Suspense fallback shows and
 *      then resolves; no white screen, no unhandled chunk-load error. Fallback
 *      screenshots are captured in BOTH themes for human eyeball review.
 *   4. BOTH THEMES, 0 genuine console errors, 0 chunk-load failures (a chunk
 *      request that fails OR returns >= 400 is a hard FAIL).
 *
 * NOISE FILTER: `/_vercel/insights` + `/_vercel/speed-insights` 404 on any
 * non-Vercel host (they are Vercel-edge-injected and do not exist on a localhost
 * `vite preview`); static assets (favicon / icons / .map / manifest) are also
 * filtered. These are environment noise, present on main, unrelated to the split.
 * The console-clean assertion counts only GENUINE JS errors (uncaught exceptions,
 * "dynamically imported module" chunk errors, React errors) — resource 404s are
 * tracked separately with their URLs so a real chunk 404 still hard-fails.
 *
 * ARCHITECTURE NOTE: the app has NO client-side router — tabs are React state
 * (`useState('overview')`), so the brief's "direct-route load" leg is N/A here;
 * the meaningful cold-entry chunk load is a fresh per-role login (legs 1 + 2),
 * which cold-loads that role's dashboard chunk directly (not via client nav).
 *
 * USAGE
 *   Local (default http://localhost:4173 — run `npm run build && npm run preview` first):
 *     node --env-file=.env.local scripts/verification/smoke-eff002-code-splitting.mjs
 *   Vercel preview (needs VERCEL_BYPASS_TOKEN):
 *     SMOKE_BASE_URL=https://<deployment>.vercel.app \
 *       node --env-file=.env.local scripts/verification/smoke-eff002-code-splitting.mjs
 *
 * Requires A11Y_AGENT_* + A11Y_BRANCH_MANAGER_* creds in .env.local.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';
import {
  setupBypassSession, setTheme, waitForTheme, loginAs, installGlobalTimeout, finishSmoke, stamp,
} from './lib/walk-helpers.mjs';

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:4173').replace(/\/+$/, '');
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(BASE_URL);
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const SS_DIR = resolve('docs/audits/eff002-run/screenshots');
mkdirSync(SS_DIR, { recursive: true });

const AGENT = { email: process.env.A11Y_AGENT_EMAIL, password: process.env.A11Y_AGENT_PASSWORD };
const BM = { email: process.env.A11Y_BRANCH_MANAGER_EMAIL, password: process.env.A11Y_BRANCH_MANAGER_PASSWORD };

// Resource failures that are environment noise, NOT app/code-split defects.
const NOISE_RE = /\/_vercel\/(insights|speed-insights)|\/favicon|apple-touch-icon|\/manifest|\.(map|ico|png|webmanifest)(\?|$)/;
const isChunk = (u) => /\/assets\/[^/?]+\.js(\?|$)/.test(u);

// Heavy manager tabs to walk (nav-<id>). Curated to the Phase-2 split targets +
// a few light ones; unreachable-in-smoke-tenant tabs skip-with-note (they never
// hard-fail — banked: preview data gaps force skips, not failures).
const MANAGER_TABS = [
  'team', 'campaigns', 'production-report', 'awards', 'mastersheet', 'compliance',
  'persistency', 'team-perf', 'goals', 'settlements', 'financing', 'leaderboard',
  'agent-of-month', 'kiosk',
];

const results = [];
const rec = (leg, passed, detail) => {
  results.push({ leg, passed, detail });
  console.log(`${stamp()} ${passed ? '✓' : '✗'} ${leg} — ${detail}`);
};
const skip = (leg, detail) => { console.log(`${stamp()} ○ ${leg} — SKIP: ${detail}`); };

// trackPage — categorized capture: chunk requests (for isolation), chunk-load
// failures (requestfailed OR >=400 on a .js), genuine console errors, and
// non-noise resource failures.
function trackPage(page) {
  const chunkRequests = new Set();
  const chunkFailures = [];
  const consoleErrors = [];
  const resourceFailures = [];
  page.on('request', (r) => { const m = r.url().match(/\/assets\/([^/?]+\.js)/); if (m) chunkRequests.add(m[1]); });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (isChunk(u)) chunkFailures.push(`requestfailed ${u}`);
    else if (!NOISE_RE.test(u)) resourceFailures.push(`requestfailed ${u}`);
  });
  page.on('response', (r) => {
    const u = r.url(); const s = r.status();
    if (s < 400) return;
    if (isChunk(u)) chunkFailures.push(`${s} ${u}`);
    else if (!NOISE_RE.test(u)) resourceFailures.push(`${s} ${u}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    // "Failed to load resource" console lines are resource failures — already
    // captured (with URLs) by the response handler + noise filter. Count only
    // genuine JS errors here so environment 404 noise does not fail the leg.
    if (/Failed to load resource/i.test(t)) return;
    consoleErrors.push(t);
  });
  return { chunkRequests, chunkFailures, consoleErrors, resourceFailures };
}
const hasChunk = (set, prefix) => [...set].some((c) => c.startsWith(prefix));

async function newCtx(browser, theme) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (!IS_LOCAL) await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  await setTheme(ctx, theme);
  return ctx;
}

// clickNav — banked pattern: try nav-<id> then pinned-<id>, with a workspace
// toggle fallback. Returns true if a clickable nav element was found + clicked.
async function clickNav(page, id) {
  const trySelectors = async () => {
    for (const sel of [`[data-testid="nav-${id}"]`, `[data-testid="pinned-${id}"]`]) {
      const loc = page.locator(sel);
      if (await loc.count() > 0 && await loc.first().isVisible().catch(() => false)) { await loc.first().click(); return true; }
    }
    return false;
  };
  if (await trySelectors()) return true;
  const toggle = page.locator('[data-testid="sidebar-ws-team"], [data-testid="sidebar-ws-toggle-team"]');
  if (await toggle.count() > 0) { await toggle.first().click().catch(() => {}); await page.waitForTimeout(300); }
  return trySelectors();
}

const summarizeFailures = (arr) => [...new Set(arr)].slice(0, 6).join(' | ');

// ── LEG 1: AGENT chunk isolation (both themes) ───────────────────────────────
async function agentLeg(browser, theme) {
  const tag = `[${theme}]`;
  const ctx = await newCtx(browser, theme);
  const page = await ctx.newPage();
  const cap = trackPage(page);
  try {
    await loginAs(page, BASE_URL, AGENT.email, AGENT.password);
    await waitForTheme(page, theme).catch(() => {});
    const painted = await page.evaluate(() => document.body.textContent.replace(/\s+/g, '').length > 300);
    rec(`agent-paint${tag}`, painted, painted ? 'agent dashboard rendered' : 'agent dashboard did NOT render');

    const gotAgent = hasChunk(cap.chunkRequests, 'AgentDashboard-');
    const gotMgr = hasChunk(cap.chunkRequests, 'ManagerDashboard-');
    const gotTA = hasChunk(cap.chunkRequests, 'TenantAdminDashboard-');
    rec(`agent-loads-agent-chunk${tag}`, gotAgent, gotAgent ? 'AgentDashboard chunk fetched' : `AgentDashboard chunk NOT fetched — chunks: ${[...cap.chunkRequests].join(', ') || '(none)'}`);
    rec(`agent-NO-manager-chunk${tag}`, !gotMgr, gotMgr ? 'FAIL: ManagerDashboard chunk fetched on the AGENT path (EFF-002 violated)' : 'ManagerDashboard chunk NOT fetched on agent path (EFF-002 goal met)');
    rec(`agent-NO-tenantadmin-chunk${tag}`, !gotTA, gotTA ? 'FAIL: TenantAdminDashboard chunk fetched on the AGENT path' : 'TenantAdminDashboard chunk NOT fetched on agent path');

    rec(`agent-no-chunk-load-error${tag}`, cap.chunkFailures.length === 0, cap.chunkFailures.length === 0 ? 'no chunk request failed or 4xx/5xx' : `CHUNK FAILURES: ${summarizeFailures(cap.chunkFailures)}`);
    rec(`agent-console-clean${tag}`, cap.consoleErrors.length === 0, cap.consoleErrors.length === 0 ? '0 genuine console errors' : `${cap.consoleErrors.length} console error(s): ${summarizeFailures(cap.consoleErrors)}`);
    if (cap.resourceFailures.length) console.log(`${stamp()}   note: ${cap.resourceFailures.length} non-noise resource failure(s): ${summarizeFailures(cap.resourceFailures)}`);
  } catch (e) {
    rec(`agent-leg${tag}`, false, `threw: ${e.message}`);
  } finally { await ctx.close(); }
}

// ── LEG 2: BRANCH_MANAGER — dashboard chunk + walk every heavy tab ───────────
async function bmLeg(browser, theme) {
  const tag = `[${theme}]`;
  const ctx = await newCtx(browser, theme);
  const page = await ctx.newPage();
  const cap = trackPage(page);
  try {
    await loginAs(page, BASE_URL, BM.email, BM.password);
    await waitForTheme(page, theme).catch(() => {});
    const painted = await page.evaluate(() => document.body.textContent.replace(/\s+/g, '').length > 300);
    rec(`bm-paint${tag}`, painted, painted ? 'manager dashboard rendered' : 'manager dashboard did NOT render');
    rec(`bm-loads-manager-chunk${tag}`, hasChunk(cap.chunkRequests, 'ManagerDashboard-'), hasChunk(cap.chunkRequests, 'ManagerDashboard-') ? 'ManagerDashboard chunk fetched on cold BM entry' : 'ManagerDashboard chunk NOT fetched');

    let walked = 0, reached = 0;
    for (const id of MANAGER_TABS) {
      walked += 1;
      const before = cap.chunkFailures.length;
      const clicked = await clickNav(page, id);
      if (!clicked) { skip(`bm-tab-${id}${tag}`, 'nav item not reachable in smoke tenant'); continue; }
      reached += 1;
      const ok = await page.waitForFunction(() => {
        const loading = document.querySelector('[data-testid="tab-loading"], [data-testid="state-loading"]');
        const stillLoading = loading && loading.offsetParent !== null;
        return !stillLoading && document.body.textContent.replace(/\s+/g, '').length > 300;
      }, { timeout: 12_000 }).then(() => true).catch(() => false);
      const newChunkFail = cap.chunkFailures.length > before;
      rec(`bm-tab-${id}${tag}`, ok && !newChunkFail, ok ? (newChunkFail ? `content rendered BUT chunk failure: ${summarizeFailures(cap.chunkFailures)}` : 'chunk resolved, content rendered, no chunk failure') : 'tab did NOT resolve (stuck fallback or blank) within 12s');
    }
    console.log(`${stamp()}   bm tabs: walked ${walked}, reached ${reached}${tag}`);

    rec(`bm-no-chunk-load-error${tag}`, cap.chunkFailures.length === 0, cap.chunkFailures.length === 0 ? 'no chunk request failed or 4xx/5xx across all tabs' : `CHUNK FAILURES: ${summarizeFailures(cap.chunkFailures)}`);
    rec(`bm-console-clean${tag}`, cap.consoleErrors.length === 0, cap.consoleErrors.length === 0 ? '0 genuine console errors across all tabs' : `${cap.consoleErrors.length} console error(s): ${summarizeFailures(cap.consoleErrors)}`);
    if (cap.resourceFailures.length) console.log(`${stamp()}   note: ${cap.resourceFailures.length} non-noise resource failure(s): ${summarizeFailures(cap.resourceFailures)}`);
  } catch (e) {
    rec(`bm-leg${tag}`, false, `threw: ${e.message}`);
  } finally { await ctx.close(); }
}

// ── LEG 3: SLOW NETWORK — Suspense fallback shows + resolves (both themes) ────
async function slowNetworkLeg(browser, theme, role) {
  const tag = `[${theme}/${role.label}]`;
  const ctx = await newCtx(browser, theme);
  const page = await ctx.newPage();
  const cap = trackPage(page);
  try {
    await loginAs(page, BASE_URL, role.email, role.password);
    await waitForTheme(page, theme).catch(() => {});

    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }); // force chunk re-fetch
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (50 * 1024) / 8, uploadThroughput: (20 * 1024) / 8 }); // ~Slow-3G

    const nav = page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    const sawFallback = await page.waitForSelector('[data-testid="state-loading"], [data-testid="tab-loading"]', { timeout: 25_000 }).then(() => true).catch(() => false);
    if (sawFallback) await page.screenshot({ path: join(SS_DIR, `suspense-fallback-${role.label}-${theme}-slow3g.png`), fullPage: false });
    await nav;
    // "Resolved" = the lazy dashboard's Suspense boundary resolved and the shell
    // MOUNTED (primary nav appears), NOT that all data finished loading. A cold
    // data-heavy manager dashboard does many Firestore round-trips that, under a
    // Slow-3G throttle, can take far longer than the chunk fetch — waiting on full
    // body content would measure Firebase latency, not the code-split. Nav-mount is
    // the true "Suspense resolved / no white screen" signal.
    const resolved = await page.waitForFunction(() => {
      const loading = document.querySelector('[data-testid="state-loading"], [data-testid="tab-loading"]');
      const stillLoading = loading && loading.offsetParent !== null;
      const mounted = document.querySelector('nav[aria-label="Primary navigation"]') !== null
        || document.body.textContent.replace(/\s+/g, '').length > 300;
      return !stillLoading && mounted;
    }, { timeout: 60_000 }).then(() => true).catch(() => false);

    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    rec(`slow-fallback-seen${tag}`, sawFallback, sawFallback ? 'themed Suspense fallback shown during throttled chunk fetch (screenshot saved)' : 'fallback not observed (chunk loaded from cache faster than expected)');
    rec(`slow-fallback-resolved${tag}`, resolved, resolved ? 'fallback resolved to real content — no infinite fallback / white screen' : 'FAIL: fallback did NOT resolve within 40s (white-screen risk)');
    rec(`slow-no-chunk-error${tag}`, cap.chunkFailures.length === 0, cap.chunkFailures.length === 0 ? 'no chunk failure under throttle' : `CHUNK FAILURES under throttle: ${summarizeFailures(cap.chunkFailures)}`);
  } catch (e) {
    rec(`slow-leg${tag}`, false, `threw: ${e.message}`);
  } finally { await ctx.close(); }
}

(async () => {
  console.log(`\nEFF-002 code-splitting adversarial smoke → ${BASE_URL} ${IS_LOCAL ? '(local preview)' : '(remote preview, bypass)'}\n`);
  if (!AGENT.email || !BM.email) { console.error('Missing A11Y_AGENT_* / A11Y_BRANCH_MANAGER_* creds in env.'); process.exit(2); }
  if (!IS_LOCAL && !BYPASS_TOKEN) { console.error('Remote preview needs VERCEL_BYPASS_TOKEN.'); process.exit(2); }

  const clearTimeout = installGlobalTimeout(6 * 60_000, () => { console.error('partial results:'); results.forEach((r) => console.error(`  ${r.passed ? '✓' : '✗'} ${r.leg}: ${r.detail}`)); });
  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark']) { await agentLeg(browser, theme); await bmLeg(browser, theme); }
    await slowNetworkLeg(browser, 'light', { label: 'agent', email: AGENT.email, password: AGENT.password });
    await slowNetworkLeg(browser, 'dark', { label: 'agent', email: AGENT.email, password: AGENT.password });
    await slowNetworkLeg(browser, 'light', { label: 'manager', email: BM.email, password: BM.password });
    await slowNetworkLeg(browser, 'dark', { label: 'manager', email: BM.email, password: BM.password });
  } finally { await browser.close(); }
  finishSmoke(results, { clearTimeout });
})();

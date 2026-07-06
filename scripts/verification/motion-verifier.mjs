// scripts/verification/motion-verifier.mjs
// Stage 1 of the motion jank verifier: log in per role against a preview,
// instrument screen-enter, screencast a cold + warm tab switch, write frames +
// meta.json, then invoke the Python analyzer. READ-ONLY: navigation + capture,
// no Firestore writes. See docs/design/motion-jank-verifier.md.
//
// Env is loaded via Node's native `--env-file` (see usage) — no dotenv dependency.
// Credentials are read by name only, never echoed.
//
// Usage:
//   node --env-file=.env.local scripts/verification/motion-verifier.mjs --role all --url <previewUrl>
//   node --env-file=.env.local scripts/verification/motion-verifier.mjs --role agent --reduced-motion --url <previewUrl>
//   node --env-file=.env.local scripts/verification/motion-verifier.mjs --role agent --target agent-tab-game-plan --case game-plan --url <url>
//   node --env-file=.env.local scripts/verification/motion-verifier.mjs --role all --sweep --url <url>   # EVERY tab, per role
//   node scripts/verification/motion-verifier.mjs --analyze-only <runDir>   # re-analyze existing frames, no browser
// Flags: --sweep (measure every nav tab for the role, cold-only), --target/--default <data-testid>
//        (override the nav for a single role), --case <label>, --settle-cap <ms> (default 2500),
//        --reduced-motion, --url/--analyze-only.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  setupBypassSession, loginAs, resolveSmokeBaseUrl, installGlobalTimeout, safeLog,
} from './lib/walk-helpers.mjs';
import { installMotionInstrument, resetMotionMarks } from './lib/motion-instrument.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Nav is driven by stable data-testids from the real Sidebar (navConfig.js), NOT
// label text — the agent's landing item is labelled "Dashboard" (not "Home"), and
// producing-manager labels differ from the dashboards' legacy inline arrays.
// Agent items carry explicit `agent-tab-<id>` testids; manager/tenant-admin items
// fall through to `nav-<id>`. targetLabel is retained for logging/meta only.
const CASES = {
  agent:          { envPrefix: 'A11Y_AGENT',          defaultTestId: 'agent-tab-dashboard', targetTestId: 'agent-tab-history', targetLabel: 'History',     case: 'history' },
  branch_manager: { envPrefix: 'A11Y_BRANCH_MANAGER', defaultTestId: 'nav-overview',        targetTestId: 'nav-team-wars',     targetLabel: 'Weekly WARs', case: 'team-wars' },
  unit_manager:   { envPrefix: 'A11Y_UNIT_MANAGER',   defaultTestId: 'nav-overview',        targetTestId: 'nav-team',          targetLabel: 'Team',        case: 'team' },
  sales_manager:  { envPrefix: 'A11Y_SALES_MANAGER',  defaultTestId: 'nav-overview',        targetTestId: 'nav-team',          targetLabel: 'Team',        case: 'team' },
  tenant_admin:   { envPrefix: 'A11Y_TENANT_ADMIN',   defaultTestId: 'nav-dashboard',       targetTestId: 'nav-users',         targetLabel: 'All Users',   case: 'all-users' },
  platform_admin: { envPrefix: 'A11Y_PLATFORM_ADMIN', defaultTestId: 'nav-dashboard',       targetTestId: 'nav-users',         targetLabel: 'All Users',   case: 'users' },
};
const VIEWPORT = { width: 1440, height: 900 };
function arg(name, def) { const i = process.argv.indexOf(name); return i > -1 ? (process.argv[i + 1] ?? true) : def; }
const SETTLE_CAP_MS = Number(arg('--settle-cap', 2500)) || 2500;   // 320ms anim + cold fetch; --settle-cap to extend

function safeStamp() { return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); }
const wantRole = arg('--role', 'all');
const reducedMotion = process.argv.includes('--reduced-motion');

async function clickNav(page, testid) {
  // Fire the nav button's handler directly (no scroll) so the viewport stays put —
  // the screen-enter animation plays in the in-view content area, which is what the
  // screencast captures. Scrolling a below-fold item into view (producing-manager's
  // 34-item sidebar) pushes the content out of frame and the capture goes blank.
  // el.click() triggers React's onClick -> setActiveTab exactly like a real click.
  const ok = await page.evaluate((t) => {
    const el = document.querySelector(`[data-testid="${t}"]`); // first match; pinned/section dupes route to the same tab
    if (!el) return false;
    el.click();
    return true;
  }, testid);
  if (!ok) throw new Error(`nav testid not found: ${testid}`);
}

async function captureSwitch(page, client, targetTestId) {
  const frames = [];
  let first = null;
  const onFrame = async (params) => {
    const ts = params.metadata?.timestamp ?? (Date.now() / 1000);
    if (first === null) first = ts;
    frames.push({ tMs: (ts - first) * 1000, data: params.data });
    await client.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {});
  };
  client.on('Page.screencastFrame', onFrame);
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1, maxWidth: VIEWPORT.width, maxHeight: VIEWPORT.height });
  await clickNav(page, targetTestId);
  await page.waitForTimeout(SETTLE_CAP_MS);
  await client.send('Page.stopScreencast');
  client.off('Page.screencastFrame', onFrame);
  const marks = await page.evaluate(() => window.__motionMarks);
  return { frames, marks };
}

function writeCase(runDir, role, condition, cfg, cap, url, reduced) {
  const dir = path.join(runDir, role, condition);
  mkdirSync(dir, { recursive: true });
  const meta = {
    role, case: cfg.case, condition, targetLabel: cfg.targetLabel, reducedMotion: reduced,
    declaredDurationMs: cap.marks?.declaredDurationMs ?? null,
    viewport: VIEWPORT, beaconBox: { x: 0, y: 0, width: VIEWPORT.width, height: 6 },
    contentBox: cap.marks?.contentBox ?? { x: 0, y: 6, width: VIEWPORT.width, height: VIEWPORT.height - 6 },
    frames: [], animation: cap.marks?.animation ?? {}, longTasks: cap.marks?.longTasks ?? [],
    mutations: cap.marks?.mutations ?? [], imgLoads: cap.marks?.imgLoads ?? [],
    url, account: cfg.envPrefix,
  };
  cap.frames.forEach((f, i) => {
    const file = `frame_${String(i + 1).padStart(5, '0')}.jpg`;
    writeFileSync(path.join(dir, file), Buffer.from(f.data, 'base64'));
    meta.frames.push({ index: i + 1, file, tMs: Math.round(f.tMs * 10) / 10 });
  });
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta.frames.length;
}

async function runRole(browser, role, baseUrl, token, runDir) {
  const base = CASES[role];
  // --target/--default/--case override the case table (use with a single --role).
  const cfg = { ...base, targetTestId: arg('--target', base.targetTestId), defaultTestId: arg('--default', base.defaultTestId), case: arg('--case', base.case) };
  const email = process.env[`${cfg.envPrefix}_EMAIL`];
  const password = process.env[`${cfg.envPrefix}_PASSWORD`];
  if (!email || !password) { safeLog(`SKIP ${role}: ${cfg.envPrefix}_EMAIL/PASSWORD not set`); return; }
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  if (token) await setupBypassSession(context, baseUrl, token);
  const page = await context.newPage();
  await page.addInitScript(installMotionInstrument);
  await loginAs(page, baseUrl, email, password);
  await page.waitForTimeout(1500); // let the default tab settle before instrumenting the switch
  const client = await context.newCDPSession(page);
  await page.evaluate(resetMotionMarks); // switch-scoped mutation/img log for cold
  // COLD: default tab -> target (data likely unfetched)
  const cold = await captureSwitch(page, client, cfg.targetTestId);
  const nCold = writeCase(runDir, role, 'cold', cfg, cold, baseUrl, reducedMotion);
  // WARM: back to default, reset, target again (data cached)
  await clickNav(page, cfg.defaultTestId);
  await page.waitForTimeout(800);
  await page.evaluate(resetMotionMarks);
  const warm = await captureSwitch(page, client, cfg.targetTestId);
  const nWarm = writeCase(runDir, role, 'warm', cfg, warm, baseUrl, reducedMotion);
  safeLog(`${role}: cold ${nCold} frames, warm ${nWarm} frames`);
  await context.close();
}

// ── Sweep mode: measure EVERY tab for a role (cold-only) ─────────────────────
const NAV_PREFIX = /^(agent-tab-|mp-tab-|nav-|pinned-)/;
const ACTION_SUFFIXES = new Set(['daily-log', 'wizard', 'meetings', 'kiosk']); // open a modal/wizard/full-screen takeover, not an in-place tab switch — never click during a sweep

function tabIdFromTestId(t) { return t.replace(NAV_PREFIX, ''); }

async function enumerateTabs(page) {
  const raw = await page.$$eval('.sidebar-link[data-testid]', (els) => els.map((e) => ({
    testid: e.getAttribute('data-testid'),
    label: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
    disabled: e.className.includes('sidebar-link-disabled') || e.getAttribute('aria-disabled') === 'true' || e.disabled === true,
  })));
  const seen = new Set(), out = [];
  for (const it of raw) {
    if (!it.testid || !NAV_PREFIX.test(it.testid)) continue;
    const id = tabIdFromTestId(it.testid);
    if (it.disabled || ACTION_SUFFIXES.has(id) || seen.has(id)) continue; // dedupe pinned+section duplicates by tab id
    seen.add(id);
    out.push({ testid: it.testid, id, label: it.label });
  }
  return out;
}

// Sweep measures every tab in ISOLATION: reload to the default view before each tab
// so the full sidebar is present and there's no cross-tab fetch contention or takeover
// residue. Some tabs (e.g. producing-manager "Weekly Report") are full-screen takeovers
// that remove the sidebar; isolation recovers from them, and a takeover tab surfaces as
// ERROR (no screen-enter) which is correct. Each tab is thus a clean cold measurement.
async function reloadToDefault(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function sweepRole(browser, role, baseUrl, token, runDir) {
  const base = CASES[role];
  const email = process.env[`${base.envPrefix}_EMAIL`];
  const password = process.env[`${base.envPrefix}_PASSWORD`];
  if (!email || !password) { safeLog(`SKIP ${role}: ${base.envPrefix}_EMAIL/PASSWORD not set`); return; }
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  if (token) await setupBypassSession(context, baseUrl, token);
  const page = await context.newPage();
  await page.addInitScript(installMotionInstrument);
  await loginAs(page, baseUrl, email, password);
  await page.waitForTimeout(1500);
  const tabs = await enumerateTabs(page);
  safeLog(`${role}: sweeping ${tabs.length} tabs — ${tabs.map((t) => t.id).join(', ')}`);
  const client = await context.newCDPSession(page);
  for (const tab of tabs) {
    try {
      await reloadToDefault(page, baseUrl); // fresh default view + full sidebar, isolated from the prior tab
      if (await page.locator(`[data-testid="${tab.testid}"]`).count() === 0) { safeLog(`  ${role}/${tab.id}: not present after reload — skip`); continue; }
      await page.evaluate(resetMotionMarks);
      const cap = await captureSwitch(page, client, tab.testid);
      const n = writeCase(runDir, role, tab.id, { ...base, case: tab.id, targetLabel: tab.label }, cap, baseUrl, reducedMotion);
      safeLog(`  ${role}/${tab.id}: ${n} frames`);
    } catch (e) {
      safeLog(`  ${role}/${tab.id}: SKIP (${String(e.message || e).slice(0, 50)})`);
    }
  }
  await context.close();
}

async function main() {
  const sweep = process.argv.includes('--sweep');
  const clearGlobal = installGlobalTimeout(sweep ? 900_000 : 180_000, () => safeLog('TIMEOUT — partial capture on disk'));
  const analyzeOnly = arg('--analyze-only', null);
  const runDir = analyzeOnly || path.join(HERE, 'out', 'motion', safeStamp());
  if (!analyzeOnly) {
    const baseUrl = arg('--url', null) || resolveSmokeBaseUrl({ defaultHost: 'portal.agencytrack.app' });
    const token = process.env.VERCEL_BYPASS_TOKEN;
    const roles = (wantRole === 'all' ? Object.keys(CASES) : [wantRole]).filter((r) => {
      if (!CASES[r]) { safeLog(`SKIP unknown role: ${r}`); return false; }
      return true;
    });
    mkdirSync(runDir, { recursive: true });
    safeLog(`motion-verifier: ${roles.join(', ')} @ ${baseUrl}${reducedMotion ? ' [reduced-motion]' : ''}${sweep ? ' [sweep]' : ''}`);
    const browser = await chromium.launch();
    try { for (const role of roles) await (sweep ? sweepRole : runRole)(browser, role, baseUrl, token, runDir); }
    finally { await browser.close(); }
  }
  safeLog(`analyzing ${runDir}`);
  const py = spawnSync('python', [path.join(HERE, 'lib', 'motion_analyze.py'), runDir], { stdio: 'inherit' });
  clearGlobal();
  process.exit(py.status ?? 0);
}
main().catch((e) => { safeLog('FATAL ' + (e?.message || e)); process.exit(2); });

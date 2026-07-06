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
//   node scripts/verification/motion-verifier.mjs --analyze-only <runDir>   # re-analyze existing frames, no browser
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
  tenant_admin:   { envPrefix: 'A11Y_TENANT_ADMIN',   defaultTestId: 'nav-dashboard',       targetTestId: 'nav-users',         targetLabel: 'All Users',   case: 'all-users' },
};
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_CAP_MS = 2500;   // covers the 320ms animation + a cold Firestore fetch

function arg(name, def) { const i = process.argv.indexOf(name); return i > -1 ? (process.argv[i + 1] ?? true) : def; }
function safeStamp() { return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); }
const wantRole = arg('--role', 'all');
const reducedMotion = process.argv.includes('--reduced-motion');

async function clickNav(page, testid) {
  // Sidebar renders each item as <button data-testid="agent-tab-<id>" | "nav-<id>">.
  // .first() guards the pinned-zone duplicate (pinned items render twice).
  await page.locator(`[data-testid="${testid}"]`).first().click({ timeout: 15_000 });
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
  const cfg = CASES[role];
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

async function main() {
  const clearGlobal = installGlobalTimeout(180_000, () => safeLog('TIMEOUT — partial capture on disk'));
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
    safeLog(`motion-verifier: ${roles.join(', ')} @ ${baseUrl}${reducedMotion ? ' [reduced-motion]' : ''}`);
    const browser = await chromium.launch();
    try { for (const role of roles) await runRole(browser, role, baseUrl, token, runDir); }
    finally { await browser.close(); }
  }
  safeLog(`analyzing ${runDir}`);
  const py = spawnSync('python', [path.join(HERE, 'lib', 'motion_analyze.py'), runDir], { stdio: 'inherit' });
  clearGlobal();
  process.exit(py.status ?? 0);
}
main().catch((e) => { safeLog('FATAL ' + (e?.message || e)); process.exit(2); });

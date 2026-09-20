/**
 * c2-screenshots.mjs — C2's deliverable screenshots.
 *
 * WHY A STATIC HARNESS RATHER THAN A LIVE WALK. The Christmas Campaign does not
 * exist in production: authoring it is C5, which is operator-only, and a
 * feature-branch Vercel preview runs against PRODUCTION Firebase, so creating
 * one to photograph would be a real write to the live tenant. Instead the
 * surfaces are server-rendered from the REAL components with the REAL built
 * stylesheet, given Table 1 and the operator's live figures as props.
 *
 * Nothing is fetched and nothing is written. No Firebase client is constructed.
 *
 *   npm run build            # produces dist/assets/index-*.css
 *   node scripts/verification/c2-screenshots.mjs
 *
 * Output: verification/c2/*.png (gitignored, like every other capture).
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';

const OUT = 'verification/c2';
const TMP = path.join(OUT, '.tmp');
mkdirSync(TMP, { recursive: true });

// ── The real stylesheet, from the real build ─────────────────────────────────
const cssFile = readdirSync('dist/assets').find((f) => f.endsWith('.css'));
if (!cssFile) throw new Error('No dist/assets/*.css — run `npm run build` first.');
const css = readFileSync(path.join('dist/assets', cssFile), 'utf8');

// ── The entry: real components, fixture props ────────────────────────────────
const SRC = path.resolve('src').split(path.sep).join('/');

const ENTRY = [
  "import React from 'react';",
  "import { renderToStaticMarkup } from 'react-dom/server';",
  `import { CampaignForm } from '${SRC}/components/campaigns/CampaignPanel.jsx';`,
  `import CampaignCard from '${SRC}/components/campaigns/CampaignCard.jsx';`,
  `import { CampaignStandingsBlock } from '${SRC}/components/campaigns/CampaignStandings.jsx';`,
  `import { computeStandings } from '${SRC}/utils/campaignEngine.js';`,
  '',
  '// Table 1 of the signed document, verbatim, plus the C5 gate settings.',
  'const TIERS = [',
  "  { level: 1, name: 'Champion', api: 275000, apps: 35, cash: 7000,  voucher: 0, accommodation: 'shared' },",
  "  { level: 2, name: 'VIP',      api: 375000, apps: 35, cash: 20000, voucher: 0, accommodation: 'single' },",
  "  { level: 3, name: 'Premier',  api: 475000, apps: 35, cash: 30000, voucher: 0, accommodation: 'single' },",
  "  { level: 4, name: 'Elite',    api: 675000, apps: 35, cash: 52000, voucher: 0, accommodation: 'double' },",
  "  { level: 5, name: 'Pioneer',  api: 825000, apps: 35, cash: 70000, voucher: 0, accommodation: 'double' },",
  '];',
  '',
  'const CAMPAIGN = {',
  "  id: 'xmas26',",
  "  name: 'Christmas Campaign and Retreat 2026',",
  "  description: 'Costa Rica, four nights, April 2027.',",
  "  prize: 'Costa Rica retreat + cash',",
  "  startDate: '2026-07-01',",
  "  endDate: '2026-12-31',",
  "  status: 'active',",
  "  scope: { type: 'branch', unitIds: [], agentIds: [] },",
  '  targets: [],',
  "  structure: 'qualify',",
  "  standingsMetric: 'apiSold',",
  '  persistencyGateEnabled: true,',
  "  persistencyGate: { mode: 'binary', threshold: 90, basis: 'finalMonth' },",
  '  tiers: TIERS,',
  '  placements: [],',
  '  credit: { incPppAppThreshold: 2400 },',
  '};',
  '',
  "// The operator's live figures, from campaign-lens-reproduces-count.mjs:",
  '// 3 net apps, TTD 73,946.28 net API.',
  "const LIVE = [{ agentId: 'op', apiSold: 73946.28, applicationsSold: 3 }];",
  '',
  '// A populated ladder needs someone on it, so the reached state is visible.',
  'const LADDER_SUBS = [',
  "  { agentId: 'op', apiSold: 73946.28, applicationsSold: 3 },",
  "  { agentId: 'a2', apiSold: 480000,   applicationsSold: 36 },",
  "  { agentId: 'a3', apiSold: 290000,   applicationsSold: 35 },",
  '];',
  'const PARTICIPANTS = [',
  "  { id: 'op', name: 'Kyron Marchan' },",
  "  { id: 'a2', name: 'Anisa Boodoo' },",
  "  { id: 'a3', name: 'Devon Alleyne' },",
  '];',
  'const standings = computeStandings(CAMPAIGN, LADDER_SUBS, PARTICIPANTS, { op: 94, a2: 93, a3: 88 });',
  '',
  'const e = React.createElement;',
  'const shots = {',
  "  builder: e('div', { style: { width: 520 } }, e(CampaignForm, {",
  "    initial: CAMPAIGN, role: 'branch_manager', _uid: 'u1',",
  "    userProfile: { branchId: 'b1' }, allUsers: [], onSave: () => {}, onClose: () => {},",
  '  })),',
  "  ladder: e('div', { style: { width: 760 } }, e(CampaignStandingsBlock, {",
  '    campaign: CAMPAIGN, standings, hasPersistency: true,',
  '  })),',
  "  'agent-card': e('div', { style: { width: 420 } }, e(CampaignCard, {",
  "    campaign: CAMPAIGN, submissions: LIVE, agentId: 'op', persistency: [],",
  '  })),',
  "  'agent-card-dq': e('div', { style: { width: 420 } }, e(CampaignCard, {",
  "    campaign: CAMPAIGN, submissions: LIVE, agentId: 'op',",
  "    persistency: [{ monthKey: '2026-12', persistency: 0.86 }],",
  '  })),',
  "  'agent-card-champion': e('div', { style: { width: 420 } }, e(CampaignCard, {",
  "    campaign: CAMPAIGN, agentId: 'op',",
  "    submissions: [{ agentId: 'op', apiSold: 300000, applicationsSold: 36 }],",
  "    persistency: [{ monthKey: '2026-12', persistency: 0.93 }],",
  '  })),',
  '};',
  '',
  'export const html = Object.fromEntries(',
  '  Object.entries(shots).map(([k, el]) => [k, renderToStaticMarkup(el)]),',
  ');',
].join('\n');

const entryFile = path.join(TMP, 'entry.jsx');
writeFileSync(entryFile, ENTRY);

// src/firebase.js is stubbed exactly as vite.config.js stubs it for tests. The
// component tree reaches it through campaignService, and importing the real one
// would construct a Firebase client against unset env vars. Nothing here talks
// to Firebase, so the stub is the honest shape, not a shortcut.
const stubFile = path.join(TMP, 'firebase-stub.js');
writeFileSync(stubFile, [
  'export const db = {};',
  'export const auth = {};',
  'export const storage = {};',
  'export default {};',
].join('\n'));

const stubFirebase = {
  name: 'stub-firebase',
  setup(build) {
    build.onResolve({ filter: /(^|\/)firebase(\.js)?$/ }, (a) => (
      a.path.startsWith('firebase/') ? undefined : { path: path.resolve(stubFile) }
    ));
  },
};

const bundleFile = path.join(TMP, 'entry.bundle.mjs');
await esbuild.build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundleFile,
  logLevel: 'error',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  jsx: 'automatic',
  // React and every other package resolve natively at runtime; bundling
  // react-dom/server's CJS into ESM breaks on its require('util').
  packages: 'external',
  plugins: [stubFirebase],
});

const { html } = await import(pathToFileURL(path.resolve(bundleFile)).href);

// ── Page shell ───────────────────────────────────────────────────────────────
const page = (body, dark) => [
  '<!DOCTYPE html>',
  `<html lang="en"${dark ? ' class="dark"' : ''}><head><meta charset="utf-8">`,
  `<style>${css}</style>`,
  // The builder is a `fixed inset-0` drawer, which has no layout box inside an
  // inline harness wrapper. Neutralised here rather than in the component: the
  // drawer is correct in the app, and a screenshot harness must not change what
  // it photographs beyond making it measurable.
  '<style>',
  'body{margin:0;padding:24px;background:var(--color-bg);}',
  '#shot .fixed{position:static!important;}',
  '#shot [aria-label="Close drawer"]{display:none!important;}',
  '#shot .max-w-md{max-width:none!important;}',
  '#shot .overflow-y-auto{overflow:visible!important;}',
  '</style>',
  `</head><body>${body}</body></html>`,
].join('\n');

const browser = await chromium.launch();
const results = [];
for (const [name, markup] of Object.entries(html)) {
  for (const dark of [false, true]) {
    const file = path.resolve(TMP, `${name}${dark ? '-dark' : ''}.html`);
    writeFileSync(file, page(`<div id="shot" style="display:inline-block">${markup}</div>`, dark));
    const p = await browser.newPage({ viewport: { width: 1000, height: 1600 }, deviceScaleFactor: 2 });
    await p.goto(pathToFileURL(file).href);
    const el = await p.$('#shot');
    const out = path.join(OUT, `${name}-${dark ? 'dark' : 'light'}.png`);
    await el.screenshot({ path: out });
    results.push(out);
    await p.close();
  }
}
await browser.close();
rmSync(TMP, { recursive: true, force: true });
console.log(results.join('\n'));

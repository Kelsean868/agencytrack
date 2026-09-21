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
 * THE AGENT CARD IS PHOTOGRAPHED ON REAL PRODUCTION DATA. It is fed the
 * operator's actual policy docs, read-only via the Admin SDK, and derives its
 * own figures through the same derivePolicyLens call the app makes. Nothing is
 * hand-totalled into it. Run without --tenant/--agent and that shot is SKIPPED
 * rather than faked — a photograph of invented input is not evidence.
 *
 * The builder, the ladder and the two hypothetical card states are explicitly
 * CONSTRUCTED: they show shapes the live account does not currently have (a
 * populated ladder, a cleared level, a failed gate). They are labelled as such
 * in the PR body and prove rendering, not figures.
 *
 * Nothing is written. Read-only `.get()` only; credentials ambient.
 *
 *   npm run build
 *   node scripts/verification/c2-screenshots.mjs  *     --tenant tatillife_south --agent <uid>
 *
 * Output: verification/c2/*.png
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const TENANT = arg('--tenant');
const AGENT = arg('--agent');

/** Firestore Timestamp -> the plain 'YYYY-MM-DD' string the lens reads. */
function plain(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// The operator's REAL policy docs, unfiltered, exactly as HomeV2 hands them to
// CampaignCard. Read-only: one .get(), no write of any kind.
let livePolicies = null;
if (TENANT && AGENT) {
  const admin = require(path.resolve('functions/node_modules/firebase-admin'));
  admin.initializeApp();
  const snap = await admin.firestore()
    .collection(`tenants/${TENANT}/policies`).where('agentId', '==', AGENT).get();
  livePolicies = snap.docs.map((d) => {
    const p = { id: d.id, ...d.data() };
    return {
      ...p,
      dateIssued: plain(p.dateIssued),
      dateWritten: plain(p.dateWritten),
      dateSubmitted: plain(p.dateSubmitted),
      statusDate: plain(p.statusDate),
      createdAt: null,
    };
  });
  console.error(`live policies for ${AGENT}: ${livePolicies.length}`);
} else {
  console.error('WARNING: no --tenant/--agent given. The live agent-card shot is SKIPPED.');
}

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
  "// The operator's REAL policy docs, injected below. The card derives its own",
  '// figures from them through derivePolicyLens — nothing is totalled by hand.',
  'const LIVE_POLICIES = __LIVE_POLICIES__;',
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
  '};',
  '',
  "// REAL: the operator's own ledger, his own account, no invented input.",
  'if (LIVE_POLICIES) {',
  "  shots['agent-card'] = e('div', { style: { width: 420 } }, e(CampaignCard, {",
  "    campaign: CAMPAIGN, submissions: [], agentId: 'op',",
  '    persistency: [], policies: LIVE_POLICIES,',
  '  }));',
  '}',
  '',
  '// CONSTRUCTED: states the live account does not currently have. They prove',
  '// the rendering of the gate branches, never a figure about anyone real.',
  "shots['agent-card-dq'] = e('div', { style: { width: 420 } }, e(CampaignCard, {",
  "  campaign: CAMPAIGN, submissions: [], agentId: 'op',",
  "  policies: LIVE_POLICIES ?? [], persistency: [{ monthKey: '2026-12', persistency: 0.86 }],",
  '}));',
  "shots['agent-card-champion'] = e('div', { style: { width: 420 } }, e(CampaignCard, {",
  "  campaign: CAMPAIGN, submissions: [], agentId: 'op',",
  "  persistency: [{ monthKey: '2026-12', persistency: 0.93 }],",
  '  policies: Array.from({ length: 36 }, (_, i) => ({',
  "    id: `c${i}`, productLine: 'life', status: 'settled', newBusinessType: 'nb_ordinary',",
  "    isSelfOrFamily: false, dateIssued: '2026-08-04', proposedAPI: i === 0 ? 300000 : 0,",
  '  })),',
  '}));',
  '',
  'export const html = Object.fromEntries(',
  '  Object.entries(shots).map(([k, el]) => [k, renderToStaticMarkup(el)]),',
  ');',
].join('\n');

const entryFile = path.join(TMP, 'entry.jsx');
writeFileSync(entryFile, ENTRY.replace('__LIVE_POLICIES__', JSON.stringify(livePolicies)));

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

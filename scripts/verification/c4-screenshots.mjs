/**
 * c4-screenshots.mjs — C4's deliverable screenshot: the Awards panel for a
 * July–December month showing "Recognition only".
 *
 * REAL INPUT PATH, no hand-written data array. The harness reads the operator's
 * actual policy docs (read-only), runs them through the REAL
 * `settlementShapeFromPolicies` — which is how the app itself derives award
 * inputs for this tenant, because `tenants/…/settlements` is empty — and hands
 * the result to the REAL `AgentAwardsPanel`. The panel computes its own awards.
 *
 * The one thing supplied by hand is the CAMPAIGN, and it has to be: no campaign
 * document exists in Firestore yet (authoring it is C5, operator-only). It is
 * the C5 spec verbatim, and it is the input under test — Rule 10 is a property
 * of the campaign, not of the agent's production.
 *
 * Nothing is written. Read-only `.get()` only; credentials ambient.
 *
 *   npm run build
 *   node scripts/verification/c4-screenshots.mjs --tenant tatillife_south --agent <uid>
 *
 * Output: verification/c4/*.png
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
if (!TENANT || !AGENT) throw new Error('--tenant and --agent are required; this shot is not faked without them.');

function plain(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const admin = require(path.resolve('functions/node_modules/firebase-admin'));
admin.initializeApp();
const snap = await admin.firestore()
  .collection(`tenants/${TENANT}/policies`).where('agentId', '==', AGENT).get();
const livePolicies = snap.docs.map((d) => {
  const p = { id: d.id, ...d.data() };
  return {
    ...p,
    dateIssued: plain(p.dateIssued),
    dateWritten: plain(p.dateWritten),
    dateSubmitted: plain(p.dateSubmitted),
    dateLapsed: plain(p.dateLapsed),
    statusAsOf: plain(p.statusAsOf),
    createdAt: null,
  };
});
// The panel renders its empty state unless real weekly submissions exist, and
// the operator has three. Pulled rather than fabricated.
const subSnap = await admin.firestore()
  .collection(`tenants/${TENANT}/submissions`).where('agentId', '==', AGENT).get();
const liveSubs = subSnap.docs.map((d) => {
  const x = { id: d.id, ...d.data() };
  return { ...x, createdAt: null, updatedAt: null, submittedAt: null };
});
console.error(`live policies for ${AGENT}: ${livePolicies.length}; submissions: ${liveSubs.length}`);

const OUT = 'verification/c4';
const TMP = path.join(OUT, '.tmp');
mkdirSync(TMP, { recursive: true });

const cssFile = readdirSync('dist/assets').find((f) => f.endsWith('.css'));
if (!cssFile) throw new Error('No dist/assets/*.css — run `npm run build` first.');
const css = readFileSync(path.join('dist/assets', cssFile), 'utf8');

const SRC = path.resolve('src').split(path.sep).join('/');

const ENTRY = [
  "import React from 'react';",
  "import { renderToStaticMarkup } from 'react-dom/server';",
  `import AgentAwardsPanel from '${SRC}/components/awards/AgentAwardsPanel.jsx';`,
  `import { settlementShapeFromPolicies } from '${SRC}/lib/policiesDerivation.js';`,
  `import { DEFAULT_RULESET_2026 } from '${SRC}/config/awardsRuleset/2026.js';`,
  '',
  '// The C5 spec verbatim. suppressesAwardCash is the input under test.',
  'const CHRISTMAS = {',
  "  id: 'xmas26',",
  "  name: 'Christmas Campaign and Retreat 2026',",
  "  startDate: '2026-07-01',",
  "  endDate: '2026-12-31',",
  "  status: 'active',",
  '  suppressesAwardCash: true,',
  '};',
  '',
  'const LIVE_POLICIES = __LIVE_POLICIES__;',
  'const LIVE_SUBS = __LIVE_SUBS__;',
  '',
  '// The REAL derivation the app uses for this tenant: settlements are derived',
  '// from the policy ledger, because the settlements collection is empty.',
  'const confirmed = settlementShapeFromPolicies(LIVE_POLICIES);',
  "const PROFILE = { monthsInIndustry: 40, monthsAtTatil: 40, isBdoDso: false, name: 'Kyron Marchan' };",
  '',
  'const e = React.createElement;',
  'const panel = (campaigns) => e(AgentAwardsPanel, {',
  '  submissions: LIVE_SUBS, confirmedSettlements: confirmed, agentProfile: PROFILE,',
  '  ruleset: DEFAULT_RULESET_2026,',
  // August 2026 — inside the campaign's July–December window, and the month
  // where the operator's REAL ledger actually carries production (3 apps).
  // November renders the panel's genuine empty state, which shows nothing.
  "  currentDate: '2026-08-15', activeCampaigns: campaigns,",
  '});',
  '',
  'export const html = {',
  "  'awards-suppressed': renderToStaticMarkup(e('div', { style: { width: 900 } }, panel([CHRISTMAS]))),",
  "  'awards-normal': renderToStaticMarkup(e('div', { style: { width: 900 } }, panel([]))),",
  '};',
].join('\n');

const entryFile = path.join(TMP, 'entry.jsx');
writeFileSync(entryFile, ENTRY
  .replace('__LIVE_POLICIES__', JSON.stringify(livePolicies))
  .replace('__LIVE_SUBS__', JSON.stringify(liveSubs)));

// src/firebase.js and AuthContext are stubbed exactly as the test harness stubs
// them. The panel reads a tenantId from context and would otherwise construct a
// Firebase client; nothing here talks to Firebase from the browser side.
const fbStub = path.join(TMP, 'firebase-stub.js');
writeFileSync(fbStub, ['export const db = {};', 'export const auth = {};', 'export const storage = {};', 'export default {};'].join('\n'));
const authStub = path.join(TMP, 'auth-stub.js');
writeFileSync(authStub, [
  "export const useAuth = () => ({ user: { uid: 'op' }, userProfile: {}, tenantId: 'tatillife_south', role: 'agent' });",
  'export const AuthProvider = ({ children }) => children;',
  'export default { useAuth, AuthProvider };',
].join('\n'));

const stubs = {
  name: 'stub-app-singletons',
  setup(build) {
    build.onResolve({ filter: /(^|\/)firebase(\.js)?$/ }, (a) => (
      a.path.startsWith('firebase/') ? undefined : { path: path.resolve(fbStub) }
    ));
    build.onResolve({ filter: /AuthContext(\.jsx)?$/ }, () => ({ path: path.resolve(authStub) }));
  },
};

const bundleFile = path.join(TMP, 'entry.bundle.mjs');
await esbuild.build({
  entryPoints: [entryFile],
  bundle: true, format: 'esm', platform: 'node', outfile: bundleFile,
  logLevel: 'error', loader: { '.js': 'jsx', '.jsx': 'jsx' }, jsx: 'automatic',
  packages: 'external', plugins: [stubs],
});

const { html } = await import(pathToFileURL(path.resolve(bundleFile)).href);

const page = (body, dark) => [
  '<!DOCTYPE html>',
  `<html lang="en"${dark ? ' class="dark"' : ''}><head><meta charset="utf-8">`,
  `<style>${css}</style>`,
  '<style>body{margin:0;padding:24px;background:var(--color-bg);}</style>',
  `</head><body>${body}</body></html>`,
].join('\n');

const browser = await chromium.launch();
const results = [];
for (const [name, markup] of Object.entries(html)) {
  for (const dark of [false, true]) {
    const file = path.resolve(TMP, `${name}${dark ? '-dark' : ''}.html`);
    writeFileSync(file, page(`<div id="shot" style="display:inline-block">${markup}</div>`, dark));
    const p = await browser.newPage({ viewport: { width: 1100, height: 1800 }, deviceScaleFactor: 2 });
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

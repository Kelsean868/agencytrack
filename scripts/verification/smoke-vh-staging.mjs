/**
 * smoke-vh-staging.mjs — VH Run-2 full-surface LIVE smoke suite (staging).
 *
 * Tiered, per-role, value-level assertions (numbers / order / state changes —
 * selector presence alone is never a pass). Every leg gets a console-clean
 * assertion and a zero-requests-to-production tripwire (agencytrack-2a610).
 *
 * Usage (from repo root, staging worktree):
 *   node --env-file=.env.staging scripts/verification/smoke-vh-staging.mjs                # all tiers
 *   node --env-file=.env.staging scripts/verification/smoke-vh-staging.mjs --tier=1
 *   node --env-file=.env.staging scripts/verification/smoke-vh-staging.mjs --leg=<id-substring>
 *   node --env-file=.env.staging scripts/verification/smoke-vh-staging.mjs --list
 *
 * PRE-REQ: scripts/staging/seed-fixtures.mjs --apply run on the SAME TT day
 * (fixture dates + expectations are computed relative to today).
 * Legs that MUTATE staging data note it in their description; re-running the
 * seed resets all vhfix fixtures.
 *
 * Registered in scripts/verification/SMOKES.md.
 */
import { chromium } from 'playwright';
import { stamp, installGlobalTimeout } from './lib/walk-helpers.mjs';
import { assertEnv, shotFactory } from './vh/vh-helpers.mjs';
import { BASE, TODAY } from './vh/expectations.mjs';
import { LEGS as TIER0 } from './vh/tier0.mjs';
import { LEGS as TIER1 } from './vh/tier1.mjs';
import { LEGS as TIER2 } from './vh/tier2.mjs';
import { LEGS as TIER3 } from './vh/tier3.mjs';
import { LEGS as CROSSCUT } from './vh/crosscut.mjs';
import { resolve } from 'path';

assertEnv();

const args = process.argv.slice(2);
const getArg = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const tierFilter = getArg('tier');       // 0|1|2|3|xc
const legFilter = getArg('leg');         // substring match on leg id
const listOnly = args.includes('--list');

const ALL = [
  ...TIER0.map((l) => ({ ...l, tier: '0' })),
  ...TIER1.map((l) => ({ ...l, tier: '1' })),
  ...TIER2.map((l) => ({ ...l, tier: '2' })),
  ...TIER3.map((l) => ({ ...l, tier: '3' })),
  ...CROSSCUT.map((l) => ({ ...l, tier: 'xc' })),
];

let legs = ALL;
if (tierFilter) legs = legs.filter((l) => l.tier === tierFilter);
if (legFilter) legs = legs.filter((l) => l.id.includes(legFilter));

if (listOnly) {
  for (const l of legs) console.log(`[T${l.tier}] ${l.id} (${l.role}) — ${l.desc}`);
  process.exit(0);
}

console.log(`[smoke-vh] ${stamp()} base=${BASE} today(TT)=${TODAY} legs=${legs.length}${tierFilter ? ` tier=${tierFilter}` : ''}${legFilter ? ` leg~=${legFilter}` : ''}`);

const SS_DIR = resolve('out/vh-smoke', stamp().replace(/[:]/g, '-'));
const shot = shotFactory(SS_DIR);

const results = [];
const record = (leg, status, detail) => {
  results.push({ tier: leg.tier, id: leg.id, role: leg.role, status, detail });
  const mark = status === 'PASS' ? '✓' : status === 'SKIP' ? '⊘' : '✗';
  console.log(`[${stamp()}] ${mark} ${status} [T${leg.tier}] ${leg.id} — ${detail}`);
};

const clearTimer = installGlobalTimeout(90 * 60 * 1000, () => printTable());

function printTable() {
  const pad = (s, n) => String(s ?? '').padEnd(n);
  console.log('\n════════ VH SMOKE RESULTS ════════');
  console.log(`${pad('TIER', 5)}${pad('LEG', 44)}${pad('ROLE', 16)}${pad('STATUS', 8)}DETAIL`);
  for (const r of results) console.log(`${pad(r.tier, 5)}${pad(r.id, 44)}${pad(r.role, 16)}${pad(r.status, 8)}${r.detail}`);
  const c = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nTOTAL: ${results.length} — PASS ${c('PASS')} / FAIL ${c('FAIL')} / SKIP ${c('SKIP')}`);
  console.log(`screenshots: ${SS_DIR}`);
}

const browser = await chromium.launch();
try {
  for (const leg of legs) {
    try {
      const detail = await leg.run({ browser, shot });
      record(leg, 'PASS', detail || 'ok');
    } catch (err) {
      const msg = String(err?.message ?? err).replace(/\s+/g, ' ').slice(0, 300);
      if (msg.startsWith('SKIP:')) record(leg, 'SKIP', msg.slice(5).trim());
      else {
        record(leg, 'FAIL', msg);
        if (err?.page) await shot(err.page, `FAIL-${leg.id}`);
      }
    }
  }
} finally {
  await browser.close();
  clearTimer?.();
  printTable();
  process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
}

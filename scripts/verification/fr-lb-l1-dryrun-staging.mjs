/**
 * fr-lb-l1-dryrun-staging.mjs — FR Leaderboard L-1, Phase 3 real invocation (Rule 5).
 *
 * Runs the REAL aggregate code (functions/leaderboard/leaderboardAggregate.js
 * `loadInputs` + `computeLeaderboards`) against STAGING tenant `staging_test`
 * and prints a per-agent table. It NEVER writes a leaderboards or
 * weeklyChampions doc — the compute is called directly, the batch write is not.
 *
 *   node scripts/verification/fr-lb-l1-dryrun-staging.mjs           # read-only
 *   node scripts/verification/fr-lb-l1-dryrun-staging.mjs --seed    # + seed
 *
 * --seed (dispatcher ruling, 1 Oct 2026): writes up to three current-week
 * dailyActivity entries for staging fixture agent 1, so the Activity path is
 * exercised on real data, then deletes exactly those entries in a `finally`
 * block (Rule 3 cleanup). It refuses to seed over an existing day, and refuses
 * to seed when the agent already submitted this week (the days would not count).
 *
 * SAFETY — abort before any read unless the key project_id AND the resolved
 * Admin app project are agencytrack-staging (guard copied from
 * scripts/verification/vh/admin-read.mjs). The tenant is fixed to staging_test.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const STAGING_PROJECT = 'agencytrack-staging';
const PROD_PROJECT = 'agencytrack-2a610';
const TENANT_ID = 'staging_test';
const FIXTURE_EMAIL = 'staging-agent-1@agencytrack-staging.test';
const SEED_MARK = 'fr-lb-l1-dryrun';
const SEED = process.argv.includes('--seed');

const KEY_PATH = process.env.STAGING_SA_KEY_PATH
  ? resolve(process.env.STAGING_SA_KEY_PATH)
  : resolve(REPO_ROOT, 'functions', 'service-account-key.staging.json');

function abort(msg) {
  console.error(`DRY-RUN ABORTED — ${msg}`);
  process.exit(2);
}

if (!existsSync(KEY_PATH)) abort(`staging service-account key not found at ${KEY_PATH}`);
const keyJson = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
if (keyJson.project_id === PROD_PROJECT) abort(`key project_id is PRODUCTION (${PROD_PROJECT}) — refusing.`);
if (keyJson.project_id !== STAGING_PROJECT) abort(`key project_id is '${keyJson.project_id}', expected '${STAGING_PROJECT}'.`);

// Same module instance the aggregate code requires (functions/node_modules).
const admin = require(resolve(REPO_ROOT, 'functions', 'node_modules', 'firebase-admin'));
const app = admin.initializeApp({ credential: admin.credential.cert(keyJson), projectId: STAGING_PROJECT });
if ((app.options.projectId || keyJson.project_id) !== STAGING_PROJECT) abort('resolved Admin app project is not staging.');

const { _internals } = require(resolve(REPO_ROOT, 'functions', 'leaderboard', 'leaderboardAggregate.js'));
const { periodWindow } = require(resolve(REPO_ROOT, 'functions', 'leaderboard', 'boardMetrics.js'));
const { computeDayPoints } = require(resolve(REPO_ROOT, 'functions', 'lib', 'dayPoints.js'));

const db = admin.firestore();
const now = new Date();

function seedDates() {
  const { from } = periodWindow('week', now);
  const today = new Date(now.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10);
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const s = d.toISOString().slice(0, 10);
    if (s <= today) out.push(s);
  }
  return { weekStarting: from, dates: out.length ? out : [from] };
}

const SEED_FIELDS = [
  { dials: 18, ffiConducted: 1, appointmentsSet: 2 },
  { dials: 12, ciConducted: 1, prospectingLettersSent: 5 },
  { dials: 9, ffiConducted: 1, newBusiness: { apps: 1, api: 3600 } },
];

async function seed() {
  const users = await db.collection(`tenants/${TENANT_ID}/users`).where('email', '==', FIXTURE_EMAIL).get();
  if (users.size !== 1) throw new Error(`expected 1 fixture user ${FIXTURE_EMAIL}, found ${users.size}`);
  const agent = users.docs[0];
  const { weekStarting, dates } = seedDates();

  const report = await db.doc(`tenants/${TENANT_ID}/submissions/${agent.id}_${weekStarting}`).get();
  if (report.exists && report.data().status === 'submitted') {
    throw new Error(`fixture agent already submitted week ${weekStarting}; seeded days would not count`);
  }
  const refs = dates.map((date) => db.doc(`tenants/${TENANT_ID}/users/${agent.id}/dailyActivity/${date}`));
  for (const ref of refs) {
    if ((await ref.get()).exists) throw new Error(`refusing to overwrite existing day ${ref.path}`);
  }

  const created = [];
  const seededDays = [];
  for (let i = 0; i < refs.length; i++) {
    const day = { date: dates[i], weekStarting, agentId: agent.id, version: 2, seededBy: SEED_MARK, ...SEED_FIELDS[i] };
    await refs[i].create({ ...day, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    created.push(refs[i]);
    seededDays.push(day);
  }
  return { agentId: agent.id, weekStarting, created, seededDays };
}

async function cleanup(created) {
  for (const ref of created) {
    const snap = await ref.get();
    if (snap.exists && snap.data().seededBy !== SEED_MARK) {
      console.error(`CLEANUP SKIPPED ${ref.path} — not a seeded doc`);
      continue;
    }
    await ref.delete();
  }
  const left = [];
  for (const ref of created) if ((await ref.get()).exists) left.push(ref.path);
  return left;
}

const pad = (v, n) => String(v).padEnd(n);
const lpad = (v, n) => String(v).padStart(n);
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function printTable(docs) {
  for (const [branchId, doc] of docs.entries()) {
    console.log(`\nBRANCH ${branchId}  sources=${JSON.stringify(doc.sources)}  skippedNoBranch=${JSON.stringify(doc.skippedNoBranch)}`);
    console.log(`${pad('agent', 22)}${pad('period', 6)}${lpad('API (TTD)', 13)}${lpad('apps', 6)}${lpad('points', 8)}${lpad('rank', 6)}${lpad('inUnit', 8)}  previousRanks`);
    const ids = doc.week.map((e) => e.agentId);
    for (const id of ids) {
      for (const key of ['week', 'mtd', 'qtd', 'ytd']) {
        const e = doc[key].find((x) => x.agentId === id);
        const prev = e.previousRanks ? `act ${e.previousRanks.activity} · api ${e.previousRanks.api} · apps ${e.previousRanks.apps}` : '';
        console.log(`${pad(key === 'week' ? e.name.slice(0, 21) : '', 22)}${pad(key, 6)}${lpad(money(e.periodApi), 13)}${lpad(e.apps, 6)}${lpad(e.points, 8)}${lpad(e.rank, 6)}${lpad(e.rankWithinUnit, 8)}  ${prev}`);
      }
    }
  }
}

let seeded = null;
let exitCode = 0;
try {
  console.log(`Target: ${STAGING_PROJECT} / tenants/${TENANT_ID}  ref=${now.toISOString()}  mode=${SEED ? 'seed + dry-run' : 'read-only dry-run'}`);
  if (SEED) {
    seeded = await seed();
    console.log(`SEEDED ${seeded.created.length} days for fixture agent 1 (week ${seeded.weekStarting}): ${seeded.created.map((r) => r.id).join(', ')}`);
  }

  const inputs = await _internals.loadInputs(TENANT_ID, now);
  const { docs, championsDoc, priorWeekStarting } = _internals.computeLeaderboards(inputs, now);
  const dailyDocs = [...inputs.dailiesByAgent.values()].reduce((n, d) => n + d.length, 0);
  console.log(`INPUTS users=${inputs.users.length} submitted=${inputs.submissions.length} policies=${inputs.policies.length} dailyQueries=${inputs.dailyQueries} dailyDocsRead=${dailyDocs}`);
  console.log(`WINDOWS week=${JSON.stringify(periodWindow('week', now))} mtd=${JSON.stringify(periodWindow('mtd', now))} qtd=${JSON.stringify(periodWindow('quarter', now))} ytd=${JSON.stringify(periodWindow('ytd', now))}`);
  printTable(docs);
  console.log(`\nCHAMPIONS weeklyChampions/${priorWeekStarting} (NOT written): ${JSON.stringify(championsDoc)}`);

  if (seeded) {
    const expected = seeded.seededDays.reduce((s, d) => s + computeDayPoints(d), 0);
    const entry = [...docs.values()].flatMap((d) => d.week).find((e) => e.agentId === seeded.agentId);
    const other = (inputs.dailiesByAgent.get(seeded.agentId) || [])
      .filter((d) => d.weekStarting === seeded.weekStarting && d.seededBy !== SEED_MARK);
    const expectedTotal = expected + other.reduce((s, d) => s + computeDayPoints(d), 0);
    const ok = entry && entry.points === expectedTotal;
    console.log(`\nCHECK seeded week points: expected ${expectedTotal} (seeded ${expected}), board shows ${entry ? entry.points : 'NO ENTRY'} → ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) exitCode = 1;
  }
} catch (err) {
  console.error('DRY-RUN FAILED:', err.message);
  exitCode = 1;
} finally {
  if (seeded) {
    const left = await cleanup(seeded.created);
    console.log(left.length ? `CLEANUP FAILED — still present: ${left.join(', ')}` : `CLEANUP OK — ${seeded.created.length} seeded days deleted and confirmed gone`);
    if (left.length) exitCode = 3;
  }
}
process.exit(exitCode);

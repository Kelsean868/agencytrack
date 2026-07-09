/**
 * seed-fixtures.mjs — deep synthetic fixture seeder for the STAGING project.
 * Run AFTER scripts/staging/seed-staging.mjs (which owns auth users + claims +
 * user docs). This script fills the staging_test tenant with rich, schema-valid
 * fixtures so every Run-1 surface is exercisable by the VH smoke suite
 * (docs/briefs/fable-verification-hardening-kickoff.md, Phase A).
 *
 * SAFETY GUARDS — identical to seed-staging.mjs (abort before ANY write):
 *   1. Key project_id MUST be agencytrack-staging (never agencytrack-2a610).
 *   2. Resolved Admin app project MUST be agencytrack-staging.
 * All writes confined to tenants/staging_test/… + the six synthetic auth users.
 * NO code path targets production. All data synthetic.
 *
 * IDEMPOTENT + RE-RUNNABLE: fixed `vhfix-*` doc IDs (or deterministic composite
 * IDs) written with .set() — re-running RESETS fixtures to canonical state,
 * which also undoes smoke-run mutations (postponed appts, delivered policies,
 * advanced candidates, WAR reviews). Dates are computed relative to "today"
 * (America/Port_of_Spain, permanent UTC-4) at run time.
 *
 * Schema sources (Rule 17 — verified against staging source 2026-07-09):
 *   submissions   src/services/submissionService.js sanitize()+envelope; extractFields.js
 *   WARs          src/services/managerWarService.js; firestore.rules validWarWrite
 *   goals         src/services/goalsService.js; GoalsPanel GoalLevelForm
 *   financing     src/services/financingService.js; lib/financingMissEngine.js
 *   policies      src/services/policiesService.js; rules Arm A-E; utils/clawbackClock.js
 *   persistency   src/services/persistencyService.js; lib/persistency/calculations.js
 *   campaigns     src/services/campaignService.js; utils/campaignEngine.js
 *   recruiting    src/services/recruitingService.js; rules validCandidateWrite
 *   appointments  src/services/plannerService.js; rules validApptWrite
 *   prospectInfo  src/services/prospectInfoService.js (users/{uid}/prospectInfo subcoll)
 *   yearPlan/monthlyPlan/weeklyPlans  yearPlanService/monthlyPlanService/weeklyPlanService
 *   kiosk         functions/kiosk/validateToken.js; lib/kiosk/kioskServices.js
 *
 * USAGE
 *   node scripts/staging/seed-fixtures.mjs --dry-run   # print intent, no key needed
 *   node scripts/staging/seed-fixtures.mjs --apply     # execute (staging key required)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// Constants — hardcoded literals, never env-driven.
// ─────────────────────────────────────────────────────────────────────────────
const STAGING_PROJECT = 'agencytrack-staging';
const PROD_PROJECT    = 'agencytrack-2a610';
const TENANT_ID       = 'staging_test';
const BRANCH_ID       = 'staging_branch';

const KEY_PATH = process.env.STAGING_SA_KEY_PATH
  ? resolve(process.env.STAGING_SA_KEY_PATH)
  : resolve(REPO_ROOT, 'functions', 'service-account-key.staging.json');

const EMAILS = {
  ta:  'staging-tenant-admin@agencytrack-staging.test',
  bm:  'staging-branch-manager@agencytrack-staging.test',
  um:  'staging-unit-manager@agencytrack-staging.test',
  a1:  'staging-agent-1@agencytrack-staging.test',
  a2:  'staging-agent-2@agencytrack-staging.test',
  cro: 'staging-cro@agencytrack-staging.test',
};
const NAMES = {
  ta: 'Staging Tenant Admin', bm: 'Staging Branch Manager', um: 'Staging Unit Manager',
  a1: 'Staging Agent One', a2: 'Staging Agent Two', cro: 'Staging CRO',
};
const CRO_PASSWORD_FALLBACK = 'ChangeMe-Staging-2026!';

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isApply  = args.includes('--apply');
if (isDryRun === isApply) {
  console.error('Usage: node scripts/staging/seed-fixtures.mjs --dry-run | --apply');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers — Trinidad is permanent UTC-4 (no DST). All YYYY-MM-DD strings
// are TT-local dates; weeks start Sunday.
// ─────────────────────────────────────────────────────────────────────────────
const TT_OFFSET_MS = 4 * 3600 * 1000;
function ttNow() { return new Date(Date.now() - TT_OFFSET_MS); } // use getUTC* on this
function ymd(d) { return d.toISOString().slice(0, 10); }
const TODAY = ymd(ttNow());
const YEAR = TODAY.slice(0, 4);
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
// Most recent Sunday <= today (TT).
const W0 = (() => { const n = ttNow(); return addDays(ymd(n), -n.getUTCDay()); })();
const W = (k) => addDays(W0, k * 7); // W(0)=this week's Sunday, W(-1)=last week, …
const monthKeyOffset = (k) => { // k months back from current TT month, 'YYYY-MM'
  const n = ttNow();
  const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - k, 1));
  return d.toISOString().slice(0, 7);
};

console.log(`[seed-fixtures] today(TT)=${TODAY}  currentWeekSunday=${W0}  mode=${isDryRun ? 'DRY-RUN' : 'APPLY'}`);

// ─────────────────────────────────────────────────────────────────────────────
// Fixture value tables (single source of hand-computed smoke expectations).
// ─────────────────────────────────────────────────────────────────────────────

// A1 submissions: strong + streaky, all >= weekly floor api (4800) => 9 award
// weeks + 9-week streak; best week W(-5)=22000. YTD sum = 122,000 =>
// ratio vs tenure floor 250k * yearFraction(~0.52) ≈ 0.94 => NO exception flag.
const A1_WEEKS = [
  { w: -9, api: 11500, apps: 2 }, { w: -8, api: 12800, apps: 2 },
  { w: -7, api: 11200, apps: 2 }, { w: -6, api: 13400, apps: 3 },
  { w: -5, api: 22000, apps: 4 }, // best week
  { w: -4, api: 12600, apps: 2 }, { w: -3, api: 11800, apps: 2 },
  { w: -2, api: 14200, apps: 3 }, { w: -1, api: 12500, apps: 2 },
];
// A2 submissions: weak + gappy. YTD 8,500 => ratio ≈ 0.065 < 0.5 => 'floor'
// (danger) exception; no this-week submission => Master Sheet non-filer +
// Meeting Mode 'report' flag; all below 4800 => zero award weeks, no streak.
const A2_WEEKS = [
  { w: -9, api: 2100, apps: 1 }, { w: -7, api: 3800, apps: 1 }, { w: -4, api: 2600, apps: 1 },
];
// Producing-manager submissions (mp surfaces).
const UM_WEEKS = [
  { w: -3, api: 6000, apps: 1 }, { w: -2, api: 7500, apps: 2 }, { w: -1, api: 5200, apps: 1 },
];
const BM_WEEKS = [
  { w: -2, api: 9000, apps: 2 }, { w: -1, api: 8500, apps: 1 },
];

// Persistency (E3): A1 per-month gross 21 / net 20 => 95.24% (>90 band, x1.0).
// A2 per-month gross 18 / net 15 => 83.33% (80-84 band, x0.25).
const A1_E3 = { businessPlaced: 20, notTakens: 1, incPPPs: 2, lumpsums100: 0, lapses: 1, reinstatements: 0 };
const A2_E3 = { businessPlaced: 20, notTakens: 2, incPPPs: 0, lumpsums100: 0, lapses: 3, reinstatements: 0 };
const E3_MONTHS = [monthKeyOffset(3), monthKeyOffset(2), monthKeyOffset(1)]; // 3 prior months

// Campaigns. Qualify window covers all seeded submissions; hand-computed:
//   A1 windowed apiSold 122,000 / apps 22 => Gold tier (100k/20) x gate 1.0
//     => projectedCash 10,000, projectedVoucher 2,500.
//   A2 8,500 / 3 => below Bronze (30k/5) => no tier; gate x0.25 moot.
// Placement window = current month-2 span; A1 sums W(-4..-1)=51,100 => rank 1
//   prize 3000 x1.0; A2 2,600 => rank 2 prize 1500 x0.25 = 375.
const CAMP_QUALIFY = {
  id: 'vhfix-camp-qualify',
  name: 'Staging Sprint — Qualify', description: 'VH-run tiered qualify campaign (synthetic).',
  structure: 'qualify', standingsMetric: 'apiSold', persistencyGateEnabled: true,
  kiosk: true, meeting: true, countsTowardAwards: true, status: 'active', prize: '',
  startDate: W(-9), endDate: addDays(W0, 27),
  tiers: [
    { level: 1, name: 'Bronze', api: 30000,  apps: 5,  cash: 2000,  voucher: 0 },
    { level: 2, name: 'Silver', api: 60000,  apps: 10, cash: 5000,  voucher: 1000 },
    { level: 3, name: 'Gold',   api: 100000, apps: 20, cash: 10000, voucher: 2500 },
  ],
  targets: [{ metric: 'apiSold', threshold: 100000 }],
};
const CAMP_PLACEMENT = {
  id: 'vhfix-camp-placement',
  name: 'Staging Placement Dash', description: 'VH-run placement campaign (synthetic).',
  structure: 'placement', standingsMetric: 'apiSold',
  kiosk: false, meeting: false, countsTowardAwards: true, status: 'active', prize: '',
  startDate: W(-4), endDate: addDays(W0, 27),
  placements: [{ rank: 1, prize: 3000 }, { rank: 2, prize: 1500 }, { rank: 3, prize: 750 }],
  targets: [{ metric: 'apiSold', threshold: 50000 }],
};

// Recruiting: 8 candidates, one per stage; #4 stalled (stageChangedAt 20d ago,
// > 14d threshold); #8 licensed this year; owners alternate UM/BM.
const RECRUITS = [
  { id: 'vhfix-rec-1', name: 'Anil Maharaj',      stage: 'sourced',    owner: 'um', daysInStage: 3,  source: 'referral' },
  { id: 'vhfix-rec-2', name: 'Keisha Alexander',  stage: 'contacted',  owner: 'bm', daysInStage: 5,  source: 'seminar' },
  { id: 'vhfix-rec-3', name: 'Ravi Persad',       stage: 'seminar',    owner: 'um', daysInStage: 2,  source: 'cold-call' },
  { id: 'vhfix-rec-4', name: 'Nadia Mohammed',    stage: 'interview',  owner: 'bm', daysInStage: 20, source: 'referral' }, // STALLED
  { id: 'vhfix-rec-5', name: 'Jerome La Roche',   stage: 'assessment', owner: 'um', daysInStage: 4,  source: 'booth-event' },
  { id: 'vhfix-rec-6', name: 'Candice Boodoo',    stage: 'offer',      owner: 'bm', daysInStage: 6,  source: 'referral' },
  { id: 'vhfix-rec-7', name: 'Marcus Springer',   stage: 'licensing',  owner: 'um', daysInStage: 9,  source: 'family-friend' },
  { id: 'vhfix-rec-8', name: 'Priya Sooknanan',   stage: 'licensed',   owner: 'bm', daysInStage: 60, source: 'seminar', licensed: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run — print intent, no key, no writes.
// ─────────────────────────────────────────────────────────────────────────────
if (isDryRun) {
  console.log(`\nIntended writes (tenants/${TENANT_ID}/…):`);
  console.log(`  submissions      A1 ${A1_WEEKS.length} submitted (${W(-9)}..${W(-1)}) + 1 draft ${W0}; A2 ${A2_WEEKS.length}; UM ${UM_WEEKS.length}; BM ${BM_WEEKS.length}`);
  console.log(`  managerWeeklyReports  UM ${W(-2)},${W(-1)} submitted; BM ${W(-1)} submitted + ${W0} draft`);
  console.log(`  goals            goals/{a1,a2} + unitGoals/{um}_${YEAR} + branchGoals/${YEAR} + config/companyMinimums`);
  console.log(`  financing        terms a1+a2; ledger a1 6mo declining, a2 4mo w/ 2 misses + 15% adj flag`);
  console.log(`  policies         8 vhfix docs (within/at-risk/overdue undelivered, delivered, in-flight x2, lapsed)`);
  console.log(`  persistency      a1+a2 x months ${E3_MONTHS.join(',')} (95.2% vs 83.3%)`);
  console.log(`  campaigns        ${CAMP_QUALIFY.id} (qualify, gate ON) + ${CAMP_PLACEMENT.id} (placement)`);
  console.log(`  recruitingCandidates  8 candidates across all stages (1 stalled, 1 licensed)`);
  console.log(`  appointments     A1 week: today mixed + free block + SALE, rest of week, postpone/rebook pair`);
  console.log(`  users/{a1}/prospectInfo  4 preps (today/tomorrow prepped, +4d unprepped, -3d overdue)`);
  console.log(`  users/{a1,um}/yearPlan+monthlyPlan ${YEAR} committed; weeklyPlans/{a1}_${W0}`);
  console.log(`  config/settings  featureFlags {persistencyV2,policyLedgerCampaignLens,awardsProvenance}=true`);
  console.log(`  kioskTokens/vhfix-kiosk-token`);
  console.log(`  cleanup          orphan user docs (email matches synthetic account, id != auth uid)`);
  console.log('\n[dry-run complete — no key required, no writes performed]');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARDS (copied from seed-staging.mjs — abort before any write).
// ─────────────────────────────────────────────────────────────────────────────
function abort(msg) {
  console.error('\n============================================================');
  console.error(`  SEED ABORTED — ${msg}`);
  console.error('============================================================');
  process.exit(1);
}
if (!existsSync(KEY_PATH)) abort(`staging service-account key not found at ${KEY_PATH}`);
let keyJson;
try { keyJson = JSON.parse(readFileSync(KEY_PATH, 'utf8')); }
catch (e) { abort(`could not parse staging key JSON: ${e.message}`); }
if (keyJson.project_id === PROD_PROJECT) abort(`key project_id is PRODUCTION (${PROD_PROJECT}) — refusing.`);
if (keyJson.project_id !== STAGING_PROJECT) abort(`key project_id is '${keyJson.project_id}', expected '${STAGING_PROJECT}'.`);
console.log(`[seed-fixtures] GUARD 1 passed — key bound to ${STAGING_PROJECT}.`);

const admin = require('../../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(keyJson), projectId: STAGING_PROJECT });
const resolvedProject = admin.app().options.projectId || keyJson.project_id;
if (resolvedProject !== STAGING_PROJECT) abort(`resolved Admin project is '${resolvedProject}'.`);
console.log(`[seed-fixtures] GUARD 2 passed — Admin app project is ${resolvedProject}.`);

const db = admin.firestore();
const auth = admin.auth();
const { Timestamp, FieldValue } = admin.firestore;
const T = db.collection('tenants').doc(TENANT_ID);

const now = () => Timestamp.now();
const tsAt = (dateStr, hh = 22) => Timestamp.fromDate(new Date(`${dateStr}T${String(hh).padStart(2, '0')}:00:00Z`)); // ~6pm TT
const daysAgoTs = (n, hh = 14) => tsAt(addDays(TODAY, -n), hh);

let writes = 0;
async function put(ref, data, label) {
  await ref.set(data);
  writes += 1;
  console.log(`  [set] ${label}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  // Resolve canonical uids from Auth (never hardcoded).
  const uid = {};
  for (const [k, email] of Object.entries(EMAILS)) {
    if (k === 'cro') continue; // handled in section 11 (may need creation)
    const u = await auth.getUserByEmail(email).catch(() => null);
    if (!u) abort(`required auth user absent: ${email} — run seed-staging.mjs --apply first.`);
    uid[k] = u.uid;
  }
  console.log(`[seed-fixtures] uids resolved: a1=${uid.a1} a2=${uid.a2} um=${uid.um} bm=${uid.bm} ta=${uid.ta}`);

  // ── 11 (early). CRO user — idempotent re-seed (auth + claims + user doc) ──
  console.log('\n── A11: CRO account ──');
  const croPassword = process.env.STAGING_SEED_PASSWORD || CRO_PASSWORD_FALLBACK;
  let cro = await auth.getUserByEmail(EMAILS.cro).catch(() => null);
  if (!cro) {
    cro = await auth.createUser({ email: EMAILS.cro, password: croPassword, displayName: NAMES.cro });
    console.log(`  [auth] created cro ${cro.uid}`);
  } else {
    // Password sync on every run (mirrors seed-staging.mjs) so the account
    // always matches STAGING_SEED_PASSWORD in .env.staging.
    await auth.updateUser(cro.uid, { password: croPassword });
  }
  await auth.setCustomUserClaims(cro.uid, { role: 'cro', tenantId: TENANT_ID, ownedBranchIds: ['*'] });
  uid.cro = cro.uid;
  await put(T.collection('users').doc(uid.cro), {
    uid: uid.cro, role: 'cro', tenantId: TENANT_ID, name: NAMES.cro, email: EMAILS.cro, active: true,
  }, `users/${uid.cro} (cro)`);

  // ── Cleanup: orphan user docs (same synthetic email, wrong doc id) ──
  console.log('\n── Cleanup: orphan user docs ──');
  const allEmails = Object.values(EMAILS);
  const usersSnap = await T.collection('users').get();
  for (const d of usersSnap.docs) {
    const em = d.data().email;
    if (allEmails.includes(em) && !Object.values(uid).includes(d.id)) {
      await d.ref.delete();
      console.log(`  [del] users/${d.id} — orphan doc for ${em} (no auth backing)`);
    }
  }

  // ── A1. Submissions ──
  console.log('\n── A1: submissions ──');
  const subBody = (api, apps, strong) => ({
    version: 2,
    newBusiness: { apps, api },
    pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums: { grossAmount: 0, apiCredit: 0, commission: 0 },
    totalProductionCredit: api,
    totalCommission: Math.round(api * 0.3),
    // prospecting
    prospectingLettersSent: strong ? 10 : 2, f2fAttempts: strong ? 25 : 6, f2fContacts: strong ? 15 : 3,
    namesFromColdCanvass: strong ? 5 : 1, referralsObtained: strong ? 8 : 1,
    seminarsConducted: 0, namesFromSeminarsConducted: 0, tradeshowsAttended: 0, namesFromTradeshowsAttended: 0,
    namesFromOther: strong ? 2 : 0,
    // telephone
    referralCalls: strong ? 15 : 3, followUpCalls: strong ? 10 : 2, coldCalls: strong ? 40 : 10,
    seminarTradeshowCalls: strong ? 5 : 0, serviceCalls: strong ? 5 : 1,
    telContacts: strong ? 45 : 8, appointmentsSet: strong ? 18 : 3, qualifiedApproaches: strong ? 20 : 4,
    // interviews
    ffisScheduled: strong ? 12 : 3, ffiConducted: strong ? 10 : 2, solutionPresentations: strong ? 8 : 1,
    newCIBooked: strong ? 6 : 1, oldCIBooked: strong ? 4 : 0, ciConducted: strong ? 10 : 1,
    // sales/service
    livesSold: apps, policiesDelivered: strong ? 1 : 0, serviceContacts: strong ? 3 : 1, hasServiceWork: true,
    officeHours: strong ? 15 : 8, fieldHours: strong ? 25 : 6,
    // self-evaluation
    ratingPlanning: strong ? 4 : 2, ratingTimeManagement: strong ? 4 : 2, ratingSalesPerformance: strong ? 4 : 2,
    ratingProspecting: strong ? 4 : 2, ratingOverall: strong ? 4 : 2,
    notes: '',
    // goals block
    targetDials: 60, targetTelContacts: 40, targetF2FAttempts: 25, targetFFI: 10, targetCI: 10,
    targetAppsSold: strong ? 2 : 1, targetAPI: strong ? 12000 : 5000, goalNotes: '',
    // social
    socialPostsTotal: strong ? 3 : 0, socialEngagementTotal: strong ? 40 : 0, socialInboxEnquiries: strong ? 2 : 0,
    namesFromSocial: strong ? 3 : 0,
    socialPlatformBreakdown: { facebook: strong ? 2 : 0, instagram: strong ? 1 : 0, whatsapp: 0, linkedin: 0 },
    daysWorked: strong ? 5 : 3, weekendWorked: false, weekendApi: null,
  });
  const seedSub = async (who, name, unitId, weeks, strong) => {
    for (const { w, api, apps } of weeks) {
      const ws = W(w);
      const id = `${who}_${ws}`;
      await put(T.collection('submissions').doc(id), {
        userId: who, agentId: who, agentName: name, unitId, branchId: BRANCH_ID,
        weekStarting: ws, status: 'submitted',
        updatedAt: tsAt(addDays(ws, 5)), submittedAt: tsAt(addDays(ws, 5)),
        ...subBody(api, apps, strong),
      }, `submissions/${id} api=${api} apps=${apps}`);
    }
  };
  await seedSub(uid.a1, NAMES.a1, uid.um, A1_WEEKS, true);
  await seedSub(uid.a2, NAMES.a2, uid.um, A2_WEEKS, false);
  await seedSub(uid.um, NAMES.um, uid.um, UM_WEEKS, true);
  await seedSub(uid.bm, NAMES.bm, '__branch_direct__', BM_WEEKS, true);
  // A1 this-week DRAFT (Master Sheet draft-exception + daily anchor WTD).
  await put(T.collection('submissions').doc(`${uid.a1}_${W0}`), {
    userId: uid.a1, agentId: uid.a1, agentName: NAMES.a1, unitId: uid.um, branchId: BRANCH_ID,
    weekStarting: W0, status: 'draft', updatedAt: now(),
    ...subBody(3000, 1, true),
  }, `submissions/${uid.a1}_${W0} DRAFT api=3000`);

  // ── A1b. Daily capture — A1 dailyActivity docs for this week's elapsed
  // weekdays (Mon..yesterday, Sundays never logged). Drives the DailyAnchorStrip
  // WTD (sumWeekApi over newBusiness.api) + count-strip chips + streak.
  // NOTE: computeStreak is week-scoped and skips Sundays, so max streak = 6 and
  // the 5-day milestone is only reachable Fri/Sat (10/20 milestones are
  // unreachable dead config — banked VH finding).
  console.log('\n── A1b: daily activity (agent-1, this week) ──');
  const DAY_API = { 1: 800, 2: 1200, 3: 1000, 4: 900, 5: 600, 6: 500 }; // Mon..Sat
  {
    const todayD = new Date(`${TODAY}T12:00:00Z`);
    for (let dow = 1; dow < todayD.getUTCDay(); dow++) {  // strictly before today, skip Sun(0)
      const date = addDays(W0, dow);
      const api = DAY_API[dow];
      await put(T.collection('users').doc(uid.a1).collection('dailyActivity').doc(date), {
        version: 1, weeklyReportVersion: 2,
        date, weekStarting: W0, agentId: uid.a1, agentName: NAMES.a1,
        prospectingLettersSent: 1, seminarsConducted: 0, dials: 12, telContacts: 8,
        f2fAttempts: 4, qualifiedApproaches: 3,
        socialPostsTotal: 1, socialEngagementTotal: 6, socialInboxEnquiries: 0, namesFromSocial: 0,
        socialPlatformBreakdown: { facebook: 1, instagram: 0, whatsapp: 0, linkedin: 0 },
        appointmentsSet: 2, ffisScheduled: 2, ffiConducted: 1, solutionPresentations: 1,
        newCIBooked: 1, oldCIBooked: 0, ciConducted: 1,
        newBusiness: { apps: dow === 2 ? 1 : 0, api }, pppIncreases: { apps: 0, apiIncrease: 0 },
        lumpsums: { grossAmount: 0 }, livesSold: dow === 2 ? 1 : 0,
        policiesDelivered: 0, serviceContacts: 1,
        newNamesAdded: 2, oldNamesWorked: 1,
        officeHours: 3, fieldHours: 5,
        hoursWorked: null, wins: '', blockers: '', notes: 'VH fixture',
        isCatchUp: false, catchUpStartDate: null, catchUpEndDate: null,
        createdAt: tsAt(date, 23), updatedAt: tsAt(date, 23),
      }, `users/${uid.a1}/dailyActivity/${date} api=${api}`);
    }
  }

  // ── A2. WARs ──
  console.log('\n── A2: manager weekly reports ──');
  const warDoc = (who, name, role, rank, weekStart, status, vals) => ({
    managerId: who, managerName: name, tenantId: TENANT_ID, weekStart,
    managerRole: role, managerRoleRank: rank,
    branchId: BRANCH_ID, unitId: role === 'unit_manager' ? who : null,
    oneOnOnesConducted: vals.o, namesSourced: vals.n, interviewsConducted: vals.i,
    recruitsInFirstWeeks: vals.r, trainingSessions: vals.t, trainingTopic: vals.topic,
    unitMeetingHeld: vals.meet, attendanceCount: vals.meet ? vals.att : null,
    dashboardReviewDone: true, jfwCount: 0,
    status, createdAt: tsAt(weekStart, 12), updatedAt: tsAt(addDays(weekStart, 4)),
    ...(status === 'submitted' ? { submittedAt: tsAt(addDays(weekStart, 4)) } : {}),
  });
  await put(T.collection('managerWeeklyReports').doc(`${uid.um}_${W(-2)}`),
    warDoc(uid.um, NAMES.um, 'unit_manager', 1, W(-2), 'submitted', { o: 3, n: 5, i: 2, r: 1, t: 2, topic: 'Objection handling', meet: true, att: 8 }),
    `WAR um ${W(-2)} submitted`);
  await put(T.collection('managerWeeklyReports').doc(`${uid.um}_${W(-1)}`),
    warDoc(uid.um, NAMES.um, 'unit_manager', 1, W(-1), 'submitted', { o: 4, n: 6, i: 3, r: 1, t: 1, topic: 'Fact-find depth', meet: true, att: 9 }),
    `WAR um ${W(-1)} submitted`);
  await put(T.collection('managerWeeklyReports').doc(`${uid.bm}_${W(-1)}`),
    warDoc(uid.bm, NAMES.bm, 'branch_manager', 2, W(-1), 'submitted', { o: 5, n: 8, i: 4, r: 2, t: 2, topic: 'Pipeline review', meet: true, att: 14 }),
    `WAR bm ${W(-1)} submitted`);
  await put(T.collection('managerWeeklyReports').doc(`${uid.bm}_${W0}`),
    warDoc(uid.bm, NAMES.bm, 'branch_manager', 2, W0, 'draft', { o: 1, n: 2, i: 1, r: 0, t: 0, topic: '', meet: false, att: 0 }),
    `WAR bm ${W0} draft`);

  // ── A3. Goals + companyMinimums + plans ──
  console.log('\n── A3: goals hierarchy + plans ──');
  // Explicit companyMinimums => deterministic floors for smoke math.
  await put(T.collection('config').doc('companyMinimums'), {
    annualAPI: 200000, annualApps: 42, persistency: 90,
    weeklyActivityFloors: {
      callsMade: 60, telContacts: 40, appointmentsScheduled: 20, interviewsKept: 15,
      factFindsCompleted: 10, closingInterviewsKept: 10, applicationsSubmitted: 1,
      clientsSold: 1, api: 4800, referralsNewLeads: 100,
    },
    tenureApiFloors: {
      band0_lt12: 150000, band12_to_24: 200000, band25_to_36: 250000,
      band37_to_48: 300000, band49_to_60: 400000, band_gt60: 500000,
    },
    workingDaysPerWeek: 5,
    updatedBy: uid.ta, updatedAt: now(),
  }, 'config/companyMinimums');
  await put(T.collection('goals').doc(uid.a1), {
    agentId: uid.a1, tenantId: TENANT_ID, setBy: uid.a1, setByName: NAMES.a1, updatedAt: now(),
    personalAnnualAPI: 250000, personalAnnualApps: 50, personalAnnualPersistency: 92,
    targetAnnualAPI: 260000, targetAnnualApps: 52, targetAnnualPersistency: 90,
    targetWeeklyAPI: 5000, targetWeeklyApps: 1, targetWeeklyDials: 60, targetWeeklyFFI: 10,
    targetLocked: false, notes: 'VH fixture targets',
  }, `goals/${uid.a1}`);
  await put(T.collection('goals').doc(uid.a2), {
    agentId: uid.a2, tenantId: TENANT_ID, setBy: uid.a2, setByName: NAMES.a2, updatedAt: now(),
    personalAnnualAPI: 250000, personalAnnualApps: 42, personalAnnualPersistency: 90,
  }, `goals/${uid.a2}`);
  await put(T.collection('unitGoals').doc(`${uid.um}_${YEAR}`), {
    unitId: uid.um, year: Number(YEAR), tenantId: TENANT_ID, api: 600000, apps: 120,
    ffiConducted: 200, ciConducted: 120, dials: 4000,
    locked: false, setBy: uid.um, setByName: NAMES.um, setByRole: 'unit_manager', setAt: now(),
  }, `unitGoals/${uid.um}_${YEAR}`);
  await put(T.collection('branchGoals').doc(YEAR), {
    year: Number(YEAR), tenantId: TENANT_ID, api: 1500000, apps: 300,
    ffiConducted: 500, ciConducted: 300, dials: 10000,
    locked: false, setBy: uid.bm, setByName: NAMES.bm, setAt: now(),
  }, `branchGoals/${YEAR}`);
  // Game-plan hub docs (AllocationBar/MiniMonthStrip) — A1 + producing UM.
  const lines = (life, ah, general, rateL = 30) => ({
    life:    { targetAPI: life,    pct: Math.round((life / (life + ah + general)) * 100),    derivedApps: Math.round(life / 5000),    derivedCommission: Math.round(life * rateL / 100), enabled: true, rate: rateL, products: [] },
    ah:      { targetAPI: ah,      pct: Math.round((ah / (life + ah + general)) * 100),      derivedApps: Math.round(ah / 5000),      derivedCommission: Math.round(ah * 0.25),          enabled: true, rate: 25,    products: [] },
    general: { targetAPI: general, pct: Math.round((general / (life + ah + general)) * 100), derivedApps: Math.round(general / 5000), derivedCommission: Math.round(general * 0.20),     enabled: true, rate: 20,    products: [] },
  });
  const planPair = async (who, total, split) => {
    await put(T.collection('users').doc(who).collection('yearPlan').doc(YEAR), {
      year: Number(YEAR), tenantId: TENANT_ID, uid: who, licenseProfile: 'composite',
      status: 'committed', committedAt: tsAt(`${YEAR}-01-15`),
      lines: lines(...split),
      createdAt: tsAt(`${YEAR}-01-10`), updatedAt: now(),
    }, `users/${who}/yearPlan/${YEAR} committed total=${total}`);
    await put(T.collection('users').doc(who).collection('monthlyPlan').doc(YEAR), {
      year: Number(YEAR), tenantId: TENANT_ID, uid: who,
      targets: Array(12).fill(Math.round(total / 12)), split: 'even',
      status: 'committed', committedAt: tsAt(`${YEAR}-01-15`), anchorAPI: total,
      createdAt: tsAt(`${YEAR}-01-10`), updatedAt: now(),
    }, `users/${who}/monthlyPlan/${YEAR}`);
  };
  await planPair(uid.a1, 250000, [150000, 50000, 50000]);
  await planPair(uid.um, 150000, [100000, 20000, 30000]);
  // Weekly plan for A1 current week (daily-capture/plan-variance surface).
  // NOTE: service PLAN_METRIC_KEYS uses 'telContacts'; firestore.rules
  // validPlanWrite requires 'contactsMade' — known drift, flagged in the VH
  // checklist. Seeding the SERVICE shape (what the app reads).
  await put(T.collection('weeklyPlans').doc(`${uid.a1}_${W0}`), {
    agentId: uid.a1, tenantId: TENANT_ID,
    weekStart: Timestamp.fromDate(new Date(`${W0}T04:00:00Z`)),
    targets:    { callsMade: 60, telContacts: 40, factFindsCompleted: 10, closingInterviewsKept: 10, applicationsSubmitted: 1 },
    provenance: { callsMade: 'derived', telContacts: 'derived', factFindsCompleted: 'derived', closingInterviewsKept: 'derived', applicationsSubmitted: 'floor' },
    anchorAPIAtCommit: 250000, committedAt: tsAt(W0, 12), updatedAt: now(),
  }, `weeklyPlans/${uid.a1}_${W0}`);

  // ── A4. Financing ──
  console.log('\n── A4: financing terms + ledger ──');
  const terms = (who, agreed, current, vapi, eff) => ({
    agentId: who, tenantId: TENANT_ID,
    agreedMonthlyFinancing: agreed, currentMonthlyFinancing: current, validatingAPI: vapi,
    effectiveDate: eff, financingStatus: 'on_financing',
    statusHistory: [{ from: 'not_on_financing', to: 'on_financing', at: now(), by: uid.bm, byName: NAMES.bm, role: 'branch_manager' }],
    createdAt: tsAt(eff, 12), createdBy: uid.bm, updatedAt: now(), updatedBy: uid.bm,
  });
  await put(T.collection('financingTerms').doc(uid.a1), terms(uid.a1, 5000, 5000, 15000, `${YEAR}-01-01`), `financingTerms/${uid.a1}`);
  await put(T.collection('financingTerms').doc(uid.a2), terms(uid.a2, 4000, 3500, 12000, `${YEAR}-02-01`), `financingTerms/${uid.a2}`);
  const ledgerRow = (who, mk, extra) => ({
    agentId: who, tenantId: TENANT_ID, month: mk.replace('-', '_'),
    financingPaid: extra.paid, netCommission: extra.net, bonusOffset: 0, runningBalance: extra.bal,
    notes: '', source: 'manager_entry',
    enteredBy: uid.bm, enteredByName: NAMES.bm, enteredAt: tsAt(`${mk}-28`, 12), updatedAt: now(),
    ...(extra.pror ? {
      validatingAPI: extra.pror.v, actualAPI: extra.pror.a, suggestedFinancing: extra.pror.s,
      basisSource: extra.pror.basis,
      prorationUpdatedAt: now(), prorationUpdatedBy: uid.bm,
      prorationEnteredBy: uid.bm, prorationEnteredByName: NAMES.bm, prorationEnteredAt: tsAt(`${mk}-28`, 12),
      ...(extra.pror.mgr !== undefined ? { managerFinancing: extra.pror.mgr, adjustmentPct: extra.pror.adj } : {}),
    } : {}),
  });
  // A1: 6 months declining (arc + projection). Latest balance 11000, rate ~3800/mo.
  const a1Bal = [30000, 26000, 22000, 18500, 14800, 11000];
  for (let i = 0; i < 6; i++) {
    const mk = monthKeyOffset(6 - i);
    const pror = i >= 3 ? { v: 15000, a: [16200, 15800, 16400][i - 3], s: 5000, basis: 'submitted-final' } : null;
    await put(T.collection('financing').doc(`${uid.a1}_${mk.replace('-', '_')}`),
      ledgerRow(uid.a1, mk, { paid: 5000, net: 8800, bal: a1Bal[i], pror }),
      `financing/${uid.a1}_${mk.replace('-', '_')} bal=${a1Bal[i]}${pror ? ' MEET' : ''}`);
  }
  // A2: 4 months; last two are confirmed MISSes (amber) + 15% adjustment flag.
  const a2Rows = [
    { mk: monthKeyOffset(4), bal: 16000, pror: null },
    { mk: monthKeyOffset(3), bal: 17200, pror: { v: 12000, a: 12500, s: 3500, basis: 'submitted-final' } }, // MEET
    { mk: monthKeyOffset(2), bal: 18100, pror: { v: 12000, a: 8000, s: 2800, basis: 'submitted-final' } },  // MISS 1
    { mk: monthKeyOffset(1), bal: 19000, pror: { v: 12000, a: 9500, s: 3000, basis: 'submitted-final', mgr: 3000, adj: 0.15 } }, // MISS 2 + >10% adj
  ];
  for (const r of a2Rows) {
    await put(T.collection('financing').doc(`${uid.a2}_${r.mk.replace('-', '_')}`),
      ledgerRow(uid.a2, r.mk, { paid: 3500, net: 1800, bal: r.bal, pror: r.pror }),
      `financing/${uid.a2}_${r.mk.replace('-', '_')} bal=${r.bal}`);
  }

  // ── A5. Policies ──
  console.log('\n── A5: policies ──');
  const policy = (id, who, agentNo, base) => put(T.collection('policies').doc(id), {
    tenantId: TENANT_ID, agentId: who, agentNumber: agentNo,
    unitId: who === uid.bm ? '__branch_direct__' : uid.um, branchId: BRANCH_ID,
    ownerName: base.owner, insuredName: base.owner, policyNumber: base.pn ?? null,
    productLine: 'life', newBusinessType: 'nb_ordinary', policyClass: base.cls ?? 'whole_life',
    planId: null, planName: null,
    proposedPremium: base.prem, proposedFrequency: 'M', proposedAPI: base.papi, proposedCoverage: base.papi * 15,
    dateWritten: daysAgoTs(base.writtenDaysAgo), dateSubmitted: daysAgoTs(base.writtenDaysAgo),
    notes: '', isSelfOrFamily: false, sourceOfProspect: base.src ?? 'referral',
    ...(base.src === 'social-media' ? { socialPlatform: 'facebook' } : {}),
    cashWithApp: { collected: false, amount: null },
    status: base.status, statusDate: daysAgoTs(base.statusDaysAgo ?? base.writtenDaysAgo), statusUpdatedAt: daysAgoTs(base.statusDaysAgo ?? base.writtenDaysAgo),
    ...(base.issuedDaysAgo !== undefined ? {
      dateIssued: daysAgoTs(base.issuedDaysAgo), settledAPI: base.sapi ?? base.papi,
      issuedCoverage: (base.sapi ?? base.papi) * 15, initialPremium: base.prem, earnedCommission: Math.round((base.sapi ?? base.papi) * 0.3),
    } : { }),
    policyDeliveryDate: base.deliveredDaysAgo !== undefined ? daysAgoTs(base.deliveredDaysAgo) : null,
    ...(base.deliveredDaysAgo !== undefined ? { deliveredBy: uid.cro, deliveredAt: daysAgoTs(base.deliveredDaysAgo) } : {}),
    ...(base.lapsedDaysAgo !== undefined ? { dateLapsed: daysAgoTs(base.lapsedDaysAgo), lapseReason: 'Non-payment' } : {}),
    createdAt: daysAgoTs(base.writtenDaysAgo), createdBy: who,
  }, `policies/${id} ${base.status}${base.issuedDaysAgo !== undefined ? ` issued-${base.issuedDaysAgo}d` : ''}${base.deliveredDaysAgo !== undefined ? ' delivered' : ''}`);
  // A1: clawback tone spread (30-day clock from dateIssued; at-risk ≤7 left, overdue <0).
  await policy('vhfix-pol-a1-within',   uid.a1, 'A1-001', { owner: 'Cheryl Gonzales', prem: 450, papi: 7200, sapi: 7200, status: 'settled', writtenDaysAgo: 20, statusDaysAgo: 5,  issuedDaysAgo: 5,  pn: 'VH-1001' });
  await policy('vhfix-pol-a1-atrisk',   uid.a1, 'A1-001', { owner: 'Dexter Williams', prem: 340, papi: 5400, sapi: 5400, status: 'settled', writtenDaysAgo: 40, statusDaysAgo: 26, issuedDaysAgo: 26, pn: 'VH-1002' });
  await policy('vhfix-pol-a1-overdue',  uid.a1, 'A1-001', { owner: 'Sunita Ragoo',    prem: 300, papi: 4800, sapi: 4800, status: 'settled', writtenDaysAgo: 55, statusDaysAgo: 40, issuedDaysAgo: 40, pn: 'VH-1003' });
  await policy('vhfix-pol-a1-delivered',uid.a1, 'A1-001', { owner: 'Brent Charles',   prem: 500, papi: 8000, sapi: 8000, status: 'settled', writtenDaysAgo: 35, statusDaysAgo: 20, issuedDaysAgo: 20, deliveredDaysAgo: 10, pn: 'VH-1004' });
  await policy('vhfix-pol-a1-inflight', uid.a1, 'A1-001', { owner: 'Natalie Joseph',  prem: 400, papi: 6600, status: 'submitted', writtenDaysAgo: 3, src: 'social-media', pn: null });
  await policy('vhfix-pol-a2-within',   uid.a2, 'A2-001', { owner: 'Ricardo Lewis',   prem: 260, papi: 4100, sapi: 4100, status: 'settled', writtenDaysAgo: 25, statusDaysAgo: 12, issuedDaysAgo: 12, pn: 'VH-2001' });
  await policy('vhfix-pol-a2-inflight', uid.a2, 'A2-001', { owner: 'Avinash Sharma',  prem: 220, papi: 3600, status: 'submitted', writtenDaysAgo: 6, pn: null });
  await policy('vhfix-pol-a2-lapsed',   uid.a2, 'A2-001', { owner: 'Gemma Pierre',    prem: 280, papi: 4500, sapi: 4500, status: 'lapsed', writtenDaysAgo: 120, statusDaysAgo: 15, issuedDaysAgo: 100, lapsedDaysAgo: 15, pn: 'VH-2002' });

  // ── A6. Persistency (E3) ──
  console.log('\n── A6: persistency ──');
  const e3 = async (who, inputs, mk) => {
    const gross = (inputs.businessPlaced - inputs.notTakens) + inputs.incPPPs + (inputs.lumpsums100 * 0.10);
    const net = gross - inputs.lapses + inputs.reinstatements;
    const pers = gross > 0 ? net / gross : 0;
    const [y, m] = mk.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 12, 1)); // 12-month rolling window
    const end = new Date(Date.UTC(y, m, 0));
    await put(T.collection('persistency').doc(`${who}_${mk.replace('-', '_')}`), {
      agentId: who, tenantId: TENANT_ID, year: y, month: m, monthKey: mk,
      reportPeriodStart: ymd(start), reportPeriodEnd: ymd(end),
      ...inputs,
      grossSettled: gross, netSettled: net, persistency: pers,
      meetsAwardGate: pers >= 0.90,
      enteredAt: tsAt(`${mk}-28`, 12), enteredBy: uid.bm, enteredByRole: 'branch_manager',
      lastEditedAt: now(), lastEditedBy: uid.bm, lastEditedByRole: 'branch_manager',
    }, `persistency/${who}_${mk.replace('-', '_')} ${(pers * 100).toFixed(1)}%`);
  };
  for (const mk of E3_MONTHS) { await e3(uid.a1, A1_E3, mk); await e3(uid.a2, A2_E3, mk); }

  // ── A7. Campaigns ──
  console.log('\n── A7: campaigns ──');
  const campaignDoc = (c) => ({
    name: c.name, description: c.description, prize: c.prize,
    startDate: c.startDate, endDate: c.endDate,
    scope: { type: 'branch', unitIds: [], agentIds: [] },
    targets: c.targets, status: c.status,
    kiosk: c.kiosk, meeting: c.meeting, countsTowardAwards: c.countsTowardAwards,
    structure: c.structure, standingsMetric: c.standingsMetric,
    ...(c.persistencyGateEnabled !== undefined ? { persistencyGateEnabled: c.persistencyGateEnabled } : {}),
    ...(c.tiers ? { tiers: c.tiers } : {}), ...(c.placements ? { placements: c.placements } : {}),
    tenantId: TENANT_ID, createdBy: uid.bm, createdByName: NAMES.bm, createdByRole: 'branch_manager',
    createdAt: tsAt(c.startDate, 12), updatedAt: now(),
  });
  await put(T.collection('campaigns').doc(CAMP_QUALIFY.id), campaignDoc(CAMP_QUALIFY), `campaigns/${CAMP_QUALIFY.id} (${CAMP_QUALIFY.startDate}..${CAMP_QUALIFY.endDate})`);
  await put(T.collection('campaigns').doc(CAMP_PLACEMENT.id), campaignDoc(CAMP_PLACEMENT), `campaigns/${CAMP_PLACEMENT.id} (${CAMP_PLACEMENT.startDate}..${CAMP_PLACEMENT.endDate})`);

  // ── A8. Recruiting ──
  console.log('\n── A8: recruiting candidates ──');
  for (const r of RECRUITS) {
    const ownerUid = uid[r.owner];
    await put(T.collection('recruitingCandidates').doc(r.id), {
      tenantId: TENANT_ID, branchId: BRANCH_ID,
      ownerUid, ownerName: NAMES[r.owner],
      name: r.name, stage: r.stage, status: 'active',
      source: r.source, referrerName: r.source === 'referral' ? 'Existing client' : '',
      note: r.stage === 'interview' && r.daysInStage > 14 ? 'VH fixture — stalled candidate' : 'VH fixture',
      stageChangedAt: daysAgoTs(r.daysInStage), lastTouchAt: daysAgoTs(Math.min(r.daysInStage, 2)),
      createdAt: daysAgoTs(r.daysInStage + 10), updatedAt: now(),
      ...(r.licensed ? { licensedAt: daysAgoTs(r.daysInStage) } : {}),
    }, `recruitingCandidates/${r.id} ${r.stage}${r.daysInStage > 14 && r.stage !== 'licensed' ? ' STALLED' : ''}`);
  }

  // ── A9. Appointments (A1 planner week) ──
  console.log('\n── A9: appointments ──');
  const appt = (id, base) => put(T.collection('appointments').doc(id), {
    tenantId: TENANT_ID, agentId: uid.a1, agentUnitId: uid.um, agentBranchId: BRANCH_ID,
    date: base.date, startTime: base.t, durationMin: base.dur ?? 30,
    type: base.type, status: base.status ?? 'scheduled', note: base.note ?? 'VH fixture',
    ...(base.prospectId ? { prospectId: base.prospectId } : {}),
    ...(base.type === 'FREE' ? { freeBlockLabel: base.label ?? 'Prospecting time' } : {}),
    ...(base.api !== undefined ? { apiAmount: base.api } : {}),
    ...(base.rescheduledToId ? { rescheduledToId: base.rescheduledToId } : {}),
    createdAt: daysAgoTs(2), updatedAt: now(),
  }, `appointments/${id} ${base.date} ${base.t} ${base.type} ${base.status ?? 'scheduled'}`);
  // Today: mixed types incl. FFI/CI/PC + free block + a kept SALE.
  await appt('vhfix-appt-t1', { date: TODAY, t: '09:00', type: 'PC' });
  await appt('vhfix-appt-t2', { date: TODAY, t: '10:30', dur: 60, type: 'FFI', status: 'confirmed', prospectId: 'vhfix-pp-today' });
  await appt('vhfix-appt-t3', { date: TODAY, t: '12:00', dur: 60, type: 'FREE', label: 'Prospecting time' });
  await appt('vhfix-appt-t4', { date: TODAY, t: '14:00', dur: 60, type: 'CI', prospectId: 'vhfix-pp-today' });
  await appt('vhfix-appt-t5', { date: TODAY, t: '16:00', dur: 45, type: 'SALE', status: 'kept', api: 8000 });
  // Rest of week.
  await appt('vhfix-appt-d1a', { date: addDays(TODAY, 1), t: '09:30', dur: 60, type: 'FFI', prospectId: 'vhfix-pp-tomorrow' });
  await appt('vhfix-appt-d1b', { date: addDays(TODAY, 1), t: '11:00', type: 'PC' });
  await appt('vhfix-appt-d2a', { date: addDays(TODAY, 2), t: '10:00', dur: 60, type: 'CI' });
  await appt('vhfix-appt-d2b', { date: addDays(TODAY, 2), t: '15:00', dur: 45, type: 'AI' });
  await appt('vhfix-appt-d3a', { date: addDays(TODAY, 3), t: '09:00', type: 'PC' });
  await appt('vhfix-appt-d3b', { date: addDays(TODAY, 3), t: '13:00', type: 'SC' });
  // Postponed-with-rebook pair (original postponed yesterday -> new at +2d).
  await appt('vhfix-appt-rebook-new', { date: addDays(TODAY, 2), t: '13:30', dur: 60, type: 'CI', note: 'Rebooked from postponed slot' });
  await appt('vhfix-appt-rebook-old', { date: addDays(TODAY, -1), t: '10:00', dur: 60, type: 'CI', status: 'postponed', rescheduledToId: 'vhfix-appt-rebook-new', note: 'Client requested move' });

  // ── A10. Prospect preps (users/{a1}/prospectInfo subcollection) ──
  console.log('\n── A10: prospect preps ──');
  const pp = (id, base) => put(T.collection('users').doc(uid.a1).collection('prospectInfo').doc(id), {
    agentId: uid.a1, tenantId: TENANT_ID, agentUnitId: uid.um, createdBy: uid.a1,
    clientName: base.name, clientAge: base.age, clientOccupation: base.occ,
    prospectingSource: base.src, socialPlatform: base.src === 'social-media' ? 'facebook' : null,
    appointmentType: base.at, objections: base.obj, policyType: base.pt,
    intendedAppointmentDate: base.date,
    createdAt: daysAgoTs(6), updatedAt: now(),
  }, `prospectInfo/${id} ${base.date} ${base.pt || 'UNPREPPED'}`);
  await pp('vhfix-pp-today',    { name: 'Marsha Toussaint', age: 34, occ: 'Teacher',    src: 'referral',        at: 'closing-interview', pt: 'whole-life',    obj: ['no-money', 'no-hurry'], date: TODAY });
  await pp('vhfix-pp-tomorrow', { name: 'Devon Ramkissoon', age: 41, occ: 'Contractor', src: 'existing-client', at: '2nd-interview',     pt: 'term-life',     obj: ['no-need'],              date: addDays(TODAY, 1) });
  await pp('vhfix-pp-upcoming', { name: 'Alicia Charles',   age: 29, occ: 'Nurse',      src: 'cold-call',       at: '2nd-interview',     pt: '',              obj: [],                       date: addDays(TODAY, 4) });
  await pp('vhfix-pp-overdue',  { name: 'Kern Baptiste',    age: 52, occ: 'Retired',    src: 'orphan',          at: 'closing-interview', pt: 'final-expense', obj: ['no-confidence'],        date: addDays(TODAY, -3) });

  // ── A12. Feature flags (merge — preserves companyName/currency etc.) ──
  console.log('\n── A12: feature flags ──');
  await T.collection('config').doc('settings').set({
    featureFlags: { persistencyV2: true, policyLedgerCampaignLens: true, awardsProvenance: true },
  }, { merge: true });
  writes += 1;
  console.log('  [merge] config/settings.featureFlags = {persistencyV2, policyLedgerCampaignLens, awardsProvenance} all true');

  // ── Kiosk token (Tier-3 kiosk smoke) ──
  console.log('\n── kiosk token ──');
  await put(T.collection('kioskTokens').doc('vhfix-kiosk-token'), {
    tenantId: TENANT_ID, branchId: BRANCH_ID, label: 'VH run kiosk token',
    createdAt: now(), createdBy: uid.ta,
  }, 'kioskTokens/vhfix-kiosk-token');

  console.log(`\n[seed-fixtures] DONE — ${writes} docs written to ${STAGING_PROJECT}/tenants/${TENANT_ID}. Re-runnable (resets fixtures).`);
}

main().catch((err) => { console.error('[seed-fixtures] FATAL:', err); process.exit(1); });

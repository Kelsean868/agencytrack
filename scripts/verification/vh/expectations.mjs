/**
 * expectations.mjs — canonical hand-computed expectations for the VH smoke
 * suite, derived from scripts/staging/seed-fixtures.mjs. If the seed changes,
 * this file changes with it (single source of assertion truth).
 *
 * All dates recomputed at runtime with the SAME formulas as the seed
 * (TT = permanent UTC-4; weeks start Sunday), so suite + seed stay in lockstep
 * as long as the seed was re-run on the same TT day.
 */

const TT_OFFSET_MS = 4 * 3600 * 1000;
function ttNow() { return new Date(Date.now() - TT_OFFSET_MS); }
function ymd(d) { return d.toISOString().slice(0, 10); }
export const TODAY = ymd(ttNow());
export const YEAR = TODAY.slice(0, 4);
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
export const W0 = (() => { const n = ttNow(); return addDays(ymd(n), -n.getUTCDay()); })();
export const W = (k) => addDays(W0, k * 7);

// weekLabel — mirrors HistoryTab.jsx's own weekLabel() EXACTLY (src/components/
// submissions/HistoryTab.jsx:24-29: `Sun ${d.toLocaleDateString('en-TT', {
// day: '2-digit', month: 'short' })}`), so a leg can build the same
// `aria-label="Open submission from ${weekLabel(s)}"` selector the app renders,
// regardless of which calendar date W(k) resolves to on the day the suite runs.
export function weekLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.toLocaleDateString('en-TT', { day: '2-digit', month: 'short' });
  return `Sun ${day}`;
}

export const BASE = process.env.STAGING_BASE_URL
  || 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app';

const PASSWORD = process.env.STAGING_SEED_PASSWORD || 'ChangeMe-Staging-2026!';
export const ACCOUNTS = {
  agent1:         { email: 'staging-agent-1@agencytrack-staging.test',        password: PASSWORD, name: 'Staging Agent One' },
  agent2:         { email: 'staging-agent-2@agencytrack-staging.test',        password: PASSWORD, name: 'Staging Agent Two' },
  unit_manager:   { email: 'staging-unit-manager@agencytrack-staging.test',   password: PASSWORD, name: 'Staging Unit Manager' },
  branch_manager: { email: 'staging-branch-manager@agencytrack-staging.test', password: PASSWORD, name: 'Staging Branch Manager' },
  tenant_admin:   { email: 'staging-tenant-admin@agencytrack-staging.test',   password: PASSWORD, name: 'Staging Tenant Admin' },
  cro:            { email: 'staging-cro@agencytrack-staging.test',            password: PASSWORD, name: 'Staging CRO' },
  sales_manager:  { email: 'staging-sales-manager@agencytrack-staging.test',  password: PASSWORD, name: 'Staging Sales Manager' },
};

export const EXPECT = {
  // A1 submissions (extractFields path — totalProductionCredit)
  a1: {
    ytdApi: 122000,               // sum of 9 submitted weeks
    ytdApps: 22,
    bestWeekApi: 22000, bestWeekStarting: W(-5),
    submittedWeeks: 9,
    streakWeeks: 9,               // consecutive Sundays W(-9)..W(-1)
    awardWeeks: 9,                // every week >= weeklyFloorApi
    draftWeek: W0, draftApi: 3000,
    weeklyAvg: Math.round(122000 / 9), // 13,556 (display may round differently)
    lastWeekApi: 12500,           // W(-1)
  },
  a2: {
    ytdApi: 8500, ytdApps: 3,
    submittedWeeks: 3,
    exception: 'floor',           // danger — ratio 8500 / (250000*yearFraction) ≈ 0.065
    weeks: [{ w: W(-9), api: 2100 }, { w: W(-7), api: 3800 }, { w: W(-4), api: 2600 }],
  },
  weeklyFloorApi: 4800,
  tenureFloorAnnual: 250000,      // both agents: contractStartDate 2024-01-01 → band25_to_36

  // Persistency (E3)
  persistency: {
    a1Pct: 95,  a1Decimal: 20 / 21,   // 95.24% → ≥90 band, ×1.0, meets award gate
    a2Pct: 83,  a2Decimal: 15 / 18,   // 83.33% → 80-84 band, ×0.25
    months: 3,
  },

  // Campaigns (campaignEngine.computeStandings)
  qualify: {
    id: 'vhfix-camp-qualify', name: 'Staging Sprint — Qualify',
    a1Tier: 'Gold', a1ProjectedCash: 10000, a1ProjectedVoucher: 2500, // 122k/22 → Gold ×1.0
    a2Tier: null,                                                    // 8,500 < Bronze 30k
    window: { start: W(-9), end: addDays(W0, 27) },
  },
  placement: {
    id: 'vhfix-camp-placement', name: 'Staging Placement Dash',
    a1Rank: 1, a1ProjectedCash: 3000,   // 51,100 windowed × gate 1.0
    a2Rank: 2, a2ProjectedCash: 375,    // 2,600 windowed; 1500 × 0.25
    a1WindowedApi: 51100, a2WindowedApi: 2600,
  },

  // Financing
  financing: {
    a1NowBalance: 11000,           // latest ledger month
    a1BalancesAsc: [30000, 26000, 22000, 18500, 14800, 11000],
    a1HasProjection: true,         // declining, rate ≈ 3,800/mo → ~2.9 mo to zero
    a2Chip: 'At risk',             // 2 consecutive confirmed misses + 0.15 adj flag
    a2ConsecMisses: 2,
  },

  // Policies / CRO register (clawback from dateIssued, 30d clock, at-risk ≤7 left)
  cro: {
    // Counts assume a FRESH seed-fixtures run and no mark-delivered leg yet.
    // (Run-1's smoke-cro-delivery-1 is already delivered — probed 2026-07-09.)
    undeliveredCount: 4,   // vhfix a1-within / a1-atrisk / a1-overdue / a2-within
    deliveredCount: 2,     // vhfix-pol-a1-delivered + smoke-cro-delivery-1
    atRiskTabCount: 2,     // a1-atrisk (4 left) + a1-overdue (−10)
    overdueOwner: 'Sunita Ragoo', atRiskOwner: 'Dexter Williams',
    markDeliverableId: 'vhfix-pol-a2-within', markDeliverableOwner: 'Ricardo Lewis',
  },
  agentDeliveryStrip: { a1Undelivered: 3, a1AtRisk: 2 },
  lapsedOwner: 'Gemma Pierre',    // EXCLUDED from persistency/lens surfaces

  // Recruiting
  recruiting: {
    total: 9,                      // 8 vhfix active + 1 Run-1 archived (archived filtered out of active views)
    activeTotal: 8,
    stalledName: 'Nadia Mohammed', stalledStage: 'interview', // 20d in stage > 14d
    licensedName: 'Priya Sooknanan',
    advanceTarget: { name: 'Anil Maharaj', from: 'sourced', to: 'contacted' },
  },

  // Planner / appointments (agent-1)
  planner: {
    todayCount: 6,                 // 5 vhfix today + Run-1 crumb er5O5… (PC, dated 2026-07-09 — only counts if TODAY matches)
    todayVhfixCount: 5,
    freeBlockLabel: 'Prospecting time',
    saleApiAmount: 8000,
    postponedId: 'vhfix-appt-rebook-old', rebookId: 'vhfix-appt-rebook-new',
    rebookDate: addDays(TODAY, 2),
  },

  // Prospect preps (agent-1)
  prospect: {
    total: 4,
    todayName: 'Marsha Toussaint',       // prepped, closing-interview, whole-life, 2 objections
    tomorrowName: 'Devon Ramkissoon',
    unpreppedName: 'Alicia Charles',     // +4d, no policyType/objections
    overdueName: 'Kern Baptiste',        // −3d
    todayObjections: ['no-money', 'no-hurry'],
  },

  // WARs
  wars: {
    umSubmittedWeeks: [W(-2), W(-1)],   // BM-reviewable
    bmSubmittedWeek: W(-1),             // TA-reviewable
    bmDraftWeek: W0,
  },

  // Goals / plans
  goals: {
    a1PersonalAnnualAPI: 250000, unitApi: 600000, branchApi: 1500000,
    unitActivity: { ffiConducted: 200, ciConducted: 120, dials: 4000 },
    a1YearPlanTotal: 250000, a1MonthlyTarget: Math.round(250000 / 12), // 20,833
    umYearPlanTotal: 150000,
  },

  // Feature flags (all ON in staging per operator ruling)
  flags: { persistencyV2: true, policyLedgerCampaignLens: true, awardsProvenance: true },

  // Kiosk
  kiosk: { token: 'vhfix-kiosk-token', tenant: 'staging_test', podiumFirst: 'Staging Agent One' },

  prodProjectMarker: 'agencytrack-2a610', // must appear in ZERO network requests
};

// Daily capture (A1b seed family): WTD = sum of seeded dailyActivity
// newBusiness.api for this week's weekdays strictly before today (Sun skipped).
// Mirrors seed-fixtures.mjs DAY_API exactly.
export const DAY_API = { 1: 800, 2: 1200, 3: 1000, 4: 900, 5: 600, 6: 500 };
// A1b writes CONSECUTIVE weekdays starting Monday (dow=1): seed-fixtures.mjs's
// `for (dow=1; dow<todayD.getUTCDay(); dow++)` loop, so N seeded days always
// means "Mon..the Nth weekday" — never an arbitrary subset. Any run whose
// prior-week completed rollup shows N days logged (SundayConfirmView, or a
// re-seed on a non-Sunday day) can derive its expected API/apps sum from N
// alone, without knowing which literal day-of-week the seed ran on.
export function sumDayApiThrough(n) {
  let s = 0;
  for (let d = 1; d <= n; d++) s += DAY_API[d] || 0;
  return s;
}
// A1b's newBusiness.apps is 1 only on Tuesday (dow===2), else 0 — so the
// week-to-date apps sum is 1 once N>=2 seeded days, else 0.
export function appsThrough(n) { return n >= 2 ? 1 : 0; }
export const DAILY = (() => {
  const dow = new Date(`${TODAY}T12:00:00Z`).getUTCDay();
  let wtd = 0, days = 0;
  for (let d = 1; d < dow; d++) { wtd += DAY_API[d]; days += 1; }
  // Streak if the smoke logs today: elapsed weekdays + today (week-scoped).
  const streakAfterLoggingToday = dow === 0 ? 0 : days + 1;
  return { wtd, days, streakAfterLoggingToday, milestoneReachable: streakAfterLoggingToday >= 5 };
})();

// Game Plan hub — MiniMonthStrip month buckets (item 2.11's PlanCascade +
// planCascadeViz.miniMonthBuckets / monthlyPlanMath.bucketActualsByMonth).
// Mirrors seed-fixtures.mjs A1_WEEKS EXACTLY (submitted weeks only — the W0
// DRAFT is intentionally excluded here: bucketActualsByMonth sums whatever
// `submissions` array the dashboard fetched, and the 9 SUBMITTED weeks are the
// only amounts this suite can hand-verify independent of draft-inclusion
// behavior). W(k) shifts across month boundaries as TODAY advances, so which
// calendar month each week (and therefore each month-bucket's rank) lands in is
// NOT stable — it must be recomputed from W(k), never hardcoded to a specific
// month name/order.
const A1_WEEKS_API = [
  { w: -9, api: 11500 }, { w: -8, api: 12800 }, { w: -7, api: 11200 }, { w: -6, api: 13400 },
  { w: -5, api: 22000 }, { w: -4, api: 12600 }, { w: -3, api: 11800 }, { w: -2, api: 14200 },
  { w: -1, api: 12500 },
];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthIndexOf(dateStr) { return Number(dateStr.slice(5, 7)) - 1; } // 0-indexed, mirrors Date#getMonth()
export const A1_MONTH_BUCKETS = (() => {
  const buckets = Array(12).fill(0);
  for (const { w, api } of A1_WEEKS_API) buckets[monthIndexOf(W(w))] += api;
  return buckets;
})();
// Distinct month indices actually touched by the 9 submitted weeks, ranked by
// bucket total DESCENDING — the expected relative MiniMonthStrip bar-height
// order (whichever calendar months they land in this run).
export const A1_MONTH_ORDER = [...new Set(A1_WEEKS_API.map(({ w }) => monthIndexOf(W(w))))]
  .sort((a, b) => A1_MONTH_BUCKETS[b] - A1_MONTH_BUCKETS[a]);
export const A1_MONTH_ORDER_LABEL = A1_MONTH_ORDER
  .map((i) => `${MONTH_NAMES[i]} ${A1_MONTH_BUCKETS[i].toLocaleString('en-US')}`)
  .join(' > ');

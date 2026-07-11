// Company Config prototype — settings registry (data only, no UI).
// Every setting is data-driven so search, rendering, drafts and provenance
// all work off one source of truth.
//
// lock: 'platform' | 'soon' — temporary release states (everything here is
// on the path to editable). tier names when a 'soon' row unlocks.

const CCP_ADMIN = { name: 'Alicia Gopaul', initials: 'AG', role: 'Tenant admin', company: 'Tatil Life', users: 214 };
const CCP_TODAY = '11 Jul 2026';
const CCP_NEXT_EFF = '1 Aug 2026';
// Phase 1 ships first — everything else is designed ahead of its phase.
const CCP_PHASE1 = ['targets', 'activity', 'awards', 'flags'];

function ccpTTD(n) {
  if (n >= 1e6) return 'TTD ' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return 'TTD ' + (n / 1e3).toFixed(1) + 'K';
  return 'TTD ' + Math.round(n);
}

const CCP_GROUPS = [
  { g: 'Brand', keys: ['identity', 'org'] },
  { g: 'Standards', keys: ['targets', 'cadence', 'activity'] },
  { g: 'Recognition', keys: ['recognition', 'awards'] },
  { g: 'Operations', keys: ['financing', 'kiosk', 'policy'] },
  { g: 'Platform', keys: ['flags', 'data'] },
];

// item types: text | number | currency | seg | toggle | bands | points |
//             milestones | textchips
const CCP_SECTIONS = {
  identity: {
    label: 'Identity & Branding',
    blurb: 'How AgencyTrack presents your company — marks, contact details and portal preferences.',
    groups: [
      { title: 'BRAND MARKS', sub: 'Shown across the portal, printed reports and the kiosk.', items: [
        { id: 'id.logo', label: 'Organization logo', desc: 'PNG or SVG, square or wide. Used on the sidebar, reports and kiosk header.', type: 'upload', shape: 'wide', def: null },
        { id: 'id.favicon', label: 'Fav icon', desc: 'Browser-tab mark — square, 64×64 or larger.', type: 'upload', shape: 'tile', def: null },
      ]},
      { title: 'CONTACT INFO', items: [
        { id: 'id.name', label: 'Organization name', desc: 'Shown in the sidebar, reports and every exported document.', type: 'text', def: 'Tatil Life', w: 200 },
        { id: 'id.address', label: 'Address', desc: 'Appears on printed reports and statements.', type: 'text', def: '11A Maraval Road, Port of Spain', w: 300 },
        { id: 'id.code', label: 'Short code', desc: 'Prefixes policy references and export filenames.', type: 'text', def: 'TATIL', w: 110, mono: true },
        { id: 'id.footer', label: 'Report footer', desc: 'One line appended to printed and PDF reports.', type: 'text', def: 'Tatil Life · a subsidiary of ANSA McAL', w: 300 },
      ]},
      { title: 'SUPER ADMIN', items: [
        { id: 'id.adminemail', label: 'Super admin email', desc: 'The tenant owner. Changing it is an ownership transfer — handled by AgencyTrack support.', lock: 'platform', value: 'A.GOPAUL@TATIL.CO.TT' },
        { id: 'id.adminphone', label: 'Super admin phone', type: 'text', def: '+1 868 622 4820', w: 170, mono: true },
      ]},
      { title: 'PREFERENCES', items: [
        { id: 'id.namespace', label: 'Org namespace', desc: 'Your portal address — tatil.agencytrack.app.', lock: 'platform', value: 'TATIL' },
        { id: 'id.fiscal', label: 'Fiscal year', desc: 'Anchors annual targets, award seasons and YTD.', type: 'seg', options: ['Jan – Dec', 'Oct – Sep'], def: 'Jan – Dec' },
        { id: 'id.dateformat', label: 'Date format', desc: 'Display only — dates are stored the same way for every tenant.', type: 'seg', options: ['dd MMM yyyy', 'yyyy-mm-dd'], def: 'dd MMM yyyy' },
        { id: 'id.tz', label: 'Timezone & currency', desc: 'All timestamps and money render through the platform rule.', lock: 'platform', value: 'AST · UTC−4 · TTD' },
      ]},
    ],
  },
  org: {
    label: 'Organization',
    blurb: 'Names and shape of your hierarchy. Branches and units themselves are managed under Branches & Units.',
    groups: [
      { title: 'CAREER LEVELS', items: [
        { id: 'org.levels', label: 'Career level names', desc: 'The ladder as your company names it — used on profiles, goals and the career portal.', type: 'textchips', def: ['Advisor', 'Senior Advisor', 'Executive Advisor', 'Unit Manager', 'Branch Manager'] },
      ]},
      { title: 'STRUCTURE ALERTS', items: [
        { id: 'org.unitmax', label: 'Unit size warning', desc: 'Flag units larger than this on the manager dashboard.', type: 'number', def: 12, suffix: 'agents' },
        { id: 'org.spanalert', label: 'Manager span alert', desc: 'Flag branch managers overseeing more units than this.', type: 'number', def: 3, suffix: 'units' },
      ]},
    ],
  },
  targets: {
    label: 'Targets & Minimums',
    blurb: 'The production floors every agent is measured against — by tenure band. These drive AT FLOOR / BELOW flags on dashboards, Master Sheet and WARs.',
    groups: [
      { title: 'TENURE-BAND MINIMUMS', sub: 'Edit a band\u2019s name, range or floor directly. Weekly floors derive automatically (annual \u00f7 48). Floor changes are effective-dated.', items: [
        { id: 'targets.bands', label: 'Tenure bands', type: 'bands', bare: true, dated: true,
          def: [
            { band: 'L1', from: 0, to: 12, floor: 250000 },
            { band: 'L2', from: 13, to: 24, floor: 350000 },
            { band: 'L3', from: 25, to: 36, floor: 450000 },
            { band: 'L4', from: 37, to: null, floor: 550000 },
          ] },
      ]},
      { title: 'PACE & WARNINGS', items: [
        { id: 'targets.pace', label: 'Pace-warning threshold', desc: 'Agents show AT FLOOR when weekly pace drops below this share of their band minimum.', type: 'number', def: 80, suffix: '%' },
        { id: 'targets.grace', label: 'Below-floor grace period', desc: 'Consecutive weeks below floor before the exception escalates to the branch manager.', type: 'seg', options: ['1 wk', '2 wk', '4 wk'], def: '2 wk' },
      ]},
      { title: 'CLUB & COMPANY THRESHOLDS', items: [
        { id: 'targets.floor', label: 'Company API floor', desc: 'The organisation-wide annual production minimum, quoted in campaigns and goal-setting. Effective-dated — past periods keep the value in force at the time.', type: 'currency', def: 9600000, dated: true },
        { id: 'targets.mdrt', label: 'MDRT threshold', desc: 'Mirrors the official MDRT requirement in TTD · settled API. Pace figures are applied by Cloud Functions.', type: 'currency', def: 1020000, lock: 'soon', tier: 'TIER 2' },
      ]},
    ],
  },
  cadence: {
    label: 'Reporting Cadence',
    blurb: 'The weekly rhythm — when reports open, close and chase.',
    groups: [
      { title: 'WEEKLY RHYTHM', items: [
        { id: 'cad.weekstart', label: 'Week starts on', desc: 'Anchors WARs, streaks and every weekly number.', type: 'seg', options: ['Monday', 'Sunday'], def: 'Monday' },
        { id: 'cad.wardue', label: 'Weekly report due', desc: 'Reports still open after this day count as late.', type: 'seg', options: ['Friday', 'Saturday', 'Monday'], def: 'Friday' },
        { id: 'cad.monthly', label: 'Monthly close day', desc: 'Day of month the production summary is cut.', type: 'number', def: 3, suffix: 'of month' },
      ]},
      { title: 'NUDGES', items: [
        { id: 'cad.nudges', label: 'Nudge schedule', desc: 'Reminder times for open reports — read by the scheduler at runtime.', type: 'text', def: 'Fri 09:00 · Mon 08:00', w: 190, mono: true, lock: 'soon', tier: 'TIER 2' },
      ]},
    ],
  },
  activity: {
    label: 'Activity Standards',
    blurb: 'The weekly activity floor beneath the production floor — what "working the book" means here.',
    groups: [
      { title: 'WEEKLY COMPANY-FLOOR STANDARDS', sub: 'The tenant defaults every unit starts from — rename, retune, add or remove standards. Per-manager overrides live in the manager flow; counts here are read-only.', items: [
        { id: 'act.standards', label: 'Weekly standards', type: 'standards', bare: true,
          def: [
            { name: 'Calls Made', wk: 60, ovr: 3 },
            { name: 'Contacts Made', wk: 40, ovr: 3 },
            { name: 'Appointments', wk: 20, ovr: 1 },
            { name: 'Interviews Kept', wk: 15, ovr: 0 },
            { name: 'Fact Finds', wk: 10, ovr: 2 },
            { name: 'Closing Interviews', wk: 10, ovr: 0 },
            { name: 'Clients Sold', wk: 1, ovr: 0 },
            { name: 'Referrals', wk: 100, ovr: 5 },
          ] },
      ]},
      { title: 'COUNTING RULES', items: [
        { id: 'act.band', label: '"At floor" band', desc: 'Actuals within this share of a standard count as AT, not BELOW.', type: 'number', def: 90, suffix: '%' },
        { id: 'act.joint', label: 'Joint calls count toward minimums', desc: 'Off counts joint work for the senior agent only.', type: 'toggle', def: true },
      ]},
    ],
  },
  recognition: {
    label: 'Recognition & Gamification',
    blurb: 'How effort gets seen: the points scale behind streaks and the leaderboard, milestone moments, and how loud celebration is allowed to be.',
    accent: 'gold',
    groups: [
      { title: 'POINTS SCALE', sub: 'What each captured activity is worth. Points feed streaks, the leaderboard and campaigns — production standing stays API-based.', items: [
        { id: 'rec.points', label: 'Points scale', type: 'points', bare: true,
          def: [
            { act: 'Call', code: 'CALL', pts: 1 },
            { act: 'Contact', code: 'CONT', pts: 2 },
            { act: 'Appointment kept', code: 'APPT', pts: 5 },
            { act: 'Fact find', code: 'FF', pts: 8 },
            { act: 'Closing interview', code: 'CI', pts: 10 },
            { act: 'Application submitted', code: 'APP', pts: 15 },
            { act: 'Referral collected', code: 'REF', pts: 3 },
          ] },
        { id: 'rec.capture', label: 'Points applied at capture', desc: 'Written by onSubmissionWrite as activity lands — moves to this scale at runtime.', type: 'text', def: 'ON SUBMISSION', w: 150, mono: true, lock: 'soon', tier: 'TIER 2' },
      ]},
      { title: 'STREAK MILESTONES', items: [
        { id: 'rec.milestones', label: 'Milestone thresholds', desc: 'Weeks of unbroken reporting that earn a recognition moment. Each fires once.', type: 'milestones', def: [4, 8, 12, 26, 52] },
        { id: 'rec.streakgrace', label: 'Streak grace', desc: 'One missed week doesn\u2019t break a streak — once per quarter.', type: 'toggle', def: true },
      ]},
      { title: 'LEADERBOARD', items: [
        { id: 'rec.scope', label: 'Visibility scope', desc: 'How far beyond their own team an agent can see ranked names.', type: 'seg', options: ['Unit', 'Branch', 'Whole company'], def: 'Unit' },
        { id: 'rec.showttd', label: 'Show TTD amounts', desc: 'Off shows API bands instead of exact figures on ranked lists.', type: 'toggle', def: false },
      ]},
      { title: 'CELEBRATION', items: [
        { id: 'rec.celebrate', label: 'Celebration intensity', desc: 'Full adds the confetti + sound moment in Daily Capture and Meeting Mode. Always respects reduced-motion.', type: 'seg', options: ['Off', 'Subtle', 'Full'], def: 'Subtle' },
      ]},
    ],
  },
  awards: {
    label: 'Awards & Clubs',
    blurb: 'Club thresholds and seasons. Awards shipped with full override plumbing first — the pattern the rest of config replicates.',
    accent: 'gold',
    groups: [
      { title: 'AWARD CATALOG', sub: 'Your company\u2019s own ladder — rename, re-threshold, activate or retire awards. Threshold changes are effective-dated: past seasons keep the value in force at the time.', items: [
        { id: 'aw.clubs', label: 'Awards & clubs', type: 'clubs', bare: true, dated: true,
          def: [
            { name: 'Gold Club', threshold: 1800000, tier: 'Badge + trip', active: true },
            { name: 'Silver Club', threshold: 1200000, tier: 'Badge', active: true },
            { name: 'Bronze Club', threshold: 800000, tier: 'Badge', active: true },
            { name: 'MDRT Award', threshold: 1020000, tier: 'Badge', active: true },
            { name: 'Rising Star (first 24 months)', threshold: 400000, tier: 'Badge', active: false },
          ] },
      ]},
      { title: 'SEASON & BASIS', items: [
        { id: 'aw.season', label: 'Award season', type: 'seg', options: ['Calendar year', 'Fiscal (Oct–Sep)'], def: 'Calendar year' },
        { id: 'aw.announce', label: 'Announce qualifiers', desc: 'Where new qualifiers get celebrated.', type: 'seg', options: ['Kiosk + app', 'App only', 'Managers only'], def: 'Kiosk + app' },
        { id: 'aw.basis', label: 'Qualification basis', desc: 'Clubs qualify on settled production only — a product principle, not a preference.', lock: 'platform', value: 'SETTLED API ONLY' },
      ]},
    ],
  },
  financing: {
    label: 'Financing Thresholds',
    blurb: 'Guardrails around financed business and take-home health.',
    groups: [
      { title: 'VALIDATION', items: [
        { id: 'fin.validate', label: 'Financing validation threshold', desc: 'Financed cases above this route through CRO validation.', type: 'currency', def: 50000 },
        { id: 'fin.takehome', label: 'Take-home floor warning', desc: 'Warn when projected take-home falls below this share of gross.', type: 'number', def: 65, suffix: '%' },
      ]},
      { title: 'CLAWBACK', items: [
        { id: 'fin.claw', label: 'Clawback alert window', desc: 'How far ahead the dashboard warns about at-risk advances.', type: 'seg', options: ['30 days', '60 days', '90 days'], def: '60 days' },
      ]},
    ],
  },
  kiosk: {
    label: 'Kiosk',
    blurb: 'The read-only branch lobby screen — what it shows and how fast it moves.',
    groups: [
      { title: 'ROTATION', items: [
        { id: 'kio.rotate', label: 'Slide rotation', desc: 'Seconds each slide holds before advancing.', type: 'number', def: 12, suffix: 's' },
        { id: 'kio.idle', label: 'Idle data refresh', type: 'number', def: 15, suffix: 'min' },
      ]},
      { title: 'CONTENT', items: [
        { id: 'kio.leader', label: 'Leaderboard slide', type: 'toggle', def: true },
        { id: 'kio.recog', label: 'Recognition loop', desc: 'Streak milestones and award moments from the last 30 days.', type: 'toggle', def: true },
      ]},
    ],
  },
  policy: {
    label: 'Policy & Delivery',
    blurb: 'Delivery-register bands and NTU handling.',
    groups: [
      { title: 'DELIVERY DISPLAY BANDS', sub: 'Days since issue — colors the delivery register.', items: [
        { id: 'pol.green', label: 'On track (green) up to', type: 'number', def: 10, suffix: 'days' },
        { id: 'pol.amber', label: 'Attention (amber) up to', desc: 'Beyond this the row shows the OVER treatment.', type: 'number', def: 20, suffix: 'days' },
      ]},
      { title: 'NTU', items: [
        { id: 'pol.ntu', label: 'NTU window', desc: 'Days before an undelivered policy is flagged not-taken-up.', type: 'number', def: 30, suffix: 'days' },
        { id: 'pol.remind', label: 'Delivery reminders', type: 'seg', options: ['Daily', 'Weekly'], def: 'Weekly' },
      ]},
    ],
  },
  flags: {
    label: 'Feature Flags',
    blurb: 'Early features you can switch on for your whole tenant before they graduate into their own config sections.',
    groups: [], // rendered specially
  },
  data: {
    label: 'Data & Privacy',
    blurb: 'What leaves the system, and what never does.',
    groups: [
      { title: 'EXPORTS & RETENTION', items: [
        { id: 'dat.export', label: 'Branch managers can export CSVs', desc: 'Off limits exports to tenant admins and the CRO.', type: 'toggle', def: false },
        { id: 'dat.retention', label: 'Activity data retention', type: 'seg', options: ['24 months', '36 months', '60 months'], def: '36 months' },
      ]},
      { title: 'HARD GUARANTEES', items: [
        { id: 'dat.pii', label: 'Client PII on leaderboards', lock: 'platform', value: 'NEVER' },
        { id: 'dat.audit', label: 'Audit log retention', lock: 'platform', value: 'FOREVER' },
      ]},
    ],
  },
};

const CCP_FLAGS = [
  { id: 'flag.persistency', key: 'persistency.v2_model', name: 'Persistency v2 model',
    desc: 'Rolling 24-month lifecycle persistency (time-weighted credits − debits). Switching restates persistency organisation-wide.' },
  { id: 'flag.planner', key: 'planner.scheduler', name: 'Planner & Scheduler',
    desc: 'Weekly planner with joint-call escalation to unit managers.' },
  { id: 'flag.trackk', key: 'financing.track_k', name: 'Track K financing',
    desc: 'Financing validation dashboards and the take-home waterfall.' },
  { id: 'flag.kiosk', key: 'kiosk.branch_display', name: 'Branch kiosk display',
    desc: 'Read-only lobby screen: leaderboard + recognition loop. Configure under Kiosk once enabled.' },
  { id: 'flag.whatsapp', key: 'capture.whatsapp_nudges', name: 'WhatsApp nudges',
    desc: 'Reminder messages for agents with a weekly report still open on Friday.' },
];

// Pre-seeded tenant overrides (as if made before today).
const CCP_SEED = {
  'targets.pace': { value: 85, who: 'Alicia Gopaul', date: '12 Jun 2026' },
  'targets.floor': { value: 9600000, who: 'Alicia Gopaul', date: '18 Dec 2025', eff: '1 Jan 2026', was: 8800000 },
  'rec.scope': { value: 'Branch', who: 'Rajiv Maharaj', date: '4 Mar 2026' },
  'flag.persistency': { value: true, who: 'Alicia Gopaul', date: '2 Jun 2026' },
};
const CCP_SEED_LOG = [
  { label: 'Pace-warning threshold', section: 'Targets & Minimums', from: '80%', to: '85%', who: 'Alicia Gopaul', date: '12 Jun 2026' },
  { label: 'Persistency v2 model', section: 'Feature Flags', from: 'OFF', to: 'ON', who: 'Alicia Gopaul', date: '2 Jun 2026' },
  { label: 'Company API floor', section: 'Targets & Minimums', from: 'TTD 8.80M', to: 'TTD 9.60M from 1 Jan 2026', who: 'Alicia Gopaul', date: '18 Dec 2025' },
  { label: 'Leaderboard visibility scope', section: 'Recognition & Gamification', from: 'Unit', to: 'Branch', who: 'Rajiv Maharaj', date: '4 Mar 2026' },
];

// flat index for search + lookups
const CCP_ALL_ITEMS = [];
Object.entries(CCP_SECTIONS).forEach(([sk, sec]) => {
  sec.groups.forEach((g) => g.items.forEach((it) => CCP_ALL_ITEMS.push({ ...it, section: sk, sectionLabel: sec.label, group: g.title })));
});
CCP_FLAGS.forEach((f) => CCP_ALL_ITEMS.push({ id: f.id, label: f.name, desc: f.desc, type: 'flag', def: false, section: 'flags', sectionLabel: 'Feature Flags', group: 'FLAGS' }));
const CCP_BY_ID = Object.fromEntries(CCP_ALL_ITEMS.map((i) => [i.id, i]));

Object.assign(window, { CCP_ADMIN, CCP_TODAY, CCP_NEXT_EFF, CCP_PHASE1, ccpTTD, CCP_GROUPS, CCP_SECTIONS, CCP_FLAGS, CCP_SEED, CCP_SEED_LOG, CCP_ALL_ITEMS, CCP_BY_ID });
